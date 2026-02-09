import styles from './DataPreview.module.css'

/**
 * Scrollable preview table showing the first N rows of parsed data.
 *
 * Props:
 *   columns: [{ name, type, index }]
 *   rows: [[value, ...], ...]  — preview rows from the backend (first 20)
 */
export default function DataPreview({ columns, rows }) {
  if (!columns || !rows || rows.length === 0) return null

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>
        Data Preview
        <span className={styles.rowCount}>({rows.length} rows shown)</span>
      </h3>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.index} className={styles.th}>
                  <span className={styles.colName}>{col.name}</span>
                  <span className={styles.colType}>{col.type}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 0 ? styles.rowEven : ''}>
                {columns.map((col) => (
                  <td key={col.index} className={styles.td}>
                    {formatCell(row[col.index], col.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatCell(value, type) {
  if (value === null || value === undefined) {
    return <span className={styles.nullValue}>—</span>
  }
  if (type === 'numeric' && typeof value === 'number') {
    // Show up to 6 decimal places, no trailing zeros
    return Number.isInteger(value) ? value.toString() : parseFloat(value.toFixed(6)).toString()
  }
  return String(value)
}
