"use client";

import { useState } from "react";
import { Table, BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

type Props = {
  reportType: string;
  data: Record<string, unknown>[];
  loading: boolean;
};

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const COLUMNS: Record<string, { key: string; label: string; format?: (v: unknown) => string }[]> = {
  valuation: [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Part Name" },
    { key: "category", label: "Category" },
    { key: "total_stock", label: "Stock", format: (v) => Number(v).toLocaleString() },
    { key: "price", label: "Unit Price", format: (v) => formatCurrency(Number(v)) },
    { key: "total_value", label: "Total Value", format: (v) => formatCurrency(Number(v)) },
    { key: "lot_count", label: "Lots" },
  ],
  stock: [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Part Name" },
    { key: "category", label: "Category" },
    { key: "current_stock", label: "Stock", format: (v) => Number(v).toLocaleString() },
    { key: "min_stock", label: "Min Stock" },
    { key: "deficit", label: "Deficit", format: (v) => Number(v) > 0 ? `−${v}` : "—" },
    { key: "status", label: "Status" },
  ],
  movement: [
    { key: "created_at", label: "Date", format: (v) => new Date(v as string).toLocaleDateString("en-GB") },
    { key: "part_sku", label: "SKU" },
    { key: "part_name", label: "Part" },
    { key: "transaction_type", label: "Type" },
    { key: "quantity", label: "Qty", format: (v) => Number(v).toLocaleString() },
    { key: "user_name", label: "User" },
    { key: "location_name", label: "Location" },
  ],
  usage: [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Part Name" },
    { key: "category", label: "Category" },
    { key: "total_issued", label: "Total Issued", format: (v) => Number(v).toLocaleString() },
    { key: "total_received", label: "Total Received", format: (v) => Number(v).toLocaleString() },
    { key: "transaction_count", label: "Transactions" },
    { key: "last_activity", label: "Last Activity", format: (v) => v ? new Date(v as string).toLocaleDateString("en-GB") : "—" },
  ],
  summary: [
    { key: "period", label: "Period" },
    { key: "total_received", label: "Received", format: (v) => Number(v).toLocaleString() },
    { key: "total_issued", label: "Issued", format: (v) => Number(v).toLocaleString() },
    { key: "net_movement", label: "Net", format: (v) => Number(v) >= 0 ? `+${v}` : String(v) },
    { key: "transaction_count", label: "Transactions" },
  ],
  audit: [
    { key: "created_at", label: "Date", format: (v) => new Date(v as string).toLocaleString("en-GB") },
    { key: "user_name", label: "User" },
    { key: "user_email", label: "Email" },
    { key: "report_type", label: "Report" },
    { key: "export_format", label: "Format" },
  ],  abc: [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Part Name" },
    { key: "category", label: "Category" },
    { key: "total_stock", label: "Stock", format: (v) => Number(v).toLocaleString() },
    { key: "price", label: "Unit Price", format: (v) => formatCurrency(Number(v)) },
    { key: "total_value", label: "Stock Value", format: (v) => formatCurrency(Number(v)) },
    { key: "annual_consumption_value", label: "Annual Consumption", format: (v) => formatCurrency(Number(v)) },
    { key: "monthly_velocity", label: "Monthly Velocity", format: (v) => Number(v).toFixed(1) },
    { key: "turnover_ratio", label: "Turnover", format: (v) => Number(v).toFixed(2) },
    { key: "classification", label: "Class" },
    { key: "cumulative_value_percent", label: "Cumulative %", format: (v) => `${Number(v).toFixed(1)}%` },
  ],};

function StatusBadge({ value }: { value: string }) {
  const cls = value === "Out of Stock" ? "badge-danger" : value === "Low Stock" ? "badge-warning" : "badge-success";
  return <span className={`badge ${cls}`}>{value}</span>;
}

function TypeBadge({ value }: { value: string }) {
  const cls = value === "receive" ? "badge-success" : value === "issue" ? "badge-danger" : "badge-info";
  return <span className={`badge ${cls}`}>{value}</span>;
}

function ChartView({ reportType, data }: { reportType: string; data: Record<string, unknown>[] }) {
  if (reportType === "valuation") {
    const top10 = [...data].sort((a, b) => Number(b.total_value) - Number(a.total_value)).slice(0, 10);
    return (
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={top10} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="sku" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `MYR ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="total_value" fill="#3b82f6" name="Total Value" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (reportType === "stock") {
  const counts = { "Sufficient Stock": 0, "Low Stock": 0, "Out of Stock": 0 };
data.forEach((r) => {
  const status = r.status === "OK" ? "Sufficient Stock" : String(r.status);
  if (status in counts) counts[status as keyof typeof counts]++;
});
    const pieData = Object.entries(counts).map(([name, value]) => ({ name, value }));
    const pieColors = ["#10b981", "#f59e0b", "#ef4444"];
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
            {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (reportType === "summary") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="total_received" name="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="total_issued" name="Issued" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (reportType === "usage") {
    const top10 = [...data].sort((a, b) => Number(b.total_issued) - Number(a.total_issued)).slice(0, 10);
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={top10} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="sku" type="category" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="total_issued" name="Issued" fill="#ef4444" radius={[0, 4, 4, 0]} />
          <Bar dataKey="total_received" name="Received" fill="#10b981" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (reportType === "movement") {
    // Group by date for a line chart
    const byDate: Record<string, { received: number; issued: number }> = {};
    data.forEach((r) => {
      const d = new Date(r.created_at as string).toLocaleDateString("en-GB");
      if (!byDate[d]) byDate[d] = { received: 0, issued: 0 };
      if (r.transaction_type === "receive") byDate[d].received += Number(r.quantity);
      else if (r.transaction_type === "issue") byDate[d].issued += Number(r.quantity);
    });
    const chartData = Object.entries(byDate)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => {
        const [dayA, monA, yearA] = a.date.split("/").map(Number);
        const [dayB, monB, yearB] = b.date.split("/").map(Number);
        return new Date(yearA, monA - 1, dayA).getTime() - new Date(yearB, monB - 1, dayB).getTime();
      })
      .slice(-60);
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="received" stroke="#10b981" name="Received" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="issued" stroke="#ef4444" name="Issued" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (reportType === "abc") {
    const top10 = [...data]
      .sort((a, b) => Number(b.annual_consumption_value) - Number(a.annual_consumption_value))
      .slice(0, 10);

    return (
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={top10} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="sku" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `MYR ${(Number(v) / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="annual_consumption_value" fill="#3b82f6" name="Annual Consumption" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>No chart available for this report type.</div>;
}

export default function ReportPreview({ reportType, data, loading }: Props) {
  const [tab, setTab] = useState<"table" | "chart">("table");
  const columns = COLUMNS[reportType] ?? [];

  if (loading) {
    return (
      <div className="report-preview-loading">
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="report-empty">
        No data found for the selected filters.
      </div>
    );
  }

  return (
    <div className="report-preview">
      <div className="report-tabs">
        <button
          id="tab-table"
          className={`report-tab ${tab === "table" ? "active" : ""}`}
          onClick={() => setTab("table")}
        >
          <Table size={15} /> Table View
        </button>
        <button
          id="tab-chart"
          className={`report-tab ${tab === "chart" ? "active" : ""}`}
          onClick={() => setTab("chart")}
        >
          <BarChart2 size={15} /> Chart View
        </button>
        <span className="report-row-count">{data.length} rows</span>
      </div>

      {tab === "table" && (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => {
                    const raw = row[c.key];
                    if (c.key === "status") return <td key={c.key}><StatusBadge value={String(raw)} /></td>;
                    if (c.key === "transaction_type") return <td key={c.key}><TypeBadge value={String(raw ?? "")} /></td>;
                    return <td key={c.key}>{c.format ? c.format(raw) : String(raw ?? "—")}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "chart" && (
        <div style={{ padding: "20px 16px" }}>
          <ChartView reportType={reportType} data={data} />
        </div>
      )}
    </div>
  );
}