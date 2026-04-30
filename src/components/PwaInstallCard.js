import { useState } from "react";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { PWA_INSTALL_CARD_CONTENT } from "../content/pwaInstallCardContent";

export function PwaInstallCard({ locale = "en" }) {
  const t = PWA_INSTALL_CARD_CONTENT[locale] || PWA_INSTALL_CARD_CONTENT.en;
  const [installing, setInstalling] = useState(false);
  const { canInstall, installStatus, swReady, install } = usePwaInstall({
    installPreparingTimeout: t.installPreparingTimeout,
    installReadyAfterDelay: t.installReadyAfterDelay,
  });

  async function onInstallClick() {
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <section style={cardStyle}>
      <p style={hintStyle}>
        {t.hintPrefix}
        <strong>{t.hintStrong}</strong>.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {canInstall ? (
          <button
            type="button"
            onClick={onInstallClick}
            disabled={installing}
            style={buttonStyle}
          >
            {installing ? t.installing : t.install}
          </button>
        ) : null}
        <span style={statusStyle}>
          {installStatus || (swReady ? t.offlineReady : "")}
        </span>
      </div>
    </section>
  );
}

const cardStyle = {
  border: "1px solid #3a2d28",
  borderRadius: 16,
  background: "#171210",
  padding: 16,
  display: "grid",
  gap: 10,
};

const hintStyle = {
  margin: 0,
  color: "#d9c3b3",
  lineHeight: 1.6,
};

const statusStyle = {
  fontSize: 13,
  color: "#f2d8c5",
  minHeight: 18,
};

const buttonStyle = {
  border: "1px solid #d9a67a",
  background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
  color: "#1b1411",
  borderRadius: 999,
  fontWeight: 600,
  padding: "9px 14px",
  cursor: "pointer",
};
