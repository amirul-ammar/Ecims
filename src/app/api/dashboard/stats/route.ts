import { NextResponse } from "next/server";
import {
  getDashboardStats,
  getRecentTransactions,
  getMonthlyVelocity,
} from "@/lib/data-ingestion";

/**
 * GET /api/dashboard/stats
 * Returns all dashboard statistics, recent transactions, and monthly chart data.
 */
export async function GET() {
  try {
    const [stats, recentTransactions, monthlyData] = await Promise.all([
      getDashboardStats(),
      getRecentTransactions(5),
      getMonthlyVelocity(12),
    ]);

    return NextResponse.json({
      stats,
      recentTransactions,
      monthlyData,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
