"use client";

/**
 * The Property's heading names its type, and explains which tiles that type
 * shows.                                                        (Slice #38.03)
 *
 * Drawn AFTER the `<h1>`, never inside it, so the heading's accessible name
 * stays the record's name alone and every `getByRole("heading", { name })`
 * keeps passing (#37.49): „Teren construit Str. Leordeni 45  -  (Teren
 * construit)" — two spaces, a dash, two spaces, the type in parentheses and in
 * italics, then an ⓘ whose bubble says, in italics, what this type shows and
 * does not show. No type chosen: nothing after the name, no dash.
 *
 * The type is the one on the form NOW (the header's Ask first), reported up by
 * PropertyForm, so the heading, the explanation and #38.04's boxes agree while
 * the user is changing it. The explanation is built from the type's three
 * flags (`typeShows`), never from a list per type.
 */

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HintBubble } from "@/lib/ui/hint-bubble";
import { typeShows, type PropertyTypeProfile, type TypeTile } from "@/lib/properties/type-profile";

/** „  -  ": two spaces, a dash, two spaces — drawn as they are (`whitespace-pre`). */
export const TYPE_SEPARATOR = "  -  ";

export function PropertyTypeHeading({ type }: { type: PropertyTypeProfile | null }) {
  const t = useTranslations("property");
  const locale = useLocale();
  const id = useId();
  if (!type) return null;

  const shows = typeShows(type);
  const names = (tiles: TypeTile[]): string =>
    new Intl.ListFormat(locale, { type: "conjunction" }).format(
      tiles.map((tile) => t("heading.typeTileQuoted", { name: t(`tiles.${tile}`) })),
    );
  const tilesSentence =
    shows.shown.length && shows.hidden.length
      ? t("heading.typeShownHidden", { shown: names(shows.shown), hidden: names(shows.hidden) })
      : shows.hidden.length
        ? t("heading.typeHiddenOnly", { hidden: names(shows.hidden) })
        : t("heading.typeShownOnly", { shown: names(shows.shown) });
  const tarlaSentence = t(shows.tarlaParcela ? "heading.typeTarlaShown" : "heading.typeTarlaHidden", {
    cadastral: t("tiles.cadastral"),
  });
  const explanation = `${tilesSentence} ${tarlaSentence}`;

  return (
    <div className="flex min-w-0 shrink-0 items-center text-2xl tracking-tight" data-heading-type="">
      <span className="whitespace-pre" data-heading-type-separator="">{TYPE_SEPARATOR}</span>
      <HintBubble
        id={id}
        text={explanation}
        triggerLabel={t("heading.typeAbout")}
        className="[&_[role=tooltip]]:italic"
      >
        <span className="italic" data-heading-type-name="">({type.name})</span>
      </HintBubble>
    </div>
  );
}
