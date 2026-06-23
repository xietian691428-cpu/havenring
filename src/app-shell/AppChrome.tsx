"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { APP_CHROME_CONTENT } from "../content/appChromeContent";
import { getSubscriptionLabel } from "../features/subscription";
import { useScrollChromeVisibility } from "../hooks/useScrollChromeVisibility";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";

export type ActiveTab = "timeline" | "explore" | "seal" | "rings";

export type AppChromeProps = {
  locale?: string;
  showBottomNav?: boolean;
  showTopChrome?: boolean;
  chromeResetKey?: string;
  activeTab?: ActiveTab;
  showTemporaryBanner?: boolean;
  statusSignedIn?: boolean;
  statusRingBound?: boolean;
  statusSealRequiresRing?: boolean;
  subscriptionLabel?: string;
  onTabTimeline?: () => void;
  onTabExplore?: () => void;
  onTabSeal?: () => void;
  onTabRings?: () => void;
  onNavigateSettings?: () => void;
  onNavigateHelp?: () => void;
  children?: ReactNode;
};

/**
 * App shell: top + bottom chrome overlay the scroll pane and auto-hide on scroll down.
 */
export function AppChrome({
  locale = "en",
  showBottomNav = true,
  showTopChrome = true,
  chromeResetKey = "",
  activeTab = "timeline",
  showTemporaryBanner = false,
  statusSignedIn = false,
  statusRingBound = false,
  statusSealRequiresRing = false,
  subscriptionLabel,
  onTabTimeline,
  onTabExplore,
  onTabSeal,
  onTabRings,
  onNavigateSettings,
  onNavigateHelp,
  children,
}: AppChromeProps) {
  const subscriptionPillLabel =
    subscriptionLabel ?? getSubscriptionLabel(undefined);
  const t = APP_CHROME_CONTENT[locale as keyof typeof APP_CHROME_CONTENT] || APP_CHROME_CONTENT.en;
  const scrollRef = useRef<HTMLDivElement>(null);
  const topChromeRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLElement>(null);
  const { chromeVisible } = useScrollChromeVisibility(scrollRef, chromeResetKey);
  const [chromeInsets, setChromeInsets] = useState({ top: 0, bottom: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      setChromeInsets({
        top: showTopChrome ? topChromeRef.current?.offsetHeight ?? 0 : 0,
        bottom: showBottomNav ? tabBarRef.current?.offsetHeight ?? 0 : 0,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (topChromeRef.current) observer.observe(topChromeRef.current);
    if (tabBarRef.current) observer.observe(tabBarRef.current);
    return () => observer.disconnect();
  }, [showTopChrome, showBottomNav, showTemporaryBanner, subscriptionPillLabel]);

  const scrollPaddingTop =
    showTopChrome && chromeVisible ? chromeInsets.top : 0;
  const scrollPaddingBottom =
    showBottomNav && chromeVisible
      ? chromeInsets.bottom
      : "max(12px, env(safe-area-inset-bottom, 0px))";

  const tab = (
    id: ActiveTab,
    label: string,
    onClick?: () => void,
    isActive?: boolean
  ) => (
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
      className="haven-app-shell"
      style={{
        ...styles.wrapper,
        ...sanctuaryBackgroundStyle(),
      }}
    >
      <div
        ref={scrollRef}
        className="haven-app-main-scroll"
        style={{
          ...styles.mainArea,
          paddingTop: scrollPaddingTop,
          paddingBottom: scrollPaddingBottom,
        }}
      >
        {children}
      </div>

      {showTopChrome ? (
        <div
          ref={topChromeRef}
          className={`haven-app-chrome-top${chromeVisible ? "" : " haven-app-chrome-hidden"}`}
          style={styles.topChromeWrap}
        >
          <header style={styles.topBar}>
            <div style={styles.brandWrap}>
              <p style={styles.brand}>{t.brand}</p>
              <div
                className="haven-app-status-pills"
                style={styles.statusPills}
                role="status"
                aria-live="polite"
              >
                <span style={styles.statusPill}>
                  {statusSignedIn ? t.statusSignedIn : t.statusSignedOut}
                </span>
                <span style={styles.statusPill}>
                  {statusRingBound ? t.statusRingBound : t.statusRingNotBound}
                </span>
                <span style={styles.statusPill}>
                  {statusSealRequiresRing ? t.statusSealRingRecommended : t.statusSealSecureOnly}
                </span>
                <span style={styles.statusPill}>{subscriptionPillLabel}</span>
              </div>
            </div>
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
        </div>
      ) : null}

      {showBottomNav ? (
        <nav
          ref={tabBarRef}
          className={`haven-app-chrome-bottom${chromeVisible ? "" : " haven-app-chrome-hidden"}`}
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

const styles: Record<string, CSSProperties> = {
  wrapper: {
    height: "100dvh",
    maxHeight: "100dvh",
    minHeight: 0,
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
    position: "relative",
    overflow: "hidden",
  },
  mainArea: {
    height: "100%",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",
    transition: "padding 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  topChromeWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  temporaryBanner: {
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
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `calc(env(safe-area-inset-top, 0px) + 6px) 16px 6px`,
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
  brandWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  statusPills: {
    display: "flex",
    flexWrap: "nowrap",
    gap: 6,
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    paddingBottom: 2,
  },
  statusPill: {
    fontSize: 9,
    lineHeight: 1.2,
    borderRadius: 999,
    border: "1px solid rgba(107, 83, 68, 0.24)",
    background: "rgba(255, 255, 255, 0.62)",
    color: sanctuaryTheme.ink,
    padding: "3px 6px",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  topActions: {
    display: "flex",
    gap: 4,
    flexShrink: 0,
    marginLeft: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    border: `1px solid rgba(107, 83, 68, 0.2)`,
    background: "rgba(255, 255, 255, 0.5)",
    color: sanctuaryTheme.ink,
    fontSize: 16,
    cursor: "pointer",
    lineHeight: 1,
  },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
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
    padding: "6px 12px 8px",
  },
  tabBtn: {
    border: "none",
    background: "transparent",
    minHeight: 44,
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
    marginBottom: 2,
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
