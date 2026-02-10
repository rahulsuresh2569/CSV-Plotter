import { useState, useCallback, useMemo } from 'react'
import FileUpload from './components/FileUpload'
import StatusBar from './components/StatusBar'
import ParsingSettings from './components/ParsingSettings'
import DataPreview from './components/DataPreview'
import ColumnSelector from './components/ColumnSelector'
import ChartView from './components/ChartView'
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

  // Error from upload or parse
  const [error, setError] = useState(null)

  // Column selections
  const [selectedXColumn, setSelectedXColumn] = useState(null)
  const [selectedYColumns, setSelectedYColumns] = useState([])

  // Custom column name overrides: { [columnIndex]: "custom name" }
  const [columnNames, setColumnNames] = useState({})

  // Chart type: 'line' | 'scatter' | 'bar'
  const [chartType, setChartType] = useState('line')

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
    return parseResult.columns.map((col) => ({
      ...col,
      name: columnNames[col.index] ?? col.name,
    }))
  }, [parseResult?.columns, columnNames])

  /**
   * Upload a file to the backend with the given settings.
   * Called on initial file select and when Apply is clicked in ParsingSettings.
   */
  const doUpload = useCallback(async (fileToUpload, settings) => {
    setIsUploading(true)
    setError(null)

    try {
      const result = await uploadCSV(fileToUpload, settings)
      setParseResult(result)
      setLastMetadata(result.metadata)

      // Auto-select first column as X, reset Y
      if (result.columns.length > 0) {
        setSelectedXColumn(result.columns[0].index)
      }
      setSelectedYColumns([])
      setColumnNames({})
    } catch (err) {
      // axios wraps the response in err.response
      const data = err.response?.data
      const message =
        data?.error ||
        err.message ||
        'An unexpected error occurred. Please try again.'

      // Persist metadata from error response if available
      if (data?.metadata) {
        setLastMetadata(data.metadata)
      }

      setError(message)
      setParseResult(null)
      setSelectedXColumn(null)
      setSelectedYColumns([])
      setColumnNames({})
    } finally {
      setIsUploading(false)
    }
  }, [])

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

  // Show ParsingSettings when we have metadata (from success or from error)
  const showParsingSettings = !!lastMetadata && !!file

  // Whether headers were auto-generated (no header row detected)
  const headersAutoGenerated = parseResult && lastMetadata && !lastMetadata.hasHeader

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
          </div>

          <StatusBar
            error={error}
            warnings={parseResult?.warnings || []}
            metadata={parseResult?.metadata || null}
            rowCount={parseResult?.rowCount || null}
            columnCount={parseResult?.columns?.length || null}
            showSettingsHint={!!error && showParsingSettings}
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
              <ColumnSelector
                columns={columns}
                selectedXColumn={selectedXColumn}
                selectedYColumns={selectedYColumns}
                onXChange={setSelectedXColumn}
                onYChange={setSelectedYColumns}
              />
              <ChartView
                columns={columns}
                data={parseResult.data}
                selectedXColumn={selectedXColumn}
                selectedYColumns={selectedYColumns}
                chartType={chartType}
                onChartTypeChange={setChartType}
                darkMode={darkMode}
              />
            </>
          )}
        </main>
      </div>
    </LanguageProvider>
  )
}

export default App
