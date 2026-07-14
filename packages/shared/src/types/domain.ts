import type { SourceLanguage, TargetLanguage } from "./language.js";

/** Mục 12: trạng thái vòng đời một cuộc họp. */
export type MeetingStatus =
  | "draft"
  | "recording"
  | "paused"
  | "uploading"
  | "processing"
  | "completed"
  | "failed";

export interface User {
  id: string;
  googleSub: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** "Workspace" == Công ty/đơn vị (mục 12). */
export interface Workspace {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Phòng ban/nhóm — không bắt buộc với mỗi cuộc họp (mục 12). */
export interface Group {
  id: string;
  workspaceId: string;
  projectId?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  userId: string;
  workspaceId: string;
  projectId?: string;
  groupId?: string;
  title: string;
  location?: string;
  initialNote?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  status: MeetingStatus;
  sourceLanguages: SourceLanguage[];
  targetLanguage: TargetLanguage;
  speakerCountEstimate?: number;
  driveFolderId?: string;
  /** Tóm tắt điều hành cuối cùng (mục 10.2), do bước finalize_meeting sinh ra sau khi họp kết thúc. */
  executiveSummary?: string;
  consentConfirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Trạng thái đồng bộ từng chunk âm thanh (mục 15). */
export type AudioChunkStatus =
  | "local"
  | "queued"
  | "uploading"
  | "uploaded"
  | "transcribed"
  | "failed";

export interface AudioChunk {
  id: string;
  meetingId: string;
  sequence: number;
  startOffsetMs: number;
  endOffsetMs: number;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: AudioChunkStatus;
  uploadAttempts: number;
  storageObjectKey?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type TranscriptSegmentStage = "interim" | "final";

export interface TranscriptSegment {
  id: string;
  meetingId: string;
  audioChunkId?: string;
  sequence: number;
  startOffsetMs: number;
  endOffsetMs: number;
  speakerLabel: string; // vd: "Người nói 1"
  detectedLanguage: SourceLanguage;
  originalText: string;
  translatedText?: string; // chỉ có khi detectedLanguage khác targetLanguage
  confidence: number; // 0..1
  stage: TranscriptSegmentStage;
  lowConfidence: boolean;
  highlighted: boolean;
  editedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TopicConclusionStatus = "concluded" | "open";

export interface Topic {
  id: string;
  meetingId: string;
  title: string;
  startOffsetMs: number;
  endOffsetMs: number;
  discussionSummary: string;
  differingViewpoints?: string;
  conclusion?: string;
  conclusionStatus: TopicConclusionStatus;
  editedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  meetingId: string;
  topicId?: string;
  content: string;
  occurredAtOffsetMs: number;
  confidence: number;
  sourceSegmentIds: string[];
  editedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ActionItemStatus = "chua_thuc_hien" | "dang_thuc_hien" | "hoan_thanh";

export interface ActionItem {
  id: string;
  meetingId: string;
  content: string;
  assignee?: string;
  dueDate?: string;
  status: ActionItemStatus;
  sourceSegmentIds: string[];
  editedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ManualNoteType = "text" | "photo" | "document";

export interface ManualNote {
  id: string;
  meetingId: string;
  type: ManualNoteType;
  content?: string;
  occurredAtOffsetMs: number;
  nearestSegmentId?: string;
  attachmentId?: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  meetingId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageObjectKey: string;
  driveFileId?: string;
  createdAt: string;
}

export type ShareLinkVisibility = "private" | "anyone_with_link";

export interface ShareLink {
  id: string;
  meetingId: string;
  visibility: ShareLinkVisibility;
  driveFileId: string;
  url: string;
  createdAt: string;
}

export type ProcessingJobType =
  | "transcribe_chunk"
  | "realtime_summary"
  | "finalize_meeting"
  | "drive_export";

export type ProcessingJobStatus = "pending" | "running" | "succeeded" | "failed";

export interface ProcessingJob {
  id: string;
  meetingId: string;
  type: ProcessingJobType;
  status: ProcessingJobStatus;
  attempts: number;
  payload: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/** Bản tóm tắt nháp thời gian thực (mục 9) — không phải kết quả cuối. */
export type RealtimeSummaryPointKind =
  | "y_chinh"
  | "dang_thao_luan"
  | "quyet_dinh_tam_thoi"
  | "chua_thong_nhat";

export interface RealtimeSummaryPoint {
  id: string;
  kind: RealtimeSummaryPointKind;
  text: string;
  sourceSegmentIds: string[];
  createdAt: string;
}

export interface RealtimeSummarySnapshot {
  meetingId: string;
  generatedAt: string;
  isDraft: true;
  points: RealtimeSummaryPoint[];
}
