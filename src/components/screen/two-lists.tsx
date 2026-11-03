"use client";

/**
 * TWO LISTS AND THE BUTTONS BETWEEN THEM.                                                         (Slice 41.42)
 *
 * Adrian, 2026-11-01: „I would like to have the “in Group already” and “members available to include” tiles as one tile
 * with 2 lists on the left and on the right (with vertical scroll bars) and between the lists there should be buttons to
 * include the checked items from the right (members available to include) to the left (in Group already); Double
 * clicking an element in either list should move it to the other list; everything I said in this paragraph about groups
 * should apply similarly to the stamps".
 *
 * The left list is what the record holds (a group's members, a stamp's stamped items), the right one what may join it.
 * Each list is a region named by its heading, which carries its count; each scrolls after `TWO_LIST_ROWS` rows. The
 * buttons between them move the checked rows — „‹ …" right to left, „… ›" left to right — each with its count and
 * disabled while nothing is checked. A double-click on a row moves that row, and Enter on a focused row does the same
 * from the keyboard. The ticks are this component's; what is in which list is the caller's (`onInclude`, `onTakeOut`),
 * which keeps the moves pending until its own „Salvează" — a moved row comes back with `pending` and is marked.
 *
 * The headings are not heading elements: inside a tile, only TileTitle writes one (tile-heading-one-piece).
 *
 * 41.43 — a stamp's records: `head` stands above both lists („Tip element", which chooses what both show), and the
 * buttons carry the icons the catalogue gives their action (#37.46: ListPlus / ListMinus for a group's members — A083,
 * kept from the buttons they replace — Stamp / Eraser for a stamp's — A080, A081).
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/lib/ui/icon-button";

/** Rows a list shows before it scrolls (41.42 Ask first 2). */
export const TWO_LIST_ROWS = 12;
/** One row's height, in rem: `h-8`. */
export const TWO_LIST_ROW_REM = 2;
/**
 * 41.58, Adrian: „the list on the left should not be sized to hold only 12 items just like the list on the right — It
 * should be sized to have similar gaps up and down to the tile edges". So both frames take ONE fixed height — the
 * heading, a toolbar's band and twelve rows — and a side with no toolbar gives that band to its rows. A height, not a
 * max-height: the frames are equal however few rows each holds, and the tile never jumps as items move.
 */
/** The heading row, in rem: `py-1.5` around a 20-px line, and its 1-px rule (33 px). */
export const TWO_LIST_HEAD_REM = 2.0625;
/** A toolbar's band, in rem: `p-2` around a 34-px search box, and its 1-px rule (51 px). */
export const TWO_LIST_TOOLBAR_REM = 3.1875;
/** The frame's whole inner height, in rem — the same on both sides, toolbar or not. */
export const TWO_LIST_FRAME_REM = TWO_LIST_HEAD_REM + TWO_LIST_TOOLBAR_REM + TWO_LIST_ROWS * TWO_LIST_ROW_REM;
/** Each list's width in units (41.42 Ask first 2); the tile is `TWO_LISTS_UNITS` (screen-tiles.ts). */
export const TWO_LIST_UNITS = 3;

export type TwoListRow = {
  id: string;
  label: string;
  /** At the row's right, in the mono face — a member's position, „[01]". */
  note?: string;
  /** Moved and not yet saved: marked „în așteptare". */
  pending?: boolean;
};

export type TwoListSide = {
  /** `data-two-list`, for the tests. */
  name: string;
  /** The list's heading — also the region's name. */
  title: ReactNode;
  rows: readonly TwoListRow[];
  /** What the list says while it is empty. */
  empty: string;
  /** Above the list: a search box. */
  toolbar?: ReactNode;
  /** Beside the heading: a „?" (HelpHint). */
  hint?: ReactNode;
};

const kept = (set: ReadonlySet<string>, rows: readonly TwoListRow[]): Set<string> => {
  const ids = new Set(rows.map((r) => r.id));
  return new Set([...set].filter((id) => ids.has(id)));
};

