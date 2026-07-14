import type { Group, Project, Workspace } from "@field-notes/shared";
import { apiFetch } from "./client";

export function listWorkspaces(): Promise<Workspace[]> {
  return apiFetch<Workspace[]>("/api/workspaces");
}

export function createWorkspace(name: string): Promise<Workspace> {
  return apiFetch<Workspace>("/api/workspaces", { method: "POST", body: { name } });
}

export function listProjects(workspaceId: string): Promise<Project[]> {
  return apiFetch<Project[]>(`/api/workspaces/${workspaceId}/projects`);
}

export function createProject(workspaceId: string, name: string): Promise<Project> {
  return apiFetch<Project>(`/api/workspaces/${workspaceId}/projects`, {
    method: "POST",
    body: { name },
  });
}

export function listGroups(workspaceId: string, projectId?: string): Promise<Group[]> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return apiFetch<Group[]>(`/api/workspaces/${workspaceId}/groups${qs}`);
}

export function createGroup(
  workspaceId: string,
  name: string,
  projectId?: string,
): Promise<Group> {
  return apiFetch<Group>(`/api/workspaces/${workspaceId}/groups`, {
    method: "POST",
    body: { name, projectId },
  });
}
