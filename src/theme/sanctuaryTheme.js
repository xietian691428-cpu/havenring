/**
 * Warm, minimal “sanctuary” palette — cream, wood, soft ink.
 * Photo-forward surfaces use layered neutrals; hero imagery can sit on `canvasDeep`.
 */
export const sanctuaryTheme = {
  canvasDeep: "#1a1512",
  canvasMid: "#2a221c",
  canvasWarm: "#3d3128",
  cream: "#f8efe7",
  creamMuted: "#e8dcd0",
  ink: "#2c241f",
  inkSoft: "#5c4f47",
  accent: "#c4956a",
  accentSoft: "#d9b896",
  wood: "#6b5344",
  glow: "rgba(232, 200, 168, 0.12)",
  headerGlass: "rgba(252, 248, 242, 0.82)",
  tabBarBg: "rgba(252, 248, 242, 0.94)",
  shadow: "0 -8px 32px rgba(42, 34, 28, 0.14)",
  radiusLg: 20,
  radiusPill: 999,
  font: '"Inter", "Iowan Old Style", "Georgia", system-ui, sans-serif',
};

/** Full-viewport background: soft radial + subtle vertical warmth (print-friendly). */
export function sanctuaryBackgroundStyle() {
  return {
    backgroundColor: sanctuaryTheme.canvasDeep,
    backgroundImage: [
      "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(196, 149, 106, 0.18) 0%, transparent 55%)",
      "radial-gradient(ellipse 90% 60% at 100% 100%, rgba(107, 83, 68, 0.22) 0%, transparent 45%)",
      "linear-gradient(180deg, #231c17 0%, #1a1512 38%, #171210 100%)",
    ].join(", "),
  };
}
