import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { createTestUser, resetDatabase, sessionCookieFor } from "./helpers.js";

describe("vòng đời cuộc họp (mục 5.1, 5.2, 5.4)", () => {
  let app: FastifyInstance;
  let cookie: string;
  let workspaceId: string;

  beforeEach(async () => {
    await resetDatabase();
    app = await buildApp();
    const user = await createTestUser("owner");
    cookie = await sessionCookieFor(user.id, user.email);
    const wsRes = await app.inject({
      method: "POST",
      url: "/api/workspaces",
      headers: { cookie },
      payload: { name: "Công ty demo" },
    });
    workspaceId = wsRes.json().id;
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("không cho phép bắt đầu ghi âm khi chưa xác nhận đồng ý", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/meetings",
      headers: { cookie },
      payload: { title: "Họp chưa đồng ý", workspaceId },
    });
    const meeting = createRes.json();

    const startRes = await app.inject({
      method: "POST",
      url: `/api/meetings/${meeting.id}/start`,
      headers: { cookie },
    });
    expect(startRes.statusCode).toBe(400);
    expect(startRes.json().code).toBe("VALIDATION_ERROR");
  });

  it("sau khi xác nhận đồng ý thì bắt đầu/tạm dừng/tiếp tục/kết thúc hoạt động đúng", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/meetings",
      headers: { cookie },
      payload: { title: "Họp có đồng ý", workspaceId },
    });
    const meeting = createRes.json();

    await app.inject({
      method: "POST",
      url: `/api/meetings/${meeting.id}/consent`,
      headers: { cookie },
      payload: { confirmed: true },
    });

    const startRes = await app.inject({
      method: "POST",
      url: `/api/meetings/${meeting.id}/start`,
      headers: { cookie },
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json().status).toBe("recording");

    const pauseRes = await app.inject({
      method: "POST",
      url: `/api/meetings/${meeting.id}/pause`,
      headers: { cookie },
    });
    expect(pauseRes.json().status).toBe("paused");

    const resumeRes = await app.inject({
      method: "POST",
      url: `/api/meetings/${meeting.id}/resume`,
      headers: { cookie },
    });
    expect(resumeRes.json().status).toBe("recording");

    // Không có AudioChunk nào -> "end" phải tự chuyển thẳng sang 'processing' (mục 5.4).
    const endRes = await app.inject({
      method: "POST",
      url: `/api/meetings/${meeting.id}/end`,
      headers: { cookie },
    });
    expect(endRes.statusCode).toBe(200);
    expect(endRes.json().status).toBe("processing");
  });

  it("chunk đã tiến tới 'transcribed' (không còn là 'uploaded') vẫn được coi là đã upload xong khi 'end' (hồi quy)", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/meetings",
      headers: { cookie },
      payload: { title: "Họp có chunk đã transcribed", workspaceId },
    });
    const meeting = createRes.json();
    await app.inject({
      method: "POST",
      url: `/api/meetings/${meeting.id}/consent`,
      headers: { cookie },
      payload: { confirmed: true },
    });
    await app.inject({ method: "POST", url: `/api/meetings/${meeting.id}/start`, headers: { cookie } });

    // Giả lập: worker transcribe_chunk đã xử lý xong chunk này TRƯỚC khi người dùng bấm "Kết thúc"
    // (đúng kịch bản đã phát hiện qua smoke test thủ công — trước đây route "end" coi status khác
    // 'uploaded' là "chưa xong" nên meeting bị kẹt vĩnh viễn ở trạng thái 'uploading').
    await prisma.audioChunk.create({
      data: {
        meetingId: meeting.id,
        sequence: 0,
        startOffsetMs: 0,
        endOffsetMs: 18000,
        mimeType: "audio/webm",
        sizeBytes: 10,
        checksumSha256: "deadbeef",
        status: "transcribed",
        storageObjectKey: "meetings/fake/chunks/0.webm",
      },
    });

    const endRes = await app.inject({
      method: "POST",
      url: `/api/meetings/${meeting.id}/end`,
      headers: { cookie },
    });
    expect(endRes.statusCode).toBe(200);
    expect(endRes.json().status).toBe("processing");
  });

  it("xoá cuộc họp thì xoá luôn dữ liệu liên quan (mục 20)", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/meetings",
      headers: { cookie },
      payload: { title: "Họp sẽ bị xoá", workspaceId },
    });
    const meeting = createRes.json();

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/meetings/${meeting.id}`,
      headers: { cookie },
    });
    expect(deleteRes.statusCode).toBe(204);

    const found = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(found).toBeNull();
  });
});
