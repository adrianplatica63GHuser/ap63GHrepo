import Link from "next/link";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Back-navigation arrow + link  (Slice #18.11)
// ---------------------------------------------------------------------------
//
// Shared building blocks for "back to previous screen" controls. The arrow is
// the same thick 24px stroked SVG used by the version nav (◀ / ▶) so back
// arrows read as boldly as the versioning controls — replacing the old
// hairline ←/‹ unicode glyphs. Colour follows the surrounding text via
// `currentColor`, so callers control navy/neutral via a text-* class.
//
// `NavArrowIcon` is used inline by button-style back controls (person-form
// Cancel, dialog Back buttons, doc-viewer prev/next). `BackLink` is the
// plain anchor-style link used by the Reference Data screens
// ("back to value lists" / "back to groups").

// Thick-stroked directional arrow (shaft + head), 24×24, strokeWidth 3 — the
// exact glyph the version nav uses. Colour = currentColor.
export function NavArrowIcon({ dir = "left" }: { dir?: "left" | "right" }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {dir === "left" ? (
        <path d="M20 12 H5 M11 6 L5 12 L11 18" />
      ) : (
        <path d="M4 12 H19 M13 6 L19 12 L13 18" />
      )}
    </svg>
  );
}

// Plain navy "back to <screen>" link. Sized to the version label
// (0.9375rem semibold). Safe in server components (no client APIs).
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1.5 text-[0.9375rem] font-semibold text-navy hover:underline dark:text-blue-300"
    >
      <NavArrowIcon dir="left" />
      <span>{children}</span>
    </Link>
  );
}
