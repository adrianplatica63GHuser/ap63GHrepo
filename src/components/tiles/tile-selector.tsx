"use client";

/**
 * The row of checkboxes that picks a detail screen's tiles.    (Slice #37.17)
 *
 * One checkbox per tile, named by the tile's Romanian name — the name the
 * specs' `showTile(page, name)` ticks — then „Toate" (every tile) and
 * „Implicit" (the default set, the one-click way back from any arrangement).
 * The last ticked box is disabled: at least one tile always shows.
 *
 * Slice #37.20: `marked` names tiles that are NOT shown but hold something to
 * look at (a highlighted field on a Document). Their box gets a dot and a
 * title saying so. The dot sits OUTSIDE the <label>, so a marked checkbox keeps
 * exactly its tile's name — the name `showTile` ticks it by.
 *
 * Slice #38.04: `disabled` names tiles the record cannot show now, each with
 * the reason (a Property's type). Such a box is drawn unticked and disabled,
 * its label greyed and in italics, the reason its tooltip; „Toate" and
 * „Implicit" leave it alone (`useTileChoice`), and it never counts as the last
 * ticked box.
 *
 * Slice 40.41: `twoRows` (the four record screens) stands the bar on two rows — the colour groups whole, the buttons
 * at the end of the second row, the first row the longer by the least (`pickTwoRows`, tile-bar-rows.ts). The strips are
 * measured where they are drawn: a strip never wraps inside, so its boxes' widths do not depend on the row it is on,
 * and a new arrangement settles in one more render, before the paint. Too narrow for two rows, the pieces wrap in one
 * row as before, the buttons still last.
 *
 * Slice 40.40: `allUp` draws „Toate sus" left of „Toate" — on the four record screens only, not on Setări's bar nor
 * the home page's. Pressed, every tile slides up and the tile columns are evened (`allUp` in tile-positions.ts).
 *
 * Slice 40.57: `menu` (the four record screens) puts the whole bar — the two rows, the buttons and the tiles diagram
 * right of them — in a panel under the record's header, opened by the header's „Panouri" button (`tiles-menu.tsx`).
 * Closed, the panel is hidden but stays in the page, so the bar keeps its measurements and every box its state.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { HelpHint } from "@/components/help/help-hint";
import { buttonClass } from "@/lib/ui/button-styles";
import type { TileChoice } from "./use-tile-choice";
import type { TileGroup } from "@/lib/ui/tiles";
import { groupStrip } from "@/lib/ui/tile-surface";
import { barPieces, fitPieces, pickTwoRows, type BarMeasures, type BarPiece } from "@/lib/ui/tile-bar-rows";
import { TilesDiagram } from "./tiles-diagram";
import type { TilesMenu } from "./tiles-menu";

/** Slice 40.41: what the bar measured and chose — two rows, or (too narrow) its pieces in one wrapping row. */
type BarLayout = { rows: [BarPiece[], BarPiece[]] | null; pieces: BarPiece[] };

const sameLayout = (a: BarLayout | null, b: BarLayout | null): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The bar's widths, read off the strips as drawn (each `[data-tile-group]`, its children in order) — `null` before
 *  they are there. */
function measureBar(bar: HTMLElement, keys: readonly string[]): BarMeasures | null {
  const host = bar.parentElement;
  const buttons = bar.querySelector<HTMLElement>("[data-tile-bar-buttons]");
  const strips = [...bar.querySelectorAll<HTMLElement>("[data-tile-group]")];
  if (!host || !buttons || strips.length === 0) return null;
  const w = (el: Element) => el.getBoundingClientRect().width;
  const cs = getComputedStyle(strips[0]);
  const boxGap = parseFloat(cs.columnGap) || 0;
  const first = [...strips[0].children];
  const stripPad = w(strips[0]) - first.reduce((s, c) => s + w(c), 0) - boxGap * Math.max(0, first.length - 1);
  const hcs = getComputedStyle(host);
  return {
    groups: keys.map((key) => ({
      key,
      boxes: strips.filter((s) => s.dataset.tileGroup === key).flatMap((s) => [...s.children].map(w)),
    })),
    stripPad,
    boxGap,
    gap: parseFloat(getComputedStyle(bar).columnGap) || 0,
    buttons: w(buttons),
    width: host.clientWidth - (parseFloat(hcs.paddingLeft) || 0) - (parseFloat(hcs.paddingRight) || 0),
  };
}

