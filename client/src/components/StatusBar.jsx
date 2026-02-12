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
export default function StatusBar({ error, warnings, metadata, rowCount, columnCount, showSettingsHint, columns, overriddenColumns, onOverride, onUndoOverride }) {
  const t = useTranslation()

  // Columns that are string-typed but have >= 30% numeric values (overridable)
  const overridableColumns = (columns || []).filter((col) => {
    if (col.type === 'numeric' && !col.originalType) return false // already numeric natively
    const origType = col.originalType || col.type
    if (origType !== 'string') return false
    if (!col.nonNullCount || col.nonNullCount === 0) return false
    const ratio = col.numericCount / col.nonNullCount
    return ratio >= 0.3 && ratio < 0.9
  })

  // Purely string columns (< 30% numeric, not overridable) — for info message
  const stringOnlyColumns = (columns || []).filter((col) => {
    if (col.type === 'numeric' || col.type === 'date') return false
    if (col.originalType) return false // overridden, skip
    if (!col.nonNullCount || col.nonNullCount === 0) return col.type === 'string'
    const ratio = col.numericCount / col.nonNullCount
    return ratio < 0.3
  })

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

      {overridableColumns.length > 0 && overridableColumns.map((col) => {
        const isOverridden = overriddenColumns?.has(col.index)
        const badCount = col.nonNullCount - col.numericCount

        if (isOverridden) {
          const msg = t.overrideActive
            .replace('{name}', col.name)
            .replace('{bad}', badCount)
          return (
            <div key={col.index} className={styles.overrideActive}>
              <p className={styles.warningLine}>
                <span className={styles.warningIcon}>!</span>
                <span>{msg}</span>
                <button className={styles.undoBtn} onClick={() => onUndoOverride(col.index)}>
                  {t.undoOverride}
                </button>
              </p>
            </div>
          )
        }

        const msg = t.overrideOffer
          .replace('{name}', col.name)
          .replace('{numeric}', col.numericCount)
          .replace('{total}', col.nonNullCount)
        return (
          <div key={col.index} className={styles.warningBox}>
            <p className={styles.warningLine}>
              <span className={styles.warningIcon}>!</span>
              <span>{msg}</span>
              <button className={styles.overrideBtn} onClick={() => onOverride(col.index)}>
                {t.plotAnyway}
              </button>
            </p>
          </div>
        )
      })}

      {stringOnlyColumns.length > 0 && (
        <div className={styles.infoBox}>
          <p className={styles.infoLine}>
            {t.stringColumnsInfo.replace('{names}', stringOnlyColumns.map((c) => c.name).join(', '))}
          </p>
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
