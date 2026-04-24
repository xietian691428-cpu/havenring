"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { encrypt } from "@/lib/crypto";
import { getPreferredLocale, getTranslator } from "@/lib/i18n";
import {
  MAX_MOMENT_TEXT_CHARS,
  serializeMomentContent,
} from "@/lib/moment-content";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { hydrateHavenStore, useHavenStore } from "@/lib/store";

type LocalUi =
  | { kind: "composing" }
  | { kind: "preparing" }
  | { kind: "error"; message: string };

type UiKind = "composing" | "preparing" | "awaiting_tap" | "error";

export default function HomePage() {
  const locale = getPreferredLocale();
  const t = getTranslator(locale);
  const [text, setText] = useState("");
  const [localUi, setLocalUi] = useState<LocalUi>({ kind: "composing" });
  const [activeRingId, setActiveRingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stage = useHavenStore((s) => s.stage);
  const pending = useHavenStore((s) => s.pending);
  const stagePending = useHavenStore((s) => s.stagePending);
  const clearPending = useHavenStore((s) => s.clearPending);
  const linkedRingId = useHavenStore((s) => s.linkedRingId);
  const hasTyped = text.length > 0;

  useEffect(() => {
    hydrateHavenStore();
  }, []);

  // The awaiting-tap screen is controlled by the persisted store — so if
  // the user refreshes or comes back, they land right back in the ritual.
  const showAwaiting = Boolean(pending) && stage === "awaiting_tap";
  const uiKind: UiKind = showAwaiting ? "awaiting_tap" : localUi.kind;
  const errorMessage = localUi.kind === "error" ? localUi.message : null;

  useEffect(() => {
    if (linkedRingId) {
      setActiveRingId(linkedRingId);
      return;
    }
    // Look up the user's active ring (for MVP: the most recent active one).
    // If no ring is claimed yet we render a minimal placeholder state.
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("rings")
          .select("id")
          .eq("status", "active")
          .order("claimed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) return;
        if (data?.id) setActiveRingId(data.id);
      } catch {
        // Silent — unconfigured Supabase is tolerated in dev.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedRingId]);

  async function handlePrepareSeal() {
    const value = text.trim();
    if (!value) return;
    if (!activeRingId) {
      setLocalUi({
        kind: "error",
        message: t("home.error.no_active_ring"),
      });
      return;
    }

    setLocalUi({ kind: "preparing" });

    try {
      const payload = await encrypt(
        serializeMomentContent({
          text: value,
          image_url: null,
          audio_url: null,
        })
      );
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase
        .from("moments")
        .insert({
          ring_id: activeRingId,
          text: value,
          image_url: null,
          audio_url: null,
          encrypted_vault: payload.encryptedVault,
          iv: payload.iv,
          is_sealed: false,
        })
        .select("id, created_at")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Could not stage moment.");
      }

      setText("");
      stagePending({
        momentId: data.id,
        ringId: activeRingId,
        stagedAt: data.created_at ? Date.parse(data.created_at) : 0,
      });
      // Store update drives us into the awaiting screen.
      setLocalUi({ kind: "composing" });
    } catch (err) {
      setLocalUi({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }

  function handleCancelWaiting() {
    clearPending();
    setLocalUi({ kind: "composing" });
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  return (
    <main className="flex flex-1 w-full items-center justify-center px-6 py-16">
      <AnimatePresence mode="wait">
        {uiKind === "composing" && (
          <motion.section
            key="composing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full max-w-lg flex flex-col gap-10"
          >
            <header className="flex flex-col gap-3">
              <p className="text-xs tracking-[0.3em] uppercase text-white/40">
                Haven
              </p>
              <h1 className="text-xl font-light leading-relaxed text-white/80">
                {t("home.title.line1")}
                <br />
                {t("home.title.line2")}
              </h1>
            </header>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) =>
                setText(e.target.value.slice(0, MAX_MOMENT_TEXT_CHARS))
              }
              placeholder="Write something only you want to keep…"
              rows={6}
              autoFocus
              className={`w-full min-h-52 resize-none bg-transparent text-center text-2xl leading-relaxed outline-none border-b pb-5 transition-all md:text-3xl ${
                hasTyped
                  ? "text-white/95 placeholder:text-white/15 border-white/35 shadow-[0_8px_30px_rgba(255,255,255,0.08)]"
                  : "text-white/75 placeholder:text-white/20 border-white/10 focus:border-white/30"
              }`}
              maxLength={MAX_MOMENT_TEXT_CHARS}
            />
            <p className="text-right text-xs tracking-[0.2em] text-white/35">
              {text.length} / {MAX_MOMENT_TEXT_CHARS}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-white/30">
                  {activeRingId
                    ? t("home.ring.linked")
                    : t("home.ring.unlinked")}
                </span>
                {!activeRingId && (
                  <Link
                    href={`/claim?reason=ring_inactive&lang=${locale}`}
                    className="text-[10px] tracking-[0.2em] uppercase text-white/40 hover:text-white/70 transition-colors"
                  >
                    {t("home.claim.hint")} {t("home.claim.cta")}
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={handlePrepareSeal}
                disabled={!hasTyped || !activeRingId}
                className="text-xs tracking-[0.3em] uppercase text-white/80 hover:text-white disabled:text-white/20 disabled:cursor-not-allowed transition-colors"
              >
                {t("home.cta.prepare")}
              </button>
            </div>
          </motion.section>
        )}

        {uiKind === "preparing" && (
          <motion.p
            key="preparing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="text-xs tracking-[0.3em] uppercase text-white/50"
          >
            {t("home.state.encrypting")}
          </motion.p>
        )}

        {uiKind === "awaiting_tap" && (
          <motion.section
            key="awaiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="fixed inset-0 flex flex-col items-center justify-center gap-10 bg-black px-8"
          >
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="h-px w-24 bg-white/60"
            />
            <h2 className="text-center text-lg font-light tracking-[0.3em] uppercase text-white/90">
              {t("home.state.awaiting.title")}
            </h2>
            <p className="max-w-xs text-center text-xs leading-relaxed text-white/40">
              {t("home.state.awaiting.body")}
            </p>
            <button
              type="button"
              onClick={handleCancelWaiting}
              className="mt-16 text-[10px] tracking-[0.3em] uppercase text-white/25 hover:text-white/60 transition-colors"
            >
              {t("common.discard")}
            </button>
          </motion.section>
        )}

        {uiKind === "error" && (
          <motion.section
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <p className="text-xs tracking-[0.3em] uppercase text-white/50">
              {t("home.error.title")}
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-white/40">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setLocalUi({ kind: "composing" })}
              className="text-xs tracking-[0.3em] uppercase text-white/60 hover:text-white transition-colors"
            >
              {t("common.back")}
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
