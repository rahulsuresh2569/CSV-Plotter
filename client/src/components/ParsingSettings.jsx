import styles from './ParsingSettings.module.css'

/**
 * Parsing settings panel with three dropdowns.
 * Each defaults to "Auto (detected: X)" and allows manual override.
 * Changing a setting triggers onSettingsChange, which re-uploads the file
 * with the new overrides.
 *
 * Props:
 *   settings: { delimiter, decimal, hasHeader }  — current override values ('auto' or explicit)
 *   metadata: { delimiter, decimalSeparator, hasHeader } — what the backend detected
 *   onSettingsChange(newSettings) — callback when a dropdown changes
 *   disabled: boolean — true while re-parsing
 */
export default function ParsingSettings({ settings, metadata, onSettingsChange, disabled }) {
  if (!metadata) return null

  function handleChange(field, value) {
    onSettingsChange({ ...settings, [field]: value })
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>Parsing Settings</h3>
      <div className={styles.controls}>
        <label className={styles.field}>
          <span className={styles.label}>Delimiter</span>
          <select
            className={styles.select}
            value={settings.delimiter}
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
            value={settings.decimal}
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
            value={settings.hasHeader}
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
    </div>
  )
}

function formatDelimiter(d) {
  if (d === ';') return 'Semicolon'
  if (d === ',') return 'Comma'
  if (d === '\t') return 'Tab'
  return d
}
