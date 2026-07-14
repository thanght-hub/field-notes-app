import type { FastifyRequest } from "fastify";
import { validationError } from "../utils/app-error.js";

export interface ParsedMultipartFile {
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface ParsedMultipart {
  fields: Record<string, string>;
  file: ParsedMultipartFile;
}

/**
 * Đọc toàn bộ 1 multipart request (đúng 1 file + các field text đi kèm) vào bộ nhớ.
 * Dùng chung cho upload chunk audio (routes/chunks.ts) và upload attachment (routes/notes.ts).
 * Kích thước tối đa đã được giới hạn ở tầng plugin @fastify/multipart (apps/api/src/index.ts).
 */
export async function parseMultipart(request: FastifyRequest): Promise<ParsedMultipart> {
  const fields: Record<string, string> = {};
  let file: ParsedMultipartFile | undefined;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      const data = await part.toBuffer();
      file = { filename: part.filename, mimeType: part.mimetype, data };
    } else {
      fields[part.fieldname] = String(part.value);
    }
  }

  if (!file) throw validationError("Thiếu file đính kèm trong request");
  return { fields, file };
}
