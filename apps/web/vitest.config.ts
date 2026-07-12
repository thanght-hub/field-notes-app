import { defineConfig } from "vitest/config";
import path from "node:path";

// Chỉ chạy unit test cho logic thuần (lib/), không test component React (theo yêu cầu v1).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
