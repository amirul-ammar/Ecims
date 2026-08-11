"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import ReportFilters from "@/components/reports/ReportFilters";
import ReportPreview from "@/components/reports/ReportPreview";
import ExportButtons from "@/components/reports/ExportButtons";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  FileBarChart, DollarSign, PackageSearch, ArrowLeftRight, Wrench,
  CalendarRange, ShieldCheck, TrendingUp, TrendingDown, Activity,
  AlertTriangle, Loader2,
} from "lucide-react";

const REPORT_TYPES = [
  { key: "valuation", label: "Inventory Valuation", description: "Total stock value by part", icon: DollarSign, gradient: "info" },
  { key: "stock", label: "Stock Levels", description: "Low stock & out-of-stock items", icon: PackageSearch, gradient: "warning" },
  { key: "movement", label: "Product Movement", description: "Incoming & outgoing stock", icon: ArrowLeftRight, gradient: "success" },
  { key: "usage", label: "Component Usage", description: "Frequently used parts analysis", icon: Wrench, gradient: "purple" },
  { key: "abc", label: "ABC Analysis", description: "Inventory classification by value & velocity", icon: TrendingUp, gradient: "success" },
  { key: "summary", label: "Period Summary", description: "Weekly & monthly summaries", icon: CalendarRange, gradient: "info" },
  { key: "audit", label: "Audit Log", description: "Report generation history", icon: ShieldCheck, gradient: "danger" },
] as const;

/*
 * RBAC matrix:
 * Admin (1)       → Audit Log only. Admin manages users, not inventory.
 * IC (2)          → All inventory reports + PDF export.
 * Warehouse (3)   → No access. IC provides reports as needed.
 * Engineering (4) → Product Movement + Component Usage only.
 */
const REPORT_ACCESS: Record<string, number[]> = {
  valuation: [2],
  stock:     [2],
  movement:  [2, 4],
  usage:     [2, 4],
  summary:   [2],
  abc:       [2],
  audit:     [1],
};

const REPORT_TITLES: Record<string, string> = {
  valuation: "Inventory Valuation Report",
  stock:     "Stock Levels Report",
  movement:  "Product Movement Report",
  usage:     "Component Usage Report",
  abc:       "ABC Analysis Report",
  summary:   "Period Summary Report",
  audit:     "Report Audit Log",
};

type KPI = { label: string; value: string; icon: typeof TrendingUp; variant: string };

