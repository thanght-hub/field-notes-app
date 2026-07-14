import type { SummaryInputSegment } from "@field-notes/shared";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import { getProviders } from "../providers/index.js";
import { enqueueJob, registerWorker } from "../queue/job-queue.js";
import { getStorageProvider } from "../storage/index.js";

const env = loadEnv();
const storage = getStorageProvider(env);
const LOW_CONFIDENCE_THRESHOLD = 0.6;

function errorMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : "Lỗi không xác định";
}

registerWorker("finalize_meeting", async (job) => {
  const meeting = await prisma.meeting.findUnique({ where: { id: job.meetingId } });
  if (!meeting) {
    throw new Error(`Không tìm thấy Meeting id=${job.meetingId}`);
  }

  const { speech, languageDetection, translation, summary } = getProviders(env);

  // 1. Xử lý lại các đoạn confidence thấp bằng ngữ cảnh toàn cuộc họp (chỉ với segment chưa bị người dùng sửa).
  const lowConfidenceSegments = await prisma.transcriptSegment.findMany({
    where: { meetingId: job.meetingId, lowConfidence: true, editedByUser: false },
  });

  for (const seg of lowConfidenceSegments) {
    try {
      if (!seg.audioChunkId) continue; // không còn audio gốc liên kết để nhận dạng lại
      const chunk = await prisma.audioChunk.findUnique({ where: { id: seg.audioChunkId } });
      if (!chunk?.storageObjectKey) continue;

      const data = await storage.getObject(chunk.storageObjectKey);
      const detected = await languageDetection.detectLanguage({ data, mimeType: chunk.mimeType });
      const altLanguage = detected.alternatives[0]?.language ?? detected.language;
      const retry = await speech.transcribeChunk({ data, mimeType: chunk.mimeType, languageHint: altLanguage });

      if (retry.confidence > seg.confidence) {
        const translated = await translation.translateToVietnamese({
          text: retry.text,
          sourceLanguage: retry.language,
        });
        await prisma.transcriptSegment.update({
          where: { id: seg.id },
          data: {
            originalText: retry.text,
            translatedText: retry.language === "vi-VN" ? null : translated.translatedText,
            confidence: retry.confidence,
            lowConfidence: retry.confidence < LOW_CONFIDENCE_THRESHOLD,
            detectedLanguage: retry.language,
          },
        });
      }
    } catch (err) {
      // Không log nội dung transcript (mục 20) — chỉ log meetingId/segmentId/message lỗi.
      console.error("finalize_reprocess_low_confidence_failed", {
        meetingId: job.meetingId,
        segmentId: seg.id,
        message: errorMessageOf(err),
      });
    }
  }

  // 2. Chuẩn hoá nhãn người nói toàn cục (diarization toàn cục, mục 7.2) — bỏ qua segment người dùng đã tự sửa.
  try {
    await renumberSpeakerLabels(job.meetingId);
  } catch (err) {
    console.error("finalize_renumber_speakers_failed", {
      meetingId: job.meetingId,
      message: errorMessageOf(err),
    });
  }

  // 3. Set stage='final' cho TẤT CẢ segment (kể cả segment editedByUser=true — chỉ đổi field `stage`).
  await prisma.transcriptSegment.updateMany({
    where: { meetingId: job.meetingId },
    data: { stage: "final" },
  });

  // 4. Sinh Topic/Decision/ActionItem/vấn đề tồn đọng/tóm tắt điều hành — mỗi bước try/catch riêng để
  // lỗi 1 bước không làm hỏng các bước khác (mục 21).
  const allSegmentsDb = await prisma.transcriptSegment.findMany({
    where: { meetingId: job.meetingId },
    orderBy: { sequence: "asc" },
  });

  const allSegments: SummaryInputSegment[] = allSegmentsDb.map((s) => ({
    segmentId: s.id,
    speakerLabel: s.speakerLabel,
    language: s.detectedLanguage,
    text: s.translatedText ?? s.originalText,
    startOffsetMs: s.startOffsetMs,
    endOffsetMs: s.endOffsetMs,
    highlighted: s.highlighted,
  }));
  const highlightedSegmentIds = allSegmentsDb.filter((s) => s.highlighted).map((s) => s.id);

  const topicIdByTitle = new Map<string, string>();

  try {
    const { topics } = await summary.extractTopics(allSegments);
    for (const t of topics) {
      const created = await prisma.topic.create({
        data: {
          meetingId: job.meetingId,
          title: t.title,
          startOffsetMs: t.startOffsetMs,
          endOffsetMs: t.endOffsetMs,
          discussionSummary: t.discussionSummary,
          differingViewpoints: t.differingViewpoints ?? undefined,
          conclusion: t.conclusion ?? undefined,
          conclusionStatus: t.conclusionStatus,
        },
      });
      topicIdByTitle.set(t.title, created.id);
    }
  } catch (err) {
    console.error("finalize_extract_topics_failed", { meetingId: job.meetingId, message: errorMessageOf(err) });
  }

  try {
    const { decisions } = await summary.extractDecisions(allSegments, highlightedSegmentIds);
    for (const d of decisions) {
      const topicId = d.relatedTopicTitle ? (topicIdByTitle.get(d.relatedTopicTitle) ?? undefined) : undefined;
      await prisma.decision.create({
        data: {
          meetingId: job.meetingId,
          topicId,
          content: d.content,
          occurredAtOffsetMs: d.occurredAtOffsetMs,
          confidence: d.confidence,
          sourceSegmentIds: d.sourceSegmentIds,
        },
      });
    }
  } catch (err) {
    console.error("finalize_extract_decisions_failed", { meetingId: job.meetingId, message: errorMessageOf(err) });
  }

  try {
    const { actionItems } = await summary.extractActionItems(allSegments);
    for (const a of actionItems) {
      await prisma.actionItem.create({
        data: {
          meetingId: job.meetingId,
          content: a.content,
          assignee: a.assignee ?? undefined,
          dueDate: a.dueDate ?? undefined,
          sourceSegmentIds: a.sourceSegmentIds,
        },
      });
    }
  } catch (err) {
    console.error("finalize_extract_action_items_failed", { meetingId: job.meetingId, message: errorMessageOf(err) });
  }

  // Schema hiện tại KHÔNG có bảng riêng cho "vấn đề chưa thống nhất" (mục 10.6).
  // QUYẾT ĐỊNH (xem báo cáo cuối để biết lý do): lưu tạm mỗi issue KHÔNG khớp Topic đã tạo ở bước trên
  // thành 1 Topic bổ sung với conclusionStatus='open' và discussionSummary=issue.description, để vẫn
  // hiển thị được trong UI Topic hiện có mà không cần chờ migration. Đề xuất bổ sung bảng
  // `UnresolvedIssue` riêng cho v2.
  try {
    const { issues } = await summary.extractUnresolvedIssues(allSegments);
    for (const issue of issues) {
      if (issue.relatedTopicTitle && topicIdByTitle.has(issue.relatedTopicTitle)) {
        continue; // đã có Topic tương ứng từ bước extractTopics, không tạo trùng.
      }
      const title = issue.relatedTopicTitle ?? issue.description.slice(0, 80);
      await prisma.topic.create({
        data: {
          meetingId: job.meetingId,
          title,
          startOffsetMs: 0,
          endOffsetMs: 0,
          discussionSummary: issue.description,
          conclusionStatus: "open",
        },
      });
    }
  } catch (err) {
    console.error("finalize_extract_unresolved_issues_failed", {
      meetingId: job.meetingId,
      message: errorMessageOf(err),
    });
  }

  // summarizeFinal -> lưu vào Meeting.executiveSummary (mục 10.2).
  let executiveSummary: string | undefined;
  try {
    executiveSummary = (await summary.summarizeFinal(allSegments)).executiveSummary;
  } catch (err) {
    console.error("finalize_summarize_final_failed", { meetingId: job.meetingId, message: errorMessageOf(err) });
  }

  // 5. Update Meeting: durationSeconds, speakerCountEstimate, executiveSummary, status='completed'.
  const finalSegments = await prisma.transcriptSegment.findMany({ where: { meetingId: job.meetingId } });
  const uniqueSpeakers = new Set(finalSegments.map((s) => s.speakerLabel));
  const durationSeconds =
    meeting.startedAt && meeting.endedAt
      ? Math.max(0, Math.round((meeting.endedAt.getTime() - meeting.startedAt.getTime()) / 1000))
      : (meeting.durationSeconds ?? undefined);

  await prisma.meeting.update({
    where: { id: job.meetingId },
    data: {
      durationSeconds,
      speakerCountEstimate: uniqueSpeakers.size,
      executiveSummary,
      status: "completed",
    },
  });

  // 6. Đẩy job xuất ra Google Drive.
  await enqueueJob({ meetingId: job.meetingId, type: "drive_export", payload: {} });
});

