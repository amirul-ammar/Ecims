"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonthlyData } from "@/types";

interface MonthlyChartProps {
  data: MonthlyData[];
}

/**
 * Inbound vs Outbound area chart using Recharts.
 * Data MUST come from real DB queries, never hardcoded.
 */
export default function MonthlyChart({ data }: MonthlyChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <h2>Inbound vs Outbound (12 months)</h2>
        <div className="empty-state" style={{ padding: "40px" }}>
          <p className="text-muted">No transaction data available yet.</p>
        </div>
      </div>
    );
  }

  // Format month labels (e.g., "2024-03" → "Mar 24")
  const formattedData = data.map((d) => {
    const [year, month] = d.month.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return {
      ...d,
      label: date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
    };
  });

  return (
    <div className="chart-container">
      <h2>Inbound vs Outbound (12 months)</h2>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradientReceived" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradientIssued" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "none",
              borderRadius: "12px",
              color: "#fff",
              fontSize: "0.82rem",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}
            itemStyle={{ color: "#fff" }}
            labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: "0.8rem", paddingTop: "16px" }}
          />
          <Area
            type="monotone"
            dataKey="received"
            name="Received"
            stroke="#10b981"
            fill="url(#gradientReceived)"
            strokeWidth={2.5}
          />
          <Area
            type="monotone"
            dataKey="issued"
            name="Issued"
            stroke="#ef4444"
            fill="url(#gradientIssued)"
            strokeWidth={2.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
