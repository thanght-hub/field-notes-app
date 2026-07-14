import { VertexAI } from "@google-cloud/vertexai";
import type { TranslatedText, TranslationProvider, TranslationRequest } from "@field-notes/shared";
import type { AppEnv } from "../../config/env.js";
import { loadPrompt } from "./prompt-loader.js";

export interface ReviewTranslationInput {
  segmentId: string;
  originalText: string;
  sourceLanguage: TranslationRequest["sourceLanguage"];
  translatedText: string;
}

export interface ReviewTranslationOutput {
  reviewedText: string;
  changedFromOriginal: boolean;
  uncertainTerms: string[];
}

/**
 * Cài đặt TranslationProvider bằng Vertex AI Gemini (mục 8, 14.4).
 * Dịch câu đơn lẻ (`translateToVietnamese`) dùng prompt inline ngắn gọn — theo yêu cầu chỉ 6 file
 * mục 19 là bắt buộc, không cần file .md riêng cho việc dịch từng câu.
 */
export class GoogleTranslationProvider implements TranslationProvider {
  private readonly vertexAI: VertexAI;

  constructor(private readonly env: AppEnv) {
    this.vertexAI = new VertexAI({
      project: env.GOOGLE_CLOUD_PROJECT_ID ?? "",
      location: env.GOOGLE_GEMINI_LOCATION,
    });
  }

  async translateToVietnamese(request: TranslationRequest): Promise<TranslatedText> {
    const model = this.vertexAI.getGenerativeModel({ model: this.env.GOOGLE_GEMINI_MODEL });

    const instruction =
      request.sourceLanguage === "vi-VN"
        ? "Đoạn văn sau đây đã là tiếng Việt. Chỉ chuẩn hoá lại chính tả và dấu câu, KHÔNG dịch, KHÔNG diễn giải lại nội dung, giữ nguyên số liệu/tên riêng/thuật ngữ. Chỉ trả về văn bản kết quả, không thêm giải thích."
        : `Dịch đoạn văn sau từ tiếng Trung (${request.sourceLanguage}) sang tiếng Việt. Giữ nguyên số liệu, tên riêng, mã sản phẩm, ngày tháng, đơn vị đo — không tự thay đổi. Nếu có thuật ngữ không chắc chắn cách dịch, giữ nguyên từ gốc trong ngoặc đơn. Chỉ trả về văn bản đã dịch, không thêm giải thích.`;

    const contextPart = request.contextBefore
      ? `Ngữ cảnh câu ngay trước (chỉ để tham khảo, không dịch lại): "${request.contextBefore}"\n`
      : "";
    const glossaryPart =
      request.glossary && request.glossary.length > 0
        ? `Thuật ngữ/tên riêng đã biết trong cuộc họp này, cần giữ nguyên: ${request.glossary.join(", ")}\n`
        : "";

    const prompt = `${instruction}\n${contextPart}${glossaryPart}\nVăn bản cần xử lý:\n"""${request.text}"""`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const translatedText = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (!translatedText) {
      throw new Error("Gemini không trả về nội dung dịch hợp lệ");
    }

    return {
      translatedText,
      // Heuristic đơn giản (mục 8): coi là "còn thuật ngữ không chắc chắn" nếu bản dịch có giữ nguyên
      // văn gốc trong dấu ngoặc đơn — không phải phân tích ngữ nghĩa thật sự.
      containsUncertainTerms: translatedText.includes("("),
    };
  }

  /**
   * Rà soát/chuẩn hoá 1 đoạn dịch đã có sẵn bằng prompt có version `translation-review.v1.md` (mục 19).
   * Không thuộc interface TranslationProvider dùng chung — đây là khả năng bổ sung riêng của cài đặt
   * Google, dành cho bước "dịch lại đảm bảo nhất quán thuật ngữ" ở finalize (kiến trúc mục 2.2) khi
   * cần dùng tới sau này.
   */
  async reviewTranslation(input: ReviewTranslationInput): Promise<ReviewTranslationOutput> {
    const systemInstruction = await loadPrompt("translation-review.v1.md");
    const model = this.vertexAI.getGenerativeModel({
      model: this.env.GOOGLE_GEMINI_MODEL,
      systemInstruction,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
      generationConfig: { responseMimeType: "application/json" },
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return JSON.parse(text) as ReviewTranslationOutput;
  }
}
