"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Group, Project, Workspace } from "@field-notes/shared";
import {
  ApiError,
  confirmConsent,
  createMeeting,
  createWorkspace,
  listGroups,
  listProjects,
  listWorkspaces,
} from "@/lib/api";
import { ErrorBanner } from "@/components/common/ErrorBanner";

export function NewMeetingForm() {
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [workspaceId, setWorkspaceId] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [initialNote, setInitialNote] = useState("");
  const [consented, setConsented] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ code?: string; messageVi: string } | null>(null);

  useEffect(() => {
    void listWorkspaces()
      .then((list) => {
        setWorkspaces(list);
        if (list.length > 0 && !workspaceId) setWorkspaceId(list[0]?.id ?? "");
      })
      .catch(() => {});
    // Chỉ chạy 1 lần lúc mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setProjects([]);
      setGroups([]);
      return;
    }
    void listProjects(workspaceId)
      .then(setProjects)
      .catch(() => setProjects([]));
    void listGroups(workspaceId)
      .then(setGroups)
      .catch(() => setGroups([]));
  }, [workspaceId]);

  async function handleCreateWorkspace() {
    if (!newWorkspaceName.trim()) return;
    try {
      const created = await createWorkspace(newWorkspaceName.trim());
      setWorkspaces((prev) => [...prev, created]);
      setWorkspaceId(created.id);
      setNewWorkspaceName("");
    } catch (err) {
      setError(toDisplayError(err));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError({ messageVi: "Vui lòng nhập tên cuộc họp." });
      return;
    }
    if (!workspaceId) {
      setError({ messageVi: "Vui lòng chọn hoặc tạo một công ty/đơn vị." });
      return;
    }
    if (!consented) {
      setError({ messageVi: "Vui lòng xác nhận đồng ý ghi âm và xử lý cloud trước khi bắt đầu." });
      return;
    }

    setSubmitting(true);
    try {
      const meeting = await createMeeting({
        title: title.trim(),
        workspaceId,
        projectId: projectId || undefined,
        groupId: groupId || undefined,
        location: location.trim() || undefined,
        initialNote: initialNote.trim() || undefined,
      });
      await confirmConsent(meeting.id);
      router.push(`/cuoc-hop/${meeting.id}/dang-hop`);
    } catch (err) {
      setError(toDisplayError(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && <ErrorBanner code={error.code} messageVi={error.messageVi} onDismiss={() => setError(null)} />}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Tên cuộc họp *
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vd: Họp tiến độ dự án tháng 7"
          className="rounded-md border bg-white px-3 py-2 text-sm font-normal dark:bg-slate-800"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Công ty / đơn vị *</span>
        {workspaces.length > 0 ? (
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-800"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có công ty/đơn vị nào — tạo mới bên dưới.</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="Tạo công ty/đơn vị mới"
            className="flex-1 rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-800"
          />
          <button
            type="button"
            onClick={() => void handleCreateWorkspace()}
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Tạo
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Dự án (không bắt buộc)
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={!workspaceId}
          className="rounded-md border bg-white px-3 py-2 text-sm font-normal disabled:opacity-50 dark:bg-slate-800"
        >
          <option value="">Không chọn</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Phòng ban / nhóm (không bắt buộc)
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          disabled={!workspaceId}
          className="rounded-md border bg-white px-3 py-2 text-sm font-normal disabled:opacity-50 dark:bg-slate-800"
        >
          <option value="">Không chọn</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Địa điểm (không bắt buộc)
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="rounded-md border bg-white px-3 py-2 text-sm font-normal dark:bg-slate-800"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Ghi chú ban đầu (không bắt buộc)
        <textarea
          value={initialNote}
          onChange={(e) => setInitialNote(e.target.value)}
          rows={3}
          className="rounded-md border bg-white px-3 py-2 text-sm font-normal dark:bg-slate-800"
        />
      </label>

      <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Tôi đồng ý cuộc họp này sẽ được ghi âm và xử lý (nhận dạng giọng nói, dịch, tóm tắt) bằng
          dịch vụ AI trên nền tảng đám mây để phục vụ tạo biên bản cuộc họp.
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? "Đang tạo cuộc họp..." : "Bắt đầu cuộc họp"}
      </button>
    </form>
  );
}

function toDisplayError(err: unknown): { code?: string; messageVi: string } {
  if (err instanceof ApiError) return { code: err.code, messageVi: err.messageVi };
  return { messageVi: "Đã có lỗi xảy ra. Vui lòng thử lại." };
}