export function TileSelector<K extends string>({
  all,
  groups,
  labels,
  choice,
  marked = [],
  extra = [],
  disabled,
  allUp = false,
  twoRows = false,
  diagram,
  menu,
}: {
  all: readonly K[];
  /**
   * Slice #37.88: the registry's groups (`groupedTiles`). Each group's boxes
   * stand in a narrow strip of its colour, in this order; the previews' boxes
   * go in „Corelate"'s, since „Corelate" opens them. Absent (the home page),
   * the boxes stand in one row as before.
   */
  groups?: readonly { group: TileGroup; tiles: readonly K[] }[];
  labels: Readonly<Record<K, string>>;
  choice: TileChoice<K>;
  /** Tiles not on screen that hold something to look at (Slice #37.20). */
  marked?: readonly K[];
  /**
   * Tiles that exist only while open — the Previzualizare tiles (Slice #37.24).
   * Each is a ticked box after the screen's own; unticking it closes the tile.
   */
  extra?: readonly { key: string; label: string; onRemove: () => void }[];
  /** Slice #38.04: tiles the record cannot show now, each with its reason (the tooltip). */
  disabled?: Readonly<Partial<Record<K, string>>>;
  /** Slice 40.40: draw „Toate sus" (the four record screens). */
  allUp?: boolean;
  /** Slice 40.41: stand the bar on two rows (the four record screens; needs `groups`). */
  twoRows?: boolean;
  /** Slice 40.42: the record kind's entity — draw the tiles diagram right of the two rows (`TilesDiagram`). */
  diagram?: string;
  /** Slice 40.57: draw the bar in the „Panouri" panel, open while `menu.open` (`useTilesMenu`). */
  menu?: TilesMenu;
}) {
  const t = useTranslations("shared.tiles");
  const isOff = (key: K): boolean => disabled?.[key] !== undefined;
  // #38.04: a disabled box is never „the last ticked box".
  const lastOne = choice.shown.filter((k) => !isOff(k)).length === 1;
  const box = (key: K) => {
    const off = isOff(key);
    const checked = choice.isShown(key) && !off;
    const isMarked = !checked && !off && marked.includes(key);
    const reason = off ? disabled?.[key] : checked && lastOne ? t("lastOne") : undefined;
    return (
      <span key={key} className="flex items-center gap-1">
      <label
        className={
          off
            ? "flex cursor-not-allowed items-center gap-1.5 text-sm font-medium italic text-fade dark:text-zinc-500"
            : "flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink dark:text-zinc-200"
        }
        title={off ? reason : undefined}
        data-tile-disabled={off ? key : undefined}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={off || (checked && lastOne)}
          title={reason}
          onChange={() => {
            if (!off) choice.toggle(key);
          }}
          className="h-4 w-4 rounded border-wire accent-cta"
        />
        {labels[key]}
      </label>
      {isMarked && (
        <span
          role="img"
          aria-label={t("marked")}
          title={t("marked")}
          data-tile-marked={key}
          className="inline-block h-2 w-2 rounded-full bg-amber-500"
        />
      )}
      </span>
    );
  };
  const extras = extra.map((x) => (
    <label key={x.key} className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink dark:text-zinc-200" data-tile-extra={x.key}>
      <input type="checkbox" checked onChange={x.onRemove} className="h-4 w-4 rounded border-wire accent-cta" />
      {x.label}
    </label>
  ));
  // Slice 40.41: the two-row bar. The keys of the groups drawn, in the registry's order.
  const two = twoRows && !!groups && groups.length > 0;
  const keys = (groups ?? []).map((g) => g.group as string);
  const barRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<BarLayout | null>(null);
  // Slice 40.57: the diagram's height in the panel, which the panel must hold (the diagram is drawn over its corner).
  const [diagramHeight, setDiagramHeight] = useState(0);
  // Slice 40.57: the panel — under the header, over the tiles, as wide as the bar was; hidden while closed.
  const panelled = (node: ReactNode): ReactNode =>
    menu ? (
      <div id={menu.panelId} hidden={!menu.open} className="relative z-30 h-0" data-tiles-panel="">
        <div className="absolute inset-x-0 top-0 rounded-md border border-card-rim bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {node}
        </div>
      </div>
    ) : (
      node
    );
  const keysSig = keys.join("|");
  // 40.98: a layout that settles. On the 119-px unit TC-DOC-01 met „Maximum update depth exceeded" here: at some panel
  // widths one row and two measure differently enough to pick each other in turn, and this effect runs after every
  // render. The layout last set is kept in a ref; a measure that would not change it, or one more in a burst, sets
  // nothing, so no render follows — the next resize measures again.
  const shownLayout = useRef<BarLayout | null>(null);
  const layoutBurst = useRef({ at: 0, n: 0 });
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!two || !bar) return;
    const keyList = keysSig.split("|");
    const measure = () => {
      const m = measureBar(bar, keyList);
      if (!m || m.width <= 0) return;
      const rows = pickTwoRows(m);
      const next: BarLayout = { rows: rows ? rows.rows : null, pieces: barPieces(m) };
      if (sameLayout(shownLayout.current, next)) return;
      const now = typeof performance === "undefined" ? Date.now() : performance.now();
      if (now - layoutBurst.current.at > 250) layoutBurst.current = { at: now, n: 0 };
      layoutBurst.current.n += 1;
      if (layoutBurst.current.n > 8) return;
      shownLayout.current = next;
      setLayout(next);
    };
    measure();
    // jsdom (jest) has no layout and no ResizeObserver: the first measure stands there.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (bar.parentElement) observer.observe(bar.parentElement);
    for (const el of bar.querySelectorAll("[data-tile-group] > *, [data-tile-bar-buttons]")) observer.observe(el);
    return () => observer.disconnect();
  });

  const buttonsGroup = (
    <span className="my-1 flex items-center gap-2" data-tile-bar-buttons="" data-bar-row={two && layout?.rows ? "2" : ""}>
      {/* Slice #37.23 — what the choice does and where it is kept. The text is
          Adrian's, in Texte de ajutor; until he writes it the hint draws nothing. */}
      <HelpHint hintKey="tile-selector" />
      {allUp && (
        <button type="button" onClick={choice.allUp} className={buttonClass({ variant: "secondary", size: "sm" })} data-tiles-all-up="">
          {t("allUp")}
        </button>
      )}
      <button type="button" onClick={choice.showAll} className={buttonClass({ variant: "secondary", size: "sm" })}>
        {t("all")}
      </button>
      <button type="button" onClick={choice.reset} className={buttonClass({ variant: "secondary", size: "sm" })}>
        {t("defaults")}
      </button>
    </span>
  );

  if (two && groups) {
    // A group's items: its boxes, and — „Corelate" — the open previews' boxes after them.
    const itemsOf = (key: string): ReactNode[] => {
      const g = groups.find((x) => x.group === key);
      return g ? [...g.tiles.map(box), ...(key === "related" ? extras : [])] : [];
    };
    // `row`: which of the two rows the piece is on ("" while the bar wraps) — read by the measuring and the specs.
    const piece = (row: string, p: BarPiece) => (
      <span key={`${p.key}:${p.from}`} className={`my-1 ${groupStrip(p.key as TileGroup, true)}`} data-tile-group={p.key} data-bar-row={row}>
        {itemsOf(p.key).slice(p.from, p.to)}
      </span>
    );
    const loose = !groups.some((g) => g.group === "related") ? extras : null;
    const counts = Object.fromEntries(keys.map((key) => [key, itemsOf(key).length]));
    const whole: BarPiece[] = keys.map((key) => ({ key, from: 0, to: counts[key] }));
    const [row1, row2] = layout?.rows ? fitPieces(layout.rows, counts) : [[], []];
    const [flat] = layout ? fitPieces([layout.pieces], counts) : [whole];
    // Slice 40.42: a box's group — a panel `tile#n` its tile's, a preview „Corelate"'s.
    const groupOf = (id: string): TileGroup | null => {
      if (id.startsWith("preview")) return "related";
      const tile = id.replace(/#\d+$/, "");
      return groups.find((g) => (g.tiles as readonly string[]).includes(tile))?.group ?? null;
    };
    // ONE wrapping container in both modes, the two rows parted by a line break of no height (`basis-full`), so a new
    // arrangement only moves keyed pieces and never remounts the buttons — a click landing while the bar settles is
    // a click (TC-TILES-18 found one lost when the buttons moved from one row's element to another's). The pieces'
    // `my-1` is the 8 px between the rows; the break adds none.
    const twoUp = !!layout?.rows;
    const barEl = (
      <div role="group" aria-label={t("groupLabel")} ref={barRef} className="flex max-w-full flex-wrap items-center gap-x-4" data-tile-selector data-tile-rows={twoUp ? "2" : "wrap"}>
        {/* One keyed array, the break inside it: a piece changing rows moves, it is not drawn anew. */}
        {twoUp
          ? [...row1.map((p) => piece("1", p)), <span key="break" aria-hidden="true" className="h-0 basis-full" data-tile-bar-break="" />, ...row2.map((p) => piece("2", p))]
          : flat.map((p) => piece("", p))}
        {loose}
        {buttonsGroup}
      </div>
    );
    if (!diagram) return panelled(barEl);
    return panelled(
      <div className="relative" style={diagramHeight > 0 ? { minHeight: diagramHeight } : undefined} data-tile-bar-wrap="">
        {barEl}
        <TilesDiagram entity={diagram} groupOf={groupOf} onHeight={setDiagramHeight} />
      </div>,
    );
  }

  return panelled(
    <div role="group" aria-label={t("groupLabel")} className="flex flex-wrap items-center gap-x-4 gap-y-2" data-tile-selector>
      {groups ? (
        groups.map(({ group, tiles }) => (
          <span key={group} className={groupStrip(group)} data-tile-group={group}>
            {tiles.map(box)}
            {group === "related" && extras}
          </span>
        ))
      ) : (
        <>
          {all.map(box)}
          {extras}
        </>
      )}
      {groups && !groups.some((g) => g.group === "related") && extras}
      {buttonsGroup}
    </div>,
  );
}
