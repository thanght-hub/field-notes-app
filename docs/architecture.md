# Kiến trúc hệ thống — Field Notes (Trợ lý ghi âm, dịch và tóm tắt cuộc họp Việt – Trung)

> Tài liệu này ghi lại các quyết định kỹ thuật cho phiên bản 1, theo yêu cầu ở mục 26.1 của đặc tả.
> Lưu ý về độ chắc chắn: các lựa chọn công nghệ nền tảng (Next.js, Fastify, Prisma/PostgreSQL...) đã được kiểm chứng qua tài liệu chính thức.
> Tuy nhiên tên phiên bản model cụ thể của Google (Chirp, Gemini...) thay đổi thường xuyên — tài liệu này **không hard-code** tên model, mà để trong biến môi trường và yêu cầu người vận hành xác nhận lại tại thời điểm triển khai (xem `docs/google-cloud-setup.md`).

## 1. Stack được chọn

### 1.1. Monorepo

- **pnpm workspaces**, không dùng Turborepo ở v1 để giảm độ phức tạp cấu hình.
- Cấu trúc:
  ```text
  apps/web      -> Frontend PWA (Next.js App Router + TypeScript)
  apps/api      -> Backend API (Fastify + TypeScript)
  packages/shared -> Domain types, Zod schema, provider interfaces, hằng số dùng chung
  prompts/      -> Prompt AI có version (mục 19)
  docs/         -> Tài liệu kiến trúc, bảo mật, vận hành
  scripts/      -> Script tạo dữ liệu mẫu, seed
  ```

Lý do: một codebase duy nhất giúp chia sẻ type giữa frontend/backend (đặc biệt là schema JSON cho AI), dễ chạy lint/type-check/test đồng bộ, phù hợp quy mô đội nhỏ.

### 1.2. Frontend — `apps/web`

- **Next.js (App Router) + TypeScript**, mobile-first, responsive, hỗ trợ Dark Mode qua `prefers-color-scheme` + toggle thủ công lưu trong `localStorage`.
- **PWA thủ công** (không dùng plugin `next-pwa` vì tương thích kém với App Router hiện tại): tự viết `public/manifest.webmanifest` + `public/sw.js` + đăng ký service worker trong root layout. Cache "app shell" (HTML/CSS/JS tĩnh) bằng chiến lược stale-while-revalidate; **không cache API động** (transcript, audio).
- **IndexedDB** qua thư viện `idb` để lưu: audio chunk (Blob), transcript tạm thời, hàng đợi đồng bộ (upload queue), trạng thái phiên ghi âm đang dang dở (để khôi phục sau khi tab bị đóng/reload).
- **MediaRecorder API** để ghi âm theo chunk thời gian thực (ưu tiên `audio/webm;codecs=opus`; kiểm tra `MediaRecorder.isTypeSupported` và fallback `audio/mp4` cho Safari/iPhone).
- **Wake Lock API** (`navigator.wakeLock`) để chống khóa màn hình; khi trình duyệt không hỗ trợ (đa số Safari cũ), hiển thị hướng dẫn người dùng tự tắt khóa màn hình.
- Giao tiếp thời gian thực với backend qua **Server-Sent Events (SSE)** (xem lý do ở 1.3).

### 1.3. Backend — `apps/api`

- **Fastify + TypeScript**: hiệu năng tốt, hệ sinh thái plugin (CORS, cookie, multipart, rate-limit) trưởng thành, TypeScript-first.
- **Realtime**: chọn **SSE thay vì WebSocket** cho việc đẩy transcript/tóm tắt tới client. Lý do: luồng dữ liệu chủ yếu một chiều (server → client), SSE tự động reconnect qua HTTP, không cần hạ tầng riêng, đơn giản hoá vận hành trên Cloud Run (Cloud Run hỗ trợ streaming response). Các hành động điều khiển (tạm dừng, đánh dấu, kết thúc) dùng REST POST thông thường.
- **Hàng đợi xử lý nền**: interface `JobQueue` trừu tượng. Triển khai mặc định (dev/v1 tự host) là **hàng đợi polling trong PostgreSQL** (bảng `ProcessingJob` + worker loop) để không bắt buộc phải có GCP khi phát triển local. Khi triển khai production trên Google Cloud, có thể thay bằng Cloud Tasks/Pub/Sub mà không đổi domain logic (chỉ đổi implementation của `JobQueue`).
- **Database**: **PostgreSQL + Prisma ORM**. Chọn Postgres thay vì Firestore vì: quan hệ dữ liệu Workspace → Project → Group → Meeting → TranscriptSegment rõ ràng, cần transaction và truy vấn lọc phức tạp (tìm kiếm, lọc theo công ty/dự án/ngày ở mục 12), Prisma cho migration tường minh và type-safety.
- **Lưu trữ audio/attachment tạm thời**: interface `StorageProvider`. Triển khai dev dùng đĩa cục bộ (thư mục tạm, tự dọn theo TTL); triển khai production dùng Google Cloud Storage với lifecycle rule tự xoá (mục 14.3, mục 20). Backend **không giữ audio vĩnh viễn** — sau khi đã lưu vào Google Drive của người dùng, bản sao tạm trên Storage sẽ hết hạn theo lifecycle.

