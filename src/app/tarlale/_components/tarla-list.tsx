"use client";

/**
 * „Tarlale" — every tarla, by locality then code, with its properties and its outline counted.   (Slice #39.67)
 *
 * The six facts about tarla boundaries stand above the list (`TarlaBoundariesInfo`), as Adrian asked: prominently.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ActivityCue } from "@/components/activity-cue";
import { TarlaBoundariesInfo } from "@/components/tarla/tarla-boundaries-info";
import type { TarlaListItem } from "@/lib/tarla/types";

export const TARLA_LIST_QUERY_KEY = ["tarlale"] as const;

async function fetchTarlale(): Promise<TarlaListItem[]> {
  const res = await fetch("/api/tarlale");
  if (res.redirected || !res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { items: TarlaListItem[] }).items;
}

export function TarlaList() {
  const t = useTranslations("tarla");
  const list = useQuery({ queryKey: TARLA_LIST_QUERY_KEY, queryFn: fetchTarlale });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold text-ink dark:text-zinc-100">{t("listTitle")}</h1>
        <p className="mt-1 text-sm text-fade dark:text-zinc-400">{t("listIntro")}</p>
      </div>
      <TarlaBoundariesInfo />
      <section className="rounded-xl border border-card-rim bg-card px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {list.isPending ? (
          <ActivityCue>{t("loading")}</ActivityCue>
        ) : list.isError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t("loadError")}</p>
        ) : list.data.length === 0 ? (
          <p className="text-sm text-fade">{t("none")}</p>
        ) : (
          <table className="text-sm" data-tarla-list="">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-fade">
                <th className="py-2 pr-4">{t("columns.code")}</th>
                <th className="py-2 pr-4">{t("columns.locality")}</th>
                <th className="py-2 pr-4">{t("columns.county")}</th>
                <th className="py-2 pr-4">{t("columns.description")}</th>
                <th className="py-2 pr-4 text-right">{t("columns.properties")}</th>
                <th className="py-2 pr-4 text-right">{t("columns.outline")}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((row) => (
                <tr key={row.id} className="border-t border-wire dark:border-zinc-700" data-tarla-row={row.indicativ}>
                  <td className="py-1.5 pr-4 font-medium">
                    <Link href={`/tarlale/${row.id}`} className="text-blue-700 underline-offset-2 hover:underline dark:text-blue-400">
                      {row.indicativ}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-4">{row.locality ?? <span className="italic text-fade">{t("noLocality")}</span>}</td>
                  <td className="py-1.5 pr-4">{row.county ?? "–"}</td>
                  <td className="py-1.5 pr-4">{row.descriere ?? "–"}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{row.propertyCount}</td>
                  <td className="py-1.5 pr-4 text-right">{t("outlineCorners", { count: row.cornerCount })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
