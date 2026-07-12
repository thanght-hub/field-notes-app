"use client";

import { useState } from "react";

interface NoteModalProps {
  onSubmit: (content: string) => Promise<void>;
  onClose: () => void;
}

export function NoteModal({ onSubmit, onClose }: NoteModalProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!content.trim()) {
      setError("Vui lòng nhập nội dung ghi chú.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(content.trim());
      onClose();
    } catch {
      setError("Không thể lưu ghi chú. Vui lòng thử lại.");
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-sm rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl dark:bg-slate-800">
        <h2 className="text-lg font-semibold">Thêm ghi chú</h2>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Nhập ghi chú của bạn..."
          className="mt-3 w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-900"
        />
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Đang lưu..." : "Lưu ghi chú"}
          </button>
        </div>
      </div>
    </div>
  );
}
