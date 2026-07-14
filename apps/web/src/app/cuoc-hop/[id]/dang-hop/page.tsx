import { LiveMeetingScreen } from "@/components/meeting-live/LiveMeetingScreen";

export default async function DangHopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveMeetingScreen meetingId={id} />;
}
