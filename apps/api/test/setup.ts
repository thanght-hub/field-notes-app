/**
 * Thiết lập biến môi trường cho test tích hợp TRƯỚC khi bất kỳ module nào gọi loadEnv() (module đó
 * cache kết quả sau lần gọi đầu). Cần một PostgreSQL thật đã chạy migration — xem docs/testing-checklist.md
 * hoặc README mục "Kiểm thử backend": `createdb field_notes_test && DATABASE_URL=... prisma migrate deploy`.
 */
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/field_notes_test?schema=public";
process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.API_BASE_URL ??= "http://localhost:8080";
process.env.GOOGLE_OAUTH_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI ??= "http://localhost:8080/auth/google/callback";
process.env.SESSION_JWT_SECRET ??= "test-session-secret-at-least-32-chars-long";
process.env.TOKEN_ENCRYPTION_KEY ??= "test-token-encryption-key-32chars!!";
process.env.AI_PROVIDER ??= "mock";
process.env.STORAGE_PROVIDER ??= "local";
process.env.LOCAL_STORAGE_DIR ??= ".data/storage-test";
process.env.LOG_LEVEL ??= "fatal";
