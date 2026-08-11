import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Role IDs as defined in the `roles` table.
 */
export const ROLES = {
  ADMIN: 1,
  INVENTORY_CONTROLLER: 2,
  WAREHOUSE: 3,
  ENGINEERING: 4,
} as const;

/**
 * Roles that can access User Management (system administration).
 * Only Admin can manage users.
 */
export const USER_MANAGEMENT_ROLES = [ROLES.ADMIN];

/**
 * Roles that can create requests.
 * Only Engineering can create requests.
 */
export const REQUEST_CREATE_ROLES = [ROLES.ENGINEERING];

/**
 * Roles that can approve/reject requests.
 * Only Inventory Controller can approve or reject requests.
 */
export const REQUEST_APPROVE_ROLES = [ROLES.INVENTORY_CONTROLLER];

/**
 * Roles that can complete/fulfill requests.
 * Only Warehouse can complete requests.
 */
export const REQUEST_COMPLETE_ROLES = [ROLES.WAREHOUSE];

/**
 * Roles that can view all requests.
 * Admin, Inventory Controller, and Warehouse can view all requests.
 */
export const REQUEST_VIEW_ALL_ROLES = [
  ROLES.ADMIN,
  ROLES.INVENTORY_CONTROLLER,
  ROLES.WAREHOUSE,
];

/**
 * Roles that are allowed to mutate stock (receive / issue).
 * Admin is a system role — no inventory operations.
 */
export const STOCK_MUTATION_ROLES = [
  ROLES.INVENTORY_CONTROLLER,
  ROLES.WAREHOUSE,
];

/**
 * Roles that can create / edit parts.
 */
export const PARTS_MANAGEMENT_ROLES = [ROLES.INVENTORY_CONTROLLER];

/**
 * Roles that can create / edit locations.
 */
export const LOCATIONS_MANAGEMENT_ROLES = [ROLES.INVENTORY_CONTROLLER];

/**
 * Report access matrix — which roles can see which report types.
 * Warehouse (3) has no report access.
 * Engineering limited to movement + usage.
 */
export const REPORT_ACCESS: Record<string, number[]> = {
  valuation:  [ROLES.ADMIN, ROLES.INVENTORY_CONTROLLER],
  stock:      [ROLES.ADMIN, ROLES.INVENTORY_CONTROLLER],
  movement:   [ROLES.ADMIN, ROLES.INVENTORY_CONTROLLER, ROLES.ENGINEERING],
  usage:      [ROLES.ADMIN, ROLES.INVENTORY_CONTROLLER, ROLES.ENGINEERING],
  summary:    [ROLES.ADMIN, ROLES.INVENTORY_CONTROLLER],
  abc:        [ROLES.ADMIN, ROLES.INVENTORY_CONTROLLER],
  audit:      [ROLES.ADMIN],
};

/** All roles that can access at least one report */
export const ANY_REPORT_ROLES = [
  ROLES.ADMIN,
  ROLES.INVENTORY_CONTROLLER,
  ROLES.ENGINEERING,
];


/**
 * Returns the current session, or a 401 NextResponse if unauthenticated.
 */
export async function getSessionOrUnauthorized() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

/**
 * Returns a 403 NextResponse if the current user's role is not in allowedRoles.
 * Returns null if the user is authorized.
 */
export async function requireRole(
  allowedRoles: number[]
): Promise<NextResponse | null> {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  if (!allowedRoles.includes(session!.user.role_id)) {
    return NextResponse.json(
      { error: "Forbidden: your role does not have permission for this action" },
      { status: 403 }
    );
  }
  return null;
}
