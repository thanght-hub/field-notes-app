import { SchemaType, VertexAI, type GenerativeModel, type Schema } from "@google-cloud/vertexai";
import {
  ActionItemExtractionOutputSchema,
  DecisionExtractionOutputSchema,
  FinalSummaryOutputSchema,
  RealtimeSummaryOutputSchema,
  TopicExtractionOutputSchema,
  UnresolvedIssuesOutputSchema,
  type ActionItemExtractionOutput,
  type DecisionExtractionOutput,
  type FinalSummaryOutput,
  type MeetingSummaryProvider,
  type RealtimeSummaryOutput,
  type SummaryInputSegment,
  type TopicExtractionOutput,
  type UnresolvedIssuesOutput,
} from "@field-notes/shared";
import type { ZodType } from "zod";
import type { AppEnv } from "../../config/env.js";
import { loadPrompt } from "./prompt-loader.js";

/** JSON Schema thủ công khớp 1:1 với RealtimeSummaryOutputSchema (packages/shared/src/schemas/ai-output.ts). */
const realtimeSummaryResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    points: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          kind: {
            type: SchemaType.STRING,
            enum: ["y_chinh", "dang_thao_luan", "quyet_dinh_tam_thoi", "chua_thong_nhat"],
          },
          text: { type: SchemaType.STRING },
          sourceSegmentIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["kind", "text", "sourceSegmentIds"],
      },
    },
  },
  required: ["points"],
};

/** JSON Schema thủ công khớp 1:1 với FinalSummaryOutputSchema. */
const finalSummaryResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    executiveSummary: { type: SchemaType.STRING },
  },
  required: ["executiveSummary"],
};

/** JSON Schema thủ công khớp 1:1 với TopicExtractionOutputSchema. */
const topicExtractionResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    topics: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          startOffsetMs: { type: SchemaType.INTEGER },
          endOffsetMs: { type: SchemaType.INTEGER },
          discussionSummary: { type: SchemaType.STRING },
          differingViewpoints: { type: SchemaType.STRING, nullable: true },
          conclusion: { type: SchemaType.STRING, nullable: true },
          conclusionStatus: { type: SchemaType.STRING, enum: ["concluded", "open"] },
          sourceSegmentIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: [
          "title",
          "startOffsetMs",
          "endOffsetMs",
          "discussionSummary",
          "differingViewpoints",
          "conclusion",
          "conclusionStatus",
          "sourceSegmentIds",
        ],
      },
    },
  },
  required: ["topics"],
};

/** JSON Schema thủ công khớp 1:1 với DecisionExtractionOutputSchema. */
const decisionExtractionResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    decisions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          content: { type: SchemaType.STRING },
          relatedTopicTitle: { type: SchemaType.STRING, nullable: true },
          occurredAtOffsetMs: { type: SchemaType.INTEGER },
          confidence: { type: SchemaType.NUMBER },
          sourceSegmentIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["content", "relatedTopicTitle", "occurredAtOffsetMs", "confidence", "sourceSegmentIds"],
      },
    },
  },
  required: ["decisions"],
};

/** JSON Schema thủ công khớp 1:1 với ActionItemExtractionOutputSchema. */
const actionItemExtractionResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    actionItems: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          content: { type: SchemaType.STRING },
          assignee: { type: SchemaType.STRING, nullable: true },
          dueDate: { type: SchemaType.STRING, nullable: true },
          sourceSegmentIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["content", "assignee", "dueDate", "sourceSegmentIds"],
      },
    },
  },
  required: ["actionItems"],
};

/** JSON Schema thủ công khớp 1:1 với UnresolvedIssuesOutputSchema. */
const unresolvedIssuesResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    issues: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          description: { type: SchemaType.STRING },
          relatedTopicTitle: { type: SchemaType.STRING, nullable: true },
          sourceSegmentIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["description", "relatedTopicTitle", "sourceSegmentIds"],
      },
    },
  },
  required: ["issues"],
};

/**
 * Cài đặt MeetingSummaryProvider bằng Vertex AI Gemini với structured output (mục 9, 10, 14.4, 19, 21, 27).
 * Mỗi phương thức: load prompt version tương ứng từ /prompts, ép responseSchema, validate bằng Zod,
 * retry đúng 1 lần kèm thông báo lỗi Zod nếu sai, nếu vẫn sai thì throw để job được đánh dấu "failed"
 * thay vì tự bịa dữ liệu (mục 21, 27).
 */
