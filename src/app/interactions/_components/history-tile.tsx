"use client";

import Link from "next/link";

import { useMemo, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpDown,
  ArrowUpNarrowWide,
  CalendarClock,
  CalendarDays,
  Download,
  ChevronDown,
  FileText,
  Funnel,
  FunnelX,
  History,
  Paperclip,
  RotateCw,
  SquarePen,
} from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { buttonClass } from "@/lib/ui/button-styles";
import { useSessionValue } from "@/lib/ui/use-session-value";
import { useNameOr } from "@/components/record/use-name-or";
import { personBase, personLogHref } from "@/lib/interactions/links";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { PaginationControls } from "@/components/pagination-controls";
import { INTERACTION_COLUMN_MIN_REM, INTERACTION_COLUMN_REM, rem } from "@/lib/ui/field-widths";
import {
  HISTORY_COLUMNS,
  columnFiltered,
  flipDateOrder,
  isFiltered,
  orderBy,
  rangeOf,
  readWidths,
  type HistoryColumn,
  type InteractionFilters,
  type InteractionOrder,
} from "@/lib/interactions/filters";
import type { InteractionListItem, InteractionRecord } from "@/lib/interactions/model";
import { HOVER_ROW, MODULE_CARD, SELECTED_BAR, SELECTED_ROW } from "@/lib/interactions/palette";
import { ChannelPill, DirectionMark, StatusPill } from "@/components/interactions/interaction-pills";
import {
  ChannelChips,
  ChannelChoices,
  DirectionChoices,
  DirectionSegments,
  DocumentsChoices,
  PersonPicker,
  Pop,
  RangeChoices,
  StatusChoices,
  SubjectContains,
  type FiltersChange,
} from "./filter-controls";

/** The column widths, kept for the browser session (§3: the user can resize them). */
const WIDTHS_KEY = "ga.interactions.columnWidths";
/** How many rows the skeleton draws while the history loads (§3: skeleton rows, never a spinner). */
const SKELETON_ROWS = 6;

export interface HistoryPage {
  items: InteractionListItem[];
  total: number;
  needsReply: number;
  anyLogged: boolean;
}

export interface HistoryTileProps {
  filters: InteractionFilters;
  onFilters: FiltersChange;
  order: InteractionOrder;
  onOrder: (next: InteractionOrder) => void;
  onReset: () => void;
  scope: string | null;
  scopeName: string | null;
  onScope: (personId: string | null) => void;
  data: HistoryPage | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The empty log's „Înregistrează prima interacțiune" — drawn only where there is a form to go to (none on A, #39.06). */
  onLogFirst?: () => void;
  /** A row just saved, flashing once where it landed (38.85). */
  flashId: string | null;
  /** „Exportă" (38.88): the rows these filters show, in this order, as a file. */
  onExport: () => void;
}

/** One interaction, whole — the popover's documents and the selected row's description. */
export function useInteraction(id: string | null) {
  return useQuery<InteractionRecord>({
    queryKey: ["interaction", id],
    enabled: id !== null,
    queryFn: async () => {
      const res = await fetch(`/api/interactions/${encodeURIComponent(id as string)}`);
      if (!res.ok || res.redirected) throw new Error(`interaction ${res.status}`);
      return (await res.json()) as InteractionRecord;
    },
  });
}

/**
 * Tile one — „Istoricul interacțiunilor" (§3).   (Slice #38.84)
 *
 * VIEW-ONLY: no editor in a cell. A click selects the row (it loads into the right-hand tile from 38.87); the
 * paperclip count opens the record's documents in a small popover, each opening the archive's document through the
 * guarded navigation. The description is not a column: it shows as a line under the subject of the selected row.
 */