### 1.4. Lớp tích hợp AI — cô lập nhà cung cấp (mục 4, 14.4)

`packages/shared/src/providers` định nghĩa các interface thuần domain, không phụ thuộc Google:

```ts
interface SpeechRecognitionProvider { transcribeChunk(...): Promise<RawTranscription>; }
interface LanguageDetectionProvider { detectLanguage(...): Promise<DetectedLanguage>; }
interface TranslationProvider { translateToVietnamese(...): Promise<TranslatedText>; }
interface MeetingSummaryProvider { summarizeRealtime(...); extractTopics(...); extractDecisions(...); extractActionItems(...); }
interface StorageProvider { putObject(...); getSignedUrl(...); deleteObject(...); }
```

`apps/api/src/providers/google/*` implement các interface trên bằng Google Cloud Speech-to-Text, Vertex AI (Gemini) và Cloud Storage/Drive. `apps/api/src/providers/mock/*` implement bản giả lập dùng cho test và phát triển không cần khoá API thật. Domain logic (pipeline, routes) chỉ phụ thuộc vào interface — thay nhà cung cấp chỉ cần đổi binding ở nơi khởi tạo (`apps/api/src/providers/index.ts`), không sửa route hay UI.

### 1.5. Google Cloud (production)

| Nhu cầu | Dịch vụ đề xuất | Ghi chú |
|---|---|---|
| Nhận dạng giọng nói | Cloud Speech-to-Text (API v2, model đa ngôn ngữ dòng Chirp) | Chọn model qua env `GOOGLE_SPEECH_MODEL`, không hard-code |
| Dịch / tóm tắt / trích xuất | Vertex AI — Gemini (dòng model hiện hành) | Chọn model qua env `GOOGLE_GEMINI_MODEL`; dùng structured output/response schema |
| Lưu trữ tạm audio | Cloud Storage, lifecycle rule xoá sau N ngày | N cấu hình qua env, mặc định 7 ngày |
| Lưu trữ lâu dài | Google Drive API (`drive.file` scope) | Không xin quyền đọc toàn bộ Drive |
| Xác thực | Google OAuth 2.0 (Authorization Code + PKCE) | Chỉ 1 loại người dùng |
| Backend hosting | Cloud Run | Stateless, scale-to-zero phù hợp chi phí |
| Hàng đợi | Cloud Tasks hoặc Pub/Sub (production) / Postgres polling (dev) | Qua interface `JobQueue` |
| Metadata | Cloud SQL (PostgreSQL) hoặc Postgres tự host | |

Danh sách API cần bật cụ thể: xem `docs/google-cloud-setup.md`.

## 2. Sơ đồ luồng dữ liệu

### 2.1. Trong lúc họp (chế độ thời gian thực — mục 6.1)

```
Micro (MediaRecorder)
  -> chunk audio 15-30s (chồng lấn ngắn)
  -> lưu Blob vào IndexedDB (trạng thái "local")
  -> Sync Queue (chạy song song, không chặn ghi âm)
       -> nếu có mạng: upload chunk lên API (trạng thái "uploading" -> "uploaded")
       -> nếu mất mạng: giữ nguyên "local", hiển thị "Đang ghi ngoại tuyến", tự thử lại khi có mạng
  -> API nhận chunk -> lưu tạm (StorageProvider) -> đẩy job vào JobQueue (trạng thái "queued" -> "transcribed"/"failed")
  -> Worker: LanguageDetectionProvider -> SpeechRecognitionProvider (chọn model theo ngôn ngữ phát hiện)
       -> nếu confidence thấp: thử lại bằng model ngôn ngữ khác, so sánh điểm
  -> TranslationProvider dịch đoạn tiếng Trung sang tiếng Việt
  -> Lưu TranscriptSegment (trạng thái "tạm thời") vào DB
  -> Đẩy qua SSE tới client: transcript đoạn gần nhất + cập nhật hàng đợi tóm tắt
  -> Mỗi 2-5 phút hoặc đủ nội dung mới: MeetingSummaryProvider.summarizeRealtime() dùng các segment mới
       -> đẩy bản tóm tắt "nháp" qua SSE
```

### 2.2. Kết thúc cuộc họp (chế độ xử lý sau — mục 6.2, 5.4)

