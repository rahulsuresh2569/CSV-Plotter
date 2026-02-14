//App.jsx: root component -orchestrates file upload, parsing, column selection, and chart rendering
import { useState } from 'react'
import AppHeader from './components/AppHeader'
import FileUpload from './components/FileUpload'
import SampleFilesRow from './components/SampleFilesRow'
import StatusBar from './components/StatusBar'
import ParsingSettings from './components/ParsingSettings'
import DataPreview from './components/DataPreview'
import ColumnSelector from './components/ColumnSelector'
import ChartView from './components/ChartView'
import Toast from './components/Toast'
import EmptyState from './components/EmptyState'
import SkeletonLoader from './components/SkeletonLoader'
import { uploadCSV } from './services/api'
import { LanguageProvider } from './LanguageContext'
import translations from './i18n'
import { getDefaultSelections, mergeColumnsWithOverrides } from './utils/selection'
import { promoteNoNumericWarning } from './utils/uploadHelpers'
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
  //Upload and backend response
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [parseResult, setParseResult] = useState(null)
  const [lastMetadata, setLastMetadata] = useState(null)
  const [error, setError] = useState(null)

  //Parsing settings
  const [parsingSettings, setParsingSettings] = useState(DEFAULT_SETTINGS)

  //Column selection and overrides
  const [selectedXColumn, setSelectedXColumn] = useState(null)
  const [selectedYColumns, setSelectedYColumns] = useState([])
  const [columnNames, setColumnNames] = useState({})
  const [overriddenColumns, setOverriddenColumns] = useState(() => new Set())

  //UI preferences (persisted in localStorage)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('csv-plotter-theme') === 'dark'
    document.documentElement.setAttribute('data-theme', saved ? 'dark' : 'light')
    return saved
  })

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('csv-plotter-lang') || 'en'
  })

  //Feedback
  const [chartType, setChartType] = useState('line')
  const [toast, setToast] = useState(null)

  const t = translations[language] || translations.en

  function toggleDarkMode() {
    setDarkMode((prev) => {
      const next = !prev
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
      localStorage.setItem('csv-plotter-theme', next ? 'dark' : 'light')
      return next
    })
  }

  function toggleLanguage() {
    setLanguage((prev) => {
      const next = prev === 'en' ? 'de' : 'en'
      localStorage.setItem('csv-plotter-lang', next)
      return next
    })
  }

  //merge custom names and type overrides into columns on every render
  const columns = mergeColumnsWithOverrides(
    parseResult?.columns || [],
    columnNames,
    overriddenColumns
  )

  //Upload flow

  function applySuccessState(result) {
    setParseResult(result)
    setLastMetadata(result.metadata)

    const rowLabel = `${result.rowCount?.toLocaleString()} ${t.rows}`
    setToast(`${t.parseSuccess} \u2014 ${rowLabel}`)

    const defaults = getDefaultSelections(result.columns)
    setSelectedXColumn(defaults.xColumn)
    setSelectedYColumns(defaults.yColumns)
    setColumnNames({})
    setOverriddenColumns(new Set())
  }

  function applyErrorState(err) {
    const data = err.response?.data
    const errorCode = data?.code || null
    const fallback = data?.error || err.message || 'An unexpected error occurred.'

    if (data?.metadata) {
      setLastMetadata(data.metadata)
    }

    setError({ code: errorCode, fallback })
    setParseResult(null)
    setSelectedXColumn(null)
    setSelectedYColumns([])
    setColumnNames({})
    setOverriddenColumns(new Set())
  }

  async function doUpload(fileToUpload, settings) {
    setIsUploading(true)
    setError(null)

    try {
      const result = await uploadCSV(fileToUpload, settings)

      const promotedError = promoteNoNumericWarning(result)
      if (promotedError) {
        setError(promotedError)
      }

      applySuccessState(result)
    } catch (err) {
      applyErrorState(err)
    } finally {
      setIsUploading(false)
    }
  }

  //Event handlers

  function handleFileSelect(selectedFile) {
    setFile(selectedFile)
    setParsingSettings(DEFAULT_SETTINGS)
    doUpload(selectedFile, DEFAULT_SETTINGS)
  }

  async function handleSampleSelect(sample) {
    const res = await fetch(sample.path)
    const text = await res.text()
    const blob = new Blob([text], { type: 'text/csv' })
    const sampleFile = new File([blob], sample.name, { type: 'text/csv' })
    handleFileSelect(sampleFile)
  }

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

  //Derived values

  const showParsingSettings = !!lastMetadata && !!file
  const headersAutoGenerated = parseResult && lastMetadata && !lastMetadata.hasHeader
  const hasPlottableColumns = columns.some((col) => col.type === 'numeric')

  //Render

  return (
    <LanguageProvider language={language}>
      <div className="app">
        <AppHeader
          darkMode={darkMode}
          language={language}
          onToggleDarkMode={toggleDarkMode}
          onToggleLanguage={toggleLanguage}
        />

        <main className="app-main">
          <FileUpload
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
            currentFileName={file?.name || null}
          />

          <SampleFilesRow
            samples={SAMPLE_FILES}
            onSelect={handleSampleSelect}
            disabled={isUploading}
          />

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

          {isUploading && !parseResult && <SkeletonLoader />}

          {!parseResult && !isUploading && !error && (
            <EmptyState hint={t.emptyStateHint} />
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
