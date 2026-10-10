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
import { PREVIEW_LINES, PREVIEW_ROWS, PREVIEW_WIDTHS, type PreviewKind, type PreviewLinesKind } from "@/lib/ui/field-widths";
import { nextPreviews, previewHref, previewKey, type PreviewTarget } from "@/lib/ui/previews";
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
  // Slice #38.72: while the list's Incursiune is open, every magnifier is released and disabled.
  const incursion = useContext(IncursionContext);
  const t = useTranslations("shared.preview");
  const tIncursion = useTranslations("shared.incursion");
  if (!previews) return null;
  const key = previewKey(target);
  const locked = incursion !== null && incursion.open !== null;
  const pressed = !locked && previews.open.some((p) => previewKey(p) === key);
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
 * stands beside the table in the previews' place, filling what the row leaves.
 * „Previzualizare" on a row opens one there. The same body, the same
 * two-at-most rule and the same read-only guarantee as on a detail screen; a
 * list has no „Părți afișate", so „Închide" is how one is closed. Changing the
 * page, the search or the filter leaves them open.
 */
export function ListPreviews({ children, incursion: IncursionTile }: { children: ReactNode; incursion?: IncursionTileComponent }) {
  const previews = usePreviews();
  // Slice #38.72: the row whose „Incursiune" is open — one at a time (Ask first #1). A list without an
  // Incursiune tile offers none, and its magnifiers are never locked.
  const [open, setOpen] = useState<PreviewTarget | null>(null);
  const toggle = useCallback(
    (target: PreviewTarget) => {
      const opening = open === null || previewKey(open) !== previewKey(target);
      setOpen(opening ? { kind: target.kind, id: target.id } : null);
      // While it is open no preview is: every magnifier is released, its preview closed.
      if (opening) for (const p of previews.open) previews.close(previewKey(p));
    },
    [open, previews],
  );
  const incursion = useMemo<Incursion | null>(() => (IncursionTile ? { open, toggle } : null), [IncursionTile, open, toggle]);
  return (
    <PreviewOpenerProvider previews={previews}>
      <IncursionContext.Provider value={incursion}>
        <div data-list-previews className="flex flex-wrap items-start gap-4">
          {children}
          {IncursionTile && open ? (
            <IncursionTile key={previewKey(open)} target={open} onClose={() => setOpen(null)} />
          ) : (
            previews.open.length > 0 && (
              <div data-list-preview-column className="flex flex-col items-start gap-4">
                <PreviewTiles previews={previews} />
              </div>
            )
          )}
        </div>
      </IncursionContext.Provider>
    </PreviewOpenerProvider>
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
