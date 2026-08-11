import { NextRequest, NextResponse } from "next/server";
import { getAllLocations, createLocation } from "@/lib/data-ingestion";
import { requireRole, LOCATIONS_MANAGEMENT_ROLES } from "@/lib/rbac";

/**
 * GET /api/locations — Fetch all locations with stats.
 */
export async function GET() {
  try {
    const locations = await getAllLocations();
    return NextResponse.json(locations);
  } catch (error) {
    console.error("Locations fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/locations — Create a new location.
 * Requires role: Inventory Controller (2).
 */
export async function POST(request: NextRequest) {
  const denied = await requireRole(LOCATIONS_MANAGEMENT_ROLES);
  if (denied) return denied;

  try {
    const body = await request.json();
    const location = await createLocation(body);
    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
}
