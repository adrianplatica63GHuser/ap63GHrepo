"use client";

/**
 * „Interacțiuni" — a placeholder tile on the two person forms.   (Slice #37.89)
 *
 * Fixed at the right like „Hartă" and „Pagini" (the registry's
 * `placement.right`), tinted by its group (`groupSurface("fixed")`), as large
 * as a Document's „Pagini" (`INTERACTIONS_TILE_STYLE`). It says the
 * interaction-management module will be developed later; nothing is fetched or
 * stored. Since #38.06 that sentence reads in italics and in parentheses.
 */
import { useTranslations } from "next-intl";
import { INTERACTIONS_TILE_STYLE } from "@/lib/ui/field-widths";
import { TileTitle } from "./tile-title";

/**
 * Slice #38.72: `fill` — beside a list, in an „Incursiune", the tile takes the width it is given rather than its
 * fixed 40rem; its height stays the one it has on a person's screen.
 * Slice #38.75: …as its MINIMUM — it grows (`flex-1`) to the height the Incursiune is given, the list's; the
 * sentence stays at its top.
 */
export function InteractionsTile({ title, subtitle, surface, fill = false }: { title: string; subtitle?: string; surface: string; fill?: boolean }) {
  const t = useTranslations("shared.tiles");
  return (
    <section
      data-tile="interactions"
      data-panel="interactions"
      aria-label={title}
      className={fill ? `${surface} flex-1` : surface}
      style={fill ? { minHeight: INTERACTIONS_TILE_STYLE.minHeight } : INTERACTIONS_TILE_STYLE}
    >
      <TileTitle title={title} subtitle={subtitle} />
      {/* Slice #38.06: in italics and in parentheses. The parentheses are drawn
          here, around the message, so the message stays a plain sentence in both
          files and the locators reading it keep matching. */}
      <p className="text-sm italic text-fade dark:text-zinc-400" data-interactions-note="">
        ({t("interactionsPlaceholder")})
      </p>
    </section>
  );
}
