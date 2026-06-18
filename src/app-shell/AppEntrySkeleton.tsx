/** Minimal shell while /app providers warm up — no Timeline, no sync. */
export function AppEntrySkeleton() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#120f0e",
        color: "#d9c3b3",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f8efe7" }}>
        Opening your memories…
      </p>
    </main>
  );
}
