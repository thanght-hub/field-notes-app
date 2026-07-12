# Triển khai lên Google Cloud Run (Cloud Shell)

Hướng dẫn này dùng để đưa Field Notes lên một địa chỉ HTTPS công khai, để có thể cài lên điện thoại như PWA.

## Vì sao chạy trên Cloud Shell?

Môi trường Claude Code (nơi mã nguồn được viết) không có quyền truy cập tài khoản Google Cloud của Sếp và bị chính sách mạng chặn tải `gcloud` CLI. Cloud Shell (`console.cloud.google.com` → icon Cloud Shell góc trên phải) đã cài sẵn `gcloud`, `git`, `docker`, và **đã đăng nhập sẵn bằng tài khoản Google của Sếp** — không cần dán mật khẩu hay khoá bí mật ở đâu cả.

## Các bước

1. Mở [Cloud Shell](https://console.cloud.google.com/) (icon `>_` góc trên phải màn hình).
2. Mở file `scripts/deploy-cloud-run.sh` trong repo này để xem toàn bộ script (đã copy sẵn hướng dẫn từng bước dưới dạng comment).
3. Copy-paste **từng PHASE** trong script vào Cloud Shell theo đúng thứ tự — KHÔNG chạy nguyên file cùng lúc vì có 2 chỗ cần thao tác thủ công:
   - **PHASE 1**: bật billing cho project (bắt buộc thao tác trên giao diện, không có lệnh `gcloud` để tự động bật billing).
   - **PHASE 10**: tạo OAuth Client (Web application) trên giao diện Console — đăng nhập Google **luôn** dùng OAuth thật, kể cả khi Sếp chọn `AI_PROVIDER=mock` cho phần Speech-to-Text/dịch/tóm tắt.
4. Sau PHASE 11, script in ra địa chỉ web (`WEB_URL`) — mở địa chỉ đó trên điện thoại và làm theo hướng dẫn "Thêm vào Màn hình chính" ở `README.md`.

## Chi phí ước tính

- Cloud Run: tính theo lượt gọi + thời gian chạy, có gói miễn phí hàng tháng — chi phí gần như 0 nếu chỉ Sếp dùng thử.
- Cloud SQL (PostgreSQL): đây là chi phí **cố định theo giờ** dù không dùng (máy chủ luôn bật), thường vài trăm nghìn đến hơn 1 triệu đồng/tháng tuỳ tier — nếu chỉ thử nghiệm, cân nhắc **xoá Cloud SQL instance sau khi thử xong** (`gcloud sql instances delete field-notes-db`) để không phát sinh phí ngoài ý muốn.

## Sau khi thử xong với `AI_PROVIDER=mock`

Muốn dùng nhận dạng giọng nói/dịch/tóm tắt thật:

1. Làm theo [`docs/google-cloud-setup.md`](google-cloud-setup.md) để bật Speech-to-Text/Vertex AI và tạo service account.
2. Cập nhật biến môi trường trên Cloud Run:
   ```bash
   gcloud run services update field-notes-api --region="$REGION" \
     --update-env-vars="AI_PROVIDER=google,GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID,GOOGLE_SPEECH_MODEL=chirp_2,GOOGLE_GEMINI_MODEL=gemini-2.5-flash"
   ```
   (kiểm tra lại tên model hiện hành trước khi đặt — xem lưu ý ở `docs/google-cloud-setup.md` mục 7).
3. Gán quyền IAM cho Cloud Run service account để gọi Speech-to-Text/Vertex AI:
   ```bash
   export SERVICE_ACCOUNT="$(gcloud run services describe field-notes-api --region="$REGION" --format='value(spec.template.spec.serviceAccountName)')"
   gcloud projects add-iam-policy-binding "$PROJECT_ID" \
     --member="serviceAccount:${SERVICE_ACCOUNT}" --role="roles/speech.client" 2>/dev/null || true
   gcloud projects add-iam-policy-binding "$PROJECT_ID" \
     --member="serviceAccount:${SERVICE_ACCOUNT}" --role="roles/aiplatform.user"
   ```

## Dọn dẹp (tránh phát sinh phí)

```bash
gcloud run services delete field-notes-api --region="$REGION"
gcloud run services delete field-notes-web --region="$REGION"
gcloud sql instances delete field-notes-db
# Hoặc đơn giản nhất: xoá toàn bộ project
gcloud projects delete "$PROJECT_ID"
```
