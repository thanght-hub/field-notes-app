"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
