import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { prisma } from "./db/client.js";
import { startJobQueueWorker, stopJobQueueWorker } from "./queue/job-queue.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const fastify = await buildApp();

  // Đăng ký worker xử lý nền (transcribe_chunk/realtime_summary/finalize_meeting/drive_export).
  await import("./pipeline/index.js");

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
  console.error("fatal_startup_error", error);
  process.exit(1);
});
