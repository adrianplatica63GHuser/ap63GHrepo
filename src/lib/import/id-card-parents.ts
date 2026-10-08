/**
 * An identity card's holder's father and mother  (Slice #38.29)
 *
 * Adrian: „when an ID card is [read] the user should get the option to create
 * persons not only from the subject of the ID card but also from the parents of
 * the subject, with the proper relationship father or mother to the subject on
 * the related tile; the origin of these two persons should be noted."
 *
 * A Romanian card that prints the parents prints their FIRST names. So:
 *   - the read (extract-id-card) returns them as `parents: { father, mother }`,
 *     no longer as unmapped text;
 *   - each named parent is offered, ticked, under „Creează și tatăl" /
 *     „Creează și mama", pre-filled with the first name from the card, the
 *     HOLDER's surname — marked unconfirmed, because a mother's surname is
 *     often her maiden name — and the gender of the role;
 *   - on „Adaugă nou" (Persoane fizice), when the ID document is a „Carte de
 *     identitate", both are offered, unticked, to type;
 *   - the holder is created or confirmed first; then each ticked parent goes
 *     through the same resolution the holder did (no CNP, so by name only),
 *     and is linked to the holder as „Tată" / „Mamă" — the parent holds the
 *     role (POST /api/people/[holder]/parents, which finds the role by
 *     lookup_person_role.parent_kind, never by its name);
 *   - a parent created this way carries provenance RELATIVE_ID_CARD and one
 *     „Note" line naming where it came from;
 *   - a parent that fails is reported, and never undoes the holder.
 *
 * PURE MODULE — no React, no fetch. The flow is
 * src/components/persons/parents-resolution.tsx.
 */

import type { ProvenanceCode } from "@/lib/metadata/provenance";

export const PARENT_KINDS = ["FATHER", "MOTHER"] as const;
export type ParentKind = (typeof PARENT_KINDS)[number];

export function isParentKind(value: unknown): value is ParentKind {
  return value === "FATHER" || value === "MOTHER";
}

/** The parents' first names as the card prints them; null when it does not. */
export type CardParents = { father: string | null; mother: string | null };

export const NO_CARD_PARENTS: CardParents = { father: null, mother: null };

/** A printable name, or null: a string with something in it after trimming. */
function nameOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim();
  return v === "" || /^(null|n\/a|-+|—)$/i.test(v) ? null : v;
}

/**
 * The model's `parents` object, sanitised at the network boundary. Anything
 * that is not `{ father?: string, mother?: string }` reads as no parents.
 */
export function cardParentsFrom(raw: unknown): CardParents {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return NO_CARD_PARENTS;
  const r = raw as { father?: unknown; mother?: unknown };
  return { father: nameOrNull(r.father), mother: nameOrNull(r.mother) };
}

/** One parent as the review shows it, and as it is created. */
export type ParentDraft = {
  kind: ParentKind;
  /** „Creează și tatăl" / „Creează și mama". */
  checked: boolean;
  firstName: string;
  lastName: string;
  /** The surname is the holder's, taken as a guess, not read or typed. */
  surnameAssumed: boolean;
};

/** The role decides the gender: a father is MALE, a mother FEMALE. */
export function parentGender(kind: ParentKind): "MALE" | "FEMALE" {
  return kind === "FATHER" ? "MALE" : "FEMALE";
}

/**
 * The parents a READ offers: one per parent the card names, ticked, first name
 * from the card, the holder's surname as an assumption. A parent the card does
 * not name is not offered at all.
 */
export function draftsFromCard(parents: CardParents, holderLastName: string): ParentDraft[] {
  const surname = holderLastName.trim();
  const out: ParentDraft[] = [];
  for (const kind of PARENT_KINDS) {
    const first = kind === "FATHER" ? parents.father : parents.mother;
    if (!first) continue;
    out.push({ kind, checked: true, firstName: first, lastName: surname, surnameAssumed: surname !== "" });
  }
  return out;
}

/**
 * The parents „Adaugă nou" offers: both, unticked, nothing typed yet but the
 * holder's surname as an assumption.
 */
export function blankDrafts(holderLastName: string): ParentDraft[] {
  const surname = holderLastName.trim();
  return PARENT_KINDS.map((kind) => ({
    kind,
    checked: false,
    firstName: "",
    lastName: surname,
    surnameAssumed: surname !== "",
  }));
}

