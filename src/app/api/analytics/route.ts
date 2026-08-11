import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTransactionAnalytics, getABCAnalysis, getLowStockAlerts } from "@/lib/data-ingestion";
import { getStockLevelsReport } from "@/lib/reports";

/**
 * GET /api/analytics
 * Returns all analytics data for the analytics page.
 * Accessible by Admin, Inventory Controller, Engineering.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedRoles = [1, 2, 3, 4]; // Admin, Warehouse, Inventory Controller, Engineering
  if (!allowedRoles.includes(session.user.role_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [analytics, abcData, stockLevels, lowStock] = await Promise.all([
      getTransactionAnalytics(),
      getABCAnalysis(),
      getStockLevelsReport(),
      getLowStockAlerts(),
    ]);

    // Stock health summary
    const stockHealth = {
      ok: stockLevels.filter((s) => s.status === "Sufficient Stock").length,
      low: stockLevels.filter((s) => s.status === "Low Stock").length,
      out: stockLevels.filter((s) => s.status === "Out of Stock").length,
    };

    // ABC summary
    const abcSummary = {
      A: abcData.filter((r) => r.classification === "A").length,
      B: abcData.filter((r) => r.classification === "B").length,
      C: abcData.filter((r) => r.classification === "C").length,
    };

    // FEFO compliance rate
    const totalIssues = analytics.totalIssued;
    const overrides = analytics.fefoOverrideCount;
    const fefoCompliance = totalIssues > 0
      ? Math.round(((totalIssues - overrides) / totalIssues) * 100)
      : 100;

    // Top 5 most issued parts from ABC data (sorted by annual consumption)
    const top5Parts = abcData
      .filter((r) => r.annual_consumption_value > 0)
      .slice(0, 5)
      .map((r) => ({
        sku: r.sku,
        name: r.name,
        annual_consumption_value: r.annual_consumption_value,
        monthly_velocity: r.monthly_velocity,
        classification: r.classification,
      }));

    return NextResponse.json({
      fefoCompliance,
      fefoOverrides: overrides,
      totalIssues,
      stockHealth,
      abcSummary,
      abcData,
      top5Parts,
      monthlyData: analytics.transactionsByMonth,
      totalReceived: analytics.totalReceived,
      totalIssued: analytics.totalIssued,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}