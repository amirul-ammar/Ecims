import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireRole, REQUEST_APPROVE_ROLES } from "@/lib/rbac";
import { z } from "zod";

/**
 * PUT /api/requests/:id/reject
 * Reject a request (Inventory Controller only)
 */
const RejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbiddenError = await requireRole(REQUEST_APPROVE_ROLES);
  if (forbiddenError) return forbiddenError;

  try {
    const { id } = await params;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = RejectSchema.parse(body);

    // Check if request exists and is pending
    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (request.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot reject request with status '${request.status}'` },
        { status: 400 }
      );
    }

    const updated = await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        notes: `${request.notes || ""}\n[REJECTED] ${parsed.reason}`,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
        part: { select: { id: true, sku: true, name: true, unit: true, price: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error rejecting request:", error);
    return NextResponse.json({ error: "Failed to reject request" }, { status: 500 });
  }
}
