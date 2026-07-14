import type {
  DriveStorageProvider,
  LanguageDetectionProvider,
  MeetingSummaryProvider,
  SpeechRecognitionProvider,
  TranslationProvider,
} from "@field-notes/shared";
import type { AppEnv } from "../config/env.js";
import { GoogleDriveProvider } from "./google/drive.js";
import { GoogleLanguageDetectionProvider } from "./google/language-detection.js";
import { GoogleMeetingSummaryProvider } from "./google/meeting-summary.js";
import { GoogleSpeechRecognitionProvider } from "./google/speech.js";
import { GoogleTranslationProvider } from "./google/translation.js";
import { MockLanguageDetectionProvider } from "./mock/language-detection.js";
import { MockMeetingSummaryProvider } from "./mock/meeting-summary.js";
import { MockSpeechRecognitionProvider } from "./mock/speech.js";
import { MockTranslationProvider } from "./mock/translation.js";

export interface Providers {
  speech: SpeechRecognitionProvider;
  languageDetection: LanguageDetectionProvider;
  translation: TranslationProvider;
  summary: MeetingSummaryProvider;
}

/** Cache singleton theo AI_PROVIDER — tạo client Google/mock đúng 1 lần (kiến trúc 1.4). */
let cached: { kind: AppEnv["AI_PROVIDER"]; providers: Providers } | undefined;

/**
 * Chọn cài đặt Google hay Mock dựa trên `env.AI_PROVIDER`. Domain logic (pipeline, routes) chỉ phụ
 * thuộc vào interface trong @field-notes/shared, không phụ thuộc trực tiếp Google Cloud (kiến trúc 1.4).
 */
export function getProviders(env: AppEnv): Providers {
  if (cached && cached.kind === env.AI_PROVIDER) {
    return cached.providers;
  }

  const providers: Providers =
    env.AI_PROVIDER === "google"
      ? {
          speech: new GoogleSpeechRecognitionProvider(env),
          languageDetection: new GoogleLanguageDetectionProvider(env),
          translation: new GoogleTranslationProvider(env),
          summary: new GoogleMeetingSummaryProvider(env),
        }
      : {
          speech: new MockSpeechRecognitionProvider(),
          languageDetection: new MockLanguageDetectionProvider(),
          translation: new MockTranslationProvider(),
          summary: new MockMeetingSummaryProvider(),
        };

  cached = { kind: env.AI_PROVIDER, providers };
  return providers;
}

/**
 * Drive luôn dùng cài đặt Google thật (không có bản mock) vì cần accessToken thật của người dùng để
 * thao tác Drive — kể cả khi AI_PROVIDER=mock, nơi gọi (routes) tự quyết định có gọi hàm này hay không
 * lúc test/dev.
 */
export function createDriveProvider(accessToken: string): DriveStorageProvider {
  return new GoogleDriveProvider(accessToken);
}
