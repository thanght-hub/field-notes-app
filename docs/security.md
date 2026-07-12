# Bảo mật và quyền riêng tư

> Đối chiếu mục 20 của đặc tả gốc. Tài liệu này mô tả các biện pháp đã triển khai trong mã nguồn và các biện pháp còn cần cấu hình thủ công khi vận hành thật.

## 1. Nguyên tắc chung

- Chỉ một loại người dùng, đăng nhập bằng Google OAuth. Mỗi người dùng chỉ truy cập được dữ liệu của chính mình — mọi API đều kiểm tra `userId` sở hữu tài nguyên trước khi đọc/ghi (xem `apps/api/src/services/meeting-access.ts`).
- Dữ liệu cuộc họp được coi là dữ liệu nội bộ/riêng tư. Không có tính năng chia sẻ mặc định công khai.
- Người dùng phải xác nhận đồng ý (`POST /api/meetings/:id/consent`) trước khi được phép bắt đầu ghi âm — thể hiện việc "đã thông báo rõ trước khi gửi âm thanh lên dịch vụ đám mây" (mục 4, mục 5.1).

## 2. Xác thực và token

- OAuth 2.0 Authorization Code, phạm vi tối thiểu: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive.file` (KHÔNG xin quyền đọc toàn bộ Drive).
- Access token không bao giờ được lưu; chỉ `refresh_token` được lưu, và luôn ở dạng **mã hoá AES-256-GCM** (`apps/api/src/auth/token-crypto.ts`) trước khi ghi vào cột `User.encryptedRefreshToken`. Khoá mã hoá (`TOKEN_ENCRYPTION_KEY`) phải được đặt trong secret manager ở production (Google Secret Manager / biến môi trường Cloud Run được gắn từ Secret Manager), không commit vào git.
- Phiên đăng nhập của app dùng JWT ký HS256, lưu trong cookie `httpOnly`, `sameSite=lax`, `secure` khi production — không thể đọc bằng JavaScript phía client (chống XSS đánh cắp phiên).

## 3. Vận chuyển và mã hoá

- Bắt buộc HTTPS ở mọi môi trường production (Cloud Run mặc định có TLS; nếu tự host cần cấu hình reverse proxy TLS).
- Không triển khai mã hoá đầu-cuối riêng ngoài HTTPS + mã hoá mặc định của Google Cloud/Google Drive (theo giả định mục 4.4 của đặc tả — đây là giới hạn đã biết của phiên bản 1, không phải sơ suất).

## 4. Ghi log

- `apps/api/src/middleware/error-handler.ts` và toàn bộ pipeline **không bao giờ ghi log nội dung transcript, văn bản dịch, hay token** — chỉ ghi `meetingId`, mã lỗi, thông điệp lỗi ngắn.
- Logger (`pino`) được cấu hình `redact` cho header `authorization` và `cookie`.
- Không log payload request thô cho các route có thể chứa nội dung nhạy cảm (transcript, ghi chú thủ công).

## 5. Lưu trữ tạm và vòng đời dữ liệu

- Audio/attachment được lưu tạm ở backend qua `StorageProvider` (đĩa cục bộ khi dev, Google Cloud Storage khi production).
- Ở production, bucket GCS tạm cần được cấu hình **lifecycle rule tự xoá object sau `TEMP_STORAGE_TTL_DAYS` ngày** (mặc định 7 ngày) — đây là cấu hình ở cấp hạ tầng (Terraform/`gsutil lifecycle set`), không thể set qua code runtime. Xem `docs/google-cloud-setup.md`.
- Ứng dụng **không tự động xoá file ghi âm** đã lưu trên Google Drive của người dùng (theo giả định mục 4.5) — người dùng tự quản lý trên Drive của họ.
- Có nút xoá cuộc họp (`DELETE /api/meetings/:id`) xoá toàn bộ dữ liệu liên quan trong hệ thống của ứng dụng (không xoá file đã nằm trên Drive của người dùng, vì đó là tài sản của người dùng trên Drive cá nhân).

## 6. Chia sẻ

- `ShareLink` mặc định luôn là `private` ("Chỉ mình tôi") khi được tạo — không bao giờ tự động công khai (mục 13.4). Người dùng phải chủ động chọn "Bất kỳ ai có liên kết" và bấm lưu.

## 7. Chống tấn công phổ biến (OWASP)

- **CSRF**: cookie phiên `sameSite=lax`; luồng OAuth dùng tham số `state` ngẫu nhiên đối chiếu cookie tạm để chống CSRF trong callback.
- **XSS**: cookie phiên `httpOnly` (JS không đọc được); frontend React tự động escape nội dung hiển thị, không dùng `dangerouslySetInnerHTML` cho nội dung do người dùng/AI sinh ra.
- **Injection**: dùng Prisma (câu lệnh tham số hoá), không nối chuỗi SQL thủ công.
- **Upload file nguy hiểm**: whitelist MIME type cho tài liệu đính kèm (ảnh phổ biến, PDF, Word, Excel), giới hạn dung lượng (`MAX_ATTACHMENT_MB`) — xem `apps/api/src/routes/notes.ts`.
- **Rate limiting**: `@fastify/rate-limit` áp dụng toàn cục để giảm rủi ro brute-force/spam API.

## 8. Thông báo và sự đồng ý khi ghi âm

- Màn hình bắt đầu cuộc họp yêu cầu người dùng xác nhận: (a) đã thông báo cho người tham gia rằng cuộc họp được ghi âm, (b) đồng ý việc âm thanh được gửi tới dịch vụ AI đám mây để xử lý (mục 5.1, mục 20 "Yêu cầu người dùng xác nhận đã được sự đồng ý của người tham gia trước khi ghi").
- Trong lúc ghi, giao diện luôn hiển thị rõ trạng thái "đang ghi âm" (mục 20 "Có thông báo đang ghi âm rõ ràng").

## 9. Việc còn cần làm khi triển khai thật (không thể hoàn tất chỉ bằng mã nguồn)

- Bật 2FA cho tài khoản Google Cloud quản trị dự án.
- Cấu hình Secret Manager cho `TOKEN_ENCRYPTION_KEY`, `SESSION_JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET` — không đặt trực tiếp trong biến môi trường Cloud Run dạng plain nếu tổ chức có yêu cầu cao hơn.
- Thiết lập lifecycle rule GCS như trên.
- Rà soát định kỳ danh sách scope OAuth đã cấp trong Google Cloud Console để đảm bảo không phình to theo thời gian.
