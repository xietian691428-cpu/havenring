import { APP_CHROME_CONTENT } from "../content/appChromeContent";

export function AppChrome({
  locale = "en",
  current,
  onNavigateHome,
  onNavigateTimeline,
  onNavigateSettings,
  onNavigateHelp,
  children,
}) {
  const t = APP_CHROME_CONTENT[locale] || APP_CHROME_CONTENT.en;
  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <p style={styles.brand}>{t.brand}</p>
        <nav aria-label={t.breadcrumbAria} style={styles.breadcrumb}>
          <button type="button" onClick={onNavigateHome} style={styles.crumbButton}>
            {t.home}
          </button>
          <span style={styles.sep}>/</span>
          <button
            type="button"
            onClick={onNavigateTimeline}
            style={{
              ...styles.crumbButton,
              opacity: current === "timeline" || current === "detail" ? 1 : 0.7,
            }}
          >
            {t.timeline}
          </button>
          <span style={styles.sep}>/</span>
          <button
            type="button"
            onClick={onNavigateSettings}
            style={{
              ...styles.crumbButton,
              opacity: current === "settings" ? 1 : 0.7,
            }}
          >
            {t.settings}
          </button>
          <span style={styles.sep}>/</span>
          <button
            type="button"
            onClick={onNavigateHelp}
            style={{
              ...styles.crumbButton,
              opacity: current === "help" ? 1 : 0.7,
            }}
          >
            {t.help}
          </button>
          {current === "new" ? (
            <>
              <span style={styles.sep}>/</span>
              <span style={styles.current}>{t.new}</span>
            </>
          ) : null}
          {current === "detail" ? (
            <>
              <span style={styles.sep}>/</span>
              <span style={styles.current}>{t.detail}</span>
            </>
          ) : null}
        </nav>
      </header>
      {children}
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)",
    background: "radial-gradient(circle at top, #281d18 0%, #120f0e 58%)",
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  header: {
    position: "sticky",
    top: "calc(env(safe-area-inset-top, 0px) + 4px)",
    zIndex: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    borderBottom: "1px solid #2f2521",
    background: "rgba(18, 15, 14, 0.78)",
    backdropFilter: "blur(8px)",
  },
  brand: {
    margin: 0,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    color: "#d9c3b3",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#d9c3b3",
  },
  crumbButton: {
    border: "none",
    background: "transparent",
    color: "#f8efe7",
    cursor: "pointer",
    padding: 0,
    fontSize: 12,
  },
  sep: { opacity: 0.5 },
  current: { color: "#f0c29e" },
};
