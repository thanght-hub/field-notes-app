# Hướng dẫn cấu hình Google Cloud

> Lưu ý về độ chắc chắn: giao diện Google Cloud Console và tên gọi API có thể thay đổi theo thời gian.
> Các bước dưới đây đúng về nguyên tắc/thứ tự thao tác, nhưng Sếp nên đối chiếu lại với tài liệu chính thức
> tại thời điểm triển khai (đường dẫn `docs.cloud.google.com`) vì em không thể xác nhận giao diện hiện tại 100%.

## 1. Tạo dự án Google Cloud

1. Vào Google Cloud Console, tạo một dự án mới (hoặc dùng dự án có sẵn).
2. Ghi lại **Project ID** — dùng cho biến môi trường `GOOGLE_CLOUD_PROJECT_ID`.
3. Bật thanh toán (billing) cho dự án — các API bên dưới là dịch vụ trả phí.

## 2. Danh sách API cần bật (mục 25.15 đặc tả)

Vào **APIs & Services > Library**, bật các API sau:

| API | Dùng để làm gì |
|---|---|
| Cloud Speech-to-Text API | Nhận dạng giọng nói (mục 7) |
| Vertex AI API | Dịch, tóm tắt, trích xuất quyết định/công việc bằng Gemini (mục 8, 9, 10) |
| Google Drive API | Lưu kết quả cuộc họp vào Drive của người dùng (mục 13) |
| Cloud Storage API | Lưu tạm audio/attachment trước khi xử lý (mục 14.3) |
| Cloud Run API | Chạy backend (nếu triển khai trên Cloud Run) |
| Cloud SQL Admin API | Nếu dùng Cloud SQL cho PostgreSQL thay vì Postgres tự host |

## 3. Tạo OAuth Client (đăng nhập người dùng + Google Drive)

1. **APIs & Services > OAuth consent screen**: chọn loại "External" (hoặc "Internal" nếu chỉ dùng nội bộ Google Workspace của công ty). Điền tên ứng dụng bằng tiếng Việt, ví dụ "Field Notes — Trợ lý cuộc họp".
2. Ở phần **Scopes**, chỉ thêm:
   - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/drive.file` (KHÔNG thêm `drive` hay `drive.readonly` phạm vi rộng — mục 13.1 yêu cầu phạm vi tối thiểu)
3. **APIs & Services > Credentials > Create Credentials > OAuth client ID**, loại "Web application".
4. Authorized redirect URI: `https://<domain-backend-thật>/auth/google/callback` (và `http://localhost:8080/auth/google/callback` cho phát triển local).
5. Lưu **Client ID** và **Client secret** vào `.env` (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`) — KHÔNG commit vào git, dùng Secret Manager khi triển khai thật.
6. Nếu app ở trạng thái "Testing" trên OAuth consent screen, chỉ các email được thêm vào danh sách "Test users" mới đăng nhập được — cần chuyển sang "In production" (có thể yêu cầu Google xác minh) trước khi dùng rộng rãi.

## 4. Service account (chỉ dùng cho Speech-to-Text / Vertex AI, KHÔNG dùng cho Google Drive)

Google Drive trong ứng dụng này luôn thao tác bằng **token của chính người dùng** (OAuth ở trên), không dùng service account — vì mỗi người dùng lưu file vào Drive cá nhân của họ (mục 13.1).

Service account chỉ cần cho các lệnh gọi Speech-to-Text/Vertex AI (các dịch vụ AI xử lý phía backend, không thuộc về một Drive cá nhân nào):

1. **IAM & Admin > Service Accounts > Create Service Account**, ví dụ tên `field-notes-ai-backend`.
2. Gán vai trò tối thiểu cần thiết: `Cloud Speech Client` (hoặc vai trò tương đương hiện hành cho Speech-to-Text), `Vertex AI User`.
3. Tạo khoá JSON, tải về, đặt đường dẫn vào `GOOGLE_APPLICATION_CREDENTIALS` (chỉ cần khi KHÔNG chạy trên môi trường đã có Application Default Credentials sẵn, ví dụ chạy ngoài Cloud Run/GCE — trên Cloud Run nên gán service account trực tiếp cho revision thay vì dùng file JSON).
4. **Không commit file khoá JSON vào git.**

## 5. Cloud Storage (lưu tạm)

1. Tạo 1 bucket, ví dụ `field-notes-temp-audio`, region gần người dùng nhất (vd `asia-southeast1`).
2. Thiết lập lifecycle rule tự xoá object sau N ngày (mặc định N=7, khớp `TEMP_STORAGE_TTL_DAYS`):
   ```bash
   gsutil lifecycle set lifecycle.json gs://field-notes-temp-audio
   ```
   Với `lifecycle.json`:
   ```json
   { "rule": [ { "action": {"type": "Delete"}, "condition": {"age": 7} } ] }
   ```
3. Đặt tên bucket vào `GCS_TEMP_BUCKET`.

## 6. Cloud SQL / PostgreSQL

- Có thể dùng Cloud SQL for PostgreSQL hoặc PostgreSQL tự host (Docker Compose khi phát triển — xem `docker-compose.yml`).
- Đặt connection string vào `DATABASE_URL`.

## 7. Kiểm tra tên model hiện hành trước khi triển khai (mục 27 — không hard-code model cũ)

Trước khi deploy production, kiểm tra lại:
- Model Speech-to-Text còn hỗ trợ (dòng Chirp hoặc kế nhiệm) tại tài liệu Cloud Speech-to-Text — cập nhật `GOOGLE_SPEECH_MODEL`.
- Model Gemini còn được hỗ trợ (không nằm trong danh sách deprecated) tại tài liệu Vertex AI Model Garden — cập nhật `GOOGLE_GEMINI_MODEL`.

## 8. Chạy thử nhanh mà chưa cần Google Cloud

Đặt `AI_PROVIDER=mock` trong `.env` — backend sẽ dùng bộ giả lập (`apps/api/src/providers/mock`) để chạy toàn bộ luồng ghi âm → transcript → tóm tắt mà không cần bất kỳ khoá Google nào. Phù hợp để phát triển/kiểm thử UI trước khi có project GCP thật.
