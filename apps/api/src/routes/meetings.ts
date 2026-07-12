import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { SUPPORTED_SOURCE_LANGUAGES } from "@field-notes/shared";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/require-auth.js";
import {
  assertMeetingOwnership,
  assertWorkspaceOwnership,
  requireUserId,
} from "../services/meeting-access.js";
import { maybeTransitionToProcessing } from "../services/meeting-lifecycle.js";
import { notFound, validationError } from "../utils/app-error.js";

const MEETING_STATUS_VALUES = [
  "draft",
  "recording",
  "paused",
  "uploading",
  "processing",
  "completed",
  "failed",
] as const;

const listMeetingsQuerySchema = z.object({
  query: z.string().min(1).optional(),
  workspaceId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date phải theo định dạng YYYY-MM-DD")
    .optional(),
  status: z.enum(MEETING_STATUS_VALUES).optional(),
});

const createMeetingSchema = z.object({
  title: z.string().min(1),
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  location: z.string().optional(),
  initialNote: z.string().optional(),
  sourceLanguages: z.array(z.enum(SUPPORTED_SOURCE_LANGUAGES)).optional(),
});

const consentSchema = z.object({ confirmed: z.literal(true) });

export default async function meetingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);

  // Mục 12: tìm kiếm/lọc cuộc họp theo công ty (workspace)/dự án/nhóm/ngày/trạng thái.
  fastify.get("/meetings", async (request) => {
    const userId = requireUserId(request);
    const parsed = listMeetingsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw validationError(parsed.error.issues);
    const { query, workspaceId, projectId, groupId, date, status } = parsed.data;

    const conditions: Prisma.MeetingWhereInput[] = [{ userId }];
    if (workspaceId) conditions.push({ workspaceId });
    if (projectId) conditions.push({ projectId });
    if (groupId) conditions.push({ groupId });
    if (status) conditions.push({ status });
    if (query) {
      conditions.push({
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { location: { contains: query, mode: "insensitive" } },
          { initialNote: { contains: query, mode: "insensitive" } },
        ],
      });
    }
    if (date) {
      // Giả định: "ngày" của cuộc họp là startedAt nếu đã bắt đầu ghi âm, ngược lại dùng createdAt
      // (cho các cuộc họp còn ở trạng thái 'draft' chưa có startedAt).
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      conditions.push({
        OR: [
          { startedAt: { gte: start, lt: end } },
          { AND: [{ startedAt: null }, { createdAt: { gte: start, lt: end } }] },
        ],
      });
    }

    return prisma.meeting.findMany({
      where: { AND: conditions },
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.post("/meetings", async (request, reply) => {
    const userId = requireUserId(request);
    const parsed = createMeetingSchema.safeParse(request.body);
    if (!parsed.success) throw validationError(parsed.error.issues);
    const { title, workspaceId, projectId, groupId, location, initialNote, sourceLanguages } =
      parsed.data;

    await assertWorkspaceOwnership(workspaceId, userId);

    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
      if (!project) throw notFound("Không tìm thấy dự án trong workspace này");
    }
    if (groupId) {
      const group = await prisma.group.findFirst({ where: { id: groupId, workspaceId } });
      if (!group) throw notFound("Không tìm thấy nhóm trong workspace này");
    }

    const meeting = await prisma.meeting.create({
      data: {
        title,
        workspaceId,
        projectId,
        groupId,
        location,
        initialNote,
        userId,
        status: "draft",
        sourceLanguages: sourceLanguages ?? [],
      },
    });
    reply.status(201);
    return meeting;
  });

  fastify.get<{ Params: { id: string } }>("/meetings/:id", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    const [segmentCount, chunkCount] = await Promise.all([
      prisma.transcriptSegment.count({ where: { meetingId: meeting.id } }),
      prisma.audioChunk.count({ where: { meetingId: meeting.id } }),
    ]);
    return { ...meeting, segmentCount, chunkCount };
  });

  // Mục 5.1: xác nhận đã thông báo ghi âm + đồng ý xử lý cloud trước khi được phép bắt đầu.
  fastify.post<{ Params: { id: string } }>("/meetings/:id/consent", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    const parsed = consentSchema.safeParse(request.body);
    if (!parsed.success) throw validationError(parsed.error.issues);

    return prisma.meeting.update({
      where: { id: meeting.id },
      data: { consentConfirmedAt: new Date() },
    });
  });

  fastify.post<{ Params: { id: string } }>("/meetings/:id/start", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    if (!meeting.consentConfirmedAt) {
      throw validationError("Cần xác nhận đồng ý trước khi bắt đầu");
    }

    return prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: "recording",
        startedAt: meeting.startedAt ?? new Date(),
      },
    });
  });

  fastify.post<{ Params: { id: string } }>("/meetings/:id/pause", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    if (meeting.status !== "recording") {
      throw validationError("Chỉ có thể tạm dừng khi cuộc họp đang ở trạng thái đang ghi âm");
    }
    return prisma.meeting.update({ where: { id: meeting.id }, data: { status: "paused" } });
  });

  fastify.post<{ Params: { id: string } }>("/meetings/:id/resume", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    if (meeting.status !== "paused") {
      throw validationError("Chỉ có thể tiếp tục khi cuộc họp đang ở trạng thái tạm dừng");
    }
    return prisma.meeting.update({ where: { id: meeting.id }, data: { status: "recording" } });
  });

  fastify.post<{ Params: { id: string } }>("/meetings/:id/end", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);

    // Giả định: chỉ cho phép "Kết thúc" khi cuộc họp đang ghi âm hoặc đang tạm dừng.
    if (meeting.status !== "recording" && meeting.status !== "paused") {
      throw validationError("Chỉ có thể kết thúc cuộc họp đang ghi âm hoặc đang tạm dừng");
    }

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { endedAt: meeting.endedAt ?? new Date(), status: "uploading" },
    });

    // Nếu mọi chunk đã 'uploaded' (hoặc không có chunk nào), chuyển ngay sang 'processing' + enqueue finalize.
    // Nếu còn chunk chưa upload xong, giữ nguyên 'uploading' — routes/chunks.ts sẽ tự kiểm tra lại
    // điều kiện này mỗi khi một chunk cuối cùng chuyển sang 'uploaded'.
    await maybeTransitionToProcessing(meeting.id);

    return prisma.meeting.findUniqueOrThrow({ where: { id: meeting.id } });
  });

  fastify.delete<{ Params: { id: string } }>("/meetings/:id", async (request, reply) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    // Prisma schema đã có onDelete: Cascade cho hầu hết các quan hệ con của Meeting.
    await prisma.meeting.delete({ where: { id: meeting.id } });
    reply.status(204);
    return reply.send();
  });
}
