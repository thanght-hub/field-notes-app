import type { TranscriptSegment } from "@field-notes/shared";
import { LANGUAGE_LABEL_VI } from "@field-notes/shared";

/** 5-10 đoạn hội thoại gần nhất đã dịch — KHÔNG hiển thị toàn bộ transcript (mục 5.3). */
export function RecentSegmentsList({ segments }: { segments: TranscriptSegment[] }) {
  if (segments.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Chưa có đoạn hội thoại nào được nhận dạng.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {segments.map((segment) => (
        <li
          key={segment.id}
          className={`rounded-lg border p-3 text-sm ${
            segment.highlighted ? "border-amber-400 bg-amber-50 dark:bg-amber-950" : "bg-white dark:bg-slate-800"
          }`}
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">{segment.speakerLabel}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-700">
              {LANGUAGE_LABEL_VI[segment.detectedLanguage]}
            </span>
            {segment.highlighted && <span aria-hidden="true">★</span>}
            {segment.lowConfidence && <span className="text-amber-600 dark:text-amber-400">độ tin cậy thấp</span>}
          </div>
          <p>{segment.translatedText ?? segment.originalText}</p>
          {segment.translatedText && segment.translatedText !== segment.originalText && (
            <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">
              Gốc: {segment.originalText}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