function getKPIs(type: string, data: Record<string, unknown>[]): KPI[] {
  if (!data.length) return [];
  switch (type) {
    case "valuation": {
      const totalValue = data.reduce((s, r) => s + Number(r.total_value), 0);
      const totalStock = data.reduce((s, r) => s + Number(r.total_stock), 0);
      const totalLots  = data.reduce((s, r) => s + Number(r.lot_count), 0);
      return [
        { label: "Total Inventory Value", value: formatCurrency(totalValue), icon: DollarSign,    variant: "info" },
        { label: "Total Stock Qty",        value: formatNumber(totalStock),   icon: TrendingUp,    variant: "success" },
        { label: "Active SKUs",            value: formatNumber(data.length),  icon: Activity,      variant: "purple" },
        { label: "Total Lots",             value: formatNumber(totalLots),    icon: PackageSearch, variant: "warning" },
      ];
    }
    case "stock": {
      const outOfStock      = data.filter((r) => r.status === "Out of Stock").length;
      const lowStock        = data.filter((r) => r.status === "Low Stock").length;
      const sufficientStock = data.filter((r) => r.status === "Sufficient Stock").length;
      return [
        { label: "Total Parts",      value: formatNumber(data.length),     icon: Activity,      variant: "info" },
        { label: "Sufficient Stock", value: formatNumber(sufficientStock),  icon: TrendingUp,    variant: "success" },
        { label: "Low Stock",        value: formatNumber(lowStock),         icon: AlertTriangle, variant: "warning" },
        { label: "Out of Stock",     value: formatNumber(outOfStock),       icon: TrendingDown,  variant: "danger" },
      ];
    }
    case "movement": {
      const received    = data.filter((r) => r.transaction_type === "receive");
      const issued      = data.filter((r) => r.transaction_type === "issue");
      const totalRecQty = received.reduce((s, r) => s + Number(r.quantity), 0);
      const totalIssQty = issued.reduce((s, r) => s + Number(r.quantity), 0);
      return [
        { label: "Total Transactions", value: formatNumber(data.length),                icon: Activity,       variant: "info" },
        { label: "Qty Received",        value: formatNumber(totalRecQty),               icon: TrendingUp,     variant: "success" },
        { label: "Qty Issued",          value: formatNumber(totalIssQty),               icon: TrendingDown,   variant: "danger" },
        { label: "Net Movement",        value: formatNumber(totalRecQty - totalIssQty), icon: ArrowLeftRight, variant: "purple" },
      ];
    }
    case "usage": {
      const totalIssued   = data.reduce((s, r) => s + Number(r.total_issued), 0);
      const totalReceived = data.reduce((s, r) => s + Number(r.total_received), 0);
      const totalTxns     = data.reduce((s, r) => s + Number(r.transaction_count), 0);
      return [
        { label: "Unique Parts",       value: formatNumber(data.length),    icon: Activity,       variant: "info" },
        { label: "Total Issued",       value: formatNumber(totalIssued),    icon: TrendingDown,   variant: "danger" },
        { label: "Total Received",     value: formatNumber(totalReceived),  icon: TrendingUp,     variant: "success" },
        { label: "Total Transactions", value: formatNumber(totalTxns),      icon: ArrowLeftRight, variant: "purple" },
      ];
    }
    case "summary": {
      const totalRec = data.reduce((s, r) => s + Number(r.total_received), 0);
      const totalIss = data.reduce((s, r) => s + Number(r.total_issued), 0);
      const totalTx  = data.reduce((s, r) => s + Number(r.transaction_count), 0);
      return [
        { label: "Periods",            value: formatNumber(data.length), icon: CalendarRange, variant: "info" },
        { label: "Total Received",     value: formatNumber(totalRec),    icon: TrendingUp,    variant: "success" },
        { label: "Total Issued",       value: formatNumber(totalIss),    icon: TrendingDown,  variant: "danger" },
        { label: "Total Transactions", value: formatNumber(totalTx),     icon: Activity,      variant: "purple" },
      ];
    }
    case "audit":
      return [{ label: "Log Entries", value: formatNumber(data.length), icon: ShieldCheck, variant: "info" }];
    case "abc": {
      const aItems     = data.filter((r) => r.classification === "A").length;
      const bItems     = data.filter((r) => r.classification === "B").length;
      const cItems     = data.filter((r) => r.classification === "C").length;
      const totalValue = data.reduce((s, r) => s + Number(r.annual_consumption_value), 0);
      return [
        { label: "A Items (Strategic)", value: formatNumber(aItems),       icon: TrendingUp,    variant: "success" },
        { label: "B Items (Important)", value: formatNumber(bItems),       icon: Activity,      variant: "warning" },
        { label: "C Items (Routine)",   value: formatNumber(cItems),       icon: PackageSearch, variant: "info" },
        { label: "Annual Consumption",  value: formatCurrency(totalValue), icon: DollarSign,    variant: "purple" },
      ];
    }
    default:
      return [];
  }
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const roleId = session?.user?.role_id ?? 0;

  const allowedReports = REPORT_TYPES.filter(
    (rt) => REPORT_ACCESS[rt.key]?.includes(roleId)
  );

  const [activeType,  setActiveType]  = useState("");
  const [reportData,  setReportData]  = useState<Record<string, unknown>[]>([]);
  const [categories,  setCategories]  = useState<string[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [filters,     setFilters]     = useState({
    dateFrom: "", dateTo: "", category: "", groupBy: "month" as "week" | "month",
  });
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    if (allowedReports.length > 0 && !activeType) setActiveType(allowedReports[0].key);
  }, [allowedReports, activeType]);

  const fetchReport = useCallback(async (type: string, f?: typeof filters) => {
    if (!type) return;
    setLoading(true);
    try {
      const appliedFilters = f ?? filters;
      const params = new URLSearchParams();
      if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
      if (appliedFilters.dateTo)   params.set("dateTo",   appliedFilters.dateTo);
      if (appliedFilters.category) params.set("category", appliedFilters.category);
      if (appliedFilters.groupBy)  params.set("groupBy",  appliedFilters.groupBy);
      const res = await fetch(`/api/reports/${type}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setReportData(json.data ?? []);
      setCategories(json.categories ?? []);
      setGeneratedAt(json.generatedAt ?? null);
    } catch (err) {
      console.error("Report fetch error:", err);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (activeType) fetchReport(activeType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType]);

  const handleFilterApply = (f: typeof filters) => { setFilters(f); fetchReport(activeType, f); };
  const handleTypeChange  = (key: string) => { setActiveType(key); setReportData([]); setGeneratedAt(null); };

  const activeReport       = REPORT_TYPES.find((r) => r.key === activeType);
  const kpis               = getKPIs(activeType, reportData);
  const showDateFilters    = ["movement", "usage", "summary"].includes(activeType);
  const showCategoryFilter = ["valuation", "stock", "abc"].includes(activeType);
  const showGroupBy        = activeType === "summary";

  if (!session) {
    return (
      <div className="app-layout"><Sidebar />
        <main className="main-content">
          <div className="report-loading-full"><Loader2 className="spin" size={32} /><p>Loading session…</p></div>
        </main>
      </div>
    );
  }

  if (allowedReports.length === 0) {
    return (
      <div className="app-layout"><Sidebar />
        <main className="main-content">
          <div className="page-header"><div><h1>Reports &amp; Export</h1><p>Data Export and Reporting</p></div></div>
          <div className="report-no-access">
            <ShieldCheck size={48} />
            <h2>Access Restricted</h2>
            <p>Your role does not have permission to view any reports.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Reports &amp; Export</h1>
            <p>Generate, preview, and export inventory reports</p>
          </div>
          {generatedAt && (
            <div className="report-generated-badge">
              <Activity size={14} />
              Generated {new Date(generatedAt).toLocaleString("en-MY")}
            </div>
          )}
        </div>

        <div className="report-type-grid">
          {allowedReports.map((rt) => {
            const Icon = rt.icon;
            const isActive = activeType === rt.key;
            return (
              <button key={rt.key} id={`report-type-${rt.key}`}
                className={`report-type-card ${isActive ? "active" : ""}`}
                onClick={() => handleTypeChange(rt.key)}
              >
                <div className={`report-type-icon ${rt.gradient}`}><Icon size={20} /></div>
                <div className="report-type-info">
                  <span className="report-type-label">{rt.label}</span>
                  <span className="report-type-desc">{rt.description}</span>
                </div>
              </button>
            );
          })}
        </div>

        {activeReport && (
          <div className="report-section" key={activeType}>
            <div className="report-section-header">
              <div className="report-section-title">
                <FileBarChart size={22} />
                <div><h2>{REPORT_TITLES[activeType]}</h2><p>{activeReport.description}</p></div>
              </div>
              <ExportButtons
                reportType={activeType}
                reportTitle={REPORT_TITLES[activeType]}
                data={reportData}
                filters={filters}
                disabled={loading || !reportData.length}
              />
            </div>

            {(showDateFilters || showCategoryFilter || showGroupBy) && (
              <ReportFilters
                categories={showCategoryFilter ? categories : []}
                showGroupBy={showGroupBy}
                onFilter={handleFilterApply}
              />
            )}

            {kpis.length > 0 && !loading && (
              <div className="report-kpi-grid">
                {kpis.map((kpi) => {
                  const KIcon = kpi.icon;
                  return (
                    <div key={kpi.label} className="report-kpi-card">
                      <div className={`report-kpi-icon ${kpi.variant}`}><KIcon size={18} /></div>
                      <div className="report-kpi-data">
                        <span className="report-kpi-value">{kpi.value}</span>
                        <span className="report-kpi-label">{kpi.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <ReportPreview reportType={activeType} data={reportData} loading={loading} />
          </div>
        )}
      </main>
    </div>
  );
}