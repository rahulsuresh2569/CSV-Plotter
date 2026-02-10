import { useTranslation } from '../LanguageContext'
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
  const t = useTranslation()

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
                {t.errorHintSettings}
              </p>
            ) : (
              <p className={styles.errorHint}>
                {t.errorHintGeneric}
              </p>
            )}
          </div>
        </div>
      )}

      {metadata && (
        <div className={styles.infoBox}>
          <div className={styles.infoGrid}>
            <span className={styles.infoLabel}>{t.infoFile}</span>
            <span className={styles.infoValue}>{metadata.originalFileName}</span>

            <span className={styles.infoLabel}>{t.infoRows}</span>
            <span className={styles.infoValue}>{rowCount?.toLocaleString()}</span>

            <span className={styles.infoLabel}>{t.infoColumns}</span>
            <span className={styles.infoValue}>{columnCount}</span>

            <span className={styles.infoLabel}>{t.infoDelimiter}</span>
            <span className={styles.infoValue}>{formatDelimiter(metadata.delimiter, t)}</span>

            <span className={styles.infoLabel}>{t.infoDecimal}</span>
            <span className={styles.infoValue}>
              {metadata.decimalSeparator === ',' ? t.decimalComma : t.decimalDot}
            </span>

            <span className={styles.infoLabel}>{t.infoHeaderRow}</span>
            <span className={styles.infoValue}>{metadata.hasHeader ? t.yes : t.no}</span>

            {metadata.commentLinesSkipped > 0 && (
              <>
                <span className={styles.infoLabel}>{t.infoCommentLines}</span>
                <span className={styles.infoValue}>{metadata.commentLinesSkipped} {t.skipped}</span>
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

function formatDelimiter(d, t) {
  if (d === ';') return t.delimiterSemicolon
  if (d === ',') return t.delimiterComma
  if (d === '\t') return t.delimiterTab
  return d
}
