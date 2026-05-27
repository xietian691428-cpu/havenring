"use client";

import { useState } from "react";
import { getInstallGuideCopy } from "@/src/content/installGuideContent";
import type { Platform } from "@/src/hooks/usePlatform";
import { usePlatform } from "@/src/hooks/usePlatform";
import { usePwaInstall } from "@/src/hooks/usePwaInstall";

type InstallGuideProps = {
  /** When omitted, uses client UA detection via usePlatform(). */
  platform?: Platform;
  ready?: boolean;
  onPrimary: () => void;
  onSkip?: () => void;
  /** "marketing" = dark gold landing style; "warm" = /start card style */
  variant?: "marketing" | "warm";
  compact?: boolean;
};

function InstallGuideBody({
  platform,
  onPrimary,
  onSkip,
  variant,
  compact,
}: Omit<InstallGuideProps, "platform" | "ready"> & { platform: Platform }) {
  const copy = getInstallGuideCopy(platform);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const { canInstall, install, installStatus } = usePwaInstall();
  const isMarketing = variant === "marketing";

  const shell = isMarketing
    ? "text-[#F5F5F5]"
    : "text-[#f8efe7]";
  const muted = isMarketing ? "text-[#AAAAAA]" : "text-[#d9c3b3]";
  const card = isMarketing
    ? "rounded-2xl border border-white/10 bg-white/5 p-6"
    : "rounded-2xl border border-[#5a3b30] bg-[rgba(26,20,18,0.85)] p-5";
  const gold = isMarketing ? "text-[#D4AF37]" : "text-[#f0c29e]";
  const primaryBtn = isMarketing
    ? "w-full rounded-full bg-[#D4AF37] py-4 text-center text-base font-medium text-black transition hover:bg-amber-300"
    : "w-full rounded-full border border-[#d9a67a] bg-gradient-to-b from-[#e6b48d] to-[#d9a67a] py-3.5 text-center text-base font-bold text-[#1b1411]";
  const ghostBtn = isMarketing
    ? "w-full rounded-full border border-white/30 py-3.5 text-center text-sm text-[#F5F5F5]/90 transition hover:border-white/50"
    : "w-full rounded-full border border-white/20 bg-white/5 py-3 text-center text-sm text-[#f8efe7]";

  return (
    <div className={`mx-auto max-w-lg px-6 ${compact ? "py-6" : "py-12"} ${shell}`}>
      <h1
        className={`mb-8 text-center font-light tracking-tight ${
          compact ? "text-2xl" : "text-3xl"
        }`}
      >
        {copy.pageTitle}
      </h1>

      {platform === "ios" ? (
        <div className="space-y-8">
          <div>
            <p className="text-lg text-white/90">{copy.lead}</p>
            <p className={`mt-4 ${muted}`}>{copy.secondary}</p>
          </div>
          <div className={card}>
            <h2 className={`mb-4 text-sm font-semibold uppercase tracking-[0.2em] ${gold}`}>
              {copy.stepsTitle}
            </h2>
            <ol className={`list-decimal space-y-3 pl-5 text-sm leading-relaxed ${muted}`}>
              {copy.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      {platform === "android" ? (
        <div className="space-y-8">
          <div>
            <p className="text-lg text-white/90">{copy.lead}</p>
            <p className={`mt-4 ${muted}`}>{copy.secondary}</p>
          </div>
          <div className={card}>
            <h2 className={`mb-4 text-sm font-semibold uppercase tracking-[0.2em] ${gold}`}>
              {copy.stepsTitle}
            </h2>
            <ol className={`list-decimal space-y-3 pl-5 text-sm leading-relaxed ${muted}`}>
              {copy.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          {canInstall ? (
            <button
              type="button"
              className={ghostBtn}
              onClick={() => void install()}
            >
              {copy.installAppCta}
            </button>
          ) : null}
          {installStatus ? (
            <p className={`text-center text-xs ${muted}`}>{installStatus}</p>
          ) : null}
        </div>
      ) : null}

      {platform === "other" ? (
        <div className={`space-y-6 text-center ${muted}`}>
          <p className="text-lg text-white/85">{copy.lead}</p>
          <p>{copy.secondary}</p>
          <div className={`${card} text-left`}>
            <h2 className={`mb-3 text-sm font-semibold uppercase tracking-[0.2em] ${gold}`}>
              {copy.stepsTitle}
            </h2>
            <ul className={`list-disc space-y-2 pl-5 text-sm ${muted}`}>
              {copy.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm">{copy.browserHint}</p>
        </div>
      ) : null}

      <div className={`mt-10 ${card}`}>
        <h2 className={`mb-2 text-sm font-semibold uppercase tracking-[0.16em] ${gold}`}>
          {copy.safetyTitle}
        </h2>
        <p className={`text-sm leading-relaxed ${muted}`}>{copy.safetyBrief}</p>
        <button
          type="button"
          className={`mt-3 text-sm underline underline-offset-4 ${gold}`}
          onClick={() => setSafetyOpen((v) => !v)}
        >
          {safetyOpen ? "Hide details" : "Show details"}
        </button>
        {safetyOpen ? (
          <ul className={`mt-3 list-disc space-y-2 pl-5 text-sm ${muted}`}>
            {copy.safetyDetails.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>{copy.safetyPrivacy}</li>
          </ul>
        ) : null}
      </div>

      <div className="mt-10 grid gap-3">
        <button type="button" className={primaryBtn} onClick={onPrimary}>
          {copy.primaryCta}
        </button>
        {onSkip ? (
          <button type="button" className={ghostBtn} onClick={onSkip}>
            {copy.skipCta}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function InstallGuide(props: InstallGuideProps) {
  const detected = usePlatform();
  const platform = props.platform ?? detected.platform;
  const ready = props.ready ?? detected.ready;

  if (!ready) {
    return (
      <div
        className="mx-auto max-w-lg animate-pulse px-6 py-16"
        aria-busy="true"
        aria-label="Detecting your device"
      >
        <div className="mb-6 h-8 rounded-lg bg-white/10" />
        <div className="h-24 rounded-2xl bg-white/5" />
      </div>
    );
  }

  return (
    <InstallGuideBody
      platform={platform}
      onPrimary={props.onPrimary}
      onSkip={props.onSkip}
      variant={props.variant}
      compact={props.compact}
    />
  );
}
