import { v2 } from "@google-cloud/speech";
import { SUPPORTED_SOURCE_LANGUAGES } from "@field-notes/shared";
import type { DetectedLanguage, LanguageDetectionProvider, SourceLanguage } from "@field-notes/shared";
import type { AppEnv } from "../../config/env.js";

/**
 * Cài đặt LanguageDetectionProvider v1 "pragmatic" (mục 7.1, 14.4): tái sử dụng Cloud Speech-to-Text v2
 * với `languageCodes` = toàn bộ 3 biến thể hỗ trợ để nó tự chọn ngôn ngữ khớp nhất, thay vì gọi một
 * dịch vụ language-id riêng (giảm số lượng lời gọi AI, mục 27).
 */
export class GoogleLanguageDetectionProvider implements LanguageDetectionProvider {
  private readonly client: v2.SpeechClient;

  constructor(private readonly env: AppEnv) {
    this.client = new v2.SpeechClient({ projectId: env.GOOGLE_CLOUD_PROJECT_ID });
  }

  async detectLanguage(audio: { data: Uint8Array; mimeType: string }): Promise<DetectedLanguage> {
    const projectId = this.env.GOOGLE_CLOUD_PROJECT_ID;
    if (!projectId) {
      throw new Error("Thiếu GOOGLE_CLOUD_PROJECT_ID để gọi Cloud Speech-to-Text");
    }
    const recognizer = `projects/${projectId}/locations/${this.env.GOOGLE_SPEECH_LOCATION}/recognizers/_`;

    const [response] = await this.client.recognize({
      recognizer,
      config: {
        autoDecodingConfig: {},
        languageCodes: [...SUPPORTED_SOURCE_LANGUAGES],
        model: this.env.GOOGLE_SPEECH_MODEL,
      },
      content: Buffer.from(audio.data),
    });

    const result = response.results?.[0];
    const alternative = result?.alternatives?.[0];
    const language = (result?.languageCode as SourceLanguage | undefined) ?? "vi-VN";
    const confidence = alternative?.confidence ?? 0;

    // GIẢ ĐỊNH ĐÃ BIẾT / HẠN CHẾ v1 (cần cải thiện sau): recognize() với nhiều languageCodes chỉ trả về
    // NGÔN NGỮ TỐT NHẤT được chọn cho mỗi result — API không trả kèm danh sách ứng viên ngôn ngữ khác
    // cùng điểm số, nên `alternatives` luôn để mảng rỗng ở cài đặt này. Muốn có candidate thật cần
    // gọi 1 dịch vụ language-id riêng (vd Cloud Translation v3 detectLanguage) — ngoài phạm vi v1.
    return {
      language,
      confidence,
      alternatives: [],
    };
  }
}
