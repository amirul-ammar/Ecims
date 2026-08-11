import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { REPORT_ACCESS } from "@/lib/rbac";
import {
  getInventoryValuationReport,
  getStockLevelsReport,
  getProductMovementReport,
  getComponentUsageReport,
  getMonthlySummaryReport,
  getAuditLogReport,
  getABCAnalysisReport,
  getCategories,
  type ReportFilters,
} from "@/lib/reports";
import prisma from "@/lib/prisma";

/**
 * GET /api/reports/[type]
 * Returns report data JSON for the given report type.
 * Enforces RBAC per REPORT_ACCESS matrix.
 * Query params: dateFrom, dateTo, category, partId, groupBy
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await params;
  const allowedRoles = REPORT_ACCESS[type];
  if (!allowedRoles) {
    return NextResponse.json({ error: "Unknown report type" }, { status: 404 });
  }
  if (!allowedRoles.includes(session.user.role_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filters: ReportFilters = {
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    partId: searchParams.get("partId") ? Number(searchParams.get("partId")) : undefined,
  };
  const groupBy = (searchParams.get("groupBy") as "week" | "month") || "month";

  try {
    let data: unknown;
    let categories: string[] | undefined;

    switch (type) {
      case "valuation":
        data = await getInventoryValuationReport(filters);
        categories = await getCategories();
        break;
      case "stock":
        data = await getStockLevelsReport(filters);
        categories = await getCategories();
        break;
      case "movement":
        data = await getProductMovementReport(filters);
        break;
      case "usage":
        data = await getComponentUsageReport(filters);
        break;
      case "summary":
        data = await getMonthlySummaryReport(filters, groupBy);
        break;
      case "audit":
        data = await getAuditLogReport();
        break;
      case "abc":
        data = await getABCAnalysisReport();
        categories = await getCategories();
        break;
      default:
        return NextResponse.json({ error: "Unknown report type" }, { status: 404 });
    }

    // Log the preview action in audit log
    await prisma.reportAuditLog.create({
      data: {
        user_id: session.user.id,
        report_type: type,
        export_format: "preview",
        filters: JSON.stringify(filters),
      },
    });

    return NextResponse.json({ data, categories, type, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(`Report error [${type}]:`, err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
