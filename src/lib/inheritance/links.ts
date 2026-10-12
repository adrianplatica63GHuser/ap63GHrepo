/**
 * Where the tree's links go.                                                           (Slice #39.12)
 *
 * As „Interacțiuni" (#39.05/#39.06): a name in the whole tree (A) opens the person's screen with the tree's action
 * panel (C) expanded — `?tree=open` — and every other way onto the screen finds C collapsed (#39.12's Ask first 1).
 * A name in Interacțiuni's A expands the interactions' C (`?log=new`) and leaves the tree's collapsed. Expanding
 * writes nothing.
 */
export const TREE_PARAM = "tree";
export const TREE_OPEN = "open";

/** The person's screen with the tree's C expanded — 39.11's name links. */
export function personTreeHref(personId: string): string {
  return `/natural-persons/${encodeURIComponent(personId)}?${TREE_PARAM}=${TREE_OPEN}`;
}

/** Does the address ask for C expanded? */
export function readTree(value: string | null): boolean {
  return value === TREE_OPEN;
}

/** The whole tree, centred on a person — the tile's „Deschide arborele întreg". */
export function wholeTreeHref(focusId?: string): string {
  return focusId ? `/inheritance-tree?focus=${encodeURIComponent(focusId)}` : "/inheritance-tree";
}
