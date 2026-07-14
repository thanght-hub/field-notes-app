import type { DetectedLanguage, LanguageDetectionProvider } from "@field-notes/shared";

/** Giả lập LanguageDetectionProvider cho dev/test (AI_PROVIDER=mock). */
export class MockLanguageDetectionProvider implements LanguageDetectionProvider {
  async detectLanguage(): Promise<DetectedLanguage> {
    return {
      language: "vi-VN",
      confidence: 0.95,
      alternatives: [{ language: "zh-CN", confidence: 0.3 }],
    };
  }
}
