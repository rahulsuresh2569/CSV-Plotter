import { useRef, useState } from 'react'
import styles from './FileUpload.module.css'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * Drag-and-drop + click-to-browse file upload area.
 *
 * Props:
 *   onFileSelect(file: File) — called when a valid file is chosen
 *   isUploading: boolean      — shows a loading indicator
 *   currentFileName: string|null — name of the currently loaded file
 */
export default function FileUpload({ onFileSelect, isUploading, currentFileName }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [clientError, setClientError] = useState(null)
  const inputRef = useRef(null)

  function validateAndSelect(file) {
    setClientError(null)

    if (!file) return

    // Client-side size check (server enforces too, but this gives instant feedback)
    if (file.size > MAX_FILE_SIZE) {
      setClientError('This file exceeds the 10 MB limit. Please upload a smaller file.')
      return
    }

    // Client-side extension check
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setClientError('Please upload a file in CSV format (.csv).')
      return
    }

    onFileSelect(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    validateAndSelect(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleClick() {
    if (!isUploading) {
      inputRef.current?.click()
    }
  }

  function handleInputChange(e) {
    const file = e.target.files[0]
    validateAndSelect(file)
    // Reset the input so the same file can be re-selected
    e.target.value = ''
  }

  const zoneClasses = [
    styles.dropZone,
    isDragOver ? styles.dragOver : '',
    isUploading ? styles.uploading : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={styles.wrapper}>
      <div
        className={zoneClasses}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          className={styles.hiddenInput}
          tabIndex={-1}
        />

        {isUploading ? (
          <div className={styles.content}>
            <div className={styles.spinner} />
            <p className={styles.label}>Parsing file...</p>
          </div>
        ) : (
          <div className={styles.content}>
            <div className={styles.icon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className={styles.label}>
              {currentFileName
                ? <>Drop a new file or click to replace <strong>{currentFileName}</strong></>
                : 'Drag & drop a CSV file here, or click to browse'}
            </p>
            <p className={styles.hint}>.csv files up to 10 MB</p>
          </div>
        )}
      </div>

      {clientError && (
        <p className={styles.error}>{clientError}</p>
      )}
    </div>
  )
}
