import { z } from "zod";

/**
 * Schema JSON bắt buộc cho mọi phản hồi AI (mục 19).
 * Nguyên tắc chung áp dụng cho toàn bộ schema trong file này:
 * - Không bịa nội dung; trả `null` khi không tìm thấy dữ liệu.
 * - Mọi kết luận phải gắn `sourceSegmentIds` để truy ngược transcript (mục 27).
 * - Không tự suy diễn quyết định/deadline nếu transcript chỉ đang thảo luận (mục 10.4).
 */

export const RealtimeSummaryPointKindSchema = z.enum([
  "y_chinh",
  "dang_thao_luan",
  "quyet_dinh_tam_thoi",
  "chua_thong_nhat",
]);

export const RealtimeSummaryOutputSchema = z.object({
  points: z
    .array(
      z.object({
        kind: RealtimeSummaryPointKindSchema,
        text: z.string().min(1),
        sourceSegmentIds: z.array(z.string()).min(1),
      }),
    )
    .max(10),
});
export type RealtimeSummaryOutput = z.infer<typeof RealtimeSummaryOutputSchema>;

export const FinalSummaryOutputSchema = z.object({
  executiveSummary: z.string().min(1),
});
export type FinalSummaryOutput = z.infer<typeof FinalSummaryOutputSchema>;

export const TopicExtractionOutputSchema = z.object({
  topics: z.array(
    z.object({
      title: z.string().min(1),
      startOffsetMs: z.number().int().nonnegative(),
      endOffsetMs: z.number().int().nonnegative(),
      discussionSummary: z.string().min(1),
      differingViewpoints: z.string().nullable(),
      conclusion: z.string().nullable(),
      conclusionStatus: z.enum(["concluded", "open"]),
      sourceSegmentIds: z.array(z.string()).min(1),
    }),
  ),
});
export type TopicExtractionOutput = z.infer<typeof TopicExtractionOutputSchema>;

export const DecisionExtractionOutputSchema = z.object({
  decisions: z.array(
    z.object({
      content: z.string().min(1),
      relatedTopicTitle: z.string().nullable(),
      occurredAtOffsetMs: z.number().int().nonnegative(),
      confidence: z.number().min(0).max(1),
      sourceSegmentIds: z.array(z.string()).min(1),
    }),
  ),
});
export type DecisionExtractionOutput = z.infer<typeof DecisionExtractionOutputSchema>;

export const ActionItemExtractionOutputSchema = z.object({
  actionItems: z.array(
    z.object({
      content: z.string().min(1),
      assignee: z.string().nullable(),
      dueDate: z.string().nullable(),
      sourceSegmentIds: z.array(z.string()).min(1),
    }),
  ),
});
export type ActionItemExtractionOutput = z.infer<typeof ActionItemExtractionOutputSchema>;

export const UnresolvedIssuesOutputSchema = z.object({
  issues: z.array(
    z.object({
      description: z.string().min(1),
      relatedTopicTitle: z.string().nullable(),
      sourceSegmentIds: z.array(z.string()).min(1),
    }),
  ),
});
export type UnresolvedIssuesOutput = z.infer<typeof UnresolvedIssuesOutputSchema>;

export const TranslationReviewOutputSchema = z.object({
  reviewedText: z.string().min(1),
  changedFromOriginal: z.boolean(),
  uncertainTerms: z.array(z.string()),
});
export type TranslationReviewOutput = z.infer<typeof TranslationReviewOutputSchema>;
