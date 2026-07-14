"use client";

import { useEffect, useState } from "react";
import type {
  AudioChunkStatus,
  MeetingLiveEvent,
  MeetingStatus,
  RealtimeSummarySnapshot,
  TranscriptSegment,
} from "@field-notes/shared";
import { subscribeMeetingLive, type LiveConnectionStatus } from "@/lib/api/live";

const MAX_RECENT_SEGMENTS = 10;

export interface MeetingLiveState {
  connectionStatus: LiveConnectionStatus;
  /** 5-10 đoạn hội thoại gần nhất (mục 5.3 — KHÔNG hiển thị toàn bộ transcript trong lúc họp). */
  recentSegments: TranscriptSegment[];
  summary: RealtimeSummarySnapshot | null;
  meetingStatus: MeetingStatus | null;
  lastChunkStatusEvent: { chunkId: string; status: AudioChunkStatus } | null;
  lastError: { code: string; messageVi: string } | null;
}

const INITIAL_STATE: MeetingLiveState = {
  connectionStatus: "connecting",
  recentSegments: [],
  summary: null,
  meetingStatus: null,
  lastChunkStatusEvent: null,
  lastError: null,
};

function applyEvent(prev: MeetingLiveState, event: MeetingLiveEvent): MeetingLiveState {
  switch (event.type) {
    case "transcript_segment": {
      const withoutDuplicate = prev.recentSegments.filter((s) => s.id !== event.segment.id);
      const next = [...withoutDuplicate, event.segment].sort((a, b) => a.sequence - b.sequence);
      return { ...prev, recentSegments: next.slice(-MAX_RECENT_SEGMENTS) };
    }
    case "summary_snapshot":
      return { ...prev, summary: event.summary };
    case "meeting_status":
      return { ...prev, meetingStatus: event.status };
    case "chunk_status":
      return { ...prev, lastChunkStatusEvent: { chunkId: event.chunkId, status: event.status } };
    case "error":
      return { ...prev, lastError: { code: event.code, messageVi: event.messageVi } };
    default:
      return prev;
  }
}

/** Kết nối SSE `.../live` và tổng hợp trạng thái hiển thị cho màn hình đang họp (mục 5.3, 17.2). */
export function useMeetingLive(meetingId: string | undefined): MeetingLiveState {
  const [state, setState] = useState<MeetingLiveState>(INITIAL_STATE);

  useEffect(() => {
    if (!meetingId) return;
    setState(INITIAL_STATE);

    const unsubscribe = subscribeMeetingLive(
      meetingId,
      (event) => setState((prev) => applyEvent(prev, event)),
      (status) => setState((prev) => ({ ...prev, connectionStatus: status })),
    );

    return unsubscribe;
  }, [meetingId]);

  return state;
}
