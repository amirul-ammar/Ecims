import { NextRequest, NextResponse } from "next/server";
import { getAvailableLots } from "@/lib/data-ingestion";

/**
 * GET /api/lots?partId=N — Get available lots for a part in FEFO order.
 */
export async function GET(request: NextRequest) {
  try {
    const partId = request.nextUrl.searchParams.get("partId");
    if (!partId) {
      return NextResponse.json(
        { error: "partId query parameter is required" },
        { status: 400 }
      );
    }
    const lots = await getAvailableLots(parseInt(partId));
    return NextResponse.json(lots);
  } catch (error) {
    console.error("Lots fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lots" },
      { status: 500 }
    );
  }
}
