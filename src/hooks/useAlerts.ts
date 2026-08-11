"use client";

import { useEffect, useState, useCallback } from "react";
import type { LowStockAlert, ExpiringLot } from "@/types";
import { useInventoryStore } from "@/stores/useInventoryStore";

interface AlertsResult {
  lowStock: LowStockAlert[];
  expiring: ExpiringLot[];
  totalAlerts: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for real-time alerts.
 * Uses SSE data from the store if available, otherwise polls /api/alerts.
 */
export function useAlerts(): AlertsResult {
  const storeAlerts = useInventoryStore((s) => s.alerts);
  const [fallbackAlerts, setFallbackAlerts] = useState<{
    lowStock: LowStockAlert[];
    expiring: ExpiringLot[];
    totalAlerts: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(!storeAlerts);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      const data = await res.json();
      setFallbackAlerts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only poll if SSE isn't providing alerts
    if (!storeAlerts) {
      fetchAlerts();
      const interval = setInterval(fetchAlerts, 30000);
      return () => clearInterval(interval);
    }
  }, [storeAlerts, fetchAlerts]);

  const data = storeAlerts || fallbackAlerts;

  return {
    lowStock: data?.lowStock ?? [],
    expiring: data?.expiring ?? [],
    totalAlerts: data?.totalAlerts ?? 0,
    isLoading: !data && isLoading,
    error,
    refetch: fetchAlerts,
  };
}
