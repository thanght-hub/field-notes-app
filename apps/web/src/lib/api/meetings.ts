import type { Meeting, MeetingStatus } from "@field-notes/shared";
import { apiFetch } from "./client";

export interface ListMeetingsParams {
  query?: string;
  workspaceId?: string;
  projectId?: string;
  groupId?: string;
  date?: string;
  status?: MeetingStatus;
}

export function listMeetings(params: ListMeetingsParams = {}): Promise<Meeting[]> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<Meeting[]>(`/api/meetings${suffix}`);
}

export interface CreateMeetingInput {
  title: string;
  workspaceId: string;
  projectId?: string;
  groupId?: string;
  location?: string;
  initialNote?: string;
}

export function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  return apiFetch<Meeting>("/api/meetings", { method: "POST", body: input });
}

export function getMeeting(id: string): Promise<Meeting> {
  return apiFetch<Meeting>(`/api/meetings/${id}`);
}

export function confirmConsent(id: string): Promise<Meeting> {
  return apiFetch<Meeting>(`/api/meetings/${id}/consent`, {
    method: "POST",
    body: { confirmed: true },
  });
}

export function startMeeting(id: string): Promise<Meeting> {
  return apiFetch<Meeting>(`/api/meetings/${id}/start`, { method: "POST" });
}

export function pauseMeeting(id: string): Promise<Meeting> {
  return apiFetch<Meeting>(`/api/meetings/${id}/pause`, { method: "POST" });
}

export function resumeMeeting(id: string): Promise<Meeting> {
  return apiFetch<Meeting>(`/api/meetings/${id}/resume`, { method: "POST" });
}

export function endMeeting(id: string): Promise<Meeting> {
  return apiFetch<Meeting>(`/api/meetings/${id}/end`, { method: "POST" });
}

export function deleteMeeting(id: string): Promise<void> {
  return apiFetch<void>(`/api/meetings/${id}`, { method: "DELETE" });
}
