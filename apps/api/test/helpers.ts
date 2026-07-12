import { createSessionToken, SESSION_COOKIE_NAME } from "../src/auth/session.js";
import { loadEnv } from "../src/config/env.js";
import { prisma } from "../src/db/client.js";

export async function sessionCookieFor(userId: string, email: string): Promise<string> {
  const env = loadEnv();
  const token = await createSessionToken({ userId, email }, env.SESSION_JWT_SECRET);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

export async function createTestUser(suffix: string) {
  return prisma.user.create({
    data: {
      googleSub: `test-sub-${suffix}`,
      email: `user-${suffix}@example.com`,
      displayName: `Người dùng ${suffix}`,
    },
  });
}

/** Xoá dữ liệu test theo đúng thứ tự phụ thuộc (con trước cha) — dùng giữa các test để cách ly. */
export async function resetDatabase(): Promise<void> {
  await prisma.shareLink.deleteMany();
  await prisma.processingJob.deleteMany();
  await prisma.manualNote.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.transcriptSegment.deleteMany();
  await prisma.audioChunk.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.group.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}

/** Dựng thủ công 1 request multipart/form-data (1 file + field text) cho fastify.inject. */
export function buildMultipartBody(
  fields: Record<string, string>,
  file: { fieldName: string; filename: string; contentType: string; content: Buffer },
): { body: Buffer; contentType: string } {
  const boundary = `----fieldnotestestboundary${Date.now()}`;
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
    ),
    file.content,
    Buffer.from("\r\n"),
  );
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}
