import { NextResponse } from "next/server";
import { getTransactionHistory } from "@/lib/data-ingestion";

/**
 * GET /api/transactions — Fetch transaction history.
 */
export async function GET() {
  try {
    const transactions = await getTransactionHistory();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Transactions fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
