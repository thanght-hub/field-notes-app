import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * Trạng thái chunk âm thanh PHÍA CLIENT (mục 15). Khác với `AudioChunkStatus` dùng chung
 * (packages/shared) ở chỗ không có `"transcribed"` — trạng thái đó chỉ tồn tại sau khi server
 * xử lý xong, client không tự đặt trạng thái này (chỉ nhận qua sự kiện `chunk_status` trên SSE).
 */
export type LocalChunkStatus = "local" | "queued" | "uploading" | "uploaded" | "failed";

export interface LocalAudioChunkRecord {
  meetingId: string;
  sequence: number;
  blob: Blob;
  mimeType: string;
  startOffsetMs: number;
  endOffsetMs: number;
  checksumSha256: string;
  status: LocalChunkStatus;
  attempts: number;
  createdAt: number;
  lastAttemptAt?: number;
  errorMessage?: string;
}

/** Dùng để khôi phục UI "đang họp" sau khi tab bị đóng/reload đột ngột (mục 3.1). */
export interface RecordingSessionRecord {
  meetingId: string;
  startedAt: number;
  lastKnownStatus: string;
  chunkCount: number;
  updatedAt: number;
}

interface FieldNotesOfflineDb extends DBSchema {
  audioChunks: {
    key: string;
    value: LocalAudioChunkRecord;
    indexes: { "by-meeting": string; "by-status": string };
  };
  recordingSessions: {
    key: string;
    value: RecordingSessionRecord;
  };
}

const DB_NAME = "field-notes-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FieldNotesOfflineDb>> | null = null;

function getDb(): Promise<IDBPDatabase<FieldNotesOfflineDb>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB không khả dụng trong môi trường này."));
  }
  if (!dbPromise) {
    dbPromise = openDB<FieldNotesOfflineDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("audioChunks")) {
          // Key ngoài (out-of-line): key = `${meetingId}:${sequence}`, xem `chunkKey()`.
          const store = db.createObjectStore("audioChunks");
          store.createIndex("by-meeting", "meetingId");
          store.createIndex("by-status", "status");
        }
        if (!db.objectStoreNames.contains("recordingSessions")) {
          // Key ngoài: key = meetingId.
          db.createObjectStore("recordingSessions");
        }
      },
    });
  }
  return dbPromise;
}

function chunkKey(meetingId: string, sequence: number): string {
  return `${meetingId}:${sequence}`;
}

export async function saveChunkLocally(
  record: LocalAudioChunkRecord,
): Promise<LocalAudioChunkRecord> {
  const db = await getDb();
  await db.put("audioChunks", record, chunkKey(record.meetingId, record.sequence));
  return record;
}

export async function listChunksForMeeting(meetingId: string): Promise<LocalAudioChunkRecord[]> {
  const db = await getDb();
  const chunks = await db.getAllFromIndex("audioChunks", "by-meeting", meetingId);
  return chunks.sort((a, b) => a.sequence - b.sequence);
}

export async function updateChunkStatus(
  meetingId: string,
  sequence: number,
  status: LocalChunkStatus,
  extra?: Partial<Pick<LocalAudioChunkRecord, "attempts" | "errorMessage" | "lastAttemptAt">>,
): Promise<LocalAudioChunkRecord | undefined> {
  const db = await getDb();
  const key = chunkKey(meetingId, sequence);
  const existing = await db.get("audioChunks", key);
  if (!existing) return undefined;
  const updated: LocalAudioChunkRecord = { ...existing, ...extra, status };
  await db.put("audioChunks", updated, key);
  return updated;
}

/** Chunk còn cần đồng bộ: chưa upload xong hoặc lần thử trước thất bại (mục 15/16). */
export async function getPendingChunks(meetingId: string): Promise<LocalAudioChunkRecord[]> {
  const all = await listChunksForMeeting(meetingId);
  return all.filter((c) => c.status === "local" || c.status === "queued" || c.status === "failed");
}

/** Tổng số chunk đang chờ đồng bộ trên TOÀN BỘ thiết bị (mọi cuộc họp) — dùng ở trang chủ. */
export async function countAllPendingChunks(): Promise<number> {
  const db = await getDb();
  const pendingStatuses: LocalChunkStatus[] = ["local", "queued", "failed"];
  const groups = await Promise.all(
    pendingStatuses.map((status) => db.getAllFromIndex("audioChunks", "by-status", status)),
  );
  return groups.reduce((sum, group) => sum + group.length, 0);
}

export async function saveRecordingSession(session: RecordingSessionRecord): Promise<void> {
  const db = await getDb();
  await db.put("recordingSessions", session, session.meetingId);
}

export async function getRecordingSession(
  meetingId: string,
): Promise<RecordingSessionRecord | undefined> {
  const db = await getDb();
  return db.get("recordingSessions", meetingId);
}

export async function clearRecordingSession(meetingId: string): Promise<void> {
  const db = await getDb();
  await db.delete("recordingSessions", meetingId);
}

export interface StorageEstimateResult {
  supported: boolean;
  usedMB: number;
  quotaMB: number;
  lowStorage: boolean;
}

const LOW_STORAGE_RATIO_THRESHOLD = 0.9;

/** Ước tính dung lượng IndexedDB đang dùng (mục 15 — cảnh báo khi bộ nhớ thiết bị thấp). */
export async function estimateStorageUsage(): Promise<StorageEstimateResult> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { supported: false, usedMB: 0, quotaMB: 0, lowStorage: false };
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const ratio = quota > 0 ? usage / quota : 0;
    return {
      supported: true,
      usedMB: usage / (1024 * 1024),
      quotaMB: quota / (1024 * 1024),
      lowStorage: ratio >= LOW_STORAGE_RATIO_THRESHOLD,
    };
  } catch {
    return { supported: false, usedMB: 0, quotaMB: 0, lowStorage: false };
  }
}
