"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type InviteQrCodeProps = {
  value: string;
  size?: number;
  style?: CSSProperties;
};

export function InviteQrCode({ value, size = 220, style }: InviteQrCodeProps) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!value) {
      setDataUrl("");
      return;
    }
    let active = true;
    void import("qrcode").then((QRCode) =>
      QRCode.toDataURL(value, {
        width: size,
        margin: 2,
        color: { dark: "#1b1411", light: "#f8efe7" },
        errorCorrectionLevel: "M",
      }).then((url) => {
        if (active) setDataUrl(url);
      })
    );
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!value) return null;

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        padding: 16,
        borderRadius: 20,
        background: "#f8efe7",
        border: "1px solid rgba(217, 166, 122, 0.45)",
        ...style,
      }}
      aria-hidden={!dataUrl}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt=""
          width={size}
          height={size}
          style={{ display: "block", borderRadius: 8 }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            background: "rgba(27, 20, 17, 0.06)",
          }}
        />
      )}
    </div>
  );
}
