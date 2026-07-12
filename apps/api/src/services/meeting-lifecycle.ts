import { prisma } from "../db/client.js";
import { enqueueJob } from "../queue/job-queue.js";

/**
 * Chuyển Meeting từ 'uploading' sang 'processing' + enqueue job 'finalize_meeting' (mục 6.2, 15, 16)
 * ngay khi TẤT CẢ AudioChunk của cuộc họp đã ở trạng thái 'uploaded' (hoặc không có chunk nào).
 *
 * Được gọi ở 2 nơi:
 *  - routes/meetings.ts khi người dùng bấm "Kết thúc" (nếu lúc đó mọi chunk đã upload xong).
 *  - routes/chunks.ts mỗi khi 1 chunk vừa chuyển sang 'uploaded' (phòng trường hợp đó là chunk cuối
 *    còn thiếu trong khi meeting đã ở trạng thái 'uploading' chờ sẵn).
 *
 * Dùng updateMany với điều kiện status hiện tại = 'uploading' để đảm bảo chỉ một lời gọi duy nhất
 * (trong số nhiều lời gọi đua nhau) thực sự chuyển trạng thái và enqueue job — tránh enqueue trùng.
 *
 * Lưu ý: điều kiện "đã uploaded" được hiểu chặt theo đặc tả (status === 'uploaded'), không tính
 * các chunk đã tiến xa hơn thành 'transcribed' — nếu worker transcribe_chunk chạy nhanh hơn và đổi
 * status trước khi hàm này kiểm tra xong thì sẽ cần một lần gọi maybeTransitionToProcessing khác để
 * bắt kịp (không thuộc phạm vi route ở đây, do worker transcribe_chunk phụ trách).
 */
export async function maybeTransitionToProcessing(meetingId: string): Promise<void> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || meeting.status !== "uploading") return;

  const pendingChunks = await prisma.audioChunk.count({
    where: { meetingId, status: { not: "uploaded" } },
  });
  if (pendingChunks > 0) return;

  const updated = await prisma.meeting.updateMany({
    where: { id: meetingId, status: "uploading" },
    data: { status: "processing" },
  });
  if (updated.count > 0) {
    await enqueueJob({ meetingId, type: "finalize_meeting", payload: {} });
  }
}
