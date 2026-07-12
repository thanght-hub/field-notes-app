import type { SourceLanguage } from "@field-notes/shared";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import { getProviders } from "../providers/index.js";
import { enqueueJob, registerWorker } from "../queue/job-queue.js";
import { getStorageProvider } from "../storage/index.js";

const env = loadEnv();
const storage = getStorageProvider(env);

/** Ngưỡng (ms) coi 2 đoạn liền kề là cùng 1 người nói — heuristic tạm thời cho thời gian thực (mục 7.2). */
const SPEAKER_GAP_THRESHOLD_MS = 3000;
const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Map<meetingId, epochMs lần enqueue realtime_summary gần nhất> — chỉ để throttle, không cần bền vững
 * qua restart (mục 9: tóm tắt mỗi REALTIME_SUMMARY_INTERVAL_SEC giây).
 */
const lastSummaryEnqueuedAt = new Map<string, number>();

registerWorker("transcribe_chunk", async (job) => {
  const chunkId = job.payload.chunkId;
  if (typeof chunkId !== "string" || chunkId.length === 0) {
    throw new Error("Payload transcribe_chunk thiếu chunkId hợp lệ");
  }

  const chunk = await prisma.audioChunk.findUnique({ where: { id: chunkId } });
  if (!chunk) {
    throw new Error(`Không tìm thấy AudioChunk id=${chunkId}`);
  }
  if (!chunk.storageObjectKey) {
    throw new Error(`AudioChunk id=${chunkId} chưa có storageObjectKey`);
  }

  const { speech, languageDetection, translation } = getProviders(env);

  const data = await storage.getObject(chunk.storageObjectKey);

  const detected = await languageDetection.detectLanguage({ data, mimeType: chunk.mimeType });

  let best = await speech.transcribeChunk({
    data,
    mimeType: chunk.mimeType,
    languageHint: detected.language,
  });

  // Nếu confidence thấp và có ứng viên ngôn ngữ khác, thử lại và giữ kết quả confidence cao hơn (mục 7.1).
  if (best.confidence < LOW_CONFIDENCE_THRESHOLD && detected.alternatives.length > 0) {
    const altLanguage = detected.alternatives[0]?.language;
    if (altLanguage && altLanguage !== detected.language) {
      const altAttempt = await speech.transcribeChunk({
        data,
        mimeType: chunk.mimeType,
        languageHint: altLanguage,
      });
      if (altAttempt.confidence > best.confidence) {
        best = altAttempt;
      }
    }
  }

  const finalLanguage: SourceLanguage = best.language;
  const translated = await translation.translateToVietnamese({ text: best.text, sourceLanguage: finalLanguage });

  const speakerLabel = await resolveSpeakerLabel(chunk.meetingId, chunk.startOffsetMs);
  const lowConfidence = best.confidence < LOW_CONFIDENCE_THRESHOLD;

  await prisma.transcriptSegment.create({
    data: {
      meetingId: chunk.meetingId,
      audioChunkId: chunk.id,
      sequence: chunk.sequence,
      startOffsetMs: chunk.startOffsetMs,
      endOffsetMs: chunk.endOffsetMs,
      speakerLabel,
      detectedLanguage: finalLanguage,
      originalText: best.text,
      // Chỉ lưu translatedText khi ngôn ngữ nguồn khác ngôn ngữ đích (kiến trúc/domain: TranscriptSegment.translatedText).
      translatedText: finalLanguage === "vi-VN" ? undefined : translated.translatedText,
      confidence: best.confidence,
      stage: "interim",
      lowConfidence,
      highlighted: false,
      editedByUser: false,
    },
  });

  await prisma.audioChunk.update({ where: { id: chunk.id }, data: { status: "transcribed" } });

  const now = Date.now();
  const last = lastSummaryEnqueuedAt.get(chunk.meetingId) ?? 0;
  const intervalMs = env.REALTIME_SUMMARY_INTERVAL_SEC * 1000;
  if (now - last >= intervalMs) {
    lastSummaryEnqueuedAt.set(chunk.meetingId, now);
    await enqueueJob({ meetingId: chunk.meetingId, type: "realtime_summary", payload: {} });
  }
});

/**
 * Heuristic tạm cho nhãn người nói ở giai đoạn thời gian thực (mục 7.2): nếu đoạn transcript cuối
 * cùng (theo sequence) của cùng cuộc họp kết thúc gần thời điểm bắt đầu chunk hiện tại (< 3000ms) thì
 * coi là cùng người nói; ngược lại tăng số người nói lên 1. Đây KHÔNG phải diarization thật — sẽ được
 * chuẩn hoá lại toàn cục ở bước finalize (xem pipeline/finalize-meeting.ts).
 */
async function resolveSpeakerLabel(meetingId: string, startOffsetMs: number): Promise<string> {
  const lastSegment = await prisma.transcriptSegment.findFirst({
    where: { meetingId },
    orderBy: { sequence: "desc" },
  });

  if (!lastSegment) {
    return "Người nói 1";
  }

  if (Math.abs(startOffsetMs - lastSegment.endOffsetMs) < SPEAKER_GAP_THRESHOLD_MS) {
    return lastSegment.speakerLabel;
  }

  const match = /Người nói (\d+)/.exec(lastSegment.speakerLabel);
  const lastNumber = match?.[1] ? Number(match[1]) : 1;
  return `Người nói ${lastNumber + 1}`;
}
