"use client";

/**
 * „Interacțiuni" on a person — that person's history, read-only.   (Slices #37.89, #38.89)
 *
 * Fixed at the right like „Hartă" and „Pagini" (the registry's `placement.right`), tinted by its group
 * (`groupSurface("fixed")`), as large as a Document's „Pagini" (`INTERACTIONS_TILE_STYLE`). Since #38.89 it is no
 * longer a placeholder: it lists the person's interactions, newest first, in the module's grid style — date and
 * time, the channel's pill, the direction's arrow, the subject, the status, the paperclip count (Ask first #1: no
 * person column, it is the person's own tile) — all of them, scrolling inside the tile (Ask first #2; the list
 * route's page, 100, is the most it reads, and it says so beyond that).
 *
 * A LOOK, NOT AN EDIT, here as in an „Incursiune": no box to type in. „Deschide în Interacțiuni" opens the module
 * scoped to the person, „Interacțiune nouă" opens it with a new record ready for them, and a row opens the module
 * with that row chosen — each through the guarded navigation, writing nothing.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Paperclip, Plus } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { INTERACTIONS_TILE_STYLE, PAGES_TILE_EMPTY_HEIGHT_PX } from "@/lib/ui/field-widths";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { ChannelPill, DirectionMark, StatusPill } from "@/components/interactions/interaction-pills";
import { PAGE_MAX, type InteractionListItem } from "@/lib/interactions/model";
import { interactionsHref } from "@/lib/interactions/links";
import { TileTitle } from "./tile-title";

/**
 * Slice #38.72: `fill` — beside a list, in an „Incursiune", the tile takes the width it is given rather than its
 * fixed 40rem; since #38.75 it grows to the height the Incursiune is given (the list's), never under its own.
 * On a person's screen its height is „Pagini"'s, and the rows scroll inside it.
 */
export function InteractionsTile({
  personId,
  title,
  subtitle,
  surface,
  fill = false,
}: {
  personId: string;
  title: string;
  subtitle?: string;
  surface: string;
  fill?: boolean;
}) {
  const t = useTranslations("shared.tiles");
  const locale = useLocale();
  const { guardedNavigate } = useUnsavedChanges();
  const history = useQuery<{ items: InteractionListItem[]; total: number }>({
    queryKey: ["interactions", "person-tile", personId],
    queryFn: async () => {
      const q = new URLSearchParams({ personId, sort: "occurredAt", order: "desc", limit: String(PAGE_MAX) });
      const res = await fetch(`/api/interactions?${q.toString()}`);
      if (!res.ok || res.redirected) throw new Error(`GET /api/interactions ${res.status}`);
      return (await res.json()) as { items: InteractionListItem[]; total: number };
    },
  });
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const items = history.data?.items ?? [];

  return (
    <section
      data-tile="interactions"
      data-panel="interactions"
      aria-label={title}
      className={fill ? `${surface} flex flex-1 flex-col` : `${surface} flex flex-col`}
      style={fill ? { minHeight: INTERACTIONS_TILE_STYLE.minHeight } : { ...INTERACTIONS_TILE_STYLE, height: PAGES_TILE_EMPTY_HEIGHT_PX }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <TileTitle title={title} subtitle={subtitle} />
        </div>
        <IconButton
          icon={ArrowRight}
          label={t("interactionsOpen")}
          variant="secondary"
          size="xs"
          data-interactions-open=""
          onClick={() => guardedNavigate(interactionsHref(personId))}
        />
        <IconButton
          icon={Plus}
          label={t("interactionsNew")}
          variant="secondary"
          size="xs"
          data-interactions-new=""
          onClick={() => guardedNavigate(interactionsHref(personId, { new: true }))}
        />
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto" data-interactions-rows="">
          {history.isPending ? (
            <p className="text-sm text-fade dark:text-zinc-400">{t("interactionsLoading")}</p>
          ) : history.isError ? (
            <p role="alert" className="text-sm text-ink dark:text-zinc-100">
              {t("interactionsError")}
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-fade dark:text-zinc-400" data-interactions-empty="">
              {t("interactionsEmpty")}
            </p>
          ) : (
            <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
              <colgroup>
                <col style={{ width: "6.5rem" }} />
                <col style={{ width: "7.5rem" }} />
                <col style={{ width: "6.5rem" }} />
                <col />
                <col style={{ width: "8.5rem" }} />
                <col style={{ width: "3rem" }} />
              </colgroup>
              <tbody>
                {items.map((row) => {
                  const at = new Date(row.occurredAt);
                  const open = () => guardedNavigate(interactionsHref(personId, { select: row.id }));
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      data-person-interaction={row.id}
                      onClick={open}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          open();
                        }
                      }}
                      className="cursor-pointer hover:bg-white/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus dark:hover:bg-zinc-800/60"
                    >
                      <td className="border-b border-black/5 px-1.5 py-1.5 align-middle dark:border-white/10">
                        <div className="whitespace-nowrap">{day.format(at)}</div>
                        <div className="whitespace-nowrap text-xs text-fade dark:text-zinc-400">{time.format(at)}</div>
                      </td>
                      <td className="border-b border-black/5 px-1.5 py-1.5 align-middle dark:border-white/10">
                        <ChannelPill channel={row.channel} />
                      </td>
                      <td className="border-b border-black/5 px-1.5 py-1.5 align-middle dark:border-white/10">
                        <DirectionMark direction={row.direction} />
                      </td>
                      <td className="border-b border-black/5 px-1.5 py-1.5 align-middle dark:border-white/10">
                        <div className="truncate" title={row.subject} data-subject="">
                          {row.subject}
                        </div>
                      </td>
                      <td className="border-b border-black/5 px-1.5 py-1.5 align-middle dark:border-white/10">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="border-b border-black/5 px-1.5 py-1.5 align-middle dark:border-white/10">
                        {row.documentCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-fade dark:text-zinc-400" title={t("interactionsDocs", { count: row.documentCount })} data-documents-count={row.documentCount}>
                            <Paperclip aria-hidden="true" size={12} />
                            {row.documentCount}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {history.data && history.data.total > items.length && (
            <p className="mt-2 text-xs text-fade dark:text-zinc-400">{t("interactionsMore", { count: items.length })}</p>
          )}
        </div>
      </div>
    </section>
  );
}
