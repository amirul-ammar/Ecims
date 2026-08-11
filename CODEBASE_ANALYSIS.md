# Inventory Management System - Codebase Analysis

**Analysis Date:** April 24, 2026  
**System Type:** Next.js 15 + Prisma ORM + MySQL + NextAuth  
**Architecture:** Real-time SSE-driven, RBAC-enforced, FEFO-based inventory operations

---

## 1. DATA MODELS (Relational Schema)

### Core Entities

#### **Role** (rbac.ts)
| Field | Type | Notes |
|-------|------|-------|
| id | INT PRIMARY KEY | 1=Admin, 2=InventoryController, 3=Warehouse, 4=Engineering |
| name | VARCHAR(50) | Unique role identifier |

#### **User**
| Field | Type | Notes |
|-------|------|-------|
| id | INT PRIMARY KEY | |
| name | VARCHAR(100) | Full name |
| email | VARCHAR(100) UNIQUE | Login credential |
| password | VARCHAR(255) | Hashed |
| role_id | FK(Role) | Determines access level |
| is_active | TINYINT | 1=active, 0=inactive |

**Relationships:** User → Role (many-to-one) | User → InventoryTransaction, Request, ReportAuditLog (one-to-many)

---

#### **Part** (Inventory Master)
| Field | Type | Notes |
|-------|------|-------|
| id | INT PRIMARY KEY | |
| sku | VARCHAR(50) UNIQUE | Stock keeping unit |
| name | VARCHAR(100) | Display name |
| description | TEXT | Optional |
| category | VARCHAR(50) | Default: "General" |
| unit | VARCHAR(20) | Default: "pcs" (pieces, meters, kg, etc.) |
| price | DECIMAL(10,2) | Unit cost for valuation |
| min_stock | INT | Reorder point (triggers low stock alert) |
| lead_days | INT | Default: 30 days (procurement lead time) |

**Derived Metrics (Computed at Query Time):**
- `total_stock` = SUM(Lot.quantity) by Part
- `lot_count` = COUNT(DISTINCT Lot.id) by Part
- `is_low_stock` = total_stock ≤ min_stock
- `total_value` = total_stock × price

**Relationships:** Part → Location (through Lot, many-to-many) | Part → InventoryTransaction, Request, Lot

---

#### **Location** (Storage Destinations)
| Field | Type | Notes |
|-------|------|-------|
| id | INT PRIMARY KEY | |
| name | VARCHAR(100) | Warehouse, bin, shelf, etc. |
| type | VARCHAR(50) | Categorical type (e.g., "Warehouse", "Bin", "Staging") |
| capacity | INT | Default: 1000 units |

**Derived Metrics:**
- `lot_count` = COUNT(DISTINCT Lot.id) by Location
- `total_quantity` = SUM(Lot.quantity) by Location
- `utilization_percent` = (total_quantity / capacity) × 100

**Relationships:** Location → Lot (one-to-many) | Location ← InventoryTransaction (from_location_id, to_location_id)

---

#### **Lot** (Physical Inventory Batches)
| Field | Type | Notes |
|-------|------|-------|
| id | INT PRIMARY KEY | Unique batch ID |
| part_id | FK(Part) | Links to SKU |
| location_id | FK(Location) | Current storage location |
| lot_number | VARCHAR(100) | Manufacturer batch number |
| date_code | VARCHAR(50) | Optional (production date) |
| received_date | DATE | Date lot entered inventory |
| expiry_date | DATE | NULL if non-perishable |
| quantity | INT | Current stock in this lot |

**Key Characteristics:**
- Physically unique batches (respects lot tracking)
- Supports expiry date tracking (FEFO algorithm basis)
- Quantity mutates via InventoryTransaction records

**Relationships:** Lot → Part, Location | Lot → InventoryTransaction (issued_from)

---

#### **InventoryTransaction** (Complete Audit Trail)
| Field | Type | Notes |
|-------|------|-------|
| id | INT PRIMARY KEY | Unique transaction ID |
| part_id | FK(Part) | Which SKU |
| lot_id | FK(Lot) NULLABLE | Which batch (NULL for transfers/adjustments) |
| from_location_id | FK(Location) NULLABLE | Source location |
| to_location_id | FK(Location) NULLABLE | Destination location |
| quantity | INT | Units moved |
| user_id | FK(User) | Who performed transaction |
| transaction_type | VARCHAR(50) | "receive" \| "issue" \| "transfer" \| "adjust" |
| reason | TEXT | Optional business reason |
| notes | TEXT | Free-form notes |
| is_fefo_override | TINYINT | 1 if FEFO policy was bypassed |
| created_at | DATETIME DEFAULT NOW() | Timestamp |

