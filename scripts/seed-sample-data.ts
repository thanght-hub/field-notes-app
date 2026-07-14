/**
 * Script tạo dữ liệu mẫu (giả lập) để phát triển/demo local — mục 25.17.
 * KHÔNG chứa dữ liệu cuộc họp thật nào; toàn bộ transcript dưới đây là văn bản giả lập tự viết.
 * Chạy: pnpm --filter @field-notes/api seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { googleSub: "dev-seed-google-sub" },
    update: {},
    create: {
      googleSub: "dev-seed-google-sub",
      email: "demo@field-notes.local",
      displayName: "Người dùng demo",
    },
  });

  const workspace = await prisma.workspace.create({
    data: { ownerUserId: user.id, name: "Công ty Demo" },
  });

  const project = await prisma.project.create({
    data: { workspaceId: workspace.id, name: "Dự án hợp tác Việt - Trung" },
  });

  const group = await prisma.group.create({
    data: { workspaceId: workspace.id, projectId: project.id, name: "Phòng kỹ thuật" },
  });

  const meeting = await prisma.meeting.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      projectId: project.id,
      groupId: group.id,
      title: "Họp mẫu — rà soát tiến độ dự án (dữ liệu giả lập)",
      status: "completed",
      sourceLanguages: ["vi-VN", "zh-CN"],
      targetLanguage: "vi-VN",
      speakerCountEstimate: 3,
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      endedAt: new Date(),
      durationSeconds: 3600,
      consentConfirmedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });

  const sampleSegments = [
    {
      sequence: 0,
      speakerLabel: "Người nói 1",
      detectedLanguage: "vi-VN",
      originalText: "Chào mọi người, hôm nay chúng ta rà soát tiến độ mô-đun A.",
      translatedText: "Chào mọi người, hôm nay chúng ta rà soát tiến độ mô-đun A.",
      confidence: 0.95,
    },
    {
      sequence: 1,
      speakerLabel: "Người nói 2",
      detectedLanguage: "zh-CN",
      originalText: "模块A的进度大概完成了百分之七十。",
      translatedText: "Tiến độ mô-đun A đã hoàn thành khoảng 70%.",
      confidence: 0.88,
    },
    {
      sequence: 2,
      speakerLabel: "Người nói 3",
      detectedLanguage: "zh-TW",
      originalText: "我們預計下週可以完成剩下的部分。",
      translatedText: "Chúng tôi dự kiến tuần sau có thể hoàn thành phần còn lại.",
      confidence: 0.81,
    },
  ] as const;

  for (const seg of sampleSegments) {
    await prisma.transcriptSegment.create({
      data: {
        meetingId: meeting.id,
        sequence: seg.sequence,
        startOffsetMs: seg.sequence * 20000,
        endOffsetMs: seg.sequence * 20000 + 18000,
        speakerLabel: seg.speakerLabel,
        detectedLanguage: seg.detectedLanguage,
        originalText: seg.originalText,
        translatedText: seg.translatedText,
        confidence: seg.confidence,
        stage: "final",
        lowConfidence: seg.confidence < 0.85,
      },
    });
  }

  const topic = await prisma.topic.create({
    data: {
      meetingId: meeting.id,
      title: "Tiến độ mô-đun A",
      startOffsetMs: 0,
      endOffsetMs: 60000,
      discussionSummary: "Mô-đun A đã hoàn thành khoảng 70%, dự kiến xong tuần sau.",
      conclusionStatus: "concluded",
      conclusion: "Tiếp tục hoàn thành phần còn lại trong tuần sau.",
    },
  });

  await prisma.decision.create({
    data: {
      meetingId: meeting.id,
      topicId: topic.id,
      content: "Hoàn thành phần còn lại của mô-đun A trong tuần sau.",
      occurredAtOffsetMs: 40000,
      confidence: 0.8,
      sourceSegmentIds: [],
    },
  });

  await prisma.actionItem.create({
    data: {
      meetingId: meeting.id,
      content: "Hoàn thiện tài liệu kỹ thuật mô-đun A.",
      assignee: null,
      dueDate: null,
      sourceSegmentIds: [],
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Đã tạo dữ liệu mẫu. meetingId=${meeting.id}, userId=${user.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
