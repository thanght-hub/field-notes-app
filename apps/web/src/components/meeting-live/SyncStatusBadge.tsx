interface SyncStatusBadgeProps {
  online: boolean;
  pendingCount: number;
}

/** Trạng thái kết nối/đồng bộ (mục 16 — "Đang ghi ngoại tuyến"). */
export function SyncStatusBadge({ online, pendingCount }: SyncStatusBadgeProps) {
  if (!online) {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-100">
        Đang ghi ngoại tuyến {pendingCount > 0 ? `· ${pendingCount} đoạn chờ` : ""}
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-100">
        Đang đồng bộ · {pendingCount} đoạn chờ
      </span>
    );
  }

  return (
    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
      Đã đồng bộ
    </span>
  );
}
