import { describe, expect, it } from "vitest";
import { computeBackoffMs } from "../sync-queue";

describe("computeBackoffMs", () => {
  it("không chờ khi chưa từng thử lại", () => {
    expect(computeBackoffMs(0)).toBe(0);
  });

  it("tăng tuyến tính theo số lần thử (attempts * 2s)", () => {
    expect(computeBackoffMs(1)).toBe(2000);
    expect(computeBackoffMs(3)).toBe(6000);
  });

  it("không vượt quá mức trần 60s", () => {
    expect(computeBackoffMs(100)).toBe(60000);
  });
});
