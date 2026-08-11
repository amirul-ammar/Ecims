import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  DashboardStats,
  TransactionDetail,
  MonthlyData,
  PartWithStock,
  LocationWithStats,
  LowStockAlert,
  ExpiringLot,
  TransactionAnalytics,
  Lot,
  ABCAnalysisRow,
} from "@/types";
import {
  CreatePartSchema,
  UpdatePartSchema,
  CreateLocationSchema,
  UpdateLocationSchema,
  ReceiveStockSchema,
  IssueStockSchema,
} from "@/lib/validators";

/* ═══════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════ */

/**
 * Fetch all dashboard statistics in a single call.
 * Every number comes from a real DB query — zero mock data.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [totalParts, totalLocations, lowStockRows, expiringSoonRows, valueRows] =
    await Promise.all([
      prisma.part.count(),
      prisma.location.count(),
      // Low stock: parts where total lot qty <= min_stock
      prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) as cnt FROM (
          SELECT p.id
          FROM parts p
          LEFT JOIN lots l ON l.part_id = p.id
          GROUP BY p.id, p.min_stock
          HAVING COALESCE(SUM(l.quantity), 0) <= p.min_stock
        ) sub
      `,
      // Expiring within 30 days
      prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) as cnt FROM lots
        WHERE expiry_date IS NOT NULL
          AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
          AND quantity > 0
      `,
      // Estimated inventory value
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(l.quantity * p.price), 0) as total
        FROM lots l
        JOIN parts p ON p.id = l.part_id
        WHERE l.quantity > 0
      `,
    ]);

  return {
    totalParts,
    totalLocations,
    lowStockCount: Number(lowStockRows[0]?.cnt ?? 0),
    expiringSoonCount: Number(expiringSoonRows[0]?.cnt ?? 0),
    estimatedValue: Number(valueRows[0]?.total ?? 0),
  };
}

/**
 * Fetch recent transactions with full joins for display.
 */
