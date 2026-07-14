"use client";

import { useEffect, useState } from "react";
import { getSummary, type MeetingSummaryResult } from "@/lib/api";
import { toDisplayError, type DisplayError } from "@/lib/error-messages";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Spinner } from "@/components/common/Spinner";
import { SUMMARY_POINT_KIND_LABEL_VI } from "@/lib/format";

export function SummaryTab({ meetingId }: { meetingId: string }) {
  const [summary, setSummary] = useState<MeetingSummaryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DisplayError | null>(null);

  useEffect(() => {
    setLoading(true);
    getSummary(meetingId)
      .then(setSummary)
      .catch((err) => setError(toDisplayError(err, "Không thể tải tóm tắt cuộc họp.")))
      .finally(() => setLoading(false));
  }, [meetingId]);

  if (loading) return <Spinner label="Đang tải tóm tắt..." />;
  if (error) return <ErrorBanner code={error.code} messageVi={error.messageVi} />;
  if (!summary || summary.points.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có tóm tắt cho cuộc họp này.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {summary.isDraft && (
        <p className="text-xs italic text-amber-600 dark:text-amber-400">
          Đây vẫn là bản nháp — cuộc họp có thể chưa xử lý xong.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {summary.points.map((point) => (
          <li key={point.id} className="rounded-lg border bg-white p-3 text-sm dark:bg-slate-800">
            <span className="mb-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-700">
              {SUMMARY_POINT_KIND_LABEL_VI[point.kind]}
            </span>
            <p>{point.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
