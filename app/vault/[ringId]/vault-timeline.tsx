"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  hasValidVaultAccess,
  hydrateHavenStore,
  useHavenStore,
  type VaultAccess,
} from "@/lib/store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { decrypt, destroyKey } from "@/lib/crypto";
import { deserializeMomentContent } from "@/lib/moment-content";
import type { MomentRow } from "@/lib/supabase/types";
import { WipeDialog } from "./wipe-dialog";

interface Props {
  ringId: string;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; moments: DecryptedMoment[] }
  | { kind: "denied"; reason: string }
  | { kind: "error"; message: string }
  | { kind: "wiped" };

interface DecryptedMoment {
  id: string;
  createdAt: string;
  text: string;
}

export function VaultTimeline({ ringId }: Props) {
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ kind: "idle" });
  const [wipeOpen, setWipeOpen] = useState(false);

  const vaultAccess = useHavenStore((s) => s.vaultAccess);
  const revokeVaultAccess = useHavenStore((s) => s.revokeVaultAccess);
  const reset = useHavenStore((s) => s.reset);

  useEffect(() => {
    hydrateHavenStore();
  }, []);

  const loadVault = useCallback(
    async (access: VaultAccess) => {
      setLoad({ kind: "loading" });
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("moments")
          .select("id, ring_id, encrypted_vault, iv, is_sealed, created_at, sealed_at")
          .eq("ring_id", access.ringId)
          .eq("is_sealed", true)
          .order("created_at", { ascending: false });

        if (error) {
          setLoad({ kind: "error", message: error.message });
          return;
        }

        const rows = (data ?? []) as MomentRow[];
        const decrypted = await Promise.all(
          rows.map(async (row) => {
            try {
              const text = await decrypt({
                encryptedVault: row.encrypted_vault,
                iv: row.iv,
              });
              const content = deserializeMomentContent(text);
              return {
                id: row.id,
                createdAt: row.created_at,
                text: content.text,
              } satisfies DecryptedMoment;
            } catch {
              return {
                id: row.id,
                createdAt: row.created_at,
                text: "",
              } satisfies DecryptedMoment;
            }
          })
        );

        setLoad({ kind: "ready", moments: decrypted });
      } catch (err) {
        setLoad({
          kind: "error",
          message: err instanceof Error ? err.message : "Unknown error.",
        });
      }
    },
    []
  );

  useEffect(() => {
    if (load.kind !== "idle") return;

    const decide = async () => {
      // Wait a microtask so we're outside the synchronous effect body —
      // this also gives Zustand persist a chance to finish rehydration.
      await Promise.resolve();
      const access = useHavenStore.getState().vaultAccess;
      if (!hasValidVaultAccess(access, ringId)) {
        setLoad({
          kind: "denied",
          reason: "Tap your ring to unlock this vault.",
        });
        return;
      }
      await loadVault(access);
    };

    void decide();
  }, [load.kind, ringId, loadVault]);

  // Auto-revoke when access expires while viewing.
  useEffect(() => {
    if (load.kind !== "ready") return;
    if (!vaultAccess) return;

    const ms = vaultAccess.expiresAt - Date.now();
    if (ms <= 0) {
      revokeVaultAccess();
      router.replace("/");
      return;
    }
    const t = window.setTimeout(() => {
      revokeVaultAccess();
      router.replace("/");
    }, ms);
    return () => window.clearTimeout(t);
  }, [load.kind, vaultAccess, revokeVaultAccess, router]);

  const handleLeave = useCallback(() => {
    revokeVaultAccess();
    router.replace("/");
  }, [revokeVaultAccess, router]);

  const handleWipeConfirmed = useCallback(async () => {
    if (!vaultAccess) throw new Error("Vault access expired.");
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Unauthorized.");

    const response = await fetch(`/api/rings/${ringId}/wipe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token: vaultAccess.token,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(payload?.error ?? "Could not wipe ring.");
    }

    // Scorched earth on the client too — the key that decrypted these rows
    // must not survive. Any old ciphertext the user backed up becomes
    // mathematically unreadable from here on.
    await destroyKey().catch(() => {});
    reset();
    setWipeOpen(false);
    setLoad({ kind: "wiped" });
  }, [ringId, vaultAccess, reset]);

  return (
    <main className="flex flex-1 w-full justify-center px-6 py-12 bg-black text-white">
      <div className="w-full max-w-xl flex flex-col gap-16">
        <AnimatePresence mode="wait">
          {load.kind === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto mt-32 h-px w-16 bg-white/60"
            />
          )}

          {load.kind === "denied" && (
            <motion.section
              key="denied"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="mx-auto mt-32 flex flex-col items-center gap-6 text-center"
            >
              <p className="text-xs tracking-[0.3em] uppercase text-white/50">
                Locked
              </p>
              <p className="max-w-xs text-sm leading-relaxed text-white/40">
                {load.reason}
              </p>
              <Link
                href="/"
                className="text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
              >
                Return
              </Link>
            </motion.section>
          )}

          {load.kind === "error" && (
            <motion.section
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="mx-auto mt-32 flex flex-col items-center gap-6 text-center"
            >
              <p className="text-xs tracking-[0.3em] uppercase text-white/50">
                Could not open vault
              </p>
              <p className="max-w-xs text-sm leading-relaxed text-white/40">
                {load.message}
              </p>
              <Link
                href="/"
                className="text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
              >
                Return
              </Link>
            </motion.section>
          )}

          {load.kind === "wiped" && (
            <motion.section
              key="wiped"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.6 }}
              className="mx-auto mt-32 flex flex-col items-center gap-6 text-center"
            >
              <div className="h-px w-24 bg-white/60" />
              <p className="text-sm tracking-[0.25em] uppercase text-white/70">
                The ring is now empty
              </p>
              <p className="max-w-xs text-sm leading-relaxed text-white/40">
                and ready for a new chapter.
              </p>
              <Link
                href="/"
                className="mt-8 text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
              >
                Leave
              </Link>
            </motion.section>
          )}

          {load.kind === "ready" && (
            <motion.section
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2 }}
              className="flex flex-col gap-16"
            >
              <Header count={load.moments.length} onLeave={handleLeave} />

              {load.moments.length === 0 ? (
                <p className="mt-24 text-center text-sm text-white/40">
                  Nothing has been sealed on this ring yet.
                </p>
              ) : (
                <ol className="flex flex-col gap-16 pt-4">
                  {load.moments.map((m) => (
                    <MomentItem key={m.id} moment={m} />
                  ))}
                </ol>
              )}

              <DeepWipeAffordance onReveal={() => setWipeOpen(true)} />
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {wipeOpen && (
        <WipeDialog
          onCancel={() => setWipeOpen(false)}
          onConfirm={handleWipeConfirmed}
        />
      )}
    </main>
  );
}

function Header({ count, onLeave }: { count: number; onLeave: () => void }) {
  const label = useMemo(
    () => (count === 1 ? "1 moment" : `${count} moments`),
    [count]
  );
  return (
    <header className="flex items-baseline justify-between">
      <div className="flex flex-col gap-2">
        <p className="text-xs tracking-[0.3em] uppercase text-white/40">
          Haven
        </p>
        <p className="text-xs tracking-[0.2em] uppercase text-white/30">
          {label}
        </p>
      </div>
      <button
        type="button"
        onClick={onLeave}
        className="text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
      >
        Leave
      </button>
    </header>
  );
}

function MomentItem({ moment }: { moment: DecryptedMoment }) {
  const date = new Date(moment.createdAt);
  const pretty = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <li className="flex flex-col gap-4 selection:bg-white/10">
      <time
        dateTime={moment.createdAt}
        className="text-[11px] tracking-[0.3em] uppercase text-white/30"
      >
        {pretty}
      </time>
      <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-white/80">
        {moment.text || (
          <span className="text-white/20">[unreadable on this device]</span>
        )}
      </p>
      <div aria-hidden className="h-px w-8 bg-white/10" />
    </li>
  );
}

function DeepWipeAffordance({ onReveal }: { onReveal: () => void }) {
  return (
    <div className="flex flex-col items-center pt-32 pb-16">
      <div className="h-px w-24 bg-white/5" />
      <button
        type="button"
        onClick={onReveal}
        aria-label="Wipe ring"
        className="mt-12 h-3 w-3 rounded-full bg-white/10 hover:bg-white/40 focus:bg-white/40 focus:outline-none transition-colors"
      />
    </div>
  );
}
