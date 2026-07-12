"use client";

import { useEffect, useState } from "react";
import type { ActionItem, ActionItemStatus } from "@field-notes/shared";
import { getActionItems, patchActionItem } from "@/lib/api";
import { toDisplayError, type DisplayError } from "@/lib/error-messages";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Spinner } from "@/components/common/Spinner";
import { ACTION_ITEM_STATUS_LABEL_VI } from "@/lib/format";

type ActionItemDraft = Pick<ActionItem, "content" | "assignee" | "dueDate" | "status">;

const STATUS_OPTIONS: ActionItemStatus[] = ["chua_thuc_hien", "dang_thuc_hien", "hoan_thanh"];

export function ActionItemsTab({ meetingId }: { meetingId: string }) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DisplayError | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ActionItemDraft>({ content: "", assignee: "", dueDate: "", status: "chua_thuc_hien" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getActionItems(meetingId)
      .then(setItems)
      .catch((err) => setError(toDisplayError(err, "Không thể tải danh sách công việc.")))
      .finally(() => setLoading(false));
  }, [meetingId]);

  function startEdit(item: ActionItem) {
    setEditingId(item.id);
    setDraft({
      content: item.content,
      assignee: item.assignee ?? "",
      dueDate: item.dueDate ?? "",
      status: item.status,
    });
  }

  async function saveEdit(itemId: string) {
    setSaving(true);
    try {
      const updated = await patchActionItem(meetingId, itemId, draft);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
      setEditingId(null);
    } catch (err) {
      setError(toDisplayError(err, "Không thể lưu thay đổi công việc."));
    } finally {
      setSaving(false);
    }
  }

  async function quickUpdateStatus(item: ActionItem, status: ActionItemStatus) {
    try {
      const updated = await patchActionItem(meetingId, item.id, { status });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (err) {
      setError(toDisplayError(err, "Không thể cập nhật trạng thái công việc."));
    }
  }

  if (loading) return <Spinner label="Đang tải công việc..." />;
  if (error) return <ErrorBanner code={error.code} messageVi={error.messageVi} onDismiss={() => setError(null)} />;
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có việc cần làm nào được trích xuất.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border bg-white p-4 dark:bg-slate-800">
          {editingId === item.id ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                rows={2}
                value={draft.content}
                onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              />
              <input
                placeholder="Người phụ trách"
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                value={draft.assignee ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
              />
              <input
                type="date"
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                value={draft.dueDate ? draft.dueDate.slice(0, 10) : ""}
                onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
              />
              <select
                className="rounded border px-2 py-1 text-sm dark:bg-slate-900"
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as ActionItemStatus }))}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {ACTION_ITEM_STATUS_LABEL_VI[status]}
                  </option>
                ))}
              </select>
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
                  onClick={() => void saveEdit(item.id)}
                  className="rounded bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">{item.content}</p>
                <button type="button" onClick={() => startEdit(item)} className="shrink-0 text-xs text-brand-600 hover:underline">
                  Sửa
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {item.assignee && <span>Phụ trách: {item.assignee}</span>}
                {item.dueDate && <span>Hạn: {item.dueDate.slice(0, 10)}</span>}
                <select
                  value={item.status}
                  onChange={(e) => void quickUpdateStatus(item, e.target.value as ActionItemStatus)}
                  className="rounded border bg-white px-1.5 py-0.5 text-xs dark:bg-slate-900"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {ACTION_ITEM_STATUS_LABEL_VI[status]}
                    </option>
                  ))}
                </select>
                {item.editedByUser && (
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
