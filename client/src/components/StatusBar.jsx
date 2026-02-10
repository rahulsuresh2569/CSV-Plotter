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
          <span className={styles.fileName}>{metadata.originalFileName}</span>
          <div className={styles.statsRow}>
            <span className={styles.stat}>
              <span className={styles.statLabel}>{t.infoRows}</span>
              <span className={styles.statValue}>{rowCount?.toLocaleString()}</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>{t.infoColumns}</span>
              <span className={styles.statValue}>{columnCount}</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>{t.infoDelimiter}</span>
              <span className={styles.statValue}>{formatDelimiter(metadata.delimiter, t)}</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>{t.infoDecimal}</span>
              <span className={styles.statValue}>
                {metadata.decimalSeparator === ',' ? t.decimalComma : t.decimalDot}
              </span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>{t.infoHeaderRow}</span>
              <span className={styles.statValue}>{metadata.hasHeader ? t.yes : t.no}</span>
            </span>
            {metadata.commentLinesSkipped > 0 && (
              <span className={styles.stat}>
                <span className={styles.statLabel}>{t.infoCommentLines}</span>
                <span className={styles.statValue}>{metadata.commentLinesSkipped} {t.skipped}</span>
              </span>
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
