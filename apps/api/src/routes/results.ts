import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/require-auth.js";
import { assertMeetingOwnership, requireUserId } from "../services/meeting-access.js";
import { notFound, validationError } from "../utils/app-error.js";

const transcriptPatchSchema = z.object({
  originalText: z.string().min(1).optional(),
  translatedText: z.string().min(1).optional(),
  speakerLabel: z.string().min(1).optional(),
});

const topicPatchSchema = z.object({
  title: z.string().min(1).optional(),
  discussionSummary: z.string().min(1).optional(),
  differingViewpoints: z.string().optional(),
  conclusion: z.string().optional(),
  conclusionStatus: z.enum(["concluded", "open"]).optional(),
});

const decisionPatchSchema = z.object({
  content: z.string().min(1).optional(),
  occurredAtOffsetMs: z.coerce.number().int().nonnegative().optional(),
});

const actionItemPatchSchema = z.object({
  content: z.string().min(1).optional(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(["chua_thuc_hien", "dang_thuc_hien", "hoan_thanh"]).optional(),
});

/** Mục 10, 17.3: xem/sửa transcript, topic, quyết định, việc cần làm sau cuộc họp. */
export default async function resultsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);

  // ---- Transcript ----
  fastify.get<{ Params: { id: string } }>("/meetings/:id/transcript", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    return prisma.transcriptSegment.findMany({
      where: { meetingId: meeting.id },
      orderBy: { sequence: "asc" },
    });
  });

  fastify.patch<{ Params: { id: string; segmentId: string } }>(
    "/meetings/:id/transcript/:segmentId",
    async (request) => {
      const userId = requireUserId(request);
      const meeting = await assertMeetingOwnership(request.params.id, userId);
      const parsed = transcriptPatchSchema.safeParse(request.body);
      if (!parsed.success) throw validationError(parsed.error.issues);

      const segment = await prisma.transcriptSegment.findFirst({
        where: { id: request.params.segmentId, meetingId: meeting.id },
      });
      if (!segment) throw notFound("Không tìm thấy đoạn transcript");

      return prisma.transcriptSegment.update({
        where: { id: segment.id },
        data: { ...parsed.data, editedByUser: true },
      });
    },
  );

  // ---- Topics ----
  fastify.get<{ Params: { id: string } }>("/meetings/:id/topics", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    return prisma.topic.findMany({
      where: { meetingId: meeting.id },
      orderBy: { startOffsetMs: "asc" },
    });
  });

  fastify.patch<{ Params: { id: string; topicId: string } }>(
    "/meetings/:id/topics/:topicId",
    async (request) => {
      const userId = requireUserId(request);
      const meeting = await assertMeetingOwnership(request.params.id, userId);
      const parsed = topicPatchSchema.safeParse(request.body);
      if (!parsed.success) throw validationError(parsed.error.issues);

      const topic = await prisma.topic.findFirst({
        where: { id: request.params.topicId, meetingId: meeting.id },
      });
      if (!topic) throw notFound("Không tìm thấy chủ đề");

      return prisma.topic.update({
        where: { id: topic.id },
        data: { ...parsed.data, editedByUser: true },
      });
    },
  );

  // ---- Decisions ----
  fastify.get<{ Params: { id: string } }>("/meetings/:id/decisions", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    return prisma.decision.findMany({
      where: { meetingId: meeting.id },
      orderBy: { occurredAtOffsetMs: "asc" },
    });
  });

  fastify.patch<{ Params: { id: string; decisionId: string } }>(
    "/meetings/:id/decisions/:decisionId",
    async (request) => {
      const userId = requireUserId(request);
      const meeting = await assertMeetingOwnership(request.params.id, userId);
      const parsed = decisionPatchSchema.safeParse(request.body);
      if (!parsed.success) throw validationError(parsed.error.issues);

      const decision = await prisma.decision.findFirst({
        where: { id: request.params.decisionId, meetingId: meeting.id },
      });
      if (!decision) throw notFound("Không tìm thấy quyết định");

      return prisma.decision.update({
        where: { id: decision.id },
        data: { ...parsed.data, editedByUser: true },
      });
    },
  );

  // ---- Action items ----
  fastify.get<{ Params: { id: string } }>("/meetings/:id/action-items", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    return prisma.actionItem.findMany({
      where: { meetingId: meeting.id },
      orderBy: { createdAt: "asc" },
    });
  });

  fastify.patch<{ Params: { id: string; actionItemId: string } }>(
    "/meetings/:id/action-items/:actionItemId",
    async (request) => {
      const userId = requireUserId(request);
      const meeting = await assertMeetingOwnership(request.params.id, userId);
      const parsed = actionItemPatchSchema.safeParse(request.body);
      if (!parsed.success) throw validationError(parsed.error.issues);

      const actionItem = await prisma.actionItem.findFirst({
        where: { id: request.params.actionItemId, meetingId: meeting.id },
      });
      if (!actionItem) throw notFound("Không tìm thấy việc cần làm");

      return prisma.actionItem.update({
        where: { id: actionItem.id },
        data: { ...parsed.data, editedByUser: true },
      });
    },
  );

  // ---- Summary ----
  // GHI CHÚ QUAN TRỌNG (xem báo cáo cuối task): schema hiện chưa có nơi lưu "tóm tắt điều hành"
  // (executive summary / final-summary.v1, mục 2.2 bước 7 trong docs/architecture.md) của một Meeting
  // đã hoàn tất. Tạm thời: nếu meeting chưa 'completed', trả về bản nháp từ getLatestSummarySnapshot
  // (nếu module pipeline/realtime-summary.ts đã sẵn sàng); nếu đã 'completed', trả executiveSummary=null
  // kèm ghi chú rõ ràng để không bịa nội dung. Cần cân nhắc thêm cột Meeting.executiveSummary (hoặc bảng
  // riêng) + migration để route này trả đúng dữ liệu cuối cùng.
  fastify.get<{ Params: { id: string } }>("/meetings/:id/summary", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);

    let draftSummary: unknown = null;
    if (meeting.status !== "completed") {
      try {
        const { getLatestSummarySnapshot } = await import("../pipeline/realtime-summary.js");
        draftSummary = (await Promise.resolve(getLatestSummarySnapshot(meeting.id))) ?? null;
      } catch {
        // Module tóm tắt thời gian thực có thể chưa sẵn sàng — bỏ qua an toàn.
      }
    }

    return {
      meetingId: meeting.id,
      executiveSummary: null,
      draftSummary,
      note:
        "executiveSummary chưa có nơi lưu trữ trong schema hiện tại — cần bổ sung cột Meeting.executiveSummary (hoặc bảng riêng) và migration tương ứng.",
    };
  });
}
