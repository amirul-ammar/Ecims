import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function DashboardLoading() {
  return (
    <div className="app-layout">
      <div className="main-content" style={{ marginLeft: 260 }}>
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton skeleton-text wide" />
          <div className="skeleton skeleton-text narrow" style={{ marginTop: 8 }} />
        </div>
        <LoadingSkeleton type="cards" count={5} />
        <LoadingSkeleton type="chart" />
        <LoadingSkeleton type="table" />
      </div>
    </div>
  );
}
