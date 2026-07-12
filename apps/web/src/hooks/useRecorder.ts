"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ERROR_MESSAGES_VI } from "@field-notes/shared";
import { ChunkRecorder, isRecordingSupported } from "@/lib/recorder";
import { requestWakeLock, type WakeLockHandle } from "@/lib/wake-lock";
import { SyncQueue, type SyncQueueStatus } from "@/lib/sync-queue";
import { describeGetUserMediaError } from "@/lib/error-messages";
import {
  clearRecordingSession,
  getRecordingSession,
  listChunksForMeeting,
  saveRecordingSession,
  type RecordingSessionRecord,
} from "@/lib/offline-db";

export type RecordingPhase =
  | "idle"
  | "requesting-mic"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

export interface UseRecorderResult {
  phase: RecordingPhase;
  elapsedSeconds: number;
  /** Mức âm lượng micro chuẩn hoá 0..1, dùng vẽ 1 thanh bar đơn giản. */
  volumeLevel: number;
  wakeLockSupported: boolean;
  syncStatus: SyncQueueStatus;
  errorMessageVi: string | null;
  /** Khác null nếu phát hiện phiên ghi âm dang dở của cuộc họp này từ trước khi tải lại trang (mục 3.1). */
  recoveredSession: RecordingSessionRecord | null;
  begin: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
}

const INITIAL_SYNC_STATUS: SyncQueueStatus = { online: true, pendingCount: 0, uploadingCount: 0 };

export function useRecorder(meetingId: string): UseRecorderResult {
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncQueueStatus>(INITIAL_SYNC_STATUS);
  const [errorMessageVi, setErrorMessageVi] = useState<string | null>(null);
  const [recoveredSession, setRecoveredSession] = useState<RecordingSessionRecord | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<ChunkRecorder | null>(null);
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const syncQueueRef = useRef<SyncQueue | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const pauseStartRef = useRef<number | null>(null);
  const chunkCountRef = useRef<number>(0);

  // Hàng đợi đồng bộ chạy độc lập với vòng đời micro: nếu trang bị đóng đột ngột và mở lại,
  // các chunk cũ còn "local"/"queued"/"failed" trong IndexedDB vẫn tiếp tục được đẩy lên server
  // ngay cả trước khi người dùng bấm "Tiếp tục ghi âm" (mục 3.1, 15, 16).
  useEffect(() => {
    const queue = new SyncQueue(meetingId);
    const unsubscribe = queue.onStatusChange((status) => {
      setSyncStatus((prev) => ({
        online: status.online,
        pendingCount: status.pendingCount >= 0 ? status.pendingCount : prev.pendingCount,
        uploadingCount: status.uploadingCount,
      }));
    });
    queue.start();
    syncQueueRef.current = queue;

    void getRecordingSession(meetingId).then((session) => {
      if (session) setRecoveredSession(session);
    });

    return () => {
      unsubscribe();
      queue.stop();
    };
  }, [meetingId]);

  const stopVolumeLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startVolumeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      setVolumeLevel(Math.min(1, rms * 4));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const persistSession = useCallback(
    (status: string) => {
      void saveRecordingSession({
        meetingId,
        startedAt: startedAtRef.current,
        lastKnownStatus: status,
        chunkCount: chunkCountRef.current,
        updatedAt: Date.now(),
      });
    },
    [meetingId],
  );

  const begin = useCallback(async () => {
    setErrorMessageVi(null);
    setPhase("requesting-mic");

    if (!isRecordingSupported()) {
      setErrorMessageVi(ERROR_MESSAGES_VI.CODEC_NOT_SUPPORTED);
      setPhase("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      startVolumeLoop();

      // Nếu đã có chunk cũ (khôi phục sau reload), tiếp tục đánh số sequence từ chunk cuối cùng.
      const existingChunks = await listChunksForMeeting(meetingId);
      const startSequence =
        existingChunks.length > 0
          ? Math.max(...existingChunks.map((c) => c.sequence)) + 1
          : 0;
      chunkCountRef.current = existingChunks.length;

      const recorder = new ChunkRecorder({
        meetingId,
        stream,
        startSequence,
        onChunkReady: () => {
          chunkCountRef.current += 1;
          persistSession("recording");
        },
        onError: (err) => setErrorMessageVi(err.message),
      });
      recorderRef.current = recorder;
      recorder.start();

      startedAtRef.current = Date.now();
      pausedAccumRef.current = 0;
      pauseStartRef.current = null;
      persistSession("recording");

      elapsedTimerRef.current = setInterval(() => {
        const pausedMs =
          pausedAccumRef.current + (pauseStartRef.current ? Date.now() - pauseStartRef.current : 0);
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current - pausedMs) / 1000));
      }, 500);

      const wakeLock = await requestWakeLock();
      wakeLockRef.current = wakeLock;
      setWakeLockSupported(wakeLock.supported);

      setRecoveredSession(null);
      setPhase("recording");
    } catch (err) {
      const described = describeGetUserMediaError(err);
      setErrorMessageVi(described.messageVi);
      setPhase("error");
    }
  }, [meetingId, persistSession, startVolumeLoop]);

  const pause = useCallback(() => {
    recorderRef.current?.pause();
    pauseStartRef.current = Date.now();
    setPhase("paused");
    persistSession("paused");
  }, [persistSession]);

  const resume = useCallback(() => {
    recorderRef.current?.resume();
    if (pauseStartRef.current !== null) {
      pausedAccumRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setPhase("recording");
    persistSession("recording");
  }, [persistSession]);

  const releaseMediaResources = useCallback(() => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    stopVolumeLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void wakeLockRef.current?.release();
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, [stopVolumeLoop]);

  const stop = useCallback(async () => {
    await recorderRef.current?.stop();
    releaseMediaResources();
    await clearRecordingSession(meetingId);
    setPhase("stopped");
  }, [meetingId, releaseMediaResources]);

  // Dọn dẹp tài nguyên trình duyệt nếu component unmount đột ngột (không xoá recordingSession —
  // để lần load sau còn khôi phục được, theo đúng mục 3.1).
  useEffect(() => releaseMediaResources, [releaseMediaResources]);

  return {
    phase,
    elapsedSeconds,
    volumeLevel,
    wakeLockSupported,
    syncStatus,
    errorMessageVi,
    recoveredSession,
    begin,
    pause,
    resume,
    stop,
  };
}
