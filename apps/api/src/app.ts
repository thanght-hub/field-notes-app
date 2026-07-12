import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { loadEnv } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRoutes from "./routes/auth.js";
import workspaceRoutes from "./routes/workspaces.js";
import meetingRoutes from "./routes/meetings.js";
import chunkRoutes from "./routes/chunks.js";
import notesRoutes from "./routes/notes.js";
import liveRoutes from "./routes/live.js";
import resultsRoutes from "./routes/results.js";
import shareRoutes from "./routes/share.js";

/**
 * Dựng Fastify app đầy đủ (routes + middleware) mà KHÔNG bind cổng — tách riêng khỏi
 * `src/index.ts` để test tích hợp có thể dùng `app.inject()` thay vì mở cổng TCP thật.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();

  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Không bao giờ log transcript/token nhạy cảm (mục 20).
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
  });

  await fastify.register(cors, { origin: env.APP_BASE_URL, credentials: true });
  await fastify.register(cookie, { secret: env.SESSION_JWT_SECRET });
  await fastify.register(multipart, {
    limits: { fileSize: Math.max(env.MAX_ATTACHMENT_MB, 25) * 1024 * 1024 },
  });
  await fastify.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  fastify.setErrorHandler(errorHandler);

  fastify.get("/health", async () => ({ ok: true }));

  await fastify.register(authRoutes);
  await fastify.register(workspaceRoutes, { prefix: "/api" });
  await fastify.register(meetingRoutes, { prefix: "/api" });
  await fastify.register(chunkRoutes, { prefix: "/api" });
  await fastify.register(notesRoutes, { prefix: "/api" });
  await fastify.register(liveRoutes, { prefix: "/api" });
  await fastify.register(resultsRoutes, { prefix: "/api" });
  await fastify.register(shareRoutes, { prefix: "/api" });

  return fastify;
}
