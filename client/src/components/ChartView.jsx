//ChartView.jsx: renders the chart with range controls, fullscreen, and export
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
import { sliceRows, downsampleRows, buildLabels, buildDatasets } from '../utils/chartData'
import RangeSlider from './RangeSlider'
import ChartToolbar from './ChartToolbar'
import styles from './ChartView.module.css'

//register Chart.js components once
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

const MAX_POINTS = 500
const RANGE_THRESHOLD = 500

function getXScaleType(chartType, xType) {
  if (chartType === 'bar') return 'category'
  if (xType === 'date') return 'time'
  if (xType === 'numeric') return 'linear'
  return 'category'
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

  const xType = xColumn?.type || 'string'
  const isBar = chartType === 'bar'

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

  //auto-expand range panel for large datasets
  const [rangeOpen, setRangeOpen] = useState(false)
  const prevTotalForToggle = useRef(0)
  if (totalRows > 0 && totalRows !== prevTotalForToggle.current) {
    prevTotalForToggle.current = totalRows
    setRangeOpen(totalRows >= RANGE_THRESHOLD)
  }

  //validate and apply the "from" input value
  function applyFromValue(val) {
    const n = parseInt(val, 10)
    if (isNaN(n)) {
      setFromInput(String(clampedFrom))
      return
    }
    const clamped = Math.max(1, Math.min(n, clampedTo))
    setRangeFrom(clamped)
    setFromInput(String(clamped))
  }

  //validate and apply the "to" input value
  function applyToValue(val) {
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
    if (e.key === 'Enter') { e.target.blur(); applyFromValue(fromInput) }
  }
  function handleToKeyDown(e) {
    if (e.key === 'Enter') { e.target.blur(); applyToValue(toInput) }
  }

  function handleRangeSliderChange(newFrom, newTo) {
    setRangeFrom(newFrom)
    setRangeTo(newTo)
    setFromInput(String(newFrom))
    setToInput(String(newTo))
  }

  //pick a chunk size for preset buttons (roughly 12% of total, rounded to a clean number)
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

  //memoized: reads CSS variables from DOM, only re-runs on theme change
  const themeColors = useMemo(() => {
    const s = getComputedStyle(document.documentElement)
    return {
      title: s.getPropertyValue('--color-text-secondary').trim(),
      tick: s.getPropertyValue('--color-text-tertiary').trim(),
      grid: s.getPropertyValue('--color-grid').trim(),
      legend: s.getPropertyValue('--color-text-secondary').trim(),
    }
  }, [darkMode])

  //memoized: building chart arrays is expensive for large datasets (50k+ rows)
  const chartData = useMemo(() => {
    if (!data || yColumnsList.length === 0) return { datasets: [] }

    //step 1: slice to visible range
    const isSubset = rangeOpen && (clampedFrom > 1 || clampedTo < data.length)
    const visibleRows = isSubset ? sliceRows(data, clampedFrom, clampedTo) : data

    //step 2: downsample for bar/scatter if too many points
    const isScatter = chartType === 'scatter'
    const needsDecimation = (isBar || isScatter) && visibleRows.length > MAX_POINTS
    const rows = needsDecimation ? downsampleRows(visibleRows, MAX_POINTS) : visibleRows

    //step 3: build labels and datasets
    const labels = buildLabels(rows, selectedXColumn, xType, chartType)
    const datasets = buildDatasets(rows, selectedXColumn, yColumnsList, chartType, xType)

    return { labels, datasets }
  }, [data, selectedXColumn, yColumnsList, xType, chartType, isBar, clampedFrom, clampedTo, rangeOpen])

  //memoized: prevents Chart.js full re-render when the options object reference changes
  const options = useMemo(() => {
    const xScaleType = getXScaleType(chartType, xType)

    return {
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
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          type: xScaleType,
          ...(xType === 'date' && !isBar && {
            time: { tooltipFormat: 'yyyy-MM-dd HH:mm' },
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
          grid: { color: themeColors.grid },
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
          grid: { color: themeColors.grid },
        },
      },
    }
  }, [xColumn, yColumnsList, xType, isBar, data?.length, themeColors, chartType])

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

  let ChartComponent = Line
  if (chartType === 'bar') ChartComponent = Bar
  if (chartType === 'scatter') ChartComponent = Scatter

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
                onBlur={() => applyFromValue(fromInput)}
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
                onBlur={() => applyToValue(toInput)}
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
