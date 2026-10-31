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
import type { WidthAdvice, WidthRefusal, WidthVerdict } from "@/lib/ui/tile-width-rules";

/** 41.19: the forms a shared tile's floor can be measured on (`formOfEntity`). */
const FORMS = ["natural-person", "judicial-person", "property", "document"] as const;

export function useTileWidthWords(): TileWidthWords {
  const t = useTranslations("shared.tileWidth");
  return useMemo(() => {
    const refusal = (r: WidthRefusal): string => {
      switch (r.reason) {
        case "content":
          return t("refused.content", { units: r.units, fields: r.fields, px: r.px });
        case "window":
          return t("refused.window", { units: r.units });
        case "one":
          return t("refused.one");
        case "form":
          return t("refused.form", { units: r.units, form: (FORMS as readonly string[]).includes(r.form) ? t(`forms.${r.form as (typeof FORMS)[number]}`) : r.form });
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
    return {
      handle: (title: string) => t("handle", { title }),
      units: (count: number) => t("units", { count }),
      verdict: (v: WidthVerdict) => (v.kind === "ok" ? [] : v.kind === "refused" ? [refusal(v.refusal)] : v.advice.map(advice)),
      shared: (title: string) => t("shared", { title }),
    };
  }, [t]);
}
