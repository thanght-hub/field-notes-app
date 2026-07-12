export function Spinner({ label = "Đang tải..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-slate-400">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 dark:border-slate-600"
      />
      <span>{label}</span>
    </div>
  );
}
