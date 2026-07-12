"use client";

import { useEffect, useState } from "react";
import type { Meeting } from "@field-notes/shared";
import { getMeeting } from "@/lib/api";
import { toDisplayError, type DisplayError } from "@/lib/error-messages";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Spinner } from "@/components/common/Spinner";
import { MEETING_STATUS_LABEL_VI } from "@/lib/format";
import { SummaryTab } from "./SummaryTab";
import { TopicsTab } from "./TopicsTab";
import { DecisionsTab } from "./DecisionsTab";
import { ActionItemsTab } from "./ActionItemsTab";
import { TranscriptTab } from "./TranscriptTab";
import { NotesTab } from "./NotesTab";
import { ShareTab } from "./ShareTab";

const TABS = [
  { key: "tom-tat", label: "Tóm tắt" },
  { key: "chu-de", label: "Chủ đề" },
  { key: "quyet-dinh", label: "Quyết định" },
  { key: "cong-viec", label: "Công việc" },
  { key: "transcript", label: "Transcript" },
  { key: "ghi-chu", label: "Ghi chú và tài liệu" },
  { key: "chia-se", label: "Chia sẻ" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ResultsTabs({ meetingId }: { meetingId: string }) {
  const [active, setActive] = useState<TabKey>("tom-tat");
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [error, setError] = useState<DisplayError | null>(null);

  useEffect(() => {
    getMeeting(meetingId)
      .then(setMeeting)
      .catch((err) => setError(toDisplayError(err, "Không thể tải thông tin cuộc họp.")));
  }, [meetingId]);

  if (error) return <ErrorBanner code={error.code} messageVi={error.messageVi} />;
  if (!meeting) return <Spinner label="Đang tải cuộc họp..." />;

  const stillProcessing = meeting.status === "processing" || meeting.status === "uploading";

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">{meeting.title}</h1>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Trạng thái: {MEETING_STATUS_LABEL_VI[meeting.status]}
      </p>

      {stillProcessing && (
        <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100">
          Cuộc họp đang được xử lý (nhận dạng, dịch, tóm tắt). Một số nội dung bên dưới có thể chưa
          đầy đủ — hãy quay lại sau ít phút.
        </div>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              active === tab.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "tom-tat" && <SummaryTab meetingId={meetingId} />}
      {active === "chu-de" && <TopicsTab meetingId={meetingId} />}
      {active === "quyet-dinh" && <DecisionsTab meetingId={meetingId} />}
      {active === "cong-viec" && <ActionItemsTab meetingId={meetingId} />}
      {active === "transcript" && <TranscriptTab meetingId={meetingId} />}
      {active === "ghi-chu" && <NotesTab meetingId={meetingId} />}
      {active === "chia-se" && <ShareTab meetingId={meetingId} />}
    </div>
  );
}
