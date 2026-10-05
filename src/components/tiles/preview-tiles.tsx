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
import { Eye } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { PreviewTileBody, type PreviewField } from "./preview-tile-body";
import { loadPreview } from "./preview-data";
import { PREVIEW_LINES, PREVIEW_ROWS, PREVIEW_WIDTHS, type PreviewKind, type PreviewLinesKind } from "@/lib/ui/field-widths";
import { nextPreviews, previewHref, previewKey, type PreviewTarget } from "@/lib/ui/previews";

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

const OpenerContext = createContext<((target: PreviewTarget) => void) | null>(null);

/** Lets the association tiles inside a detail screen open previews on it. */
export function PreviewOpenerProvider({ previews, children }: { previews: Previews; children: ReactNode }) {
  return <OpenerContext.Provider value={previews.show}>{children}</OpenerContext.Provider>;
}

/**
 * „Previzualizare" on an association row or a list row. Drawn only inside a
 * detail screen or a list that shows previews (`ListPreviews`, #37.25);
 * anywhere else it is absent.
 */
export function PreviewButton({ target }: { target: PreviewTarget }) {
  const open = useContext(OpenerContext);
  const t = useTranslations("shared.preview");
  if (!open) return null;
  return (
    // #37.42 (A017): Eye, its words the name and the tooltip.
    <IconButton
      icon={Eye}
      label={t("openPreview")}
      variant="secondary"
      size="xs"
      onClick={(e) => {
        e.stopPropagation();
        // Slice #37.75: the tile it was pressed in — the preview opens right under it.
        const anchor = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-tile]")?.dataset.tile;
        open(anchor ? { ...target, anchor } : target);
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
 * „Previzualizare" on a row opens one there. The same body, the same
 * two-at-most rule and the same read-only guarantee as on a detail screen; a
 * list has no „Părți afișate", so „Închide" is how one is closed. Changing the
 * page, the search or the filter leaves them open.
 */
export function ListPreviews({ children }: { children: ReactNode }) {
  const previews = usePreviews();
  return (
    <PreviewOpenerProvider previews={previews}>
      <div data-list-previews className="flex flex-wrap items-start gap-4">
        {children}
        {previews.open.length > 0 && (
          <div data-list-preview-column className="flex flex-col items-start gap-4">
            <PreviewTiles previews={previews} />
          </div>
        )}
      </div>
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
