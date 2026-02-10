import { useMemo, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Line, Scatter, Bar } from 'react-chartjs-2'
import { useTranslation } from '../LanguageContext'
import styles from './ChartView.module.css'

// Register Chart.js components once
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
)

// Distinct colors for multi-series lines
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

const CHART_TYPES = ['line', 'scatter', 'bar']

/**
 * Chart.js chart that plots selected X vs Y columns.
 * Supports line, scatter, and bar chart types.
 *
 * Props:
 *   columns: [{ name, type, index }]
 *   data: [[value, ...], ...]  — all rows (full dataset)
 *   selectedXColumn: number (column index)
 *   selectedYColumns: number[] (column indices)
 *   chartType: 'line' | 'scatter' | 'bar'
 *   onChartTypeChange(type) — callback to switch chart type
 */
export default function ChartView({ columns, data, selectedXColumn, selectedYColumns, chartType, onChartTypeChange, darkMode }) {
  const chartRef = useRef(null)
  const t = useTranslation()

  const chartTypeLabels = { line: t.chartLine, scatter: t.chartScatter, bar: t.chartBar }

  const xColumn = columns?.find((c) => c.index === selectedXColumn) ?? null
  const yColumnsList = (selectedYColumns || [])
    .map((idx) => columns?.find((c) => c.index === idx))
    .filter(Boolean)

  // Determine if X is numeric — use linear scale; otherwise category
  const xIsNumeric = xColumn?.type === 'numeric'
  const xIsDate = xColumn?.type === 'date'
  const isBar = chartType === 'bar'

  // Theme-aware colors for chart axes and grid
  const themeColors = useMemo(() => {
    const s = getComputedStyle(document.documentElement)
    return {
      title: s.getPropertyValue('--color-text-secondary').trim(),
      tick: s.getPropertyValue('--color-text-tertiary').trim(),
      grid: s.getPropertyValue('--color-grid').trim(),
      legend: s.getPropertyValue('--color-text-secondary').trim(),
    }
  }, [darkMode])

  // Build Chart.js data structure — memoized to avoid rebuilding on every render
  const chartData = useMemo(() => {
    if (!data || yColumnsList.length === 0) return { datasets: [] }

    // Bar charts always use category scale for X-axis labels
    const labels = (isBar || (!xIsNumeric && !xIsDate))
      ? data.map((row) => row[selectedXColumn])
      : undefined

    const datasets = yColumnsList.map((yCol, i) => {
      const color = SERIES_COLORS[i % SERIES_COLORS.length]
      const isLargeDataset = data.length > 1000

      return {
        label: yCol.name,
        data: isBar
          ? data.map((row) => row[yCol.index])
          : data.map((row) => ({
              x: xIsDate ? new Date(row[selectedXColumn]) : row[selectedXColumn],
              y: row[yCol.index],
            })),
        borderColor: color.border,
        backgroundColor: isBar ? color.background : color.background.replace('0.5', '0.1'),
        borderWidth: isBar ? 1 : isLargeDataset ? 1.5 : 2,
        pointRadius: chartType === 'scatter' ? (isLargeDataset ? 1.5 : 3) : isLargeDataset ? 0 : 2,
        pointHoverRadius: 4,
        tension: 0,
        spanGaps: false,
      }
    })

    return { labels, datasets }
  }, [data, selectedXColumn, yColumnsList, xIsNumeric, xIsDate, chartType, isBar])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: (data?.length || 0) > 2000 ? false : { duration: 300 },
    interaction: {
      mode: isBar ? 'index' : 'nearest',
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
          color: themeColors.legend,
        },
      },
      tooltip: {
        enabled: true,
      },
    },
    scales: {
      x: {
        type: isBar ? 'category' : xIsDate ? 'time' : xIsNumeric ? 'linear' : 'category',
        ...(xIsDate && !isBar && {
          time: {
            tooltipFormat: 'yyyy-MM-dd HH:mm',
          },
        }),
        title: {
          display: true,
          text: xColumn?.name || '',
          font: { size: 13, weight: '600' },
          color: themeColors.title,
        },
        ticks: {
          color: themeColors.tick,
          font: { size: 11 },
          maxTicksLimit: 15,
        },
        grid: {
          color: themeColors.grid,
        },
      },
      y: {
        title: {
          display: yColumnsList.length === 1,
          text: yColumnsList.length === 1 ? yColumnsList[0].name : '',
          font: { size: 13, weight: '600' },
          color: themeColors.title,
        },
        ticks: {
          color: themeColors.tick,
          font: { size: 11 },
        },
        grid: {
          color: themeColors.grid,
        },
      },
    },
  }), [xColumn, yColumnsList, xIsNumeric, xIsDate, isBar, data?.length, themeColors])

  if (!data || yColumnsList.length === 0 || selectedXColumn === null) return null

  function handleExportPNG() {
    const chart = chartRef.current
    if (!chart) return
    const url = chart.toBase64Image()
    const link = document.createElement('a')
    link.download = 'chart.png'
    link.href = url
    link.click()
  }

  const ChartComponent = chartType === 'bar' ? Bar : chartType === 'scatter' ? Scatter : Line

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.chartTypeGroup}>
          {CHART_TYPES.map((ct) => (
            <button
              key={ct}
              className={`${styles.chartTypeBtn} ${chartType === ct ? styles.chartTypeBtnActive : ''}`}
              onClick={() => onChartTypeChange(ct)}
            >
              {chartTypeLabels[ct]}
            </button>
          ))}
        </div>
        <button className={styles.exportBtn} onClick={handleExportPNG}>
          {t.exportPng}
        </button>
      </div>
      <div className={styles.chartContainer}>
        <ChartComponent ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  )
}
