interface ConfirmModalProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal xác nhận dùng chung (vd "Kết thúc cuộc họp?" — mục 17.2). */
export function ConfirmModal({
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Huỷ",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
        <h2 id="confirm-modal-title" className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
