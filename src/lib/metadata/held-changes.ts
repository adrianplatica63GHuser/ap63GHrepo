/**
 * What „Etichete și grupuri" and „Alte referințe" hold until „Salvează".                               (Slice 41.97)
 *
 * Adrian, 2026-11-06: „Remove the “Done” buttons from the “Tags and groups” and the new “Other references” tile; just use
 * the Save and Cancel buttons at the bottom In the same way the “Classification” tile is using". Until this slice every
 * add and remove was written the moment it was pressed, and „Gata" only ended the edit. Now an add or a remove in
 * „Editează" changes only what the tile shows; „Salvează" writes them through the routes that always wrote them —
 * removes first, then adds, one at a time — and „Renunță" (or Esc) drops them. No new API route.
 *
 * Pure: the tile keeps a `Held` in its state, each press is one of the functions below, and `heldWrites` is the list
 * „Salvează" sends. Each write says what is left held once it has gone through, so a write that fails leaves the edit
 * open with exactly the rest still held (Ask first 2).
 *
 * The rules a press follows (Ask first 3):
 *   - adding back what was removed in the same edit cancels both — nothing is written for it;
 *   - removing what was added in the same edit cancels both;
 *   - a tag typed twice is one; a tag, a group or a stamp the record already has is not added again;
 *   - the groups' cap counts what will stand after the save (`heldGroupCount`).
 */

export interface HeldGroup { id: string; code: string; description: string | null }
export interface HeldStamp { id: string; code: string; shortDescription: string | null }
export interface HeldReference { code: string; note: string }

export interface Held {
  tags:   { add: string[]; remove: string[] };
  groups: { add: HeldGroup[]; remove: string[] };
  stamps: { add: HeldStamp[]; remove: string[] };
  /** A reference is added by the other record's code and removed by its own id. */
  refs:   { add: HeldReference[]; remove: string[] };
}

export const NOTHING_HELD: Held = {
  tags:   { add: [], remove: [] },
  groups: { add: [], remove: [] },
  stamps: { add: [], remove: [] },
  refs:   { add: [], remove: [] },
};

/** Something is held — „Salvează" is enabled. */
export function isHeld(h: Held): boolean {
  return Object.values(h).some((k) => k.add.length > 0 || k.remove.length > 0);
}