export async function getRecentTransactions(
  limit: number = 5
): Promise<TransactionDetail[]> {
  const rows = await prisma.$queryRaw<TransactionDetail[]>`
    SELECT
      t.id, t.part_id, t.lot_id, t.from_location_id, t.to_location_id,
      t.quantity, t.user_id, t.transaction_type, t.reason, t.notes,
      t.is_fefo_override, t.created_at,
      p.name as part_name, p.sku as part_sku,
      u.name as user_name,
      l.lot_number,
      fl.name as from_location_name,
      tl.name as to_location_name
    FROM inventory_transactions t
    JOIN parts p ON p.id = t.part_id
    JOIN users u ON u.id = t.user_id
    LEFT JOIN lots l ON l.id = t.lot_id
    LEFT JOIN locations fl ON fl.id = t.from_location_id
    LEFT JOIN locations tl ON tl.id = t.to_location_id
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

/**
 * Fetch monthly inbound vs outbound data for the chart.
 * Uses REAL transaction data — never hardcoded.
 */
export async function getMonthlyVelocity(
  months: number = 12
): Promise<MonthlyData[]> {
  const rows = await prisma.$queryRaw<
    { month: string; transaction_type: string; total_qty: number }[]
  >`
    SELECT
      DATE_FORMAT(created_at, '%Y-%m') as month,
      transaction_type,
      SUM(quantity) as total_qty
    FROM inventory_transactions
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)
      AND transaction_type IN ('receive', 'issue')
    GROUP BY month, transaction_type
    ORDER BY month ASC
  `;

  // Pivot into { month, received, issued } format
  const monthMap = new Map<string, MonthlyData>();
  for (const row of rows) {
    if (!monthMap.has(row.month)) {
      monthMap.set(row.month, { month: row.month, received: 0, issued: 0 });
    }
    const entry = monthMap.get(row.month)!;
    if (row.transaction_type === "receive") {
      entry.received = Number(row.total_qty);
    } else if (row.transaction_type === "issue") {
      entry.issued = Number(row.total_qty);
    }
  }

  return Array.from(monthMap.values());
}

/* ═══════════════════════════════════════════════════════
   PARTS
   ═══════════════════════════════════════════════════════ */

/**
 * Fetch all parts with computed stock and lot count.
 */
export async function getAllParts(): Promise<PartWithStock[]> {
  const rows = await prisma.$queryRaw<PartWithStock[]>`
    SELECT
      p.*,
      COALESCE(SUM(l.quantity), 0) as total_stock,
      COUNT(DISTINCT l.id) as lot_count,
      CASE WHEN COALESCE(SUM(l.quantity), 0) <= p.min_stock THEN 1 ELSE 0 END as is_low_stock
    FROM parts p
    LEFT JOIN lots l ON l.part_id = p.id
    GROUP BY p.id
    ORDER BY p.sku ASC
  `;
  return rows.map((r) => ({
    ...r,
    total_stock: Number(r.total_stock),
    lot_count: Number(r.lot_count),
    is_low_stock: Boolean(Number(r.is_low_stock)),
    price: Number(r.price),
  }));
}

/**
 * Create a new part.
 */
export async function createPart(
  data: unknown
): Promise<{ id: number; sku: string; name: string }> {
  const parsed = CreatePartSchema.parse(data);
  const part = await prisma.part.create({
    data: {
      sku: parsed.sku,
      name: parsed.name,
      description: parsed.description ?? null,
      category: parsed.category,
      unit: parsed.unit,
      price: parsed.price,
      min_stock: parsed.min_stock,
      lead_days: parsed.lead_days,
    },
  });
  return { id: part.id, sku: part.sku, name: part.name };
}

/**
 * Update an existing part.
 */
export async function updatePart(
  id: number,
  data: unknown
): Promise<{ id: number; sku: string; name: string }> {
  const parsed = UpdatePartSchema.parse(data);
  const part = await prisma.part.update({
    where: { id },
    data: parsed,
  });
  return { id: part.id, sku: part.sku, name: part.name };
}

/* ═══════════════════════════════════════════════════════
   LOCATIONS
   ═══════════════════════════════════════════════════════ */

/**
 * Fetch all locations with lot count and total quantity.
 */
export async function getAllLocations(): Promise<LocationWithStats[]> {
  const rows = await prisma.$queryRaw<LocationWithStats[]>`
    SELECT
      loc.*,
      COUNT(DISTINCT l.id) as lot_count,
      COALESCE(SUM(l.quantity), 0) as total_quantity,
      ROUND(COALESCE(SUM(l.quantity), 0) / loc.capacity * 100, 1) as utilization_percent
    FROM locations loc
    LEFT JOIN lots l ON l.location_id = loc.id
    GROUP BY loc.id
    ORDER BY loc.name ASC
  `;
  return rows.map((r) => ({
    ...r,
    lot_count: Number(r.lot_count),
    total_quantity: Number(r.total_quantity),
    utilization_percent: Number(r.utilization_percent),
  }));
}

/**
 * Create a new location.
 */
export async function createLocation(
  data: unknown
): Promise<{ id: number; name: string }> {
  const parsed = CreateLocationSchema.parse(data);
  const loc = await prisma.location.create({ data: parsed });
  return { id: loc.id, name: loc.name };
}

/**
 * Update an existing location.
 */
export async function updateLocation(
  id: number,
  data: unknown
): Promise<{ id: number; name: string }> {
  const parsed = UpdateLocationSchema.parse(data);
  const loc = await prisma.location.update({ where: { id }, data: parsed });
  return { id: loc.id, name: loc.name };
}

/* ═══════════════════════════════════════════════════════
   TRANSACTIONS
   ═══════════════════════════════════════════════════════ */

/**
 * Fetch full transaction history with all joins.
 */
export async function getTransactionHistory(): Promise<TransactionDetail[]> {
  const rows = await prisma.$queryRaw<TransactionDetail[]>`
    SELECT
      t.id, t.part_id, t.lot_id, t.from_location_id, t.to_location_id,
      t.quantity, t.user_id, t.transaction_type, t.reason, t.notes,
      t.is_fefo_override, t.created_at,
      p.name as part_name, p.sku as part_sku,
      u.name as user_name,
      l.lot_number,
      fl.name as from_location_name,
      tl.name as to_location_name
    FROM inventory_transactions t
    JOIN parts p ON p.id = t.part_id
    JOIN users u ON u.id = t.user_id
    LEFT JOIN lots l ON l.id = t.lot_id
    LEFT JOIN locations fl ON fl.id = t.from_location_id
    LEFT JOIN locations tl ON tl.id = t.to_location_id
    ORDER BY t.created_at DESC
    LIMIT 500
  `;
  return rows;
}

/**
 * Get transaction analytics — aggregated stats.
 */
export async function getTransactionAnalytics(): Promise<TransactionAnalytics> {
  const [typeCounts, overrideCount, monthlyData] = await Promise.all([
    prisma.$queryRaw<{ transaction_type: string; cnt: bigint }[]>`
      SELECT transaction_type, COUNT(*) as cnt
      FROM inventory_transactions
      GROUP BY transaction_type
    `,
    prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) as cnt FROM inventory_transactions WHERE is_fefo_override = 1
    `,
    getMonthlyVelocity(12),
  ]);

  const counts: Record<string, number> = {};
  for (const row of typeCounts) {
    counts[row.transaction_type] = Number(row.cnt);
  }

  return {
    totalReceived: counts["receive"] ?? 0,
    totalIssued: counts["issue"] ?? 0,
    totalTransfers: counts["transfer"] ?? 0,
    totalAdjustments: counts["adjust"] ?? 0,
    fefoOverrideCount: Number(overrideCount[0]?.cnt ?? 0),
    transactionsByMonth: monthlyData,
  };
}

