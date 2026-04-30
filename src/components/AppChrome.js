import { APP_CHROME_CONTENT } from "../content/appChromeContent";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";

/**
 * Top: minimal glass bar / bottom: 4-tab sanctuary navigation.
 */
export function AppChrome({
  locale = "en",
  showBottomNav = true,
  activeTab = "timeline",
  showTemporaryBanner = false,
  onTabTimeline,
  onTabExplore,
  onTabSeal,
  onTabRings,
  onNavigateSettings,
  onNavigateHelp,
  children,
}) {
  const t = APP_CHROME_CONTENT[locale] || APP_CHROME_CONTENT.en;
  const tab = (id, label, onClick, isActive) => (
    <button
      key={id}
      type="button"
      onClick={onClick}
      style={{
        ...styles.tabBtn,
        color: isActive ? sanctuaryTheme.ink : sanctuaryTheme.inkSoft,
        fontWeight: isActive ? 700 : 500,
      }}
      aria-current={isActive ? "page" : undefined}
    >
      <span style={styles.tabIcon} aria-hidden>
        {id === "timeline" ? "◌" : id === "explore" ? "☼" : id === "seal" ? "＋" : "◎"}
      </span>
      <span style={styles.tabLabel}>{label}</span>
    </button>
  );

  return (
    <div
      style={{
        ...styles.wrapper,
        ...sanctuaryBackgroundStyle(),
        paddingTop: showTemporaryBanner
          ? "calc(env(safe-area-inset-top, 0px) + 92px)"
          : "calc(env(safe-area-inset-top, 0px) + 52px)",
      }}
    >
      <header style={styles.topBar}>
        <p style={styles.brand}>{t.brand}</p>
        <div style={styles.topActions}>
          <button
            type="button"
            onClick={onNavigateHelp}
            style={styles.iconBtn}
            aria-label={t.helpAria}
          >
            ?
          </button>
          <button
            type="button"
            onClick={onNavigateSettings}
            style={styles.iconBtn}
            aria-label={t.settingsAria}
          >
            ⚙
          </button>
        </div>
      </header>
      {showTemporaryBanner ? (
        <div style={styles.temporaryBanner} role="status" aria-live="polite">
          {t.temporaryBanner}
        </div>
      ) : null}

      <div
        style={{
          ...styles.mainArea,
          paddingBottom: showBottomNav
            ? "calc(72px + env(safe-area-inset-bottom, 0px))"
            : "20px",
        }}
      >
        {children}
      </div>

      {showBottomNav ? (
        <nav
          style={styles.tabBar}
          aria-label={t.bottomNavAria}
        >
          <div style={styles.tabInner}>
            {tab("timeline", t.tabTimeline, onTabTimeline, activeTab === "timeline")}
            {tab("explore", t.tabExplore, onTabExplore, activeTab === "explore")}
            <button
              type="button"
              onClick={onTabSeal}
              style={{
                ...styles.sealFab,
                boxShadow:
                  activeTab === "seal"
                    ? "0 8px 28px rgba(196, 149, 106, 0.45)"
                    : "0 6px 20px rgba(42, 34, 28, 0.2)",
                transform: activeTab === "seal" ? "translateY(-2px)" : "none",
              }}
              aria-current={activeTab === "seal" ? "page" : undefined}
            >
              <span style={styles.sealPlus} aria-hidden>
                +
              </span>
              <span style={styles.sealText}>{t.tabSeal}</span>
            </button>
            {tab("rings", t.tabRings, onTabRings, activeTab === "rings")}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
    position: "relative",
  },
  temporaryBanner: {
    position: "fixed",
    top: "calc(env(safe-area-inset-top, 0px) + 52px)",
    left: 0,
    right: 0,
    zIndex: 35,
    padding: "8px 14px",
    borderBottom: "1px solid rgba(201, 123, 132, 0.35)",
    background: "rgba(72, 36, 34, 0.92)",
    color: "#ffd9cf",
    fontSize: 12,
    lineHeight: 1.45,
    textAlign: "center",
    backdropFilter: "blur(12px)",
  },
  topBar: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px`,
    borderBottom: `1px solid rgba(232, 220, 208, 0.12)`,
    background: sanctuaryTheme.headerGlass,
    backdropFilter: "blur(14px)",
  },
  brand: {
    margin: 0,
    fontSize: 13,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    color: sanctuaryTheme.wood,
    fontWeight: 600,
  },
  topActions: {
    display: "flex",
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: `1px solid rgba(107, 83, 68, 0.2)`,
    background: "rgba(255, 255, 255, 0.5)",
    color: sanctuaryTheme.ink,
    fontSize: 16,
    cursor: "pointer",
    lineHeight: 1,
  },
  mainArea: {
    minHeight: "calc(100vh - 120px)",
  },
  tabBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    background: sanctuaryTheme.tabBarBg,
    backdropFilter: "blur(16px)",
    borderTop: "1px solid rgba(107, 83, 68, 0.12)",
    boxShadow: sanctuaryTheme.shadow,
  },
  tabInner: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr minmax(88px, auto) 1fr",
    alignItems: "end",
    gap: 4,
    maxWidth: 560,
    margin: "0 auto",
    padding: "8px 12px 10px",
  },
  tabBtn: {
    border: "none",
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    padding: "6px 4px",
    cursor: "pointer",
    fontSize: 10,
    letterSpacing: "0.04em",
    minWidth: 0,
  },
  tabIcon: {
    fontSize: 18,
    lineHeight: 1,
    opacity: 0.9,
  },
  tabLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  sealFab: {
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(175deg, ${sanctuaryTheme.accentSoft} 0%, ${sanctuaryTheme.accent} 100%)`,
    color: sanctuaryTheme.ink,
    borderRadius: sanctuaryTheme.radiusPill,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    justifySelf: "center",
    marginBottom: 4,
    minWidth: 88,
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  sealPlus: {
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 400,
  },
  sealText: {
    fontSize: 9,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    maxWidth: 88,
    textAlign: "center",
    lineHeight: 1.2,
  },
};