/** A tag as the server stores it: trimmed, lower case. */
export function normaliseTag(tag: string): string {
  return tag.trim().toLowerCase();
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export function holdTagAdd(h: Held, raw: string, current: readonly string[]): Held {
  const tag = normaliseTag(raw);
  if (!tag) return h;
  if (h.tags.remove.includes(tag)) return { ...h, tags: { ...h.tags, remove: h.tags.remove.filter((t) => t !== tag) } };
  if (current.includes(tag) || h.tags.add.includes(tag)) return h;
  return { ...h, tags: { ...h.tags, add: [...h.tags.add, tag] } };
}

export function holdTagRemove(h: Held, tag: string): Held {
  if (h.tags.add.includes(tag)) return { ...h, tags: { ...h.tags, add: h.tags.add.filter((t) => t !== tag) } };
  if (h.tags.remove.includes(tag)) return h;
  return { ...h, tags: { ...h.tags, remove: [...h.tags.remove, tag] } };
}

/** The tags the tile shows while editing: the record's, less those removed, then those added. */
export function heldTags(current: readonly string[], h: Held): { tag: string; added: boolean }[] {
  return [
    ...current.filter((t) => !h.tags.remove.includes(t)).map((tag) => ({ tag, added: false })),
    ...h.tags.add.map((tag) => ({ tag, added: true })),
  ];
}

// ── Groups and stamps ─────────────────────────────────────────────────────────

type Kind = "groups" | "stamps";

function holdAdd<K extends Kind>(h: Held, kind: K, item: Held[K]["add"][number], currentIds: readonly string[]): Held {
  const k = h[kind];
  if (k.remove.includes(item.id)) return { ...h, [kind]: { ...k, remove: k.remove.filter((id) => id !== item.id) } };
  if (currentIds.includes(item.id) || k.add.some((x) => x.id === item.id)) return h;
  return { ...h, [kind]: { ...k, add: [...k.add, item] } };
}

function holdRemove(h: Held, kind: Kind, id: string): Held {
  const k = h[kind];
  if (k.add.some((x) => x.id === id)) return { ...h, [kind]: { ...k, add: k.add.filter((x) => x.id !== id) } };
  if (k.remove.includes(id)) return h;
  return { ...h, [kind]: { ...k, remove: [...k.remove, id] } };
}

export const holdGroupAdd = (h: Held, g: HeldGroup, currentIds: readonly string[]): Held => holdAdd(h, "groups", g, currentIds);
export const holdGroupRemove = (h: Held, id: string): Held => holdRemove(h, "groups", id);
export const holdStampAdd = (h: Held, s: HeldStamp, currentIds: readonly string[]): Held => holdAdd(h, "stamps", s, currentIds);
export const holdStampRemove = (h: Held, id: string): Held => holdRemove(h, "stamps", id);

/** What the tile shows: the record's, less those removed, then those added (each `added`). */
export function heldList<T extends { id: string }>(current: readonly T[], kept: { add: readonly T[]; remove: readonly string[] }): (T & { added: boolean })[] {
  return [
    ...current.filter((x) => !kept.remove.includes(x.id)).map((x) => ({ ...x, added: false })),
    ...kept.add.map((x) => ({ ...x, added: true })),
  ];
}

/** Slice #38.10's cap counts what will stand after „Salvează": the record's groups, less those removed, plus those added. */
export function heldGroupCount(currentIds: readonly string[], h: Held): number {
  return currentIds.filter((id) => !h.groups.remove.includes(id)).length + h.groups.add.length;
}

// ── References ────────────────────────────────────────────────────────────────

/** A reference added by code: upper case, trimmed; a code already referred to, or already held, is not added again. */
export function holdRefAdd(h: Held, rawCode: string, note: string, currentCodes: readonly string[]): Held {
  const code = rawCode.trim().toUpperCase();
  if (!code || currentCodes.includes(code) || h.refs.add.some((r) => r.code === code)) return h;
  return { ...h, refs: { ...h.refs, add: [...h.refs.add, { code, note: note.trim() }] } };
}

export function holdRefRemove(h: Held, id: string): Held {
  if (h.refs.remove.includes(id)) return h;
  return { ...h, refs: { ...h.refs, remove: [...h.refs.remove, id] } };
}

/** A held reference taken back before „Salvează". */
export function dropHeldRef(h: Held, code: string): Held {
  return { ...h, refs: { ...h.refs, add: h.refs.add.filter((r) => r.code !== code) } };
}

// ── „Salvează" ────────────────────────────────────────────────────────────────

export interface HeldWrite {
  method: "POST" | "DELETE";
  url:    string;
  /** The JSON body, when the route takes one. */
  body?:  Record<string, unknown>;
  /** What is still held once this write has gone through. */
  after:  (h: Held) => Held;
}

/**
 * The writes „Salvează" sends, in order: every remove, then every add — each through the route that wrote it before
 * this slice (`/api/metadata/<po>/tags`, `/groups`, `/stamps`, `/cross-refs`).
 */
export function heldWrites(po: string, h: Held): HeldWrite[] {
  const base = `/api/metadata/${encodeURIComponent(po)}`;
  const removes: HeldWrite[] = [
    ...h.tags.remove.map((tag): HeldWrite => ({
      method: "DELETE", url: `${base}/tags`, body: { tag },
      after: (x) => ({ ...x, tags: { ...x.tags, remove: x.tags.remove.filter((t) => t !== tag) } }),
    })),
    ...h.groups.remove.map((id): HeldWrite => ({
      method: "DELETE", url: `${base}/groups/${encodeURIComponent(id)}`,
      after: (x) => ({ ...x, groups: { ...x.groups, remove: x.groups.remove.filter((g) => g !== id) } }),
    })),
    ...h.stamps.remove.map((id): HeldWrite => ({
      method: "DELETE", url: `${base}/stamps/${encodeURIComponent(id)}`,
      after: (x) => ({ ...x, stamps: { ...x.stamps, remove: x.stamps.remove.filter((s) => s !== id) } }),
    })),
    ...h.refs.remove.map((id): HeldWrite => ({
      method: "DELETE", url: `${base}/cross-refs/${encodeURIComponent(id)}`,
      after: (x) => ({ ...x, refs: { ...x.refs, remove: x.refs.remove.filter((r) => r !== id) } }),
    })),
  ];
  const adds: HeldWrite[] = [
    ...h.tags.add.map((tag): HeldWrite => ({
      method: "POST", url: `${base}/tags`, body: { tag },
      after: (x) => ({ ...x, tags: { ...x.tags, add: x.tags.add.filter((t) => t !== tag) } }),
    })),
    ...h.groups.add.map((g): HeldWrite => ({
      method: "POST", url: `${base}/groups`, body: { groupId: g.id },
      after: (x) => ({ ...x, groups: { ...x.groups, add: x.groups.add.filter((y) => y.id !== g.id) } }),
    })),
    ...h.stamps.add.map((s): HeldWrite => ({
      method: "POST", url: `${base}/stamps`, body: { stampId: s.id },
      after: (x) => ({ ...x, stamps: { ...x.stamps, add: x.stamps.add.filter((y) => y.id !== s.id) } }),
    })),
    ...h.refs.add.map((r): HeldWrite => ({
      method: "POST", url: `${base}/cross-refs`, body: r.note ? { targetCode: r.code, note: r.note } : { targetCode: r.code },
      after: (x) => ({ ...x, refs: { ...x.refs, add: x.refs.add.filter((y) => y.code !== r.code) } }),
    })),
  ];
  return [...removes, ...adds];
}

/**
 * „Salvează": the writes one at a time, in order, stopping at the first that fails. Returns what is still held — none
 * when everything went through — and the failure's message. The caller re-reads once, whatever happened.
 */
export async function sendHeld(
  po: string,
  h: Held,
  send: (w: HeldWrite) => Promise<{ ok: boolean; error?: string }>,
): Promise<{ left: Held; error: string | null }> {
  let left = h;
  for (const w of heldWrites(po, h)) {
    const r = await send(w);
    if (!r.ok) return { left, error: r.error ?? "" };
    left = w.after(left);
  }
  return { left, error: null };
}

/** The kind a reference's code names, before the server has said (a held reference): its prefix. */
export function kindOfCode(code: string): "natural" | "judicial" | "property" | "document" {
  if (code.startsWith("JPERS")) return "judicial";
  if (code.startsWith("PROP")) return "property";
  if (code.startsWith("DOC")) return "document";
  return "natural";
}
