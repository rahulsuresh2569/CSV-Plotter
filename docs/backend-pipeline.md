# Backend Parsing Pipeline — How It Works

This document walks through the entire backend CSV parsing pipeline step by
step, using the three test data files as concrete examples.

---

## Overview

When a CSV file is uploaded to `POST /api/upload`, it passes through a
chain of processing stages before the frontend receives clean, structured
JSON. The chain is:

```
Browser sends file
  │
  ▼
upload.js          →  multer receives the file (in-memory, max 10 MB)
                   →  extracts optional override params (delimiter, decimal, hasHeader)
  │
  ▼
validators.js      →  validateFile(): is it non-empty, text, CSV-like?
  │
  ▼
parser.js          →  parseCSV() orchestrates the full pipeline:
  │
  ├─ Step 1:  preprocessLines()       — separate # comments from data
  ├─ Step 2:  autoDetectDelimiter()   — figure out if it's ; or , or tab
  ├─ Step 3:  detectDecimalSeparator()— infer decimal format from delimiter
  ├─ Step 4:  detectHeader()          — is the first row a header or data?
  ├─ Step 5:  PapaParse               — split each line into cells
  ├─ Step 6:  normalize decimals      — replace decimal commas with dots
  ├─ Step 7:  convert values          — turn numeric strings into numbers
  ├─ Step 8:  inferColumnTypes()      — classify columns as numeric/string
  └─ Step 9:  build response          — assemble the final JSON
  │
  ▼
JSON response sent to frontend
```

---

## File: `upload.js` — The Route Handler

**Location:** `server/src/routes/upload.js`

This is the entry point. It sets up multer middleware and wires everything
together.

### Multer setup (lines 9-12)

```javascript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
```

- **`memoryStorage()`** — the uploaded file is held in a `Buffer` in RAM,
  never written to disk. This is both secure (no temp files to clean up) and
  fast (no disk I/O).
- **`fileSize: 10 MB`** — if someone uploads a 50 MB file, multer rejects
  it before our code even runs.

### Why multer is called manually (lines 16-18)

```javascript
const uploadMiddleware = upload.single('file');
uploadMiddleware(req, res, (multerErr) => { ... });
```

Instead of the typical `router.post('/upload', upload.single('file'), handler)`,
we call multer as a callback. This lets us catch multer errors (like file too
large) in the **same function** as parse errors, producing consistent error
responses for the frontend.

### Override parameters (lines 44-48)

```javascript
const overrides = {
  delimiter: req.body?.delimiter || 'auto',
  decimal:   req.body?.decimal   || 'auto',
  hasHeader: req.body?.hasHeader || 'auto',
};
```

When the frontend sends a multipart form, non-file fields end up in
`req.body`. These optional fields let the user override auto-detection
(e.g., force delimiter to `;`). On first upload they're absent, so
everything defaults to `'auto'`.

### Error handling (lines 55-67)

Two categories:
- **`ParseError`** (our custom class) — known, user-facing errors like
  "file has no data rows." Returns HTTP 400 with a plain-language message.
- **Anything else** — unexpected bug. Returns HTTP 500 and logs the stack
  trace server-side.

---

## File: `validators.js` — Gate Before Parsing

**Location:** `server/src/utils/validators.js`

This runs **before** the parsing pipeline. Its job is to reject obviously
invalid files early, before we spend CPU cycles parsing.

### Check 1: File exists (line 14)

```javascript
if (!file) {
  return { valid: false, error: 'No file was uploaded.', code: 'NO_FILE' };
}
```

If someone sends a POST with no `file` field, `req.file` is `undefined`.

### Check 2: Non-empty (line 18)

```javascript
if (file.size === 0) { ... }
```

A 0-byte file can't be a CSV.

### Check 3: Mimetype + extension (lines 27-36)

```javascript
const isValidMimetype = VALID_MIMETYPES.includes(file.mimetype);
const isValidExtension = file.originalname.toLowerCase().endsWith('.csv');
if (!isValidMimetype && !isValidExtension) { ... }
```

We accept the file if **either** the browser-reported mimetype (`text/csv`,
`text/plain`, etc.) **or** the filename extension (`.csv`) looks right.
This is lenient by design — some systems report `.csv` files as
`application/vnd.ms-excel`.

### Check 4: Binary detection (lines 39-46)

