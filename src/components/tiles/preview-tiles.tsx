"use client";

/**
 * A related record, open in a tile beside the one on screen.   (Slice #37.24)
 *
 * From any association tile, „Previzualizare" opens the related record in a
 * Previzualizare tile at the end of the tile row: a sales contract and its
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
import { createContext, useCallback, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { buttonClass } from "@/lib/ui/button-styles";
import { PreviewTileBody, type PreviewField } from "./preview-tile-body";
import { PREVIEW_ROWS, PREVIEW_WIDTHS, type PreviewKind } from "@/lib/ui/field-widths";
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
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open(target);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={buttonClass({ variant: "secondary", size: "xs" })}
    >
      {t("openPreview")}
    </button>
  );
}

/**
 * A list with previews beside it.                                 (Slice #37.25)
 *
 * The four entity lists (Persoane fizice, Persoane juridice, Proprietăți,
 * Acte) have no tile row, so the list's table and its open previews share one
 * wrapping row: the table first, then at most two previews, each at its fixed
 * width, dropping below the table when the window is narrower than both.
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
        <PreviewTiles previews={previews} />
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
  documentTypeId: "documentType",
};

interface PreviewData {
  title: string;
  code: string;
  /** The short set's values, by the screen's field names (`PREVIEW_FIELDS`). */
  fields: Record<string, string | null>;
  /** A document's first page; null when it has none; undefined for the other kinds. */
  image?: { url: string; mimeType: string | null } | null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url.split("?")[0]} failed (${res.status})`);
  return (await res.json()) as T;
}

/** dd.mm.yyyy, as the forms show a date. */
function dmy(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

type Row = Record<string, string | number | null | undefined>;
const s = (v: string | number | null | undefined): string | null => (v === null || v === undefined || v === "" ? null : String(v));

async function loadPreview(target: PreviewTarget): Promise<PreviewData> {
  const id = encodeURIComponent(target.id);
  switch (target.kind) {
    case "person": {
      const r = await getJson<{ person: Row; natural: Row | null }>(`/api/people/${id}`);
      const n = r.natural ?? {};
      return {
        title: s(r.person.displayName) ?? s(r.person.code) ?? "",
        code: s(r.person.code) ?? "",
        fields: {
          lastName: s(n.lastName),
          firstName: s(n.firstName),
          cnp: s(n.cnp),
          dateOfBirth: dmy(s(n.dateOfBirth)),
          placeOfBirth: s(n.placeOfBirth),
        },
      };
    }
    case "company": {
      const r = await getJson<{ person: Row; judicial: Row | null; judicialPersonTypeName: string | null }>(`/api/judicial-persons/${id}`);
      const j = r.judicial ?? {};
      return {
        title: s(j.name) ?? s(r.person.displayName) ?? "",
        code: s(r.person.code) ?? "",
        fields: {
          name: s(j.name),
          judicialPersonTypeId: s(r.judicialPersonTypeName),
          cuiNumber: s(j.cuiNumber),
          tradeRegisterNumber: s(j.tradeRegisterNumber),
        },
      };
    }
    case "property": {
      const r = await getJson<{ property: Row }>(`/api/properties/${id}`);
      const p = r.property;
      return {
        title: s(p.nickname) ?? s(p.code) ?? "",
        code: s(p.code) ?? "",
        fields: {
          nickname: s(p.nickname),
          parcela: s(p.parcela),
          cadastralNumber: s(p.cadastralNumber),
          carteFunciara: s(p.carteFunciara),
          surfaceAreaMp: s(p.surfaceAreaMp),
        },
      };
    }
    case "document": {
      const [d, types, pages] = await Promise.all([
        getJson<Row>(`/api/documents/${id}`),
        getJson<{ items: { id: string; name: string }[] }>("/api/admin/value-lists/document-types").catch(() => ({ items: [] })),
        getJson<{ id: string; pageNumber: number }[]>(`/api/documents/${id}/pages`).catch(() => []),
      ]);
      const first = [...pages].sort((a, b) => a.pageNumber - b.pageNumber)[0];
      const image = first
        ? await getJson<{ url: string; mimeType: string | null }>(`/api/documents/${id}/pages/${encodeURIComponent(first.id)}/view`).catch(() => null)
        : null;
      return {
        title: s(d.title) ?? s(d.code) ?? "",
        code: s(d.code) ?? "",
        fields: {
          documentTypeId: types.items.find((ty) => ty.id === d.documentTypeId)?.name ?? null,
          title: s(d.title),
          subject: s(d.subject),
          nrDocument: s(d.nrDocument),
          dateDocument: dmy(s(d.dateDocument)),
        },
        image,
      };
    }
  }
}

/**
 * One preview's data. The key starts with "preview", not "version…", so
 * `RecordSyncProvider` refetches it when another window changes a record.
 */
export function usePreviewData(target: PreviewTarget) {
  return useQuery({ queryKey: ["preview", target.kind, target.id], queryFn: () => loadPreview(target) });
}

/**
 * The tile row's boxes for the open previews — „Previzualizare: CODE", ticked;
 * unticking one closes it. For `TileSelector`'s `extra`.
 */
export function usePreviewSelectorEntries(previews: Previews) {
  const t = useTranslations("shared.preview");
  const results = useQueries({
    queries: previews.open.map((target) => ({ queryKey: ["preview", target.kind, target.id], queryFn: () => loadPreview(target) })),
  });
  return previews.open.map((target, i) => ({
    key: previewKey(target),
    label: `${t("title")}: ${results[i]?.data?.code || "…"}`,
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
        code=""
        fields={[]}
        openHref={previewHref(target)}
        labels={labels}
        onClose={onClose}
        onOpen={guardedNavigate}
        width={width}
        tile={previewKey(target)}
        style={style}
      />
    );
  }
  const data = q.data;
  return (
    <PreviewTileBody
      title={data.title}
      code={data.code}
      fields={PREVIEW_ROWS[kind].flatMap((row, i): PreviewField[] =>
        row.map((name) => ({
          label: t(`fields.${LABEL_KEY[name] ?? name}` as Parameters<typeof t>[0]),
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
    />
  );
}
