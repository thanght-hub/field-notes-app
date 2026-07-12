import Link from "next/link";
import type { Meeting } from "@field-notes/shared";
import { formatDateTimeVi, MEETING_STATUS_LABEL_VI } from "@/lib/format";

const STATUS_BADGE_CLASS: Record<Meeting["status"], string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  recording: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
  uploading: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

function resultHrefFor(meeting: Meeting): string {
  if (meeting.status === "recording" || meeting.status === "paused") {
    return `/cuoc-hop/${meeting.id}/dang-hop`;
  }
  return `/cuoc-hop/${meeting.id}/ket-qua`;
}

export function MeetingListItem({ meeting }: { meeting: Meeting }) {
  return (
    <Link
      href={resultHrefFor(meeting)}
      className="flex flex-col gap-1 rounded-lg border bg-white p-4 transition hover:border-brand-400 dark:bg-slate-800"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{meeting.title}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[meeting.status]}`}
        >
          {MEETING_STATUS_LABEL_VI[meeting.status]}
        </span>
      </div>
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {formatDateTimeVi(meeting.startedAt ?? meeting.createdAt)}
        {meeting.location ? ` · ${meeting.location}` : ""}
      </span>
    </Link>
  );
}
