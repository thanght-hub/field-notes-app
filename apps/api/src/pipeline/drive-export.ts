import { LANGUAGE_LABEL_VI, type SourceLanguage } from "@field-notes/shared";
import { createOAuthClient } from "../auth/google-oauth.js";
import { decryptSecret } from "../auth/token-crypto.js";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import type { DriveUploadResultWithFolder } from "../providers/google/drive.js";
import { createDriveProvider } from "../providers/index.js";
import { registerWorker } from "../queue/job-queue.js";

const env = loadEnv();

function formatMmSs(offsetMs: number): string {
  const totalSeconds = Math.max(0, Math.round(offsetMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDateYyyyMmDd(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function languageLabel(language: string): string {
  return LANGUAGE_LABEL_VI[language as SourceLanguage] ?? language;
}

registerWorker("drive_export", async (job) => {
  const meeting = await prisma.meeting.findUnique({ where: { id: job.meetingId } });
  if (!meeting) {
    throw new Error(`Không tìm thấy Meeting id=${job.meetingId}`);
  }

  const [user, workspace, project, segments, topics, decisions, actionItems] = await Promise.all([
    prisma.user.findUnique({ where: { id: meeting.userId } }),
    prisma.workspace.findUnique({ where: { id: meeting.workspaceId } }),
    meeting.projectId ? prisma.project.findUnique({ where: { id: meeting.projectId } }) : Promise.resolve(null),
    prisma.transcriptSegment.findMany({ where: { meetingId: job.meetingId }, orderBy: { sequence: "asc" } }),
    prisma.topic.findMany({ where: { meetingId: job.meetingId } }),
    prisma.decision.findMany({ where: { meetingId: job.meetingId } }),
    prisma.actionItem.findMany({ where: { meetingId: job.meetingId } }),
  ]);

  if (!user) throw new Error(`Không tìm thấy User cho Meeting id=${job.meetingId}`);
  if (!workspace) throw new Error(`Không tìm thấy Workspace cho Meeting id=${job.meetingId}`);
  if (!user.encryptedRefreshToken) {
    throw new Error(`User id=${user.id} chưa có refresh token Google — không thể xuất Drive`);
  }

  // ---- Build transcript.md ----
  const transcriptLines = segments.map((s) => {
    const header = `**[${formatMmSs(s.startOffsetMs)}] ${s.speakerLabel} (${languageLabel(s.detectedLanguage)}):** ${s.originalText}`;
    const translationLine = s.translatedText ? `\n> Bản dịch: ${s.translatedText}` : "";
    return `${header}${translationLine}`;
  });
  const transcriptMd = `# Transcript — ${meeting.title}\n\n${transcriptLines.join("\n\n")}\n`;

  // ---- Build minutes.md (mục 10.1 - 10.5) ----
  const durationLabel =
    meeting.durationSeconds != null
      ? `${Math.floor(meeting.durationSeconds / 60)} phút`
      : "(chưa xác định)";
  const uniqueSpeakerCount = meeting.speakerCountEstimate ?? new Set(segments.map((s) => s.speakerLabel)).size;

  const generalInfoSection = [
    "## 1. Thông tin chung",
    "",
    `- Tiêu đề: ${meeting.title}`,
    `- Công ty/đơn vị: ${workspace.name}`,
    project ? `- Dự án: ${project.name}` : undefined,
    `- Địa điểm: ${meeting.location ?? "(chưa xác định)"}`,
    `- Thời gian bắt đầu: ${meeting.startedAt ? meeting.startedAt.toISOString() : "(chưa xác định)"}`,
    `- Thời gian kết thúc: ${meeting.endedAt ? meeting.endedAt.toISOString() : "(chưa xác định)"}`,
    `- Thời lượng: ${durationLabel}`,
    `- Số người nói ước tính: ${uniqueSpeakerCount}`,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");

  const executiveSummarySection = [
    "## 2. Tóm tắt điều hành",
    "",
    meeting.executiveSummary ?? "(chưa có)",
  ].join("\n");

  const topicsSection = [
    "## 3. Các chủ đề đã thảo luận",
    "",
    ...(topics.length === 0
      ? ["(không có chủ đề nào được trích xuất)"]
      : topics.map((t, i) => {
          const viewpoints = t.differingViewpoints ? `\n  - Quan điểm trái chiều: ${t.differingViewpoints}` : "";
          const conclusion =
            t.conclusionStatus === "concluded"
              ? `\n  - Kết luận: ${t.conclusion ?? "(không có nội dung)"}`
              : "\n  - Kết luận: (chưa chốt, còn đang mở)";
          return `${i + 1}. **${t.title}** [${formatMmSs(t.startOffsetMs)} - ${formatMmSs(t.endOffsetMs)}]\n  - ${t.discussionSummary}${viewpoints}${conclusion}`;
        })),
  ].join("\n");

  const decisionsSection = [
    "## 4. Các quyết định",
    "",
    ...(decisions.length === 0
      ? ["(không có quyết định nào được trích xuất)"]
      : decisions.map((d, i) => {
          const links = d.sourceSegmentIds.map((id) => `#segment-${id}`).join(", ");
          return `${i + 1}. ${d.content} (độ tin cậy: ${Math.round(d.confidence * 100)}%) — nguồn: ${links}`;
        })),
  ].join("\n");

  const actionItemsSection = [
    "## 5. Công việc cần làm",
    "",
    ...(actionItems.length === 0
      ? ["(không có công việc nào được trích xuất)"]
      : actionItems.map((a, i) => {
          const assignee = a.assignee ?? "(chưa xác định người phụ trách)";
          const due = a.dueDate ?? "(chưa xác định hạn chót)";
          return `${i + 1}. ${a.content} — Phụ trách: ${assignee} — Hạn: ${due}`;
        })),
  ].join("\n");

  const minutesMd = [
    `# Biên bản cuộc họp — ${meeting.title}`,
    "",
    generalInfoSection,
    "",
    executiveSummarySection,
    "",
    topicsSection,
    "",
    decisionsSection,
    "",
    actionItemsSection,
    "",
  ].join("\n");

  // ---- Build meeting.json ----
  const meetingJson = JSON.stringify({ meeting, segments, topics, decisions, actionItems }, null, 2);

  // ---- Refresh access token & upload lên Google Drive ----
  const refreshToken = decryptSecret(user.encryptedRefreshToken, env.TOKEN_ENCRYPTION_KEY);
  const oauthClient = createOAuthClient(env);
  oauthClient.setCredentials({ refresh_token: refreshToken });
  const { token: accessToken } = await oauthClient.getAccessToken();
  if (!accessToken) {
    throw new Error(`Không lấy được access token Google cho User id=${user.id}`);
  }

  const driveProvider = createDriveProvider(accessToken);

  const dateLabel = formatDateYyyyMmDd(meeting.startedAt ?? meeting.createdAt);
  const folderPath = ["Meeting Assistant", workspace.name, project?.name, `${dateLabel} - ${meeting.title}`].filter(
    (segment): segment is string => Boolean(segment),
  );

  const transcriptUpload = (await driveProvider.uploadFile({
    folderPath,
    fileName: "transcript.md",
    mimeType: "text/markdown",
    data: new TextEncoder().encode(transcriptMd),
  })) as DriveUploadResultWithFolder;

  const minutesUpload = (await driveProvider.uploadFile({
    folderPath,
    fileName: "minutes.md",
    mimeType: "text/markdown",
    data: new TextEncoder().encode(minutesMd),
  })) as DriveUploadResultWithFolder;

  const meetingJsonUpload = (await driveProvider.uploadFile({
    folderPath,
    fileName: "meeting.json",
    mimeType: "application/json",
    data: new TextEncoder().encode(meetingJson),
  })) as DriveUploadResultWithFolder;

  // meeting.json là file đại diện cho ShareLink; cả 3 file dùng chung 1 thư mục (folderId giống nhau).
  const representativeFile = meetingJsonUpload ?? minutesUpload ?? transcriptUpload;

  // Mặc định bắt buộc "Chỉ mình tôi" (mục 13.4) — set tường minh dù Drive API mặc định đã private.
  const finalWebViewLink = await driveProvider.setShareVisibility(representativeFile.fileId, "private");

  await prisma.meeting.update({
    where: { id: job.meetingId },
    data: { driveFolderId: representativeFile.folderId },
  });

  await prisma.shareLink.create({
    data: {
      meetingId: job.meetingId,
      visibility: "private",
      driveFileId: representativeFile.fileId,
      url: finalWebViewLink,
    },
  });
});
