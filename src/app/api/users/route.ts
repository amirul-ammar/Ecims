import { NextRequest, NextResponse } from "next/server";
import { requireRole, USER_MANAGEMENT_ROLES } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

/**
 * GET /api/users
 * List all users (Admin only)
 */
export async function GET(req: NextRequest) {
  const forbiddenError = await requireRole(USER_MANAGEMENT_ROLES);
  if (forbiddenError) return forbiddenError;

  try {
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { id: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Create a new user (Admin only)
 */
const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(100),
  password: z.string().min(6).max(255),
  role_id: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const forbiddenError = await requireRole(USER_MANAGEMENT_ROLES);
  if (forbiddenError) return forbiddenError;

  try {
    const body = await req.json();

    // Validate input
    const parsed = CreateUserSchema.parse(body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      );
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: parsed.role_id },
    });

    if (!role) {
      return NextResponse.json({ error: "Invalid role ID" }, { status: 400 });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(parsed.password, 10);

    const user = await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        password: hashedPassword,
        role_id: parsed.role_id,
        is_active: 1,
      },
      include: { role: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
