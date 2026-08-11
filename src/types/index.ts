import { Decimal } from "@prisma/client/runtime/library";

/* ─── Base Entities ─── */

export interface Role {
  id: number;
  name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  is_active: number;
  role?: Role;
}

export interface Part {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  price: Decimal | number;
  min_stock: number;
  lead_days: number;
}

export interface PartWithStock extends Part {
  total_stock: number;
  lot_count: number;
  is_low_stock: boolean;
}

export interface Location {
  id: number;
  name: string;
  type: string;
  capacity: number;
}

export interface LocationWithStats extends Location {
  lot_count: number;
  total_quantity: number;
  utilization_percent: number;
}

export interface Lot {
  id: number;
  part_id: number;
  location_id: number;
  lot_number: string;
  date_code: string | null;
  received_date: string;
  expiry_date: string | null;
  quantity: number;
  part?: Part;
  location?: Location;
}

export interface InventoryTransaction {
  id: number;
  part_id: number;
  lot_id: number | null;
  from_location_id: number | null;
  to_location_id: number | null;
  quantity: number;
  user_id: number;
  transaction_type: string;
  reason: string | null;
  notes: string | null;
  is_fefo_override: number;
  created_at: string;
}

export interface TransactionDetail extends InventoryTransaction {
  part_name: string;
  part_sku: string;
  user_name: string;
  lot_number: string | null;
  from_location_name: string | null;
  to_location_name: string | null;
}

/* ─── Dashboard ─── */

export interface DashboardStats {
  totalParts: number;
  totalLocations: number;
  lowStockCount: number;
  expiringSoonCount: number;
  estimatedValue: number;
}

export interface MonthlyData {
  month: string;
  received: number;
  issued: number;
}

/* ─── Alerts ─── */

export interface LowStockAlert {
  part_id: number;
  sku: string;
  name: string;
  min_stock: number;
  current_stock: number;
  deficit: number;
}

export interface ExpiringLot {
  lot_id: number;
  lot_number: string;
  part_id: number;
  part_name: string;
  part_sku: string;
  location_name: string;
  quantity: number;
  expiry_date: string;
  days_until_expiry: number;
}

export interface Alert {
  id: string;
  type: "low_stock" | "expiring";
  severity: "warning" | "critical";
  title: string;
  message: string;
  data: LowStockAlert | ExpiringLot;
}

/* ─── Transaction Analytics ─── */

export interface TransactionAnalytics {
  totalReceived: number;
  totalIssued: number;
  totalTransfers: number;
  totalAdjustments: number;
  fefoOverrideCount: number;
  transactionsByMonth: MonthlyData[];
}

/* ─── Input Types ─── */

export interface CreatePartInput {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  price?: number;
  min_stock?: number;
  lead_days?: number;
}

export interface UpdatePartInput {
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  unit?: string;
  price?: number;
  min_stock?: number;
  lead_days?: number;
}

export interface CreateLocationInput {
  name: string;
  type: string;
  capacity?: number;
}

export interface UpdateLocationInput {
  name?: string;
  type?: string;
  capacity?: number;
}

export interface ReceiveStockInput {
  part_id: number;
  location_id: number;
  lot_number: string;
  date_code?: string;
  received_date?: string;
  expiry_date?: string;
  quantity: number;
  user_id: number;
  notes?: string;
}

export interface IssueStockInput {
  part_id: number;
  quantity: number;
  lot_id?: number;
  from_location_id?: number;
  reason?: string;
  notes?: string;
  user_id: number;
}

/* ─── ABC Analysis ─── */

export interface ABCAnalysisRow {
  part_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  total_stock: number;
  total_value: number;
  annual_consumption_value: number;
  monthly_velocity: number;
  turnover_ratio: number;
  classification: 'A' | 'B' | 'C';
  cumulative_value_percent: number;
}

/* ─── NextAuth Session Extension ─── */

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      name: string;
      email: string;
      role_id: number;
      role_name: string;
    };
  }

  interface User {
    id: number;
    name: string;
    email: string;
    role_id: number;
    role_name: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: number;
    role_id: number;
    role_name: string;
  }
}
