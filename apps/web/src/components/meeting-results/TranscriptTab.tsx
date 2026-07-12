"use client";

import { useEffect, useState } from "react";
import { LANGUAGE_LABEL_VI, type TranscriptSegment } from "@field-notes/shared";
import { getTranscript, patchTranscriptSegment } from "@/lib/api";
import { toDisplayError, type DisplayError } from "@/lib/error-messages";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Spinner } from "@/components/common/Spinner";
import { formatDurationSeconds } from "@/lib/format";

type SegmentDraft = Pick<TranscriptSegment, "speakerLabel" | "originalText" | "translatedText">;

export function TranscriptTab({ meetingId }: { meetingId: string }) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DisplayError | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SegmentDraft>({ speakerLabel: "", originalText: "", translatedText: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTranscript(meetingId)
      .then(setSegments)
      .catch((err) => setError(toDisplayError(err, "Không thể tải transcript.")))
      .finally(() => setLoading(false));
  }, [meetingId]);

  function startEdit(segment: TranscriptSegment) {
    setEditingId(segment.id);
    setDraft({
      speakerLabel: segment.speakerLabel,
      originalText: segment.originalText,
      translatedText: segment.translatedText ?? "",
    });
  }

  async function saveEdit(segmentId: string) {
    setSaving(true);
    try {
      const updated = await patchTranscriptSegment(meetingId, segmentId, draft);
      setSegments((prev) => prev.map((s) => (s.id === segmentId ? updated : s)));
      setEditingId(null);
    } catch (err) {
      setError(toDisplayError(err, "Không thể lưu thay đổi transcript."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Đang tải transcript..." />;
  if (error) return <ErrorBanner code={error.code} messageVi={error.messageVi} onDismiss={() => setError(null)} />;
  if (segments.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có transcript cho cuộc họp này.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {segments.map((segment) => (
        <li
          key={segment.id}
          className={`rounded-lg border p-3 text-sm dark:bg-slate-800 ${segment.highlighted ? "border-amber-400 bg-amber-50 dark:bg-amber-950" : "bg-white"}`}
        >
          {editingId === segment.id ? (
            <div className="flex flex-col gap-2">
              <input
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                value={draft.speakerLabel}
                onChange={(e) => setDraft((d) => ({ ...d, speakerLabel: e.target.value }))}
              />
              <textarea
                placeholder="Văn bản gốc"
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                rows={2}
                value={draft.originalText}
                onChange={(e) => setDraft((d) => ({ ...d, originalText: e.target.value }))}
              />
              <textarea
                placeholder="Bản dịch tiếng Việt"
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                rows={2}
                value={draft.translatedText}
                onChange={(e) => setDraft((d) => ({ ...d, translatedText: e.target.value }))}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded px-3 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEdit(segment.id)}
                  className="rounded bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-200">{segment.speakerLabel}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-700">
                  {LANGUAGE_LABEL_VI[segment.detectedLanguage]}
                </span>
                <span>{formatDurationSeconds(segment.startOffsetMs / 1000)}</span>
                {segment.highlighted && <span aria-hidden="true">★</span>}
                {segment.lowConfidence && <span className="text-amber-600 dark:text-amber-400">độ tin cậy thấp</span>}
                {segment.editedByUser && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                    Đã chỉnh sửa
                  </span>
                )}
                <button type="button" onClick={() => startEdit(segment)} className="ml-auto text-brand-600 hover:underline">
                  Sửa
                </button>
              </div>
              <p>{segment.translatedText ?? segment.originalText}</p>
              {segment.translatedText && segment.translatedText !== segment.originalText && (
                <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">Gốc: {segment.originalText}</p>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
