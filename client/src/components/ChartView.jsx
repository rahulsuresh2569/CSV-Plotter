import { useState, useMemo, useRef } from 'react'
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
import RangeSlider from './RangeSlider'
import ChartToolbar from './ChartToolbar'
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

const RANGE_THRESHOLD = 500

function decimateUniform(rows, target) {
  const n = rows.length
  if (n <= target) return rows
  const step = (n - 1) / (target - 1)
  const result = []
  for (let i = 0; i < target; i++) {
    result.push(rows[Math.round(i * step)])
  }
  return result
}

export default function ChartView({ columns, data, selectedXColumn, selectedYColumns, chartType, onChartTypeChange, darkMode }) {
  const chartRef = useRef(null)
  const containerRef = useRef(null)
  const savedScrollY = useRef(0)
  const t = useTranslation()

  const xColumn = columns?.find((c) => c.index === selectedXColumn) ?? null
  const yColumnsList = (selectedYColumns || [])
    .map((idx) => columns?.find((c) => c.index === idx))
    .filter(Boolean)

  const xIsNumeric = xColumn?.type === 'numeric'
  const xIsDate = xColumn?.type === 'date'
  const isBar = chartType === 'bar'

  // Coerce Y values: non-numeric → null (creates chart gaps via spanGaps: false)
  const safeY = (val) => (typeof val === 'number' && isFinite(val)) ? val : null

  // --- Row range state (1-indexed, inclusive) ---
  const totalRows = data?.length || 0
  const [rangeFrom, setRangeFrom] = useState(1)
  const [rangeTo, setRangeTo] = useState(1)
  const [fromInput, setFromInput] = useState('1')
  const [toInput, setToInput] = useState('1')

  // Reset range when dataset changes
  const prevTotal = useRef(0)
  if (totalRows > 0 && totalRows !== prevTotal.current) {
    prevTotal.current = totalRows
    setRangeFrom(1)
    setRangeTo(totalRows)
    setFromInput('1')
    setToInput(String(totalRows))
  }

  const clampedFrom = Math.max(1, Math.min(rangeFrom, totalRows || 1))
  const clampedTo = Math.max(clampedFrom, Math.min(rangeTo, totalRows || 1))

  // Range panel toggle — auto-expanded for large datasets
  const [rangeOpen, setRangeOpen] = useState(false)
  const prevTotalForToggle = useRef(0)
  if (totalRows > 0 && totalRows !== prevTotalForToggle.current) {
    prevTotalForToggle.current = totalRows
    setRangeOpen(totalRows >= RANGE_THRESHOLD)
  }

  function commitFrom(val) {
    const n = parseInt(val, 10)
    if (isNaN(n)) {
      setFromInput(String(clampedFrom))
      return
    }
    const clamped = Math.max(1, Math.min(n, clampedTo))
    setRangeFrom(clamped)
    setFromInput(String(clamped))
  }

  function commitTo(val) {
    const n = parseInt(val, 10)
    if (isNaN(n)) {
      setToInput(String(clampedTo))
      return
    }
    const clamped = Math.max(clampedFrom, Math.min(n, totalRows))
    setRangeTo(clamped)
    setToInput(String(clamped))
  }

  function handleFromKeyDown(e) {
    if (e.key === 'Enter') { e.target.blur(); commitFrom(fromInput) }
  }
  function handleToKeyDown(e) {
    if (e.key === 'Enter') { e.target.blur(); commitTo(toInput) }
  }

  // Dual-handle slider change handler
  function handleRangeSliderChange(newFrom, newTo) {
    setRangeFrom(newFrom)
    setRangeTo(newTo)
    setFromInput(String(newFrom))
    setToInput(String(newTo))
  }

  // Presets — chunk size adapts to dataset
  const NICE_NUMBERS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000]
  function niceChunk(total) {
    const raw = Math.round(total * 0.12)
    for (const n of NICE_NUMBERS) {
      if (n >= raw) return Math.min(n, total)
    }
    return total
  }
  const chunkSize = niceChunk(totalRows)

  function setPreset(from, to) {
    const cf = Math.max(1, Math.min(from, totalRows))
    const ct = Math.max(cf, Math.min(to, totalRows))
    setRangeFrom(cf)
    setRangeTo(ct)
    setFromInput(String(cf))
    setToInput(String(ct))
  }

  const [isFullscreen, setIsFullscreen] = useState(false)

  // --- Fullscreen ---
  function handleFullscreen() {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      savedScrollY.current = window.scrollY
      el.requestFullscreen().then(() => {
        setIsFullscreen(true)
        const onExit = () => {
          if (!document.fullscreenElement) {
            setIsFullscreen(false)
            window.scrollTo(0, savedScrollY.current)
            document.removeEventListener('fullscreenchange', onExit)
          }
        }
        document.addEventListener('fullscreenchange', onExit)
      })
    }
  }

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

  // Build Chart.js data — slice to visible range, then decimate
  const chartData = useMemo(() => {
    if (!data || yColumnsList.length === 0) return { datasets: [] }

    // Slice to visible range when range panel is active
    const isSubset = rangeOpen && (clampedFrom > 1 || clampedTo < data.length)
    const visibleData = isSubset ? data.slice(clampedFrom - 1, clampedTo) : data

    const MAX_POINTS = 500
    const isScatter = chartType === 'scatter'
    const needsDecimation = (isBar || isScatter) && visibleData.length > MAX_POINTS
    const rows = needsDecimation ? decimateUniform(visibleData, MAX_POINTS) : visibleData

    const labels = (isBar || (!xIsNumeric && !xIsDate))
      ? rows.map((row) => row[selectedXColumn])
      : undefined

    const datasets = yColumnsList.map((yCol, i) => {
      const color = SERIES_COLORS[i % SERIES_COLORS.length]
      const isLargeDataset = rows.length > 1000

      return {
        label: yCol.name,
        data: isBar
          ? rows.map((row) => safeY(row[yCol.index]))
          : rows.map((row) => ({
              x: xIsDate ? new Date(row[selectedXColumn]) : row[selectedXColumn],
              y: safeY(row[yCol.index]),
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
  }, [data, selectedXColumn, yColumnsList, xIsNumeric, xIsDate, chartType, isBar, clampedFrom, clampedTo, rangeOpen])

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

  if (!data || selectedXColumn === null) return null

  const hasYColumns = yColumnsList.length > 0

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
      <ChartToolbar
        chartType={chartType}
        onChartTypeChange={onChartTypeChange}
        rangeOpen={rangeOpen}
        onRangeToggle={() => setRangeOpen((v) => !v)}
        onExportPNG={handleExportPNG}
        onFullscreen={handleFullscreen}
        disabled={!hasYColumns}
      />

      {rangeOpen && hasYColumns && (
        <div className={styles.rangeControls}>
          <div className={styles.rangeRow}>
            <div className={styles.presetGroup}>
              <button className={styles.presetBtn} onClick={() => setPreset(1, chunkSize)}>
                {t.first} {chunkSize.toLocaleString()}
              </button>
              <button className={styles.presetBtn} onClick={() => setPreset(totalRows - chunkSize + 1, totalRows)}>
                {t.last} {chunkSize.toLocaleString()}
              </button>
              <button className={styles.presetBtn} onClick={() => setPreset(1, totalRows)}>
                {t.all}
              </button>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>{t.from}</label>
              <input
                type="number"
                className={styles.rangeInput}
                value={fromInput}
                min={1}
                max={clampedTo}
                onChange={(e) => setFromInput(e.target.value)}
                onBlur={() => commitFrom(fromInput)}
                onKeyDown={handleFromKeyDown}
              />
              <label className={styles.inputLabel}>{t.to}</label>
              <input
                type="number"
                className={styles.rangeInput}
                value={toInput}
                min={clampedFrom}
                max={totalRows}
                onChange={(e) => setToInput(e.target.value)}
                onBlur={() => commitTo(toInput)}
                onKeyDown={handleToKeyDown}
              />
            </div>
          </div>
          <span className={styles.rangeHint}>{t.rangeHint}</span>
          <RangeSlider
            min={1}
            max={totalRows}
            from={clampedFrom}
            to={clampedTo}
            onChange={handleRangeSliderChange}
          />
          <span className={styles.rangeInfo}>
            {t.infoRows}: {clampedFrom.toLocaleString()}–{clampedTo.toLocaleString()} {t.of} {totalRows.toLocaleString()}
          </span>
        </div>
      )}

      <div ref={containerRef} key={chartType} className={styles.chartContainer}>
        {isFullscreen && (
          <button
            className={styles.exitFullscreenBtn}
            onClick={() => document.exitFullscreen()}
            title={t.exitFullscreen}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
            </svg>
            {t.exitFullscreen}
          </button>
        )}
        {hasYColumns ? (
          <ChartComponent ref={chartRef} data={chartData} options={options} />
        ) : (
          <div className={styles.placeholder}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="14" width="48" height="40" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
              <line x1="8" y1="26" x2="56" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.15" />
              <line x1="24" y1="14" x2="24" y2="54" stroke="currentColor" strokeWidth="1" opacity="0.15" />
              <line x1="40" y1="14" x2="40" y2="54" stroke="currentColor" strokeWidth="1" opacity="0.15" />
              <polyline points="14,48 22,40 30,44 38,32 46,36 52,30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" strokeDasharray="3 3" />
            </svg>
            <p className={styles.placeholderText}>{t.selectNumericHint}</p>
          </div>
        )}
      </div>
    </div>
  )
}
