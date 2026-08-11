import { NextResponse } from "next/server";
import {
  getDashboardStats,
  getRecentTransactions,
  getMonthlyVelocity,
  getLowStockAlerts,
  getExpiringLots,
} from "@/lib/data-ingestion";

/**
 * GET /api/sse/dashboard — Server-Sent Events endpoint.
 * Streams dashboard stats every 30 seconds. The stream stays open
 * until the client disconnects (AbortSignal fires).
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendEvent = (data: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          isClosed = true;
        }
      };

      const close = () => {
        if (isClosed) return;
        isClosed = true;
        try { controller.close(); } catch { /* already closed */ }
      };

      // Detect client disconnect via AbortSignal
      signal.addEventListener("abort", close, { once: true });

      const fetchAndSend = async () => {
        if (isClosed) return;
        try {
          const [stats, recentTransactions, monthlyData, lowStock, expiring] =
            await Promise.all([
              getDashboardStats(),
              getRecentTransactions(5),
              getMonthlyVelocity(12),
              getLowStockAlerts(),
              getExpiringLots(30),
            ]);

          sendEvent({
            type: "dashboard_update",
            stats,
            recentTransactions,
            monthlyData,
            alerts: {
              lowStock,
              expiring,
              totalAlerts: lowStock.length + expiring.length,
            },
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("SSE fetch error:", error);
          // Don't sendEvent on error — controller may be closing
        }
      };

      // Send initial data immediately
      await fetchAndSend();

      // Refresh every 30 seconds (was 5s — too aggressive)
      const interval = setInterval(fetchAndSend, 30_000);

      // Heartbeat every 20s to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        if (isClosed) { clearInterval(heartbeat); return; }
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          close();
        }
      }, 20_000);

      // Keep the stream open until aborted
     await new Promise<void>((resolve) => {
  signal.addEventListener("abort", () => resolve(), { once: true });
});
      clearInterval(interval);
      clearInterval(heartbeat);
      close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
