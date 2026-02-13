// RangeSlider.jsx: Dual-handle slider for selecting a row range
import { useRef, useEffect, useState } from 'react'
import styles from './RangeSlider.module.css'

export default function RangeSlider({ min, max, from, to, onChange }) {
  const trackRef = useRef(null)
  const [drag, setDrag] = useState(null)

  // Convert a mouse X position to a value in [min, max]
  function xToVal(clientX) {
    const rect = trackRef.current.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(min + fraction * (max - min))
  }

  // Convert a value to a percentage position on the track
  function valToPercent(val) {
    if (max <= min) return 0
    return ((val - min) / (max - min)) * 100
  }

  function handleFromDown(e) {
    e.preventDefault()
    e.stopPropagation()
    setDrag({ type: 'from' })
    document.body.style.userSelect = 'none'
  }

  function handleToDown(e) {
    e.preventDefault()
    e.stopPropagation()
    setDrag({ type: 'to' })
    document.body.style.userSelect = 'none'
  }

  // Start dragging the filled bar (slides the whole window)
  function handleBarDown(e) {
    e.preventDefault()
    e.stopPropagation()
    setDrag({ type: 'bar', startX: e.clientX, startFrom: from, startTo: to })
    document.body.style.userSelect = 'none'
  }

  // Click on empty track area — move the nearest handle
  function handleTrackDown(e) {
    const val = xToVal(e.clientX)
    const distFrom = Math.abs(val - from)
    const distTo = Math.abs(val - to)
    if (distFrom <= distTo) {
      onChange(Math.max(min, Math.min(val, to)), to)
    } else {
      onChange(from, Math.max(from, Math.min(val, max)))
    }
  }

  // Global pointer listeners while dragging (useEffect is needed here
  // because we need to track mouse movement outside the component)
  useEffect(() => {
    if (!drag) return

    function handleMove(e) {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const pxPerVal = rect.width / (max - min || 1)

      if (drag.type === 'from') {
        const newVal = xToVal(e.clientX)
        const clamped = Math.max(min, Math.min(newVal, to))
        if (clamped !== from) onChange(clamped, to)
      } else if (drag.type === 'to') {
        const newVal = xToVal(e.clientX)
        const clamped = Math.max(from, Math.min(newVal, max))
        if (clamped !== to) onChange(from, clamped)
      } else if (drag.type === 'bar') {
        const deltaPx = e.clientX - drag.startX
        const deltaVal = Math.round(deltaPx / pxPerVal)
        const windowSize = drag.startTo - drag.startFrom
        let newFrom = drag.startFrom + deltaVal
        let newTo = drag.startTo + deltaVal
        if (newFrom < min) { newFrom = min; newTo = min + windowSize }
        if (newTo > max) { newTo = max; newFrom = max - windowSize }
        if (newFrom !== from || newTo !== to) onChange(newFrom, newTo)
      }
    }

    function handleUp() {
      setDrag(null)
      document.body.style.userSelect = ''
    }

    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
    }
  }, [drag, from, to, min, max, onChange])

  const fromPct = valToPercent(from)
  const toPct = valToPercent(to)
  const barWidthPct = toPct - fromPct

  return (
    <div
      className={styles.slider}
      ref={trackRef}
      onPointerDown={handleTrackDown}
    >
      <div className={styles.track} />
      <div
        className={`${styles.filled} ${drag?.type === 'bar' ? styles.grabbing : ''}`}
        style={{ left: `${fromPct}%`, width: `${barWidthPct}%` }}
        onPointerDown={handleBarDown}
      >
        {barWidthPct > 4 && (
          <span className={styles.grip}>
            <span /><span /><span />
          </span>
        )}
      </div>
      <div
        className={styles.handle}
        style={{ left: `${fromPct}%` }}
        onPointerDown={handleFromDown}
      />
      <div
        className={styles.handle}
        style={{ left: `${toPct}%` }}
        onPointerDown={handleToDown}
      />
    </div>
  )
}
