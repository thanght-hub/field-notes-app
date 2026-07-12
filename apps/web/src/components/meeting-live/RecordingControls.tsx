interface RecordingControlsProps {
  paused: boolean;
  onTogglePause: () => void;
  onHighlight: () => void;
  onOpenNote: () => void;
  onOpenAttachment: () => void;
  onRequestEnd: () => void;
  highlightActive: boolean;
}

/** Bộ điều khiển chính màn hình đang họp — ưu tiên thao tác 1 tay (mục 17.2). */
export function RecordingControls({
  paused,
  onTogglePause,
  onHighlight,
  onOpenNote,
  onOpenAttachment,
  onRequestEnd,
  highlightActive,
}: RecordingControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onTogglePause}
          className="rounded-xl bg-slate-800 px-4 py-4 text-base font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          {paused ? "▶ Tiếp tục" : "⏸ Tạm dừng"}
        </button>
        <button
          type="button"
          onClick={onHighlight}
          className={`rounded-xl px-4 py-4 text-base font-medium text-white transition ${
            highlightActive ? "bg-amber-600 hover:bg-amber-700" : "bg-amber-500 hover:bg-amber-600"
          }`}
        >
          ★ Đánh dấu quan trọng
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOpenNote}
          className="rounded-xl border px-4 py-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          📝 Ghi chú
        </button>
        <button
          type="button"
          onClick={onOpenAttachment}
          className="rounded-xl border px-4 py-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          📎 Đính kèm
        </button>
      </div>

      <button
        type="button"
        onClick={onRequestEnd}
        className="rounded-xl bg-red-600 px-4 py-4 text-base font-semibold text-white hover:bg-red-700"
      >
        ■ Kết thúc cuộc họp
      </button>
    </div>
  );
}