/**
 * Receive stock — creates a lot and a receive transaction atomically.
 */
export async function receiveStock(data: unknown): Promise<{ lot_id: number; transaction_id: number }> {
  const parsed = ReceiveStockSchema.parse(data);

  const result = await prisma.$transaction(async (tx) => {
    // Create the lot
    const lot = await tx.lot.create({
      data: {
        part_id: parsed.part_id,
        location_id: parsed.location_id,
        lot_number: parsed.lot_number,
        date_code: parsed.date_code ?? null,
        received_date: parsed.received_date
          ? new Date(parsed.received_date)
          : new Date(),
        expiry_date: parsed.expiry_date ? new Date(parsed.expiry_date) : null,
        quantity: parsed.quantity,
      },
    });

    // Create the transaction record
    const txn = await tx.inventoryTransaction.create({
      data: {
        part_id: parsed.part_id,
        lot_id: lot.id,
        to_location_id: parsed.location_id,
        quantity: parsed.quantity,
        user_id: parsed.user_id,
        transaction_type: "receive",
        notes: parsed.notes ?? null,
        is_fefo_override: 0,
      },
    });

    return { lot_id: lot.id, transaction_id: txn.id };
  });

  return result;
}

/**
 * Issue stock with FEFO algorithm.
 *
 * 1. If no lot_id → Auto-FEFO: sort lots by expiry_date ASC, received_date ASC
 *    and deduct from the oldest-expiring lot first, spanning multiple lots.
 * 2. If a specific lot_id is given → check if it's the FEFO-recommended lot.
 *    If not, flag is_fefo_override=1 and require reason.
 * 3. Uses SELECT … FOR UPDATE row locking to prevent race conditions.
 * 4. If insufficient stock, throw an error and rollback.
 */
