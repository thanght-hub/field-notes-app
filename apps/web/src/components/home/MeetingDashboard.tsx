"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Meeting, Project, Workspace } from "@field-notes/shared";
import { ApiError, listMeetings, listProjects, listWorkspaces } from "@/lib/api";
import { countAllPendingChunks } from "@/lib/offline-db";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Spinner } from "@/components/common/Spinner";
import { MeetingListItem } from "./MeetingListItem";

export function MeetingDashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code?: string; messageVi: string } | null>(null);

  useEffect(() => {
    void listWorkspaces()
      .then(setWorkspaces)
      .catch(() => {
        // Không chặn trang chủ nếu danh sách công ty lỗi — bộ lọc chỉ đơn giản ẩn đi.
      });
    void countAllPendingChunks()
      .then(setPendingCount)
      .catch(() => setPendingCount(null));
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setProjects([]);
      setProjectId("");
      return;
    }
    void listProjects(workspaceId)
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listMeetings({ workspaceId: workspaceId || undefined, projectId: projectId || undefined })
      .then(setMeetings)
      .catch((err) => {
        if (err instanceof ApiError) {
          setError({ code: err.code, messageVi: err.messageVi });
        } else {
          setError({ messageVi: "Không thể tải danh sách cuộc họp. Vui lòng thử lại." });
        }
      })
      .finally(() => setLoading(false));
  }, [workspaceId, projectId]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/cuoc-hop/moi"
        className="block rounded-xl bg-brand-600 px-6 py-5 text-center text-lg font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        + Bắt đầu cuộc họp
      </Link>

      {pendingCount !== null && pendingCount > 0 && (
        <p className="text-center text-sm text-amber-700 dark:text-amber-300">
          Có {pendingCount} đoạn ghi âm đang chờ đồng bộ trên thiết bị này.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-800"
        >
          <option value="">Tất cả công ty</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>

        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={!workspaceId}
          className="rounded-md border bg-white px-3 py-2 text-sm disabled:opacity-50 dark:bg-slate-800"
        >
          <option value="">Tất cả dự án</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">Cuộc họp gần đây</h2>
        {error && <ErrorBanner code={error.code} messageVi={error.messageVi} />}
        {loading && !error && <Spinner label="Đang tải danh sách cuộc họp..." />}
        {!loading && !error && meetings.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Chưa có cuộc họp nào. Bấm &ldquo;Bắt đầu cuộc họp&rdquo; để tạo cuộc họp đầu tiên.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {meetings.map((meeting) => (
            <MeetingListItem key={meeting.id} meeting={meeting} />
          ))}
        </div>
      </div>
    </div>
  );
}