export class GoogleMeetingSummaryProvider implements MeetingSummaryProvider {
  private readonly vertexAI: VertexAI;

  constructor(private readonly env: AppEnv) {
    this.vertexAI = new VertexAI({
      project: env.GOOGLE_CLOUD_PROJECT_ID ?? "",
      location: env.GOOGLE_GEMINI_LOCATION,
    });
  }

  private getModel(systemInstruction: string, responseSchema: Schema): GenerativeModel {
    return this.vertexAI.getGenerativeModel({
      model: this.env.GOOGLE_GEMINI_MODEL,
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });
  }

  /**
   * Gọi Gemini với structured output, validate bằng Zod, retry tối đa 1 lần kèm lỗi Zod nếu sai schema.
   */
  private async runStructured<T>(
    promptFile: string,
    responseSchema: Schema,
    zodSchema: ZodType<T>,
    userPayload: unknown,
  ): Promise<T> {
    const systemInstruction = await loadPrompt(promptFile);
    const model = this.getModel(systemInstruction, responseSchema);

    const callOnce = async (extraInstruction?: string): Promise<unknown> => {
      const userText = extraInstruction
        ? `${JSON.stringify(userPayload)}\n\n${extraInstruction}`
        : JSON.stringify(userPayload);
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userText }] }],
      });
      const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      try {
        return JSON.parse(text);
      } catch {
        // JSON.parse thất bại — coi như dữ liệu không hợp lệ, không tự chế (mục 21, 27).
        return undefined;
      }
    };

    const first = await callOnce();
    const firstResult = zodSchema.safeParse(first);
    if (firstResult.success) return firstResult.data;

    const issuesText = JSON.stringify(firstResult.error.issues);
    const retryInstruction = `Phản hồi trước của bạn KHÔNG hợp lệ theo schema yêu cầu. Lỗi cụ thể (Zod): ${issuesText}. Hãy sửa lại và CHỈ trả về đúng JSON theo schema, không thêm giải thích.`;
    const second = await callOnce(retryInstruction);
    const secondResult = zodSchema.safeParse(second);
    if (secondResult.success) return secondResult.data;

    throw new Error("Tóm tắt AI trả về dữ liệu không hợp lệ (đã thử lại 1 lần)");
  }

  async summarizeRealtime(
    newSegments: SummaryInputSegment[],
    previousPoints: RealtimeSummaryOutput["points"],
  ): Promise<RealtimeSummaryOutput> {
    return this.runStructured(
      "realtime-summary.v1.md",
      realtimeSummaryResponseSchema,
      RealtimeSummaryOutputSchema,
      { previousPoints, newSegments },
    );
  }

  async summarizeFinal(allSegments: SummaryInputSegment[]): Promise<FinalSummaryOutput> {
    return this.runStructured("final-summary.v1.md", finalSummaryResponseSchema, FinalSummaryOutputSchema, {
      allSegments,
    });
  }

  async extractTopics(allSegments: SummaryInputSegment[]): Promise<TopicExtractionOutput> {
    return this.runStructured(
      "topic-extraction.v1.md",
      topicExtractionResponseSchema,
      TopicExtractionOutputSchema,
      { allSegments },
    );
  }

  async extractDecisions(
    allSegments: SummaryInputSegment[],
    highlightedSegmentIds: string[],
  ): Promise<DecisionExtractionOutput> {
    return this.runStructured(
      "decision-extraction.v1.md",
      decisionExtractionResponseSchema,
      DecisionExtractionOutputSchema,
      { allSegments, highlightedSegmentIds },
    );
  }

  async extractActionItems(allSegments: SummaryInputSegment[]): Promise<ActionItemExtractionOutput> {
    return this.runStructured(
      "action-item-extraction.v1.md",
      actionItemExtractionResponseSchema,
      ActionItemExtractionOutputSchema,
      { allSegments },
    );
  }

  async extractUnresolvedIssues(allSegments: SummaryInputSegment[]): Promise<UnresolvedIssuesOutput> {
    return this.runStructured(
      "unresolved-issues-extraction.v1.md",
      unresolvedIssuesResponseSchema,
      UnresolvedIssuesOutputSchema,
      { allSegments },
    );
  }
}