**Business Logic:**
- **receive**: Adds qty to Lot; to_location_id specified, from_location_id NULL
- **issue**: Subtracts qty from Lot; from_location_id specified; FEFO-ranked
- **transfer**: Moves between locations; both from/to_location_id set
- **adjust**: Inventory corrections; reason required
- **FEFO Override Detection**: Compares selected_lot vs. oldest_expiring_lot; flags `is_fefo_override=1` if mismatch

**Relationships:** InventoryTransaction → User, Part, Lot (nullable), Location (from/to)

---

#### **ReportAuditLog** (Compliance & Analytics Tracking)
| Field | Type | Notes |
|-------|------|-------|
| id | INT PRIMARY KEY | |
| user_id | FK(User) | Who generated report |
| report_type | VARCHAR(50) | "valuation" \| "stock" \| "movement" \| "usage" \| "summary" \| "audit" |
| export_format | VARCHAR(10) | "csv" \| "pdf" \| "json" \| "excel" |
| filters | TEXT | JSON-serialized filter state |
| created_at | DATETIME DEFAULT NOW() | |

**Purpose:** Track regulatory compliance, audit trail, and report generation patterns

**Relationships:** ReportAuditLog → User

---

#### **Request** (Stock Request Workflow)
| Field | Type | Notes |
|-------|------|-------|
| id | INT PRIMARY KEY | |
| user_id | FK(User) | Requesting user (typically Engineering) |
| part_id | FK(Part) | What part needed |
| quantity | INT | How many units |
| status | VARCHAR(20) | "pending" \| "approved" \| "rejected" \| "completed" |
| notes | TEXT | Request justification |
| created_at | DATETIME DEFAULT NOW() | |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

**Workflow State Machine:**
```
pending → approved → completed
   ↓
 rejected
```

**Role-Based Transitions:**
- **Engineering**: CREATE (pending status)
- **InventoryController**: APPROVE/REJECT
- **Warehouse**: COMPLETE (fulfill approved request)

**Relationships:** Request → User, Part

---

## 2. EXISTING REPORT TYPES & CAPABILITIES

All reports use raw SQL queries for performance. Real-time filtering via ReportFilters.

### Report Matrix (RBAC Enforcement)

| Report Type | Access | Purpose | Key Metrics |
|-------------|--------|---------|-------------|
| **Valuation** | Admin (1), Inventory Controller (2) | Financial inventory assessment | Total value, per-part valuation, lot count |
| **Stock Levels** | Admin (1), Inventory Controller (2) | Stock health monitoring | Min/current stock, deficit, status categorization |
| **Product Movement** | Admin (1), IC (2), Engineering (4) | Transaction history & traceability | Movement by part, location, user, date range |
| **Component Usage** | Admin (1), IC (2), Engineering (4) | Consumption analysis | Issues vs. receives, transaction count, last activity |
| **Period Summary** | Admin (1), IC (2) | Aggregate trends | Monthly/weekly inbound, outbound, net movement |
| **Audit Log** | Admin (1) only | Compliance & governance | Report generation history, user actions, export formats |

### Report Implementations (src/lib/reports.ts)

#### 1. **Inventory Valuation Report** — `getInventoryValuationReport()`
```
SELECT
  part_id, sku, name, category, unit, price,
  SUM(quantity) as total_stock,
  SUM(quantity * price) as total_value,
  COUNT(DISTINCT lot_id) as lot_count
GROUP BY part_id
ORDER BY total_value DESC
```
**Output:** ValuationRow[]
- Sorted by total value (descending)
- Supports category filtering
- Used for financial reporting and inventory risk assessment

#### 2. **Stock Levels Report** — `getStockLevelsReport()`
```
SELECT
  part_id, sku, name, category, min_stock,
  COALESCE(SUM(quantity), 0) as current_stock,
  CASE
    WHEN current_stock = 0 THEN 'Out of Stock'
    WHEN current_stock ≤ min_stock THEN 'Low Stock'
    ELSE 'OK'
  END as status,
  GREATEST(min_stock - current_stock, 0) as deficit
GROUP BY part_id
ORDER BY status ASC, deficit DESC
```
**Output:** StockLevelRow[]
- Categories parts into 3 statuses
- Sorted by status priority, then by deficit magnitude
- Triggers purchase orders and restock alerts

