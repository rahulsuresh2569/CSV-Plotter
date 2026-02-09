export default function ColumnSelector({ columns, selectedXColumn, selectedYColumns, onXChange, onYChange }) {
  if (!columns || columns.length === 0) return null

  return (
    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
      Column selector: {columns.length} columns available (full selector coming in Step 4)
    </div>
  )
}
