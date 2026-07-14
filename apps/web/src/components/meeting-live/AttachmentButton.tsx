"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type ChangeEvent } from "react";

export interface AttachmentButtonHandle {
  open: () => void;
}

interface AttachmentButtonProps {
  onUpload: (file: File) => Promise<void>;
}

/**
 * Input file ẩn điều khiển qua ref (`open()`), để nút "Đính kèm" trong `RecordingControls`
 * (một component thuần trình bày) có thể kích hoạt việc chọn tệp mà không cần biết chi tiết DOM.
 * Chấp nhận ảnh và tài liệu văn phòng phổ biến (mục 17.2 "Đính kèm").
 */
export const AttachmentButton = forwardRef<AttachmentButtonHandle, AttachmentButtonProps>(
  function AttachmentButton({ onUpload }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      open: () => inputRef.current?.click(),
    }));

    async function handleChange(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        await onUpload(file);
      } catch {
        setError("Tải tệp đính kèm lên thất bại. Vui lòng thử lại.");
      } finally {
        setUploading(false);
      }
    }

    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(e) => void handleChange(e)}
        />
        {uploading && (
          <p className="text-xs text-slate-500 dark:text-slate-400">Đang tải tệp đính kèm lên...</p>
        )}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  },
);