#### 3. **Product Movement Report** — `getProductMovementReport()`
```
SELECT
  transaction_id, created_at, part_sku, part_name, category,
  transaction_type, quantity, user_name,
  COALESCE(from_location, to_location, '-') as location_name,
  lot_number
FROM inventory_transactions
JOIN parts, users, locations, lots
WHERE created_at BETWEEN ${dateFrom} AND ${dateTo}
  [AND part_id = ${partId}]
ORDER BY created_at DESC
LIMIT 500
```
**Output:** MovementRow[]
- Filters by date range and optional part ID
- Links transaction to locations and lot traceability
- Used for supply chain visibility and forensic analysis

#### 4. **Component Usage Report** — `getComponentUsageReport()`
```
SELECT
  part_id, sku, name, category,
  SUM(CASE WHEN transaction_type = 'issue' THEN quantity ELSE 0 END) as total_issued,
  SUM(CASE WHEN transaction_type = 'receive' THEN quantity ELSE 0 END) as total_received,
  COUNT(*) as transaction_count,
  MAX(created_at) as last_activity
GROUP BY part_id
ORDER BY total_issued DESC
```
**Output:** UsageRow[]
- Ranked by consumption intensity
- Tracks net flow (received − issued)
- Identifies frequently-used vs. obsolete parts

#### 5. **Monthly Summary Report** — `getMonthlySummaryReport(groupBy: "week"|"month")`
```
SELECT
  DATE_FORMAT(created_at, '%Y-%m' or '%Y-W%u') as period,
  SUM(CASE WHEN transaction_type = 'receive' THEN quantity ELSE 0 END) as total_received,
  SUM(CASE WHEN transaction_type = 'issue' THEN quantity ELSE 0 END) as total_issued,
  SUM(net_movement) as net_movement,
  COUNT(*) as transaction_count
GROUP BY period
ORDER BY period ASC
```
**Output:** SummaryRow[]
- Configurable weekly or monthly grouping
- Shows inbound/outbound velocity over time
- Powers dashboard chart visualization

#### 6. **Audit Log Report** — `getAuditLogReport()`
```
SELECT
  audit_id, user_name, user_email,
  report_type, export_format, filters, created_at
FROM report_audit_log
JOIN users
ORDER BY created_at DESC
LIMIT 500
```
**Output:** AuditLogRow[]
- Admin-only compliance view
- Tracks all report generations and exports
- Supports regulatory audits

### Report Filtering Capabilities (ReportFilters interface)
```typescript
type ReportFilters = {
  dateFrom?: string,        // ISO date: '2026-01-01'
  dateTo?: string,          // ISO date: '2026-12-31'
  category?: string,        // Part category filter
  partId?: number,          // Specific part ID
}
```

---

## 3. DASHBOARD METRICS CURRENTLY DISPLAYED

### Real-Time Dashboard Architecture
- **Data Source:** Server-Sent Events (SSE) via `/api/sse/dashboard`
- **Client Polling:** Zustand store with auto-reconnect (exponential backoff, max 30s)
- **Fallback:** HTTP GET `/api/dashboard/stats` (30-second poll)
- **Update Frequency:** Real-time on transaction events

### Dashboard Statistics (DashboardStats interface)

| Metric | Query Source | Business Meaning | Update Trigger |
|--------|--------------|------------------|-----------------|
| **totalParts** | COUNT(Part) | Active SKU catalog size | Part created/deleted |
| **totalLocations** | COUNT(Location) | Warehouse/bin network size | Location created/deleted |
| **lowStockCount** | COUNT(Part WHERE qty ≤ min_stock) | Critical inventory alerts | Transaction (issue/receive) |
| **expiringSoonCount** | COUNT(Lot WHERE expiry_date ≤ NOW+30d AND qty > 0) | Perishable inventory risk | Lot creation/expiry passage |
| **estimatedValue** | SUM(Lot.qty × Part.price) | Financial exposure | Transaction quantity changes |

### Dashboard Components

#### 1. **Stats Cards** (5 visible in layout)
```
┌─────────────────────┬──────────────────────┬──────────────────────┐
│  Total Active SKUs  │ Total Locations      │  Low Stock Alerts    │
│  [numeric]          │  [numeric]           │  [numeric]           │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ Expiring Soon       │  Estimated Value     │                      │
│ [numeric]           │  [currency]          │                      │
└─────────────────────┴──────────────────────┴──────────────────────┘
```
- Each card is clickable to drill-down into alerts or details
- Icons: Package, MapPin, AlertTriangle, Clock, DollarSign
- Color-coded variants: info, purple, danger, warning

