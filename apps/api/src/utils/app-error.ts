import { ERROR_MESSAGES_VI, type ErrorCode } from "@field-notes/shared";

/** Lỗi nghiệp vụ có mã lỗi + thông báo tiếng Việt sẵn (mục 21). */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly detail?: unknown;

  constructor(code: ErrorCode, statusCode: number, detail?: unknown) {
    super(ERROR_MESSAGES_VI[code]);
    this.code = code;
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export function notFound(detail?: unknown): AppError {
  return new AppError("NOT_FOUND", 404, detail);
}

export function forbidden(detail?: unknown): AppError {
  return new AppError("FORBIDDEN", 403, detail);
}

export function unauthorized(detail?: unknown): AppError {
  return new AppError("UNAUTHORIZED", 401, detail);
}

export function validationError(detail?: unknown): AppError {
  return new AppError("VALIDATION_ERROR", 400, detail);
}
