/**
 * Sticky pull-to-refresh chrome — visible on iOS/Android Memories timeline.
 */
export function TimelinePullRefreshBar({
  visible = false,
  label = "",
  progress = 0,
  pullDistance = 0,
  refreshing = false,
}) {
  if (!visible) return null;

  const releaseReady = progress >= 1 && !refreshing;
  const barHeight = refreshing
    ? 52
    : Math.min(56, 28 + Math.max(0, pullDistance) * 0.35);
  const iconRotation = releaseReady ? 180 : Math.min(140, progress * 140);

  return (
    <div
      style={{
        ...styles.shell,
        height: `calc(${barHeight}px + env(safe-area-inset-top, 0px))`,
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
      role="status"
      aria-live="polite"
      aria-busy={refreshing}
    >
      <div style={styles.inner}>
        <div style={styles.leadIcon}>
          {refreshing ? (
            <span style={styles.spinner} aria-hidden />
          ) : (
            <span
              style={{
                ...styles.arrow,
                transform: `rotate(${iconRotation}deg)`,
              }}
              aria-hidden
            >
              ↓
            </span>
          )}
        </div>
        <span style={styles.label}>{label}</span>
        {!refreshing ? (
          <span style={styles.track} aria-hidden>
            <span
              style={{
                ...styles.trackFill,
                width: `${Math.round(Math.min(1, progress) * 100)}%`,
              }}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  shell: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    pointerEvents: "none",
    background:
      "linear-gradient(180deg, rgba(14, 11, 9, 0.94) 0%, rgba(14, 11, 9, 0.72) 70%, transparent 100%)",
    borderBottom: "1px solid rgba(217, 166, 122, 0.22)",
    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.28)",
    transition: "height 120ms ease-out",
  },
  inner: {
    width: "min(100%, 720px)",
    padding: "0 16px 10px",
    display: "grid",
    gridTemplateColumns: "24px 1fr",
    gridTemplateRows: "auto auto",
    columnGap: 10,
    rowGap: 6,
    alignItems: "center",
  },
  leadIcon: {
    gridRow: "1 / span 2",
    width: 24,
    height: 24,
    display: "grid",
    placeItems: "center",
  },
  arrow: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
    color: "#e6b48d",
    transition: "transform 160ms ease-out",
    display: "inline-block",
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: "2px solid rgba(230, 180, 141, 0.25)",
    borderTopColor: "#e6b48d",
    animation: "haven-pull-spin 0.75s linear infinite",
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: "#f8efe7",
    letterSpacing: "0.01em",
  },
  track: {
    gridColumn: 2,
    height: 3,
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  trackFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #c9956a, #e6b48d)",
    transition: "width 80ms linear",
  },
};