#### 2. **Alerts Banner**
- Conditional rendering: hidden if no alerts
- Shows count summary: "{N} Low Stock + {M} Expiring"
- Dismissible (session-scoped)
- Severity indicator: danger if low stock, warning if expiring

#### 3. **Recent Transactions Table**
- Last 5 transactions with full context:
  - Part SKU, name, category
  - Transaction type (receive/issue/transfer/adjust)
  - Quantity, timestamp, user, lot number
- Sortable by timestamp or part

#### 4. **Monthly Chart** (Line/Bar)
```
getMonthlyVelocity(12 months)
- X-axis: Month labels (YYYY-MM)
- Y-axis: Quantity (units)
- Series: [Received (blue), Issued (red)]
- Shows net inventory flow over past year
```
- Data pivoted from raw transaction query into { month, received, issued }
- Used to identify seasonal patterns and trending

#### 5. **Connection Status Indicator**
```
Live / Reconnecting...
Updated [ISO timestamp]
Server: [ISO timestamp]
```
- Green dot = SSE connected; Red dot = reconnecting
- Shows last data update and server time sync

---

## 4. REAL-TIME ALERT SYSTEM

### Alert Categories & Triggers

#### A. **Low Stock Alerts** (`getLowStockAlerts()`)
```sql
SELECT part_id, sku, name, min_stock, current_stock, deficit
FROM parts
LEFT JOIN lots
GROUP BY part_id
HAVING SUM(quantity) ≤ min_stock
ORDER BY deficit DESC
```

**Trigger Condition:** total_stock ≤ min_stock  
**Severity:** CRITICAL (danger badge)  
**Action Items:** 
- Initiate purchase order
- Request stock from other locations
- Adjust min_stock if thresholds are outdated

**Data Structure (LowStockAlert):**
```typescript
{
  part_id: number,
  sku: string,
  name: string,
  min_stock: number,        // Threshold value
  current_stock: number,    // Actual qty in system
  deficit: number,          // min_stock - current_stock
}
```

#### B. **Expiring Lot Alerts** (`getExpiringLots(days=30)`)
```sql
SELECT lot_id, lot_number, part_id, part_name, sku,
       location_name, quantity,
       expiry_date, DATEDIFF(expiry_date, CURDATE()) as days_until_expiry
FROM lots
JOIN parts, locations
WHERE expiry_date IS NOT NULL
  AND expiry_date ≤ DATE_ADD(CURDATE(), INTERVAL 30 DAY)
  AND quantity > 0
ORDER BY expiry_date ASC
```

**Trigger Condition:** expiry_date ≤ now() + 30 days AND qty > 0  
**Severity:** WARNING (but becomes CRITICAL as expiry approaches)  
**Action Items:**
- Issue stock from expiring lots first (FEFO enforcement)
- Plan disposal or donation
- Negotiate credit with supplier if defective

**Data Structure (ExpiringLot):**
```typescript
{
  lot_id: number,
  lot_number: string,
  part_id: number,
  part_name: string,
  part_sku: string,
  location_name: string,
  quantity: number,
  expiry_date: string (ISO),
  days_until_expiry: number,  // Negative if expired
}
```

### Alert System Integration

**Hook:** `useAlerts()` in src/hooks/useAlerts.ts
- Primary source: Zustand store (from SSE)
- Fallback: HTTP GET `/api/alerts` every 30 seconds
- Returns: { lowStock[], expiring[], totalAlerts, isLoading, error, refetch() }

**API Endpoint:** `/api/alerts` (src/app/api/alerts/route.ts)
- Fetches both alert types in parallel
- Aggregates into { lowStock, expiring, totalAlerts }
- No RBAC filtering (all authenticated users can view)

**UI Rendering:**
- AlertsBanner component (top of dashboard)
- Modals for drill-down (Modal component)
- Integration with notifications (Sonner toaster)

---

## 5. RBAC (Role-Based Access Control)

### Role Hierarchy

