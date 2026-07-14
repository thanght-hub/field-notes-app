import type { FastifyRequest } from "fastify";
import { prisma } from "../db/client.js";
import { notFound, unauthorized } from "../utils/app-error.js";

/**
 * Đọc userId đã xác thực từ request (đã đi qua middleware/require-auth.ts).
 * Chỉ nên throw 401 trong trường hợp không mong đợi vì mọi route dùng hàm này
 * đều đã có preHandler requireAuth phía trước.
 */
export function requireUserId(request: FastifyRequest): string {
  if (!request.currentUserId) throw unauthorized();
  return request.currentUserId;
}

/**
 * Kiểm tra quyền sở hữu cuộc họp (mục 20: "Kiểm tra quyền sở hữu tài nguyên trên mọi API").
 * Trả về bản ghi Meeting đầy đủ (Prisma) nếu meeting tồn tại và thuộc về userId, ngược lại throw 404.
 * Cố ý trả 404 thay vì 403 khi không phải chủ sở hữu — tránh lộ thông tin meeting đó có tồn tại hay không.
 */
export async function assertMeetingOwnership(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, userId } });
  if (!meeting) throw notFound("Không tìm thấy cuộc họp hoặc bạn không có quyền truy cập");
  return meeting;
}

/** Tương tự assertMeetingOwnership nhưng cho Workspace (mục 20). */
export async function assertWorkspaceOwnership(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerUserId: userId },
  });
  if (!workspace) throw notFound("Không tìm thấy workspace hoặc bạn không có quyền truy cập");
  return workspace;
}
