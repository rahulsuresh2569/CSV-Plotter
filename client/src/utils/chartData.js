// chartData.js: Transforms parsed CSV data into Chart.js-ready format

const SERIES_COLORS = [
  { border: '#3b82f6', background: 'rgba(59, 130, 246, 0.5)' },
  { border: '#ef4444', background: 'rgba(239, 68, 68, 0.5)' },
  { border: '#10b981', background: 'rgba(16, 185, 129, 0.5)' },
  { border: '#f59e0b', background: 'rgba(245, 158, 11, 0.5)' },
  { border: '#8b5cf6', background: 'rgba(139, 92, 246, 0.5)' },
  { border: '#ec4899', background: 'rgba(236, 72, 153, 0.5)' },
  { border: '#06b6d4', background: 'rgba(6, 182, 212, 0.5)' },
  { border: '#84cc16', background: 'rgba(132, 204, 22, 0.5)' },
]

// Returns null for non-finite values so Chart.js shows gaps
function safeY(val) {
  if (typeof val === 'number' && isFinite(val)) return val
  return null
}

// Slice rows using 1-indexed inclusive range (matches the UI inputs)
export function sliceRows(data, from, to) {
  return data.slice(from - 1, to)
}

// Pick evenly-spaced rows to stay under maxPoints (uniform decimation)
export function downsampleRows(rows, maxPoints) {
  if (rows.length <= maxPoints) return rows

  const step = (rows.length - 1) / (maxPoints - 1)
  const result = []
  for (let i = 0; i < maxPoints; i++) {
    result.push(rows[Math.round(i * step)])
  }
  return result
}

// Build the labels array for category-axis charts, or undefined for numeric/date axes
export function buildLabels(rows, xColumnIndex, xType, chartType) {
  const isBar = chartType === 'bar'
  const needsLabels = isBar || (xType !== 'numeric' && xType !== 'date')

  if (!needsLabels) return undefined

  const labels = []
  for (let i = 0; i < rows.length; i++) {
    labels.push(rows[i][xColumnIndex])
  }
  return labels
}

// Build Chart.js dataset objects for each Y column
export function buildDatasets(rows, xColumnIndex, yColumns, chartType, xType) {
  const isBar = chartType === 'bar'
  const isScatter = chartType === 'scatter'
  const isLarge = rows.length > 1000

  const datasets = []

  for (let i = 0; i < yColumns.length; i++) {
    const yCol = yColumns[i]
    const color = SERIES_COLORS[i % SERIES_COLORS.length]

    // Build data points — bar charts use flat values, others use {x, y} objects
    let dataPoints
    if (isBar) {
      dataPoints = []
      for (let r = 0; r < rows.length; r++) {
        dataPoints.push(safeY(rows[r][yCol.index]))
      }
    } else {
      dataPoints = []
      for (let r = 0; r < rows.length; r++) {
        const xVal = rows[r][xColumnIndex]
        dataPoints.push({
          x: xType === 'date' ? new Date(xVal) : xVal,
          y: safeY(rows[r][yCol.index]),
        })
      }
    }

    // Styling — thinner lines and smaller points for large datasets
    let borderWidth = 2
    let pointRadius = 2
    if (isBar) {
      borderWidth = 1
    } else if (isLarge) {
      borderWidth = 1.5
    }

    if (isScatter) {
      pointRadius = isLarge ? 1.5 : 3
    } else if (isLarge) {
      pointRadius = 0
    }

    const bgColor = isBar
      ? color.background
      : color.background.replace('0.5', '0.1')

    datasets.push({
      label: yCol.name,
      data: dataPoints,
      borderColor: color.border,
      backgroundColor: bgColor,
      borderWidth,
      pointRadius,
      pointHoverRadius: 4,
      tension: 0,
      spanGaps: false,
    })
  }

  return datasets
}
