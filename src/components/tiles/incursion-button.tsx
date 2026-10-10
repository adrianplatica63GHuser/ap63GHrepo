"use client";

/**
 * „Incursiune" — the eye on a row of the four principal lists.      (Slice #38.72)
 *
 * Between the magnifier („Previzualizare", #38.71) and the right arrow („Deschide"): Adrian's order. A TOGGLE
 * with the magnifier's pressed look — the navy fill, a white icon — and `aria-pressed`; its name and tooltip
 * are „Incursiune" (en-GB „Peek inside", Ask first #3). Pressed, it shows the row's tile beside the list
 * (`ListPreviews`); pressed again, it closes it. Drawn only on a list that offers an Incursiune.
 *
 * Slice #38.76 — „Legături", the chain link, after the eye: the row reads magnifier, eye, chain link, arrow.
 * The same toggle on the same choice (`incursion-context.ts`): pressed, it shows the object's „Legături" beside
 * the list, read-only, and closes whatever an eye or another chain link had open; it stays pressed until another
 * eye or chain link is pressed, or it is pressed again. Its icon is lucide's `Link` — the very icon the
 * „Asociază …" buttons inside „Legături" wear (`related-tile.tsx`, `LinkIcon`); its name and tooltip the tile's
 * own name, „Legături" (en-GB „Links", Ask first #1).
 */
import { Eye, Link as LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/lib/ui/icon-button";
import type { PreviewTarget } from "@/lib/ui/previews";
import { isOpenFor, useIncursion, type IncursionView } from "./incursion-context";

export function IncursionButton({ target }: { target: PreviewTarget }) {
  const t = useTranslations("shared.incursion");
  return <ToggleButton target={target} view="peek" icon={Eye} label={t("button")} />;
}

/** Slice #38.76: the chain link — the object's „Legături" beside the list. */
export function LinksButton({ target }: { target: PreviewTarget }) {
  const t = useTranslations("shared.incursion");
  return <ToggleButton target={target} view="links" icon={LinkIcon} label={t("links")} />;
}

function ToggleButton({
  target,
  view,
  icon,
  label,
}: {
  target: PreviewTarget;
  view: IncursionView;
  icon: typeof Eye;
  label: string;
}) {
  const incursion = useIncursion();
  if (!incursion) return null;
  const pressed = isOpenFor(incursion.open, target, view);
  return (
    <IconButton
      icon={icon}
      label={label}
      variant={pressed ? "primary" : "secondary"}
      size="xs"
      aria-pressed={pressed}
      // The specs' marks: the eye's since #38.72, the chain link's since #38.76.
      data-incursion-toggle={view === "peek" ? "" : undefined}
      data-links-toggle={view === "links" ? "" : undefined}
      onClick={(e) => {
        e.stopPropagation();
        incursion.toggle(target, view);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