```
┌─────────────┐
│    ADMIN    │  (1) System administrator
│  Role ID: 1 │  - Full system access
│             │  - User management
│             │  - All reports
│             │  - Audit logging
└─────────────┘

┌────────────────────────────┐
│ INVENTORY_CONTROLLER       │  (2) Stock manager
│  Role ID: 2                │  - Parts & locations CRUD
│  Roles: [1, 2]             │  - Receive/issue operations
│                            │  - Approve stock requests
│                            │  - Financial reports
└────────────────────────────┘

┌────────────────────────────┐
│ WAREHOUSE                  │  (3) Fulfillment operator
│  Role ID: 3                │  - Execute approved requests
│  Roles: [3]                │  - No report access
│  Access: [REQUEST_COMPLETE]│  - Transaction history only
└────────────────────────────┘

┌────────────────────────────┐
│ ENGINEERING                │  (4) Parts requester
│  Role ID: 4                │  - Create stock requests
│  Access: [4]               │  - View movement/usage reports
│  Roles: [4]                │  - Limited analytics
└────────────────────────────┘
```

### Permission Matrix (src/lib/rbac.ts)

#### User Management
```typescript
USER_MANAGEMENT_ROLES = [ROLES.ADMIN]
```
- Only Admin can view/create/edit/delete users

#### Stock Mutation (Receive/Issue)
```typescript
STOCK_MUTATION_ROLES = [ROLES.INVENTORY_CONTROLLER, ROLES.WAREHOUSE]
```
- Inventory Controller: Full operational control
- Warehouse: Can execute operations (but limited scope)
- Audit recorded per transaction

#### Parts Management (CRUD)
```typescript
PARTS_MANAGEMENT_ROLES = [ROLES.INVENTORY_CONTROLLER]
```
- Only Inventory Controller can define new parts
- Create: SKU, name, category, unit, price, min_stock, lead_days
- Update: All fields
- Delete: Soft-delete (logical) or cascade considerations

#### Locations Management (CRUD)
```typescript
LOCATIONS_MANAGEMENT_ROLES = [ROLES.INVENTORY_CONTROLLER]
```
- Only Inventory Controller can define storage locations
- Affects warehouse layout and capacity planning

#### Request Workflow (3-step RBAC)
```typescript
REQUEST_CREATE_ROLES = [ROLES.ENGINEERING]
REQUEST_APPROVE_ROLES = [ROLES.INVENTORY_CONTROLLER]
REQUEST_COMPLETE_ROLES = [ROLES.WAREHOUSE]
REQUEST_VIEW_ALL_ROLES = [ROLES.ADMIN, ROLES.INVENTORY_CONTROLLER, ROLES.WAREHOUSE]
```
- **Engineering:** Creates requests (status: pending)
- **Inventory Controller:** Reviews and approves/rejects
- **Warehouse:** Fulfills approved requests (status: completed)
- Only ADMIN, IC, Warehouse can view all requests

#### Report Access Matrix
```typescript
REPORT_ACCESS: {
  valuation:  [1, 2],        // Admin, IC
  stock:      [1, 2],        // Admin, IC
  movement:   [1, 2, 4],     // Admin, IC, Engineering
  usage:      [1, 2, 4],     // Admin, IC, Engineering
  summary:    [1, 2],        // Admin, IC
  audit:      [1],           // Admin only
}
```

**Enforcement Pattern:**
```typescript
async function requireRole(allowedRoles: number[]): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!allowedRoles.includes(session.user.role_id)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }
  return null;  // Authorized, proceed
}
```
- Used at API route entry
- Returns 403 if unauthorized
- Protects against vertical privilege escalation

### Authorization Enforcement Points

1. **API Routes:**
   - `/api/parts` — PARTS_MANAGEMENT_ROLES
   - `/api/locations` — LOCATIONS_MANAGEMENT_ROLES
   - `/api/transactions/receive` — STOCK_MUTATION_ROLES
   - `/api/transactions/issue` — STOCK_MUTATION_ROLES
   - `/api/requests/[id]/approve` — REQUEST_APPROVE_ROLES
   - `/api/requests/[id]/complete` — REQUEST_COMPLETE_ROLES
   - `/api/reports/[type]` — REPORT_ACCESS[type]

2. **UI Components:**
   - Conditional rendering based on session.user.role_id
   - Button disabling if no permission
   - Page redirection if unauthorized (403)

3. **Session Context:**
   - NextAuth session includes role_id
   - useSession() hook pulls from session.user.role_id
   - Integrated into request bodies (user_id validation)

---

## 6. ANALYTICAL CAPABILITIES & INSIGHTS

### Currently Implemented Analytics

