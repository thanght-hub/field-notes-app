import { describe, expect, it } from "vitest";
import { formatDurationSeconds } from "../format";

describe("formatDurationSeconds", () => {
  it("hiển thị MM:SS khi dưới 1 giờ", () => {
    expect(formatDurationSeconds(65)).toBe("01:05");
    expect(formatDurationSeconds(0)).toBe("00:00");
  });

  it("hiển thị HH:MM:SS khi từ 1 giờ trở lên", () => {
    expect(formatDurationSeconds(3661)).toBe("01:01:01");
  });

  it("không nhận giá trị âm", () => {
    expect(formatDurationSeconds(-5)).toBe("00:00");
  });
});
