import type {
  ActionItemExtractionOutput,
  DecisionExtractionOutput,
  FinalSummaryOutput,
  RealtimeSummaryOutput,
  TopicExtractionOutput,
  UnresolvedIssuesOutput,
} from "../schemas/ai-output.js";

/** Một đoạn transcript rút gọn dùng làm input cho AI — không lộ toàn bộ entity nội bộ. */
export interface SummaryInputSegment {
  segmentId: string;
  speakerLabel: string;
  language: string;
  text: string;
  startOffsetMs: number;
  endOffsetMs: number;
  highlighted: boolean;
}

/**
 * Interface tóm tắt/trích xuất nội dung cuộc họp (mục 9, 10, 14.4).
 * Mọi phương thức phải dùng prompt có version trong /prompts và ép structured output theo schema ở
 * packages/shared/src/schemas/ai-output.ts (mục 19).
 */
export interface MeetingSummaryProvider {
  summarizeRealtime(
    newSegments: SummaryInputSegment[],
    previousPoints: RealtimeSummaryOutput["points"],
  ): Promise<RealtimeSummaryOutput>;

  summarizeFinal(allSegments: SummaryInputSegment[]): Promise<FinalSummaryOutput>;

  extractTopics(allSegments: SummaryInputSegment[]): Promise<TopicExtractionOutput>;

  extractDecisions(
    allSegments: SummaryInputSegment[],
    highlightedSegmentIds: string[],
  ): Promise<DecisionExtractionOutput>;

  extractActionItems(allSegments: SummaryInputSegment[]): Promise<ActionItemExtractionOutput>;

  extractUnresolvedIssues(allSegments: SummaryInputSegment[]): Promise<UnresolvedIssuesOutput>;
}