export function HistoryTile(props: HistoryTileProps) {
  const { filters, onFilters, order, onOrder, onReset, scope, scopeName, onScope, data } = props;
  const t = useTranslations("interactions");
  const locale = useLocale();
  const [widthsRaw, setWidthsRaw] = useSessionValue(WIDTHS_KEY);
  const widths = useMemo(() => readWidths(widthsRaw, INTERACTION_COLUMN_REM, INTERACTION_COLUMN_MIN_REM), [widthsRaw]);
  const tableRem = HISTORY_COLUMNS.reduce((sum, c) => sum + widths[c], 0);

  const day = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }), [locale]);
  const time = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }), [locale]);
  const range = rangeOf(filters, new Date());
  const rangeText = range.to
    ? t("toolbar.between", { from: day.format(range.from ?? range.to), to: day.format(range.to) })
    : range.from
      ? t("toolbar.since", { from: day.format(range.from) })
      : t("toolbar.always");

  const sortWord =
    order.sort === "occurredAt"
      ? order.order === "desc"
        ? t("toolbar.newest")
        : t("toolbar.oldest")
      : t("toolbar.sortedBy", { column: t(`column.${order.sort}`) });

  const filterOf: Record<HistoryColumn, ReactNode> = {
    occurredAt: <RangeChoices filters={filters} onChange={onFilters} />,
    channel: <ChannelChoices filters={filters} onChange={onFilters} />,
    direction: <DirectionChoices filters={filters} onChange={onFilters} />,
    person: <PersonPicker personId={scope} personName={scopeName} onPick={onScope} />,
    subject: <SubjectContains filters={filters} onChange={onFilters} />,
    documents: <DocumentsChoices filters={filters} onChange={onFilters} />,
    status: <StatusChoices filters={filters} onChange={onFilters} />,
  };

  return (
    <section aria-labelledby="interactions-history-title" data-interactions-history="" className={`${MODULE_CARD} flex min-w-0 flex-col gap-4 p-4`}>
      <h2 id="interactions-history-title" className="flex items-center gap-2 text-lg font-semibold text-ink dark:text-zinc-100">
        <History aria-hidden="true" size={20} className="text-[#3b5bdb] dark:text-[#768ce6]" />
        {t("screen.historyTitle")}
      </h2>

      {/* The toolbar (§3): the fast path. */}
      <div className="flex flex-col gap-3" data-history-toolbar="">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col gap-1">
            <Pop
              label={t("toolbar.range")}
              trigger={(open, toggle) => (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-haspopup="dialog"
                  data-range-trigger=""
                  onClick={toggle}
                  className={buttonClass({ variant: "secondary", size: "md", className: "gap-2" })}
                >
                  <CalendarDays aria-hidden="true" size={16} /> {t(`toolbar.preset.${filters.preset}`)} · {rangeText} <ChevronDown aria-hidden="true" size={16} />
                </button>
              )}
            >
              <RangeChoices filters={filters} onChange={onFilters} />
            </Pop>
            <p className="text-xs text-fade dark:text-zinc-400">{t("toolbar.rangeHint")}</p>
          </div>
          <ChannelChips filters={filters} onChange={onFilters} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DirectionSegments filters={filters} onChange={onFilters} />
          <PersonPicker personId={scope} personName={scopeName} onPick={onScope} />
          <IconButton
            icon={order.sort === "occurredAt" && order.order === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow}
            label={sortWord}
            showLabel
            variant="secondary"
            size="md"
            data-sort-control=""
            onClick={() => onOrder(flipDateOrder(order))}
          />
          {isFiltered(filters) && (
            <IconButton icon={FunnelX} label={t("toolbar.clear")} showLabel variant="ghost" size="md" data-clear-filters="" onClick={onReset} />
          )}
          {/* §3: „Export, secondary" — at the toolbar's end. */}
          <IconButton
            icon={Download}
            label={t("toolbar.export")}
            showLabel
            variant="secondary"
            size="md"
            className="ml-auto"
            data-export=""
            disabled={!data || data.total === 0}
            onClick={props.onExport}
          />
        </div>
      </div>

      {/* The grid (§3). */}
      <div className="max-w-full overflow-x-auto" data-history-frame="">
        <table
          className="table-fixed border-separate border-spacing-0 text-sm"
          style={{ width: `max(100%, ${rem(tableRem)})` }}
          aria-busy={props.isPending}
          data-history-grid=""
        >
          <colgroup>
            {HISTORY_COLUMNS.map((c) => (
              // The subject takes what the others leave, never less than its own width (§3: it truncates).
              <col key={c} data-col={c} style={c === "subject" ? undefined : { width: rem(widths[c]) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {HISTORY_COLUMNS.map((c) => (
                <HeaderCell
                  key={c}
                  column={c}
                  label={t(`column.${c}`)}
                  order={order}
                  onOrder={onOrder}
                  filtered={columnFiltered(filters, c, scope)}
                  filter={filterOf[c]}
                  width={widths[c]}
                  onWidth={(w) => setWidthsRaw(JSON.stringify({ ...widths, [c]: w }))}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {props.isPending
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={i} data-skeleton-row="">
                    {HISTORY_COLUMNS.map((c) => (
                      <td key={c} className="border-b border-slate-100 px-2 py-3 dark:border-zinc-800">
                        <span className="block h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                      </td>
                    ))}
                  </tr>
                ))
              : (data?.items ?? []).map((row) => (
                  <HistoryRow
                    key={row.id}
                    row={row}
                    day={day.format(new Date(row.occurredAt))}
                    time={time.format(new Date(row.occurredAt))}
                    selected={row.id === props.selectedId}
                    flash={row.id === props.flashId}
                    followUp={row.followUpOn ? day.format(new Date(`${row.followUpOn}T12:00:00`)) : null}
                    onSelect={() => props.onSelect(row.id)}
                  />
                ))}
          </tbody>
        </table>
      </div>

      {props.isError && (
        <div role="alert" data-history-error="" className="flex flex-wrap items-center gap-3 text-sm text-ink dark:text-zinc-100">
          {t("screen.error")}
          <IconButton icon={RotateCw} label={t("screen.retry")} showLabel variant="secondary" size="sm" onClick={props.onRetry} />
        </div>
      )}
      {!props.isPending && !props.isError && data && data.items.length === 0 && (
        <div data-history-empty={data.anyLogged ? "filtered" : "log"} className="flex flex-col items-start gap-3 py-6 text-sm text-ink dark:text-zinc-100">
          {data.anyLogged ? (
            <>
              <p>{t("screen.emptyFiltered")}</p>
              <IconButton icon={FunnelX} label={t("toolbar.clear")} showLabel variant="secondary" size="md" onClick={onReset} />
            </>
          ) : (
            <>
              <p>{t("screen.emptyLog")}</p>
              {props.onLogFirst && (
                <IconButton icon={SquarePen} label={t("screen.logFirst")} showLabel variant="secondary" size="md" onClick={props.onLogFirst} />
              )}
            </>
          )}
        </div>
      )}

      <PaginationControls
        page={props.page}
        total={data?.total ?? 0}
        pageSize={props.pageSize}
        onPrev={() => props.onPage(Math.max(0, props.page - 1))}
        onNext={() => props.onPage(props.page + 1)}
      />
    </section>
  );
}

/** A column's header: its name, its sort and its filter (§3), and an edge that drags its width. */
function HeaderCell({
  column,
  label,
  order,
  onOrder,
  filtered,
  filter,
  width,
  onWidth,
}: {
  column: HistoryColumn;
  label: string;
  order: InteractionOrder;
  onOrder: (next: InteractionOrder) => void;
  filtered: boolean;
  filter: ReactNode;
  width: number;
  onWidth: (w: number) => void;
}) {
  const t = useTranslations("interactions");
  const drag = useRef<{ x: number; w: number } | null>(null);
  const sorted = order.sort === column;
  const SortIcon = !sorted ? ArrowUpDown : order.order === "asc" ? ArrowUp : ArrowDown;
  const clamp = (w: number) => Math.round(Math.max(INTERACTION_COLUMN_MIN_REM, Math.min(w, 60)) * 4) / 4;

  const down = (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    drag.current = { x: e.clientX, w: width };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return;
    const px = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    onWidth(clamp(drag.current.w + (e.clientX - drag.current.x) / px));
  };
  const up = () => {
    drag.current = null;
  };
  const key = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      onWidth(clamp(width + (e.key === "ArrowRight" ? 0.5 : -0.5)));
    }
  };

  return (
    <th
      scope="col"
      data-column={column}
      aria-sort={sorted ? (order.order === "asc" ? "ascending" : "descending") : "none"}
      className="relative border-b border-slate-200 px-2 py-2 text-left font-medium text-slate-600 dark:border-zinc-700 dark:text-zinc-300"
    >
      <div className="flex items-center gap-0.5">
        <span className="min-w-0 truncate">{label}</span>
        <IconButton
          icon={SortIcon}
          label={t("sortBy", { column: label })}
          variant={sorted ? "ghost" : "bare"}
          size="xs"
          data-sort-column={column}
          onClick={() => onOrder(orderBy(order, column))}
        />
        <Pop
          label={t("columnFilter", { column: label })}
          align={column === "status" || column === "documents" ? "right" : "left"}
          trigger={(open, toggle) => (
            <IconButton
              icon={Funnel}
              label={t("columnFilter", { column: label })}
              variant={filtered ? "ghost" : "bare"}
              size="xs"
              aria-expanded={open}
              data-filter-column={column}
              data-active={filtered ? "" : undefined}
              onClick={toggle}
            />
          )}
        >
          {filter}
        </Pop>
      </div>
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={t("resize", { column: label })}
        aria-valuenow={width}
        aria-valuemin={INTERACTION_COLUMN_MIN_REM}
        aria-valuemax={60}
        tabIndex={0}
        data-resize-column={column}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        className="absolute right-0 top-1 bottom-1 w-1.5 cursor-col-resize touch-none rounded-sm hover:bg-slate-300 focus-visible:bg-[#3b5bdb] focus-visible:outline-none dark:hover:bg-zinc-600"
      />
    </th>
  );
}

/** One interaction in the grid — selectable, never editable in place (§3, §8.1). */
function HistoryRow({
  row,
  day,
  time,
  selected,
  flash,
  followUp,
  onSelect,
}: {
  row: InteractionListItem;
  day: string;
  time: string;
  selected: boolean;
  flash: boolean;
  followUp: string | null;
  onSelect: () => void;
}) {
  const t = useTranslations("interactions");
  const nameOr = useNameOr();
  const { guardedNavigate } = useUnsavedChanges();
  const record = useInteraction(selected ? row.id : null);
  const cell = "border-b border-slate-100 px-2 py-2 align-middle dark:border-zinc-800";
  const name = nameOr(row.personName, "person");
  // Slice #39.06: the person's screen, by the row's type, with C expanded on a new record.
  const personHref = personLogHref(personBase(row.personType), row.personId);
  return (
    <tr
      tabIndex={0}
      aria-selected={selected}
      data-interaction-row={row.id}
      data-flash={flash ? "" : undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${selected ? SELECTED_ROW : HOVER_ROW}${flash ? " ga-row-flash" : ""}`}
    >
      <td className={`${cell} ${selected ? SELECTED_BAR : ""}`}>
        <div className="whitespace-nowrap">{day}</div>
        <div className="whitespace-nowrap text-xs text-fade dark:text-zinc-400">{time}</div>
      </td>
      <td className={cell}>
        <ChannelPill channel={row.channel} />
      </td>
      <td className={cell}>
        <DirectionMark direction={row.direction} />
      </td>
      <td className={cell}>
        {/* Slice #39.06: the name is a real link — a new tab works — that does not select the row. */}
        <div className="truncate" title={name}>
          <Link
            href={personHref}
            data-person-link={row.personId}
            className="text-[#3b5bdb] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus dark:text-[#768ce6]"
            onClick={(e) => {
              e.stopPropagation();
              // A plain click asks about unsaved work first, through the app's guard; Ctrl+click is the browser's.
              if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              guardedNavigate(personHref);
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {name}
          </Link>
        </div>
      </td>
      <td className={cell}>
        <div className="truncate" title={row.subject} data-subject="">
          {row.subject}
        </div>
        {selected && (
          <div className="truncate text-xs text-fade dark:text-zinc-400" data-description-preview="" title={record.data?.description ?? undefined}>
            {record.isPending ? "…" : (record.data?.description ?? t("screen.noDescription"))}
          </div>
        )}
      </td>
      <td className={cell}>{row.documentCount > 0 && <DocumentsCount interactionId={row.id} count={row.documentCount} />}</td>
      <td className={`${cell} relative`}>
        <StatusPill status={row.status} />
        {/* 38.85 (Ask first #4): the follow-up's date is kept and shown here; nothing notifies. */}
        {followUp && (
          <span className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-xs text-fade dark:text-zinc-400" data-follow-up="" title={t("screen.followUp", { date: followUp })}>
            <CalendarClock aria-hidden="true" size={12} />
            {followUp}
          </span>
        )}
        {/* Under the pill, out of the flow, so the pill stays in the row's middle like its neighbours. */}
        {!selected && !followUp && (
          <span className="invisible absolute bottom-0.5 left-2 whitespace-nowrap text-xs text-fade group-hover:visible dark:text-zinc-400" data-select-hint="">
            {t("screen.selectHint")}
          </span>
        )}
      </td>
    </tr>
  );
}

/** The paperclip and its count (§3): opens the linked documents in a small popover, without leaving the module. */
function DocumentsCount({ interactionId, count }: { interactionId: string; count: number }) {
  const t = useTranslations("interactions");
  const label = t("screen.docsCount", { count });
  return (
    // The popover's presses are its own: they do not select the row under it.
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Pop
        label={label}
        align="right"
        trigger={(open, toggle) => (
          <button
            type="button"
            title={label}
            aria-label={label}
            aria-expanded={open}
            aria-haspopup="dialog"
            data-documents-count={count}
            onClick={toggle}
            className={buttonClass({ variant: "ghost", size: "xs", className: "gap-1" })}
          >
            <Paperclip aria-hidden="true" size={14} />
            {count}
          </button>
        )}
      >
        <DocumentsList interactionId={interactionId} />
      </Pop>
    </div>
  );
}

function DocumentsList({ interactionId }: { interactionId: string }) {
  const t = useTranslations("interactions");
  const nameOr = useNameOr();
  const { guardedNavigate } = useUnsavedChanges();
  const record = useInteraction(interactionId);
  if (record.isPending) return <p className="text-fade dark:text-zinc-400">{t("screen.docsLoading")}</p>;
  if (record.isError || !record.data) return <p role="alert">{t("screen.error")}</p>;
  return (
    <ul className="flex flex-col gap-0.5" data-documents-popover="">
      {record.data.documents.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => guardedNavigate(`/documents/${d.id}`)}
            className={buttonClass({ variant: "bare", size: "sm", className: "gap-2 hover:underline" })}
          >
            <FileText aria-hidden="true" size={16} />
            {nameOr(d.title, "document")}
          </button>
        </li>
      ))}
    </ul>
  );
}
