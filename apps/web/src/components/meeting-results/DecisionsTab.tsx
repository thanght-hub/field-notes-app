"use client";

import { useEffect, useState } from "react";
import type { Decision } from "@field-notes/shared";
import { getDecisions, patchDecision } from "@/lib/api";
import { toDisplayError, type DisplayError } from "@/lib/error-messages";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Spinner } from "@/components/common/Spinner";
import { formatDurationSeconds } from "@/lib/format";

export function DecisionsTab({ meetingId }: { meetingId: string }) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DisplayError | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getDecisions(meetingId)
      .then(setDecisions)
      .catch((err) => setError(toDisplayError(err, "Không thể tải danh sách quyết định.")))
      .finally(() => setLoading(false));
  }, [meetingId]);

  async function saveEdit(decisionId: string) {
    setSaving(true);
    try {
      const updated = await patchDecision(meetingId, decisionId, { content: draftContent });
      setDecisions((prev) => prev.map((d) => (d.id === decisionId ? updated : d)));
      setEditingId(null);
    } catch (err) {
      setError(toDisplayError(err, "Không thể lưu thay đổi quyết định."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Đang tải quyết định..." />;
  if (error) return <ErrorBanner code={error.code} messageVi={error.messageVi} onDismiss={() => setError(null)} />;
  if (decisions.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có quyết định nào được ghi nhận.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {decisions.map((decision) => (
        <li key={decision.id} className="rounded-lg border bg-white p-4 dark:bg-slate-800">
          {editingId === decision.id ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                rows={2}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
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
                  onClick={() => void saveEdit(decision.id)}
                  className="rounded bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">{decision.content}</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(decision.id);
                    setDraftContent(decision.content);
                  }}
                  className="shrink-0 text-xs text-brand-600 hover:underline"
                >
                  Sửa
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span>Tại {formatDurationSeconds(decision.occurredAtOffsetMs / 1000)}</span>
                {decision.editedByUser && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                    Đã chỉnh sửa
                  </span>
                )}
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
