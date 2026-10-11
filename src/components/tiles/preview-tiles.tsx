"use client";

/**
 * A related record, open in a tile beside the one on screen.   (Slice #37.24)
 *
 * From any association tile, „Previzualizare" opens the related record in a
 * Previzualizare tile — since #37.75 right under the tile it was pressed in
 * (`@/lib/ui/tile-packing`), before at the end of the tile row: a sales contract and its
 * buyer, a parcel and its title deed, on screen together in ONE window.
 * #37.21's new-tab link does the same across two windows.
 *
 * ⚠️ **A PREVIEW NEVER CHANGES DATA.** It shows the record's main fields as
 * text, with „Deschide" (a link to the record, read-only, as „Vizualizare"
 * opens it) and „Închide" — and nothing else: no box, no „Modifică", no
 * „Fă curentă", no associate or dissociate control. It reads the record's own
 * GET route and imports none of the forms; `preview-tiles.test.tsx` holds it to
 * both. A save of that record in another window refetches it by itself:
 * `RecordSyncProvider` refetches every query but the version lists (#37.21).
 *
 * ⚠️ **UNSAVED WORK IS NEVER PUT AT RISK.** Opening, closing or replacing a
 * preview is state of this screen only: it does not navigate, so the form
 * beside it and its „Modificări nesalvate" banner are untouched.
 *
 * A TILE LIKE ANY OTHER (#37.17), ON THE UNIT (#37.33): a person, a company or
 * a property is 3 units, like the first panel of its screen; a document is 4,
 * the Pagini panel's width, its general data above its first page. Its fields
 * sit as on the record's screen — labels above, in the screen's rows and at
 * its widths (`PREVIEW_ROWS`, `PREVIEW_WIDTHS`). While open it has a ticked box in the tile row
 * (`TileSelector`'s `extra`) — unticking it closes it. At most two are open
 * (`@/lib/ui/previews`); a third replaces the oldest.
 */
