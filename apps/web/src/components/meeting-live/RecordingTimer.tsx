import { formatDurationSeconds } from "@/lib/format";

export function RecordingTimer({ elapsedSeconds, paused }: { elapsedSeconds: number; paused: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-5xl font-semibold tabular-nums">
        {formatDurationSeconds(elapsedSeconds)}
      </span>
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {paused ? "Đã tạm dừng" : "Đang ghi âm"}
      </span>
    </div>
  );
}
