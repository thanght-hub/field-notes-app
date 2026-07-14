import type { SourceLanguage } from "../types/language.js";

export interface TranslationRequest {
  text: string;
  sourceLanguage: SourceLanguage;
  /** Các đoạn liền kề để giữ ngữ cảnh cuộc họp công việc (mục 8). */
  contextBefore?: string;
  /** Thuật ngữ/tên riêng đã biết trong cuộc họp này, cần giữ nguyên. */
  glossary?: string[];
}

export interface TranslatedText {
  translatedText: string;
  /** true nếu có phần giữ nguyên từ gốc trong ngoặc do không chắc nghĩa. */
  containsUncertainTerms: boolean;
}

/**
 * Interface dịch sang tiếng Việt (mục 8, mục 14.4).
 * Cài đặt cụ thể (Google Cloud Translation / Gemini) nằm ở apps/api/src/providers/google.
 */
export interface TranslationProvider {
  translateToVietnamese(request: TranslationRequest): Promise<TranslatedText>;
}