#### A. **Financial Analytics**
- **Inventory Valuation by Part:** Part-level cost exposure
- **Total Inventory Value:** Point-in-time financial snapshot
- **Cost per Category:** Aggregated by part classification
- **Carrying Cost Risk:** High-value slow-moving stock

#### B. **Operational Analytics**
- **Stock Velocity:** Monthly inbound vs. outbound (chart)
- **Part Movement Frequency:** Transaction count per SKU
- **Location Utilization:** Capacity % by warehouse/bin
- **FEFO Compliance:** Override count tracking
- **Transaction Audit Trail:** Complete history with user attribution

#### C. **Supply Chain Analytics**
- **Low Stock Forecasting:** Parts approaching minimum threshold
- **Expiry Risk Management:** Lots expiring within 30 days
- **Lot Traceability:** Full lineage per batch (received → issued → locations)
- **Supplier Performance:** Lead time tracking (part.lead_days metadata)

#### D. **Request & Fulfillment Analytics**
- **Request Approval Rate:** Approved vs. rejected over time
- **Fulfillment Time:** Pending → completed duration
- **Part Request Demand:** Frequency of parts requested

### Advanced Insights Available (Not Yet Implemented)

#### Potential Future Analytics

| Insight | Data Source | Use Case |
|---------|-------------|----------|
| **ABC Analysis (Pareto)** | getComponentUsageReport + ValuationReport | Prioritize high-value/high-velocity parts |
| **Economic Order Quantity (EOQ)** | Historical usage + part.price | Optimize procurement batch sizes |
| **Seasonal Demand Patterns** | getMonthlySummaryReport (12+ months) | Plan inventory levels |
| **Reorder Point (ROP)** | lead_days + average_daily_usage | Auto-trigger purchase orders |
| **Days Inventory Outstanding (DIO)** | avg_daily_issued / total_stock | Assess inventory efficiency |
| **Obsolescence Risk** | Last activity date + months without movement | Identify dead stock |
| **Supplier Reliability** | Received qty vs. order qty + lead_days variance | Assess supplier performance |
| **Lot Age Distribution** | Received_date cohorts | Identify oldest batches for FEFO enforcement |
| **Cross-location Stock Distribution** | Lot quantities by location | Rebalance inventory network |
| **Cost Variance Analysis** | Historical part.price changes | Track inflation/deflation impact |

---

## 7. KEY BUSINESS METRICS BEING TRACKED

### Operational KPIs

| Metric | Calculation | Frequency | Owner | Alert Threshold |
|--------|-----------|-----------|-------|-----------------|
| **Total Active SKUs** | COUNT(Part) | Real-time | Inventory Controller | N/A |
| **Low Stock Items** | COUNT(Part WHERE qty ≤ min_stock) | Real-time | Inventory Controller | > 5% of SKUs |
| **Expiring Lots** | COUNT(Lot WHERE expiry ≤ now+30d AND qty > 0) | Daily (30-day window) | Inventory Controller | > 0 |
| **Inventory Turnover** | total_issued / avg_stock_qty | Monthly | Finance/Planning | Industry benchmark |
| **Stock-out Events** | COUNT(InventoryTransaction WHERE qty FAIL) | Real-time | Warehouse Manager | > 0 |
| **FEFO Overrides** | COUNT(InventoryTransaction WHERE is_fefo_override=1) | Daily | Inventory Controller | > 5% of issues |

### Financial KPIs

| Metric | Calculation | Frequency | Owner | Target |
|--------|-----------|-----------|-------|--------|
| **Estimated Inventory Value** | SUM(Lot.qty × Part.price) | Real-time | Finance | Budget target |
| **Per-Part Valuation** | qty × price by Part | Weekly | Finance | Variance analysis |
| **Carrying Cost** | Inventory value × carrying_cost_% | Monthly | Finance | Cost control |
| **Stockout Cost** | Missed orders × margin | Monthly | Operations | Risk mitigation |
| **Category Value Distribution** | SUM(value) GROUP BY category | Monthly | Finance | Portfolio analysis |

### Supply Chain KPIs

| Metric | Calculation | Frequency | Owner | Target |
|--------|-----------|-----------|-------|--------|
| **Days Inventory Outstanding** | Avg stock / avg daily issue | Monthly | Supply Chain | < 60 days |
| **Lot Traceability** | % of parts with complete lineage | Quarterly | Quality/Compliance | 100% |
| **Lead Time Performance** | Actual days to receive vs. lead_days | Monthly | Procurement | ±5 days variance |
| **Request Fulfillment Rate** | Completed / Total requests | Monthly | Warehouse | > 95% |
| **Request Approval Rate** | Approved / Total created | Monthly | Planning | > 80% |

