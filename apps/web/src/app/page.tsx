"use client";

import { useAuthContext } from "@/components/auth/AuthProvider";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { Header } from "@/components/layout/Header";
import { Spinner } from "@/components/common/Spinner";
import { MeetingDashboard } from "@/components/home/MeetingDashboard";

export default function HomePage() {
  const { user, loading } = useAuthContext();

  if (loading) {
    return <Spinner label="Đang kiểm tra đăng nhập..." />;
  }

  if (!user) {
    return (
      <>
        <Header />
        <LoginScreen />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <MeetingDashboard />
      </main>
    </>
  );
}
