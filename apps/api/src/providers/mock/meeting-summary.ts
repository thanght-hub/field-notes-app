import type {
  ActionItemExtractionOutput,
  DecisionExtractionOutput,
  FinalSummaryOutput,
  MeetingSummaryProvider,
  RealtimeSummaryOutput,
  TopicExtractionOutput,
  UnresolvedIssuesOutput,
} from "@field-notes/shared";

/**
 * Giả lập MeetingSummaryProvider cho dev/test (AI_PROVIDER=mock).
 * Mỗi method trả dữ liệu tối thiểu nhưng hợp lệ theo đúng Zod schema tương ứng để pipeline finalize
 * chạy hết được end-to-end mà không cần gọi Gemini thật.
 */
export class MockMeetingSummaryProvider implements MeetingSummaryProvider {
  async summarizeRealtime(): Promise<RealtimeSummaryOutput> {
    return { points: [] };
  }

  async summarizeFinal(): Promise<FinalSummaryOutput> {
    return { executiveSummary: "[Tóm tắt giả lập] Chưa có tóm tắt thật vì đang chạy ở chế độ mock." };
  }

  async extractTopics(): Promise<TopicExtractionOutput> {
    return { topics: [] };
  }

  async extractDecisions(): Promise<DecisionExtractionOutput> {
    return { decisions: [] };
  }

  async extractActionItems(): Promise<ActionItemExtractionOutput> {
    return { actionItems: [] };
  }

  async extractUnresolvedIssues(): Promise<UnresolvedIssuesOutput> {
    return { issues: [] };
  }
}