/**
 * Chuẩn hoá nhãn người nói theo thứ tự xuất hiện lần đầu của MỖI giá trị speakerLabel gốc hiện có
 * (chỉ đổi TÊN nhất quán thành "Người nói 1..N", không đổi số lượng người nói). Bỏ qua hoàn toàn các
 * segment có editedByUser=true — giữ nguyên nhãn do người dùng tự sửa (mục 7.2, 6.2).
 */
async function renumberSpeakerLabels(meetingId: string): Promise<void> {
  const segments = await prisma.transcriptSegment.findMany({
    where: { meetingId },
    orderBy: { sequence: "asc" },
  });

  const labelMap = new Map<string, string>();
  let nextNumber = 1;

  for (const seg of segments) {
    if (seg.editedByUser) continue;
    if (!labelMap.has(seg.speakerLabel)) {
      labelMap.set(seg.speakerLabel, `Người nói ${nextNumber}`);
      nextNumber += 1;
    }
  }

  for (const seg of segments) {
    if (seg.editedByUser) continue;
    const newLabel = labelMap.get(seg.speakerLabel);
    if (newLabel && newLabel !== seg.speakerLabel) {
      await prisma.transcriptSegment.update({ where: { id: seg.id }, data: { speakerLabel: newLabel } });
    }
  }
}
