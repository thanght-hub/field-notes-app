import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../src/auth/token-crypto.js";
import { createSessionToken, verifySessionToken } from "../src/auth/session.js";

describe("mã hoá refresh token (mục 20 — không lưu token dạng plain text)", () => {
  it("mã hoá rồi giải mã trả lại đúng chuỗi gốc", () => {
    const secret = "1//refresh-token-gia-lap-cua-google";
    const key = "chia-khoa-ma-hoa-du-32-ky-tu-tro-len";
    const cipherText = encryptSecret(secret, key);
    expect(cipherText).not.toContain(secret);
    expect(decryptSecret(cipherText, key)).toBe(secret);
  });

  it("giải mã sai khoá phải lỗi thay vì âm thầm trả dữ liệu sai", () => {
    const cipherText = encryptSecret("bi-mat", "khoa-dung-32-ky-tu-tro-len-ok!!!");
    expect(() => decryptSecret(cipherText, "khoa-sai-32-ky-tu-tro-len-khac!!")).toThrow();
  });
});

describe("phiên đăng nhập JWT", () => {
  it("tạo token rồi verify trả lại đúng payload", async () => {
    const secret = "test-session-secret-at-least-32-chars-long";
    const token = await createSessionToken({ userId: "u1", email: "a@b.com" }, secret);
    const payload = await verifySessionToken(token, secret);
    expect(payload).toEqual({ userId: "u1", email: "a@b.com" });
  });

  it("token ký bằng secret khác thì verify thất bại (trả null, không throw)", async () => {
    const token = await createSessionToken({ userId: "u1", email: "a@b.com" }, "secret-dung-32-ky-tu-tro-len-ne");
    const payload = await verifySessionToken(token, "secret-khac-32-ky-tu-tro-len-nhe");
    expect(payload).toBeNull();
  });
});
