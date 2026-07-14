"use client";

import { useEffect, useState } from "react";
import type { Attachment, ManualNote } from "@field-notes/shared";
import { attachmentContentUrl, listAttachments, listNotes } from "@/lib/api";
import { toDisplayError, type DisplayError } from "@/lib/error-messages";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Spinner } from "@/components/common/Spinner";
import { formatDurationSeconds } from "@/lib/format";

/** Ghi chú thủ công và tài liệu đính kèm trong lúc họp (mục 17.3) — hiển thị dạng chỉ đọc (v1 chưa có PATCH). */
export function NotesTab({ meetingId }: { meetingId: string }) {
  const [notes, setNotes] = useState<ManualNote[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DisplayError | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([listNotes(meetingId), listAttachments(meetingId)])
      .then(([notesResult, attachmentsResult]) => {
        setNotes(notesResult);
        setAttachments(attachmentsResult);
      })
      .catch((err) => setError(toDisplayError(err, "Không thể tải ghi chú và tài liệu.")))
      .finally(() => setLoading(false));
  }, [meetingId]);

  if (loading) return <Spinner label="Đang tải ghi chú..." />;
  if (error) return <ErrorBanner code={error.code} messageVi={error.messageVi} />;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Ghi chú
        </h3>
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có ghi chú nào.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border bg-white p-3 text-sm dark:bg-slate-800">
                <p>{note.content}</p>
                <span className="mt-1 block text-xs text-slate-400">
                  Tại {formatDurationSeconds(note.occurredAtOffsetMs / 1000)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Tài liệu đính kèm
        </h3>
        {attachments.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có tài liệu đính kèm nào.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white p-3 text-sm dark:bg-slate-800">
                <span className="truncate">{attachment.fileName}</span>
                <a
                  href={attachmentContentUrl(meetingId, attachment.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-brand-600 hover:underline"
                >
                  Xem/Tải xuống
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
