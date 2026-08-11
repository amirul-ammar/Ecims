import { NextRequest, NextResponse } from "next/server";
import { getAllParts, createPart } from "@/lib/data-ingestion";
import { requireRole, PARTS_MANAGEMENT_ROLES } from "@/lib/rbac";

/**
 * GET /api/parts — Fetch all parts with stock info.
 */
export async function GET() {
  try {
    const parts = await getAllParts();
    return NextResponse.json(parts);
  } catch (error) {
    console.error("Parts fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch parts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/parts — Create a new part.
 * Requires role: Inventory Controller (2).
 */
export async function POST(request: NextRequest) {
  const denied = await requireRole(PARTS_MANAGEMENT_ROLES);
  if (denied) return denied;

  try {
    const body = await request.json();
    const part = await createPart(body);
    return NextResponse.json(part, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint")) {
        return NextResponse.json(
          { error: "A part with this SKU already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create part" },
      { status: 500 }
    );
  }
}