import { z } from "zod";

/**
 * Toàn bộ biến môi trường bắt buộc/tuỳ chọn của backend.
 * Tên model Google (Speech/Gemini) luôn đọc từ đây — không hard-code trong code (mục 14.3, 27).
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  API_BASE_URL: z.string().url().default("http://localhost:8080"),

  DATABASE_URL: z.string().min(1, "Thiếu DATABASE_URL"),

  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1, "Thiếu GOOGLE_OAUTH_CLIENT_ID"),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1, "Thiếu GOOGLE_OAUTH_CLIENT_SECRET"),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url(),

  SESSION_JWT_SECRET: z.string().min(32, "SESSION_JWT_SECRET cần tối thiểu 32 ký tự"),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, "TOKEN_ENCRYPTION_KEY cần tối thiểu 32 ký tự (dùng để mã hoá refresh token)"),

  AI_PROVIDER: z.enum(["google", "mock"]).default("mock"),
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_SPEECH_MODEL: z.string().default("chirp_2"),
  GOOGLE_SPEECH_LOCATION: z.string().default("asia-southeast1"),
  GOOGLE_GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GOOGLE_GEMINI_LOCATION: z.string().default("asia-southeast1"),

  STORAGE_PROVIDER: z.enum(["local", "gcs"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default(".data/storage"),
  GCS_TEMP_BUCKET: z.string().optional(),
  TEMP_STORAGE_TTL_DAYS: z.coerce.number().int().positive().default(7),

  MAX_ATTACHMENT_MB: z.coerce.number().positive().default(20),
  MAX_MEETING_HOURS: z.coerce.number().positive().default(4),

  REALTIME_SUMMARY_INTERVAL_SEC: z.coerce.number().int().positive().default(180),
  CHUNK_TARGET_SECONDS: z.coerce.number().int().positive().default(20),
  CHUNK_OVERLAP_SECONDS: z.coerce.number().positive().default(2),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cachedEnv: AppEnv | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Cấu hình biến môi trường không hợp lệ:\n${details}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}
