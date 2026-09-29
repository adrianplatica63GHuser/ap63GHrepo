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
 * A TILE LIKE ANY OTHER (#37.17): a person, a company or a property is one
 * panel wide; a document is the Pagini panel's width, its general data above
 * its first page. While open it has a ticked box in the tile row
 * (`TileSelector`'s `extra`) — unticking it closes it. At most two are open
 * (`@/lib/ui/previews`); a third replaces the oldest.
 */
import { createContext, useCallback, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui/button-styles";
import { PreviewTileBody } from "./preview-tile-body";
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
 * „Previzualizare" on an association row. Drawn only inside a detail screen
 * that shows previews; anywhere else (a screen with no tile row) it is absent.
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

// ── What a preview reads ──────────────────────────────────────────────────────

type FieldId =
  | "code" | "lastName" | "firstName" | "cnp" | "dateOfBirth" | "placeOfBirth"
  | "name" | "companyType" | "cui" | "tradeRegister"
  | "nickname" | "parcela" | "cadastralNumber" | "carteFunciara" | "surfaceAreaMp"
  | "documentType" | "title" | "subject" | "nrDocument" | "dateDocument";

interface PreviewData {
  title: string;
  code: string;
  fields: [FieldId, string | null][];
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
        fields: [
          ["lastName", s(n.lastName)],
          ["firstName", s(n.firstName)],
          ["cnp", s(n.cnp)],
          ["dateOfBirth", dmy(s(n.dateOfBirth))],
          ["placeOfBirth", s(n.placeOfBirth)],
        ],
      };
    }
    case "company": {
      const r = await getJson<{ person: Row; judicial: Row | null; judicialPersonTypeName: string | null }>(`/api/judicial-persons/${id}`);
      const j = r.judicial ?? {};
      return {
        title: s(j.name) ?? s(r.person.displayName) ?? "",
        code: s(r.person.code) ?? "",
        fields: [
          ["name", s(j.name)],
          ["companyType", s(r.judicialPersonTypeName)],
          ["cui", s(j.cuiNumber)],
          ["tradeRegister", s(j.tradeRegisterNumber)],
        ],
      };
    }
    case "property": {
      const r = await getJson<{ property: Row }>(`/api/properties/${id}`);
      const p = r.property;
      return {
        title: s(p.nickname) ?? s(p.code) ?? "",
        code: s(p.code) ?? "",
        fields: [
          ["nickname", s(p.nickname)],
          ["parcela", s(p.parcela)],
          ["cadastralNumber", s(p.cadastralNumber)],
          ["carteFunciara", s(p.carteFunciara)],
          ["surfaceAreaMp", s(p.surfaceAreaMp)],
        ],
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
        fields: [
          ["documentType", types.items.find((ty) => ty.id === d.documentTypeId)?.name ?? null],
          ["title", s(d.title)],
          ["subject", s(d.subject)],
          ["nrDocument", s(d.nrDocument)],
          ["dateDocument", dmy(s(d.dateDocument))],
        ],
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
  const labels = { open: t("open"), close: t("close"), readonly: t("readonly"), firstPage: t("firstPage"), noPage: t("noPage") };
  const width = target.kind === "document" ? "pages" : "panel";
  if (!q.data) {
    return (
      <PreviewTileBody
        title={q.isError ? t("error") : t("loading")}
        code=""
        fields={[]}
        openHref={previewHref(target)}
        labels={labels}
        onClose={onClose}
        width={width}
        tile={previewKey(target)}
        style={style}
      />
    );
  }
  return (
    <PreviewTileBody
      title={q.data.title}
      code={q.data.code}
      fields={q.data.fields.map(([id, value]) => ({ label: t(`fields.${id}` as Parameters<typeof t>[0]), value }))}
      openHref={previewHref(target)}
      labels={labels}
      onClose={onClose}
      image={q.data.image}
      width={width}
      tile={previewKey(target)}
      style={style}
    />
  );
}
