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
 * Its icon is lucide's `Link` — the very icon the „Asociază …" buttons inside „Legături" wear
 * (`related-tile.tsx`, `LinkIcon`); its name and tooltip the tile's own name, „Legături" (en-GB „Links").
 *
 * Slice #39.04 — the three are INDEPENDENT toggles on one row (`@/lib/ui/row-tiles`): the eye no longer closes the
 * chain link's tile or the reverse, and neither closes the preview. While any of the three is open on a row, the
 * three on every other row are drawn disabled, with a note saying why (`lockedNote`) — „Deschide" never is.
 */
import { Eye, Link as LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/lib/ui/icon-button";
import type { SmallSquare } from "@/lib/ui/button-styles";
import type { PreviewTarget } from "@/lib/ui/previews";
import { isLocked, isRowTileOpen } from "@/lib/ui/row-tiles";
import { useIncursion, type IncursionView } from "./incursion-context";

/** Slice 40.30: `square="row"` on the four lists' rows (24 px); elsewhere today's xs. */
export function IncursionButton({ target, square }: { target: PreviewTarget; square?: SmallSquare }) {
  const t = useTranslations("shared.incursion");
  return <ToggleButton target={target} view="peek" icon={Eye} label={t("button")} square={square} />;
}

/** Slice #38.76: the chain link — the object's „Legături" beside the list. */
export function LinksButton({ target, square }: { target: PreviewTarget; square?: SmallSquare }) {
  const t = useTranslations("shared.incursion");
  return <ToggleButton target={target} view="links" icon={LinkIcon} label={t("links")} square={square} />;
}

function ToggleButton({
  target,
  view,
  icon,
  label,
  square,
}: {
  target: PreviewTarget;
  view: IncursionView;
  icon: typeof Eye;
  label: string;
  square?: SmallSquare;
}) {
  const t = useTranslations("shared.incursion");
  const incursion = useIncursion();
  if (!incursion || !incursion.offersIncursion) return null;
  const pressed = isRowTileOpen(incursion.state, target, view);
  const locked = isLocked(incursion.state, target);
  return (
    <IconButton
      icon={icon}
      label={label}
      variant={pressed ? "primary" : "secondary"}
      size="xs"
      square={square}
      aria-pressed={pressed}
      disabled={locked}
      note={locked ? t("lockedNote") : undefined}
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
