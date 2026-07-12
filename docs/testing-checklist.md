# Checklist kiểm thử thủ công (Android, iPhone, Desktop)

> Đối chiếu mục 25.18 và mục 22 của đặc tả. Thực hiện checklist này trước khi coi một bản dựng là sẵn sàng cho người dùng thật.

## Chuẩn bị

- [ ] Đặt `AI_PROVIDER=mock` để kiểm thử luồng UI/offline mà không tốn chi phí Google Cloud, sau đó lặp lại các bước quan trọng với `AI_PROVIDER=google` và tài khoản GCP thật trước khi phát hành.
- [ ] Có ít nhất 2 tài khoản Google test khác nhau để kiểm tra cách ly dữ liệu giữa 2 người dùng.

## 1. Đăng nhập và quản lý dữ liệu (mục 23.1, 23.2)

- [ ] Đăng nhập bằng Google thành công trên Chrome Android, Safari iPhone, Chrome/Edge/Safari desktop.
- [ ] Tạo được công ty (workspace), dự án, nhóm, cuộc họp.
- [ ] Đăng nhập tài khoản B, xác nhận KHÔNG thấy dữ liệu của tài khoản A (mục 22 "Test quyền truy cập dữ liệu giữa hai tài khoản").

## 2. Ghi âm (mục 23.3, 23.4)

- [ ] Ghi âm ổn định liên tục tối thiểu 30 phút trên Android.
- [ ] Ghi âm ổn định liên tục tối thiểu 30 phút trên iPhone (Safari) — chú ý giới hạn nền của iOS khi khoá màn hình.
- [ ] Ghi âm ổn định trên desktop (Chrome, Edge, Safari nếu có máy Mac).
- [ ] Giả lập cuộc họp dài (có thể dùng file audio lặp hoặc để chạy thật) tối thiểu 1-2 giờ, xác nhận bộ nhớ trình duyệt không tăng vô hạn (không giữ toàn bộ audio trong RAM).
- [ ] Từ chối quyền micro → thấy thông báo lỗi tiếng Việt đúng (`MIC_PERMISSION_DENIED`).
- [ ] Mở app trong lúc micro đang được app khác dùng → thấy thông báo `MIC_ALREADY_IN_USE`.
- [ ] Wake Lock giữ màn hình sáng khi ghi (hoặc hiển thị hướng dẫn thủ công nếu trình duyệt không hỗ trợ).

## 3. Mất mạng và đồng bộ (mục 23.5, 22)

- [ ] Tắt mạng giữa cuộc họp → UI hiển thị "Đang ghi ngoại tuyến", ghi âm vẫn tiếp tục.
- [ ] Bật lại mạng → các chunk tự động tải lên, transcript được tạo lại theo đúng thứ tự thời gian.
- [ ] Đóng tab đột ngột khi đang ghi (không nhấn "Kết thúc") → mở lại app, xác nhận khôi phục được phiên ghi âm dang dở.
- [ ] Kiểm tra không có chunk nào bị tải trùng (theo dõi log/DB `AudioChunk` không có (meetingId, sequence) trùng lặp với 2 nội dung khác nhau).

## 4. Nhận dạng đa ngôn ngữ và người nói (mục 23.6-23.8, 22)

- [ ] Test đoạn hội thoại xen kẽ vi-VN, zh-CN, zh-TW trong cùng một cuộc họp.
- [ ] Test với 3, 4 và 5 người nói khác nhau.
- [ ] Xác nhận nhãn "Người nói 1/2/3..." được gán tương đối hợp lý và có thể sửa lại sau cuộc họp.

## 5. Tóm tắt và biên bản (mục 23.9-23.13)

- [ ] Tóm tắt ý chính cập nhật trong lúc họp (không chờ đến hết mới có).
- [ ] Đánh dấu quan trọng, thêm ghi chú, thêm ảnh/tài liệu hoạt động đúng và xuất hiện trong biên bản cuối.
- [ ] Sau khi kết thúc, có transcript đã hiệu chỉnh, chủ đề, quyết định (kèm nguồn transcript), công việc (kèm nguồn transcript).
- [ ] Sửa được transcript, nhãn người nói, quyết định, công việc — sau khi chạy lại AI (nếu có), các chỉnh sửa thủ công KHÔNG bị mất.
- [ ] Test trường hợp AI trả JSON sai schema (có thể giả lập bằng cách tạm sửa mock provider trả dữ liệu lỗi) → pipeline không crash toàn bộ, phần lỗi được bỏ qua có kiểm soát.

## 6. Google Drive và chia sẻ (mục 23.14-23.15)

- [ ] Kết quả được lưu lên đúng cấu trúc thư mục trong Google Drive của người dùng.
- [ ] Link chia sẻ mặc định "Chỉ mình tôi"; chuyển sang "Bất kỳ ai có liên kết" hoạt động đúng.
- [ ] Thử với Google Drive gần đầy dung lượng → thấy thông báo `DRIVE_QUOTA_EXCEEDED` tiếng Việt.

## 7. Giao diện (mục 23.16)

- [ ] Giao diện tiếng Việt hoàn toàn, không sót chuỗi tiếng Anh.
- [ ] Responsive tốt trên màn hình nhỏ (iPhone SE) và lớn (desktop).
- [ ] Dark Mode hoạt động đúng, không có chỗ tương phản kém.
- [ ] Cài được ứng dụng lên màn hình chính (PWA "Add to Home Screen") trên Android và iPhone.

## 8. Tự động hoá

- [ ] `pnpm test` chạy qua toàn bộ unit/integration test không lỗi.
- [ ] E2E test (Playwright) chạy qua luồng bắt đầu–ghi–tạm dừng–kết thúc–xem biên bản không lỗi.
