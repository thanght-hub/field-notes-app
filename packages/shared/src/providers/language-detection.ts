import type { SourceLanguage } from "../types/language.js";

export interface DetectedLanguage {
  language: SourceLanguage;
  confidence: number;
  /** Ứng viên xếp hạng kế tiếp — dùng để chạy lại bằng model khác khi confidence thấp (mục 7.1). */
  alternatives: Array<{ language: SourceLanguage; confidence: number }>;
}

export interface LanguageDetectionProvider {
  detectLanguage(audio: { data: Uint8Array; mimeType: string }): Promise<DetectedLanguage>;
}
