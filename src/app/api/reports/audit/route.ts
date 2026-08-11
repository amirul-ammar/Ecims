import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ROLES } from "@/lib/rbac";
import { getAuditLogReport } from "@/lib/reports";

/**
 * GET /api/reports/audit — Admin-only: fetch full audit log
 * POST /api/reports/audit — Log an export action (PDF/Excel)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role_id !== ROLES.ADMIN) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await getAuditLogReport();
  return NextResponse.json({ data, type: "audit", generatedAt: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { report_type, export_format, filters } = await request.json();

  const { default: prisma } = await import("@/lib/prisma");
  await prisma.reportAuditLog.create({
    data: {
      user_id: session.user.id,
      report_type,
      export_format,
      filters: filters ? JSON.stringify(filters) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
