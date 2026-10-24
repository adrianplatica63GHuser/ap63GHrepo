"use client";

/**
 * A principal list's add button: „+" and the list's own icon, sparkling new.                            (Slice 40.51)
 *
 * Adrian, 2026-10-24: „Replace the caption on the "Add New" button with two symbols only: a "+" and the icon of a map
 * that looks "sparkling new" with some small rays or sparkles coming out of it", and the same on the other three lists.
 * So: Lucide's Plus, then the icon the list's „Domeniu" item draws in the sidebar (`domainIcon`, 40.37), with three
 * short rays off its top-right corner in the same stroke (`SparklingIcon`) — one wrapper over whatever icon it is
 * given, so the button and the sidebar cannot drift apart (Ask first 2). No word; primary, md, 34 px as before; its
 * name and tooltip the whole „Adaugă …" (Ask first 3). A link to the list's new-record screen, or a button (Proprietăți
 * opens its dialog).
 */
import Link from "next/link";
import { Plus, type LucideIcon } from "lucide-react";
import { buttonClass, linkClass } from "@/lib/ui/button-styles";
import { ICON_PX, IconTooltip } from "@/lib/ui/icon-button";

/** `Icon` with three short rays off its top-right corner — „sparkling new". The rays are decoration, like the icon. */
export function SparklingIcon({ icon: Icon, size }: { icon: LucideIcon; size: number }) {
  const rays = Math.round(size * 0.6);
  return (
    <span className="relative inline-flex shrink-0" data-sparkling="">
      <Icon size={size} aria-hidden="true" className="shrink-0" />
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        width={rays}
        height={rays}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        className="pointer-events-none absolute"
        style={{ right: -Math.round(rays * 0.55), top: -Math.round(rays * 0.55) }}
        data-sparkles=""
      >
        <path d="M2.5 9.5 5.5 6.5M6.5 11h3.5M1 5.5V2" />
        <path d="M9.5 1.2v3.6M7.7 3h3.6" />
      </svg>
    </span>
  );
}

const CLASS = { variant: "primary", size: "md", className: "h-8.5 gap-2" } as const;

export function AddNewButton({ name, icon, href, onClick }: { name: string; icon: LucideIcon; href?: string; onClick?: () => void }) {
  // The two icons written out in each branch, not passed as one `{…}`: no words, which the controls guard
  // (text-controls-guard.test.ts) can then see.
  return (
    <IconTooltip label={name}>
      {href !== undefined ? (
        <Link href={href} aria-label={name} data-add-new="" className={linkClass(CLASS)}>
          <Plus size={ICON_PX.md} aria-hidden="true" className="shrink-0" />
          <SparklingIcon icon={icon} size={ICON_PX.md} />
        </Link>
      ) : (
        <button type="button" aria-label={name} data-add-new="" className={buttonClass(CLASS)} onClick={onClick}>
          <Plus size={ICON_PX.md} aria-hidden="true" className="shrink-0" />
          <SparklingIcon icon={icon} size={ICON_PX.md} />
        </button>
      )}
    </IconTooltip>
  );
}
