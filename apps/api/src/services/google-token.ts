import { createOAuthClient } from "../auth/google-oauth.js";
import { decryptSecret } from "../auth/token-crypto.js";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import { notFound, validationError } from "../utils/app-error.js";

/**
 * Đổi refresh token (đã mã hoá, lưu ở User.encryptedRefreshToken) thành access token Google mới.
 * Dùng cho các thao tác cần gọi Drive API thay mặt người dùng (vd routes/share.ts,
 * và tương tự sẽ được dùng lại ở job drive_export do đồng nghiệp phụ trách pipeline viết).
 */
export async function getFreshAccessToken(userId: string): Promise<string> {
  const env = loadEnv();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Không tìm thấy người dùng");
  if (!user.encryptedRefreshToken) {
    throw validationError(
      "Tài khoản chưa cấp quyền Google Drive hoặc phiên cấp quyền đã hết hạn, vui lòng đăng nhập lại",
    );
  }

  const refreshToken = decryptSecret(user.encryptedRefreshToken, env.TOKEN_ENCRYPTION_KEY);
  const client = createOAuthClient(env);
  client.setCredentials({ refresh_token: refreshToken });

  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Không lấy được access token mới từ Google");
  return token;
}
