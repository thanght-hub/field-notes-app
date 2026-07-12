import { randomUUID } from "node:crypto";
import type { RealtimeSummaryPoint, RealtimeSummarySnapshot, SummaryInputSegment } from "@field-notes/shared";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import { getProviders } from "../providers/index.js";
import { registerWorker } from "../queue/job-queue.js";

const env = loadEnv();

/** Mục 9: tóm tắt thời gian thực hiển thị tối đa 5-10 ý. */
const MAX_DISPLAY_POINTS = 10;

/**
 * Snapshot tóm tắt "nháp" mới nhất theo từng meeting, giữ trong bộ nhớ tiến trình (module-level Map).
 * GIẢ ĐỊNH ĐƠN GIẢN HOÁ v1: không lưu lịch sử các bản tóm tắt trước đó, chỉ giữ bản mới nhất mỗi
 * meeting; nếu worker restart, snapshot mất và sẽ được build lại từ toàn bộ segment 'interim' hiện có
 * ở lần chạy job kế tiếp (không mất dữ liệu vĩnh viễn vì transcript vẫn còn trong DB).
 */
const snapshots = new Map<string, RealtimeSummarySnapshot>();

registerWorker("realtime_summary", async (job) => {
  const { summary } = getProviders(env);

  const interimSegments = await prisma.transcriptSegment.findMany({
    where: { meetingId: job.meetingId, stage: "interim" },
    orderBy: { sequence: "asc" },
  });

  const newSegments: SummaryInputSegment[] = interimSegments.map((s) => ({
    segmentId: s.id,
    speakerLabel: s.speakerLabel,
    language: s.detectedLanguage,
    text: s.translatedText ?? s.originalText,
    startOffsetMs: s.startOffsetMs,
    endOffsetMs: s.endOffsetMs,
    highlighted: s.highlighted,
  }));

  const previousPoints = snapshots.get(job.meetingId)?.points ?? [];

  const output = await summary.summarizeRealtime(newSegments, previousPoints);

  const points: RealtimeSummaryPoint[] = output.points.slice(0, MAX_DISPLAY_POINTS).map((p) => ({
    id: randomUUID(),
    kind: p.kind,
    text: p.text,
    sourceSegmentIds: p.sourceSegmentIds,
    createdAt: new Date().toISOString(),
  }));

  snapshots.set(job.meetingId, {
    meetingId: job.meetingId,
    generatedAt: new Date().toISOString(),
    isDraft: true,
    points,
  });
});

/** Dùng bởi route SSE (đồng nghiệp) để lấy bản tóm tắt nháp mới nhất — trả undefined nếu chưa có. */
export function getLatestSummarySnapshot(meetingId: string): RealtimeSummarySnapshot | undefined {
  return snapshots.get(meetingId);
}
