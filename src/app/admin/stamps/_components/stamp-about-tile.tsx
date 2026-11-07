"use client";

/**
 * „Ce este o Ștampilă?" — the stamps' first information tile.                                  (Slice 37.35, 41.99)
 *
 * Slice 41.99 — Adrian: „Everything that I have requested for the group's functionality should be applied very similarly
 * to the stems functionality including the colour of the fonts the behavior of the What is a stamp tile". As „Ce este un
 * Grup?" (group-about-tile.tsx, 41.84 and 41.98): all its text #C00000, „Am înțeles" at its foot, a line of its own
 * across the row (`basis-full`), and open the first time Ștampile is opened after each sign-in (once-per-sign-in.ts).
 * It was a section written out in admin/stamps/page.tsx, 7 units, its text ink.
 */
import { Check } from "lucide-react";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/lib/ui/icon-button";
import { TileTitle } from "@/components/tiles/tile-title";

export function StampAboutTile({ onUnderstood }: { onUnderstood: () => void }) {
  const t = useTranslations("stamp.infoPanel");
  const titleId = useId();
  return (
    <section data-panel="about-stamps" data-tile="about" data-tile-full="" aria-labelledby={titleId} className="basis-full rounded-lg border border-card-rim bg-card px-5 py-4 text-admin-title">
      <TileTitle id={titleId} title={t("title")} className="mb-3" admin />
      <div className="flex flex-col gap-2 text-sm">
        <p>{t("body1")}</p>
        <p>{t("body2")}</p>
        <p>{t("body3")}</p>
        <p className="text-xs">{t("codeNote")}</p>
        <p className="mt-1 border-t border-card-rim pt-2 text-xs italic">{t("seeAlso")}</p>
      </div>
      <div className="mt-3 flex justify-end">
        <IconButton icon={Check} label={t("understood")} variant="secondary" size="sm" showLabel onClick={onUnderstood} data-about-understood="" />
      </div>
    </section>
  );
}
