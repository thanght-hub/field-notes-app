/** Ba biến thể ngôn ngữ nguồn được hỗ trợ trong phiên bản 1 (mục 7.1). */
export const SUPPORTED_SOURCE_LANGUAGES = ["vi-VN", "zh-CN", "zh-TW"] as const;
export type SourceLanguage = (typeof SUPPORTED_SOURCE_LANGUAGES)[number];

/** Ngôn ngữ đích duy nhất của bản dịch — luôn là tiếng Việt (mục 8). */
export const TARGET_LANGUAGE = "vi-VN" as const;
export type TargetLanguage = typeof TARGET_LANGUAGE;

export function isSourceLanguage(value: string): value is SourceLanguage {
  return (SUPPORTED_SOURCE_LANGUAGES as readonly string[]).includes(value);
}

export const LANGUAGE_LABEL_VI: Record<SourceLanguage, string> = {
  "vi-VN": "Tiếng Việt",
  "zh-CN": "Tiếng Trung phổ thông",
  "zh-TW": "Tiếng Trung (Đài Loan)",
};
