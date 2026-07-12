# Field Notes — Trợ lý ghi âm, dịch và tóm tắt cuộc họp Việt – Trung

Ứng dụng web (PWA) hỗ trợ ghi âm cuộc họp có người nói tiếng Việt và tiếng Trung (phổ thông/Đài Loan), tự động nhận dạng giọng nói, dịch sang tiếng Việt, tóm tắt ý chính theo thời gian thực và tạo biên bản cuộc họp (chủ đề, quyết định, công việc) sau khi kết thúc, lưu kết quả lên Google Drive của người dùng.

> Đây là phiên bản 1 theo đặc tả gốc. Xem chi tiết quyết định kỹ thuật tại [`docs/architecture.md`](docs/architecture.md).

## Tài liệu liên quan

| Tài liệu | Nội dung |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Kiến trúc hệ thống, sơ đồ luồng dữ liệu, rủi ro kỹ thuật |
| [`docs/security.md`](docs/security.md) | Bảo mật và quyền riêng tư |
| [`docs/google-cloud-setup.md`](docs/google-cloud-setup.md) | Cách bật API, tạo OAuth Client, service account trên Google Cloud |
| [`docs/testing-checklist.md`](docs/testing-checklist.md) | Checklist kiểm thử thủ công Android/iPhone/Desktop |

## Cấu trúc thư mục

```text
apps/web       Frontend PWA (Next.js App Router + TypeScript)
apps/api       Backend API (Fastify + TypeScript + Prisma/PostgreSQL)
packages/shared Domain types, Zod schema, interface nhà cung cấp AI dùng chung
prompts/       Prompt AI có version (mục 19 đặc tả)
docs/          Tài liệu kiến trúc, bảo mật, vận hành
scripts/       Script tạo dữ liệu mẫu
```

## Yêu cầu hệ thống

- Node.js >= 20 (khuyến nghị 22)
- pnpm >= 9 (`corepack enable` để tự có đúng phiên bản theo `packageManager` trong `package.json`)
- PostgreSQL 16 (hoặc dùng `docker-compose.yml` có sẵn)
- (Tuỳ chọn) Tài khoản Google Cloud có bật thanh toán — nếu chưa có, dùng `AI_PROVIDER=mock` để phát triển/kiểm thử trước

## Cài đặt và chạy local

```bash
cp .env.example .env
# Điền GOOGLE_OAUTH_CLIENT_ID/SECRET, SESSION_JWT_SECRET, TOKEN_ENCRYPTION_KEY (xem hướng dẫn tạo trong .env.example)

pnpm install

# Chạy PostgreSQL bằng Docker (hoặc dùng Postgres đã có sẵn, sửa DATABASE_URL tương ứng)
docker compose up -d postgres

pnpm --filter @field-notes/api prisma:generate
pnpm --filter @field-notes/api prisma:migrate

# (Tuỳ chọn) Tạo dữ liệu mẫu để demo giao diện
pnpm --filter @field-notes/api seed

# Chạy song song 2 terminal:
pnpm dev:api   # http://localhost:8080
pnpm dev:web   # http://localhost:3000
```

Mặc định `.env.example` đặt `AI_PROVIDER=mock` — toàn bộ luồng ghi âm/transcript/tóm tắt chạy được bằng dữ liệu giả lập, không cần khoá Google Cloud thật. Khi sẵn sàng dùng dịch vụ thật, làm theo [`docs/google-cloud-setup.md`](docs/google-cloud-setup.md) rồi đổi `AI_PROVIDER=google`.

## Lint, type-check, test

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Triển khai

- `docker-compose.yml` ở thư mục gốc dựng đủ 3 dịch vụ (`postgres`, `api`, `web`) cho môi trường tự host/staging.
- `apps/api/Dockerfile` và `apps/web/Dockerfile` build riêng từng service (build context là thư mục gốc repo).
- Production khuyến nghị: Cloud Run cho `api` và `web`, Cloud SQL cho PostgreSQL, Cloud Storage cho lưu tạm audio, Google Drive API cho lưu trữ lâu dài — xem chi tiết `docs/architecture.md` mục 1.5 và `docs/google-cloud-setup.md`.

## Giới hạn đã biết của phiên bản 1

Xem mục 24 của đặc tả gốc (đã tóm tắt trong `docs/architecture.md` mục 5): chưa có nhận diện tên thật bằng giọng nói, học giọng, đồng chỉnh sửa thời gian thực, tích hợp lịch/nhắc việc, ứng dụng native, hay nhận dạng offline hoàn toàn.

Một giới hạn quan trọng của bản giao trong phiên này: phần tích hợp Google Cloud (Speech-to-Text, Vertex AI Gemini, Drive) được viết đúng theo tài liệu API hiện hành nhưng **chưa được test end-to-end với một project Google Cloud thật** (môi trường phát triển không có sẵn credentials). Trước khi dùng thật, cần tự cấu hình theo `docs/google-cloud-setup.md`, đặt `AI_PROVIDER=google` và kiểm thử lại theo `docs/testing-checklist.md`.
