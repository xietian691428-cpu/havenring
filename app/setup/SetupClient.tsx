"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { InstallGuide } from "@/src/components/InstallGuide";
import { APP_ENTRY_PATH } from "@/lib/site";
import { isStandaloneDisplayMode } from "@/src/hooks/usePlatform";
import { writePwaInstallDeferred } from "@/src/lib/pwaInstallKeys";

type SetupClientProps = {
  returnPath: string;
};

export default function SetupClient({ returnPath }: SetupClientProps) {
  const router = useRouter();

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
