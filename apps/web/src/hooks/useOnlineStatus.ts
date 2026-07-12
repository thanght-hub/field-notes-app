"use client";

import { useEffect, useState } from "react";

/** Trạng thái mạng của thiết bị (mục 16 — "Đang ghi ngoại tuyến"). */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
