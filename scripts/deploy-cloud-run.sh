#!/usr/bin/env bash
# Script triển khai Field Notes (apps/api + apps/web) lên Google Cloud Run.
#
# CÁCH DÙNG: mở https://console.cloud.google.com/ , bấm icon "Cloud Shell" (góc trên phải),
# rồi chạy từng PHASE dưới đây theo thứ tự (copy-paste từng khối, không chạy nguyên file 1 lần
# vì có vài bước cần thao tác thủ công trên giao diện Console ở giữa).
#
# Độ chắc chắn: các lệnh `gcloud` dưới đây đúng theo cấu trúc API hiện hành tại thời điểm viết,
# nhưng tên gói dịch vụ/tier cụ thể (vd tier Cloud SQL) có thể đã đổi — nếu lệnh nào báo lỗi
# "not found"/"invalid", chạy `gcloud sql tiers list` (hoặc lệnh --help tương ứng) để xem giá trị
# hiện hành rồi thay vào.
set -euo pipefail

########################################
# PHASE 0 — Biến cấu hình (Sếp tự điền)
########################################
export PROJECT_ID="field-notes-$(date +%s)"   # đổi thành tên Sếp muốn, phải là duy nhất toàn cầu
export REGION="asia-southeast1"               # Singapore — đổi nếu muốn region khác
export REPO_URL="https://github.com/thanght-hub/field-notes-app.git"
export BRANCH="main"                          # đổi thành nhánh Sếp muốn deploy

########################################
# PHASE 1 — Tạo project + bật billing (billing PHẢI làm thủ công)
########################################
gcloud projects create "$PROJECT_ID" --name="Field Notes"
gcloud config set project "$PROJECT_ID"

echo "=================================================================="
echo "DỪNG LẠI: mở https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
echo "và liên kết một tài khoản thanh toán (billing account) cho project này."
echo "Chạy lệnh sau để tự kiểm tra đã liên kết chưa:"
echo "  gcloud billing projects describe $PROJECT_ID"
echo "Khi thấy billingEnabled: true thì tiếp tục PHASE 2."
echo "=================================================================="
read -p "Đã bật billing xong chưa? Nhấn Enter để tiếp tục..." _

########################################
# PHASE 2 — Bật các API cần thiết
########################################
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com

########################################
# PHASE 3 — Lấy mã nguồn
########################################
git clone --branch "$BRANCH" "$REPO_URL" field-notes-app
cd field-notes-app

########################################
# PHASE 4 — Artifact Registry (nơi lưu Docker image)
########################################
gcloud artifacts repositories create field-notes \
  --repository-format=docker \
  --location="$REGION" \
  --description="Field Notes container images"

export AR_HOST="$REGION-docker.pkg.dev"
export IMAGE_API="$AR_HOST/$PROJECT_ID/field-notes/api"
export IMAGE_WEB="$AR_HOST/$PROJECT_ID/field-notes/web"

########################################
# PHASE 5 — Cloud SQL (PostgreSQL)
########################################
export DB_INSTANCE="field-notes-db"
export DB_PASSWORD="$(openssl rand -base64 24)"
echo "Mật khẩu DB (lưu lại, không hiện lại): $DB_PASSWORD"

gcloud sql instances create "$DB_INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier=db-g1-small \
  --region="$REGION" \
  --root-password="$DB_PASSWORD"

gcloud sql databases create field_notes --instance="$DB_INSTANCE"

export INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "$DB_INSTANCE" --format='value(connectionName)')"
export DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@/field_notes?host=/cloudsql/${INSTANCE_CONNECTION_NAME}"

########################################
# PHASE 6 — Secret cho JWT/mã hoá token (tự sinh ngẫu nhiên)
########################################
export SESSION_JWT_SECRET="$(openssl rand -base64 48)"
export TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)"

########################################
# PHASE 7 — Build + deploy apps/api LẦN 1 (để lấy URL thật của API)
########################################
gcloud builds submit --tag "$IMAGE_API" --config=- <<'EOF'
steps:
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-f', 'apps/api/Dockerfile', '-t', '$_IMAGE', '.']
images: ['$_IMAGE']
EOF

