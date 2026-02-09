import styles from './StatusBar.module.css'

/**
 * Displays file metadata, parsing errors, and warnings.
 *
 * Props:
 *   error: string|null          — a top-level error message (upload/parse failure)
 *   warnings: string[]          — parsing warnings from the backend
 *   metadata: object|null       — { delimiter, decimalSeparator, hasHeader, commentLinesSkipped, originalFileName }
 *   rowCount: number|null       — total data rows
 *   columnCount: number|null    — total columns
 *   showSettingsHint: boolean   — when true, error hint suggests adjusting settings
 */
export default function StatusBar({ error, warnings, metadata, rowCount, columnCount, showSettingsHint }) {
  if (!error && !metadata) return null

  return (
    <div className={styles.wrapper}>
      {error && (
        <div className={styles.errorBox}>
          <span className={styles.errorIcon}>!</span>
          <div>
            <span>{error}</span>
            {showSettingsHint ? (
              <p className={styles.errorHint}>
                Try adjusting the parsing settings below, or upload a different file.
              </p>
            ) : (
              <p className={styles.errorHint}>
                Please check the file format and try uploading again.
              </p>
            )}
          </div>
        </div>
      )}

      {metadata && (
        <div className={styles.infoBox}>
          <div className={styles.infoGrid}>
            <span className={styles.infoLabel}>File</span>
            <span className={styles.infoValue}>{metadata.originalFileName}</span>

            <span className={styles.infoLabel}>Rows</span>
            <span className={styles.infoValue}>{rowCount?.toLocaleString()}</span>

            <span className={styles.infoLabel}>Columns</span>
            <span className={styles.infoValue}>{columnCount}</span>

            <span className={styles.infoLabel}>Delimiter</span>
            <span className={styles.infoValue}>{formatDelimiter(metadata.delimiter)}</span>

            <span className={styles.infoLabel}>Decimal</span>
            <span className={styles.infoValue}>
              {metadata.decimalSeparator === ',' ? 'Comma (,)' : 'Dot (.)'}
            </span>

            <span className={styles.infoLabel}>Header row</span>
            <span className={styles.infoValue}>{metadata.hasHeader ? 'Yes' : 'No'}</span>

            {metadata.commentLinesSkipped > 0 && (
              <>
                <span className={styles.infoLabel}>Comment lines</span>
                <span className={styles.infoValue}>{metadata.commentLinesSkipped} skipped</span>
              </>
            )}
          </div>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className={styles.warningBox}>
          {warnings.map((w, i) => (
            <p key={i} className={styles.warningLine}>
              <span className={styles.warningIcon}>!</span>
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDelimiter(d) {
  if (d === ';') return 'Semicolon (;)'
  if (d === ',') return 'Comma (,)'
  if (d === '\t') return 'Tab'
  return d
}
