import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function TransactionsLoading() {
  return (
    <div className="app-layout">
      <div className="main-content" style={{ marginLeft: 260 }}>
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton skeleton-text wide" />
        </div>
        <LoadingSkeleton type="table" count={12} />
      </div>
    </div>
  );
}
