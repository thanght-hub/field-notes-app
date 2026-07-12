"use client";

import { useEffect, useState } from "react";
import type { Topic } from "@field-notes/shared";
import { getTopics, patchTopic } from "@/lib/api";
import { toDisplayError, type DisplayError } from "@/lib/error-messages";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Spinner } from "@/components/common/Spinner";

type TopicDraft = Pick<Topic, "title" | "discussionSummary" | "differingViewpoints" | "conclusion">;

export function TopicsTab({ meetingId }: { meetingId: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DisplayError | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TopicDraft>({ title: "", discussionSummary: "", differingViewpoints: "", conclusion: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTopics(meetingId)
      .then(setTopics)
      .catch((err) => setError(toDisplayError(err, "Không thể tải danh sách chủ đề.")))
      .finally(() => setLoading(false));
  }, [meetingId]);

  function startEdit(topic: Topic) {
    setEditingId(topic.id);
    setDraft({
      title: topic.title,
      discussionSummary: topic.discussionSummary,
      differingViewpoints: topic.differingViewpoints ?? "",
      conclusion: topic.conclusion ?? "",
    });
  }

  async function saveEdit(topicId: string) {
    setSaving(true);
    try {
      const updated = await patchTopic(meetingId, topicId, draft);
      setTopics((prev) => prev.map((t) => (t.id === topicId ? updated : t)));
      setEditingId(null);
    } catch (err) {
      setError(toDisplayError(err, "Không thể lưu thay đổi chủ đề."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Đang tải chủ đề..." />;
  if (error) return <ErrorBanner code={error.code} messageVi={error.messageVi} onDismiss={() => setError(null)} />;
  if (topics.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có chủ đề nào được trích xuất.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {topics.map((topic) => (
        <li key={topic.id} className="rounded-lg border bg-white p-4 dark:bg-slate-800">
          {editingId === topic.id ? (
            <div className="flex flex-col gap-2">
              <input
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
              <textarea
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                rows={2}
                value={draft.discussionSummary}
                onChange={(e) => setDraft((d) => ({ ...d, discussionSummary: e.target.value }))}
              />
              <textarea
                placeholder="Ý kiến trái chiều"
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                rows={2}
                value={draft.differingViewpoints}
                onChange={(e) => setDraft((d) => ({ ...d, differingViewpoints: e.target.value }))}
              />
              <textarea
                placeholder="Kết luận"
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                rows={2}
                value={draft.conclusion}
                onChange={(e) => setDraft((d) => ({ ...d, conclusion: e.target.value }))}
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
                  onClick={() => void saveEdit(topic.id)}
                  className="rounded bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{topic.title}</h3>
                <button type="button" onClick={() => startEdit(topic)} className="text-xs text-brand-600 hover:underline">
                  Sửa
                </button>
              </div>
              <p className="mt-1 text-sm">{topic.discussionSummary}</p>
              {topic.differingViewpoints && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Ý kiến trái chiều: {topic.differingViewpoints}
                </p>
              )}
              {topic.conclusion && <p className="mt-1 text-sm">Kết luận: {topic.conclusion}</p>}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span>{topic.conclusionStatus === "concluded" ? "Đã kết luận" : "Chưa kết luận"}</span>
                {topic.editedByUser && (
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
