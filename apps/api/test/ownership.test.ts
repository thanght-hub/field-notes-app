import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { createTestUser, resetDatabase, sessionCookieFor } from "./helpers.js";

describe("cách ly dữ liệu giữa hai tài khoản (mục 22, mục 20)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDatabase();
    app = await buildApp();
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("user B không đọc được workspace/meeting của user A", async () => {
    const userA = await createTestUser("a");
    const userB = await createTestUser("b");
    const cookieA = await sessionCookieFor(userA.id, userA.email);
    const cookieB = await sessionCookieFor(userB.id, userB.email);

    const createWorkspaceRes = await app.inject({
      method: "POST",
      url: "/api/workspaces",
      headers: { cookie: cookieA },
      payload: { name: "Công ty của A" },
    });
    expect(createWorkspaceRes.statusCode).toBe(201);
    const workspace = createWorkspaceRes.json();

    const createMeetingRes = await app.inject({
      method: "POST",
      url: "/api/meetings",
      headers: { cookie: cookieA },
      payload: { title: "Họp riêng của A", workspaceId: workspace.id },
    });
    expect(createMeetingRes.statusCode).toBe(201);
    const meeting = createMeetingRes.json();

    // User B cố truy cập cuộc họp của A -> phải bị từ chối (không phải 200 kèm dữ liệu).
    const getAsB = await app.inject({
      method: "GET",
      url: `/api/meetings/${meeting.id}`,
      headers: { cookie: cookieB },
    });
    expect(getAsB.statusCode).toBe(404);

    // User B tạo workspace riêng dùng workspaceId của A -> bị từ chối.
    const createMeetingAsB = await app.inject({
      method: "POST",
      url: "/api/meetings",
      headers: { cookie: cookieB },
      payload: { title: "Họp giả mạo", workspaceId: workspace.id },
    });
    expect(createMeetingAsB.statusCode).toBe(404);

    // Danh sách cuộc họp của B rỗng, không lẫn cuộc họp của A.
    const listAsB = await app.inject({
      method: "GET",
      url: "/api/meetings",
      headers: { cookie: cookieB },
    });
    expect(listAsB.statusCode).toBe(200);
    expect(listAsB.json()).toEqual([]);

    // Chủ sở hữu thật (A) vẫn đọc được bình thường.
    const getAsA = await app.inject({
      method: "GET",
      url: `/api/meetings/${meeting.id}`,
      headers: { cookie: cookieA },
    });
    expect(getAsA.statusCode).toBe(200);
  });

  it("không có cookie phiên -> 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/meetings" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHORIZED");
  });
});