```javascript
const sample = file.buffer.slice(0, Math.min(1024, file.buffer.length));
if (sample.includes(0)) { ... }
```

Text files never contain null bytes (`0x00`). Binary files (images, PDFs,
ZIPs) almost always do. We check the first 1024 bytes. If any null byte
is found, the file is rejected.

**Example:** If someone accidentally uploads `report.pdf` renamed to
`.csv`, this catches it.

---

## File: `parser.js` — The Core Pipeline

**Location:** `server/src/services/parser.js`

This is the heart of the backend. The main function `parseCSV()` orchestrates
9 steps. Let's trace through each one using the test files.

---

### Step 1: `preprocessLines(text)` — Separate Comments from Data

```javascript
const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
```

First, split the raw text into lines, handling all line-ending formats
(`\r\n` Windows, `\n` Unix, `\r` old Mac). Empty lines are discarded.

Then we walk through every line and classify it:

```javascript
for (const line of lines) {
  if (line.trimStart().startsWith('#')) {
    commentLinesSkipped++;
    if (!foundFirstDataLine) {
      commentHeaderLine = line;    // keep overwriting
    }
  } else {
    foundFirstDataLine = true;
    dataLines.push(line);
  }
}
```

- Any line starting with `#` is a comment — it goes into the skip count.
- Among comments that appear **before the first data line**, we keep track
  of the **last** one. This is a potential header (see TestData2 below).
- Comments that appear **after** data starts (like `#TEST-DATA-END`) are
  simply skipped — they don't affect `commentHeaderLine`.
- Non-`#` lines are collected as `dataLines`.

#### How it plays out for each test file

**TestData1.csv** — no `#` lines at all:
```
Line 1: Referenznummer;A-Wert;B-Wert;C-Wert     → data
Line 2: 0;-1930,532345;-845,3621597;208,6071453  → data
Line 3: 2;-2045,69235;-1193,897714;227,8168355   → data
...
```
Result:
- `commentHeaderLine = null`
- `dataLines = [all 102 lines]` (header + 101 data rows — header detection happens later)
- `commentLinesSkipped = 0`

**TestData2.csv** — 29 `#` lines mixed in:
```
Line  1: #TEST-DATA-START;;;                         → comment (#1)
Line  2: #P00:TestType ... ;;;                       → comment (#2)
...
Line 27: #P15:Prüfstand                 : BMW-001;;; → comment (#27)
Line 28: #Point Nr.; Freq.;FRFMag;FRFPhase           → comment (#28) ← last before data
Line 29: 0;0,806451613;14,435113;6,789436            → first data line
...
Line 229: 200;1,612903226;15,10795;6,803003          → last data line
Line 230: #TEST-DATA-END;;;                          → comment (#29, after data — ignored)
```
Result:
- `commentHeaderLine = "#Point Nr.; Freq.;FRFMag;FRFPhase"` (line 28 — the last `#` line before data)
- `dataLines = [201 lines]` (lines 29–229)
- `commentLinesSkipped = 29` (27 metadata + 1 header + 1 footer)

**TestData3.csv** — no `#` lines:
```
Line 1: x,y           → data
Line 2: 10,0          → data
Line 3: 9.999...,0.06 → data
...
```
Result:
- `commentHeaderLine = null`
- `dataLines = [all 9268 lines]`
- `commentLinesSkipped = 0`

---

### Step 2: `autoDetectDelimiter(dataLines)` — Which Character Splits Columns?

The function tries three candidate delimiters in priority order:
**tab → semicolon → comma**.

```javascript
const candidates = ['\t', ';', ','];
const sampleLines = dataLines.slice(0, Math.min(5, dataLines.length));
```

It only looks at the first 5 data lines (enough to establish the pattern,
fast even for huge files).

For each candidate, it counts how many times that character appears in
each sample line:

```javascript
const counts = sampleLines.map((line) => {
  let count = 0;
  for (const ch of line) {
    if (ch === delim) count++;
  }
  return count;
});
```

Then it checks for **consistency** — a correct delimiter appears the
**same number of times** in every line:

```javascript
const isConsistent = minCount === maxCount && minCount > 0;
```

#### TestData1 trace

