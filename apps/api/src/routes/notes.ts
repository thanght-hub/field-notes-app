import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/require-auth.js";
import { assertMeetingOwnership, requireUserId } from "../services/meeting-access.js";
import { parseMultipart } from "../services/multipart.js";
// Hợp đồng đã thống nhất với đồng nghiệp phụ trách storage — file này có thể chưa tồn tại lúc code
// được viết, nhưng import tĩnh vẫn đúng cú pháp và sẽ hoạt động khi tích hợp.
import { getStorageProvider } from "../storage/index.js";
import { notFound, validationError } from "../utils/app-error.js";

const textNoteSchema = z.object({
  type: z.literal("text"),
  content: z.string().min(1),
  occurredAtOffsetMs: z.coerce.number().int().nonnegative(),
  nearestSegmentId: z.string().uuid().optional(),
});

const attachmentFieldsSchema = z.object({
  occurredAtOffsetMs: z.coerce.number().int().nonnegative(),
  type: z.enum(["photo", "document"]),
});

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export default async function notesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  const env = loadEnv();

  fastify.post<{ Params: { id: string } }>("/meetings/:id/notes", async (request, reply) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    const parsed = textNoteSchema.safeParse(request.body);
    if (!parsed.success) throw validationError(parsed.error.issues);

    const note = await prisma.manualNote.create({
      data: {
        meetingId: meeting.id,
        type: parsed.data.type,
        content: parsed.data.content,
        occurredAtOffsetMs: parsed.data.occurredAtOffsetMs,
        nearestSegmentId: parsed.data.nearestSegmentId,
      },
    });
    reply.status(201);
    return note;
  });

  // Mục 20: whitelist mimetype + giới hạn kích thước theo env.MAX_ATTACHMENT_MB.
  fastify.post<{ Params: { id: string } }>("/meetings/:id/attachments", async (request, reply) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);

    const { fields, file } = await parseMultipart(request);
    const parsedFields = attachmentFieldsSchema.safeParse(fields);
    if (!parsedFields.success) throw validationError(parsedFields.error.issues);

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimeType)) {
      throw validationError("Định dạng file đính kèm không được hỗ trợ");
    }
    const maxBytes = env.MAX_ATTACHMENT_MB * 1024 * 1024;
    if (file.data.byteLength > maxBytes) {
      throw validationError(`File vượt quá dung lượng tối đa ${env.MAX_ATTACHMENT_MB}MB`);
    }

    const storage = getStorageProvider(env);
    const key = `meetings/${meeting.id}/attachments/${Date.now()}-${file.filename}`;
    const stored = await storage.putObject({ key, data: file.data, contentType: file.mimeType });

    const attachment = await prisma.attachment.create({
      data: {
        meetingId: meeting.id,
        fileName: file.filename,
        mimeType: file.mimeType,
        sizeBytes: stored.sizeBytes,
        storageObjectKey: stored.key,
      },
    });

    const note = await prisma.manualNote.create({
      data: {
        meetingId: meeting.id,
        type: parsedFields.data.type,
        occurredAtOffsetMs: parsedFields.data.occurredAtOffsetMs,
        attachmentId: attachment.id,
      },
    });

    reply.status(201);
    return { note, attachment };
  });

  fastify.get<{ Params: { id: string } }>("/meetings/:id/notes", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    return prisma.manualNote.findMany({
      where: { meetingId: meeting.id },
      include: { attachment: true },
      orderBy: { createdAt: "asc" },
    });
  });

  fastify.get<{ Params: { id: string; attachmentId: string } }>(
    "/meetings/:id/attachments/:attachmentId/content",
    async (request, reply) => {
      const userId = requireUserId(request);
      const meeting = await assertMeetingOwnership(request.params.id, userId);
      const attachment = await prisma.attachment.findFirst({
        where: { id: request.params.attachmentId, meetingId: meeting.id },
      });
      if (!attachment) throw notFound("Không tìm thấy file đính kèm");

      const storage = getStorageProvider(env);
      const data = await storage.getObject(attachment.storageObjectKey);
      reply.header("Content-Type", attachment.mimeType);
      reply.header(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
      );
      return reply.send(Buffer.from(data));
    },
  );
}
