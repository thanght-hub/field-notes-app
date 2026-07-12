"use client";

import { useEffect, useState } from "react";
import { googleLoginUrl } from "@/lib/api";

const PRIVACY_NOTICE_READ_KEY = "field-notes-privacy-notice-read";

/**
 * Màn hình đăng nhập (mục 5.1): giải thích việc ghi âm/xử lý cloud trước khi người dùng đăng nhập.
 * `hasReadNotice` chỉ ghi nhớ là "đã đọc thông báo chung" — KHÔNG thay thế bước xác nhận đồng ý
 * riêng cho từng cuộc họp cụ thể (`POST .../consent`, xem trang tạo cuộc họp mới).
 */
export function LoginScreen() {
  const [hasReadNotice, setHasReadNotice] = useState(true);

  useEffect(() => {
    try {
      setHasReadNotice(window.localStorage.getItem(PRIVACY_NOTICE_READ_KEY) === "1");
    } catch {
      setHasReadNotice(true);
    }
  }, []);

  function markAsRead() {
    try {
      window.localStorage.setItem(PRIVACY_NOTICE_READ_KEY, "1");
    } catch {
      // Bỏ qua nếu localStorage bị chặn — người dùng chỉ phải xem lại thông báo lần sau.
    }
    setHasReadNotice(true);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Field Notes</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Trợ lý ghi âm, dịch và tóm tắt cuộc họp Việt – Trung.
        </p>
      </div>

      {!hasReadNotice && (
        <div className="w-full rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="mb-2 font-medium">Trước khi tiếp tục, vui lòng đọc:</p>
          <p>
            Ứng dụng sẽ ghi âm cuộc họp của bạn, gửi lên máy chủ để nhận dạng giọng nói, dịch và tóm
            tắt bằng dịch vụ AI trên nền tảng đám mây (Google Cloud). Bản ghi âm tạm thời sẽ bị xoá
            sau khi xử lý xong; kết quả cuối cùng được lưu vào Google Drive của chính bạn. Với mỗi
            cuộc họp cụ thể, bạn sẽ luôn được yêu cầu xác nhận đồng ý riêng trước khi bắt đầu ghi âm.
          </p>
          <button
            type="button"
            onClick={markAsRead}
            className="mt-3 rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
          >
            Đã đọc, tiếp tục
          </button>
        </div>
      )}

      <a
        href={googleLoginUrl()}
        className="w-full rounded-lg bg-brand-600 px-4 py-3 text-center font-medium text-white transition hover:bg-brand-700"
      >
        Đăng nhập bằng Google
      </a>
    </div>
  );
}
