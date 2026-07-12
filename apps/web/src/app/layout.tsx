import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeInitScript } from "@/components/theme/ThemeInitScript";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Field Notes — Trợ lý cuộc họp",
  description: "Ghi âm, dịch và tóm tắt cuộc họp Việt - Trung",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <Providers>
          <ServiceWorkerRegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