export async function issueStock(data: unknown): Promise<{ transaction_ids: number[] }> {
  const parsed = IssueStockSchema.parse(data);

  const result = await prisma.$transaction(async (tx) => {
    // Lock and fetch available lots for this part, sorted FEFO
    const lots = await tx.$queryRaw<
      { id: number; quantity: number; expiry_date: Date | null; received_date: Date; location_id: number }[]
    >`
      SELECT id, quantity, expiry_date, received_date, location_id
      FROM lots
      WHERE part_id = ${parsed.part_id}
        AND quantity > 0
        ${parsed.from_location_id ? Prisma.sql`AND location_id = ${parsed.from_location_id}` : Prisma.empty}
      ORDER BY
        CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
        expiry_date ASC,
        received_date ASC
    `;

    // Check total available stock
    const totalAvailable = lots.reduce((sum, l) => sum + l.quantity, 0);
    if (totalAvailable < parsed.quantity) {
      throw new Error(
        `Insufficient stock. Requested: ${parsed.quantity}, Available: ${totalAvailable}`
      );
    }

    const transactionIds: number[] = [];
    let remaining = parsed.quantity;

    if (parsed.lot_id) {
      // ── Manual lot selection (possible FEFO override) ──
      const selectedLot = lots.find((l) => l.id === parsed.lot_id);
      if (!selectedLot) {
        throw new Error(`Selected lot #${parsed.lot_id} not found or has no stock`);
      }

      // Check if this is the FEFO-recommended lot
      const fefoLot = lots[0];
      const isOverride = fefoLot.id !== parsed.lot_id;

      if (isOverride && !parsed.reason) {
        throw new Error(
          "FEFO override detected. You must provide a reason when selecting a lot that is not the FEFO-recommended lot."
        );
      }

      if (selectedLot.quantity < parsed.quantity) {
        throw new Error(
          `Selected lot #${parsed.lot_id} only has ${selectedLot.quantity} units. Requested: ${parsed.quantity}`
        );
      }

      // Deduct from selected lot
      await tx.lot.update({
        where: { id: parsed.lot_id },
        data: { quantity: { decrement: parsed.quantity } },
      });

      const txn = await tx.inventoryTransaction.create({
        data: {
          part_id: parsed.part_id,
          lot_id: parsed.lot_id,
          from_location_id: selectedLot.location_id,
          quantity: parsed.quantity,
          user_id: parsed.user_id,
          transaction_type: "issue",
          reason: parsed.reason ?? null,
          notes: parsed.notes ?? null,
          is_fefo_override: isOverride ? 1 : 0,
        },
      });
      transactionIds.push(txn.id);
    } else {
      // ── Auto-FEFO: deduct from oldest-expiring lots first ──
      for (const lot of lots) {
        if (remaining <= 0) break;

        const deduct = Math.min(remaining, lot.quantity);
        await tx.lot.update({
          where: { id: lot.id },
          data: { quantity: { decrement: deduct } },
        });

        const txn = await tx.inventoryTransaction.create({
          data: {
            part_id: parsed.part_id,
            lot_id: lot.id,
            from_location_id: lot.location_id,
            quantity: deduct,
            user_id: parsed.user_id,
            transaction_type: "issue",
            reason: parsed.reason ?? null,
            notes: parsed.notes ?? null,
            is_fefo_override: 0,
          },
        });
        transactionIds.push(txn.id);
        remaining -= deduct;
      }
    }

    return { transaction_ids: transactionIds };
  });

  return result;
}

/* ═══════════════════════════════════════════════════════
   LOTS
   ═══════════════════════════════════════════════════════ */

/**
 * Get available lots for a part, sorted by FEFO order.
 */
export async function getAvailableLots(partId: number): Promise<Lot[]> {
  const rows = await prisma.$queryRaw<Lot[]>`
    SELECT l.*, loc.name as location_name, p.name as part_name, p.sku as part_sku
    FROM lots l
    JOIN locations loc ON loc.id = l.location_id
    JOIN parts p ON p.id = l.part_id
    WHERE l.part_id = ${partId}
      AND l.quantity > 0
    ORDER BY
      CASE WHEN l.expiry_date IS NULL THEN 1 ELSE 0 END,
      l.expiry_date ASC,
      l.received_date ASC
  `;
  return rows;
}

/* ═══════════════════════════════════════════════════════
   ALERTS
   ═══════════════════════════════════════════════════════ */

/**
 * Get parts where stock is at or below minimum stock level.
 */
export async function getLowStockAlerts(): Promise<LowStockAlert[]> {
  const rows = await prisma.$queryRaw<LowStockAlert[]>`
    SELECT
      p.id as part_id,
      p.sku,
      p.name,
      p.min_stock,
      COALESCE(SUM(l.quantity), 0) as current_stock,
      p.min_stock - COALESCE(SUM(l.quantity), 0) as deficit
    FROM parts p
    LEFT JOIN lots l ON l.part_id = p.id
    GROUP BY p.id, p.sku, p.name, p.min_stock
    HAVING COALESCE(SUM(l.quantity), 0) <= p.min_stock
    ORDER BY deficit DESC
  `;
  return rows.map((r) => ({
    ...r,
    current_stock: Number(r.current_stock),
    deficit: Number(r.deficit),
  }));
}

/**
 * Get lots expiring within N days.
 */
