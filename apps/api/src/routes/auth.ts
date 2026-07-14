import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildGoogleConsentUrl,
  createOAuthClient,
  exchangeCodeForTokens,
} from "../auth/google-oauth.js";
import {
  createSessionToken,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "../auth/session.js";
import { encryptSecret } from "../auth/token-crypto.js";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireUserId } from "../services/meeting-access.js";
import { validationError } from "../utils/app-error.js";

const OAUTH_STATE_COOKIE = "fn_oauth_state";
const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 600;

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

/**
 * Đăng nhập bằng Google OAuth 2.0 (mục 5.1). Các route ở đây KHÔNG có preHandler requireAuth
 * (trừ /auth/me) vì đây chính là luồng thiết lập phiên đăng nhập.
 */
export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const env = loadEnv();

  fastify.get("/auth/google/start", async (_request, reply) => {
    const state = randomBytes(24).toString("hex");
    reply.setCookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      signed: true,
      path: "/",
      maxAge: OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
    });

    const client = createOAuthClient(env);
    const consentUrl = buildGoogleConsentUrl(client, state);
    reply.redirect(consentUrl);
  });

  fastify.get("/auth/google/callback", async (request, reply) => {
    const parsedQuery = callbackQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) throw validationError(parsedQuery.error.issues);
    const { code, state } = parsedQuery.data;

    const rawStateCookie = request.cookies[OAUTH_STATE_COOKIE];
    const unsigned = rawStateCookie ? request.unsignCookie(rawStateCookie) : undefined;
    if (!rawStateCookie || !unsigned?.valid || unsigned.value !== state) {
      throw validationError("State OAuth không khớp hoặc đã hết hạn, vui lòng thử đăng nhập lại");
    }
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

    const client = createOAuthClient(env);
    const tokenResult = await exchangeCodeForTokens(client, code);

    // Google chỉ trả về refresh_token ở lần đồng ý (consent) đầu tiên — chỉ ghi đè khi có giá trị mới,
    // tránh xoá mất refresh token cũ vẫn còn dùng được ở các lần đăng nhập lại sau đó (mục 5.1, 20).
    const encryptedRefreshToken = tokenResult.refreshToken
      ? encryptSecret(tokenResult.refreshToken, env.TOKEN_ENCRYPTION_KEY)
      : undefined;

    const user = await prisma.user.upsert({
      where: { googleSub: tokenResult.idTokenPayload.sub },
      create: {
        googleSub: tokenResult.idTokenPayload.sub,
        email: tokenResult.idTokenPayload.email,
        displayName: tokenResult.idTokenPayload.name ?? tokenResult.idTokenPayload.email,
        avatarUrl: tokenResult.idTokenPayload.picture,
        encryptedRefreshToken,
      },
      update: {
        email: tokenResult.idTokenPayload.email,
        displayName: tokenResult.idTokenPayload.name ?? tokenResult.idTokenPayload.email,
        avatarUrl: tokenResult.idTokenPayload.picture,
        ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
      },
    });

    const sessionToken = await createSessionToken(
      { userId: user.id, email: user.email },
      env.SESSION_JWT_SECRET,
    );
    reply.setCookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });

    // Trang trung gian phía frontend (apps/web) hiển thị "Đăng nhập thành công" rồi tự điều hướng tiếp —
    // giả định apps/web sẽ có route /dang-nhap-thanh-cong; nếu không, có thể đổi lại thành `${env.APP_BASE_URL}/`.
    reply.redirect(`${env.APP_BASE_URL}/dang-nhap-thanh-cong`);
  });

  fastify.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  fastify.get("/auth/me", { preHandler: requireAuth }, async (request) => {
    const userId = requireUserId(request);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw validationError("Không tìm thấy người dùng");

    // Không bao giờ trả encryptedRefreshToken ra ngoài (mục 20).
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  });
}
