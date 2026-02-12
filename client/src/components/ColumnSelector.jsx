import { useTranslation } from '../LanguageContext'
import styles from './ColumnSelector.module.css'

export default function ColumnSelector({
  columns,
  selectedXColumn,
  selectedYColumns,
  onXChange,
  onYChange,
}) {
  const t = useTranslation()

  if (!columns || columns.length === 0) return null

  function handleXChange(e) {
    const newX = Number(e.target.value)
    onXChange(newX)

    // If the new X was selected as a Y, remove it from Y
    if (selectedYColumns.includes(newX)) {
      onYChange(selectedYColumns.filter((idx) => idx !== newX))
    }
  }

  function handleYToggle(colIndex) {
    if (selectedYColumns.includes(colIndex)) {
      onYChange(selectedYColumns.filter((idx) => idx !== colIndex))
    } else {
      onYChange([...selectedYColumns, colIndex])
    }
  }

  // Columns available for Y: exclude the one selected as X
  const yColumns = columns.filter((col) => col.index !== selectedXColumn)
  const numericYColumns = yColumns.filter((col) => col.type === 'numeric')

  const allNumericSelected =
    numericYColumns.length > 0 &&
    numericYColumns.every((col) => selectedYColumns.includes(col.index))

  function handleSelectAll() {
    if (allNumericSelected) {
      onYChange([])
    } else {
      onYChange(numericYColumns.map((col) => col.index))
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        <h3 className={styles.heading}>{t.xAxis}</h3>
        <select
          className={styles.select}
          value={selectedXColumn ?? ''}
          onChange={handleXChange}
        >
          {columns.map((col) => (
            <option key={col.index} value={col.index}>
              {col.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.panel}>
        <div className={styles.headingRow}>
          <h3 className={styles.heading}>{t.yAxis}</h3>
          {numericYColumns.length > 0 && (
            <label className={styles.selectAllLabel}>
              <input
                type="checkbox"
                checked={allNumericSelected}
                onChange={handleSelectAll}
                className={styles.checkbox}
              />
              <span className={styles.selectAllText}>{t.selectAll}</span>
            </label>
          )}
        </div>
        <div className={styles.checkboxList}>
          {yColumns.map((col) => {
            const isNumeric = col.type === 'numeric'
            const isChecked = selectedYColumns.includes(col.index)

            return (
              <label
                key={col.index}
                className={`${styles.checkboxLabel} ${!isNumeric ? styles.disabled : ''}`}
                title={!isNumeric ? t.nonNumericHint : ''}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={!isNumeric}
                  onChange={() => handleYToggle(col.index)}
                  className={styles.checkbox}
                />
                <span className={styles.labelText}>{col.name}</span>
                {!isNumeric && (
                  <span className={styles.typeHint}>{col.type}</span>
                )}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
