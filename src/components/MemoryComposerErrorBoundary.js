import { Component } from "react";
import { clearSealFlowAndReturnToApp } from "../features/seal/sealFinalizeSafe";

/**
 * Catches render errors in New Memory / seal UI without taking down the whole PWA shell.
 */
export class MemoryComposerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[MemoryComposerErrorBoundary]", error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong while sealing.";
      return (
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#0e0c0b",
            color: "#f8efe7",
            fontFamily: "Inter, system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ margin: "0 0 12px", fontSize: 22 }}>Seal paused</h1>
            <p style={{ margin: "0 0 12px", color: "#d9c3b3", lineHeight: 1.5 }}>
              Your draft is still on this device. You can try again from Memories.
            </p>
            <p style={{ margin: "0 0 16px", color: "#ffb4a8", fontSize: 14 }}>{message}</p>
            <div style={{ display: "grid", gap: 10 }}>
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                style={{
                  borderRadius: 999,
                  border: "1px solid #d9a67a",
                  background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
                  color: "#1b1411",
                  padding: "12px 16px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => clearSealFlowAndReturnToApp()}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "transparent",
                  color: "#f8efe7",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                Back to memories
              </button>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
