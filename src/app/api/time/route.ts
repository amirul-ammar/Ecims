import { NextResponse } from "next/server";

/**
 * GET /api/time — Returns the server's current UTC timestamp.
 */
export async function GET() {
  return NextResponse.json({
    utc: new Date().toISOString(),
    timezone: process.env.APP_TIMEZONE || "Asia/Kuala_Lumpur",
  });
}
