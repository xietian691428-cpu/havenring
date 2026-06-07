"use client";

import type { CSSProperties } from "react";
import type { HavenPlatform } from "@/src/content/havenCopy";
import { getNfcHoldGuideCopy } from "@/src/content/havenCopy";

type NfcHoldGuideProps = {
  platform: HavenPlatform;
  /** Optional override for the step line under the diagram. */
  stepLine?: string;
};

export function NfcPhoneDiagram({ platform }: { platform: HavenPlatform }) {
  const stroke = "rgba(240,194,158,0.85)";
  const dim = "rgba(200,180,170,0.35)";
  if (platform === "ios") {
    return (
      <div style={styles.diagramWrap} aria-hidden>
        <svg width="200" height="128" viewBox="0 0 200 128" style={styles.svg}>
          <rect x="56" y="12" width="88" height="104" rx="14" fill="none" stroke={dim} strokeWidth="2" />
          <rect x="76" y="20" width="48" height="8" rx="3" fill={dim} />
          <path
            d="M100 20 L100 8 L130 8 L130 20"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="115" cy="14" r="5" fill="rgba(217,166,122,0.35)" stroke={stroke} strokeWidth="2" />
          <text x="100" y="118" textAnchor="middle" fill="#cbb09f" fontSize="9" fontFamily="Inter, sans-serif">
            Top — near camera / Dynamic Island
          </text>
        </svg>
      </div>
    );
  }
  if (platform === "android") {
    return (
      <div style={styles.diagramWrap} aria-hidden>
        <svg width="200" height="128" viewBox="0 0 200 128" style={styles.svg}>
          <rect x="56" y="12" width="88" height="104" rx="14" fill="none" stroke={dim} strokeWidth="2" />
          <rect x="72" y="22" width="56" height="36" rx="6" fill="none" stroke={dim} strokeWidth="1.5" />
          <circle cx="128" cy="40" r="10" fill="rgba(217,166,122,0.28)" stroke={stroke} strokeWidth="2" />
          <text x="100" y="118" textAnchor="middle" fill="#cbb09f" fontSize="9" fontFamily="Inter, sans-serif">
            Back — often near the camera
          </text>
        </svg>
      </div>
    );
  }
  return (
    <div style={styles.diagramWrap} aria-hidden>
      <svg width="200" height="96" viewBox="0 0 200 96" style={styles.svg}>
        <rect x="48" y="8" width="104" height="80" rx="12" fill="none" stroke={dim} strokeWidth="2" />
        <circle cx="100" cy="48" r="14" fill="rgba(217,166,122,0.22)" stroke={stroke} strokeWidth="2" />
        <text x="100" y="88" textAnchor="middle" fill="#cbb09f" fontSize="9" fontFamily="Inter, sans-serif">
          Hold near your device NFC reader
        </text>
      </svg>
    </div>
  );
}

export function NfcHoldGuide({ platform, stepLine }: NfcHoldGuideProps) {
  const copy = getNfcHoldGuideCopy(platform);
  return (
    <div style={styles.wrap}>
      <NfcPhoneDiagram platform={platform} />
      <p style={styles.step}>{stepLine || copy.waitStep}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: "grid",
    gap: 10,
    width: "100%",
    justifyItems: "center",
  },
  diagramWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginTop: 2,
  },
  svg: { display: "block", maxWidth: "100%" },
  step: {
    margin: 0,
    maxWidth: 320,
    fontSize: 15,
    lineHeight: 1.5,
    color: "rgba(255,247,239,0.72)",
  },
};
