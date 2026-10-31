"use client";

/**
 * The words a tile's width handle says, in the screen's language.                     (Slice 41.17)
 *
 * A hook of its own, so the tile packing (use-tile-packing.ts) imports nothing from next-intl: the screens that pack
 * tiles (`TileAreas`, `TileUnitRow`) read these and hand them over.
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { TileWidthWords } from "./tile-width-words";
import type { HeadingMeasure, Misfit, WidthAdvice, WidthRefusal, WidthVerdict } from "@/lib/ui/tile-width-rules";

/** 41.19: the forms a shared tile's floor can be measured on (`formOfEntity`). */
const FORMS = ["natural-person", "judicial-person", "property", "document"] as const;

export function useTileWidthWords(): TileWidthWords {
  const t = useTranslations("shared.tileWidth");
  return useMemo(() => {
    // 41.20 (Ask first 2): a heading's px taken apart — „«Identitate» 103 px, spațiu 8, «PPERS81773» 72, margini 26".
    const headingDetail = (h: HeadingMeasure): string =>
      [
        ...h.parts.flatMap((p, i) => [
          ...(i > 0 ? [t("refused.headingSpace", { px: h.spaces[i - 1] ?? 0 })] : []),
          i === 0 ? t("refused.headingFirst", { text: p.text, px: p.px }) : t("refused.headingPart", { text: p.text, px: p.px }),
        ]),
        t("refused.headingFrame", { px: h.frame }),
      ].join(", ");
    // 41.21 (Ask first 1, 2): the first line as before, then a line per row that would not fit — „«Nume | Prenume» — 306 px
    // (încap 254)" — the heading's with its parts; past six, „… și încă N rânduri".
    const misfitLines = (units: number, m: Misfit): string[] => [
      t("refused.narrower", { units }),
      ...m.lines.map((l) =>
        l.kind === "heading" && l.heading
          ? t("refused.headingRow", { title: l.name, px: l.px, have: m.have, detail: headingDetail(l.heading) })
          : t("refused.row", { fields: l.name, px: l.px, have: m.have }),
      ),
      ...(m.more > 0 ? [t("refused.more", { count: m.more })] : []),
    ];
    const refusal = (r: WidthRefusal): string[] => {
      switch (r.reason) {
        case "content":
          return misfitLines(r.units, r.misfit);
        case "window":
          return [t("refused.window", { units: r.units })];
        case "one":
          return [t("refused.one")];
        case "form":
          return [t("refused.form", { units: r.units, form: (FORMS as readonly string[]).includes(r.form) ? t(`forms.${r.form as (typeof FORMS)[number]}`) : r.form })];
      }
    };
    const advice = (a: WidthAdvice): string => {
      switch (a.reason) {
        case "room":
          return t("advised.room", { spare: a.spare });
        case "alone":
          return t("advised.alone", { title: a.title });
        case "laptop":
          return t("advised.laptop", { units: a.units });
        case "table":
          return t("advised.table");
      }
    };
    const verdict = (v: WidthVerdict): string[] => (v.kind === "ok" ? [] : v.kind === "refused" ? refusal(v.refusal) : v.advice.map(advice));
    return {
      handle: (title: string) => t("handle", { title }),
      units: (count: number) => t("units", { count }),
      verdict,
      // 41.21 (Ask first 3): a list is read as its first sentence and its count; everything else as it is shown.
      heard: (v: WidthVerdict) =>
        v.kind === "refused" && v.refusal.reason === "content"
          ? [`${t("refused.narrower", { units: v.refusal.units })} ${t("refused.count", { count: v.refusal.misfit.count })}`]
          : verdict(v),
      shared: (title: string) => t("shared", { title }),
    };
  }, [t]);
}
