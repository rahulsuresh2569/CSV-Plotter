import { useState, useEffect } from 'react'
import { useTranslation } from '../LanguageContext'
import styles from './ParsingSettings.module.css'

/**
 * Parsing settings panel with three dropdowns and Apply/Reset buttons.
 * Dropdowns update local pending state; changes are only sent to the parent
 * when the user clicks Apply.
 *
 * Props:
 *   settings: { delimiter, decimal, hasHeader }  — current committed values
 *   metadata: { delimiter, decimalSeparator, hasHeader } — what the backend detected
 *   onApply(newSettings) — callback when Apply is clicked
 *   disabled: boolean — true while re-parsing
 */
export default function ParsingSettings({ settings, metadata, onApply, disabled }) {
  const t = useTranslation()
  const [pending, setPending] = useState(settings)
  const [isOpen, setIsOpen] = useState(true)

  // Sync pending state when parent settings change (e.g. after a new file upload resets to auto)
  useEffect(() => {
    setPending(settings)
  }, [settings])

  if (!metadata) return null

  const hasChanges =
    pending.delimiter !== settings.delimiter ||
    pending.decimal !== settings.decimal ||
    pending.hasHeader !== settings.hasHeader

  function handleChange(field, value) {
    setPending((prev) => ({ ...prev, [field]: value }))
  }

  function handleApply() {
    onApply(pending)
  }

  function handleReset() {
    const autoSettings = { delimiter: 'auto', decimal: 'auto', hasHeader: 'auto' }
    setPending(autoSettings)
    onApply(autoSettings)
  }

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.heading}
        onClick={function () { setIsOpen(!isOpen) }}
        type="button"
      >
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>&#9656;</span>
        {t.parsingSettings}
      </button>
      {isOpen && (
        <>
          <div className={styles.controls}>
            <label className={styles.field}>
              <span className={styles.label}>{t.labelDelimiter}</span>
              <select
                className={styles.select}
                value={pending.delimiter}
                onChange={(e) => handleChange('delimiter', e.target.value)}
                disabled={disabled}
              >
                <option value="auto">
                  {t.autoDetected} {formatDelimiter(metadata.delimiter, t)})
                </option>
                <option value=",">{t.optionComma}</option>
                <option value=";">{t.optionSemicolon}</option>
                <option value={'\t'}>{t.optionTab}</option>
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t.labelDecimalSeparator}</span>
              <select
                className={styles.select}
                value={pending.decimal}
                onChange={(e) => handleChange('decimal', e.target.value)}
                disabled={disabled}
              >
                <option value="auto">
                  {t.autoDetected} {metadata.decimalSeparator === ',' ? t.detectedComma : t.detectedDot})
                </option>
                <option value=".">{t.optionDot}</option>
                <option value=",">{t.optionComma}</option>
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t.labelFirstRowHeader}</span>
              <select
                className={styles.select}
                value={pending.hasHeader}
                onChange={(e) => handleChange('hasHeader', e.target.value)}
                disabled={disabled}
              >
                <option value="auto">
                  {t.autoDetected} {metadata.hasHeader ? t.yes : t.no})
                </option>
                <option value="true">{t.yes}</option>
                <option value="false">{t.no}</option>
              </select>
            </label>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.applyButton}
              onClick={handleApply}
              disabled={disabled || !hasChanges}
            >
              {t.apply}
            </button>
            <button
              className={styles.resetButton}
              onClick={handleReset}
              disabled={disabled}
            >
              {t.resetToAuto}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function formatDelimiter(d, t) {
  if (d === ';') return t.detectedSemicolon
  if (d === ',') return t.detectedComma
  if (d === '\t') return t.detectedTab
  return d
}
