"use client";

import { useMemo } from "react";
import { qrMatrix } from "@/lib/qr/qr-code";

/** The quiet zone the standard asks around a code, in modules. */
const QUIET = 4;

/**
 * A QR code as an SVG, drawn from `text` in the browser (`qrMatrix`) — no image, no outside service. (Slice #39.35)
 * Black on white in both themes: a phone camera reads dark modules on a light ground.
 */
export function QrCodeSvg({ text, size = 176, label }: { text: string; size?: number; label: string }) {
  const { n, d } = useMemo(() => {
    const m = qrMatrix(text);
    let path = "";
    m.forEach((row, r) => row.forEach((dark, c) => {
      if (dark) path += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    }));
    return { n: m.length + QUIET * 2, d: path };
  }, [text]);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      data-qr-text={text}
      className="rounded-md"
    >
      <rect width={n} height={n} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