---

## 8. DATA RELATIONSHIPS & DERIVED INSIGHTS

### Entity Relationship Diagram (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│ User (role_id) ──1:N──> InventoryTransaction                    │
│       │                        │                                │
│       │                        ├─────> Part (sku, price)        │
│       │                        ├─────> Lot (expiry_date)        │
│       │                        ├─────> Location (from/to)       │
│       │                        └─────> User (who)               │
│       │                                                          │
│       ├─────1:N───> Request ──────────> Part (needed)           │
│       │                                                          │
│       └─────1:N───> ReportAuditLog ────> Report type + filters  │
│                                                                  │
│ Role ◄─────────── User (role_id FK)                             │
│                                                                  │
│ Part ◄─────1:N──── Lot                                          │
│       │            ├─ location_id ──> Location                 │
│       │            ├─ received_date, expiry_date                │
│       │            └─ quantity (mutates via Transaction)        │
│       │                                                          │
│       └─────1:N──── InventoryTransaction                        │
│            (via lot_id, FK relationship)                        │
│                                                                  │
│ Location                                                         │
│  ├─ capacity (physical limit)                                   │
│  └─ 1:N ──> Lot (lot_number, date_code)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Data Flows

#### Flow 1: Stock Receive (Inbound)
```
User (IC/Warehouse) 
  → POST /api/transactions/receive
    ├─ Create Lot (part_id, location_id, qty, expiry_date)
    └─ Create InventoryTransaction (type='receive', lot_id, to_location_id)
       │
       └─ Triggers: DashboardStats recalculate, low stock alert check
          └─ Query: getInventoryValuationReport (new value)
```

#### Flow 2: Stock Issue with FEFO (Outbound)
```
User (IC/Warehouse)
  → POST /api/transactions/issue
    ├─ SELECT lots FOR UPDATE (WHERE part_id, qty > 0)
    │  ORDER BY expiry_date ASC, received_date ASC
    │
    ├─ Option A: Auto-FEFO (lot_id not specified)
    │  └─ Span multiple lots, deduct from oldest-expiring first
    │     └─ Create N InventoryTransaction (is_fefo_override=0)
    │
    └─ Option B: Manual lot selection
       ├─ IF selected_lot ≠ fefo_lot THEN is_fefo_override=1
       │  └─ Require reason
       └─ Deduct from selected_lot
          └─ Create InventoryTransaction (is_fefo_override=0 or 1)
          │
          └─ Triggers: Stock level check, low stock alert
```

#### Flow 3: Request Workflow
```
Engineer (CREATE) [pending]
  ↓ (API: POST /api/requests)
InventoryController (APPROVE) [approved]
  ↓ (API: POST /api/requests/[id]/approve)
Warehouse (COMPLETE) [completed]
  ↓ (API: POST /api/requests/[id]/complete → issue stock)
Part qty decremented, transaction recorded
```

#### Flow 4: Real-Time Dashboard Update
```
SSE: /api/sse/dashboard (connected)
  ├─ getDashboardStats()
  ├─ getRecentTransactions(5)
  ├─ getMonthlyVelocity(12)
  └─ useAlerts (getLowStockAlerts + getExpiringLots)
     │
     └─ Zustand store updated
        └─ React re-render (Client component)
           └─ StatsCard, Chart, TransactionTable, AlertsBanner
```

### Insights Derivable from Data Model

#### 1. **Stock Health Score** (Per Part)
```
HealthScore = (current_stock / min_stock) × 100
- > 200%: Overstock risk
- 100-200%: Optimal
- 50-100%: Monitor
- < 50%: Urgent reorder
```

#### 2. **Inventory Velocity Classification**
```
Fast-moving: total_issued > 50% of avg stock (monthly)
Slow-moving: total_issued < 10% of avg stock (6-month avg)
Obsolete: No activity in last 12 months
```

#### 3. **Lot Age Distribution**
```
Age cohorts:
- < 1 month: Fresh stock
- 1-3 months: Normal cycle
- 3-6 months: Aging
- > 6 months: Risk of obsolesce
```

#### 4. **Location Hotspots**
```
High utilization (>80%): Bottleneck
Medium utilization (50-80%): Normal
Low utilization (<50%): Excess capacity or underused location
```

