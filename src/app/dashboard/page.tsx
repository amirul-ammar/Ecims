"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import AlertsBanner from "@/components/AlertsBanner";
import MonthlyChart from "@/components/MonthlyChart";
import TransactionTable from "@/components/TransactionTable";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import Modal from "@/components/Modal";
import { useRealTimeData } from "@/hooks/useRealTimeData";
import { useAlerts } from "@/hooks/useAlerts";
import { useServerTime } from "@/hooks/useServerTime";
import { useSession } from "next-auth/react";
import { formatCurrency, formatNumber, formatDate, formatDateTime } from "@/lib/utils";
import {
  Package,
  MapPin,
  AlertTriangle,
  Clock,
  DollarSign,
} from "lucide-react";
import { Toaster } from "sonner";

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Role-specific context message.
 * Admin and Engineering do NOT see stock/expiry alert counts.
 */
function getRoleMessage(
  roleId: number,
  stats: { lowStockCount: number; expiringSoonCount: number } | null,
  pendingRequests: number
): string {
  if (!stats) return "Loading your dashboard...";

  const totalAlerts = stats.lowStockCount + stats.expiringSoonCount;

  switch (roleId) {
    case 1: // Admin — manages users, not inventory alerts
      return "Manage users and monitor system activity.";
    case 2: // Inventory Controller
      if (pendingRequests > 0)
        return `${pendingRequests} request${pendingRequests !== 1 ? "s" : ""} pending your approval.`;
      if (totalAlerts > 0)
        return `${totalAlerts} stock alert${totalAlerts !== 1 ? "s" : ""} require attention.`;
      return "No pending actions. Inventory looks good.";
    case 3: // Warehouse
      return stats.expiringSoonCount > 0
        ? `${stats.expiringSoonCount} lot${stats.expiringSoonCount !== 1 ? "s" : ""} expiring within 30 days.`
        : "No urgent tasks. Ready for operations.";
    case 4: // Engineering — read-only, no alert responsibility
      return "Check parts availability before raising a request.";
    default:
      return "Welcome to ECIMS.";
  }
}

export default function DashboardPage() {
  const { data, isConnected, lastUpdated } = useRealTimeData();
  const { lowStock, expiring, isLoading: alertsLoading } = useAlerts();
  const { getServerTime, isReady: timeReady } = useServerTime();
  const { data: session } = useSession();
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const [isExpiringModalOpen, setIsExpiringModalOpen] = useState(false);

  const stats = data.stats;
  const isLoading = !stats;

  const userName = session?.user?.name?.split(" ")[0] ?? "there";
  const roleId = session?.user?.role_id ?? 0;

  // Only Inventory Controller (2) and Warehouse (3) see alert cards and banner
  const canSeeAlerts = roleId === 2 || roleId === 3;

  const pendingRequests = 0;
  const greeting = getTimeGreeting();
  const roleMessage = getRoleMessage(roleId, stats, pendingRequests);

  return (
    <div className="app-layout">
      <Sidebar />
      <Toaster position="top-right" richColors />
      <main className="main-content">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1>{greeting}, {userName}. 👋</h1>
            <p>{roleMessage}</p>
          </div>
          <div className="connection-status">
            <div className={`connection-dot ${isConnected ? "connected" : "disconnected"}`} />
            <span className="text-muted">
              {isConnected ? "Live" : "Reconnecting..."}
              {lastUpdated && <span> · Updated {formatDateTime(lastUpdated)}</span>}
            </span>
            {timeReady && (
              <span className="text-muted" style={{ marginLeft: 8 }}>
                Server: {formatDateTime(getServerTime())}
              </span>
            )}
          </div>
        </div>

        {/* Alerts Banner — IC and Warehouse only */}
        {canSeeAlerts && <AlertsBanner />}

        {/* Stats Cards */}
        {isLoading ? (
          <LoadingSkeleton type="cards" count={canSeeAlerts ? 5 : 3} />
        ) : (
          <div className="stats-grid">
            <StatsCard
              icon={Package}
              label="Total Active SKUs"
              value={formatNumber(stats.totalParts)}
              variant="info"
            />
            <StatsCard
              icon={MapPin}
              label="Total Locations"
              value={formatNumber(stats.totalLocations)}
              variant="purple"
            />

            {/* Low Stock Alert — IC and Warehouse only */}
            {canSeeAlerts && (
              <StatsCard
                icon={AlertTriangle}
                label="Low Stock Alerts"
                value={formatNumber(stats.lowStockCount)}
                variant="danger"
                onClick={() => setIsLowStockModalOpen(true)}
              />
            )}

            {/* Expiring Lots — IC and Warehouse only */}
            {canSeeAlerts && (
              <StatsCard
                icon={Clock}
                label="Expiring (30 days)"
                value={formatNumber(stats.expiringSoonCount)}
                variant="warning"
                onClick={() => setIsExpiringModalOpen(true)}
              />
            )}

            <StatsCard
              icon={DollarSign}
              label="Est. Inventory Value"
              value={formatCurrency(stats.estimatedValue)}
              variant="success"
            />
          </div>
        )}

        {/* Monthly Chart */}
        {isLoading ? (
          <LoadingSkeleton type="chart" />
        ) : (
          <MonthlyChart data={data.monthlyData} />
        )}

        {/* Low Stock Modal — IC and Warehouse only */}
        {canSeeAlerts && (
          <Modal isOpen={isLowStockModalOpen} onClose={() => setIsLowStockModalOpen(false)} title="Low Stock Alerts">
            {alertsLoading ? (
              <p>Loading low stock items…</p>
            ) : lowStock.length === 0 ? (
              <p>All parts are above minimum stock levels.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Part</th>
                      <th>Min Stock</th>
                      <th>Current Stock</th>
                      <th>Deficit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((item) => (
                      <tr key={item.part_id}>
                        <td>{item.sku}</td>
                        <td>{item.name}</td>
                        <td>{item.min_stock}</td>
                        <td>{item.current_stock}</td>
                        <td className="text-danger">{item.deficit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Modal>
        )}

        {/* Expiring Lots Modal — IC and Warehouse only */}
        {canSeeAlerts && (
          <Modal isOpen={isExpiringModalOpen} onClose={() => setIsExpiringModalOpen(false)} title="Parts Expiring Within 30 Days">
            {alertsLoading ? (
              <p>Loading expiring lots…</p>
            ) : expiring.length === 0 ? (
              <p>No parts are expiring within the next 30 days.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Part</th>
                      <th>Lot #</th>
                      <th>Location</th>
                      <th>Qty</th>
                      <th>Expiry</th>
                      <th>Days Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiring.map((lot) => (
                      <tr key={`${lot.lot_id}-${lot.part_id}`}>
                        <td>{lot.part_sku}</td>
                        <td>{lot.part_name}</td>
                        <td>{lot.lot_number}</td>
                        <td>{lot.location_name}</td>
                        <td>{lot.quantity}</td>
                        <td>{formatDate(lot.expiry_date)}</td>
                        <td>{lot.days_until_expiry}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Modal>
        )}

        {/* Recent Transactions */}
        {isLoading ? (
          <LoadingSkeleton type="table" />
        ) : (
          <TransactionTable
            transactions={data.recentTransactions}
            title="Recent Transactions"
            showSearch={false}
            pageSize={5}
          />
        )}
      </main>
    </div>
  );
}