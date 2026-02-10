import { useEffect } from 'react'
import styles from './Toast.module.css'

/**
 * Auto-dismissing toast notification.
 *
 * Props:
 *   message: string        — text to display
 *   visible: boolean       — controls mount/animation
 *   onDismiss: () => void  — called when toast should disappear
 *   duration: number       — auto-dismiss delay in ms (default 3500)
 */
export default function Toast({ message, visible, onDismiss, duration = 3500 }) {
  useEffect(() => {
    if (!visible) return
    const id = setTimeout(onDismiss, duration)
    return () => clearTimeout(id)
  }, [visible, duration, onDismiss])

  if (!visible) return null

  return (
    <div className={styles.toast}>
      <span className={styles.icon}>&#10003;</span>
      <span className={styles.message}>{message}</span>
      <button className={styles.close} onClick={onDismiss} aria-label="Dismiss">&times;</button>
    </div>
  )
}
