import { NextRequest, NextResponse } from "next/server";
import { updatePart } from "@/lib/data-ingestion";
import { requireRole, PARTS_MANAGEMENT_ROLES } from "@/lib/rbac";
import prisma from "@/lib/prisma";

/**
 * PUT /api/parts/[id] — Update a part.
 * Requires role: Inventory Controller (2).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireRole(PARTS_MANAGEMENT_ROLES);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const part = await updatePart(parseInt(id), body);
    return NextResponse.json(part);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update part" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/parts/[id] — Delete a part.
 * Requires role: Inventory Controller (2).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireRole(PARTS_MANAGEMENT_ROLES);
  if (denied) return denied;

  try {
    const { id } = await params;
    const partId = parseInt(id);

    // Check if part has any lots with remaining stock
    const lots = await prisma.lot.findMany({
      where: { part_id: partId },
      select: { quantity: true },
    });

    const totalStock = lots.reduce((sum, l) => sum + l.quantity, 0);
    if (totalStock > 0) {
      return NextResponse.json(
        { error: `Cannot delete — this part still has ${totalStock} units in stock. Issue or adjust all stock to zero first.` },
        { status: 400 }
      );
    }

    // Delete transactions, lots, then part
    await prisma.inventoryTransaction.deleteMany({ where: { part_id: partId } });
    await prisma.lot.deleteMany({ where: { part_id: partId } });
    await prisma.request.deleteMany({ where: { part_id: partId } });
    await prisma.part.delete({ where: { id: partId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to delete part" },
      { status: 500 }
    );
  }
}