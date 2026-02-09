export default function DataPreview({ columns, rows }) {
  if (!columns || !rows || rows.length === 0) return null

  return (
    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
      Data preview: {rows.length} rows, {columns.length} columns (full table coming in Step 4)
    </div>
  )
}
