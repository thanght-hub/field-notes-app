import type { TranslatedText, TranslationProvider, TranslationRequest } from "@field-notes/shared";

/** Giả lập TranslationProvider cho dev/test (AI_PROVIDER=mock). */
export class MockTranslationProvider implements TranslationProvider {
  async translateToVietnamese(request: TranslationRequest): Promise<TranslatedText> {
    return {
      translatedText:
        request.sourceLanguage === "vi-VN" ? request.text : `[dịch giả lập] ${request.text}`,
      containsUncertainTerms: false,
    };
  }
}
