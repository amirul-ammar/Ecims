import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireRole, REQUEST_COMPLETE_ROLES } from "@/lib/rbac";
import { z } from "zod";

/**
 * PUT /api/requests/:id/complete
 * Complete a request (Warehouse only).
 * Detects FEFO override and records it in the transaction.
 * Override is reflected in FEFO Compliance analytics.
 */
const CompleteSchema = z.object({
  lot_id: z.number().int().positive("lot_id is required"),
  location_id: z.number().int().nonnegative().optional(),
  is_fefo_override: z.number().int().min(0).max(1).optional().default(0),
  override_reason: z.string().nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const forbiddenError = await requireRole(REQUEST_COMPLETE_ROLES);
    if (forbiddenError) return forbiddenError;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = CompleteSchema.parse(body);

    // Validate override reason
    if (parsed.is_fefo_override === 1 && !parsed.override_reason?.trim()) {
      return NextResponse.json(
        { error: "A reason is required when overriding FEFO selection." },
        { status: 400 }
      );
    }

    // Fetch request
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        part: true,
        user: { select: { name: true } },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (request.status !== "approved") {
      return NextResponse.json(
        { error: `Cannot complete request with status '${request.status}'. Must be 'approved'.` },
        { status: 400 }
      );
    }

    // Fetch selected lot
    const lot = await prisma.lot.findUnique({ where: { id: parsed.lot_id } });
    if (!lot) {
      return NextResponse.json({ error: "Selected lot not found" }, { status: 404 });
    }

    if (lot.quantity < request.quantity) {
      return NextResponse.json(
        { error: `Insufficient stock in selected lot. Available: ${lot.quantity}, Required: ${request.quantity}` },
        { status: 400 }
      );
    }

    // Server-side FEFO override detection — compare against actual FEFO lot
    const fefoLot = await prisma.lot.findFirst({
      where: { part_id: request.part_id, quantity: { gt: 0 } },
      orderBy: [{ expiry_date: "asc" }, { received_date: "asc" }],
    });
    const isOverride = (parsed.is_fefo_override === 1) || (fefoLot !== null && fefoLot.id !== parsed.lot_id);

    const locationId = lot.location_id;
    const reason = isOverride
      ? `FEFO Override — ${parsed.override_reason?.trim() || "No reason provided"} | Request #${requestId} for ${request.user.name}`
      : `Request #${requestId} fulfillment for ${request.user.name}`;

    // Atomic transaction
    await prisma.$transaction([
      prisma.inventoryTransaction.create({
        data: {
          part_id: request.part_id,
          lot_id: parsed.lot_id,
          from_location_id: locationId,
          quantity: request.quantity,
          user_id: session.user.id,
          transaction_type: "issue",
          is_fefo_override: isOverride ? 1 : 0,
          reason,
          notes: request.notes,
        },
      }),
      prisma.lot.update({
        where: { id: parsed.lot_id },
        data: { quantity: { decrement: request.quantity } },
      }),
      prisma.request.update({
        where: { id: requestId },
        data: { status: "completed" },
      }),
    ]);

    const updated = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
        part: { select: { id: true, sku: true, name: true, unit: true, price: true } },
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input: " + JSON.stringify(error.issues) }, { status: 400 });
    }
    return NextResponse.json({ error: errorMessage || "Failed to complete request" }, { status: 500 });
  }
}