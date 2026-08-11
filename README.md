# ECIMS — Electronic Component Inventory Management System

A web app for tracking electronic components across warehouse locations, with
lot-level expiry tracking, FEFO-based stock allocation, and a role-gated
approval workflow for stock requests.

## Tech stack

- Next.js 16 (App Router) with React 19 and TypeScript
- MySQL via Prisma ORM
- NextAuth for authentication (credentials provider)
- Zustand for client state
- Recharts for charts, jsPDF and SheetJS (xlsx) for report export
- Zod for request validation

## Key features

- FEFO (first-expired, first-out) lot allocation when issuing stock
- Role-based access for four roles: Admin, Inventory Controller, Warehouse, Engineering
- Request/approval workflow for Engineering to request parts and Warehouse to fulfill them
- Real-time dashboard updates via Server-Sent Events
- ABC analysis and other inventory analytics
- PDF and Excel export for stock, valuation, movement, and audit reports

## Getting started

### Prerequisites

- Node.js 20+
- A MySQL database

### Environment variables

Create a `.env.local` file with:

- `DATABASE_URL` — MySQL connection string
- `NEXTAUTH_SECRET` — secret used to sign NextAuth session tokens
- `NEXTAUTH_URL` — base URL of the app (e.g. `http://localhost:3000`)
- `APP_TIMEZONE` — IANA timezone used for date calculations (e.g. `Asia/Kuala_Lumpur`)

### Install and run

```bash
npm install
npx prisma migrate dev
npx prisma generate
npm run db:seed
npm run dev
```

`npm run dev` starts the app at `http://localhost:3000`. `postinstall` also
runs `prisma generate` automatically after `npm install`.

## Screenshots

![Dashboard](docs/screenshots/dashboard.png)

![FEFO-based stock issuance](docs/screenshots/fefo-issuance.png)

## Architecture

- **App Router structure**: pages live under `src/app/<feature>` (e.g.
  `dashboard`, `parts`, `transactions`, `requests`, `reports`); each has a
  matching route under `src/app/api/<feature>` for its data.
- **API routes**: all server logic (Prisma queries, validation, FEFO
  allocation, report generation) lives in `src/app/api/**/route.ts`, with
  shared logic in `src/lib` (`data-ingestion.ts`, `reports.ts`, `rbac.ts`).
- **RBAC enforcement**: `src/middleware.ts` blocks unauthenticated requests
  and enforces coarse route-level role checks (e.g. only the Inventory
  Controller can write to `/api/parts` or `/api/locations`). Each API route
  then calls `requireRole()` from `src/lib/rbac.ts` for the specific
  permission that action requires, using the role matrix defined there.

## About

Final-year university project.
