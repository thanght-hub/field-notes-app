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
 * "Đã upload xong" nghĩa là KHÔNG còn ở các trạng thái transient trước khi có mặt trên server
 * ('local'/'queued'/'uploading') — một chunk đã tiến xa hơn thành 'transcribed' (worker
 * transcribe_chunk chạy nhanh hơn thời điểm gọi hàm này) vẫn được tính là đã upload xong, KHÔNG
 * chặn việc chuyển sang 'processing'. Một chunk 'failed' cũng không chặn vô thời hạn — cuộc họp vẫn
 * cần hoàn tất dù thiếu 1 đoạn audio lỗi (mục 21: không để 1 lỗi làm hỏng toàn bộ pipeline).
 * Gọi ở 3 nơi: routes/meetings.ts (bấm "Kết thúc"), routes/chunks.ts (mỗi chunk vừa 'uploaded'),
 * pipeline/transcribe-chunk.ts (mỗi chunk vừa xử lý xong thành 'transcribed').
 */
export async function maybeTransitionToProcessing(meetingId: string): Promise<void> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || meeting.status !== "uploading") return;

  const pendingChunks = await prisma.audioChunk.count({
    where: { meetingId, status: { in: ["local", "queued", "uploading"] } },
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
