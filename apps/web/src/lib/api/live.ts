import type { MeetingLiveEvent } from "@field-notes/shared";
import { API_BASE } from "./client";

export type LiveConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

/**
 * Đăng ký nhận sự kiện thời gian thực của một cuộc họp (`GET /api/meetings/:id/live`, SSE).
 *
 * QUYẾT ĐỊNH KỸ THUẬT: dùng `fetch` + `ReadableStream` đọc thủ công `text/event-stream`
 * thay vì `EventSource` chuẩn. Lý do: `EventSource` không cho tuỳ chỉnh header và hỗ trợ
 * `withCredentials` (cookie cross-origin) không đồng nhất giữa các trình duyệt khi
 * `NEXT_PUBLIC_API_BASE_URL` khác origin với web app; `fetch` cho phép luôn gửi
 * `credentials: 'include'` một cách tường minh và tự viết cơ chế reconnect/backoff đơn giản,
 * nhất quán với phần còn lại của ứng dụng (không cần thêm thư viện polyfill).
 */
export function subscribeMeetingLive(
  meetingId: string,
  onEvent: (event: MeetingLiveEvent) => void,
  onStatusChange?: (status: LiveConnectionStatus) => void,
): () => void {
  let closed = false;
  let controller: AbortController | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelayMs = 1000;
  const MAX_RECONNECT_DELAY_MS = 30000;

  function parseAndDispatchEvents(rawBuffer: string): string {
    let buffer = rawBuffer;
    let sepIndex = buffer.indexOf("\n\n");
    while (sepIndex !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart());
      if (dataLines.length > 0) {
        const dataStr = dataLines.join("\n");
        try {
          const parsedEvent = JSON.parse(dataStr) as MeetingLiveEvent;
          onEvent(parsedEvent);
        } catch {
          // Bỏ qua khung dữ liệu SSE không hợp lệ (không nên chặn toàn bộ luồng).
        }
      }
      sepIndex = buffer.indexOf("\n\n");
    }
    return buffer;
  }

  async function connect() {
    if (closed) return;
    controller = new AbortController();
    onStatusChange?.(reconnectDelayMs > 1000 ? "reconnecting" : "connecting");

    try {
      const res = await fetch(`${API_BASE}/api/meetings/${meetingId}/live`, {
        credentials: "include",
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Kết nối SSE thất bại (status ${res.status})`);
      }

      onStatusChange?.("open");
      reconnectDelayMs = 1000;

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done || closed) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseAndDispatchEvents(buffer);
      }
    } catch {
      // Lỗi mạng/abort — sẽ thử kết nối lại bên dưới trừ khi đã đóng chủ động.
    }

    if (!closed) {
      reconnectTimer = setTimeout(() => {
        void connect();
      }, reconnectDelayMs);
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
    }
  }

  void connect();

  return function unsubscribe() {
    closed = true;
    controller?.abort();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    onStatusChange?.("closed");
  };
}
