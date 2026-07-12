import { Header } from "@/components/layout/Header";
import { ResultsTabs } from "@/components/meeting-results/ResultsTabs";

export default async function KetQuaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <ResultsTabs meetingId={id} />
      </main>
    </>
  );
}
