import { useState, useCallback } from 'react'
import FileUpload from './components/FileUpload'
import StatusBar from './components/StatusBar'
import ParsingSettings from './components/ParsingSettings'
import DataPreview from './components/DataPreview'
import ColumnSelector from './components/ColumnSelector'
import ChartView from './components/ChartView'
import { uploadCSV } from './services/api'
import './App.css'

const DEFAULT_SETTINGS = {
  delimiter: 'auto',
  decimal: 'auto',
  hasHeader: 'auto',
}

function App() {
  // The File object — kept in state so we can re-send it when settings change
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Backend response
  const [parseResult, setParseResult] = useState(null)

  // Parsing overrides (auto by default)
  const [parsingSettings, setParsingSettings] = useState(DEFAULT_SETTINGS)

  // Error from upload or parse
  const [error, setError] = useState(null)

  // Column selections (Step 4 will use these)
  const [selectedXColumn, setSelectedXColumn] = useState(null)
  const [selectedYColumns, setSelectedYColumns] = useState([])

  /**
   * Upload a file to the backend with the given settings.
   * Called on initial file select and on settings change.
   */
  const doUpload = useCallback(async (fileToUpload, settings) => {
    setIsUploading(true)
    setError(null)

    try {
      const result = await uploadCSV(fileToUpload, settings)
      setParseResult(result)

      // Auto-select first column as X, reset Y
      if (result.columns.length > 0) {
        setSelectedXColumn(result.columns[0].index)
      }
      setSelectedYColumns([])
    } catch (err) {
      // axios wraps the response in err.response
      const message =
        err.response?.data?.error ||
        err.message ||
        'An unexpected error occurred. Please try again.'
      setError(message)
      setParseResult(null)
      setSelectedXColumn(null)
      setSelectedYColumns([])
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
   * Called when a parsing setting dropdown changes.
   * Re-uploads the same file with the new overrides.
   */
  function handleSettingsChange(newSettings) {
    setParsingSettings(newSettings)
    if (file) {
      doUpload(file, newSettings)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>CSV Plotter</h1>
      </header>

      <main className="app-main">
        <FileUpload
          onFileSelect={handleFileSelect}
          isUploading={isUploading}
          currentFileName={file?.name || null}
        />

        <StatusBar
          error={error}
          warnings={parseResult?.warnings || []}
          metadata={parseResult?.metadata || null}
          rowCount={parseResult?.rowCount || null}
          columnCount={parseResult?.columns?.length || null}
        />

        {parseResult && (
          <ParsingSettings
            settings={parsingSettings}
            metadata={parseResult.metadata}
            onSettingsChange={handleSettingsChange}
            disabled={isUploading}
          />
        )}

        {parseResult && (
          <>
            <DataPreview
              columns={parseResult.columns}
              rows={parseResult.preview}
            />
            <ColumnSelector
              columns={parseResult.columns}
              selectedXColumn={selectedXColumn}
              selectedYColumns={selectedYColumns}
              onXChange={setSelectedXColumn}
              onYChange={setSelectedYColumns}
            />
            <ChartView
              columns={parseResult.columns}
              data={parseResult.data}
              selectedXColumn={selectedXColumn}
              selectedYColumns={selectedYColumns}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App
