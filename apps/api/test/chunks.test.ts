import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { buildMultipartBody, createTestUser, resetDatabase, sessionCookieFor } from "./helpers.js";

describe("upload chunk âm thanh — idempotent + checksum (mục 15, 16)", () => {
  let app: FastifyInstance;
  let cookie: string;
  let meetingId: string;

  beforeEach(async () => {
    await resetDatabase();
    app = await buildApp();
    const user = await createTestUser("recorder");
    cookie = await sessionCookieFor(user.id, user.email);
    const wsRes = await app.inject({
      method: "POST",
      url: "/api/workspaces",
      headers: { cookie },
      payload: { name: "Công ty ghi âm" },
    });
    const meetingRes = await app.inject({
      method: "POST",
      url: "/api/meetings",
      headers: { cookie },
      payload: { title: "Họp test upload chunk", workspaceId: wsRes.json().id },
    });
    meetingId = meetingRes.json().id;
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  function chunkPayload(sequence: number, content: Buffer) {
    const checksum = createHash("sha256").update(content).digest("hex");
    return buildMultipartBody(
      {
        sequence: String(sequence),
        startOffsetMs: String(sequence * 20000),
        endOffsetMs: String(sequence * 20000 + 18000),
        mimeType: "audio/webm;codecs=opus",
        checksumSha256: checksum,
      },
      { fieldName: "audio", filename: `chunk-${sequence}.webm`, contentType: "audio/webm", content },
    );
  }

  it("từ chối khi checksum không khớp nội dung thật", async () => {
    const content = Buffer.from("noi-dung-am-thanh-gia-lap");
    const { body, contentType } = buildMultipartBody(
      {
        sequence: "0",
        startOffsetMs: "0",
        endOffsetMs: "18000",
        mimeType: "audio/webm",
        checksumSha256: "sai-checksum-hoan-toan",
      },
      { fieldName: "audio", filename: "chunk-0.webm", contentType: "audio/webm", content },
    );

    const res = await app.inject({
      method: "POST",
      url: `/api/meetings/${meetingId}/chunks`,
      headers: { cookie, "content-type": contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });

  it("upload cùng 1 sequence hai lần -> idempotent, không tạo bản ghi thứ hai", async () => {
    const { body, contentType } = chunkPayload(0, Buffer.from("noi-dung-chunk-0"));

    const first = await app.inject({
      method: "POST",
      url: `/api/meetings/${meetingId}/chunks`,
      headers: { cookie, "content-type": contentType },
      payload: body,
    });
    expect(first.statusCode).toBe(201);
    const firstAck = first.json();

    const second = await app.inject({
      method: "POST",
      url: `/api/meetings/${meetingId}/chunks`,
      headers: { cookie, "content-type": contentType },
      payload: body,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().chunkId).toBe(firstAck.chunkId);

    const chunksInDb = await prisma.audioChunk.count({ where: { meetingId } });
    expect(chunksInDb).toBe(1);
  });

  it("liệt kê chunk theo đúng thứ tự sequence", async () => {
    const chunk0 = chunkPayload(0, Buffer.from("a"));
    const chunk1 = chunkPayload(1, Buffer.from("b"));
    await app.inject({
      method: "POST",
      url: `/api/meetings/${meetingId}/chunks`,
      headers: { cookie, "content-type": chunk0.contentType },
      payload: chunk0.body,
    });
    await app.inject({
      method: "POST",
      url: `/api/meetings/${meetingId}/chunks`,
      headers: { cookie, "content-type": chunk1.contentType },
      payload: chunk1.body,
    });

    const listRes = await app.inject({
      method: "GET",
      url: `/api/meetings/${meetingId}/chunks`,
      headers: { cookie },
    });
    const chunks = listRes.json();
    expect(chunks.map((c: { sequence: number }) => c.sequence)).toEqual([0, 1]);
    expect(chunks.every((c: { status: string }) => c.status === "uploaded")).toBe(true);
  });
});
