/** Minimal first paint for /start — no seal bundle, no providers. */
export function StartPageSkeleton() {
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
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f8efe7" }}>
          Haven
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.75 }}>
          Preparing ring flow…
        </p>
      </div>
    </main>
  );
}
