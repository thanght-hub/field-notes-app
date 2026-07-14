import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/require-auth.js";
import { assertWorkspaceOwnership, requireUserId } from "../services/meeting-access.js";
import { validationError } from "../utils/app-error.js";

const createWorkspaceSchema = z.object({ name: z.string().min(1) });
const createProjectSchema = z.object({ name: z.string().min(1) });
const createGroupSchema = z.object({
  name: z.string().min(1),
  projectId: z.string().uuid().optional(),
});
const groupsQuerySchema = z.object({ projectId: z.string().uuid().optional() });

export default async function workspaceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);

  fastify.get("/workspaces", async (request) => {
    const userId = requireUserId(request);
    return prisma.workspace.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.post("/workspaces", async (request, reply) => {
    const userId = requireUserId(request);
    const parsed = createWorkspaceSchema.safeParse(request.body);
    if (!parsed.success) throw validationError(parsed.error.issues);

    const workspace = await prisma.workspace.create({
      data: { name: parsed.data.name, ownerUserId: userId },
    });
    reply.status(201);
    return workspace;
  });

  fastify.get<{ Params: { id: string } }>("/workspaces/:id/projects", async (request) => {
    const userId = requireUserId(request);
    const workspace = await assertWorkspaceOwnership(request.params.id, userId);
    return prisma.project.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.post<{ Params: { id: string } }>("/workspaces/:id/projects", async (request, reply) => {
    const userId = requireUserId(request);
    const workspace = await assertWorkspaceOwnership(request.params.id, userId);
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) throw validationError(parsed.error.issues);

    const project = await prisma.project.create({
      data: { name: parsed.data.name, workspaceId: workspace.id },
    });
    reply.status(201);
    return project;
  });

  fastify.get<{ Params: { id: string } }>("/workspaces/:id/groups", async (request) => {
    const userId = requireUserId(request);
    const workspace = await assertWorkspaceOwnership(request.params.id, userId);
    const parsedQuery = groupsQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) throw validationError(parsedQuery.error.issues);

    return prisma.group.findMany({
      where: {
        workspaceId: workspace.id,
        ...(parsedQuery.data.projectId ? { projectId: parsedQuery.data.projectId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.post<{ Params: { id: string } }>("/workspaces/:id/groups", async (request, reply) => {
    const userId = requireUserId(request);
    const workspace = await assertWorkspaceOwnership(request.params.id, userId);
    const parsed = createGroupSchema.safeParse(request.body);
    if (!parsed.success) throw validationError(parsed.error.issues);

    // Nếu client gửi projectId, đảm bảo project đó thuộc đúng workspace này (mục 20 — không gán chéo dữ liệu).
    if (parsed.data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: parsed.data.projectId, workspaceId: workspace.id },
      });
      if (!project) throw validationError("projectId không thuộc workspace này");
    }

    const group = await prisma.group.create({
      data: {
        name: parsed.data.name,
        workspaceId: workspace.id,
        projectId: parsed.data.projectId,
      },
    });
    reply.status(201);
    return group;
  });
}
