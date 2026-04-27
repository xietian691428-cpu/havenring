import { useEffect, useState } from "react";
import { ONLINE_STATUS_CONTENT } from "../content/onlineStatusContent";

export function OnlineStatusBadge({ locale = "en" }) {
  const t = ONLINE_STATUS_CONTENT[locale] || ONLINE_STATUS_CONTENT.en;
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: online ? "#c4f0d2" : "#f3c6a5",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: online ? "#49c77b" : "#d98b55",
        }}
      />
      {online ? t.online : t.offline}
    </span>
  );
}
