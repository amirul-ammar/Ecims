"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAlerts } from "@/hooks/useAlerts";

/**
 * Real-time alerts banner for dashboard.
 * Shows low stock and expiring lot warnings.
 */
export default function AlertsBanner() {
  const { lowStock, expiring, totalAlerts } = useAlerts();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || totalAlerts === 0) return null;

  return (
    <div className={`alerts-banner ${lowStock.length > 0 ? "danger" : "warning"}`}>
      <div className="alerts-banner-icon">
        <AlertTriangle size={20} />
      </div>
      <div className="alerts-banner-content">
        <div className="alerts-banner-title">
          {totalAlerts} Active Alert{totalAlerts !== 1 ? "s" : ""}
        </div>
        <div className="alerts-banner-message">
          {lowStock.length > 0 && (
            <span>{lowStock.length} part{lowStock.length !== 1 ? "s" : ""} below minimum stock. </span>
          )}
          {expiring.length > 0 && (
            <span>{expiring.length} lot{expiring.length !== 1 ? "s" : ""} expiring within 30 days.</span>
          )}
        </div>
      </div>
      <button className="alerts-banner-dismiss" onClick={() => setDismissed(true)}>
        <X size={18} />
      </button>
    </div>
  );
}
