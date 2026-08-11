import { NextRequest, NextResponse } from "next/server";
import { updateLocation } from "@/lib/data-ingestion";
import { requireRole, LOCATIONS_MANAGEMENT_ROLES } from "@/lib/rbac";
import prisma from "@/lib/prisma";

/**
 * PUT /api/locations/[id] — Update a location.
 * Requires role: Inventory Controller (2).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireRole(LOCATIONS_MANAGEMENT_ROLES);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const location = await updateLocation(parseInt(id), body);
    return NextResponse.json(location);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/locations/[id] — Delete a location.
 * Requires role: Inventory Controller (2).
 * Only allowed if location has no lots stored in it.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireRole(LOCATIONS_MANAGEMENT_ROLES);
  if (denied) return denied;

  try {
    const { id } = await params;
    const locationId = parseInt(id);

    // Check if location has any lots
    const lotCount = await prisma.lot.count({
      where: { location_id: locationId },
    });

    if (lotCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete — this location still has ${lotCount} lot(s) stored in it. Move or issue all stock first.` },
        { status: 400 }
      );
    }

    await prisma.location.delete({ where: { id: locationId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 }
    );
  }
}