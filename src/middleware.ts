import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Middleware for auth protection and role-based access control.
 * Protects all routes except /login and /api/auth/*.
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Role-based route protection
    const roleId = token?.role_id as number | undefined;

    // Parts/Locations write operations: Inventory Controller (2) only
    if (
      (path.startsWith("/api/parts") || path.startsWith("/api/locations")) &&
      (req.method === "POST" || req.method === "PUT")
    ) {
      if (!roleId || roleId !== 2) {
        return NextResponse.json(
          { error: "Forbidden: Insufficient permissions" },
          { status: 403 }
        );
      }
    }

    // Transaction receive/issue: Inventory Controller (2) + Warehouse (3)
    if (
      (path.startsWith("/api/transactions/receive") ||
        path.startsWith("/api/transactions/issue")) &&
      req.method === "POST"
    ) {
      if (!roleId || ![2, 3].includes(roleId)) {
        return NextResponse.json(
          { error: "Forbidden: Insufficient permissions" },
          { status: 403 }
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - /login
     * - /api/auth (NextAuth routes)
     * - /_next (Next.js internals)
     * - /favicon.ico, /images, etc.
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
