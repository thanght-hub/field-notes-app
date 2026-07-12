-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('draft', 'recording', 'paused', 'uploading', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AudioChunkStatus" AS ENUM ('local', 'queued', 'uploading', 'uploaded', 'transcribed', 'failed');

-- CreateEnum
CREATE TYPE "TranscriptSegmentStage" AS ENUM ('interim', 'final');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('chua_thuc_hien', 'dang_thuc_hien', 'hoan_thanh');

-- CreateEnum
CREATE TYPE "ProcessingJobType" AS ENUM ('transcribe_chunk', 'realtime_summary', 'finalize_meeting', 'drive_export');

-- CreateEnum
CREATE TYPE "ProcessingJobStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "encryptedRefreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "groupId" TEXT,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "initialNote" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "status" "MeetingStatus" NOT NULL DEFAULT 'draft',
    "sourceLanguages" TEXT[],
    "targetLanguage" TEXT NOT NULL DEFAULT 'vi-VN',
    "speakerCountEstimate" INTEGER,
    "driveFolderId" TEXT,
    "executiveSummary" TEXT,
    "consentConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioChunk" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startOffsetMs" INTEGER NOT NULL,
    "endOffsetMs" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "status" "AudioChunkStatus" NOT NULL DEFAULT 'local',
    "uploadAttempts" INTEGER NOT NULL DEFAULT 0,
    "storageObjectKey" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "audioChunkId" TEXT,
    "sequence" INTEGER NOT NULL,
    "startOffsetMs" INTEGER NOT NULL,
    "endOffsetMs" INTEGER NOT NULL,
    "speakerLabel" TEXT NOT NULL,
    "detectedLanguage" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "translatedText" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "stage" "TranscriptSegmentStage" NOT NULL DEFAULT 'interim',
    "lowConfidence" BOOLEAN NOT NULL DEFAULT false,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "editedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startOffsetMs" INTEGER NOT NULL,
    "endOffsetMs" INTEGER NOT NULL,
    "discussionSummary" TEXT NOT NULL,
    "differingViewpoints" TEXT,
    "conclusion" TEXT,
    "conclusionStatus" TEXT NOT NULL DEFAULT 'open',
    "editedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "topicId" TEXT,
    "content" TEXT NOT NULL,
    "occurredAtOffsetMs" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sourceSegmentIds" TEXT[],
    "editedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "assignee" TEXT,
    "dueDate" TEXT,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'chua_thuc_hien',
    "sourceSegmentIds" TEXT[],
    "editedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualNote" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "occurredAtOffsetMs" INTEGER NOT NULL,
    "nearestSegmentId" TEXT,
    "attachmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageObjectKey" TEXT NOT NULL,
    "driveFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "driveFileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "type" "ProcessingJobType" NOT NULL,
    "status" "ProcessingJobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Workspace_ownerUserId_idx" ON "Workspace"("ownerUserId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Group_workspaceId_idx" ON "Group"("workspaceId");

-- CreateIndex
CREATE INDEX "Group_projectId_idx" ON "Group"("projectId");

-- CreateIndex
CREATE INDEX "Meeting_userId_idx" ON "Meeting"("userId");

-- CreateIndex
CREATE INDEX "Meeting_workspaceId_idx" ON "Meeting"("workspaceId");

-- CreateIndex
CREATE INDEX "Meeting_projectId_idx" ON "Meeting"("projectId");

-- CreateIndex
CREATE INDEX "Meeting_groupId_idx" ON "Meeting"("groupId");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "AudioChunk_meetingId_status_idx" ON "AudioChunk"("meetingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AudioChunk_meetingId_sequence_key" ON "AudioChunk"("meetingId", "sequence");

-- CreateIndex
CREATE INDEX "TranscriptSegment_meetingId_sequence_idx" ON "TranscriptSegment"("meetingId", "sequence");

-- CreateIndex
CREATE INDEX "TranscriptSegment_meetingId_stage_idx" ON "TranscriptSegment"("meetingId", "stage");

-- CreateIndex
CREATE INDEX "Topic_meetingId_idx" ON "Topic"("meetingId");

-- CreateIndex
CREATE INDEX "Decision_meetingId_idx" ON "Decision"("meetingId");

-- CreateIndex
CREATE INDEX "ActionItem_meetingId_idx" ON "ActionItem"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualNote_attachmentId_key" ON "ManualNote"("attachmentId");

-- CreateIndex
CREATE INDEX "ManualNote_meetingId_idx" ON "ManualNote"("meetingId");

-- CreateIndex
CREATE INDEX "Attachment_meetingId_idx" ON "Attachment"("meetingId");

-- CreateIndex
CREATE INDEX "ShareLink_meetingId_idx" ON "ShareLink"("meetingId");

-- CreateIndex
CREATE INDEX "ProcessingJob_meetingId_idx" ON "ProcessingJob"("meetingId");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_type_idx" ON "ProcessingJob"("status", "type");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioChunk" ADD CONSTRAINT "AudioChunk_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_audioChunkId_fkey" FOREIGN KEY ("audioChunkId") REFERENCES "AudioChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualNote" ADD CONSTRAINT "ManualNote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualNote" ADD CONSTRAINT "ManualNote_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
