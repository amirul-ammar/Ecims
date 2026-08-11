"use client";

import { useEffect, useRef, useState } from "react";
import { useInventoryStore } from "@/stores/useInventoryStore";

/**
 * Custom hook for real-time dashboard data via Server-Sent Events.
 * Connects to /api/sse/dashboard, parses JSON events, and updates Zustand store.
 * Auto-reconnects on connection loss with exponential backoff (capped at 30s).
 */
export function useRealTimeData() {
  const store = useInventoryStore();
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Stable ref to store so connect() doesn't re-create when store changes
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    let destroyed = false;

    const connect = () => {
      if (destroyed) return;

      // Close any existing connection before opening a new one
      eventSourceRef.current?.close();

      const es = new EventSource("/api/sse/dashboard");
      eventSourceRef.current = es;

      es.onopen = () => {
        storeRef.current.setConnectionStatus(true);
        setError(null);
        retryCountRef.current = 0; // reset backoff on successful open
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "dashboard_update") {
            storeRef.current.updateAll({
              stats: data.stats,
              recentTransactions: data.recentTransactions,
              monthlyData: data.monthlyData,
              alerts: data.alerts,
            });
          } else if (data.type === "error") {
            setError(data.message);
          }
        } catch {
          console.error("Failed to parse SSE data");
        }
      };

      es.onerror = () => {
        if (destroyed) return;
        storeRef.current.setConnectionStatus(false);
        es.close();

        // Exponential backoff: 2s, 4s, 8s, 16s, 30s max
        const delay = Math.min(2000 * Math.pow(2, retryCountRef.current), 30000);
        retryCountRef.current += 1;

        retryTimerRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      destroyed = true;
      eventSourceRef.current?.close();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []); // Empty deps — runs once only. storeRef keeps store access stable.

  return {
    data: {
      stats: store.dashboardStats,
      recentTransactions: store.recentTransactions,
      monthlyData: store.monthlyData,
      alerts: store.alerts,
    },
    isConnected: store.isConnected,
    lastUpdated: store.lastUpdated,
    error,
  };
}
