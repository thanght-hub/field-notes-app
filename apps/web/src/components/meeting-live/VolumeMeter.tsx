export function VolumeMeter({ level }: { level: number }) {
  const clamped = Math.max(0, Math.min(1, level));

  return (
    <div
      role="progressbar"
      aria-label="Mức âm lượng micro"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
    >
      <div
        className="h-full rounded-full bg-green-500 transition-[width] duration-150"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
