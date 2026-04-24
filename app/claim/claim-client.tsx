"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTranslator, type Locale } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useHavenStore } from "@/lib/store";

type ClaimReason =
  | "ring_inactive"
  | "nfc_unavailable"
  | "permission_denied"
  | "unknown";

interface ClaimClientProps {
  locale: Locale;
  reason: ClaimReason;
  initialToken?: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ClaimClient({ locale, reason, initialToken }: ClaimClientProps) {
  const t = getTranslator(locale);
  const router = useRouter();
  const token = useHavenStore((s) => s.claimToken);
  const setClaimToken = useHavenStore((s) => s.setClaimToken);
  const setLinkedRingId = useHavenStore((s) => s.setLinkedRingId);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (!initialToken) return;
    setClaimToken(initialToken);
  }, [initialToken, setClaimToken]);

  const reasonKey = useMemo(() => {
    if (reason === "ring_inactive") return "claim.reason.ring_inactive";
    if (reason === "nfc_unavailable") return "claim.reason.nfc_unavailable";
    if (reason === "permission_denied") return "claim.reason.permission_denied";
    return "claim.reason.unknown";
  }, [reason]);

  async function handleClaim() {
    const tokenFromUrl =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("token")
        : null;
    const effectiveToken = token ?? initialToken ?? tokenFromUrl ?? null;

    if (!effectiveToken) {
      setStatus({ kind: "error", message: t("claim.error.missing_token") });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    let accessToken = data.session?.access_token ?? null;
    if (!accessToken) {
      // Testing-friendly fallback: create an anonymous session so first-time
      // users can still claim a prewritten ring without manual auth UI.
      const anon = await supabase.auth.signInAnonymously();
      if (anon.error) {
        setStatus({
          kind: "error",
          message: `${t("claim.error.auth_required")} (${anon.error.message})`,
        });
        return;
      }
      accessToken = anon.data.session?.access_token ?? null;
      if (!accessToken) {
        const refreshed = await supabase.auth.getSession();
        accessToken = refreshed.data.session?.access_token ?? null;
      }
      if (!accessToken) {
        setStatus({
          kind: "error",
          message: `${t("claim.error.auth_required")} (anonymous session missing access token)`,
        });
        return;
      }
    }

    setStatus({ kind: "loading" });
    try {
      const response = await fetch("/api/rings/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token: effectiveToken }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setStatus({
          kind: "error",
          message: payload?.error ?? t("claim.error.generic"),
        });
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { ringId?: string }
        | null;
      if (payload?.ringId) {
        setLinkedRingId(payload.ringId);
      }
      setStatus({ kind: "success", message: t("claim.success") });
      setClaimToken(null);
      window.setTimeout(() => router.replace("/"), 700);
    } catch {
      setStatus({ kind: "error", message: t("claim.error.generic") });
    }
  }

  return (
    <main className="flex flex-1 w-full items-center justify-center px-6 py-16 bg-black text-white">
      <section className="w-full max-w-lg flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <p className="text-sm tracking-[0.24em] uppercase text-white/75">
            {t("claim.subtitle")}
          </p>
          <h1 className="text-2xl font-light leading-relaxed text-white/90">
            {t("claim.title")}
          </h1>
        </header>

        <div className="flex flex-col gap-6 border border-white/10 bg-white/[0.02] p-6">
          <p className="text-base leading-relaxed text-white/88">{t(reasonKey)}</p>
          <p className="text-sm leading-relaxed text-white/70">{t("claim.next")}</p>
          {status.kind === "error" && (
            <p className="text-sm leading-relaxed text-red-300">{status.message}</p>
          )}
          {status.kind === "success" && (
            <p className="text-sm leading-relaxed text-emerald-300">
              {status.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-8">
          <Link
            href="/"
            className="text-sm tracking-[0.24em] uppercase text-white/75 hover:text-white transition-colors"
          >
            {t("common.return")}
          </Link>
          <button
            type="button"
            onClick={handleClaim}
            disabled={status.kind === "loading"}
            className="text-sm tracking-[0.24em] uppercase text-white/90 hover:text-white disabled:text-white/40 disabled:cursor-not-allowed transition-colors"
          >
            {status.kind === "loading"
              ? t("claim.cta.claiming")
              : t("claim.cta.claim")}
          </button>
        </div>
      </section>
    </main>
  );
}
