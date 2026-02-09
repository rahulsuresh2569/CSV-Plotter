export default function ChartView({ columns, data, selectedXColumn, selectedYColumns }) {
  if (!data || selectedYColumns.length === 0) return null

  return (
    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
      Chart area: will render with {data.length} data points (Chart.js coming in Step 5)
    </div>
  )
}