gcloud run deploy field-notes-api \
  --image="$IMAGE_API" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --add-cloudsql-instances="$INSTANCE_CONNECTION_NAME" \
  --set-env-vars="NODE_ENV=production,PORT=8080,AI_PROVIDER=mock,STORAGE_PROVIDER=local,LOCAL_STORAGE_DIR=/tmp/storage,LOG_LEVEL=info" \
  --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
  --set-env-vars="SESSION_JWT_SECRET=${SESSION_JWT_SECRET},TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}" \
  --set-env-vars="APP_BASE_URL=https://placeholder.example,GOOGLE_OAUTH_CLIENT_ID=placeholder,GOOGLE_OAUTH_CLIENT_SECRET=placeholder,GOOGLE_OAUTH_REDIRECT_URI=https://placeholder.example/auth/google/callback"

export API_URL="$(gcloud run services describe field-notes-api --region="$REGION" --format='value(status.url)')"
echo "API_URL=$API_URL"

########################################
# PHASE 8 — Chạy migration Prisma lên Cloud SQL (qua Cloud SQL Auth Proxy tạm thời)
########################################
# Cloud Shell đã có sẵn cloud-sql-proxy. Nếu chưa có, cài theo:
# curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.0/cloud-sql-proxy.linux.amd64 && chmod +x cloud-sql-proxy
./cloud-sql-proxy "$INSTANCE_CONNECTION_NAME" --port 5433 &
PROXY_PID=$!
sleep 5
DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@localhost:5433/field_notes?schema=public" \
  npx --yes pnpm@10 --filter @field-notes/api exec prisma migrate deploy \
  --schema=apps/api/prisma/schema.prisma
kill "$PROXY_PID"

########################################
# PHASE 9 — Build + deploy apps/web (build cần biết API_URL để bake vào bundle)
########################################
gcloud builds submit --config=- <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-f', 'apps/web/Dockerfile', '--build-arg', 'NEXT_PUBLIC_API_BASE_URL=${API_URL}', '-t', '${IMAGE_WEB}', '.']
images: ['${IMAGE_WEB}']
EOF

gcloud run deploy field-notes-web \
  --image="$IMAGE_WEB" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_API_BASE_URL=${API_URL}"

export WEB_URL="$(gcloud run services describe field-notes-web --region="$REGION" --format='value(status.url)')"
echo "WEB_URL=$WEB_URL"

########################################
# PHASE 10 — Tạo OAuth Client (BẮT BUỘC làm thủ công trên Console)
########################################
echo "=================================================================="
echo "DỪNG LẠI: đăng nhập LUÔN cần OAuth Google thật (kể cả khi AI_PROVIDER=mock)."
echo "1) Mở https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo "   -> Tạo OAuth consent screen (External), điền tên app tuỳ ý."
echo "   -> Thêm scope: openid, .../auth/userinfo.email, .../auth/userinfo.profile,"
echo "      https://www.googleapis.com/auth/drive.file"
echo "2) Mở https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo "   -> Create Credentials > OAuth client ID > Web application"
echo "   -> Authorized JavaScript origins: $WEB_URL"
echo "   -> Authorized redirect URIs:      $API_URL/auth/google/callback"
echo "   -> Lưu lại Client ID và Client secret."
echo "=================================================================="
read -p "Dán Client ID vừa tạo rồi Enter: " GOOGLE_OAUTH_CLIENT_ID
read -p "Dán Client secret vừa tạo rồi Enter: " GOOGLE_OAUTH_CLIENT_SECRET

########################################
# PHASE 11 — Cập nhật lại API với URL thật + OAuth Client thật, deploy lại
########################################
gcloud run services update field-notes-api \
  --region="$REGION" \
  --update-env-vars="APP_BASE_URL=${WEB_URL},GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID},GOOGLE_OAUTH_CLIENT_SECRET=${GOOGLE_OAUTH_CLIENT_SECRET},GOOGLE_OAUTH_REDIRECT_URI=${API_URL}/auth/google/callback"

echo "=================================================================="
echo "HOÀN TẤT. Mở địa chỉ sau trên điện thoại rồi 'Thêm vào Màn hình chính':"
echo "$WEB_URL"
echo "=================================================================="
