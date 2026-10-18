"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Check, X, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";

import { IconButton } from "@/lib/ui/icon-button";
import { MAP_TOOL_ICON, MAP_TOOL_LABEL } from "@/components/maps/map-tool-icons";
import { NAVIGATE_ICON } from "@/components/maps/navigate-dialog";
import { PULSE_SETS, mapPulseHref, type MapTool } from "@/lib/ui/area-pulse";
import type { MapGuideKey } from "./nav-config";

/**
 * „Instrumente → Măsurători pe hartă / Grupări de proprietăți / Navigare" — a box about some of the big map's
 * buttons.                                                                                        (Slice #39.78)
 *
 * Each row draws the button with the map's own IconButton, icon and name (map-tool-icons.ts, NAVIGATE_ICON), not a
 * picture of it, so the box never shows a button the map no longer has (Ask first 2). The button in the box is a
 * picture only: `inert` and hidden from a screen reader, which reads its name from the row's text instead.
 *
 * OK on the first two opens the map of all properties with that set's buttons pulsing (`?pulse=measure|groups`,
 * area-pulse.ts); on „Navigare" it only closes the box — Adrian named no screen for it (Ask first 4). The box opens
 * every time its item is pressed; there is no „nu mai arăta" (Ask first 5). Escape and „Închide" close it.
 */

/** The map buttons each guide is about, in the toolbar's order — the pulse's own sets. */
export function guideTools(guide: MapGuideKey): readonly MapTool[] {
  return guide === "navigation" ? [] : PULSE_SETS[guide];
}

/** Where a guide's OK goes, or null when it only closes. */
export function guideHref(guide: MapGuideKey): string | null {
  return guide === "navigation" ? null : mapPulseHref(guide);
}

type Row = { key: string; icon: ComponentType<LucideProps>; name: string; text: string };

export function MapGuideDialog({
  guide,
  onClose,
  onOpenMap,
}: {
  guide: MapGuideKey;
  onClose: () => void;
  /** OK on a guide with a map address: the caller navigates (through the unsaved-changes guard). */
  onOpenMap: (href: string) => void;
}) {
  const t = useTranslations("nav.guides");
  const tMap = useTranslations("property");
  const tNav = useTranslations("navigate");
  const titleId = useId();
  const okRef = useRef<HTMLButtonElement>(null);
  const href = guideHref(guide);

  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: Row[] =
    guide === "navigation"
      ? [{ key: "navigate", icon: NAVIGATE_ICON, name: tNav("button"), text: t("navigation.navigate") }]
      : guideTools(guide).map((tool) => ({
          key: tool,
          icon: MAP_TOOL_ICON[tool],
          name: tMap(MAP_TOOL_LABEL[tool]),
          text: t(`${guide}.${tool}`),
        }));

  const ok = () => {
    onClose();
    if (href) onOpenMap(href);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-map-guide={guide}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-lg bg-card p-5 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start gap-2">
          <h2 id={titleId} className="min-w-0 flex-1 text-base font-semibold text-ink dark:text-zinc-100">
            {t(`${guide}.title`)}
          </h2>
          <IconButton icon={X} label={t("close")} variant="bare" size="sm" onClick={onClose} />
        </div>

        <p className="text-sm text-ink dark:text-zinc-200">{t(`${guide}.intro`)}</p>

        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start gap-3" data-map-guide-row={row.key}>
              {/* The map's own button, drawn as a picture: inert, and its name read from the text beside it. */}
              <span aria-hidden="true" inert className="shrink-0" data-map-guide-button={row.key}>
                <IconButton icon={row.icon} label={row.name} variant="secondary" size="sm" tabIndex={-1} />
              </span>
              <span className="flex min-w-0 flex-col text-sm">
                <span className="font-medium text-ink dark:text-zinc-100">{row.name}</span>
                <span className="text-fade dark:text-zinc-400">{row.text}</span>
              </span>
            </li>
          ))}
        </ul>

        {href && <p className="text-xs text-fade dark:text-zinc-400">{t("opensMap")}</p>}

        <div className="flex justify-end">
          <IconButton
            ref={okRef}
            icon={Check}
            label={t("ok")}
            showLabel
            variant="primary"
            size="md"
            onClick={ok}
            data-map-guide-ok=""
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