import { useNameOr } from "@/components/record/use-name-or";
import type { UnnamedKind } from "@/lib/ui/unnamed";
import { createContext, useCallback, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { Search } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { PreviewTileBody, type PreviewField } from "./preview-tile-body";
import { loadPreview } from "./preview-data";
import { PAGES_PANEL_REM, PREVIEW_LINES, PREVIEW_ROWS, PREVIEW_WIDTHS, rem, type PreviewKind, type PreviewLinesKind } from "@/lib/ui/field-widths";
import { nextPreviews, previewHref, previewKey, type PreviewTarget } from "@/lib/ui/previews";
import { NO_ROW_TILES, closeRowTile, isLocked, isRowTileOpen, toggleRowTile, type RowTile, type RowTiles } from "@/lib/ui/row-tiles";
import { IncursionContext, type Incursion, type IncursionTileComponent } from "./incursion-context";

// ── Which previews are open ───────────────────────────────────────────────────

export interface Previews {
  open: readonly PreviewTarget[];
  show: (target: PreviewTarget) => void;
  close: (key: string) => void;
}

/** A detail screen's open previews. Not stored: a reload closes them. */
export function usePreviews(): Previews {
  const [open, setOpen] = useState<readonly PreviewTarget[]>([]);
  const show = useCallback((target: PreviewTarget) => setOpen((prev) => nextPreviews(prev, target)), []);
  const close = useCallback((key: string) => setOpen((prev) => prev.filter((p) => previewKey(p) !== key)), []);
  return useMemo(() => ({ open, show, close }), [open, show, close]);
}

/** Slice #38.71: the whole set, not only `show` — a magnifier is pressed while its preview is open, and closes it. */
const OpenerContext = createContext<Previews | null>(null);

/** Lets the association tiles inside a detail screen open previews on it. */
export function PreviewOpenerProvider({ previews, children }: { previews: Previews; children: ReactNode }) {
  return <OpenerContext.Provider value={previews}>{children}</OpenerContext.Provider>;
}

/**
 * „Previzualizare" on an association row or a list row. Drawn only inside a
 * detail screen or a list that shows previews (`ListPreviews`, #37.25);
 * anywhere else it is absent.
 *
 * Slice #38.71: a MAGNIFIER, and a TOGGLE. It was the eye (#37.42, A017); Adrian gave the eye a new job on the
 * lists, „Incursiune" (#38.72), so the preview takes the magnifier — everywhere it is drawn, the association tiles
 * included (Ask first #1), so the eye never means „Previzualizare". Pressed, it opens its row's preview and is
 * drawn pressed — the navy fill with a white icon, the app's look for a chosen item (Ask first #2) — and says so in
 * words too (`aria-pressed`; its name stays „Previzualizare"). Pressed again, it closes that preview. It is
 * pressed exactly while its preview is open, so when a third preview replaces the oldest, the oldest row's
 * magnifier is released with it (Ask first #3), and „Închide" on the tile releases it as well.
 */
export function PreviewButton({ target }: { target: PreviewTarget }) {
  const previews = useContext(OpenerContext);
  // Slice #39.04: on a list the magnifier is one of the row's three toggles (`@/lib/ui/row-tiles`) — pressed it
  // opens the row's preview at the top of the column; on another row with tiles open it is disabled.
  const list = useContext(IncursionContext);
  const t = useTranslations("shared.preview");
  const tIncursion = useTranslations("shared.incursion");
  if (list) {
    const pressed = isRowTileOpen(list.state, target, "preview");
    const locked = isLocked(list.state, target);
    return (
      <IconButton
        icon={Search}
        label={t("openPreview")}
        variant={pressed ? "primary" : "secondary"}
        size="xs"
        aria-pressed={pressed}
        disabled={locked}
        note={locked ? tIncursion("lockedNote") : undefined}
        data-preview-toggle=""
        onClick={(e) => {
          e.stopPropagation();
          list.toggle(target, "preview");
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      />
    );
  }
  if (!previews) return null;
  const key = previewKey(target);
  const pressed = previews.open.some((p) => previewKey(p) === key);
  return (
    <IconButton
      icon={Search}
      label={t("openPreview")}
      variant={pressed ? "primary" : "secondary"}
      size="xs"
      aria-pressed={pressed}
      data-preview-toggle=""
      onClick={(e) => {
        e.stopPropagation();
        if (pressed) {
          previews.close(key);
          return;
        }
        // Slice #37.75: the tile it was pressed in — the preview opens right under it.
        const anchor = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-tile]")?.dataset.tile;
        previews.show(anchor ? { ...target, anchor } : target);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}

/**
 * A list with previews beside it.                                 (Slice #37.25)
 *
 * The four entity lists (Persoane fizice, Persoane juridice, Proprietăți,
 * Acte) have no tile row, so the list's table and its open previews share one
 * wrapping row: the table first, then the previews.
 *
 * Slice #38.05: the open previews (two at most) stand in ONE COLUMN of their
 * own beside the table — the first at the top, the second under it — and that
 * column drops below the table only when the window cannot hold the table and
 * one preview side by side. It used to be the previews themselves in the row,
 * each at its fixed width, so a wide table and two previews did not fit one
 * line and the second wrapped onto the next — under the table, not under the
 * first (Adrian's bug, on Proprietăți at 1920 px: measured, the first at the
 * table's right, x 1162, the second at x 248 under the table).
 * Slice #38.72: and the row's „Incursiune" (the eye, `IncursionButton`) — one tile from inside the object,
 * `IncursionTile` from `src/app/_components/`, passed in so this module reaches nothing under `src/app/` —
 * stands beside the list in the previews' place, filling what the row leaves.
 * „Previzualizare" on a row opens one there. The same body, the same
 * two-at-most rule and the same read-only guarantee as on a detail screen; a
 * list has no „Părți afișate", so „Închide" is how one is closed. Changing the
 * page, the search or the filter leaves them open.
 *
 * Slice #38.75: TWO PIECES, so the Incursiune can be as tall as the WHOLE list. `ListPreviews` wraps the list
 * from its toolbar to its pagination (`data-list-body`) and draws the Incursiune beside that, `self-stretch`ed to
 * the row — so its top is the toolbar's top and its bottom the pagination's bottom (Ask first #2), however many
 * rows the page shows (Ask first #1). The list is `items-start`: a list shorter than the tile's own minimum is
 * not stretched, and a tile wrapped under the list (a narrow window) stretches only to itself. `ListPreviewRow`
 * wraps the table frame alone and draws the previews' column beside it, exactly where #38.05 put it — the
 * previews are not this slice's. Both read one state, held here.
 *
 * Slice #39.04 — A ROW'S THREE TOGGLES, ONE COLUMN. What is above about two previews from any rows, one Incursiune,
 * and the previews' column beside the table is replaced on the lists: one row at a time, any subset of its
 * magnifier, eye and chain link, the other rows' three disabled, and the open tiles in ONE column beside the whole
 * list — „Previzualizare" at the top, „Legături" in the middle, „Incursiune" at the bottom — each 40 rem wide.
 * „Previzualizare" and „Legături" keep their own heights; „Incursiune" takes what is left down to the list's
 * bottom, never below its own minimum (Ask first 1). A page change, a search or a filter closes all three
 * (`resetKey`, Ask first 2). The detail screens' previews (`usePreviews`, two at most) are untouched.
 */
export function ListPreviews({
  children,
  incursion: IncursionTile,
  resetKey,
}: {
  children: ReactNode;
  incursion?: IncursionTileComponent;
  /**
   * Slice #39.04 (Ask first 2): the list's page, search and filters in one string (its `pageKey`). When it changes
   * — the open row may be off the screen — all three close and every row is free again.
   */
  resetKey?: string;
}) {
  const [tiles, setTiles] = useState<RowTiles>(NO_ROW_TILES);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setTiles(NO_ROW_TILES);
  }
  const toggle = useCallback((target: PreviewTarget, tile: RowTile) => setTiles((s) => toggleRowTile(s, target, tile)), []);
  const close = useCallback((tile: RowTile) => setTiles((s) => closeRowTile(s, tile)), []);
  const offersIncursion = IncursionTile !== undefined;
  const incursion = useMemo<Incursion>(
    () => ({ state: tiles, toggle, close, offersIncursion }),
    [tiles, toggle, close, offersIncursion],
  );
  const row = tiles.row;
  return (
    <IncursionContext.Provider value={incursion}>
      <div data-list-incursion-row className="flex flex-wrap items-start gap-4">
        {/* The whole page's width while nothing stands beside it, as the list's own column always was. */}
        <div data-list-body className={row ? "flex min-w-0 max-w-full flex-col gap-4" : "flex w-full flex-col gap-4"}>
          {children}
        </div>
        {row && (
          // Slice #39.04: one column, 40 rem (the person screen's „Interacțiuni" tile), as tall as the list; the
          // tiles in the fixed order, whatever order they were pressed in. A narrow window drops it under the list,
          // still 40 rem (Ask first 3).
          <div data-list-row-tiles className="flex max-w-full shrink-0 flex-col gap-4 self-stretch" style={ROW_TILES_STYLE}>
            {tiles.open.map((tile) =>
              tile === "preview" ? (
                <PreviewTile key={`preview:${previewKey(row)}`} target={row} onClose={() => close("preview")} style={FILL_COLUMN} />
              ) : IncursionTile ? (
                <IncursionTile key={`${tile}:${previewKey(row)}`} target={row} view={tile} onClose={() => close(tile)} />
              ) : null,
            )}
          </div>
        )}
      </div>
    </IncursionContext.Provider>
  );
}

/** Slice #39.04: the row tiles' column — the person screen's „Interacțiuni" width, `PAGES_PANEL_REM` (40 rem). */
export const ROW_TILES_STYLE: CSSProperties = { width: rem(PAGES_PANEL_REM) };

/** A preview in that column takes the column's width, whatever width it has on a detail screen. */
const FILL_COLUMN: CSSProperties = { width: "100%" };

/**
 * The table frame (Slice #38.05, #38.75). Since #39.04 the list's previews stand in the row tiles' column beside the
 * whole list (`ListPreviews`), so this lays out the table alone.
 */
export function ListPreviewRow({ children }: { children: ReactNode }) {
  return (
    <div data-list-previews className="flex flex-wrap items-start gap-4">
      {children}
    </div>
  );
}

// ── What a preview reads ──────────────────────────────────────────────────────

/**
 * The label of a field, by its screen name: `shared.preview.fields.*`, whose
 * keys #37.24 named before the rows were the screens' (#37.33).
 */
const LABEL_KEY: Record<string, string> = {
  judicialPersonTypeId: "companyType",
  cuiNumber: "cui",
  tradeRegisterNumber: "tradeRegister",
  tarlaId: "tarla",
};

/** The words for a preview with no name (#37.57). */
const UNNAMED_KIND: Record<PreviewKind, UnnamedKind> = { person: "person", company: "person", property: "property", document: "document" };

/**
 * One preview's data. The key starts with "preview", not "version…", so
 * `RecordSyncProvider` refetches it when another window changes a record.
 */
export function usePreviewData(target: PreviewTarget) {
  return useQuery({ queryKey: ["preview", target.kind, target.id], queryFn: () => loadPreview(target) });
}

/**
 * The tile row's boxes for the open previews — „Previzualizare: <name>", ticked (#37.57: it was the code);
 * unticking one closes it. For `TileSelector`'s `extra`.
 */
export function usePreviewSelectorEntries(previews: Previews) {
  const t = useTranslations("shared.preview");
  const nameOr = useNameOr();
  const results = useQueries({
    queries: previews.open.map((target) => ({ queryKey: ["preview", target.kind, target.id], queryFn: () => loadPreview(target) })),
  });
  return previews.open.map((target, i) => ({
    key: previewKey(target),
    label: `${t("title")}: ${results[i]?.data ? nameOr(results[i].data.title, UNNAMED_KIND[target.kind]) : "…"}`,
    onRemove: () => previews.close(previewKey(target)),
  }));
}

// ── The tiles ─────────────────────────────────────────────────────────────────

/** Every open preview, as tiles, at the end of the row (`order` for a row that orders its tiles). */
export function PreviewTiles({ previews, order }: { previews: Previews; order?: number }) {
  return (
    <>
      {previews.open.map((target, i) => (
        <PreviewTile
          key={previewKey(target)}
          target={target}
          onClose={() => previews.close(previewKey(target))}
          style={order === undefined ? undefined : { order: order + i }}
        />
      ))}
    </>
  );
}

function PreviewTile({ target, onClose, style }: { target: PreviewTarget; onClose: () => void; style?: CSSProperties }) {
  const t = useTranslations("shared.preview");
  const nameOr = useNameOr();
  const q = usePreviewData(target);
  // „Deschide" leaves the screen: through the guard, like the sidebar, so an
  // unsaved edit beside the preview is asked about first.
  const { guardedNavigate } = useUnsavedChanges();
  const labels = { open: t("open"), close: t("close"), readonly: t("readonly"), firstPage: t("firstPage"), noPage: t("noPage") };
  const width = target.kind === "document" ? "pages" : "panel";
  const kind: PreviewKind = target.kind;
  if (!q.data) {
    return (
      <PreviewTileBody
        title={q.isError ? t("error") : t("loading")}
        fields={[]}
        openHref={previewHref(target)}
        labels={labels}
        onClose={onClose}
        onOpen={guardedNavigate}
        width={width}
        tile={previewKey(target)}
        style={style}
        anchor={target.anchor}
      />
    );
  }
  const data = q.data;
  const label = (name: string) => t(`fields.${LABEL_KEY[name] ?? name}` as Parameters<typeof t>[0]);
  // Slice #37.60: a person and a company — three compact lines (`PREVIEW_LINES`).
  // Slice #37.70: a person's date of birth reads „născut: 12.03.1960" — „născută:" for a woman.
  const born = data.gender === "FEMALE" ? t("bornFemale") : t("bornMale");
  const lines = kind in PREVIEW_LINES
    ? PREVIEW_LINES[kind as PreviewLinesKind].map((line) =>
        line.map((name) => ({
          label: label(name),
          value: data.fields[name] ?? null,
          prefix: kind === "person" && name === "dateOfBirth" ? born : undefined,
        })))
    : undefined;
  return (
    <PreviewTileBody
      lines={lines}
      title={nameOr(data.title, UNNAMED_KIND[kind])}
      // Slice #37.70: a company's contact persons, counted, after its name.
      titleNote={data.contacts === undefined ? undefined : t("contacts", { count: data.contacts })}
      fields={PREVIEW_ROWS[kind].flatMap((row, i): PreviewField[] =>
        row.map((name) => ({
          label: label(name),
          value: data.fields[name] ?? null,
          width: PREVIEW_WIDTHS[kind][name],
          row: i,
        })),
      )}
      openHref={previewHref(target)}
      labels={labels}
      onClose={onClose}
      onOpen={guardedNavigate}
      image={data.image}
      width={width}
      tile={previewKey(target)}
      style={style}
      anchor={target.anchor}
    />
  );
}
