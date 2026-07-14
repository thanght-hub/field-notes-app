import { ERROR_CODES, ERROR_MESSAGES_VI, type ErrorCode } from "@field-notes/shared";
import { ApiError } from "./api/client";

export { ERROR_CODES, ERROR_MESSAGES_VI };
export type { ErrorCode };

export interface DisplayError {
  code?: string;
  messageVi: string;
}

/** Chuẩn hoá bất kỳ lỗi bắt được (thường từ `catch`) thành `{code?, messageVi}` để hiển thị. */
export function toDisplayError(err: unknown, fallbackVi: string = ERROR_MESSAGES_VI.INTERNAL_ERROR): DisplayError {
  if (err instanceof ApiError) return { code: err.code, messageVi: err.messageVi };
  return { messageVi: fallbackVi };
}

/**
 * Diễn giải các lỗi bắt được PHÍA CLIENT (trước khi kịp có response từ server) thành
 * `{code, messageVi}` để tái sử dụng `<ErrorBanner>` chung (mục 21).
 */
export function describeGetUserMediaError(error: unknown): { code: ErrorCode; messageVi: string } {
  const name = error instanceof DOMException ? error.name : undefined;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return { code: ERROR_CODES.MIC_PERMISSION_DENIED, messageVi: ERROR_MESSAGES_VI.MIC_PERMISSION_DENIED };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return { code: ERROR_CODES.MIC_ALREADY_IN_USE, messageVi: ERROR_MESSAGES_VI.MIC_ALREADY_IN_USE };
  }
  return { code: ERROR_CODES.INTERNAL_ERROR, messageVi: ERROR_MESSAGES_VI.INTERNAL_ERROR };
}
