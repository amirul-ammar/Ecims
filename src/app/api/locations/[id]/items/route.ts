import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/locations/[id]/items
 * Returns all items/parts stored at a location with lot-level detail.
 * Includes summary stats: total items, total quantity, lot count.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const locationId = parseInt(id);

    // Fetch location info
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Fetch all lots at this location with part info
    const items = await prisma.$queryRaw<
      {
        lot_id: number;
        lot_number: string;
        quantity: number;
        received_date: Date;
        expiry_date: Date | null;
        date_code: string | null;
        part_id: number;
        part_sku: string;
        part_name: string;
        category: string;
        unit: string;
        price: number;
      }[]
    >`
      SELECT
        l.id as lot_id,
        l.lot_number,
        l.quantity,
        l.received_date,
        l.expiry_date,
        l.date_code,
        p.id as part_id,
        p.sku as part_sku,
        p.name as part_name,
        p.category,
        p.unit,
        CAST(p.price AS DECIMAL(10,2)) as price
      FROM lots l
      JOIN parts p ON p.id = l.part_id
      WHERE l.location_id = ${locationId}
        AND l.quantity > 0
      ORDER BY p.sku ASC, l.expiry_date ASC
    `;

    const mapped = items.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      price: Number(r.price),
    }));

    // Summary
    const uniqueParts = new Set(mapped.map((r) => r.part_id)).size;
    const totalQuantity = mapped.reduce((s, r) => s + r.quantity, 0);

    return NextResponse.json({
      location: {
        id: location.id,
        name: location.name,
        type: location.type,
        capacity: location.capacity,
      },
      items: mapped,
      summary: {
        uniqueParts,
        totalQuantity,
        lotCount: mapped.length,
      },
    });
  } catch (error) {
    console.error("Location items error:", error);
    return NextResponse.json(
      { error: "Failed to fetch location items" },
      { status: 500 }
    );
  }
}
