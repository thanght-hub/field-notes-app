import type { ActionItemStatus, MeetingStatus, RealtimeSummaryPointKind } from "@field-notes/shared";

/** Định dạng số giây thành `HH:MM:SS` (bỏ giờ nếu = 0) — dùng cho bộ đếm thời gian cuộc họp. */
export function formatDurationSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatDateTimeVi(iso: string | undefined): string {
  if (!iso) return "--";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const MEETING_STATUS_LABEL_VI: Record<MeetingStatus, string> = {
  draft: "Nháp",
  recording: "Đang ghi âm",
  paused: "Tạm dừng",
  uploading: "Đang tải lên",
  processing: "Đang xử lý",
  completed: "Đã hoàn tất",
  failed: "Lỗi",
};

export const ACTION_ITEM_STATUS_LABEL_VI: Record<ActionItemStatus, string> = {
  chua_thuc_hien: "Chưa thực hiện",
  dang_thuc_hien: "Đang thực hiện",
  hoan_thanh: "Hoàn thành",
};

export const SUMMARY_POINT_KIND_LABEL_VI: Record<RealtimeSummaryPointKind, string> = {
  y_chinh: "Ý chính",
  dang_thao_luan: "Đang thảo luận",
  quyet_dinh_tam_thoi: "Quyết định tạm thời",
  chua_thong_nhat: "Chưa thống nhất",
};

export function formatStorageMB(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}
