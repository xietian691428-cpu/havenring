import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("app");

if (!container) {
  throw new Error('Missing root node: expected element with id="app".');
}

const globalAnimationStyle = document.createElement("style");
globalAnimationStyle.textContent = `
@keyframes slideFadeInForward {
  from { opacity: 0; transform: translateX(14px) translateY(4px); }
  to { opacity: 1; transform: translateX(0) translateY(0); }
}
@keyframes slideFadeInBack {
  from { opacity: 0; transform: translateX(-14px) translateY(4px); }
  to { opacity: 1; transform: translateX(0) translateY(0); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;
document.head.appendChild(globalAnimationStyle);

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
