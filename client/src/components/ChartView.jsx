import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import styles from './ChartView.module.css'

// Register Chart.js components once
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

// Distinct colors for multi-series lines
const SERIES_COLORS = [
  { border: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' },
  { border: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' },
  { border: '#10b981', background: 'rgba(16, 185, 129, 0.1)' },
  { border: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' },
  { border: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' },
  { border: '#ec4899', background: 'rgba(236, 72, 153, 0.1)' },
  { border: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)' },
  { border: '#84cc16', background: 'rgba(132, 204, 22, 0.1)' },
]

/**
 * Chart.js line chart that plots selected X vs Y columns.
 *
 * Props:
 *   columns: [{ name, type, index }]
 *   data: [[value, ...], ...]  — all rows (full dataset)
 *   selectedXColumn: number (column index)
 *   selectedYColumns: number[] (column indices)
 */
export default function ChartView({ columns, data, selectedXColumn, selectedYColumns }) {
  if (!data || selectedYColumns.length === 0 || selectedXColumn === null) return null

  const xColumn = columns.find((c) => c.index === selectedXColumn)
  const yColumnsList = selectedYColumns
    .map((idx) => columns.find((c) => c.index === idx))
    .filter(Boolean)

  // Determine if X is numeric — use linear scale; otherwise category
  const xIsNumeric = xColumn?.type === 'numeric'

  // Build Chart.js data structure — memoized to avoid rebuilding on every render
  const chartData = useMemo(() => {
    const labels = xIsNumeric ? undefined : data.map((row) => row[selectedXColumn])

    const datasets = yColumnsList.map((yCol, i) => {
      const color = SERIES_COLORS[i % SERIES_COLORS.length]
      const isLargeDataset = data.length > 1000

      return {
        label: yCol.name,
        data: data.map((row) => ({
          x: row[selectedXColumn],
          y: row[yCol.index],
        })),
        borderColor: color.border,
        backgroundColor: color.background,
        borderWidth: isLargeDataset ? 1.5 : 2,
        pointRadius: isLargeDataset ? 0 : 2,
        pointHoverRadius: 4,
        tension: 0,
        spanGaps: false,
      }
    })

    return { labels, datasets }
  }, [data, selectedXColumn, yColumnsList, xIsNumeric])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: data.length > 2000 ? false : { duration: 300 },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: yColumnsList.length > 1,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { size: 12 },
        },
      },
      tooltip: {
        enabled: true,
      },
    },
    scales: {
      x: {
        type: xIsNumeric ? 'linear' : 'category',
        title: {
          display: true,
          text: xColumn?.name || '',
          font: { size: 13, weight: '600' },
          color: '#475569',
        },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          maxTicksLimit: 15,
        },
        grid: {
          color: '#f1f5f9',
        },
      },
      y: {
        title: {
          display: yColumnsList.length === 1,
          text: yColumnsList.length === 1 ? yColumnsList[0].name : '',
          font: { size: 13, weight: '600' },
          color: '#475569',
        },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
        },
        grid: {
          color: '#f1f5f9',
        },
      },
    },
  }), [xColumn, yColumnsList, xIsNumeric, data.length])

  return (
    <div className={styles.wrapper}>
      <div className={styles.chartContainer}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
