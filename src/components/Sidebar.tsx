"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Package, MapPin, ArrowLeftRight, LogOut,
  PackagePlus, PackageMinus, FileBarChart, ClipboardList, BarChart2,
} from "lucide-react";

const mainNavItems = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard, roles: [1, 2, 3, 4] },
  { href: "/parts",        label: "Parts",        icon: Package,         roles: [2, 3, 4] },
  { href: "/locations",    label: "Locations",    icon: MapPin,          roles: [2, 3, 4] },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight,  roles: [2, 3] },
  // Requests — Admin (1) excluded. Operational workflow for IC, Warehouse, Engineering only.
  { href: "/requests",     label: "Requests",     icon: ClipboardList,   roles: [2, 3, 4] },
];

const transactionItems = [
  { href: "/transactions/receive", label: "Receive Stock", icon: PackagePlus },
  { href: "/transactions/issue",   label: "Issue Stock",   icon: PackageMinus },
];

const ADMIN_ROLES     = [1];       // Admin only
const REPORT_ROLES    = [1, 2, 4]; // Admin (Audit Log), IC (all), Engineering (2 reports)
const ANALYTICS_ROLES = [2];       // Inventory Controller only
const STOCK_OP_ROLES  = [2, 3];    // IC + Warehouse

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userName = session?.user?.name ?? "User";
  const roleName = session?.user?.role_name ?? "Unknown";
  const roleId   = session?.user?.role_id ?? 0;
  const initials = userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>ECIMS</h1>
          <span>Whizz System Sdn Bhd</span>
        </div>

        <nav className="sidebar-nav">
          {/* Main Menu */}
          <div className="sidebar-section-title">Main Menu</div>
          {mainNavItems.map((item) =>
            item.roles.includes(roleId) && (
              <Link key={item.href} href={item.href}
                className={`sidebar-link ${pathname === item.href || pathname.startsWith(item.href + "/") ? "active" : ""}`}>
                <item.icon />{item.label}
              </Link>
            )
          )}

          {/* Administration — Admin only */}
          {ADMIN_ROLES.includes(roleId) && (
            <>
              <div className="sidebar-section-title">Administration</div>
              <Link href="/users"
                className={`sidebar-link ${pathname === "/users" || pathname.startsWith("/users/") ? "active" : ""}`}>
                <Package />User Management
              </Link>
            </>
          )}

          {/* Stock Operations — IC + Warehouse */}
          {STOCK_OP_ROLES.includes(roleId) && (
            <>
              <div className="sidebar-section-title">Stock Operations</div>
              {transactionItems.map((item) => (
                <Link key={item.href} href={item.href}
                  className={`sidebar-link ${pathname === item.href ? "active" : ""}`}>
                  <item.icon />{item.label}
                </Link>
              ))}
            </>
          )}

          {/* Reports & Export — Admin (Audit Log only), IC (all), Engineering (2 reports) */}
          {REPORT_ROLES.includes(roleId) && (
            <>
              <div className="sidebar-section-title">Reports &amp; Export</div>
              <Link href="/reports"
                className={`sidebar-link ${pathname === "/reports" || pathname.startsWith("/reports/") ? "active" : ""}`}>
                <FileBarChart />Reports
              </Link>

              {/* Analytics — Inventory Controller only */}
              {ANALYTICS_ROLES.includes(roleId) && (
                <Link href="/analytics"
                  className={`sidebar-link ${pathname === "/analytics" ? "active" : ""}`}>
                  <BarChart2 />Analytics
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-role">{roleName}</div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="modal-close" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="bottom-nav">
        <div className="bottom-nav-items">
          {mainNavItems.filter((item) => item.roles.includes(roleId)).map((item) => (
            <Link key={item.href} href={item.href}
              className={`bottom-nav-link ${pathname === item.href || pathname.startsWith(item.href + "/") ? "active" : ""}`}>
              <item.icon />{item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}