Sample lines (first 5 of `dataLines`):
```
"Referenznummer;A-Wert;B-Wert;C-Wert"              → 3 semicolons, 0 commas
"0;-1930,532345;-845,3621597;208,6071453"           → 3 semicolons, 3 commas
"2;-2045,69235;-1193,897714;227,8168355"            → 3 semicolons, 3 commas
"4;-1698,411607;-859,1318746;220,8602661"           → 3 semicolons, 3 commas
"6;-1625,601566;-748,7376047;37,18885381"           → 3 semicolons, 3 commas
```

| Candidate | Counts per line   | Consistent? |
|-----------|-------------------|-------------|
| `\t`      | [0, 0, 0, 0, 0]  | No (min=0)  |
| `;`       | [3, 3, 3, 3, 3]  | **Yes** (all 3) |
| `,`       | [0, 3, 3, 3, 3]  | No (min=0, max=3) |

The header line `Referenznummer;A-Wert;B-Wert;C-Wert` has **0 commas** but
**3 semicolons**. This breaks comma's consistency, making semicolon the
only consistent candidate.

Result: **delimiter = `;`**

#### TestData2 trace

The `dataLines` here are the actual data rows (comments already removed).
Sample lines:
```
"0;0,806451613;14,435113;6,789436"     → 3 semicolons, 3 commas
"1;0,811827957;14,68741;6,997549"      → 3 semicolons, 3 commas
...
```

| Candidate | Counts per line | Consistent? |
|-----------|-----------------|-------------|
| `\t`      | [0, 0, 0, 0, 0]| No          |
| `;`       | [3, 3, 3, 3, 3]| **Yes**     |
| `,`       | [3, 3, 3, 3, 3]| **Yes**     |

Both `;` and `,` are consistent at 3! This is a **tie**. The priority
order (`\t` > `;` > `,`) breaks it — semicolon wins because it comes
first in the candidates array.

Result: **delimiter = `;`**

> Why this priority? In European CSV files, `;` is the column delimiter
> and `,` is the decimal separator. If both appear consistently, the file
> is almost certainly European-format.

#### TestData3 trace

Sample lines:
```
"x,y"                                       → 0 semicolons, 1 comma
"10,0"                                      → 0 semicolons, 1 comma
"9.99980221318683,0.0628943331606775"        → 0 semicolons, 1 comma
...
```

| Candidate | Counts per line | Consistent? |
|-----------|-----------------|-------------|
| `\t`      | [0, 0, 0, 0, 0]| No          |
| `;`       | [0, 0, 0, 0, 0]| No          |
| `,`       | [1, 1, 1, 1, 1]| **Yes**     |

Only comma is consistent.

Result: **delimiter = `,`**

---

### Step 3: `detectDecimalSeparator(delimiter)` — Dot or Comma for Decimals?

```javascript
if (delimiter === ';') return ',';
return '.';
```

This is a simple but reliable heuristic based on regional CSV conventions:
- **Semicolon-delimited** files are European → decimal separator is **comma** (e.g., `3,14`)
- **Comma-delimited** or tab-delimited files → decimal separator is **dot** (e.g., `3.14`)

| Test File  | Delimiter | → Decimal separator |
|------------|-----------|---------------------|
| TestData1  | `;`       | `,`                 |
| TestData2  | `;`       | `,`                 |
| TestData3  | `,`       | `.`                 |

This can be overridden by the user if the auto-detection is wrong for an
unusual file.

---

### Step 4: Header Detection — Two Paths

There are two fundamentally different situations:

#### Path A: Header came from a comment line (TestData2)

```javascript
if (commentHeaderLine) {
  hasHeaderDetected = true;
  const stripped = commentHeaderLine.replace(/^#\s*/, '');
  headerNames = stripped.split(delimiter).map((h) => h.trim());
  rowLines = dataLines;
}
```

For TestData2, `commentHeaderLine` is `"#Point Nr.; Freq.;FRFMag;FRFPhase"`.
The processing:
1. Strip the `#` prefix: `"Point Nr.; Freq.;FRFMag;FRFPhase"`
2. Split by `;`: `["Point Nr.", " Freq.", "FRFMag", "FRFPhase"]`
3. Trim whitespace: `["Point Nr.", "Freq.", "FRFMag", "FRFPhase"]`

Since the header came from a comment line, **all** `dataLines` are actual
data (none need to be removed).

#### Path B: No comment header → use `detectHeader()` heuristic (TestData1, TestData3)

