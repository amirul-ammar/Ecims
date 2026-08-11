import { NextRequest, NextResponse } from "next/server";
import { issueStock } from "@/lib/data-ingestion";
import { requireRole, STOCK_MUTATION_ROLES } from "@/lib/rbac";

/**
 * POST /api/transactions/issue — Issue stock from inventory.
 * Implements FEFO algorithm with override detection.
 * Requires roles: Inventory Controller (2), Warehouse (3).
 * Admin (1) and Engineering (4) are blocked.
 */
export async function POST(request: NextRequest) {
  const denied = await requireRole(STOCK_MUTATION_ROLES);
  if (denied) return denied;

  try {
    const body = await request.json();
    const result = await issueStock(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to issue stock" },
      { status: 500 }
    );
  }
}
