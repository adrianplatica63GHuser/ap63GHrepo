"use client";

/**
 * A page's image, drawn turned by its stored or shown turn.      (Slice #38.17)
 *
 * Unturned it is exactly the <img> it always was, with the caller's classes.
 * Turned, the image is sized by `fitRotated` from its natural size and the
 * room it has — the box's width, and its height when it fills a column
 * („Pagini extinse"), otherwise `maxHeight` — and drawn centred, turned by a
 * CSS rotate. The wrapper takes the TURNED picture's height, so a landscape
 * scan turned upright pushes the table under it down instead of overflowing.
 * Nothing re-encodes the file.
 *
 * Until the image has loaded and the box has been measured the turned image
 * is laid out but invisible, so it never flashes at the wrong size. jsdom has
 * neither, which leaves the turn readable on `data-rotation` and the style.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { fitRotated, type PageRotation, type Size } from "@/lib/documents/page-rotation";

type Props = {
  src: string;
  alt: string;
  rotation: PageRotation;
  /** The unturned image's classes, as the caller always drew it. */
  className: string;
  /** A turned image's own decoration (a border, rounded corners) — its size is computed. */
  frameClassName?: string;
  /** The tallest the turned picture may be, in px, when it does not fill its box. Omitted, it is as tall as its width allows. */
  maxHeight?: number;
  /** Fill the parent's height too (the tall „Pagini extinse" column). */
  fill?: boolean;
  onError?: () => void;
};

export function RotatedImage({ src, alt, rotation, className, frameClassName = "", maxHeight, fill = false, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [room, setRoom] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || rotation === 0 || typeof ResizeObserver === "undefined") return;
    const measure = () => setRoom({ width: el.clientWidth, height: fill ? el.clientHeight : (maxHeight ?? Infinity) });
    // Measured now, and again on every change. A ResizeObserver reports only at the next rendering
    // step, which a hidden tab never reaches — the driven run of TC-DOC-17 (a hidden browser pane)
    // left the turned page invisible waiting for that first report.
    measure();
    const sizes = new ResizeObserver(measure);
    sizes.observe(el);
    return () => sizes.disconnect();
  }, [rotation, fill, maxHeight]);

  // ⚠️ The image is usually loaded already — the same signed URL the unturned <img> just showed,
  // from the browser's cache — and a load that completed before React's handler was listening is
  // never reported. The driven run of TC-DOC-17 found the turned page invisible for exactly that
  // reason, so the natural size is also read from a complete image here.
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (rotation === 0 || !img || !img.complete || img.naturalWidth === 0) return;
    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
  }, [rotation, src]);

  if (rotation === 0) {
    // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL, as the Pagini panel always drew it
    return <img src={src} alt={alt} onError={onError} className={className} data-rotation={0} />;
  }

  const fit = natural && room ? fitRotated(natural, room, rotation) : null;
  return (
    <div
      ref={ref}
      className={fill ? "relative h-full w-full" : "relative w-full"}
      style={fill ? undefined : { height: fit ? `${fit.boxHeight}px` : "1px" }}
      data-rotated-page={rotation}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage URL, as the Pagini panel always drew it */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onError={onError}
        onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
        data-rotation={rotation}
        className={`absolute max-w-none ${fit ? "" : "invisible"} ${frameClassName}`.trim()}
        style={{
          left: "50%",
          top: "50%",
          width: fit ? `${fit.imageWidth}px` : undefined,
          height: fit ? `${fit.imageHeight}px` : undefined,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        }}
      />
    </div>
  );
}
