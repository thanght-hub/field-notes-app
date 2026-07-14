import type { Attachment, ManualNote, ManualNoteType } from "@field-notes/shared";
import { apiFetch, API_BASE } from "./client";

export interface CreateNoteInput {
  type: "text";
  content: string;
  occurredAtOffsetMs: number;
  nearestSegmentId?: string;
}

export function createNote(meetingId: string, input: CreateNoteInput): Promise<ManualNote> {
  return apiFetch<ManualNote>(`/api/meetings/${meetingId}/notes`, {
    method: "POST",
    body: input,
  });
}

export function listNotes(meetingId: string): Promise<ManualNote[]> {
  return apiFetch<ManualNote[]>(`/api/meetings/${meetingId}/notes`);
}

export function uploadAttachment(
  meetingId: string,
  file: File,
  occurredAtOffsetMs: number,
  type: ManualNoteType,
): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  form.append("occurredAtOffsetMs", String(occurredAtOffsetMs));
  form.append("type", type);
  return apiFetch<Attachment>(`/api/meetings/${meetingId}/attachments`, {
    method: "POST",
    body: form,
  });
}

export function listAttachments(meetingId: string): Promise<Attachment[]> {
  return apiFetch<Attachment[]>(`/api/meetings/${meetingId}/attachments`);
}

/** URL xem/tải nội dung đính kèm — dùng trực tiếp trong `<a href>`/`<img src>` (cookie tự gửi kèm). */
export function attachmentContentUrl(meetingId: string, attachmentId: string): string {
  return `${API_BASE}/api/meetings/${meetingId}/attachments/${attachmentId}/content`;
}
