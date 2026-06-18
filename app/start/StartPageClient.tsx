"use client";

import nextDynamic from "next/dynamic";
import { StartPageSkeleton } from "./StartPageSkeleton";

const StartClient = nextDynamic(() => import("./StartClient"), {
  ssr: false,
  loading: () => <StartPageSkeleton />,
});

export default function StartPageClient() {
  return <StartClient />;
}
