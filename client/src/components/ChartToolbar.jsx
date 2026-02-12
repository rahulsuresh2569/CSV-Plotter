import { useTranslation } from '../LanguageContext'
import styles from './ChartToolbar.module.css'

const CHART_TYPES = ['line', 'scatter', 'bar']

export default function ChartToolbar({ chartType, onChartTypeChange, rangeOpen, onRangeToggle, onExportPNG, onFullscreen, disabled }) {
  const t = useTranslation()
  const chartTypeLabels = { line: t.chartLine, scatter: t.chartScatter, bar: t.chartBar }

  return (
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
      <div className={styles.toolbarActions}>
        <button
          className={`${styles.iconBtn} ${rangeOpen ? styles.iconBtnActive : ''}`}
          onClick={onRangeToggle}
          title={t.range}
          disabled={disabled}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
        </button>
        <button className={styles.exportBtn} onClick={onExportPNG} disabled={disabled}>
          {t.exportPng}
        </button>
        <button className={styles.iconBtn} onClick={onFullscreen} title={t.fullscreen} disabled={disabled}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
