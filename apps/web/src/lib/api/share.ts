import type { ShareLink, ShareLinkVisibility } from "@field-notes/shared";
import { apiFetch, ApiError } from "./client";

/** Trả `null` nếu cuộc họp chưa từng tạo link chia sẻ (404) thay vì ném lỗi. */
export async function getShareLink(meetingId: string): Promise<ShareLink | null> {
  try {
    return await apiFetch<ShareLink>(`/api/meetings/${meetingId}/share`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function createShareLink(
  meetingId: string,
  visibility: ShareLinkVisibility,
): Promise<ShareLink> {
  return apiFetch<ShareLink>(`/api/meetings/${meetingId}/share`, {
    method: "POST",
    body: { visibility },
  });
}
