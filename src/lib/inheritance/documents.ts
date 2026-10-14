/**
 * The inheritance tree over time, and the documents behind it — pure.                  (Slice #39.13)
 *
 * Adrian (The Inheritance Tree.docx) asked for ideas, not a spec: „I am not sure how to bring chronology into this
 * Graph … if you have a good idea please implement it"; the documents count „maybe links to each doc"; and the
 * documents two related persons share have value, „but we don't want to be too complicated and confusing", so they
 * are an advanced level, off by default.
 *
 * THE DOCUMENTS are `person_document` rows (a person on a document, in any role): each person carries how many
 * documents they are on, and the list of them; a pair of related persons, how many documents they are BOTH on.
 *
 * TIME is the birth date and, since Slice #39.30, the date of death: a year chosen on the slider fades whoever was
 * born after it, and marks as dead whoever died in it or before (`diedBy`). With no year chosen — today — every
 * person marked „Decedat" is dead, dated or not.
 */
import type { TreePerson } from "@/lib/inheritance/layout";

/** A document a tree person is on: its type, number and date — nothing else reaches the screen. */
export type TreeDocument = {
  id: string;
  /** The type's name; null for a document with no type yet. */
  type: string | null;
  /** „Nr. titlu / certificat / contract …", or null. */
  number: string | null;
  /** ISO yyyy-mm-dd, or null. */
  date: string | null;
};

/** One person on one document (several roles on the same document are one appearance). */
export type TreeAppearance = { personId: string; documentId: string };

export type DocumentIndex = {
  byId: ReadonlyMap<string, TreeDocument>;
  byPerson: ReadonlyMap<string, readonly string[]>;
};

/** Oldest first, a document with no date last, then by type — the order a reader of a file expects. */
export function byDate(a: TreeDocument, b: TreeDocument): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date < b.date ? -1 : 1;
  }
  return (a.type ?? "").localeCompare(b.type ?? "", "ro") || a.id.localeCompare(b.id);
}

export function indexDocuments(documents: readonly TreeDocument[], appearances: readonly TreeAppearance[]): DocumentIndex {
  const byId = new Map(documents.map((d) => [d.id, d]));
  const sets = new Map<string, Set<string>>();
  for (const { personId, documentId } of appearances) {
    if (!byId.has(documentId)) continue;
    const s = sets.get(personId) ?? new Set<string>();
    s.add(documentId);
    sets.set(personId, s);
  }
  const byPerson = new Map<string, string[]>();
  for (const [personId, s] of sets) byPerson.set(personId, [...s].map((id) => byId.get(id)!).sort(byDate).map((d) => d.id));
  return { byId, byPerson };
}

/** The documents `personId` is on, oldest first. */
export function documentsOf(index: DocumentIndex, personId: string): TreeDocument[] {
  return (index.byPerson.get(personId) ?? []).map((id) => index.byId.get(id)!);
}

/** The documents both `a` and `b` are on, oldest first — a pair's „Acte comune". */
export function sharedDocuments(index: DocumentIndex, a: string, b: string): TreeDocument[] {
  if (a === b) return [];
  const other = new Set(index.byPerson.get(b) ?? []);
  return (index.byPerson.get(a) ?? []).filter((id) => other.has(id)).map((id) => index.byId.get(id)!);
}

/** The key a pair's shared count is drawn under: the two ids in order, so A–B and B–A are one pair. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const yearOf = (iso: string | null): number | null => {
  const m = iso ? /^(\d{4})-/.exec(iso) : null;
  return m ? Number(m[1]) : null;
};

/**
 * The slider's span: from the earliest birth year in the tree to `now`'s year. Null when nobody has a birth date,
 * and the slider is then not drawn — there would be nothing to fade.
 */
export function yearSpan(persons: readonly TreePerson[], now: Date = new Date()): { min: number; max: number } | null {
  const years = persons.map((p) => yearOf(p.dateOfBirth)).filter((y): y is number => y !== null);
  if (years.length === 0) return null;
  const max = now.getFullYear();
  return { min: Math.min(max, ...years), max };
}

/**
 * Not yet born in `year`: born in a LATER year. Null `year` is today, and nobody fades; a person with no birth date
 * never fades — the tree does not guess when they were born.
 */
export function bornAfter(person: Pick<TreePerson, "dateOfBirth">, year: number | null): boolean {
  if (year === null) return false;
  const born = yearOf(person.dateOfBirth);
  return born !== null && born > year;
}

/**
 * Slice #39.30 — dead by `year`: marked „Decedat" and died in that year or before it. Null `year` is today: everyone
 * marked dead is. A dead person with no date of death is dead today but not in a chosen year — the tree does not
 * guess when they died, as it does not guess a birth.
 */
export function diedBy(person: Pick<TreePerson, "isDeceased" | "dateOfDeath">, year: number | null): boolean {
  if (!person.isDeceased) return false;
  if (year === null) return true;
  const died = yearOf(person.dateOfDeath ?? null);
  return died !== null && died <= year;
}

/** A document's date as the archive writes it: dd.mm.yyyy. */
export function documentDay(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}
