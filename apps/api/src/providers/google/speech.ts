import { v2 } from "@google-cloud/speech";
import { SUPPORTED_SOURCE_LANGUAGES } from "@field-notes/shared";
import type {
  AudioChunkInput,
  RawTranscription,
  RecognizedWord,
  SourceLanguage,
  SpeechRecognitionProvider,
} from "@field-notes/shared";
import type { AppEnv } from "../../config/env.js";

/**
 * GHI CHÚ GIẢ ĐỊNH VỀ MAPPING mimeType -> encoding:
 * Cloud Speech-to-Text v2 dùng `autoDecodingConfig` để tự nhận diện định dạng container
 * (webm/opus, ogg/opus, mp4/aac, flac, mp3...) trực tiếp từ header của file audio — API v2
 * KHÔNG có tham số riêng để khai báo "encoding" khi dùng auto-decoding (khác v1 RecognitionConfig.encoding).
 * Hàm dưới đây vì vậy chỉ dùng để LOG/CHẨN ĐOÁN lỗi khi Speech API từ chối 1 định dạng, không truyền
 * vào request. Giả định: audio đầu vào của app (MediaRecorder `audio/webm;codecs=opus` hoặc
 * `audio/mp4` cho Safari/iOS) luôn là container có header hợp lệ để auto-decoding nhận diện được.
 * Nếu sau này cần hỗ trợ PCM thô (không header), phải chuyển sang `explicitDecodingConfig`.
 */
function describeMimeTypeForLog(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm/opus (auto-decoding)";
  if (mimeType.includes("ogg")) return "ogg/opus (auto-decoding)";
  if (mimeType.includes("mp4") || mimeType.includes("m4a") || mimeType.includes("aac")) {
    return "mp4/aac (auto-decoding)";
  }
  return `không xác định (${mimeType}) - vẫn thử auto-decoding`;
}

function toMillis(duration: { seconds?: number | string | null; nanos?: number | null } | null | undefined): number {
  if (!duration) return 0;
  const seconds = Number(duration.seconds ?? 0);
  const nanos = Number(duration.nanos ?? 0);
  return Math.round(seconds * 1000 + nanos / 1_000_000);
}

/**
 * Cài đặt SpeechRecognitionProvider bằng Cloud Speech-to-Text API v2 (mục 14.4, 1.5).
 * Gọi `recognize` theo lô (không streaming) vì backend nhận audio theo chunk 15-30s đã ghi xong,
 * không cần độ trễ thấp của streaming API (mục 27 — tối ưu chi phí, tránh gọi theo câu).
 */
export class GoogleSpeechRecognitionProvider implements SpeechRecognitionProvider {
  private readonly client: v2.SpeechClient;

  constructor(private readonly env: AppEnv) {
    this.client = new v2.SpeechClient({ projectId: env.GOOGLE_CLOUD_PROJECT_ID });
  }

  async transcribeChunk(input: AudioChunkInput): Promise<RawTranscription> {
    const projectId = this.env.GOOGLE_CLOUD_PROJECT_ID;
    if (!projectId) {
      throw new Error("Thiếu GOOGLE_CLOUD_PROJECT_ID để gọi Cloud Speech-to-Text");
    }
    const recognizer = `projects/${projectId}/locations/${this.env.GOOGLE_SPEECH_LOCATION}/recognizers/_`;
    const languageCodes = input.languageHint ? [input.languageHint] : [...SUPPORTED_SOURCE_LANGUAGES];

    const [response] = await this.client.recognize({
      recognizer,
      config: {
        autoDecodingConfig: {},
        languageCodes,
        // Tên model đọc từ env, KHÔNG hard-code (mục 27) — cho phép đổi model Chirp mà không sửa code.
        model: this.env.GOOGLE_SPEECH_MODEL,
        features: {
          enableWordTimeOffsets: true,
          enableAutomaticPunctuation: true,
        },
      },
      content: Buffer.from(input.data),
    });

    const result = response.results?.[0];
    const alternative = result?.alternatives?.[0];

    if (!alternative) {
      // Không log nội dung transcript (mục 20) — chỉ log mã lỗi/định dạng để chẩn đoán.
      console.error("google_speech_empty_result", { hint: describeMimeTypeForLog(input.mimeType) });
      return {
        text: "",
        language: input.languageHint ?? "vi-VN",
        confidence: 0,
        words: [],
      };
    }

    // SDK v2 không luôn trả `languageCode` cấp result khi dùng auto-detect đa ngôn ngữ;
    // fallback về languageHint (đã biết) rồi 'vi-VN' — giả định hợp lý cho v1, ghi rõ ở đây.
    const detectedLanguage = (result?.languageCode as SourceLanguage | undefined) ?? input.languageHint ?? "vi-VN";

    const words: RecognizedWord[] = (alternative.words ?? []).map((w) => ({
      text: w.word ?? "",
      startOffsetMs: toMillis(w.startOffset ?? undefined),
      endOffsetMs: toMillis(w.endOffset ?? undefined),
      confidence: w.confidence ?? alternative.confidence ?? 0,
    }));

    return {
      text: alternative.transcript ?? "",
      language: detectedLanguage,
      confidence: alternative.confidence ?? 0,
      words,
    };
  }
}
