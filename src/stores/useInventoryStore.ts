import { create } from "zustand";
import type {
  DashboardStats,
  TransactionDetail,
  MonthlyData,
  LowStockAlert,
  ExpiringLot,
} from "@/types";

interface AlertsData {
  lowStock: LowStockAlert[];
  expiring: ExpiringLot[];
  totalAlerts: number;
}

interface InventoryState {
  dashboardStats: DashboardStats | null;
  recentTransactions: TransactionDetail[];
  monthlyData: MonthlyData[];
  alerts: AlertsData | null;
  isConnected: boolean;
  lastUpdated: Date | null;

  // Actions
  setDashboardStats: (stats: DashboardStats) => void;
  setRecentTransactions: (txns: TransactionDetail[]) => void;
  setMonthlyData: (data: MonthlyData[]) => void;
  setAlerts: (alerts: AlertsData) => void;
  setConnectionStatus: (status: boolean) => void;
  setLastUpdated: (date: Date) => void;
  updateAll: (data: {
    stats: DashboardStats;
    recentTransactions: TransactionDetail[];
    monthlyData: MonthlyData[];
    alerts: AlertsData;
  }) => void;
}

/**
 * Zustand store for client-side inventory state.
 * Updated by SSE real-time data stream.
 */
export const useInventoryStore = create<InventoryState>((set) => ({
  dashboardStats: null,
  recentTransactions: [],
  monthlyData: [],
  alerts: null,
  isConnected: false,
  lastUpdated: null,

  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  setRecentTransactions: (txns) => set({ recentTransactions: txns }),
  setMonthlyData: (data) => set({ monthlyData: data }),
  setAlerts: (alerts) => set({ alerts }),
  setConnectionStatus: (status) => set({ isConnected: status }),
  setLastUpdated: (date) => set({ lastUpdated: date }),
  updateAll: (data) =>
    set({
      dashboardStats: data.stats,
      recentTransactions: data.recentTransactions,
      monthlyData: data.monthlyData,
      alerts: data.alerts,
      lastUpdated: new Date(),
    }),
}));
