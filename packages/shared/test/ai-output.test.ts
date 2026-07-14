import { describe, expect, it } from "vitest";
import {
  DecisionExtractionOutputSchema,
  RealtimeSummaryOutputSchema,
  TopicExtractionOutputSchema,
} from "../src/schemas/ai-output.js";
import { ERROR_CODES, ERROR_MESSAGES_VI } from "../src/constants/errors.js";
import { isSourceLanguage } from "../src/types/language.js";

describe("schema AI phải từ chối dữ liệu bịa/thiếu nguồn", () => {
  it("chấp nhận realtime summary hợp lệ có sourceSegmentIds", () => {
    const result = RealtimeSummaryOutputSchema.safeParse({
      points: [{ kind: "y_chinh", text: "Nội dung chính", sourceSegmentIds: ["seg-1"] }],
    });
    expect(result.success).toBe(true);
  });

  it("từ chối điểm tóm tắt không có sourceSegmentIds (không truy ngược được transcript)", () => {
    const result = RealtimeSummaryOutputSchema.safeParse({
      points: [{ kind: "y_chinh", text: "Nội dung chính", sourceSegmentIds: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("từ chối quyết định thiếu confidence hoặc sai kiểu", () => {
    const result = DecisionExtractionOutputSchema.safeParse({
      decisions: [
        {
          content: "Quyết định X",
          relatedTopicTitle: null,
          occurredAtOffsetMs: 1000,
          confidence: "cao", // sai kiểu — phải là number 0..1
          sourceSegmentIds: ["seg-1"],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("cho phép conclusion=null khi chủ đề chưa có kết luận", () => {
    const result = TopicExtractionOutputSchema.safeParse({
      topics: [
        {
          title: "Chủ đề A",
          startOffsetMs: 0,
          endOffsetMs: 1000,
          discussionSummary: "Đang thảo luận",
          differingViewpoints: null,
          conclusion: null,
          conclusionStatus: "open",
          sourceSegmentIds: ["seg-1"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("mã lỗi và thông báo tiếng Việt", () => {
  it("mọi mã lỗi đều có thông báo tiếng Việt tương ứng", () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_MESSAGES_VI[code]).toBeTruthy();
    }
  });
});

describe("nhận diện ngôn ngữ nguồn hợp lệ", () => {
  it("chấp nhận ba biến thể vi-VN/zh-CN/zh-TW", () => {
    expect(isSourceLanguage("vi-VN")).toBe(true);
    expect(isSourceLanguage("zh-CN")).toBe(true);
    expect(isSourceLanguage("zh-TW")).toBe(true);
  });

  it("từ chối mã ngôn ngữ không được hỗ trợ", () => {
    expect(isSourceLanguage("en-US")).toBe(false);
  });
});
