import { NextRequest, NextResponse } from "next/server";
import { receiveStock } from "@/lib/data-ingestion";
import { requireRole, STOCK_MUTATION_ROLES } from "@/lib/rbac";
import prisma from "@/lib/prisma";

/**
 * POST /api/transactions/receive — Receive stock into inventory.
 * Creates a lot and a receive transaction atomically.
 * Requires roles: Inventory Controller (2), Warehouse (3).
 * Blocks if the selected location does not have enough remaining capacity.
 */
export async function POST(request: NextRequest) {
  const denied = await requireRole(STOCK_MUTATION_ROLES);
  if (denied) return denied;

  try {
    const body = await request.json();

    // ── Capacity check before proceeding ──
    if (body.location_id && body.quantity) {
      const location = await prisma.location.findUnique({
        where: { id: parseInt(body.location_id) },
      });

      if (location) {
        // Sum all existing lots in this location
        const stored = await prisma.lot.aggregate({
          where: { location_id: location.id },
          _sum: { quantity: true },
        });

        const currentQty = stored._sum.quantity ?? 0;
        const remainingCapacity = location.capacity - currentQty;

        if (body.quantity > remainingCapacity) {
          return NextResponse.json(
            {
              error: `Location "${location.name}" is full or does not have enough space. Capacity: ${location.capacity}, Currently stored: ${currentQty}, Available space: ${remainingCapacity}, You are trying to add: ${body.quantity}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const result = await receiveStock(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to receive stock" },
      { status: 500 }
    );
  }
}