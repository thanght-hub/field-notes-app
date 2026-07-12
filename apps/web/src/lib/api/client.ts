import { ERROR_MESSAGES_VI, type ApiErrorBody } from "@field-notes/shared";

/**
 * Base URL của backend API (apps/api). Luôn đọc qua biến môi trường public của Next.js.
 * Nếu không cấu hình, mặc định rỗng (request tương đối cùng-origin) — phù hợp khi triển khai
 * chung domain qua reverse proxy.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** Lỗi API chuẩn hoá — luôn có `messageVi` sẵn sàng hiển thị trực tiếp cho người dùng (mục 21). */
export class ApiError extends Error {
  readonly code: string;
  readonly messageVi: string;
  readonly status: number;
  readonly detail?: unknown;

  constructor(body: ApiErrorBody, status: number) {
    super(body.messageVi);
    this.name = "ApiError";
    this.code = body.code;
    this.messageVi = body.messageVi;
    this.status = status;
    this.detail = body.detail;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | Record<string, unknown> | undefined;
}

/**
 * Wrapper fetch dùng chung cho mọi lời gọi tới apps/api.
 * - Luôn gửi `credentials: 'include'` vì phiên đăng nhập dùng cookie httpOnly.
 * - Tự JSON.stringify khi body là object thường; giữ nguyên khi là FormData/Blob/...
 * - Ném `ApiError` với `messageVi` lấy từ response khi request thất bại, để UI hiển thị trực tiếp.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  let finalBody: BodyInit | undefined;
  if (isFormData) {
    finalBody = body as FormData;
  } else if (body !== undefined && body !== null) {
    finalHeaders["Content-Type"] = "application/json";
    finalBody = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...rest,
      headers: finalHeaders,
      body: finalBody,
    });
  } catch {
    // Lỗi mạng (mất kết nối, DNS, CORS bị chặn...) trước khi có response từ server.
    throw new ApiError(
      { code: "NETWORK_OFFLINE", messageVi: ERROR_MESSAGES_VI.NETWORK_OFFLINE },
      0,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const rawText = await res.text();
  let parsed: unknown;
  try {
    parsed = rawText ? JSON.parse(rawText) : undefined;
  } catch {
    parsed = undefined;
  }

  if (!res.ok) {
    const errorBody = (parsed ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(
      {
        code: errorBody.code ?? "INTERNAL_ERROR",
        messageVi: errorBody.messageVi ?? ERROR_MESSAGES_VI.INTERNAL_ERROR,
        detail: errorBody.detail,
      },
      res.status,
    );
  }

  return parsed as T;
}
