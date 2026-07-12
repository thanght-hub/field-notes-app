/**
 * Import side-effect duy nhất để đăng ký toàn bộ worker xử lý nền (mục 6, 7, 10, 11).
 * Nơi khởi động server chỉ cần `import("./pipeline/index.js")` (hoặc import tĩnh) một lần rồi gọi
 * `startJobQueueWorker()` (apps/api/src/queue/job-queue.ts) — không cần biết chi tiết từng worker.
 */
import "./transcribe-chunk.js";
import "./realtime-summary.js";
import "./finalize-meeting.js";
import "./drive-export.js";