/**
 * The parents „Creează persoană din CI" offers.               (Slice #38.44)
 *
 * Both, always (Ask first 2): one the card names, ticked and filled; one it
 * does not — a card that prints no parents, or a read that missed them — as
 * „Adaugă nou" offers it, unticked and empty, to type.
 */
export function offeredDrafts(parents: CardParents, holderLastName: string): ParentDraft[] {
  const read = draftsFromCard(parents, holderLastName);
  return blankDrafts(holderLastName).map((blank) => read.find((d) => d.kind === blank.kind) ?? blank);
}

/**
 * The holder's surname changed in the form: every parent whose surname is
 * still the ASSUMED one follows it; one the user typed or confirmed stays.
 */
export function followHolderSurname(drafts: readonly ParentDraft[], holderLastName: string): ParentDraft[] {
  const surname = holderLastName.trim();
  return drafts.map((d) =>
    d.surnameAssumed || d.lastName.trim() === ""
      ? { ...d, lastName: surname, surnameAssumed: surname !== "" }
      : d,
  );
}

/** The user edited a parent's surname: it is theirs now, not an assumption. */
export function withSurname(draft: ParentDraft, lastName: string): ParentDraft {
  return { ...draft, lastName, surnameAssumed: false };
}

/** The parents to create: ticked, with a first name and a surname. */
export function parentsToCreate(drafts: readonly ParentDraft[]): ParentDraft[] {
  return drafts.filter((d) => d.checked && d.firstName.trim() !== "" && d.lastName.trim() !== "");
}

/** A ticked parent that cannot be created yet — the review says which field is missing. */
export function incompleteParents(drafts: readonly ParentDraft[]): ParentDraft[] {
  return drafts.filter((d) => d.checked && (d.firstName.trim() === "" || d.lastName.trim() === ""));
}

/** „Nume Prenume", the order the archive writes a natural person's name in. */
export function personName(lastName: string | null | undefined, firstName: string | null | undefined): string {
  return [lastName, firstName].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
}

/**
 * The one „Note" line a parent created from a card carries:
 * „Creat din cartea de identitate a lui {Nume Prenume} ({cod PPERS})", and the
 * card's DOC code when the card is a Document.
 */
export function parentNote(holder: { name: string; code: string | null; documentCode?: string | null }): string {
  const who = holder.code ? `${holder.name} (${holder.code})` : holder.name;
  const card = holder.documentCode ? `cartea de identitate ${holder.documentCode}` : "cartea de identitate";
  return `Creat din ${card} a lui ${who}`;
}

export const PARENT_PROVENANCE: ProvenanceCode = "RELATIVE_ID_CARD";

/** The POST /api/people body for a parent. */
export function parentPersonBody(draft: ParentDraft, note: string): {
  firstName: string;
  lastName: string;
  gender: "MALE" | "FEMALE";
  notes: string;
  provenance: ProvenanceCode;
} {
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    gender: parentGender(draft.kind),
    notes: note,
    provenance: PARENT_PROVENANCE,
  };
}

/**
 * The person ↔ person link for a parent: the PARENT holds the role („Tată" /
 * „Mamă") towards the holder, so the holder's tile reads „Tată" and the
 * parent's reads the converse („Fiu" / „Fiică" by the holder's gender).
 * `associatePersonsToPerson(holderId, [parentId], role)` makes the TICKED
 * person — the parent — the holder of the role.
 */
export function parentLink(holderId: string, parentId: string, kind: ParentKind): {
  url: string;
  body: { parentId: string; kind: ParentKind };
} {
  return {
    url: `/api/people/${encodeURIComponent(holderId)}/parents`,
    body: { parentId, kind },
  };
}

/** What happened to one parent, for the row that reports it. */
export type ParentOutcome = {
  kind: ParentKind;
  result: "created" | "linked" | "skipped" | "failed";
  personId?: string;
  error?: string;
};

/**
 * One sentence per parent, for the import row and its saved report — the same
 * words in both. `t` is the `parentsFromIdCard` namespace.
 */
export function parentOutcomeSentences(
  outcomes: readonly ParentOutcome[] | undefined,
  t: (key: string, values?: Record<string, string>) => string,
): string[] {
  return (outcomes ?? []).map((o) => {
    const who = t(o.kind === "FATHER" ? "whoFather" : "whoMother");
    switch (o.result) {
      case "created": return t("outcomeCreated", { who });
      case "linked":  return t("outcomeLinked", { who });
      case "skipped": return t("outcomeSkipped", { who });
      case "failed":  return t("outcomeFailed", { who, error: o.error ?? "" });
    }
  });
}
