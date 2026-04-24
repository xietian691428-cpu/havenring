import { Suspense } from "react";
import { HubRouter } from "./hub-router";

export const dynamic = "force-dynamic";

export default function HubPage() {
  return (
    <Suspense fallback={<HubSkeleton />}>
      <HubRouter />
    </Suspense>
  );
}

function HubSkeleton() {
  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white">
      <div className="h-px w-16 bg-white/40 animate-pulse" />
    </main>
  );
}
