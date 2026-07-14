import type { AudioChunkStatus, MeetingStatus, RealtimeSummarySnapshot, TranscriptSegment } from "./domain.js";

/** Sự kiện đẩy qua SSE tới client trong lúc họp (mục 5.3, kiến trúc 2.1). */
export type MeetingLiveEvent =
  | { type: "transcript_segment"; segment: TranscriptSegment }
  | { type: "summary_snapshot"; summary: RealtimeSummarySnapshot }
  | { type: "chunk_status"; chunkId: string; status: AudioChunkStatus }
  | { type: "meeting_status"; status: MeetingStatus }
  | { type: "error"; messageVi: string; code: string };

export interface ApiErrorBody {
  code: string;
  /** Thông báo lỗi tiếng Việt hiển thị trực tiếp cho người dùng (mục 21). */
  messageVi: string;
  detail?: unknown;
}

export interface ChunkUploadAck {
  chunkId: string;
  status: AudioChunkStatus;
}
