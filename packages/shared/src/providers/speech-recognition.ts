import type { SourceLanguage } from "../types/language.js";

export interface AudioChunkInput {
  /** Bytes của chunk âm thanh, định dạng theo `mimeType`. */
  data: Uint8Array;
  mimeType: string;
  /** Gợi ý ngôn ngữ nếu đã biết từ LanguageDetectionProvider; nếu không có thì thử toàn bộ ngôn ngữ hỗ trợ. */
  languageHint?: SourceLanguage;
  /** Ngữ cảnh trước đó (câu cuối của đoạn liền trước) để cải thiện độ chính xác ở điểm cắt. */
  precedingContext?: string;
}

export interface RecognizedWord {
  text: string;
  startOffsetMs: number;
  endOffsetMs: number;
  confidence: number;
}

export interface RawTranscription {
  text: string;
  language: SourceLanguage;
  confidence: number;
  words: RecognizedWord[];
}

/**
 * Cô lập nhà cung cấp nhận dạng giọng nói (mục 14.4).
 * Domain logic chỉ phụ thuộc vào interface này, không phụ thuộc Google Cloud Speech-to-Text trực tiếp.
 */
export interface SpeechRecognitionProvider {
  transcribeChunk(input: AudioChunkInput): Promise<RawTranscription>;
}
