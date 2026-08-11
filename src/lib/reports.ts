import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  partId?: number;
};

/* ═══════════════════════════════════════════════════════
   INVENTORY VALUATION
   Admin + Inventory Controller
   ═══════════════════════════════════════════════════════ */
export type ValuationRow = {
  part_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  total_stock: number;
  total_value: number;
  lot_count: number;
};

export async function getInventoryValuationReport(
  filters: ReportFilters = {}
): Promise<ValuationRow[]> {
  const categoryFilter = filters.category
    ? Prisma.sql`WHERE p.category = ${filters.category}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<ValuationRow[]>`
    SELECT
      p.id as part_id, p.sku, p.name, p.category, p.unit,
      CAST(p.price AS REAL) as price,
      COALESCE(SUM(l.quantity), 0) as total_stock,
      COALESCE(SUM(l.quantity * p.price), 0) as total_value,
      COUNT(DISTINCT l.id) as lot_count
    FROM parts p
    LEFT JOIN lots l ON l.part_id = p.id
    ${categoryFilter}
    GROUP BY p.id
    ORDER BY total_value DESC
  `;
  return rows.map((r) => ({
    ...r,
    price: Number(r.price),
    total_stock: Number(r.total_stock),
    total_value: Number(r.total_value),
    lot_count: Number(r.lot_count),
  }));
}

/* ═══════════════════════════════════════════════════════
   STOCK LEVELS
   Admin + Inventory Controller
   ═══════════════════════════════════════════════════════ */
export type StockLevelRow = {
  part_id: number;
  sku: string;
  name: string;
  category: string;
  min_stock: number;
  current_stock: number;
  status: string;
  deficit: number;
};

export async function getStockLevelsReport(
  filters: ReportFilters = {}
): Promise<StockLevelRow[]> {
  const rows = await prisma.$queryRaw<StockLevelRow[]>`
    SELECT
      p.id as part_id, p.sku, p.name, p.category,
      p.min_stock,
      COALESCE(SUM(l.quantity), 0) as current_stock,
      CASE
        WHEN COALESCE(SUM(l.quantity), 0) = 0 THEN 'Out of Stock'
        WHEN COALESCE(SUM(l.quantity), 0) <= p.min_stock THEN 'Low Stock'
        ELSE 'Sufficient Stock'
      END as status,
      GREATEST(p.min_stock - COALESCE(SUM(l.quantity), 0), 0) as deficit

    FROM parts p
    LEFT JOIN lots l ON l.part_id = p.id
    GROUP BY p.id
    ORDER BY status ASC, deficit DESC
  `;
  return rows.map((r) => ({
    ...r,
    current_stock: Number(r.current_stock),
    deficit: Number(r.deficit),
  }));
}

/* ═══════════════════════════════════════════════════════
   PRODUCT MOVEMENT
   Admin + Inventory Controller + Engineering
   ═══════════════════════════════════════════════════════ */
export type MovementRow = {
  id: number;
  created_at: Date;
  part_sku: string;
  part_name: string;
  category: string;
  transaction_type: string;
  quantity: number;
  user_name: string;
  location_name: string;
  lot_number: string | null;
};

export async function getProductMovementReport(
  filters: ReportFilters = {}
): Promise<MovementRow[]> {
  const dateFrom = filters.dateFrom || "2000-01-01";
  const dateTo = filters.dateTo || "2099-12-31";
  const partFilter = filters.partId
    ? Prisma.sql`AND t.part_id = ${filters.partId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<MovementRow[]>`
    SELECT
      t.id, t.created_at,
      p.sku as part_sku, p.name as part_name, p.category,
      t.transaction_type, t.quantity,
      u.name as user_name,
      COALESCE(fl.name, tl.name, '-') as location_name,
      l.lot_number
    FROM inventory_transactions t
    JOIN parts p ON p.id = t.part_id
    JOIN users u ON u.id = t.user_id
    LEFT JOIN lots l ON l.id = t.lot_id
    LEFT JOIN locations fl ON fl.id = t.from_location_id
    LEFT JOIN locations tl ON tl.id = t.to_location_id
    WHERE t.created_at >= ${dateFrom}
      AND t.created_at <= ${dateTo}
      ${partFilter}
    ORDER BY t.created_at DESC
    LIMIT 500
  `;
  return rows;
}

/* ═══════════════════════════════════════════════════════
   COMPONENT USAGE ANALYSIS
   Admin + Engineering
   ═══════════════════════════════════════════════════════ */
export type UsageRow = {
  part_id: number;
  sku: string;
  name: string;
  category: string;
  total_issued: number;
  total_received: number;
  transaction_count: number;
  last_activity: Date;
};

export async function getComponentUsageReport(
  filters: ReportFilters = {}
): Promise<UsageRow[]> {
  const dateFrom = filters.dateFrom || "2000-01-01";
  const dateTo = filters.dateTo || "2099-12-31";
  const rows = await prisma.$queryRaw<UsageRow[]>`
    SELECT
      p.id as part_id, p.sku, p.name, p.category,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'issue' THEN t.quantity ELSE 0 END), 0) as total_issued,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'receive' THEN t.quantity ELSE 0 END), 0) as total_received,
      COUNT(t.id) as transaction_count,
      MAX(t.created_at) as last_activity
    FROM parts p
    LEFT JOIN inventory_transactions t ON t.part_id = p.id
      AND t.created_at >= ${dateFrom}
      AND t.created_at <= ${dateTo}
    GROUP BY p.id
    ORDER BY total_issued DESC
  `;
  return rows.map((r) => ({
    ...r,
    total_issued: Number(r.total_issued),
    total_received: Number(r.total_received),
    transaction_count: Number(r.transaction_count),
  }));
}

/* ═══════════════════════════════════════════════════════
   MONTHLY SUMMARY
   Admin + Inventory Controller
   ═══════════════════════════════════════════════════════ */
export type SummaryRow = {
  period: string;
  total_received: number;
  total_issued: number;
  net_movement: number;
  transaction_count: number;
};

export async function getMonthlySummaryReport(
  filters: ReportFilters = {},
  groupBy: "week" | "month" = "month"
): Promise<SummaryRow[]> {
  const dateFrom = filters.dateFrom || "2000-01-01";
  const dateTo = filters.dateTo || "2099-12-31";
  const fmt = groupBy === "week" ? "%Y-W%W" : "%Y-%m";
  const rows = await prisma.$queryRaw<SummaryRow[]>`
   SELECT
  DATE_FORMAT(created_at, ${fmt}) as period,
  SUM(CASE WHEN transaction_type = 'receive' THEN quantity ELSE 0 END) as total_received,
  SUM(CASE WHEN transaction_type = 'issue' THEN quantity ELSE 0 END) as total_issued,
  SUM(CASE WHEN transaction_type = 'receive' THEN quantity ELSE -quantity END) as net_movement,
  COUNT(*) as transaction_count
FROM inventory_transactions
WHERE created_at >= ${dateFrom} AND created_at <= ${dateTo}
GROUP BY period
ORDER BY period ASC
  `;
  return rows.map((r) => ({
    ...r,
    total_received: Number(r.total_received),
    total_issued: Number(r.total_issued),
    net_movement: Number(r.net_movement),
    transaction_count: Number(r.transaction_count),
  }));
}

/* ═══════════════════════════════════════════════════════
   AUDIT LOG
   Admin only
   ═══════════════════════════════════════════════════════ */
export type AuditLogRow = {
  id: number;
  user_name: string;
  user_email: string;
  report_type: string;
  export_format: string | null;
  filters: string | null;
  created_at: Date;
};

export async function getAuditLogReport(): Promise<AuditLogRow[]> {
  const rows = await prisma.$queryRaw<AuditLogRow[]>`
    SELECT
      a.id, u.name as user_name, u.email as user_email,
      a.report_type, a.export_format, a.filters, a.created_at
    FROM report_audit_log a
    JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT 500
  `;
  return rows;
}

/* ═══════════════════════════════════════════════════════
   ABC ANALYSIS
   Admin + Inventory Controller
   ═══════════════════════════════════════════════════════ */
export type ABCAnalysisRow = {
  part_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  total_stock: number;
  total_value: number;
  annual_consumption_value: number;
  monthly_velocity: number;
  turnover_ratio: number;
  classification: 'A' | 'B' | 'C';
  cumulative_value_percent: number;
};

export async function getABCAnalysisReport(): Promise<ABCAnalysisRow[]> {
  const { getABCAnalysis } = await import("@/lib/data-ingestion");
  return getABCAnalysis();
}

/* ═══════════════════════════════════════════════════════
   HELPER — distinct categories for filter dropdown
   ═══════════════════════════════════════════════════════ */
export async function getCategories(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ category: string }[]>`
    SELECT DISTINCT category FROM parts ORDER BY category ASC
  `;
  return rows.map((r) => r.category);
}
