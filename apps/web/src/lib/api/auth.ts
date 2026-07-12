import { apiFetch, ApiError, API_BASE } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

/** Điều hướng cả trang (không phải fetch) — dùng cho `<a href>` hoặc `window.location.href`. */
export function googleLoginUrl(): string {
  return `${API_BASE}/auth/google/start`;
}

/** Trả về `null` khi chưa đăng nhập (401) thay vì ném lỗi, để UI dễ xử lý màn hình đăng nhập. */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    return await apiFetch<AuthUser>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/auth/logout", { method: "POST" });
}
