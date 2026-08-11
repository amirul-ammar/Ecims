import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireRole, REQUEST_CREATE_ROLES, REQUEST_VIEW_ALL_ROLES, ROLES } from "@/lib/rbac";
import { z } from "zod";

/**
 * GET /api/requests
 * Fetch requests based on user role:
 * - Engineering: own requests only
 * - Inventory Controller: all requests
 * - Warehouse: approved/completed requests only
 * - Admin: all requests (read-only)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let whereClause: any = {};

    // Filter based on role
    if (session.user.role_id === ROLES.ENGINEERING) {
      // Engineering sees only their own requests
      whereClause.user_id = session.user.id;
    } else if (session.user.role_id === ROLES.WAREHOUSE) {
      // Warehouse sees only approved or completed requests
      whereClause.status = { in: ["approved", "completed"] };
    } else if (session.user.role_id !== ROLES.ADMIN && session.user.role_id !== ROLES.INVENTORY_CONTROLLER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Apply status filter if provided
    if (status) {
      whereClause.status = status;
    }

    const requests = await prisma.request.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
        part: { select: { id: true, sku: true, name: true, unit: true, price: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

/**
 * POST /api/requests
 * Create a new request (Engineering only)
 */
const CreateRequestSchema = z.object({
  part_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  console.log("POST /api/requests - Starting");
  
  const session = await getServerSession(authOptions);
  console.log("Session user role_id:", session?.user?.role_id, "Expected:", REQUEST_CREATE_ROLES);
  
  const forbiddenError = await requireRole(REQUEST_CREATE_ROLES);
  if (forbiddenError) {
    console.error("Role check failed");
    return forbiddenError;
  }

  if (!session?.user) {
    console.error("No session user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    console.log("Request body:", body);
    console.log("Session user:", session.user);
    
    const parsed = CreateRequestSchema.parse(body);
    console.log("Parsed data:", parsed);

    // Verify part exists
    const part = await prisma.part.findUnique({
      where: { id: parsed.part_id },
    });

    if (!part) {
      console.error("Part not found:", parsed.part_id);
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }

    console.log("Part found:", part);

    const request = await prisma.request.create({
      data: {
        user_id: session.user.id,
        part_id: parsed.part_id,
        quantity: parsed.quantity,
        notes: parsed.notes || null,
        status: "pending",
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
        part: { select: { id: true, sku: true, name: true, unit: true, price: true } },
      },
    });

    console.log("Request created successfully:", request);
    return NextResponse.json(request, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues);
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error creating request:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create request";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
