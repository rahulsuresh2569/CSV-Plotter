import styles from './ColumnSelector.module.css'

/**
 * Column selection controls for the chart.
 *
 * X-axis: single-select dropdown — any column is eligible.
 * Y-axis: checkboxes — only numeric columns are enabled;
 *         non-numeric columns are disabled with a tooltip.
 *         The column selected as X is excluded from Y options.
 *
 * Props:
 *   columns: [{ name, type, index }]
 *   selectedXColumn: number (column index)
 *   selectedYColumns: number[] (column indices)
 *   onXChange(index: number)
 *   onYChange(indices: number[])
 */
export default function ColumnSelector({
  columns,
  selectedXColumn,
  selectedYColumns,
  onXChange,
  onYChange,
}) {
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        <h3 className={styles.heading}>X-Axis</h3>
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
        <h3 className={styles.heading}>Y-Axis</h3>
        <div className={styles.checkboxList}>
          {yColumns.map((col) => {
            const isNumeric = col.type === 'numeric'
            const isChecked = selectedYColumns.includes(col.index)

            return (
              <label
                key={col.index}
                className={`${styles.checkboxLabel} ${!isNumeric ? styles.disabled : ''}`}
                title={!isNumeric ? 'Non-numeric columns cannot be used for Y-axis' : ''}
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
                  <span className={styles.typeHint}>string</span>
                )}
              </label>
            )
          })}
        </div>
        {selectedYColumns.length === 0 && (
          <p className={styles.hint}>Select at least one numeric column to plot</p>
        )}
      </div>
    </div>
  )
}
