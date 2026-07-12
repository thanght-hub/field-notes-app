"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ERROR_MESSAGES_VI, type Meeting } from "@field-notes/shared";
import {
  ApiError,
  createNote,
  endMeeting,
  getMeeting,
  highlightSegment,
  pauseMeeting,
  resumeMeeting,
  startMeeting,
  uploadAttachment,
} from "@/lib/api";
import { useRecorder } from "@/hooks/useRecorder";
import { useMeetingLive } from "@/hooks/useMeetingLive";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useBeforeUnloadWarning } from "@/hooks/useBeforeUnloadWarning";
import { useStorageWarning } from "@/hooks/useStorageWarning";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Spinner } from "@/components/common/Spinner";
import { RecordingTimer } from "./RecordingTimer";
import { VolumeMeter } from "./VolumeMeter";
import { RecordingControls } from "./RecordingControls";
import { NoteModal } from "./NoteModal";
import { AttachmentButton, type AttachmentButtonHandle } from "./AttachmentButton";
import { SummaryDraftPanel } from "./SummaryDraftPanel";
import { RecentSegmentsList } from "./RecentSegmentsList";
import { SyncStatusBadge } from "./SyncStatusBadge";

const TERMINAL_STATUSES: Meeting["status"][] = ["completed", "failed", "processing", "uploading"];

function toDisplayError(err: unknown, fallbackVi: string): { code?: string; messageVi: string } {
  if (err instanceof ApiError) return { code: err.code, messageVi: err.messageVi };
  return { messageVi: fallbackVi };
}

