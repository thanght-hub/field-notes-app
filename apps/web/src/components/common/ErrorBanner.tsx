interface ErrorBannerProps {
  code?: string;
  messageVi: string;
  onDismiss?: () => void;
}

/** Banner lỗi dùng chung toàn app — luôn hiển thị trực tiếp `messageVi` (mục 21). */
export function ErrorBanner({ code, messageVi, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
    >
      <span aria-hidden="true">⚠️</span>
      <div className="flex-1">
        <p>{messageVi}</p>
        {code && <p className="mt-1 text-xs opacity-70">Mã lỗi: {code}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng thông báo lỗi"
          className="text-red-700 hover:text-red-900 dark:text-red-200"
        >
          ✕
        </button>
      )}
    </div>
  );
}
