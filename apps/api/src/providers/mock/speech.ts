import type { AudioChunkInput, RawTranscription, SpeechRecognitionProvider } from "@field-notes/shared";

/**
 * Giả lập SpeechRecognitionProvider cho dev/test khi không có khoá GCP thật (AI_PROVIDER=mock).
 * Không gọi mạng, trả kết quả cố định để pipeline chạy được end-to-end.
 */
export class MockSpeechRecognitionProvider implements SpeechRecognitionProvider {
  async transcribeChunk(input: AudioChunkInput): Promise<RawTranscription> {
    return {
      text: "[Bản ghi giả lập] nội dung mẫu cho mục đích phát triển",
      language: input.languageHint ?? "vi-VN",
      confidence: 0.9,
      words: [],
    };
  }
}
