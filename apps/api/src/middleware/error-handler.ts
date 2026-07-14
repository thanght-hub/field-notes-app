import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type { ApiErrorBody } from "@field-notes/shared";
import { ERROR_MESSAGES_VI } from "@field-notes/shared";
import { AppError } from "../utils/app-error.js";

/**
 * Bộ xử lý lỗi tập trung: không bao giờ log transcript/token nhạy cảm (mục 20),
 * luôn trả thông báo tiếng Việt dễ hiểu (mục 21).
 */
export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    request.log.warn({ code: error.code, path: request.url }, "app_error");
    const body: ApiErrorBody = { code: error.code, messageVi: error.message, detail: error.detail };
    reply.status(error.statusCode).send(body);
    return;
  }

  request.log.error({ err: { message: error.message, name: error.name }, path: request.url }, "unhandled_error");
  const body: ApiErrorBody = { code: "INTERNAL_ERROR", messageVi: ERROR_MESSAGES_VI.INTERNAL_ERROR };
  reply.status(500).send(body);
}
