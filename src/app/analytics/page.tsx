"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { toast, Toaster } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, ShieldCheck, Package, AlertTriangle, ShieldOff } from "lucide-react";
import Link from "next/link";
import { ROLES } from "@/lib/rbac";

interface AnalyticsData {
  fefoCompliance: number;
  fefoOverrides: number;
  totalIssues: number;
  stockHealth: { ok: number; low: number; out: number };
  abcSummary: { A: number; B: number; C: number };
  abcData: {
    part_id: number; sku: string; name: string; category: string; unit: string;
    price: number; total_stock: number; total_value: number;
    annual_consumption_value: number; monthly_velocity: number; turnover_ratio: number;
    classification: "A" | "B" | "C"; cumulative_value_percent: number;
  }[];
  top5Parts: {
    sku: string; name: string; annual_consumption_value: number;
    monthly_velocity: number; classification: string;
  }[];
  monthlyData: { month: string; received: number; issued: number }[];
  totalReceived: number; totalIssued: number; generatedAt: string;
}

const ABC_COLORS = { A: "#10b981", B: "#3b82f6", C: "#f59e0b" };

function FEFOGauge({ value }: { value: number }) {
  const color = value >= 90 ? "#10b981" : value >= 75 ? "#f59e0b" : "#ef4444";
  const label = value >= 90 ? "Excellent" : value >= 75 ? "Good" : "Needs Attention";
  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      <div style={{ position: "relative", width: 180, height: 100, margin: "0 auto" }}>
        <svg viewBox="0 0 180 100" style={{ width: "100%", height: "100%" }}>
          <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
          <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 220} 220`} style={{ transition: "stroke-dasharray 1s ease" }} />
          <text x="90" y="82" textAnchor="middle" fontSize="26" fontWeight="800" fill={color}>{value}%</text>
        </svg>
      </div>
      <div style={{ marginTop: 4 }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 700, color }}>{label}</span>
        <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>FEFO Compliance Rate</div>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: "1px solid #f1f5f9" }}>
      <h3 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>{title}</h3>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#0f172a", fontSize: "0.85rem" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ margin: "2px 0", fontSize: "0.8rem", color: p.color }}>
          {p.name}: <strong>{formatNumber(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const roleId = session?.user?.role_id ?? 0;

  // Analytics is Inventory Controller only
  const isAllowed = roleId === ROLES.INVENTORY_CONTROLLER;

  useEffect(() => {
    if (!isAllowed || status !== "authenticated") { setLoading(false); return; }
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => toast.error(e.message || "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [isAllowed, status]);

  // Access Restricted screen for Admin, Engineering, Warehouse
  if (status === "authenticated" && !isAllowed) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-header">
            <div><h1>Analytics</h1><p>Inventory performance insights and KPIs</p></div>
          </div>
          <div className="table-container" style={{ maxWidth: 600 }}>
            <div style={{ padding: 48, textAlign: "center" }}>
              <ShieldOff size={48} style={{ color: "var(--color-warning)", marginBottom: 16 }} />
              <h2 style={{ marginBottom: 8 }}>Access Restricted</h2>
              <p style={{ color: "var(--color-text-muted)", marginBottom: 20 }}>
                The Analytics page is only accessible to the Inventory Controller.
                This data is used for inventory management decisions and performance monitoring.
              </p>
              <Link href="/dashboard" className="btn btn-outline">Back to Dashboard</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const stockHealthData = data
    ? [
        { name: "Sufficient Stock", value: data.stockHealth.ok,  color: "#10b981" },
        { name: "Low Stock",        value: data.stockHealth.low, color: "#f59e0b" },
        { name: "Out of Stock",     value: data.stockHealth.out, color: "#ef4444" },
      ].filter((d) => d.value > 0)
    : [];

  const abcPieData = data
    ? [
        { name: "A — Critical",     value: data.abcSummary.A, color: "#10b981" },
        { name: "B — Important",    value: data.abcSummary.B, color: "#3b82f6" },
        { name: "C — Low Priority", value: data.abcSummary.C, color: "#f59e0b" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="app-layout">
      <Sidebar />
      <Toaster position="top-right" richColors />
      <main className="main-content">
        <div className="page-header">
          <div><h1>Analytics</h1><p>Inventory performance insights and KPIs</p></div>
          {data && (
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              Generated {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {loading ? (
          <>
            <LoadingSkeleton type="cards" count={4} />
            <LoadingSkeleton type="chart" />
            <LoadingSkeleton type="chart" />
          </>
        ) : !data ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Failed to load analytics data.</div>
        ) : (
          <>
            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
              <KPICard icon={ShieldCheck} label="FEFO Compliance" value={`${data.fefoCompliance}%`}
                sub={`${data.fefoOverrides} override${data.fefoOverrides !== 1 ? "s" : ""} recorded`} color="#10b981" />
              <KPICard icon={TrendingUp} label="Total Issues (All Time)" value={formatNumber(data.totalIssued)}
                sub={`${formatNumber(data.totalReceived)} received`} color="#3b82f6" />
              <KPICard icon={Package} label="Parts at Sufficient Stock" value={formatNumber(data.stockHealth.ok)}
                sub={`${data.stockHealth.low + data.stockHealth.out} need attention`} color="#8b5cf6" />
              <KPICard icon={AlertTriangle} label="Low / Out of Stock" value={formatNumber(data.stockHealth.low + data.stockHealth.out)}
                sub={`${data.stockHealth.out} fully depleted`} color="#ef4444" />
            </div>

            {/* Row 1: FEFO + Stock Health */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <SectionCard title="FEFO Compliance Rate">
                <FEFOGauge value={data.fefoCompliance} />
                <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 24 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#10b981" }}>{data.totalIssues - data.fefoOverrides}</div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>FEFO Compliant</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ef4444" }}>{data.fefoOverrides}</div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Overrides</div>
                  </div>
                </div>
              </SectionCard>
              <SectionCard title="Stock Health Overview">
                {stockHealthData.length === 0 ? (
                  <p style={{ color: "#94a3b8", textAlign: "center" }}>No stock data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={stockHealthData} cx="50%" cy="50%" outerRadius={70}
                        dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}>
                        {stockHealthData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip /><Legend iconType="circle" iconSize={10} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            </div>

            {/* Row 2: ABC + Top 5 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <SectionCard title="ABC Classification Breakdown">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={abcPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                      {abcPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} parts`, ""]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
                  {[{ key: "A", label: "Critical (80% value)", color: "#10b981" },
                    { key: "B", label: "Important",            color: "#3b82f6" },
                    { key: "C", label: "Low Priority",         color: "#f59e0b" }].map((item) => (
                    <div key={item.key} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: item.color }}>
                        {data.abcSummary[item.key as "A" | "B" | "C"]}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="Top 5 Most Issued Parts">
                {data.top5Parts.length === 0 ? (
                  <p style={{ color: "#94a3b8", textAlign: "center" }}>No issue data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.top5Parts} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `RM${v.toFixed(0)}`} />
                      <YAxis type="category" dataKey="sku" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value)), "Annual Value"]}
                        labelFormatter={(label) => { const p = data.top5Parts.find((p) => p.sku === label); return p ? `${label} — ${p.name}` : label; }}
                      />
                      <Bar dataKey="annual_consumption_value" radius={[0, 6, 6, 0]}>
                        {data.top5Parts.map((entry, i) => (
                          <Cell key={i} fill={ABC_COLORS[entry.classification as "A" | "B" | "C"] ?? "#3b82f6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            </div>

            {/* Row 3: Monthly Trend */}
            <SectionCard title="Monthly Stock Movement (Last 12 Months)">
              {data.monthlyData.length === 0 ? (
                <p style={{ color: "#94a3b8", textAlign: "center" }}>No monthly data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={10} />
                    <Bar dataKey="received" name="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="issued"   name="Issued"   fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            {/* Row 4: Full ABC Table */}
            <SectionCard title="Full ABC Analysis">
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Class</th><th>SKU</th><th>Name</th>
                      <th className="text-right">Stock</th><th className="text-right">Annual Value</th>
                      <th className="text-right">Velocity/mo</th><th className="text-right">Turnover</th>
                      <th className="text-right">Cumulative %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.abcData.map((row) => (
                      <tr key={row.part_id}>
                        <td>
                          <span style={{ display: "inline-block", width: 26, height: 26, borderRadius: "50%",
                            background: ABC_COLORS[row.classification], color: "#fff",
                            fontWeight: 800, fontSize: "0.8rem", textAlign: "center", lineHeight: "26px" }}>
                            {row.classification}
                          </span>
                        </td>
                        <td className="font-mono" style={{ fontWeight: 600 }}>{row.sku}</td>
                        <td>{row.name}</td>
                        <td className="text-right">{formatNumber(row.total_stock)}</td>
                        <td className="text-right">{formatCurrency(row.annual_consumption_value)}</td>
                        <td className="text-right">{row.monthly_velocity.toFixed(1)}</td>
                        <td className="text-right">{row.turnover_ratio.toFixed(2)}x</td>
                        <td className="text-right">{row.cumulative_value_percent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}
      </main>
    </div>
  );
}