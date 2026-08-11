interface LoadingSkeletonProps {
  type: "cards" | "table" | "chart" | "form";
  count?: number;
}

/**
 * Animated skeleton loader for cards, tables, charts, and forms.
 */
export default function LoadingSkeleton({
  type,
  count = 5,
}: LoadingSkeletonProps) {
  if (type === "cards") {
    return (
      <div className="stats-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    );
  }

  if (type === "chart") {
    return <div className="skeleton skeleton-chart" />;
  }

  if (type === "form") {
    return (
      <div style={{ padding: "24px" }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="form-group">
            <div className="skeleton skeleton-text narrow" />
            <div className="skeleton" style={{ height: "40px", marginTop: "6px" }} />
          </div>
        ))}
      </div>
    );
  }

  // Table skeleton
  return (
    <div className="table-container">
      <div className="table-header">
        <div className="skeleton skeleton-text medium" />
        <div className="skeleton" style={{ width: "200px", height: "36px" }} />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}
