"use client";

/**
 * „Ce este un Grup?" — the groups' first information tile.                                    (Slice 37.35, 41.84)
 *
 * Adrian, 2026-11-04: „very good for a beginner user but it should not be displayed by default, or it should have a
 * button that says “I understand”, which will close the tile". „Am înțeles" at its foot unticks it in „Panouri", which
 * is where it comes back from — remembered per browser, as every tile choice is (Ask first 1). All its text is #C00000
 * (Ask first 4).
 */
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/lib/ui/icon-button";
import { TileTitle } from "@/components/tiles/tile-title";
import { screenPanel } from "@/lib/ui/field-widths";

export function GroupAboutTile({ onUnderstood }: { onUnderstood: () => void }) {
  const t = useTranslations("group.infoPanel");
  return (
    <section {...screenPanel("about-groups", 7 /* 40.98: re-pinned, 6 of 148 px */)} data-tile="about" className="rounded-lg border border-card-rim bg-card px-5 py-4 text-admin-title">
      <TileTitle title={t("title")} className="mb-3" admin />
      <div className="flex flex-col gap-2 text-sm">
        <p>{t("body1")}</p>
        <p>{t("body2")}</p>
        <p className="text-xs">{t("codeNote")}</p>
        <p className="mt-1 border-t border-card-rim pt-2 text-xs italic">{t("seeAlso")}</p>
      </div>
      <div className="mt-3 flex justify-end">
        <IconButton icon={Check} label={t("understood")} variant="secondary" size="sm" showLabel onClick={onUnderstood} data-about-understood="" />
      </div>
    </section>
  );
}
