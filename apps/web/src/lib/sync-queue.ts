import { uploadChunk } from "./api/chunks";
import {
  getPendingChunks,
  updateChunkStatus,
  type LocalAudioChunkRecord,
} from "./offline-db";

const POLL_INTERVAL_MS = 3000;
const BACKOFF_STEP_MS = 2000;
const MAX_BACKOFF_MS = 60000;

/** Backoff đơn giản: chờ `attempts * 2s`, tối đa 60s — thuần, dễ unit test. */
export function computeBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(attempts * BACKOFF_STEP_MS, MAX_BACKOFF_MS);
}

function isDueForRetry(chunk: LocalAudioChunkRecord, now: number): boolean {
  if (chunk.attempts === 0) return true;
  const reference = chunk.lastAttemptAt ?? chunk.createdAt;
  return now - reference >= computeBackoffMs(chunk.attempts);
}

export interface SyncQueueStatus {
  online: boolean;
  pendingCount: number;
  uploadingCount: number;
}

export type SyncQueueListener = (status: SyncQueueStatus) => void;

/**
 * Hàng đợi đồng bộ chunk âm thanh lên server (mục 15/16, kiến trúc 2.1).
 * Chạy độc lập với việc ghi âm bằng `setInterval`; không chặn UI hay `ChunkRecorder`.
 */
export class SyncQueue {
  private readonly meetingId: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly uploadingSequences = new Set<number>();
  private readonly listeners = new Set<SyncQueueListener>();
  private online = typeof navigator !== "undefined" ? navigator.onLine : true;

  private readonly handleOnline = () => {
    this.online = true;
    this.emitQuickStatus();
    void this.tick();
  };

  private readonly handleOffline = () => {
    this.online = false;
    this.emitQuickStatus();
  };

  constructor(meetingId: string) {
    this.meetingId = meetingId;
  }

  start(): void {
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  }

  onStatusChange(listener: SyncQueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitQuickStatus(pendingCount?: number): void {
    for (const listener of this.listeners) {
      listener({
        online: this.online,
        pendingCount: pendingCount ?? -1,
        uploadingCount: this.uploadingSequences.size,
      });
    }
  }

  private async tick(): Promise<void> {
    if (!this.online) return;

    let pending: LocalAudioChunkRecord[];
    try {
      pending = await getPendingChunks(this.meetingId);
    } catch {
      return;
    }

    this.emitQuickStatus(pending.length);

    const now = Date.now();
    const due = pending.filter(
      (chunk) => !this.uploadingSequences.has(chunk.sequence) && isDueForRetry(chunk, now),
    );

    for (const chunk of due) {
      void this.uploadOne(chunk);
    }
  }

  private async uploadOne(chunk: LocalAudioChunkRecord): Promise<void> {
    this.uploadingSequences.add(chunk.sequence);
    await updateChunkStatus(chunk.meetingId, chunk.sequence, "uploading");
    try {
      const ack = await uploadChunk(chunk.meetingId, chunk);
      await updateChunkStatus(
        chunk.meetingId,
        chunk.sequence,
        ack.status === "failed" ? "failed" : "uploaded",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tải đoạn ghi âm lên thất bại.";
      await updateChunkStatus(chunk.meetingId, chunk.sequence, "failed", {
        attempts: chunk.attempts + 1,
        errorMessage: message,
        lastAttemptAt: Date.now(),
      });
    } finally {
      this.uploadingSequences.delete(chunk.sequence);
    }
  }
}