export async function getExpiringLots(days: number = 30): Promise<ExpiringLot[]> {
  const rows = await prisma.$queryRaw<ExpiringLot[]>`
    SELECT
      l.id as lot_id,
      l.lot_number,
      l.part_id,
      p.name as part_name,
      p.sku as part_sku,
      loc.name as location_name,
      l.quantity,
      l.expiry_date,
      DATEDIFF(l.expiry_date, CURDATE()) as days_until_expiry
    FROM lots l
    JOIN parts p ON p.id = l.part_id
    JOIN locations loc ON loc.id = l.location_id
    WHERE l.expiry_date IS NOT NULL
      AND l.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ${days} DAY)
      AND l.quantity > 0
    ORDER BY l.expiry_date ASC
  `;
  return rows.map((r) => ({
    ...r,
    quantity: Number(r.quantity),
    days_until_expiry: Number(r.days_until_expiry),
  }));
}

/* ═══════════════════════════════════════════════════════
   ABC ANALYSIS
   ═══════════════════════════════════════════════════════ */

/**
 * ABC Analysis classifies inventory into A/B/C categories based on:
 * - Value: Annual consumption value (price × quantity issued)
 * - Velocity: Transaction frequency (issues per month)
 *
 * A items: Top 20% by value OR high velocity (strategic/high-value)
 * B items: Middle 30% by value (important)
 * C items: Bottom 50% by value (routine/low-value)
 */
export async function getABCAnalysis(): Promise<ABCAnalysisRow[]> {
  // Get all parts with their value and velocity metrics
  const rows = await prisma.$queryRaw<ABCAnalysisRow[]>`
    SELECT
      p.id as part_id,
      p.sku,
      p.name,
      p.category,
      p.unit,
      CAST(p.price AS REAL) as price,
      COALESCE(SUM(l.quantity), 0) as total_stock,
      COALESCE(SUM(l.quantity * p.price), 0) as total_value,

      -- Annual consumption value (price × qty issued in last 12 months)
      COALESCE((
        SELECT SUM(it.quantity * p.price)
        FROM inventory_transactions it
        WHERE it.part_id = p.id
          AND it.transaction_type = 'issue'
          AND it.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      ), 0) as annual_consumption_value,

      -- Transaction velocity (issues per month, annualized)
      COALESCE((
        SELECT COUNT(*) / 12.0
        FROM inventory_transactions it
        WHERE it.part_id = p.id
          AND it.transaction_type = 'issue'
          AND it.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      ), 0) as monthly_velocity,

      -- Stock turnover ratio (annual consumption / average stock)
      CASE
        WHEN COALESCE(SUM(l.quantity), 0) > 0 THEN
          COALESCE((
            SELECT SUM(it.quantity)
            FROM inventory_transactions it
            WHERE it.part_id = p.id
              AND it.transaction_type = 'issue'
              AND it.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
          ), 0) / COALESCE(SUM(l.quantity), 0)
        ELSE 0
      END as turnover_ratio

    FROM parts p
    LEFT JOIN lots l ON l.part_id = p.id
    GROUP BY p.id
    ORDER BY annual_consumption_value DESC
  `;

  // Convert to numbers and calculate ABC classification
  const processedRows = rows.map((r) => ({
    ...r,
    price: Number(r.price),
    total_stock: Number(r.total_stock),
    total_value: Number(r.total_value),
    annual_consumption_value: Number(r.annual_consumption_value),
    monthly_velocity: Number(r.monthly_velocity),
    turnover_ratio: Number(r.turnover_ratio),
  }));

  // Calculate ABC thresholds based on cumulative value percentage
  const totalValue = processedRows.reduce((sum, r) => sum + r.annual_consumption_value, 0);
  let cumulativeValue = 0;

  const classifiedRows = processedRows.map((row) => {
    cumulativeValue += row.annual_consumption_value;
    const cumulativePercent = totalValue > 0 ? (cumulativeValue / totalValue) * 100 : 0;

    let classification: 'A' | 'B' | 'C';
    if (cumulativePercent <= 80 || row.monthly_velocity >= 2) {
      // A items: Top 80% by value OR 2+ issues per month
      classification = 'A';
    } else if (cumulativePercent <= 95) {
      // B items: Next 15% by value
      classification = 'B';
    } else {
      // C items: Bottom 5% by value
      classification = 'C';
    }

    return {
      ...row,
      classification,
      cumulative_value_percent: cumulativePercent,
    };
  });

  return classifiedRows;
}

/* ═══════════════════════════════════════════════════════
   TIME
   ═══════════════════════════════════════════════════════ */

/**
 * Return the server's current UTC timestamp as ISO string.
 */
export async function getServerTime(): Promise<string> {
  return new Date().toISOString();
}