```javascript
hasHeaderDetected = detectHeader(
  dataLines[0],           // the candidate (first line)
  dataLines.slice(1),     // the rest of the data
  delimiter,
  decimalSeparator,
);
```

`detectHeader()` answers: "Is the first line a header, or is it data?"

It does this by comparing the **numeric profile** of the first line against
a sample of subsequent lines.

#### `detectHeader()` internals

```javascript
const candidateCells = candidateLine.split(delimiter).map((c) => c.trim());
```

Split the candidate line into cells. Then count how many cells are numeric
using the helper `isNumericCell()`:

```javascript
function isNumericCell(raw, decimalSep) {
  const trimmed = raw.trim();
  const normalized = decimalSep === ',' ? trimmed.replaceAll(',', '.') : trimmed;
  const num = Number(normalized);
  return !isNaN(num) && normalized !== '';
}
```

This helper does decimal normalization **inline** before checking — it
replaces commas with dots so that `"0,806451613"` becomes `"0.806451613"`,
which `Number()` can parse.

Do the same for a sample of up to 5 data lines, then compare ratios:

```javascript
if (dataRatio > 0.5 && candidateRatio < 0.5) return true;   // header
if (candidateRatio >= 0.5) return false;                      // data
return true;                                                  // all strings → assume header
```

#### TestData1 trace

Candidate: `"Referenznummer;A-Wert;B-Wert;C-Wert"` → split by `;`:
- `"Referenznummer"` → `Number("Referenznummer")` = NaN → **not numeric**
- `"A-Wert"` → NaN → **not numeric**
- `"B-Wert"` → NaN → **not numeric**
- `"C-Wert"` → NaN → **not numeric**

Candidate numeric ratio: **0/4 = 0%**

Data sample line: `"0;-1930,532345;-845,3621597;208,6071453"` → split by `;`:
- `"0"` → 0 → **numeric**
- `"-1930,532345"` → normalize → `"-1930.532345"` → -1930.532345 → **numeric**
- `"-845,3621597"` → **numeric**
- `"208,6071453"` → **numeric**

Data numeric ratio: **~100%**

Decision: data ratio (100%) > 0.5 AND candidate ratio (0%) < 0.5 → **header detected**.

#### TestData3 trace

Candidate: `"x,y"` → split by `,`:
- `"x"` → NaN → **not numeric**
- `"y"` → NaN → **not numeric**

Candidate numeric ratio: **0%**

Data sample: `"10,0"` → split by `,`:
- `"10"` → 10 → **numeric**
- `"0"` → 0 → **numeric**

Data numeric ratio: **100%**

Decision: **header detected**.

> **Key edge case**: `10,0` could look like the European decimal number
> `10.0`. But we already know the delimiter is `,` and decimal is `.`, so
> `isNumericCell("10", ".")` correctly sees two separate numeric values.

#### Headerless CSV (hypothetical)

If a file had no header — just rows of numbers:
```
10,20,30
40,50,60
70,80,90
```

Candidate: `"10,20,30"` → all cells numeric → ratio = **100%**
Data: also all numeric → ratio = **100%**

Decision: `candidateRatio >= 0.5` → **not a header** → generate
`["Column 1", "Column 2", "Column 3"]`.

---

### Step 5: PapaParse — Split Lines Into Cells

```javascript
const csvText = rowLines.join('\n');
const parseResult = Papa.parse(csvText, {
  delimiter,
  skipEmptyLines: true,
});
let rows = parseResult.data;
```

At this point we've removed comment lines and separated the header. The
remaining `rowLines` are pure data. We join them back into a single string
and hand it to PapaParse, which:
- Splits each line by the detected delimiter
- Handles quoted fields (e.g., `"hello;world"` stays as one cell even with `;` delimiter)
- Returns an array of arrays, where each inner array is one row of string cells

For TestData1, PapaParse with delimiter `;` turns:
```
"0;-1930,532345;-845,3621597;208,6071453"
```
into:
```javascript
["0", "-1930,532345", "-845,3621597", "208,6071453"]
```

Note: the commas inside values are preserved — they're decimal commas, not
delimiters. PapaParse doesn't touch them.

#### Ragged row filtering (lines 270-278)

```javascript
const expectedCols = headerNames.length;
rows = rows.filter((row) => row.length === expectedCols);
```

