import { NextResponse } from "next/server";
import { getLowStockAlerts, getExpiringLots } from "@/lib/data-ingestion";

/**
 * GET /api/alerts — Get low stock and expiring lot alerts.
 */
export async function GET() {
  try {
    const [lowStock, expiring] = await Promise.all([
      getLowStockAlerts(),
      getExpiringLots(30),
    ]);

    return NextResponse.json({
      lowStock,
      expiring,
      totalAlerts: lowStock.length + expiring.length,
    });
  } catch (error) {
    console.error("Alerts fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}
