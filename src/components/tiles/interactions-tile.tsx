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

export function InteractionsTile({ title, surface }: { title: string; surface: string }) {
  const t = useTranslations("shared.tiles");
  return (
    <section
      data-tile="interactions"
      data-panel="interactions"
      aria-label={title}
      className={surface}
      style={INTERACTIONS_TILE_STYLE}
    >
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">{title}</h2>
      {/* Slice #38.06: in italics and in parentheses. The parentheses are drawn
          here, around the message, so the message stays a plain sentence in both
          files and the locators reading it keep matching. */}
      <p className="text-sm italic text-fade dark:text-zinc-400" data-interactions-note="">
        ({t("interactionsPlaceholder")})
      </p>
    </section>
  );
}
