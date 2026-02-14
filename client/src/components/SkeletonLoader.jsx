//displays loading skeleton UI while file is being uploaded and parsed
export default function SkeletonLoader() {
  return (
    <div className="skeleton-group">
      <div className="skeleton-block skeleton-table" />
      <div className="skeleton-row">
        <div className="skeleton-block skeleton-panel" />
        <div className="skeleton-block skeleton-panel" />
      </div>
      <div className="skeleton-block skeleton-chart" />
    </div>
  )
}
