import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/require-auth.js";
import { assertMeetingOwnership, requireUserId } from "../services/meeting-access.js";
import { getFreshAccessToken } from "../services/google-token.js";
// Hợp đồng đã thống nhất với đồng nghiệp phụ trách providers Google — file này có thể chưa tồn tại
// lúc code được viết, nhưng import tĩnh vẫn đúng cú pháp và sẽ hoạt động khi tích hợp.
import { createDriveProvider } from "../providers/index.js";
import { notFound, validationError } from "../utils/app-error.js";

const shareVisibilitySchema = z.object({
  visibility: z.enum(["private", "anyone_with_link"]),
});

export default async function shareRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);

  fastify.get<{ Params: { id: string } }>("/meetings/:id/share", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    return prisma.shareLink.findFirst({ where: { meetingId: meeting.id } });
  });

  // Bắt buộc client gửi rõ `visibility` — route này KHÔNG được tự ý mặc định 'anyone_with_link'.
  // Mặc định 'private' khi ShareLink mới được tạo là trách nhiệm của job drive_export (mục 2.2 bước 11).
  fastify.post<{ Params: { id: string } }>("/meetings/:id/share", async (request) => {
    const userId = requireUserId(request);
    const meeting = await assertMeetingOwnership(request.params.id, userId);
    const parsed = shareVisibilitySchema.safeParse(request.body);
    if (!parsed.success) throw validationError(parsed.error.issues);

    const shareLink = await prisma.shareLink.findFirst({ where: { meetingId: meeting.id } });
    if (!shareLink) {
      throw notFound(
        "Cuộc họp chưa có ShareLink — cần hoàn tất xuất Google Drive trước khi đổi quyền chia sẻ",
      );
    }

    const accessToken = await getFreshAccessToken(userId);
    const drive = createDriveProvider(accessToken);
    const url = await drive.setShareVisibility(shareLink.driveFileId, parsed.data.visibility);

    return prisma.shareLink.update({
      where: { id: shareLink.id },
      data: { visibility: parsed.data.visibility, url },
    });
  });
}
