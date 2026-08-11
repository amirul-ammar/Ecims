"use client";

import { FileText, Table2 } from "lucide-react";

type Props = {
  reportType: string;
  reportTitle: string;
  data: Record<string, unknown>[];
  filters: Record<string, string>;
  disabled?: boolean;
};

const COLUMN_DEFS: Record<string, { key: string; label: string }[]> = {
  valuation: [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Part Name" },
    { key: "category", label: "Category" },
    { key: "total_stock", label: "Stock" },
    { key: "price", label: "Unit Price (MYR)" },
    { key: "total_value", label: "Total Value (MYR)" },
    { key: "lot_count", label: "Lots" },
  ],
  stock: [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Part Name" },
    { key: "category", label: "Category" },
    { key: "current_stock", label: "Stock" },
    { key: "min_stock", label: "Min Stock" },
    { key: "deficit", label: "Deficit" },
    { key: "status", label: "Status" },
  ],
  movement: [
    { key: "created_at", label: "Date" },
    { key: "part_sku", label: "SKU" },
    { key: "part_name", label: "Part" },
    { key: "transaction_type", label: "Type" },
    { key: "quantity", label: "Qty" },
    { key: "user_name", label: "User" },
    { key: "location_name", label: "Location" },
  ],
  usage: [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Part Name" },
    { key: "category", label: "Category" },
    { key: "total_issued", label: "Total Issued" },
    { key: "total_received", label: "Total Received" },
    { key: "transaction_count", label: "Transactions" },
    { key: "last_activity", label: "Last Activity" },
  ],
  summary: [
    { key: "period", label: "Period" },
    { key: "total_received", label: "Received" },
    { key: "total_issued", label: "Issued" },
    { key: "net_movement", label: "Net Movement" },
    { key: "transaction_count", label: "Transactions" },
  ],
  abc: [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Part Name" },
    { key: "category", label: "Category" },
    { key: "total_stock", label: "Stock" },
    { key: "price", label: "Unit Price (MYR)" },
    { key: "total_value", label: "Stock Value (MYR)" },
    { key: "annual_consumption_value", label: "Annual Consumption (MYR)" },
    { key: "monthly_velocity", label: "Monthly Velocity" },
    { key: "turnover_ratio", label: "Turnover" },
    { key: "classification", label: "Class" },
    { key: "cumulative_value_percent", label: "Cumulative %" },
  ],
  audit: [
    { key: "created_at", label: "Date" },
    { key: "user_name", label: "User" },
    { key: "user_email", label: "Email" },
    { key: "report_type", label: "Report" },
    { key: "export_format", label: "Format" },
  ],
};

async function logExport(reportType: string, format: string, filters: Record<string, string>) {
  await fetch("/api/reports/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report_type: reportType, export_format: format, filters }),
  });
}

export default function ExportButtons({ reportType, reportTitle, data, filters, disabled }: Props) {
  const columns = COLUMN_DEFS[reportType] ?? [];

  const formatValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return "";
    if ((key === "price" || key === "total_value" || key === "annual_consumption_value") && typeof value === "number") {
      return Number(value).toFixed(2);
    }
    if ((key === "monthly_velocity" || key === "turnover_ratio") && typeof value === "number") {
      return Number(value).toFixed(2);
    }
    if (key === "cumulative_value_percent" && typeof value === "number") {
      return `${Number(value).toFixed(1)}%`;
    }
    if (key === "created_at" || key === "last_activity") {
      try { return new Date(value as string).toLocaleDateString("en-GB"); } catch { return String(value); }
    }
    return String(value);
  };

  const exportExcel = async () => {
    const { utils, writeFile } = await import("xlsx");
    const sheetData = [
      columns.map((c) => c.label),
      ...data.map((row) => columns.map((c) => formatValue(c.key, row[c.key]))),
    ];
    const ws = utils.aoa_to_sheet(sheetData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, reportTitle);
    writeFile(wb, `ECIMS_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    await logExport(reportType, "excel", filters);
  };

  const exportPdf = async () => {
    try {
      const rows = data.map((row) =>
        columns.map((c) => formatValue(c.key, row[c.key]))
      );

      const filterLine = filters.dateFrom || filters.dateTo
        ? `<p style="color:#64748b;font-size:10px;margin:2px 0">Period: ${filters.dateFrom || "—"} to ${filters.dateTo || "—"}</p>`
        : "";

      const html = `<!DOCTYPE html>
<html>
<head>
  <title>ECIMS — ${reportTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #0f172a; margin: 0; padding: 0; }
    .header { margin-bottom: 10px; }
    h1 { font-size: 16px; font-weight: bold; margin: 0 0 2px; }
    .meta { color: #64748b; font-size: 9px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background-color: #0f172a; color: #ffffff; }
    thead th { padding: 6px 7px; text-align: left; font-size: 9px; font-weight: bold; white-space: nowrap; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }
    tbody td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
    .footer { margin-top: 10px; font-size: 8px; color: #94a3b8; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ECIMS — ${reportTitle}</h1>
    <div class="meta">
      <p style="margin:0">Generated: ${new Date().toLocaleString("en-MY")} | WHIZZ System Sdn Bhd</p>
      ${filterLine}
    </div>
  </div>
  <table>
    <thead>
      <tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
  <div class="footer">ECIMS &copy; WHIZZ System Sdn Bhd | ${new Date().toLocaleDateString("en-GB")}</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

      const win = window.open("", "_blank", "width=1200,height=800");
      if (!win) {
        alert("Pop-up was blocked. Please allow pop-ups for this site and try again.");
        return;
      }
      win.document.write(html);
      win.document.close();
      await logExport(reportType, "pdf", filters);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("PDF export failed. Please try again.");
    }
  };

  return (
    <div className="export-buttons">
      <button
        id="btn-export-pdf"
        className="btn btn-danger"
        onClick={exportPdf}
        disabled={disabled || !data.length}
        title="Export to PDF"
      >
        <FileText size={16} /> PDF
      </button>
    </div>
  );
}