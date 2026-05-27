import type { Metadata } from "next";
import { Suspense } from "react";
import SetupClient from "./SetupClient";

export const metadata: Metadata = {
  title: "Install Haven — HavenRing",
  description: "Add Haven to your Home Screen or install the app for the best experience.",
};

function SetupFallback() {
  return (
    <main className="min-h-[100svh] bg-[#0A0A0A] px-6 py-16">
      <div className="mx-auto max-w-lg animate-pulse space-y-6" aria-busy="true" aria-label="Loading install guide">
        <div className="h-8 rounded-lg bg-white/10" />
        <div className="h-32 rounded-2xl bg-white/5" />
        <div className="h-12 rounded-full bg-white/10" />
      </div>
    </main>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<SetupFallback />}>
      <SetupClient />
    </Suspense>
  );
}
