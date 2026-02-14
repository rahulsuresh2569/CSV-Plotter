# CSV Plotter

A web application for uploading CSV files and generating interactive 2D charts. Users select which columns appear on the X and Y axes, with the app automatically detecting delimiters, decimal separators, and header rows — including European CSV formats.

Built as a full-stack application with a React frontend and an Express backend. The backend handles all CSV parsing so the frontend stays lightweight and focused on visualization.

![CSVPlotterDemo](https://github.com/user-attachments/assets/15a5ad07-a36f-48b9-9928-64a033720525)

**Live Demo:** [csv-plotter-s63y.onrender.com](https://csv-plotter-s63y.onrender.com/)
Hosted on Render's free tier — the first load may take up to a minute due to cold start (the server spins down after inactivity).

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/rahulsuresh2569/CSV-Plotter.git
cd CSV-Plotter
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# Run both client and server
npm run dev
```

The app opens at [http://localhost:5173](http://localhost:5173). The backend runs on port 3001 and is proxied through Vite during development.

### Run Tests


```bash
cd server
npm test
```

95 unit and integration tests covering the parsing pipeline, file validation, and type inference.

---

## Architecture

```
Browser                          Server
  |                                |
  |  POST /api/upload (multipart)  |
  |  +---------------------------> |
  |                                |  1. Validate file (size, type, binary check)
  |                                |  2. Parse CSV (9-step pipeline)
  |                                |  3. Infer column types
  |                                |
  |  JSON { columns, data,         |
  |    metadata, warnings }        |
  | <----------------------------+ |
  |                                |
  |  User selects X/Y columns,    |
  |  chart type, range             |
  |  (all client-side)             |
```

**Why client-server instead of parsing in the browser?**
Server-side parsing gives control over memory management, keeps the frontend bundle small, and separates the parsing logic into testable, independent modules. The tradeoff is a network round-trip on every settings change — acceptable for files up to 10 MB.

---

## CSV Parsing Pipeline

The core of the application is a 9-step parsing pipeline that handles diverse CSV formats without user configuration. Each step is a pure function, making the pipeline testable and easy to follow.

```
Raw file buffer
  |
  v
1. preprocessLines()        -- Separate #-comment lines from data, find header candidate
  |
  v
2. autoDetectDelimiter()    -- Count tab/semicolon/comma across sample lines, pick most consistent
  |
  v
3. detectDecimalSeparator() -- Semicolon delimiter implies comma decimal (European format)
  |
  v
4. detectHeader()           -- Compare numeric ratio of first row vs. data rows
  |
  v
5. PapaParse                -- Split cells, handle quoted fields
  |
  v
6. Normalize decimals       -- Replace decimal commas with dots for European CSVs
  |
  v
7. Convert values           -- String to number where possible, empty to null
  |
  v
8. inferColumnTypes()       -- Classify as numeric (>=90%), date (>=80%), or string
  |
  v
9. Build response           -- Columns, data, preview, warnings, metadata
```

<details>
<summary><strong>How delimiter detection handles ambiguous files</strong></summary>

The detector counts each candidate delimiter (`\t`, `;`, `,`) across the first 5 lines and picks the one with the most **consistent** count. Priority order on ties: tab > semicolon > comma.

This matters for European CSVs like TestData2, where both `;` and `,` appear consistently (semicolons delimit columns, commas are decimal separators). The priority order ensures semicolon wins, which then correctly triggers comma-decimal detection in Step 3.

</details>

<details>
<summary><strong>How comment-line headers work (TestData2 pattern)</strong></summary>

Some CSV files embed metadata as `#`-prefixed comment lines, with the last comment before data acting as the header:

```
#P00:TestType  :  2 (Frequency-Sweep);;;
#P01:SignalType:  FRF;;;
...
#Point Nr.; Freq.;FRFMag;FRFPhase       <-- this is the header
0;0,806451613;14,435113;6,789436        <-- data starts here
```

Step 1 captures the last `#` line before data. Step 4 checks if its field count matches the data columns — if it does, it's used as the header. If not (e.g., a metadata line like `#TEST-DATA-START;;;`), it's ignored and normal header detection runs.

</details>

A detailed walkthrough of the pipeline with traces through all three test files is available in [`docs/backend-pipeline.md`](docs/backend-pipeline.md).

---

## Parsing Rules & Edge Cases

The parser makes deliberate assumptions about how to handle ambiguous or messy CSV data. These rules are tested against 18 edge-case CSV files and the 3 provided test datasets.

### Supported Formats

| Setting | Supported values | Auto-detection method |
|---|---|---|
| **Delimiter** | `,` &ensp; `;` &ensp; `\t` | Count each across first 5 lines; pick most consistent. Ties: tab > semicolon > comma |
| **Decimal separator** | `.` &ensp; `,` | Inferred from delimiter — semicolon implies comma decimal (European), otherwise dot |
| **Header row** | Present or absent | Compare numeric ratio of first row vs. data rows. If first row is mostly text and data is mostly numeric, it's a header |
| **Comment lines** | `#`-prefixed | Stripped before parsing. Last comment before data is checked as a potential header |
| **Date formats** | ISO 8601, `MM/DD/YYYY`, `YYYY-MM-DD HH:MM:SS` | Regex pattern match + `Date.parse()` validation. Column needs 80%+ dates to be classified as `date` |

### Missing & Invalid Data

| Scenario | Behavior |
|---|---|
| Empty cell (`,,`) | Converted to `null`. Appears as a gap in charts. Warning generated per column. |
| Non-numeric string in a numeric column (e.g., `"N/A"`, `"error"`) | Kept as string. If column is 90%+ numeric, it stays numeric — the string values appear as gaps. Warning generated. |
| Column with 30-89% numeric values | Classified as `string` by default. UI offers a "Plot anyway" override button. |
| Row with wrong number of columns | Silently dropped. Warning reports how many rows were skipped. |
| Quoted fields containing delimiters | Handled by PapaParse — `"contains,comma"` stays as one field. |
| File with only `#` comment lines | Rejected with `NO_DATA` error and a user-facing message. |
| Single-column CSV | Rejected with `TOO_FEW_COLUMNS` — a chart needs at least one X and one Y. |

### Limits

| Limit | Value | Reason |
|---|---|---|
| Max file size | 10 MB | Multer rejects before parsing. In-memory processing keeps this safe. |
| Preview rows | 20 | First 20 rows shown in the data table. Full data sent for charting. |
| Chart decimation | 500 points | Scatter and bar charts uniformly sample down to 500 points for responsiveness. Line charts render all points. |
| Animation cutoff | 2,000 rows | Chart.js animations disabled above this threshold to prevent UI lag. |
| Y-axis series | 8 max | Eight distinct colors assigned. More series can be selected but colors will repeat. |

### Known Tradeoffs

- **Re-parsing on settings change**: Changing the delimiter, decimal, or header override re-uploads and re-parses the entire file. A server-side cache keyed by file hash + settings would avoid this, but adds complexity that isn't justified at the current scale.
- **Decimal detection is heuristic, not per-cell**: The decimal separator is inferred once from the delimiter (semicolon → comma decimal) and applied globally. A file using semicolons with dot decimals would need a manual override.
- **Dot-separated European dates (`01.02.2026`) are not detected**: The regex pattern matches, but `Date.parse()` cannot reliably parse `dd.MM.yyyy` on all JavaScript engines, so these fall back to `string`. ISO 8601 and slash-separated dates work reliably.

---

## Key Features

| Feature | Details |
|---|---|
| **Auto-detection** | Delimiter (comma, semicolon, tab), decimal separator, header row — all detected automatically with manual override available |
| **European CSV support** | Semicolon-delimited files with comma decimals (e.g., `1.930,53`) are handled natively |
| **Comment handling** | `#`-prefixed metadata lines are stripped; comment-embedded headers are extracted |
| **Chart types** | Line, scatter, and bar charts with multi-series support (up to 8 Y columns) |
| **Date/time axes** | ISO 8601, slash-separated, and space-separated datetime formats detected and rendered on a time scale |
| **Column type override** | Columns with 30-90% numeric values can be forced to numeric, with non-parseable values shown as gaps |
| **Data preview** | First 20 rows in a scrollable table with editable column headers |
| **Row range filtering** | Dual-handle slider to focus on a subset of rows, with presets (First N, Last N, All) |
| **Performance** | Data decimation (uniform sampling at 500 points) and animation cutoff for large datasets |
| **Dark mode** | Full theme support with localStorage persistence |
| **Internationalization** | English and German UI via context-based i18n |
| **PNG export** | One-click chart export |
| **Error handling** | Layered validation (client + server) with user-facing messages and recovery hints |

---

## Project Structure

```
CSV-Plotter/
├── client/                         # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx                 # Root component — state, upload flow, layout
│   │   ├── components/
│   │   │   ├── AppHeader.jsx       # Title, GitHub link, language/theme toggles
│   │   │   ├── FileUpload.jsx      # Drag-and-drop file upload
│   │   │   ├── SampleFilesRow.jsx  # Sample CSV file buttons
│   │   │   ├── StatusBar.jsx       # Metadata, errors, warnings, column overrides
│   │   │   ├── ParsingSettings.jsx # Delimiter/decimal/header overrides
│   │   │   ├── DataPreview.jsx     # Scrollable data table with editable headers
│   │   │   ├── ColumnSelector.jsx  # X/Y axis selection sidebar
│   │   │   ├── ChartView.jsx       # Chart rendering, range filtering, fullscreen
│   │   │   ├── ChartToolbar.jsx    # Chart type buttons, export, fullscreen toggle
│   │   │   ├── RangeSlider.jsx     # Dual-handle range slider
│   │   │   ├── Toast.jsx           # Auto-dismissing notification
│   │   │   ├── EmptyState.jsx      # Placeholder shown when no file is loaded
│   │   │   └── SkeletonLoader.jsx  # Loading skeleton during first upload
│   │   ├── utils/
│   │   │   ├── selection.js        # Column auto-selection and override merging
│   │   │   ├── chartData.js        # Row slicing, downsampling, Chart.js dataset building
│   │   │   └── uploadHelpers.js    # Warning-to-error promotion logic
│   │   ├── services/api.js         # Axios wrapper for upload endpoint
│   │   ├── i18n.js                 # EN/DE translation strings
│   │   └── LanguageContext.jsx     # React Context for language
│   └── public/sample-data/         # Bundled sample CSV files
│
├── server/                         # Express backend
│   ├── src/
│   │   ├── index.js                # Express app setup, middleware, error handler
│   │   ├── routes/upload.js        # POST /api/upload — multer + parsing pipeline
│   │   ├── services/
│   │   │   ├── parser.js           # 9-step CSV parsing pipeline
│   │   │   └── inferTypes.js       # Column type classification (numeric/date/string)
│   │   ├── utils/validators.js     # File validation (MIME, size, binary detection)
│   │   └── __tests__/              # Vitest unit and integration tests
│   └── .env                        # PORT configuration
│
├── test-data/csv_test_pack/        # 18 CSV files covering edge cases
├── docs/backend-pipeline.md        # Detailed parsing pipeline documentation
└── package.json                    # Root workspace — runs client + server concurrently
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 19, Vite 7 | Fast dev server, modern React with hooks |
| **Charting** | Chart.js + react-chartjs-2 | Declarative chart components with built-in time scale support |
| **Styling** | CSS Modules + CSS custom properties | Scoped styles without runtime overhead, easy theming |
| **Backend** | Express 5, Node.js | Minimal API surface (single endpoint), fast startup |
| **CSV parsing** | PapaParse | Battle-tested parser that handles quoted fields, escaped characters, and edge cases |
| **File uploads** | Multer (memory storage) | In-memory processing — no temp files, no cleanup, stateless server |
| **Testing** | Vitest | Fast, ESM-native, compatible with the project's module system |

---

## API Reference

### `POST /api/upload`

Parses an uploaded CSV file and returns structured data for charting.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | CSV file (max 10 MB) |
| `delimiter` | String | No | Override auto-detected delimiter (`,`, `;`, `\t`) |
| `decimal` | String | No | Override auto-detected decimal separator (`.`, `,`) |
| `hasHeader` | String | No | `"true"` or `"false"` to override header detection |

**Response** — `200 OK`

```json
{
  "columns": [
    { "name": "x", "type": "numeric", "index": 0, "numericCount": 100, "nonNullCount": 100 }
  ],
  "data": [[0, 1.5], [1, 3.2]],
  "rowCount": 100,
  "preview": [[0, 1.5], [1, 3.2]],
  "warnings": ["Column 'y': 3 missing values"],
  "metadata": {
    "delimiter": ";",
    "decimalSeparator": ",",
    "hasHeader": true,
    "commentLinesSkipped": 29,
    "originalFileName": "TestData2.csv"
  }
}
```

**Error responses** use the same JSON shape with an `error` field and a `code` for programmatic handling (`NO_FILE`, `EMPTY_FILE`, `INVALID_TYPE`, `BINARY_FILE`, `NO_DATA`, `NO_DATA_ROWS`, `TOO_FEW_COLUMNS`).

---

## Design Decisions

<details>
<summary><strong>In-memory file processing</strong></summary>

Uploaded files are held in a Buffer (via Multer's `memoryStorage`), parsed, and discarded. No files are written to disk. This keeps the server stateless and eliminates the need for temp file cleanup. The 10 MB file size limit makes this safe from a memory perspective.

</details>

<details>
<summary><strong>Delimiter priority: tab > semicolon > comma</strong></summary>

When multiple delimiters are equally consistent, the priority order resolves ambiguity. Tab is rarest in actual data values. Semicolon indicates European format (which triggers comma-decimal detection). Comma is the fallback. This ordering correctly handles all three provided test files without user intervention.

</details>

<details>
<summary><strong>90% threshold for numeric columns</strong></summary>

A column is classified as numeric if at least 90% of its non-null values are numbers. This allows a column with occasional bad data (e.g., "N/A", "error") to still be plotted numerically, with non-parseable values appearing as gaps. Columns between 30-90% numeric trigger a "Plot anyway" prompt in the UI, giving users the choice.

</details>

<details>
<summary><strong>State management without external libraries</strong></summary>

All application state lives in React `useState` hooks within `App.jsx`, grouped into five labeled sections: upload/response, parsing settings, column selections, UI preferences, and feedback. The upload flow is split into `doUpload`, `applySuccessState`, and `applyErrorState` so each path is easy to follow. Data transforms live in utility files (`selection.js`, `chartData.js`, `uploadHelpers.js`), and layout-only markup is extracted into small components (`AppHeader`, `EmptyState`, etc.). For the current scale (~14 state variables, single-page app), this is simpler and more transparent than introducing Redux or Zustand. If the app grew to support multiple files or sessions, extracting state into custom hooks or an external store would be the natural next step.

</details>

<details>
<summary><strong>CSS Modules over Tailwind</strong></summary>

Each component has a co-located `.module.css` file. CSS custom properties in `index.css` define the design system (colors, spacing, radii, shadows) with dark mode overrides via `[data-theme='dark']`. This approach keeps styles scoped, the bundle small, and avoids adding a build-time dependency for utility classes.

</details>

---

## Testing

The backend parsing pipeline is covered by **95 tests** across three test files:

| Test file | Tests | Covers |
|---|---|---|
| `validators.test.js` | 12 | File validation: null input, empty files, MIME types, binary detection |
| `inferTypes.test.js` | 21 | Column type classification: numeric thresholds, date formats, null handling, edge cases |
| `parser.test.js` | 62 | Pipeline functions, error paths, override behavior, warnings, and integration tests against all 21 CSV files |

The test data includes 18 purpose-built CSV files in `test-data/csv_test_pack/` covering: comma/semicolon/tab delimiters, European decimals, missing values, mixed types, comment headers, headerless files, quoted fields, ragged rows, datetime columns, categorical data, large datasets (2000 rows), and columns with varying numeric ratios (90%, 75%, 60%, 45%, 30%, 15%) to test the classification threshold.

---

## What I Would Improve With More Time

- **TypeScript** — The complex data structures (parse results, column types, settings) would benefit from static typing.
- **Streaming for large files** — PapaParse supports streaming; combined with Node.js readable streams, this would lift the 10 MB limit.
- **Chart zoom/pan** — The Chart.js zoom plugin would allow interactive exploration of dense datasets.
- **CSV data export** — Download the parsed and filtered data back as a clean CSV.
- **Caching parsed results** — Re-parsing the same file on every settings change is wasteful; a hash-based cache would eliminate redundant work.
- **Accessibility** — Additional ARIA labels, keyboard navigation for the range slider, and `aria-live` regions for dynamic status updates.
