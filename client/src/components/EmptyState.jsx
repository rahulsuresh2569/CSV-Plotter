//displays hintUI when no file is uploaded
export default function EmptyState({ hint }) {
  return (
    <div className="empty-state">
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="20" width="60" height="50" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <line x1="10" y1="35" x2="70" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
        <line x1="30" y1="20" x2="30" y2="70" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
        <line x1="50" y1="20" x2="50" y2="70" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
        <polyline points="18,60 28,50 38,55 48,40 58,45 64,38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        <circle cx="28" cy="50" r="2" fill="currentColor" opacity="0.5" />
        <circle cx="38" cy="55" r="2" fill="currentColor" opacity="0.5" />
        <circle cx="48" cy="40" r="2" fill="currentColor" opacity="0.5" />
        <circle cx="58" cy="45" r="2" fill="currentColor" opacity="0.5" />
      </svg>
      <p className="empty-state-text">{hint}</p>
    </div>
  )
}
