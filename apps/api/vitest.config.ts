import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    // Test tích hợp dùng chung 1 Postgres (field_notes_test) — chạy tuần tự để tránh đụng dữ liệu.
    fileParallelism: false,
  },
});
