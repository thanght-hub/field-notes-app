/** Mã lỗi + thông báo tiếng Việt tương ứng (mục 21) — dùng chung frontend/backend. */
export const ERROR_CODES = {
  MIC_PERMISSION_DENIED: "MIC_PERMISSION_DENIED",
  MIC_ALREADY_IN_USE: "MIC_ALREADY_IN_USE",
  CODEC_NOT_SUPPORTED: "CODEC_NOT_SUPPORTED",
  NETWORK_OFFLINE: "NETWORK_OFFLINE",
  OAUTH_EXPIRED: "OAUTH_EXPIRED",
  DRIVE_QUOTA_EXCEEDED: "DRIVE_QUOTA_EXCEEDED",
  SPEECH_API_ERROR: "SPEECH_API_ERROR",
  CHUNK_UPLOAD_FAILED: "CHUNK_UPLOAD_FAILED",
  AI_INVALID_JSON: "AI_INVALID_JSON",
  TAB_CLOSED_WHILE_RECORDING: "TAB_CLOSED_WHILE_RECORDING",
  DEVICE_STORAGE_LOW: "DEVICE_STORAGE_LOW",
  MEETING_TOO_LONG: "MEETING_TOO_LONG",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES_VI: Record<ErrorCode, string> = {
  MIC_PERMISSION_DENIED:
    "Trình duyệt chưa được cấp quyền micro. Vui lòng bật quyền micro trong cài đặt trình duyệt rồi thử lại.",
  MIC_ALREADY_IN_USE:
    "Micro đang được ứng dụng khác sử dụng. Vui lòng đóng ứng dụng đó rồi thử ghi âm lại.",
  CODEC_NOT_SUPPORTED:
    "Trình duyệt này chưa hỗ trợ định dạng ghi âm cần thiết. Vui lòng thử bằng Chrome hoặc Safari phiên bản mới nhất.",
  NETWORK_OFFLINE:
    "Mất kết nối mạng. Ứng dụng vẫn đang ghi âm ngoại tuyến, dữ liệu sẽ tự động đồng bộ khi có mạng trở lại.",
  OAUTH_EXPIRED: "Phiên đăng nhập Google đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.",
  DRIVE_QUOTA_EXCEEDED:
    "Google Drive của bạn đã hết dung lượng. Vui lòng giải phóng dung lượng rồi thử lưu lại.",
  SPEECH_API_ERROR:
    "Dịch vụ nhận dạng giọng nói gặp sự cố tạm thời. Hệ thống sẽ tự thử lại, bạn có thể tiếp tục ghi âm.",
  CHUNK_UPLOAD_FAILED:
    "Một đoạn ghi âm tải lên thất bại. Hệ thống sẽ tự động thử lại, dữ liệu vẫn được giữ trên thiết bị.",
  AI_INVALID_JSON:
    "Bước tóm tắt bằng AI trả về dữ liệu không hợp lệ. Hệ thống đã giữ lại transcript gốc để bạn xử lý thủ công.",
  TAB_CLOSED_WHILE_RECORDING:
    "Phát hiện phiên ghi âm bị đóng đột ngột lần trước. Ứng dụng đã khôi phục dữ liệu đã ghi được.",
  DEVICE_STORAGE_LOW:
    "Bộ nhớ thiết bị sắp hết. Vui lòng giải phóng dung lượng để tránh mất dữ liệu ghi âm.",
  MEETING_TOO_LONG:
    "Cuộc họp đã vượt quá thời lượng tối đa 4 giờ. Vui lòng kết thúc cuộc họp và tạo cuộc họp mới nếu cần tiếp tục.",
  UNAUTHORIZED: "Bạn cần đăng nhập để thực hiện thao tác này.",
  FORBIDDEN: "Bạn không có quyền truy cập dữ liệu này.",
  NOT_FOUND: "Không tìm thấy dữ liệu được yêu cầu.",
  VALIDATION_ERROR: "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại.",
  INTERNAL_ERROR: "Đã có lỗi hệ thống xảy ra. Vui lòng thử lại sau.",
};
