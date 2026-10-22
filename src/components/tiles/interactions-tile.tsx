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
 *
 * Slice #39.05 — B, WITH C UNDER IT. On a person's screen the tile is B and, under it, the action panel C
 * (`src/app/_components/person-interactions-tile.tsx`, passed in as `footer`): „Interacțiune nouă" (`onNew`) expands
 * C on a new record and a row (`onRow`) chooses itself into C, instead of opening the module; the row chosen reads
 * selected. B keeps today's height and the tile grows by C's. „Deschide în „Interacțiuni”" still opens the module,
 * scoped. In an Incursiune there is no C and no „Interacțiune nouă" (no `onNew`): a row opens the person's screen with
 * C expanded on it (#39.05's Ask first 4).
 *
 * Slice 40.33 — SHORT WHEN EMPTY (Adrian, 2026-10-22: „An empty Interactions tile is very tall, too tall; It should
 * be as tall as the Links tile"). On a person's screen, once the history has loaded and holds no interaction, B takes
 * its content's height — the title row and „Nicio interacțiune înregistrată cu această persoană." — and the tile is
 * that plus C, held at an empty „Legături"'s 188 px (`INTERACTIONS_TILE_EMPTY_HEIGHT_PX`; it came out 136 without the
 * floor — Ask first 1). With one interaction or more B keeps today's 436 px,
 * so the tile grows to it as the first one is saved (Ask first 2). While it loads it is as tall as with rows, as before.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Paperclip, Plus } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { INTERACTIONS_TILE_EMPTY_HEIGHT_PX, INTERACTIONS_TILE_STYLE, PAGES_TILE_EMPTY_HEIGHT_PX, ROW_TILE_EMPTY_CLASS } from "@/lib/ui/field-widths";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { ChannelPill, DirectionMark, StatusPill } from "@/components/interactions/interaction-pills";
import { PAGE_MAX, type InteractionListItem } from "@/lib/interactions/model";
import { interactionsHref } from "@/lib/interactions/links";
import { TileTitle } from "./tile-title";

/** Slice #39.05: B's height inside a tile that also holds C — today's tile height less the surface's p-3 and border. */
const B_CONTENT_PX = PAGES_TILE_EMPTY_HEIGHT_PX - 26;

/**
 * Slice #38.72: `fill` — beside a list, in an „Incursiune", the tile takes the width it is given rather than its
 * fixed 40rem; since #38.75 it grows to the height the Incursiune is given (the list's), never under its own.
 * On a person's screen its height is „Pagini"'s, and the rows scroll inside it.
 *
 * Slice #39.25 — `fill` became `peek`: beside a list the tile takes the column's width and is AS TALL AS ITS ROWS —
 * empty, the row's preview's height; never above `ROW_TILE_CEILING_PX`, its rows scrolling past it (`peek.style`,
 * `rowTileStyle`). Its title line is `peek.head` — the tile's name, the record's and „Închide" — and „Deschide în
 * „Interacțiuni”" is not drawn (Adrian: „if an Open button was already on the tile, remove it").
 */
export function InteractionsTile({
  personId,
  title,
  subtitle,
  surface,
  peek,
  onNew,
  onRow,
  selectedId = null,
  footer,
}: {
  personId: string;
  title: string;
  subtitle?: string;
  surface: string;
  /** Slice #39.25: beside a list — its title line, and its heights (`rowTileStyle`). */
  peek?: { head: ReactNode; style: CSSProperties };
  /** Slice #39.05: „Interacțiune nouă" — drawn only when given (a person's screen: C expands on a new record). */
  onNew?: () => void;
  /** Slice #39.05: a row chosen — into C on a person's screen, the person's screen from an Incursiune. */
  onRow?: (id: string) => void;
  /** Slice #39.05: the row loaded into C, which reads selected. */
  selectedId?: string | null;
  /** Slice #39.05: C, under the history; B keeps its height and the tile grows. */
  footer?: ReactNode;
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
  // Slice 40.33: loaded and holding nothing — B takes its content's height instead of „Pagini"'s.
  const empty = !peek && history.isSuccess && items.length === 0;

  const head = peek ? peek.head : (
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
        {onNew && (
          <IconButton
            icon={Plus}
            label={t("interactionsNew")}
            variant="secondary"
            size="xs"
            data-interactions-new=""
            onClick={onNew}
          />
        )}
      </div>
  );
  const body = (
        <>
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
                  const chosen = selectedId === row.id;
                  return (
                    <tr
                      key={row.id}
                      tabIndex={onRow ? 0 : undefined}
                      data-person-interaction={row.id}
                      aria-selected={onRow ? chosen : undefined}
                      onClick={onRow ? () => onRow(row.id) : undefined}
                      onKeyDown={
                        onRow
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onRow(row.id);
                              }
                            }
                          : undefined
                      }
                      className={`${onRow ? "cursor-pointer hover:bg-white/60 dark:hover:bg-zinc-800/60" : ""} ${chosen ? "bg-white/80 font-medium dark:bg-zinc-800" : ""} focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus`}
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
        </>
  );
  // Slice #39.25: beside a list the rows take their own height in the tile's flow and scroll once it reaches the
  // ceiling; on a person's screen they fill the tile's fixed height, as before.
  const rows = peek || empty ? (
      <div className="min-h-0 overflow-y-auto" data-interactions-rows="">
        {body}
      </div>
  ) : (
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto" data-interactions-rows="">
          {body}
        </div>
      </div>
  );

  return (
    <section
      data-tile="interactions"
      data-panel="interactions"
      aria-label={title}
      className={peek ? `${surface} flex flex-col ${ROW_TILE_EMPTY_CLASS} has-[[data-person-interaction]]:min-h-0` : `${surface} flex flex-col`}
      style={
        peek
          ? peek.style
          : empty
            ? { ...INTERACTIONS_TILE_STYLE, minHeight: INTERACTIONS_TILE_EMPTY_HEIGHT_PX }
            : footer
              ? { ...INTERACTIONS_TILE_STYLE }
              : { ...INTERACTIONS_TILE_STYLE, height: PAGES_TILE_EMPTY_HEIGHT_PX }
      }
      data-interactions-state={empty ? "empty" : "rows"}
    >
      {footer ? (
        // Slice #39.05: B at today's height — the section's own 436 px less its p-3 and 1 px border — and C under it.
        // 40.33: empty, B is as tall as its title row and its one line.
        <div className="flex flex-col" style={empty ? undefined : { height: B_CONTENT_PX }} data-interactions-history="">
          {head}
          {rows}
        </div>
      ) : (
        <>
          {head}
          {rows}
        </>
      )}
      {footer}
    </section>
  );
}
