import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MeetingLiveEvent, TranscriptSegment } from "@field-notes/shared";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/require-auth.js";
import { assertMeetingOwnership, requireUserId } from "../services/meeting-access.js";
import { validationError } from "../utils/app-error.js";

const highlightSchema = z.object({ highlighted: z.boolean() });

const POLL_INTERVAL_MS = 1500;

export default async function liveRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);

  fastify.post<{ Params: { id: string; segmentId: string } }>(
    "/meetings/:id/segments/:segmentId/highlight",
    async (request) => {
      const userId = requireUserId(request);
      const meeting = await assertMeetingOwnership(request.params.id, userId);
      const parsed = highlightSchema.safeParse(request.body);
      if (!parsed.success) throw validationError(parsed.error.issues);

      const segment = await prisma.transcriptSegment.findFirst({
        where: { id: request.params.segmentId, meetingId: meeting.id },
      });
      if (!segment) throw validationError("Không tìm thấy đoạn transcript");

      return prisma.transcriptSegment.update({
        where: { id: segment.id },
        data: { highlighted: parsed.data.highlighted },
      });
    },
  );

  // Mục 5.3: theo dõi thời gian thực qua SSE.
  // Chọn giải pháp polling DB đơn giản (mỗi 1.5s) thay vì pub/sub in-memory: v1 chỉ có 1 người dùng
  // theo dõi mỗi cuộc họp, tải thấp, và tránh phải đồng bộ trạng thái in-memory giữa nhiều instance
  // khi scale ngang trên Cloud Run (đã ghi trong docs/architecture.md mục 1.3) — có thể thay bằng
  // cơ chế pub/sub thực sự sau này mà không đổi hợp đồng SSE phía client.
  fastify.get<{ Params: { id: string } }>("/meetings/:id/live", async (request, reply) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);

    // Fastify sẽ không tự gửi phản hồi nữa — ta tự quản lý response thô để streaming SSE.
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (event: MeetingLiveEvent): void => {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    send({ type: "meeting_status", status: meeting.status });

    // Import động + try/catch: module do đồng nghiệp phụ trách pipeline viết song song, có thể
    // chưa tồn tại lúc server này khởi động — không được để lỗi import làm crash route SSE.
    try {
      const { getLatestSummarySnapshot } = await import("../pipeline/realtime-summary.js");
      const snapshot = await Promise.resolve(getLatestSummarySnapshot(meeting.id));
      if (snapshot) send({ type: "summary_snapshot", summary: snapshot });
    } catch {
      // Chưa có worker tóm tắt thời gian thực — bỏ qua an toàn, client vẫn nhận transcript qua polling.
    }

    const latestSegment = await prisma.transcriptSegment.findFirst({
      where: { meetingId: meeting.id },
      orderBy: { sequence: "desc" },
    });
    let lastSeenSequence = latestSegment?.sequence ?? -1;
    let closed = false;

    const interval = setInterval(() => {
      if (closed) return;
      prisma.transcriptSegment
        .findMany({
          where: { meetingId: meeting.id, sequence: { gt: lastSeenSequence } },
          orderBy: { sequence: "asc" },
        })
        .then((segments) => {
          for (const segment of segments) {
            send({
              type: "transcript_segment",
              segment: segment as unknown as TranscriptSegment,
            });
            lastSeenSequence = segment.sequence;
          }
        })
        .catch((err: unknown) => {
          request.log.error({ err: (err as Error).message }, "live_sse_poll_error");
        });
    }, POLL_INTERVAL_MS);

    request.raw.on("close", () => {
      closed = true;
      clearInterval(interval);
      reply.raw.end();
    });
  });
}
