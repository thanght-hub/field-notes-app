import { describe, expect, it } from "vitest";
import { toHex } from "../recorder";

describe("toHex", () => {
  it("chuyển ArrayBuffer thành chuỗi hex viết thường", () => {
    const buffer = new Uint8Array([0, 255, 16, 1]).buffer;
    expect(toHex(buffer)).toBe("00ff1001");
  });

  it("trả về chuỗi rỗng cho buffer rỗng", () => {
    expect(toHex(new ArrayBuffer(0))).toBe("");
  });
});
