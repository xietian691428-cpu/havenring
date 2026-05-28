"use client";

import { Component } from "react";

export class RingSetupErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: String(error?.message || "Ring setup crashed"),
    };
  }

  componentDidCatch(error) {
    // Temporary diagnostics for field debugging.
    // eslint-disable-next-line no-console
    console.error("[RingSetupErrorBoundary]", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          position: "fixed",
          left: 16,
          right: 16,
          bottom: 16,
          zIndex: 120,
          borderRadius: 12,
          border: "1px solid rgba(255,180,160,0.35)",
          background: "rgba(26, 14, 12, 0.95)",
          color: "#ffd2c6",
          padding: "10px 12px",
          fontSize: 13,
          lineHeight: 1.45,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        Ring setup interrupted: {this.state.message}. Please reopen and try again.
      </div>
    );
  }
}
