"use client";

import { Header } from "@/components/layout/Header";
import { NewMeetingForm } from "@/components/meeting-new/NewMeetingForm";

export default function NewMeetingPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-5 text-xl font-semibold">Tạo cuộc họp mới</h1>
        <NewMeetingForm />
      </main>
    </>
  );
}
