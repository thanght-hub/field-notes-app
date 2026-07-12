"use client";

import { useEffect } from "react";

/** Đăng ký `public/sw.js` (mục 3.1, kiến trúc 1.2) — chỉ chạy khi trình duyệt hỗ trợ. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Đăng ký thất bại (vd chạy trên http không an toàn) — ứng dụng vẫn hoạt động bình thường,
      // chỉ mất khả năng cache app shell ngoại tuyến.
    });
  }, []);

  return null;
}
