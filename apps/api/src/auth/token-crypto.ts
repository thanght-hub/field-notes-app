import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Mã hoá refresh token Google trước khi lưu DB (mục 20: "Không lưu OAuth access token dạng plain text").
 * AES-256-GCM, khoá dẫn xuất từ TOKEN_ENCRYPTION_KEY bằng SHA-256 để luôn đủ 32 byte.
 */
export function encryptSecret(plainText: string, encryptionKey: string): string {
  const key = createHash("sha256").update(encryptionKey).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(cipherText: string, encryptionKey: string): string {
  const key = createHash("sha256").update(encryptionKey).digest();
  const raw = Buffer.from(cipherText, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
