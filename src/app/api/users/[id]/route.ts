import { NextRequest, NextResponse } from "next/server";
import { requireRole, USER_MANAGEMENT_ROLES } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

/**
 * PUT /api/users/:id
 * Update user role and/or password (Admin only)
 */
const UpdateUserSchema = z.object({
  role_id: z.number().int().positive().optional(),
  password: z.string().min(6).max(255).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbiddenError = await requireRole(USER_MANAGEMENT_ROLES);
  if (forbiddenError) return forbiddenError;

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = UpdateUserSchema.parse(body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If updating role, verify role exists
    if (parsed.role_id) {
      const role = await prisma.role.findUnique({
        where: { id: parsed.role_id },
      });

      if (!role) {
        return NextResponse.json(
          { error: "Invalid role ID" },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (parsed.role_id !== undefined) {
      updateData.role_id = parsed.role_id;
    }
    if (parsed.is_active !== undefined) {
      updateData.is_active = parsed.is_active;
    }
    if (parsed.password !== undefined) {
      updateData.password = await bcrypt.hash(parsed.password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { role: true },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/:id
 * Delete a user (Admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbiddenError = await requireRole(USER_MANAGEMENT_ROLES);
  if (forbiddenError) return forbiddenError;

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete related data before deleting the user to satisfy foreign key constraints.
    await prisma.$transaction([
      prisma.inventoryTransaction.deleteMany({
        where: { user_id: userId },
      }),
      prisma.reportAuditLog.deleteMany({
        where: { user_id: userId },
      }),
      prisma.request.deleteMany({
        where: { user_id: userId },
      }),
      prisma.user.delete({
        where: { id: userId },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
