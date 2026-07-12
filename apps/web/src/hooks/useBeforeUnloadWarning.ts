"use client";

import { useEffect } from "react";

/**
 * Cảnh báo khi người dùng cố đóng tab/rời trang trong lúc đang ghi âm (mục 21).
 * Trình duyệt không cho tuỳ chỉnh nội dung hộp thoại xác nhận (giới hạn bảo mật), nhưng việc
 * gọi `preventDefault()` + gán `returnValue` sẽ khiến trình duyệt hiển thị hộp thoại xác nhận rời trang.
 */
export function useBeforeUnloadWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
