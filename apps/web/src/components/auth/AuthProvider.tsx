"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchCurrentUser, logout as logoutRequest, type AuthUser } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Xác thực dựa trên cookie httpOnly — kiểm tra qua `GET /auth/me` (401 nghĩa là chưa đăng nhập). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const current = await fetchCurrentUser();
      setUser(current);
    } catch {
      // Lỗi mạng khi kiểm tra phiên đăng nhập — coi như chưa đăng nhập, người dùng có thể thử lại
      // bằng cách tải lại trang hoặc đăng nhập lại.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      // Luôn xoá trạng thái đăng nhập phía client kể cả khi gọi API logout thất bại (vd mất mạng) —
      // tránh người dùng bị kẹt ở trạng thái tưởng như vẫn đăng nhập.
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext phải được dùng bên trong <AuthProvider>");
  return ctx;
}
