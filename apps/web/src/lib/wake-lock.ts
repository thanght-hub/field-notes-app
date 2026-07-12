/**
 * Wake Lock API (mục 15) — chống tự khoá màn hình khi đang ghi âm.
 * Nhiều trình duyệt (đặc biệt Safari cũ) không hỗ trợ — khi đó trả `supported: false`
 * để UI hiển thị hướng dẫn người dùng tự tắt khoá màn hình trong Cài đặt thiết bị.
 */

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

// Dùng intersection thay vì `extends Navigator` để tránh xung đột nếu phiên bản `lib.dom.d.ts`
// đang dùng đã tự khai báo sẵn `Navigator.wakeLock` với hình dạng hơi khác (API còn khá mới).
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export interface WakeLockHandle {
  supported: boolean;
  release: () => Promise<void>;
}

export async function requestWakeLock(): Promise<WakeLockHandle> {
  const nav = typeof navigator !== "undefined" ? (navigator as NavigatorWithWakeLock) : undefined;

  if (!nav?.wakeLock) {
    return { supported: false, release: async () => {} };
  }

  try {
    const sentinel = await nav.wakeLock.request("screen");
    return {
      supported: true,
      release: async () => {
        try {
          await sentinel.release();
        } catch {
          // Sentinel có thể đã được trình duyệt tự release trước đó (vd đổi tab) — bỏ qua.
        }
      },
    };
  } catch {
    return { supported: false, release: async () => {} };
  }
}
