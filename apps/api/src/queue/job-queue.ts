import type { ProcessingJobType } from "@field-notes/shared";
import { prisma } from "../db/client.js";

/**
 * Hàng đợi xử lý nền (mục 14.2, kiến trúc 1.3).
 * Triển khai v1: polling bảng ProcessingJob trong PostgreSQL — không cần hạ tầng Cloud Tasks/Pub/Sub khi phát triển local.
 * Production trên GCP có thể thay bằng Cloud Tasks/Pub/Sub bằng cách viết lại các hàm dưới đây,
 * domain logic gọi `enqueueJob`/`registerWorker` không cần đổi.
 */

export interface EnqueueJobInput {
  meetingId: string;
  type: ProcessingJobType;
  payload: Record<string, unknown>;
}

export async function enqueueJob(input: EnqueueJobInput): Promise<string> {
  const job = await prisma.processingJob.create({
    data: {
      meetingId: input.meetingId,
      type: input.type,
      payload: input.payload,
      status: "pending",
    },
  });
  return job.id;
}

export type JobHandler = (job: {
  id: string;
  meetingId: string;
  type: ProcessingJobType;
  payload: Record<string, unknown>;
  attempts: number;
}) => Promise<void>;

const handlers = new Map<ProcessingJobType, JobHandler>();

export function registerWorker(type: ProcessingJobType, handler: JobHandler): void {
  handlers.set(type, handler);
}

const MAX_ATTEMPTS = 5;
let pollingTimer: NodeJS.Timeout | undefined;

async function pollOnce(): Promise<void> {
  const pending = await prisma.processingJob.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 5,
  });

  for (const job of pending) {
    const handler = handlers.get(job.type);
    if (!handler) continue; // chưa có worker đăng ký cho loại job này

    const claimed = await prisma.processingJob.updateMany({
      where: { id: job.id, status: "pending" },
      data: { status: "running", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue; // job đã bị worker khác nhận (an toàn khi chạy nhiều instance)

    try {
      await handler({
        id: job.id,
        meetingId: job.meetingId,
        type: job.type,
        payload: job.payload as Record<string, unknown>,
        attempts: job.attempts + 1,
      });
      await prisma.processingJob.update({ where: { id: job.id }, data: { status: "succeeded" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lỗi không xác định";
      const nextStatus = job.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending";
      await prisma.processingJob.update({
        where: { id: job.id },
        data: { status: nextStatus, errorMessage: message },
      });
    }
  }
}

/** Bắt đầu vòng lặp polling — gọi một lần khi khởi động server. */
export function startJobQueueWorker(intervalMs = 2000): void {
  if (pollingTimer) return;
  pollingTimer = setInterval(() => {
    pollOnce().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("job_queue_poll_error", err);
    });
  }, intervalMs);
}

export function stopJobQueueWorker(): void {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = undefined;
}
