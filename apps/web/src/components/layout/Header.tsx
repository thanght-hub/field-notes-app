"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuthContext } from "@/components/auth/AuthProvider";

export function Header() {
  const { user, logout } = useAuthContext();

  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          Field Notes
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Đăng xuất ({user.displayName})
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
