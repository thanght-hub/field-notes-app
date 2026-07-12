import type { FastifyReply, FastifyRequest } from "fastify";
import { verifySessionToken, SESSION_COOKIE_NAME } from "../auth/session.js";
import { loadEnv } from "../config/env.js";
import { unauthorized } from "../utils/app-error.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUserId?: string;
  }
}

/** Middleware xác thực bắt buộc — mọi route dữ liệu người dùng phải qua đây trước khi kiểm tra quyền sở hữu. */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = request.cookies[SESSION_COOKIE_NAME];
  if (!token) throw unauthorized();

  const env = loadEnv();
  const session = await verifySessionToken(token, env.SESSION_JWT_SECRET);
  if (!session) throw unauthorized();

  request.currentUserId = session.userId;
}
