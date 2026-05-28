import { RING_READY_BADGE_EN } from "../content/havenCopy";

/**
 * Minimal ring status — green dot + label (does not dominate the layout).
 * @param {{ ready?: boolean; style?: Record<string, unknown> }} props
 */
export function RingReadyBadge({ ready = false, style = {} }) {
  if (!ready) return null;

  return (
    <div
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        margin: "0 0 10px",
        alignSelf: "flex-start",
        padding: "4px 10px 4px 8px",
        borderRadius: 999,
        background: "rgba(74, 222, 128, 0.08)",
        color: "rgba(200, 230, 210, 0.9)",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.02em",
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#4ade80",
          boxShadow: "0 0 8px rgba(74, 222, 128, 0.55)",
          flexShrink: 0,
        }}
      />
      <span>{RING_READY_BADGE_EN.ready}</span>
    </div>
  );
}
