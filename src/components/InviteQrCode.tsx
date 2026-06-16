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

  const framePadding = 16;
  const frameSize = size + framePadding * 2;

  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minWidth: frameSize,
        minHeight: frameSize,
        padding: framePadding,
        borderRadius: 20,
        background: "#f8efe7",
        border: "1px solid rgba(217, 166, 122, 0.45)",
        overflow: "visible",
        ...style,
      }}
      aria-hidden={!dataUrl}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt=""
          style={{
            display: "block",
            width: size,
            height: size,
            maxWidth: "100%",
            flexShrink: 0,
            borderRadius: 8,
            objectFit: "contain",
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            maxWidth: "100%",
            flexShrink: 0,
            borderRadius: 8,
            background: "rgba(27, 20, 17, 0.06)",
          }}
        />
      )}
    </div>
  );
}
