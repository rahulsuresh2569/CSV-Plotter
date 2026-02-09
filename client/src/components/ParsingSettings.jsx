import { useState, useEffect } from 'react'
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
  if (!metadata) return null

  const [pending, setPending] = useState(settings)

  // Sync pending state when parent settings change (e.g. after a new file upload resets to auto)
  useEffect(() => {
    setPending(settings)
  }, [settings])

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
      <h3 className={styles.heading}>Parsing Settings</h3>
      <div className={styles.controls}>
        <label className={styles.field}>
          <span className={styles.label}>Delimiter</span>
          <select
            className={styles.select}
            value={pending.delimiter}
            onChange={(e) => handleChange('delimiter', e.target.value)}
            disabled={disabled}
          >
            <option value="auto">
              Auto (detected: {formatDelimiter(metadata.delimiter)})
            </option>
            <option value=",">Comma (,)</option>
            <option value=";">Semicolon (;)</option>
            <option value={'\t'}>Tab</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Decimal separator</span>
          <select
            className={styles.select}
            value={pending.decimal}
            onChange={(e) => handleChange('decimal', e.target.value)}
            disabled={disabled}
          >
            <option value="auto">
              Auto (detected: {metadata.decimalSeparator === ',' ? 'Comma' : 'Dot'})
            </option>
            <option value=".">Dot (.)</option>
            <option value=",">Comma (,)</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>First row is header</span>
          <select
            className={styles.select}
            value={pending.hasHeader}
            onChange={(e) => handleChange('hasHeader', e.target.value)}
            disabled={disabled}
          >
            <option value="auto">
              Auto (detected: {metadata.hasHeader ? 'Yes' : 'No'})
            </option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.applyButton}
          onClick={handleApply}
          disabled={disabled || !hasChanges}
        >
          Apply
        </button>
        <button
          className={styles.resetButton}
          onClick={handleReset}
          disabled={disabled}
        >
          Reset to Auto
        </button>
      </div>
    </div>
  )
}

function formatDelimiter(d) {
  if (d === ';') return 'Semicolon'
  if (d === ',') return 'Comma'
  if (d === '\t') return 'Tab'
  return d
}
