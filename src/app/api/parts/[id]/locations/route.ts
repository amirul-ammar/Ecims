import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/parts/[id]/locations
 * Returns all locations where a part is stored with quantity per location.
 * Includes summary stats: total locations, total quantity, lot count.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partId = parseInt(id);

    // Fetch part info
    const part = await prisma.part.findUnique({
      where: { id: partId },
    });

    if (!part) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }

    // Fetch all lots for this part grouped by location, plus lot-level detail
    const locations = await prisma.$queryRaw<
      {
        location_id: number;
        location_name: string;
        location_type: string;
        capacity: number;
        lot_id: number;
        lot_number: string;
        quantity: number;
        received_date: Date;
        expiry_date: Date | null;
        date_code: string | null;
      }[]
    >`
      SELECT
        loc.id as location_id,
        loc.name as location_name,
        loc.type as location_type,
        loc.capacity,
        l.id as lot_id,
        l.lot_number,
        l.quantity,
        l.received_date,
        l.expiry_date,
        l.date_code
      FROM lots l
      JOIN locations loc ON loc.id = l.location_id
      WHERE l.part_id = ${partId}
        AND l.quantity > 0
      ORDER BY loc.name ASC, l.expiry_date ASC
    `;

    const mapped = locations.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
    }));

    // Summary by location
    const locationMap = new Map<
      number,
      {
        location_id: number;
        location_name: string;
        location_type: string;
        capacity: number;
        total_quantity: number;
        lot_count: number;
        utilization_percent: number;
      }
    >();

    for (const row of mapped) {
      const existing = locationMap.get(row.location_id);
      if (existing) {
        existing.total_quantity += row.quantity;
        existing.lot_count += 1;
      } else {
        locationMap.set(row.location_id, {
          location_id: row.location_id,
          location_name: row.location_name,
          location_type: row.location_type,
          capacity: row.capacity,
          total_quantity: row.quantity,
          lot_count: 1,
          utilization_percent: 0,
        });
      }
    }

    // Calculate utilization (total stored at location / capacity)
    // We need total stored quantity per location across ALL parts
    const locationIds = Array.from(locationMap.keys());
    if (locationIds.length > 0) {
      try {
        const utilRows = await prisma.$queryRaw<
          { location_id: number; total_stored: number }[]
        >`
          SELECT location_id, COALESCE(SUM(quantity), 0) as total_stored
          FROM lots
          WHERE location_id IN (${Prisma.join(locationIds)})
          GROUP BY location_id
        `;

        for (const u of utilRows) {
          const loc = locationMap.get(u.location_id);
          if (loc) {
            loc.utilization_percent = Math.round(
              (Number(u.total_stored) / loc.capacity) * 1000
            ) / 10;
          }
        }
      } catch {
        // utilization is optional — don't fail the whole request
      }
    }

    const locationSummaries = Array.from(locationMap.values());
    const totalQuantity = mapped.reduce((s, r) => s + r.quantity, 0);

    return NextResponse.json({
      part: {
        id: part.id,
        sku: part.sku,
        name: part.name,
        category: part.category,
        unit: part.unit,
        price: Number(part.price),
      },
      lots: mapped,
      locationSummaries,
      summary: {
        totalLocations: locationSummaries.length,
        totalQuantity,
        lotCount: mapped.length,
      },
    });
  } catch (error) {
    console.error("Part locations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch part locations" },
      { status: 500 }
    );
  }
}
