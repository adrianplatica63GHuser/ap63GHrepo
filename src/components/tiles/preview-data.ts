/**
 * What a Previzualizare tile reads.                    (Slices #37.24, #37.70)
 *
 * Moved out of `preview-tiles.tsx` in #37.70 so `preview-data.test.ts` can
 * drive it with a stubbed `fetch`: it needs no React and no next-intl. It
 * reads each kind's own GET route (and a value list's names), never a form,
 * and returns the short set of `PREVIEW_FIELDS` by the screen's field names.
 */
import type { PreviewTarget } from "@/lib/ui/previews";
import { rotationOf, type PageRotation } from "@/lib/documents/page-rotation";

export interface PreviewData {
  /** The record's name; null when it has none (#37.57: never its system ID — `nameOr` words it). */
  title: string | null;
  /** The short set's values, by the screen's field names (`PREVIEW_FIELDS`). */
  fields: Record<string, string | null>;
  /** A document's first page; null when it has none; undefined for the other kinds. */
  image?: { url: string; mimeType: string | null; rotation?: PageRotation } | null;
  /** A natural person's gender, for „născut:" / „născută:" (#37.70); undefined for the other kinds. */
  gender?: "MALE" | "FEMALE" | null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url.split("?")[0]} failed (${res.status})`);
  return (await res.json()) as T;
}

/** dd.mm.yyyy, as the forms show a date. */
export function dmy(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

type Row = Record<string, string | number | null | undefined>;
const s = (v: string | number | null | undefined): string | null => (v === null || v === undefined || v === "" ? null : String(v));

/** Slice #39.28: the first filled of several, in the form's order (Ask first #1). */
export function firstFilled(...values: (string | number | null | undefined)[]): string | null {
  for (const v of values) {
    const t = s(v)?.trim();
    if (t) return t;
  }
  return null;
}

/** Slice #39.28: notes on one line — every run of spaces and line breaks one space; empty is none. */
export function oneLine(notes: string | number | null | undefined): string | null {
  const t = s(notes)?.replace(/\s+/g, " ").trim();
  return t ? t : null;
}

export async function loadPreview(target: PreviewTarget): Promise<PreviewData> {
  const id = encodeURIComponent(target.id);
  switch (target.kind) {
    case "person": {
      const r = await getJson<{ person: Row; natural: Row | null }>(`/api/people/${id}`);
      const n = r.natural ?? {};
      // Slice #37.60: line 1 is „Nume Prenume" — the heading — with no Nume and Prenume under it.
      const fullName = [s(n.lastName), s(n.firstName)].filter(Boolean).join(" ");
      const g = s(n.gender);
      return {
        title: fullName || s(r.person.displayName),
        fields: {
          nickname: s(n.nickname),
          cnp: s(n.cnp),
          dateOfBirth: dmy(s(n.dateOfBirth)),
          placeOfBirth: s(n.placeOfBirth),
          // Slice #39.28: line 3 and line 4.
          phone: firstFilled(n.personalPhone1, n.personalPhone2, n.workPhone),
          email: firstFilled(n.personalEmail1, n.personalEmail2, n.workEmail),
          notes: oneLine(r.person.notes),
        },
        gender: g === "MALE" || g === "FEMALE" ? g : null,
      };
    }
    case "company": {
      const r = await getJson<{ person: Row; judicial: Row | null }>(`/api/judicial-persons/${id}`);
      const j = r.judicial ?? {};
      return {
        title: s(j.name) ?? s(r.person.displayName),
        // Slice #39.28: Adrian's lines — no „Tip", no „Nr. Reg. Com." and no count of contact persons (#37.70's
        // „(2 contacte)"), which they do not name (Ask first #2).
        fields: {
          nickname: s(j.nickname), // Slice #37.60: „Denumire" is the heading, not a field under it
          cuiNumber: s(j.cuiNumber),
          phone: firstFilled(j.phone),
          email: firstFilled(j.email),
          notes: oneLine(r.person.notes),
        },
      };
    }
    case "property": {
      const [r, tarlas] = await Promise.all([
        getJson<{ property: Row }>(`/api/properties/${id}`),
        // Slice #37.70: Tarla/Solă is the tarla's indicativ, read through tarlaId.
        getJson<{ items: { id: string; indicativ: string }[] }>("/api/admin/value-lists/tarla").catch(() => ({ items: [] })),
      ]);
      const p = r.property;
      return {
        title: s(p.nickname),
        fields: {
          parcela: s(p.parcela),
          tarlaId: p.tarlaId ? tarlas.items.find((t) => t.id === p.tarlaId)?.indicativ ?? null : null,
          surfaceAreaMp: s(p.surfaceAreaMp),
          nickname: s(p.nickname),
          carteFunciara: s(p.carteFunciara),
          cadastralNumber: s(p.cadastralNumber),
        },
      };
    }
    case "document": {
      const [d, pages] = await Promise.all([
        getJson<Row>(`/api/documents/${id}`),
        getJson<{ id: string; pageNumber: number; rotation?: number }[]>(`/api/documents/${id}/pages`).catch(() => []),
      ]);
      const first = [...pages].sort((a, b) => a.pageNumber - b.pageNumber)[0];
      const view = first
        ? await getJson<{ url: string; mimeType: string | null }>(`/api/documents/${id}/pages/${encodeURIComponent(first.id)}/view`).catch(() => null)
        : null;
      // Slice #38.17: drawn with the page's stored turn.
      const image = view && first ? { ...view, rotation: rotationOf(first.rotation) } : null;
      // Slice #37.70: no „Tip document", and „Etichetă scurtă" only as the heading.
      return {
        title: s(d.title),
        fields: {
          subject: s(d.subject),
          nrDocument: s(d.nrDocument),
          dateDocument: dmy(s(d.dateDocument)),
        },
        image,
      };
    }
  }
}
