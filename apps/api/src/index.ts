import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { loadEnv } from "./config/env.js";
import { prisma } from "./db/client.js";
import { errorHandler } from "./middleware/error-handler.js";
import { startJobQueueWorker, stopJobQueueWorker } from "./queue/job-queue.js";
import authRoutes from "./routes/auth.js";
import workspaceRoutes from "./routes/workspaces.js";
import meetingRoutes from "./routes/meetings.js";
import chunkRoutes from "./routes/chunks.js";
import notesRoutes from "./routes/notes.js";
import liveRoutes from "./routes/live.js";
import resultsRoutes from "./routes/results.js";
import shareRoutes from "./routes/share.js";

async function main(): Promise<void> {
  const env = loadEnv();

  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Không bao giờ log transcript/token nhạy cảm (mục 20).
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
  });

  await fastify.register(cors, { origin: env.APP_BASE_URL, credentials: true });
  // secret dùng để ký cookie state OAuth tạm thời (routes/auth.ts, cookie "fn_oauth_state") —
  // tái dùng SESSION_JWT_SECRET sẵn có thay vì thêm 1 biến môi trường riêng.
  await fastify.register(cookie, { secret: env.SESSION_JWT_SECRET });
  await fastify.register(multipart, {
    limits: { fileSize: Math.max(env.MAX_ATTACHMENT_MB, 25) * 1024 * 1024 },
  });
  await fastify.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  fastify.setErrorHandler(errorHandler);

  fastify.get("/health", async () => ({ ok: true }));

  // /auth/* không có prefix /api (theo đặc tả). Các route còn lại đều dưới /api.
  await fastify.register(authRoutes);
  await fastify.register(workspaceRoutes, { prefix: "/api" });
  await fastify.register(meetingRoutes, { prefix: "/api" });
  await fastify.register(chunkRoutes, { prefix: "/api" });
  await fastify.register(notesRoutes, { prefix: "/api" });
  await fastify.register(liveRoutes, { prefix: "/api" });
  await fastify.register(resultsRoutes, { prefix: "/api" });
  await fastify.register(shareRoutes, { prefix: "/api" });

  // Đăng ký worker xử lý nền (transcribe_chunk/realtime_summary/finalize_meeting/drive_export) —
  // do đồng nghiệp khác viết song song ở apps/api/src/pipeline/*.ts. Import động để server backend
  // (routes) vẫn khởi động và hoạt động bình thường ngay cả khi nhánh pipeline chưa xong.
  try {
    await import("./pipeline/index.js");
  } catch {
    fastify.log.warn("pipeline chưa sẵn sàng, bỏ qua đăng ký worker xử lý nền");
  }

  startJobQueueWorker();

  await fastify.listen({ port: env.PORT, host: "0.0.0.0" });

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopJobQueueWorker();
    await fastify.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("fatal_startup_error", error);
  process.exit(1);
});