If any row has a different number of cells than the header (a "ragged"
row), it's silently dropped and a warning is added. This handles
malformed CSVs gracefully instead of crashing.

---

### Step 6: Normalize Decimals

```javascript
if (decimalSeparator === ',') {
  rows = rows.map((row) =>
    row.map((cell) =>
      typeof cell === 'string' ? cell.replaceAll(',', '.') : cell,
    ),
  );
}
```

For European-format files (TestData1, TestData2), every comma inside a cell
value is a decimal comma. We replace them all with dots so that JavaScript's
`Number()` can parse them later.

| Before                | After                  |
|-----------------------|------------------------|
| `"-1930,532345"`      | `"-1930.532345"`       |
| `"0,806451613"`       | `"0.806451613"`        |
| `"14,435113"`         | `"14.435113"`          |

For TestData3, `decimalSeparator` is `.`, so **nothing happens** — the
values already use dots.

---

### Step 7: Convert Values — Strings to Numbers

```javascript
rows = rows.map((row) =>
  row.map((cell) => {
    if (cell === null || cell === undefined) return null;
    const str = String(cell).trim();
    if (str === '') return null;
    const num = Number(str);
    return !isNaN(num) ? num : str;
  }),
);
```

After decimal normalization, every cell is still a string. This step
attempts to convert each one to a JavaScript number:

- `""` or whitespace → `null` (missing value)
- `"0"` → `Number("0")` → `0` (number)
- `"-1930.532345"` → `Number("-1930.532345")` → `-1930.532345` (number)
- `"hello"` → `Number("hello")` → `NaN` → kept as string `"hello"`

After this step, each cell is either a `number`, a `string`, or `null`.

#### TestData1 row example

Before (after step 6):
```javascript
["0", "-1930.532345", "-845.3621597", "208.6071453"]
```

After step 7:
```javascript
[0, -1930.532345, -845.3621597, 208.6071453]
```

All four values successfully converted to numbers.

---

### Step 8: `inferColumnTypes()` — Classify Each Column

**Location:** `server/src/services/inferTypes.js`

```javascript
export function inferColumnTypes(headerNames, rows) {
  return headerNames.map((name, index) => {
    let numericCount = 0;
    let nonNullCount = 0;

    for (const row of rows) {
      const value = row[index];
      if (value === null || value === undefined) continue;
      nonNullCount++;
      if (typeof value === 'number' && isFinite(value)) {
        numericCount++;
      }
    }

    const type =
      nonNullCount > 0 && numericCount / nonNullCount >= 0.9
        ? 'numeric'
        : 'string';

    return { name, type, index };
  });
}
```

For each column, it scans **all** rows and counts how many non-null values
are JavaScript numbers. If **90% or more** are numbers, the column is
classified as `numeric`. Otherwise it's `string`.

The 90% threshold is intentional — it allows a column to have a handful of
stray non-numeric values (data quality issues) without losing its numeric
classification.

#### TestData1 result

| Column           | Non-null | Numeric | Ratio | Type    |
|------------------|----------|---------|-------|---------|
| Referenznummer   | 101      | 101     | 100%  | numeric |
| A-Wert           | 101      | 101     | 100%  | numeric |
| B-Wert           | 101      | 101     | 100%  | numeric |
| C-Wert           | 101      | 101     | 100%  | numeric |

All four columns are numeric — the frontend will allow any of them for both
X and Y axes.

### Post-inference checks (lines 303-325)

After type inference, two guards run:

1. **Minimum column check** — a chart needs at least 2 columns (one X, one Y).
   If only 1 column is found, a `ParseError` is thrown.

2. **Missing value reporting** — for each column, count how many rows have
   `null`. If any do, a warning is added:
   `Column "X" has 3 missing values — these will appear as gaps in the chart.`

For all three test files, there are zero missing values and 2+ columns,
so no warnings or errors are generated.

---

### Step 9: Build Response

```javascript
return {
  columns,               // [{name, type, index}, ...]
  data: rows,            // [[val, val, ...], ...] — ALL rows
  rowCount: rows.length, // total row count
  preview: rows.slice(0, 20),  // first 20 rows for the preview table
  warnings,              // any warnings generated during parsing
  metadata: {
    delimiter,           // ";" or "," or "\t"
    decimalSeparator,    // "." or ","
    hasHeader,           // true or false
    commentLinesSkipped, // count of # lines
    originalFileName,    // set by the route handler
  },
};
```