```
Người dùng bấm "Kết thúc" (có xác nhận)
  -> Dừng ghi, flush toàn bộ chunk còn lại trong IndexedDB vào Sync Queue
  -> Khi mọi chunk đã "uploaded": tạo ProcessingJob loại "finalize"
  -> Worker finalize:
       1. Xử lý lại các đoạn confidence thấp bằng ngữ cảnh toàn cuộc họp
       2. Hợp nhất & chuẩn hoá nhãn người nói (diarization toàn cục)
       3. Dịch lại đảm bảo nhất quán thuật ngữ
       4. Sinh Topic[] (topic-extraction.v1)
       5. Sinh Decision[] (decision-extraction.v1) — ưu tiên các đoạn đã "Đánh dấu quan trọng"
       6. Sinh ActionItem[] (action-item-extraction.v1)
       7. Sinh tóm tắt điều hành (final-summary.v1)
       8. Ghi transcript "đã hoàn tất" (không ghi đè transcript tạm — lưu song song)
       9. Xuất meeting.json, transcript.md, minutes.md (+ optional HTML)
       10. Upload lên Google Drive theo cấu trúc thư mục mục 13.2
       11. Tạo ShareLink mặc định "Chỉ mình tôi"
       12. Meeting.status = "completed"
```

### 2.3. Nguyên tắc không mất dữ liệu khi mất mạng / reload

- Nguồn sự thật của "audio đã ghi" luôn là IndexedDB cho tới khi chunk được xác nhận "uploaded" (có checksum khớp) ở server.
- Khi reload trang, `apps/web` đọc lại phiên ghi âm dang dở từ IndexedDB (danh sách chunk + trạng thái), khôi phục UI "đang họp" và tiếp tục hàng đợi đồng bộ.
- Transcript hiển thị thời gian thực luôn gắn nhãn "tạm thời"; chỉ transcript sinh ra ở bước finalize mới là "đã hoàn tất". UI không bao giờ trình bày transcript tạm thời như kết quả cuối.

## 3. Mô hình dữ liệu

Xem chi tiết trong `packages/shared/src/types` và `apps/api/prisma/schema.prisma`. Các thực thể chính: `User, Workspace, Project, Group, Meeting, AudioChunk, TranscriptSegment, Topic, Decision, ActionItem, ManualNote, Attachment, ShareLink, ProcessingJob` — đúng theo mục 18.

## 4. Rủi ro kỹ thuật chính

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Ba biến thể tiếng Trung/Việt lẫn trong một stream, dịch vụ nhận dạng không tự phân biệt tốt | Sai ngôn ngữ → transcript sai | Phát hiện ngôn ngữ theo đoạn trước, chạy lại bằng model khác khi confidence thấp, giữ transcript gốc để đối chiếu (mục 7.1) |
| Cuộc họp 4 giờ, không giữ audio trong RAM | Crash trình duyệt trên điện thoại yếu | Chunk hoá bắt buộc + giải phóng Blob sau khi ghi vào IndexedDB và upload xong (mục 15) |
| Mất mạng giữa cuộc họp dài | Mất dữ liệu hoặc trùng lặp upload | Checksum theo chunk, idempotent upload theo `chunkId`, trạng thái rõ ràng theo từng chunk (mục 15, 16) |
| AI trả JSON sai schema khi tóm tắt/trích xuất | Pipeline finalize crash hoặc bịa dữ liệu | Ép structured output/response schema, validate bằng Zod, retry có giới hạn, nếu vẫn sai thì đánh dấu job "failed" và giữ transcript thô cho người dùng tự xử lý — không bịa nội dung (mục 19, 21) |
| Chi phí gọi AI cao do cuộc họp dài | Vượt ngân sách vận hành | Batch theo chunk 15-30s (không gọi theo câu), tóm tắt mỗi 2-5 phút, cache kết quả segment đã transcribe, chỉ xử lý lại các đoạn confidence thấp ở bước finalize (mục 27) |
| Phạm vi OAuth Drive quá rộng | Rủi ro bảo mật, người dùng ngần ngại cấp quyền | Dùng `drive.file`, chỉ thao tác file do app tạo (mục 13.1) |
| iOS Safari giới hạn MediaRecorder/Wake Lock | Ghi âm gián đoạn, màn hình tự khoá | Kiểm tra khả năng hỗ trợ runtime, fallback codec, hiển thị cảnh báo/hướng dẫn thủ công (mục 15, 21) |
| Model Google (Chirp/Gemini) đổi tên/ngừng hỗ trợ | Pipeline lỗi đột ngột sau khi Google cập nhật | Tên model luôn qua biến môi trường, không hard-code (mục 14.3, 27); tài liệu vận hành yêu cầu kiểm tra định kỳ |
| Nhiều người nói giọng gần nhau (3-5 người) | Diarization gán nhầm người nói | Không cam kết chính xác tuyệt đối — cho phép người dùng sửa nhãn sau cuộc họp, hợp nhất nhãn ở bước finalize (mục 7.2) |

## 5. Ngoài phạm vi v1

Xem mục 24 của đặc tả — không triển khai nhận diện giọng nói thật, học giọng, đồng chỉnh sửa thời gian thực, tích hợp lịch/nhắc việc, app native, nhận dạng offline hoàn toàn.
