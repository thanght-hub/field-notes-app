"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "field-notes-theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Quản lý Dark Mode toàn app: tôn trọng `prefers-color-scheme` khi người dùng chưa chọn thủ công,
 * lưu lựa chọn thủ công vào `localStorage` (mục 17 — toggle ở header, kiến trúc 1.2).
 * `ThemeInitScript` đã set class ban đầu trước hydrate; provider này chỉ đồng bộ lại state React.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // localStorage có thể bị chặn (chế độ ẩn danh nghiêm ngặt) — bỏ qua, chỉ mất khả năng nhớ lựa chọn.
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme phải được dùng bên trong <ThemeProvider>");
  return ctx;
}
