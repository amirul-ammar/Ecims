"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Custom hook for synchronized server time.
 * Fetches server UTC time on mount, calculates offset,
 * and provides a corrected getServerTime() function.
 */
export function useServerTime() {
  const [offset, setOffset] = useState<number>(0);
  const [isReady, setIsReady] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const syncTime = async () => {
      try {
        const clientBefore = Date.now();
        const res = await fetch("/api/time");
        const clientAfter = Date.now();
        const data = await res.json();

        const serverTime = new Date(data.utc).getTime();
        const clientMid = (clientBefore + clientAfter) / 2;
        const newOffset = serverTime - clientMid;

        setOffset(newOffset);
        setIsReady(true);
      } catch (err) {
        console.error("Failed to sync server time:", err);
      }
    };

    // Initial sync
    syncTime();

    // Re-sync every 5 minutes
    intervalRef.current = setInterval(syncTime, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  /**
   * Get the current server time, corrected for clock offset.
   */
  const getServerTime = useCallback((): Date => {
    return new Date(Date.now() + offset);
  }, [offset]);

  return { getServerTime, isReady, offset };
}
