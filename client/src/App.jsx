import { useState, useCallback, useMemo } from 'react'
import FileUpload from './components/FileUpload'
import StatusBar from './components/StatusBar'
import ParsingSettings from './components/ParsingSettings'
import DataPreview from './components/DataPreview'
import ColumnSelector from './components/ColumnSelector'
import ChartView from './components/ChartView'
import Toast from './components/Toast'
import { uploadCSV } from './services/api'
import { LanguageProvider } from './LanguageContext'
import translations from './i18n'
import './App.css'

const DEFAULT_SETTINGS = {
  delimiter: 'auto',
  decimal: 'auto',
  hasHeader: 'auto',
}

const SAMPLE_FILES = [
  { name: 'TestData1.csv', path: '/sample-data/TestData1.csv' },
  { name: 'TestData2.csv', path: '/sample-data/TestData2.csv' },
  { name: 'TestData3.csv', path: '/sample-data/TestData3.csv' },
]

function App() {
  // The File object — kept in state so we can re-send it when settings change
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Backend response
  const [parseResult, setParseResult] = useState(null)

  // Parsing overrides (auto by default)
  const [parsingSettings, setParsingSettings] = useState(DEFAULT_SETTINGS)

  // Metadata persisted separately — survives parse errors so ParsingSettings stays visible
  const [lastMetadata, setLastMetadata] = useState(null)

  // Error from upload or parse — stores { code, fallback } so translation happens at render time
  const [error, setError] = useState(null)

  // Column selections
  const [selectedXColumn, setSelectedXColumn] = useState(null)
  const [selectedYColumns, setSelectedYColumns] = useState([])

  // Custom column name overrides: { [columnIndex]: "custom name" }
  const [columnNames, setColumnNames] = useState({})

  // Column type overrides (Set of column indices forced to numeric)
  const [overriddenColumns, setOverriddenColumns] = useState(() => new Set())

  // Chart type: 'line' | 'scatter' | 'bar'
  const [chartType, setChartType] = useState('line')

  // Toast notification
  const [toast, setToast] = useState(null)

  // Dark mode — set data-theme synchronously so CSS variables are available
  // during the same render cycle (before child useMemo hooks read them)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('csv-plotter-theme') === 'dark'
    document.documentElement.setAttribute('data-theme', saved ? 'dark' : 'light')
    return saved
  })

  function toggleDarkMode() {
    setDarkMode((prev) => {
      const next = !prev
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
      localStorage.setItem('csv-plotter-theme', next ? 'dark' : 'light')
      return next
    })
  }

  // Language — persisted in localStorage
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('csv-plotter-lang') || 'en'
  })

  function toggleLanguage() {
    setLanguage((prev) => {
      const next = prev === 'en' ? 'de' : 'en'
      localStorage.setItem('csv-plotter-lang', next)
      return next
    })
  }

  const t = translations[language] || translations.en

  /**
   * Merge custom column names into the parsed columns array.
   * Children receive this merged array and always read col.name.
   */
  const columns = useMemo(() => {
    if (!parseResult?.columns) return []
    return parseResult.columns.map((col) => {
      const name = columnNames[col.index] ?? col.name
      if (overriddenColumns.has(col.index) && col.type !== 'numeric') {
        return { ...col, name, type: 'numeric', originalType: col.type }
      }
      return { ...col, name }
    })
  }, [parseResult?.columns, columnNames, overriddenColumns])

  /**
   * Upload a file to the backend with the given settings.
   * Called on initial file select and when Apply is clicked in ParsingSettings.
   */
  const doUpload = useCallback(async (fileToUpload, settings) => {
    setIsUploading(true)
    setError(null)

    try {
      const result = await uploadCSV(fileToUpload, settings)

      // Promote "no numeric columns" from warning to error — chart cannot be plotted
      var noNumericIdx = -1
      for (var i = 0; i < (result.warnings || []).length; i++) {
        if (result.warnings[i] && result.warnings[i].key === 'warningNoNumericColumns') {
          noNumericIdx = i
          break
        }
      }
      if (noNumericIdx !== -1) {
        result.warnings.splice(noNumericIdx, 1)
        setError({ code: 'NO_NUMERIC_COLUMNS', fallback: 'No numeric columns found.' })
      }

      setParseResult(result)
      setLastMetadata(result.metadata)

      // Show success toast
      const rowLabel = `${result.rowCount?.toLocaleString()} ${t.rows}`
      setToast(`${t.parseSuccess} \u2014 ${rowLabel}`)

      // Auto-select first column as X, auto-select first few numeric Y columns
      if (result.columns.length > 0) {
        setSelectedXColumn(result.columns[0].index)
        const MAX_AUTO_Y = 4
        const numericY = result.columns
          .filter((c) => c.index !== result.columns[0].index && c.type === 'numeric')
          .slice(0, MAX_AUTO_Y)
          .map((c) => c.index)
        setSelectedYColumns(numericY)
      } else {
        setSelectedYColumns([])
      }
      setColumnNames({})
      setOverriddenColumns(new Set())
    } catch (err) {
      // axios wraps the response in err.response
      const data = err.response?.data

      // Store code + fallback — translation happens at render time so language switches apply
      const errorCode = data?.code || null
      const fallback = data?.error || err.message || 'An unexpected error occurred.'

      // Persist metadata from error response if available
      if (data?.metadata) {
        setLastMetadata(data.metadata)
      }

      setError({ code: errorCode, fallback })
      setParseResult(null)
      setSelectedXColumn(null)
      setSelectedYColumns([])
      setColumnNames({})
      setOverriddenColumns(new Set())
    } finally {
      setIsUploading(false)
    }
  }, [t])

  /**
   * Called when the user selects a file via drag-and-drop or file input.
   * Resets settings to auto and uploads.
   */
  function handleFileSelect(selectedFile) {
    setFile(selectedFile)
    setParsingSettings(DEFAULT_SETTINGS)
    doUpload(selectedFile, DEFAULT_SETTINGS)
  }

  /**
   * Called when the user clicks a sample file button.
   * Fetches the CSV from public/, wraps it in a File object,
   * and feeds it through the normal upload flow.
   */
  async function handleSampleSelect(sample) {
    const res = await fetch(sample.path)
    const text = await res.text()
    const blob = new Blob([text], { type: 'text/csv' })
    const sampleFile = new File([blob], sample.name, { type: 'text/csv' })
    handleFileSelect(sampleFile)
  }

  /**
   * Called when Apply is clicked in ParsingSettings.
   * Commits the new settings and re-uploads the same file.
   */
  function handleSettingsApply(newSettings) {
    setParsingSettings(newSettings)
    if (file) {
      doUpload(file, newSettings)
    }
  }

  function handleColumnRename(columnIndex, newName) {
    setColumnNames((prev) => ({ ...prev, [columnIndex]: newName }))
  }

  function handleOverride(colIndex) {
    setOverriddenColumns((prev) => new Set(prev).add(colIndex))
    setSelectedYColumns((prev) =>
      prev.includes(colIndex) ? prev : [...prev, colIndex]
    )
    // Clear "no numeric columns" error when user forces a column to numeric
    if (error && error.code === 'NO_NUMERIC_COLUMNS') {
      setError(null)
    }
  }

  function handleUndoOverride(colIndex) {
    setOverriddenColumns((prev) => {
      const next = new Set(prev)
      next.delete(colIndex)
      return next
    })
    setSelectedYColumns((prev) => prev.filter((idx) => idx !== colIndex))
  }

  // Show ParsingSettings when we have metadata (from success or from error)
  const showParsingSettings = !!lastMetadata && !!file

  // Whether headers were auto-generated (no header row detected)
  const headersAutoGenerated = parseResult && lastMetadata && !lastMetadata.hasHeader

  // Whether any columns can be plotted on the Y-axis
  const hasPlottableColumns = columns.some((col) => col.type === 'numeric')

  return (
    <LanguageProvider language={language}>
      <div className="app">
        <header className="app-header">
          <div className="app-header-row">
            <div>
              <h1>{t.appTitle}</h1>
              <p className="app-subtitle">{t.appSubtitle}</p>
            </div>
            <div className="header-controls">
              <a
                className="github-link"
                href="https://github.com/rahulsuresh2569/CSV-Plotter"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
              </a>
              <button
                className="lang-toggle"
                onClick={toggleLanguage}
                title={language === 'en' ? 'Deutsch' : 'English'}
              >
                {language === 'en' ? 'DE' : 'EN'}
              </button>
              <button
                className="theme-toggle"
                onClick={toggleDarkMode}
                title={darkMode ? t.switchToLight : t.switchToDark}
              >
                {darkMode ? '\u2600' : '\u263E'}
              </button>
            </div>
          </div>
        </header>

        <main className="app-main">
          <FileUpload
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
            currentFileName={file?.name || null}
          />

          <div className="sample-row">
            <span className="sample-label">{t.trySample}</span>
            <span className="sample-btns">
              {SAMPLE_FILES.map((sample) => (
                <button
                  key={sample.name}
                  className="sample-btn"
                  onClick={() => handleSampleSelect(sample)}
                  disabled={isUploading}
                >
                  {sample.name}
                </button>
              ))}
            </span>
          </div>

          <StatusBar
            error={error ? (t['error_' + error.code] || error.fallback) : null}
            warnings={parseResult?.warnings || []}
            metadata={parseResult?.metadata || null}
            rowCount={parseResult?.rowCount || null}
            columnCount={parseResult?.columns?.length || null}
            showSettingsHint={!!error && showParsingSettings}
            columns={columns}
            overriddenColumns={overriddenColumns}
            onOverride={handleOverride}
            onUndoOverride={handleUndoOverride}
          />

          {showParsingSettings && (
            <ParsingSettings
              settings={parsingSettings}
              metadata={lastMetadata}
              onApply={handleSettingsApply}
              disabled={isUploading}
            />
          )}

          {parseResult && (
            <>
              <DataPreview
                columns={columns}
                rows={parseResult.preview}
                onColumnRename={handleColumnRename}
                headersAutoGenerated={headersAutoGenerated}
              />
              {hasPlottableColumns && (
                <div className="chart-section">
                  <ChartView
                    columns={columns}
                    data={parseResult.data}
                    selectedXColumn={selectedXColumn}
                    selectedYColumns={selectedYColumns}
                    chartType={chartType}
                    onChartTypeChange={setChartType}
                    darkMode={darkMode}
                  />
                  <div className="chart-section-sidebar">
                    <ColumnSelector
                      columns={columns}
                      selectedXColumn={selectedXColumn}
                      selectedYColumns={selectedYColumns}
                      onXChange={setSelectedXColumn}
                      onYChange={setSelectedYColumns}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {isUploading && !parseResult && (
            <div className="skeleton-group">
              <div className="skeleton-block skeleton-table" />
              <div className="skeleton-row">
                <div className="skeleton-block skeleton-panel" />
                <div className="skeleton-block skeleton-panel" />
              </div>
              <div className="skeleton-block skeleton-chart" />
            </div>
          )}

          {!parseResult && !isUploading && !error && (
            <div className="empty-state">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="20" width="60" height="50" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <line x1="10" y1="35" x2="70" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
                <line x1="30" y1="20" x2="30" y2="70" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
                <line x1="50" y1="20" x2="50" y2="70" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
                <polyline points="18,60 28,50 38,55 48,40 58,45 64,38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
                <circle cx="28" cy="50" r="2" fill="currentColor" opacity="0.5" />
                <circle cx="38" cy="55" r="2" fill="currentColor" opacity="0.5" />
                <circle cx="48" cy="40" r="2" fill="currentColor" opacity="0.5" />
                <circle cx="58" cy="45" r="2" fill="currentColor" opacity="0.5" />
              </svg>
              <p className="empty-state-text">{t.emptyStateHint}</p>
            </div>
          )}
        </main>

        <Toast
          message={toast}
          visible={!!toast}
          onDismiss={() => setToast(null)}
        />
      </div>
    </LanguageProvider>
  )
}

export default App