export function TwoLists({
  left,
  right,
  includeLabel,
  takeOutLabel,
  onInclude,
  onTakeOut,
  head,
  includeIcon: IncludeIcon,
  takeOutIcon: TakeOutIcon,
}: {
  /** 41.43: above both lists — a control that chooses what they show. */
  head?: ReactNode;
  /** The catalogue's icon for the action (#37.46): ListPlus / Stamp. The buttons are IconButtons, icon and words. */
  includeIcon: LucideIcon;
  /** ListMinus / Eraser. */
  takeOutIcon: LucideIcon;
  left: TwoListSide;
  right: TwoListSide;
  /** „‹ Include (n)" — the right's checked rows go left. */
  includeLabel: (count: number) => string;
  /** „Scoate › (n)" — the left's checked rows go right. */
  takeOutLabel: (count: number) => string;
  onInclude: (ids: string[]) => void;
  onTakeOut: (ids: string[]) => void;
}) {
  const [tickedLeft, setTickedLeft] = useState<ReadonlySet<string>>(() => new Set());
  const [tickedRight, setTickedRight] = useState<ReadonlySet<string>>(() => new Set());
  // A tick on a row that has left its list (moved, saved, filtered out by the search) no longer counts.
  const checkedLeft = useMemo(() => kept(tickedLeft, left.rows), [tickedLeft, left.rows]);
  const checkedRight = useMemo(() => kept(tickedRight, right.rows), [tickedRight, right.rows]);

  const include = (ids: string[]) => {
    if (ids.length === 0) return;
    onInclude(ids);
    setTickedRight((s) => new Set([...s].filter((id) => !ids.includes(id))));
  };
  const takeOut = (ids: string[]) => {
    if (ids.length === 0) return;
    onTakeOut(ids);
    setTickedLeft((s) => new Set([...s].filter((id) => !ids.includes(id))));
  };

  const grid = (
    <div className="grid items-start gap-2" style={{ gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)" }} data-two-lists="">
      <TwoList side={left} checked={checkedLeft} setChecked={setTickedLeft} move={(id) => takeOut([id])} />
      <div className="flex w-[6.5rem] flex-col gap-2 self-center" data-two-list-buttons="">
        <IconButton
          icon={IncludeIcon}
          label={includeLabel(checkedRight.size)}
          showLabel
          variant="primary"
          size="sm"
          className="whitespace-normal leading-tight"
          disabled={checkedRight.size === 0}
          onClick={() => include([...checkedRight])}
          data-two-list-include=""
        />
        <IconButton
          icon={TakeOutIcon}
          label={takeOutLabel(checkedLeft.size)}
          showLabel
          variant="secondary"
          size="sm"
          className="whitespace-normal leading-tight"
          disabled={checkedLeft.size === 0}
          onClick={() => takeOut([...checkedLeft])}
          data-two-list-take-out=""
        />
      </div>
      <TwoList side={right} checked={checkedRight} setChecked={setTickedRight} move={(id) => include([id])} />
    </div>
  );
  if (!head) return grid;
  return (
    <div className="flex flex-col gap-2">
      <div data-two-list-head="">{head}</div>
      {grid}
    </div>
  );
}

function TwoList({
  side,
  checked,
  setChecked,
  move,
}: {
  side: TwoListSide;
  checked: ReadonlySet<string>;
  setChecked: (next: ReadonlySet<string>) => void;
  move: (id: string) => void;
}) {
  const t = useTranslations("shared.twoLists");
  const titleId = useId();
  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };
  return (
    <section
      aria-labelledby={titleId}
      data-two-list={side.name}
      className="flex min-w-0 flex-col rounded-md border border-card-rim bg-white dark:border-zinc-800 dark:bg-zinc-950"
      // 41.58: the frame's height, its 1-px border on either side included — equal for both lists.
      style={{ height: `calc(${TWO_LIST_FRAME_REM}rem + 2px)` }}
      data-two-list-frame=""
    >
      <div
        className="flex shrink-0 items-center gap-1.5 border-b border-card-rim px-3 dark:border-zinc-800"
        style={{ height: `${TWO_LIST_HEAD_REM}rem` }}
      >
        <span id={titleId} className="min-w-0 truncate text-sm font-semibold text-ink dark:text-zinc-100">
          {side.title}
        </span>
        {side.hint}
        <span className="ml-auto text-xs text-fade dark:text-zinc-400" data-two-list-count="">
          {side.rows.length}
        </span>
      </div>
      {side.toolbar && (
        <div
          className="flex shrink-0 items-center border-b border-card-rim px-2 dark:border-zinc-800"
          style={{ height: `${TWO_LIST_TOOLBAR_REM}rem` }}
        >
          {side.toolbar}
        </div>
      )}
      {/* Twelve rows under a toolbar; with none, its band too (41.58) — the rest of the frame, by flex. */}
      <ul
        className="min-h-0 flex-1 divide-y divide-crease overflow-y-auto dark:divide-zinc-800"
        data-two-list-rows=""
      >
        {side.rows.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-fade">{side.empty}</li>
        ) : (
          side.rows.map((row) => (
            <li
              key={row.id}
              title={t("moveHint")}
              data-two-list-row={row.id}
              data-pending={row.pending ? "" : undefined}
              onDoubleClick={() => move(row.id)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                move(row.id);
              }}
              className={`flex h-8 select-none items-center gap-2 px-3 text-sm hover:bg-cta-pale dark:hover:bg-zinc-800/50${row.pending ? " bg-amber-50/60 dark:bg-amber-950/30" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked.has(row.id)}
                onChange={() => toggle(row.id)}
                aria-label={row.label}
                className="h-4 w-4 shrink-0 rounded border-wire accent-cta"
              />
              <span className="min-w-0 flex-1 truncate text-ink dark:text-zinc-200">{row.label}</span>
              {row.pending && <span className="shrink-0 text-xs italic text-amber-800 dark:text-amber-300">{t("pending")}</span>}
              {row.note && <span className="shrink-0 font-mono text-xs text-fade dark:text-zinc-400">{row.note}</span>}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