#### 5. **FEFO Enforcement Score**
```
FEFO Compliance % = (1 - (fefo_overrides / total_issues)) × 100
- > 95%: Excellent compliance
- 80-95%: Good
- < 80%: Review override reasons, retraining needed
```

#### 6. **Part Criticality** (Dual Ranking)
```
By Financial Impact: total_value (high-value items)
By Operational Impact: total_issued (high-consumption items)
Critical items: High on both dimensions
```

---

## 9. SUMMARY: CURRENT CAPABILITIES vs. FUTURE POTENTIAL

### ✅ Capabilities Currently Implemented

| Capability | Status | Use Case |
|----------|--------|----------|
| **FEFO Inventory Management** | ✓ Full | Ensures oldest stock used first; override tracking |
| **Real-time Dashboard** | ✓ SSE-driven | Live stock levels, alerts, transactions |
| **6-Report Suite** | ✓ Complete | Valuation, stock, movement, usage, summary, audit |
| **RBAC Enforcement** | ✓ 4-tier | Role-based API & UI authorization |
| **Request Workflow** | ✓ 3-step | Engineering → IC approval → Warehouse fulfillment |
| **Lot Traceability** | ✓ Full audit trail | Complete transaction history per lot |
| **Low Stock Alerts** | ✓ Real-time | Monitors min_stock thresholds |
| **Expiry Alerts** | ✓ 30-day window | Warns of perishable stock expiring soon |
| **Location Utilization** | ✓ Computed | Capacity % by warehouse |
| **Monthly Trends** | ✓ 12-month chart | Inbound/outbound velocity over time |
| **User Audit Trail** | ✓ Transaction-level | Who, what, when for every action |

### 🔮 Advanced Capabilities Easily Achievable

| Capability | Data Already Available | Implementation Effort |
|----------|-------------------------|----------------------|
| **ABC Analysis** | Usage + Valuation data | Low (add aggregation query) |
| **Reorder Point Auto-calc** | lead_days + historical usage | Medium (ML/statistical model) |
| **Seasonal Forecasting** | 12+ months transaction history | Medium (trend analysis) |
| **Dead Stock Report** | Last activity date | Low (simple WHERE clause) |
| **Supplier Performance** | lead_days + received vs. planned | Medium (external data integration) |
| **Cost Variance Tracking** | Historical part.price changes | Low (add price history table) |
| **What-If Scenarios** | Current inventory snapshot | High (simulation engine) |
| **Demand Forecasting** | Historical issue patterns | High (ML forecasting) |
| **Lot Age Cohort Analysis** | received_date tracking | Low (group by date ranges) |

---

## 10. TECHNICAL NOTES

### Database Performance Considerations
- **Lot table:** Frequent quantity mutations — consider partitioning by location_id
- **InventoryTransaction table:** High volume — implement archival policy (> 2 years)
- **Indexes:** Recommended on `lots(part_id, expiry_date)`, `inventory_transactions(created_at)`, `parts(category)`

### Data Quality Assumptions
- All prices in Part are positive and current
- All transactions have valid user_id (referential integrity enforced)
- No negative quantities in Lot (application constraint)
- Expiry dates only used when part requires tracking (NULL otherwise)

### Real-Time Limitations
- SSE connection may drop in high-latency networks
- Dashboard shows "Reconnecting..." but user can still manually refresh
- Alert fetches have 30-second fallback polling interval
- Report generation is batch (not streaming) — may take seconds for large datasets

---

## CONCLUSION

This inventory management system is a **mature, FEFO-compliant operational platform** with:
- ✅ Robust data model supporting multi-location, multi-lot tracking
- ✅ Comprehensive RBAC preventing unauthorized access
- ✅ Real-time alerts for critical stock conditions
- ✅ Six integrated reports covering financial, operational, and compliance needs
- ✅ Complete audit trail for regulatory compliance

**Primary Use Cases:**
1. Warehouse operations (receive/issue stock with FEFO enforcement)
2. Stock visibility (real-time dashboard + historical reports)
3. Financial reporting (inventory valuation by part/category)
4. Request fulfillment (engineering to warehouse workflow)
5. Compliance & traceability (lot-level audit trail)

**Recommended Next Steps for Enhanced Analytics:**
1. Add ABC classification to parts (drive prioritization)
2. Implement demand forecasting (reduce stockouts)
3. Build supplier performance dashboard (optimize procurement)
4. Create cost center allocation (charge-back analysis)
5. Develop what-if scenario modeling (planning tool)
