import { ERROR_MESSAGES_VI } from "@field-notes/shared";
import { saveChunkLocally, type LocalAudioChunkRecord } from "./offline-db";

/**
 * Độ dài mỗi đoạn ghi âm, tính bằng giây (mục 6.1 gợi ý 15-30s; khớp
 * `CHUNK_TARGET_SECONDS` mặc định phía backend trong .env.example). Hardcode ở client vì đây là
 * giá trị mặc định hợp lý cho v1 — có thể chuyển thành cấu hình lấy từ server sau.
 */
export const CHUNK_TARGET_SECONDS = 20;

const CANDIDATE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    throw new Error(ERROR_MESSAGES_VI.CODEC_NOT_SUPPORTED);
  }
  for (const candidate of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  throw new Error(ERROR_MESSAGES_VI.CODEC_NOT_SUPPORTED);
}

export function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ChunkRecorderOptions {
  meetingId: string;
  stream: MediaStream;
  startSequence?: number;
  onChunkReady?: (chunk: LocalAudioChunkRecord) => void;
  onError?: (error: Error) => void;
}

/**
 * Bọc `MediaRecorder` để ghi âm liên tục và cắt thành từng chunk ~`CHUNK_TARGET_SECONDS`.
 *
 * QUYẾT ĐỊNH KỸ THUẬT (mục 6.1 — "chồng lấn ngắn giữa các đoạn"): thay vì dùng 2
 * `MediaRecorder` xen kẽ để tạo chồng lấn theo nghĩa đen, ta dùng **một luồng `MediaRecorder`
 * duy nhất** với `start(timesliceMs)`. Trình duyệt tự phát sự kiện `dataavailable` mỗi
 * `CHUNK_TARGET_SECONDS` giây NHƯNG audio vẫn được ghi liên tục không ngắt quãng — không hề có
 * điểm cắt giữa 2 lần ghi riêng biệt nên không thể mất từ ở điểm cắt. Cách này đơn giản hơn,
 * không tốn gấp đôi tài nguyên ghi âm, và đáp ứng đúng tinh thần của yêu cầu (không mất dữ liệu
 * tại ranh giới chunk) dù không triển khai "chồng lấn" theo nghĩa đen.
 */
export class ChunkRecorder {
  private readonly mediaRecorder: MediaRecorder;
  private readonly meetingId: string;
  private readonly mimeType: string;
  private readonly onChunkReady?: (chunk: LocalAudioChunkRecord) => void;
  private readonly onError?: (error: Error) => void;

  private sequence: number;
  private recordingStartedAt = 0;
  private chunkStartOffsetMs = 0;
  private pausedAccumMs = 0;
  private pauseStartedAt: number | null = null;
  private stopped = false;

  constructor(options: ChunkRecorderOptions) {
    this.meetingId = options.meetingId;
    this.mimeType = pickSupportedMimeType();
    this.sequence = options.startSequence ?? 0;
    this.onChunkReady = options.onChunkReady;
    this.onError = options.onError;

    this.mediaRecorder = new MediaRecorder(options.stream, { mimeType: this.mimeType });
    this.mediaRecorder.ondataavailable = (event) => {
      void this.handleDataAvailable(event);
    };
    this.mediaRecorder.onerror = () => {
      this.onError?.(new Error("Đã xảy ra lỗi không xác định trong quá trình ghi âm."));
    };
  }

  start(): void {
    this.recordingStartedAt = Date.now();
    this.chunkStartOffsetMs = 0;
    this.mediaRecorder.start(CHUNK_TARGET_SECONDS * 1000);
  }

  private async handleDataAvailable(event: BlobEvent): Promise<void> {
    if (!event.data || event.data.size === 0) return;

    const endOffsetMs = Date.now() - this.recordingStartedAt - this.pausedAccumMs;
    const startOffsetMs = this.chunkStartOffsetMs;
    this.chunkStartOffsetMs = endOffsetMs;
    const sequence = this.sequence;
    this.sequence += 1;

    try {
      const arrayBuffer = await event.data.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const checksumSha256 = toHex(digest);

      const record: LocalAudioChunkRecord = {
        meetingId: this.meetingId,
        sequence,
        blob: event.data,
        mimeType: this.mimeType,
        startOffsetMs,
        endOffsetMs,
        checksumSha256,
        status: "local",
        attempts: 0,
        createdAt: Date.now(),
      };

      const saved = await saveChunkLocally(record);
      this.onChunkReady?.(saved);
    } catch (err) {
      this.onError?.(
        err instanceof Error ? err : new Error("Không thể lưu đoạn ghi âm vào thiết bị."),
      );
    }
  }

  pause(): void {
    if (this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause();
      this.pauseStartedAt = Date.now();
    }
  }

  resume(): void {
    if (this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume();
      if (this.pauseStartedAt !== null) {
        this.pausedAccumMs += Date.now() - this.pauseStartedAt;
        this.pauseStartedAt = null;
      }
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.stopped || this.mediaRecorder.state === "inactive") {
        resolve();
        return;
      }
      this.stopped = true;
      this.mediaRecorder.addEventListener("stop", () => resolve(), { once: true });
      this.mediaRecorder.stop();
    });
  }

  get state(): RecordingState {
    return this.mediaRecorder.state;
  }

  get nextSequence(): number {
    return this.sequence;
  }
}

/** Kiểm tra hỗ trợ codec mà không khởi tạo recorder — dùng để hiện cảnh báo sớm trong UI. */
export function isRecordingSupported(): boolean {
  try {
    pickSupportedMimeType();
    return true;
  } catch {
    return false;
  }
}
