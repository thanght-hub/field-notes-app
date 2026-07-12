import type { ActionItem, Decision, RealtimeSummaryPoint, Topic, TranscriptSegment } from "@field-notes/shared";
import { apiFetch } from "./client";

/**
 * Bản tóm tắt kết quả cuối (`GET .../summary`). `packages/shared` chỉ định nghĩa
 * `RealtimeSummarySnapshot` (luôn `isDraft: true`, dùng lúc đang họp) — endpoint kết quả cuối
 * trả về hình dạng tương tự nhưng `isDraft` có thể là `false`. Giả định kiểu dữ liệu này vì
 * chưa có type dùng chung cho bản tóm tắt cuối; cần đối chiếu lại khi backend hoàn thiện.
 */
export interface MeetingSummaryResult {
  meetingId: string;
  generatedAt: string;
  isDraft: boolean;
  points: RealtimeSummaryPoint[];
}

export function getTranscript(meetingId: string): Promise<TranscriptSegment[]> {
  return apiFetch<TranscriptSegment[]>(`/api/meetings/${meetingId}/transcript`);
}

export function patchTranscriptSegment(
  meetingId: string,
  segmentId: string,
  patch: Partial<Pick<TranscriptSegment, "originalText" | "translatedText" | "speakerLabel">>,
): Promise<TranscriptSegment> {
  return apiFetch<TranscriptSegment>(`/api/meetings/${meetingId}/transcript/${segmentId}`, {
    method: "PATCH",
    body: patch,
  });
}

export function getTopics(meetingId: string): Promise<Topic[]> {
  return apiFetch<Topic[]>(`/api/meetings/${meetingId}/topics`);
}

export function patchTopic(
  meetingId: string,
  topicId: string,
  patch: Partial<Pick<Topic, "title" | "discussionSummary" | "differingViewpoints" | "conclusion" | "conclusionStatus">>,
): Promise<Topic> {
  return apiFetch<Topic>(`/api/meetings/${meetingId}/topics/${topicId}`, {
    method: "PATCH",
    body: patch,
  });
}

export function getDecisions(meetingId: string): Promise<Decision[]> {
  return apiFetch<Decision[]>(`/api/meetings/${meetingId}/decisions`);
}

export function patchDecision(
  meetingId: string,
  decisionId: string,
  patch: Partial<Pick<Decision, "content">>,
): Promise<Decision> {
  return apiFetch<Decision>(`/api/meetings/${meetingId}/decisions/${decisionId}`, {
    method: "PATCH",
    body: patch,
  });
}

export function getActionItems(meetingId: string): Promise<ActionItem[]> {
  return apiFetch<ActionItem[]>(`/api/meetings/${meetingId}/action-items`);
}

export function patchActionItem(
  meetingId: string,
  itemId: string,
  patch: Partial<Pick<ActionItem, "content" | "assignee" | "dueDate" | "status">>,
): Promise<ActionItem> {
  return apiFetch<ActionItem>(`/api/meetings/${meetingId}/action-items/${itemId}`, {
    method: "PATCH",
    body: patch,
  });
}

export function getSummary(meetingId: string): Promise<MeetingSummaryResult> {
  return apiFetch<MeetingSummaryResult>(`/api/meetings/${meetingId}/summary`);
}

export function highlightSegment(
  meetingId: string,
  segmentId: string,
  highlighted: boolean,
): Promise<void> {
  return apiFetch<void>(`/api/meetings/${meetingId}/segments/${segmentId}/highlight`, {
    method: "POST",
    body: { highlighted },
  });
}