export function LiveMeetingScreen({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const recorder = useRecorder(meetingId);
  const live = useMeetingLive(meetingId);
  const online = useOnlineStatus();
  const attachmentRef = useRef<AttachmentButtonHandle>(null);
  const bootstrapped = useRef(false);
  const appliedPendingHighlightRef = useRef<string | null>(null);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loadError, setLoadError] = useState<{ code?: string; messageVi: string } | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState(false);
  const [ending, setEnding] = useState(false);

  const isActivelyRecording = recorder.phase === "recording" || recorder.phase === "paused";
  useBeforeUnloadWarning(isActivelyRecording);
  const storage = useStorageWarning(isActivelyRecording);

  const lastSegment = live.recentSegments[live.recentSegments.length - 1];

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    void (async () => {
      try {
        const current = await getMeeting(meetingId);
        setMeeting(current);

        if (TERMINAL_STATUSES.includes(current.status)) {
          router.replace(`/cuoc-hop/${meetingId}/ket-qua`);
          return;
        }

        if (current.status === "draft") {
          const started = await startMeeting(meetingId);
          setMeeting(started);
          await recorder.begin();
        }
        // status "recording"/"paused" (vd tải lại trang): chờ người dùng bấm nút khôi phục —
        // mở micro cần cử chỉ người dùng trên nhiều trình duyệt (đặc biệt iOS Safari).
      } catch (err) {
        setLoadError(toDisplayError(err, "Không thể tải thông tin cuộc họp."));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // Áp dụng "đánh dấu quan trọng" đang chờ cho segment đầu tiên xuất hiện sau khi bấm nút,
  // khi lúc bấm chưa có segment nào (mục 17.2).
  useEffect(() => {
    if (!pendingHighlight || !lastSegment) return;
    if (appliedPendingHighlightRef.current === lastSegment.id) return;
    appliedPendingHighlightRef.current = lastSegment.id;
    setPendingHighlight(false);
    void highlightSegment(meetingId, lastSegment.id, true);
  }, [pendingHighlight, lastSegment, meetingId]);

  const handleTogglePause = useCallback(async () => {
    if (recorder.phase === "recording") {
      recorder.pause();
      try {
        await pauseMeeting(meetingId);
      } catch {
        // Trạng thái ghi âm cục bộ vẫn ưu tiên — đồng bộ trạng thái server sẽ được thử lại ở lần tương tác kế tiếp.
      }
    } else if (recorder.phase === "paused") {
      recorder.resume();
      try {
        await resumeMeeting(meetingId);
      } catch {
        // Tương tự trên.
      }
    }
  }, [recorder, meetingId]);

  const handleHighlight = useCallback(() => {
    if (lastSegment) {
      void highlightSegment(meetingId, lastSegment.id, true);
    } else {
      setPendingHighlight(true);
    }
  }, [lastSegment, meetingId]);

  const handleNoteSubmit = useCallback(
    async (content: string) => {
      await createNote(meetingId, {
        type: "text",
        content,
        occurredAtOffsetMs: recorder.elapsedSeconds * 1000,
        nearestSegmentId: lastSegment?.id,
      });
    },
    [meetingId, recorder.elapsedSeconds, lastSegment],
  );

  const handleAttachmentUpload = useCallback(
    async (file: File) => {
      const type = file.type.startsWith("image/") ? "photo" : "document";
      await uploadAttachment(meetingId, file, recorder.elapsedSeconds * 1000, type);
    },
    [meetingId, recorder.elapsedSeconds],
  );

  const handleConfirmEnd = useCallback(async () => {
    setEnding(true);
    try {
      await recorder.stop();
      await endMeeting(meetingId);
      router.push(`/cuoc-hop/${meetingId}/ket-qua`);
    } catch (err) {
      setLoadError(toDisplayError(err, "Không thể kết thúc cuộc họp. Vui lòng thử lại."));
      setEnding(false);
      setShowEndConfirm(false);
    }
  }, [recorder, meetingId, router]);

  if (loadError) {
    return (
      <main className="mx-auto max-w-lg px-4 py-6">
        <ErrorBanner code={loadError.code} messageVi={loadError.messageVi} />
      </main>
    );
  }

  if (!meeting) {
    return <Spinner label="Đang tải cuộc họp..." />;
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-5 pb-10">
      <div className="flex items-center justify-between gap-2">
        <h1 className="truncate text-lg font-semibold">{meeting.title}</h1>
        <SyncStatusBadge online={online} pendingCount={Math.max(recorder.syncStatus.pendingCount, 0)} />
      </div>

      {recorder.errorMessageVi && <ErrorBanner messageVi={recorder.errorMessageVi} />}
      {live.lastError && <ErrorBanner code={live.lastError.code} messageVi={live.lastError.messageVi} />}
      {!online && <ErrorBanner messageVi={ERROR_MESSAGES_VI.NETWORK_OFFLINE} />}
      {storage.lowStorage && <ErrorBanner messageVi={ERROR_MESSAGES_VI.DEVICE_STORAGE_LOW} />}
      {!recorder.wakeLockSupported && recorder.phase === "recording" && (
        <ErrorBanner messageVi="Thiết bị của bạn không hỗ trợ tự động chống khoá màn hình. Vui lòng tắt tự khoá màn hình trong Cài đặt thiết bị để không bị gián đoạn ghi âm." />
      )}

      {recorder.recoveredSession && recorder.phase === "idle" && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100">
          <p>{ERROR_MESSAGES_VI.TAB_CLOSED_WHILE_RECORDING}</p>
          <button
            type="button"
            onClick={() => void recorder.begin()}
            className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
          >
            Tiếp tục ghi âm
          </button>
        </div>
      )}

      {(recorder.phase === "idle" || recorder.phase === "requesting-mic") && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Spinner
            label={recorder.phase === "requesting-mic" ? "Đang xin quyền micro..." : "Đang chuẩn bị ghi âm..."}
          />
          {recorder.phase === "idle" && !recorder.recoveredSession && (
            <button
              type="button"
              onClick={() => void recorder.begin()}
              className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
            >
              Bắt đầu ghi âm
            </button>
          )}
        </div>
      )}

      {(recorder.phase === "recording" || recorder.phase === "paused") && (
        <>
          <RecordingTimer elapsedSeconds={recorder.elapsedSeconds} paused={recorder.phase === "paused"} />
          <VolumeMeter level={recorder.phase === "paused" ? 0 : recorder.volumeLevel} />

          <RecordingControls
            paused={recorder.phase === "paused"}
            onTogglePause={() => void handleTogglePause()}
            onHighlight={handleHighlight}
            onOpenNote={() => setShowNoteModal(true)}
            onOpenAttachment={() => attachmentRef.current?.open()}
            onRequestEnd={() => setShowEndConfirm(true)}
            highlightActive={pendingHighlight}
          />
          <AttachmentButton ref={attachmentRef} onUpload={handleAttachmentUpload} />

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tóm tắt ý chính (nháp)
            </h2>
            <SummaryDraftPanel summary={live.summary} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Hội thoại gần đây
            </h2>
            <RecentSegmentsList segments={live.recentSegments} />
          </section>
        </>
      )}

      {showNoteModal && <NoteModal onSubmit={handleNoteSubmit} onClose={() => setShowNoteModal(false)} />}

      {showEndConfirm && (
        <ConfirmModal
          title="Kết thúc cuộc họp?"
          description="Bạn có chắc chắn muốn kết thúc cuộc họp? Sau khi kết thúc, hệ thống sẽ xử lý và tạo bản tóm tắt cuối cùng."
          confirmLabel={ending ? "Đang kết thúc..." : "Kết thúc"}
          danger
          onConfirm={() => void handleConfirmEnd()}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}
    </main>
  );
}
