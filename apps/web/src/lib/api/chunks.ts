import type { AudioChunk, ChunkUploadAck } from "@field-notes/shared";
import type { LocalAudioChunkRecord } from "../offline-db";
import { apiFetch } from "./client";

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("webm")) return "webm";
  return "bin";
}

/**
 * Upload 1 chunk âm thanh đã lưu cục bộ (multipart/form-data).
 * Idempotent phía server theo (meetingId, sequence) — client chỉ cần tránh gửi trùng đồng thời
 * (xem `SyncQueue` trong `src/lib/sync-queue.ts`).
 */
export function uploadChunk(
  meetingId: string,
  chunk: LocalAudioChunkRecord,
): Promise<ChunkUploadAck> {
  const form = new FormData();
  form.append(
    "audio",
    chunk.blob,
    `chunk-${chunk.sequence}.${extensionForMimeType(chunk.mimeType)}`,
  );
  form.append("sequence", String(chunk.sequence));
  form.append("startOffsetMs", String(chunk.startOffsetMs));
  form.append("endOffsetMs", String(chunk.endOffsetMs));
  form.append("mimeType", chunk.mimeType);
  form.append("checksumSha256", chunk.checksumSha256);

  return apiFetch<ChunkUploadAck>(`/api/meetings/${meetingId}/chunks`, {
    method: "POST",
    body: form,
  });
}

export function listChunks(meetingId: string): Promise<AudioChunk[]> {
  return apiFetch<AudioChunk[]>(`/api/meetings/${meetingId}/chunks`);
}
