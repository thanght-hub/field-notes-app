import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ChunkUploadAck } from "@field-notes/shared";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/require-auth.js";
import { assertMeetingOwnership, requireUserId } from "../services/meeting-access.js";
import { maybeTransitionToProcessing } from "../services/meeting-lifecycle.js";
import { parseMultipart } from "../services/multipart.js";
import { enqueueJob } from "../queue/job-queue.js";
// Hợp đồng đã thống nhất với đồng nghiệp phụ trách storage — file này có thể chưa tồn tại lúc code
// được viết, nhưng import tĩnh vẫn đúng cú pháp và sẽ hoạt động khi tích hợp.
import { getStorageProvider } from "../storage/index.js";
import { validationError } from "../utils/app-error.js";

const chunkFieldsSchema = z.object({
  sequence: z.coerce.number().int().nonnegative(),
  startOffsetMs: z.coerce.number().int().nonnegative(),
  endOffsetMs: z.coerce.number().int().nonnegative(),
  mimeType: z.string().min(1),
  checksumSha256: z.string().min(1),
});

function extensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "bin";
}

export default async function chunkRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  const env = loadEnv();

  // Mục 15/16: upload chunk âm thanh, idempotent theo (meetingId, sequence), kiểm tra checksum.
  fastify.post<{ Params: { id: string } }>("/meetings/:id/chunks", async (request, reply) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);

    const { fields, file } = await parseMultipart(request);
    const parsedFields = chunkFieldsSchema.safeParse(fields);
    if (!parsedFields.success) throw validationError(parsedFields.error.issues);
    const { sequence, startOffsetMs, endOffsetMs, mimeType, checksumSha256 } = parsedFields.data;

    // Idempotent: nếu chunk (meetingId, sequence) đã tồn tại, trả về bản ghi cũ, KHÔNG xử lý lại.
    const existingChunk = await prisma.audioChunk.findUnique({
      where: { meetingId_sequence: { meetingId: meeting.id, sequence } },
    });
    if (existingChunk) {
      const ack: ChunkUploadAck = { chunkId: existingChunk.id, status: existingChunk.status };
      return ack;
    }

    const actualChecksum = createHash("sha256").update(file.data).digest("hex");
    if (actualChecksum !== checksumSha256) {
      throw validationError("Checksum không khớp");
    }

    const storage = getStorageProvider(env);
    const key = `meetings/${meeting.id}/chunks/${sequence}.${extensionFromMimeType(mimeType)}`;
    const stored = await storage.putObject({ key, data: file.data, contentType: mimeType });

    const chunk = await prisma.audioChunk.create({
      data: {
        meetingId: meeting.id,
        sequence,
        startOffsetMs,
        endOffsetMs,
        mimeType,
        sizeBytes: stored.sizeBytes,
        checksumSha256,
        status: "uploaded",
        storageObjectKey: stored.key,
      },
    });

    await enqueueJob({
      meetingId: meeting.id,
      type: "transcribe_chunk",
      payload: { chunkId: chunk.id },
    });

    // Phòng trường hợp meeting đã ở trạng thái 'uploading' chờ nốt chunk cuối cùng này.
    await maybeTransitionToProcessing(meeting.id);

    const ack: ChunkUploadAck = { chunkId: chunk.id, status: chunk.status };
    reply.status(201);
    return ack;
  });

  // Mục 15: theo dõi trạng thái từng chunk.
  fastify.get<{ Params: { id: string } }>("/meetings/:id/chunks", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    return prisma.audioChunk.findMany({
      where: { meetingId: meeting.id },
      orderBy: { sequence: "asc" },
    });
  });
}
