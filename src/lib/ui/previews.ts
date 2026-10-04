/**
 * Which related records are open in Previzualizare tiles.        (Slice #37.24)
 *
 * From an association tile, „Previzualizare" opens the related record in a
 * read-only tile beside the one on screen (`src/components/tiles/preview-tiles.tsx`).
 * AT MOST TWO are open: two previews and the record itself already fill a
 * 2560-pixel screen, so a third replaces the OLDEST. Opening one that is open
 * already changes nothing. Nothing here is stored: a reload closes them all
 * (the header keeps „remembering open previews" out of scope).
 *
 * PURE — no React; `preview-tiles.test.tsx` covers it.
 */

export type PreviewKind = "person" | "company" | "property" | "document";

export interface PreviewTarget {
  kind: PreviewKind;
  id: string;
  /**
   * Slice #37.75: the tile („data-tile") whose „Previzualizare" opened it, so
   * the tile row places it right under that tile. Not part of its key: the
   * same record opened from another tile is the same preview.
   */
  anchor?: string;
}

export const MAX_PREVIEWS = 2;

export function previewKey(t: PreviewTarget): string {
  return `${t.kind}:${t.id}`;
}

/** The open previews after `target` is opened: appended, the oldest dropped past two. */
export function nextPreviews(open: readonly PreviewTarget[], target: PreviewTarget): readonly PreviewTarget[] {
  if (open.some((p) => previewKey(p) === previewKey(target))) return open;
  return [...open, target].slice(-MAX_PREVIEWS);
}

/** A person row's kind: a company is a judicial person. */
export function personPreview(type: string | null | undefined, id: string): PreviewTarget {
  return { kind: type === "JUDICIAL" ? "company" : "person", id };
}

/** Where „Deschide" goes: the record's own screen, read-only as „Vizualizare" opens it. */
export function previewHref(t: PreviewTarget): string {
  const base = { person: "/natural-persons", company: "/judicial-persons", property: "/properties", document: "/documents" }[t.kind];
  return `${base}/${encodeURIComponent(t.id)}?readonly=true`;
}
