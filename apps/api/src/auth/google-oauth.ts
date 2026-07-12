import { OAuth2Client } from "google-auth-library";
import type { AppEnv } from "../config/env.js";

/**
 * Phạm vi OAuth tối thiểu cần thiết (mục 5.1, 13.1):
 * - openid/email/profile: định danh người dùng.
 * - drive.file: CHỈ thao tác trên file do chính ứng dụng tạo ra, không xin quyền đọc toàn bộ Drive.
 */
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export function createOAuthClient(env: AppEnv): OAuth2Client {
  return new OAuth2Client({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
  });
}

export function buildGoogleConsentUrl(client: OAuth2Client, state: string): string {
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_OAUTH_SCOPES],
    state,
    include_granted_scopes: true,
  });
}

export interface GoogleTokenResult {
  accessToken: string;
  refreshToken?: string;
  idTokenPayload: {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };
}

export async function exchangeCodeForTokens(
  client: OAuth2Client,
  code: string,
): Promise<GoogleTokenResult> {
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token || !tokens.access_token) {
    throw new Error("Google không trả về id_token hoặc access_token hợp lệ");
  }
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: client._clientId ?? undefined,
  });
  const claims = ticket.getPayload();
  if (!claims?.sub || !claims.email) {
    throw new Error("Không thể xác thực id_token từ Google");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    idTokenPayload: {
      sub: claims.sub,
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
    },
  };
}
