"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InstallGuide } from "@/src/components/InstallGuide";
import { APP_ENTRY_PATH } from "@/lib/site";
import { isStandaloneDisplayMode } from "@/src/hooks/usePlatform";
import { writePwaInstallDeferred } from "@/src/lib/pwaInstallKeys";

function readSafeReturnPath(raw: string | null): string {
  const fallback = "/start";
  const trimmed = (raw || "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (/^\/(setup|api)(\/|$)/i.test(trimmed)) return fallback;
  return trimmed;
}

export default function SetupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = useMemo(
    () => readSafeReturnPath(searchParams.get("return") || searchParams.get("next")),
    [searchParams]
  );

  const continueToReturn = useCallback(() => {
    router.replace(returnPath);
  }, [router, returnPath]);

  const skipInstall = useCallback(() => {
    writePwaInstallDeferred(true);
    continueToReturn();
  }, [continueToReturn]);

  useEffect(() => {
    if (isStandaloneDisplayMode()) {
      router.replace(returnPath);
    }
  }, [router, returnPath]);

  return (
    <main className="min-h-[100svh] bg-[#0A0A0A]">
      <div className="mx-auto max-w-lg px-6 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <Link
          href="/"
          className="text-xs tracking-[0.2em] text-[#666666] transition hover:text-[#AAAAAA]"
        >
          ← HavenRing
        </Link>
      </div>
      <InstallGuide
        variant="marketing"
        onPrimary={continueToReturn}
        onSkip={skipInstall}
      />
      <p className="mx-auto max-w-lg px-6 pb-12 text-center text-xs text-[#666666]">
        Memory app entry:{" "}
        <Link href={APP_ENTRY_PATH} className="text-[#D4AF37] hover:underline">
          Open App
        </Link>
        {" · "}
        <Link href="/start" className="text-[#D4AF37] hover:underline">
          Ring / sign-in
        </Link>
      </p>
    </main>
  );
}
