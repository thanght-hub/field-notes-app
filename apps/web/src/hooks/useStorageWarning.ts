"use client";

import { useEffect, useState } from "react";
import { estimateStorageUsage, type StorageEstimateResult } from "@/lib/offline-db";

const POLL_INTERVAL_MS = 30000;

const INITIAL: StorageEstimateResult = {
  supported: false,
  usedMB: 0,
  quotaMB: 0,
  lowStorage: false,
};

/** Theo dõi dung lượng IndexedDB, cảnh báo khi > 90% quota (mục 15/21). Chỉ chạy khi `active`. */
export function useStorageWarning(active: boolean): StorageEstimateResult {
  const [estimate, setEstimate] = useState<StorageEstimateResult>(INITIAL);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const check = () => {
      void estimateStorageUsage().then((result) => {
        if (!cancelled) setEstimate(result);
      });
    };

    check();
    const timer = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active]);

  return estimate;
}