The response includes **all data** (not just a preview) because the
frontend needs it for charting. For TestData3's 9,267 rows this produces
a ~300 KB JSON response — well within normal limits.

The `metadata` object tells the frontend what was auto-detected, so it can
display those values in the parsing settings panel (e.g.
`"Delimiter: Auto (detected: ;)"`).

---

## Summary: How Each Test File Flows Through

### TestData1.csv (European, simple)

```
Upload: "TestData1.csv" (4 KB)
  │
  ▼ validateFile → OK (text, .csv, non-empty)
  │
  ▼ preprocessLines
    commentHeaderLine = null
    dataLines = 102 lines (header + 101 data)
    commentLinesSkipped = 0
  │
  ▼ autoDetectDelimiter
    ; counts: [3,3,3,3,3] → consistent ✓
    , counts: [0,3,3,3,3] → inconsistent (header has 0 commas)
    → delimiter = ";"
  │
  ▼ detectDecimalSeparator
    ";" → decimal = ","
  │
  ▼ detectHeader
    Candidate "Referenznummer;A-Wert;B-Wert;C-Wert" → 0% numeric
    Data sample → 100% numeric
    → hasHeader = true
    headerNames = ["Referenznummer", "A-Wert", "B-Wert", "C-Wert"]
    rowLines = 101 data lines
  │
  ▼ PapaParse → 101 rows × 4 string cells
  ▼ normalizeDecimals → replace , with .    ("-1930,532345" → "-1930.532345")
  ▼ convertValues → string → number         ("-1930.532345" → -1930.532345)
  ▼ inferColumnTypes → all 4 columns numeric
  │
  ▼ Response: 4 columns, 101 rows, 0 warnings
```

### TestData2.csv (European, with comment metadata)

```
Upload: "TestData2.csv" (6 KB)
  │
  ▼ validateFile → OK
  │
  ▼ preprocessLines
    commentHeaderLine = "#Point Nr.; Freq.;FRFMag;FRFPhase" (line 28)
    dataLines = 201 lines (lines 29-229)
    commentLinesSkipped = 29 (27 metadata + header + footer)
  │
  ▼ autoDetectDelimiter (on data lines only)
    ; counts: [3,3,3,3,3] → consistent ✓
    , counts: [3,3,3,3,3] → consistent ✓  (tie!)
    → priority order: ";" wins
    → delimiter = ";"
  │
  ▼ detectDecimalSeparator → ","
  │
  ▼ Header: extracted from comment line
    Strip "#" → "Point Nr.; Freq.;FRFMag;FRFPhase"
    Split by ";" → ["Point Nr.", " Freq.", "FRFMag", "FRFPhase"]
    Trim → ["Point Nr.", "Freq.", "FRFMag", "FRFPhase"]
    All 201 dataLines are data (header was a comment)
  │
  ▼ PapaParse → 201 rows × 4 cells
  ▼ normalizeDecimals → "0,806451613" → "0.806451613"
  ▼ convertValues → 0.806451613
  ▼ inferColumnTypes → all 4 numeric
  │
  ▼ Response: 4 columns, 201 rows, 0 warnings
```

### TestData3.csv (Standard, large dataset)

```
Upload: "TestData3.csv" (315 KB)
  │
  ▼ validateFile → OK
  │
  ▼ preprocessLines
    commentHeaderLine = null
    dataLines = 9268 lines
    commentLinesSkipped = 0
  │
  ▼ autoDetectDelimiter
    ; counts: [0,0,0,0,0] → skip
    , counts: [1,1,1,1,1] → consistent ✓
    → delimiter = ","
  │
  ▼ detectDecimalSeparator → "."
  │
  ▼ detectHeader
    Candidate "x,y" → 0% numeric
    Data "10,0" → 100% numeric
    → hasHeader = true
    headerNames = ["x", "y"]
    rowLines = 9267 data lines
  │
  ▼ PapaParse → 9267 rows × 2 cells
  ▼ normalizeDecimals → skip (decimal is already ".")
  ▼ convertValues → "10" → 10, "9.999..." → 9.999...
  ▼ inferColumnTypes → both columns numeric
  │
  ▼ Response: 2 columns, 9267 rows, 0 warnings
```
