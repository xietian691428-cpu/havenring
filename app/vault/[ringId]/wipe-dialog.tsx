"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CONFIRM_PHRASE = "WIPE THIS RING";

interface Props {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

type Stage =
  | { kind: "composing"; input: string }
  | { kind: "working" }
  | { kind: "error"; message: string };

export function WipeDialog({ onCancel, onConfirm }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "composing", input: "" });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage.kind !== "working") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, stage.kind]);

  async function handleConfirm() {
    if (stage.kind !== "composing") return;
    if (stage.input !== CONFIRM_PHRASE) return;
    setStage({ kind: "working" });
    try {
      await onConfirm();
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }

  const canSubmit =
    stage.kind === "composing" && stage.input === CONFIRM_PHRASE;

  return (
    <AnimatePresence>
      <motion.div
        key="scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-40 bg-black/90 backdrop-blur-sm"
        onClick={() => stage.kind !== "working" && onCancel()}
        aria-hidden
      />
      <motion.div
        key="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Wipe ring"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed inset-0 z-50 flex items-center justify-center px-6"
      >
        <div className="w-full max-w-md flex flex-col gap-10 rounded-sm border border-white/10 bg-black p-10 text-white">
          {stage.kind !== "working" && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel"
              className="self-end text-[10px] tracking-[0.3em] uppercase text-white/30 hover:text-white/60 transition-colors"
            >
              Close
            </button>
          )}

          <div className="flex flex-col gap-4">
            <p className="text-xs tracking-[0.3em] uppercase text-white/60">
              Wipe this ring
            </p>
            <p className="text-sm leading-relaxed text-white/50">
              This irreversibly removes every sealed moment tied to this ring and
              unpairs the hardware. There is no undo and no backup from Haven for this wipe.
            </p>
            <p className="text-sm leading-relaxed text-white/50">
              Type{" "}
              <span className="font-mono tracking-widest text-white/80">
                {CONFIRM_PHRASE}
              </span>{" "}
              to continue.
            </p>
          </div>

          {stage.kind === "composing" && (
            <input
              ref={inputRef}
              value={stage.input}
              onChange={(e) =>
                setStage({ kind: "composing", input: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Confirmation phrase"
              className="w-full bg-transparent border-b border-white/20 pb-2 text-sm font-mono tracking-widest text-white placeholder:text-white/20 outline-none focus:border-white/60 transition-colors"
              placeholder={CONFIRM_PHRASE}
            />
          )}

          {stage.kind === "working" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="mx-auto h-px w-16 bg-white/60"
            />
          )}

          {stage.kind === "error" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs tracking-[0.3em] uppercase text-white/60">
                Could not wipe
              </p>
              <p className="text-sm leading-relaxed text-white/40">
                {stage.message}
              </p>
              <button
                type="button"
                onClick={() =>
                  setStage({ kind: "composing", input: CONFIRM_PHRASE })
                }
                className="self-start text-xs tracking-[0.3em] uppercase text-white/60 hover:text-white transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {stage.kind === "composing" && (
            <div className="flex items-center justify-end gap-8">
              <button
                type="button"
                onClick={onCancel}
                className="text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleConfirm}
                className="text-xs tracking-[0.3em] uppercase text-white/80 hover:text-white disabled:text-white/20 disabled:cursor-not-allowed transition-colors"
              >
                Wipe
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
