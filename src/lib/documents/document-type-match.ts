/**
 * When two document type NAMES are the same name, and which stored type a
 * classifier's answer means.                                   (Slice #29.06)
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * Three pieces of code used to answer "is this the same type?" three different
 * ways, and the disagreement is what produced two sale-purchase types out of
 * one document (finding F7 of the 29.01 report):
 *
 *   - `ensureDocType` in the import wizard matched on `trim()` +
 *     `toLowerCase()` and folded no diacritics, so "Contract de arendă" and
 *     "Contract de arenda" — the same document read twice, once from a scan
 *     that dropped the diacritic — were two types.
 *   - `ai-interpret` matched BYTE-FOR-BYTE in SQL (`eq(name, classifiedLabel)`),
 *     so it was case-sensitive where the wizard was not: "titlu de
 *     proprietate" matched "Titlu de Proprietate" in one writer and not in the
 *     other.
 *   - `generateUniqueDocumentTypeKey` folded Romanian diacritics before
 *     slugging, so both spellings resolved to ONE key — which is why the
 *     second create then died on the UNIQUE constraint instead of being
 *     recognised as the same type.
 *
 * One rule, here, used by everything that resolves a classifier's answer: the
 * import wizard (client), the resolver behind it (server) and the discovery
 * review dialog's duplicate-name refusal.
 *
 * ⚠️ **THE FOLD HAS TO BE AT LEAST AS AGGRESSIVE AS THE KEY SLUG, AND THAT IS
 * A LOAD-BEARING PROPERTY RATHER THAN A COINCIDENCE.** `slugifyLookupKey`
 * (src/lib/admin/value-lists/keys.ts) decides the UNIQUE column; this decides
 * whether two names are one name, and — since the resolver's advisory lock is
 * keyed on this fold — which creates are serialised against each other. Two
 * names that slug to one key while reading here as DIFFERENT names take
 * different locks, so they can race for that key: measured, the loser's key
 * generator simply re-reads and picks `_2`, so the cost is one extra row and
 * an occasional 23505 the retry absorbs. ⚠️ **An earlier version of this
 * paragraph said such a pair would loop until the attempt budget ran out; a
 * seventh review round ran it and it does not.** The property is still worth
 * holding — every pair it covers is one create instead of two — and
 * `document-type-match.test.ts` asserts the implication over a table of real
 * archive names, including every Romanian diacritic in both Unicode spellings,
 * plus the one counterexample outside that vocabulary.
 *
 * ⚠️ **NON-ALPHANUMERICS ARE DELETED, NOT COLLAPSED TO A SEPARATOR.** So
 * "Titlu de proprietate" and "Titlu-de-proprietate" are one name, and so are
 * "Proces verbal" and "Proces-verbal" — which is what a business user reading
 * the dropdown would say too. It is deliberately no cleverer than that: the
 * archive holds three deliberate alternate WORDINGS (`AUTORIZATIE` /
 * `AUTORIZATIE_ALT` and two more) that a fuzzy test would wrongly collapse, and
 * they differ by wording, which survives this.
 *
 * PURE ON PURPOSE. No React, no DB, no next/*. It is imported from a route
 * (server), from the import wizard and from the review dialog (client), which
 * is the whole point — a rule with three copies is three rules.
 */

/**
 * What the classifier says when it has no idea.
 *
 * ⚠️ **Shared with `scan-folder`'s route, which is what WRITES it** — it
 * defaults an absent `classifiedLabel` to this value, and since this slice it
 * does so by importing this constant rather than by spelling the string out, as
 * the wizard and `ai-interpret` also used to. It is
 * a sentinel VALUE flowing through the app, not a UI string, so it does not
 * belong in `messages/*.json` — the i18n rule's own "hardcoded Romanian in a
 * data value is not an i18n violation".
 */
export const UNCLASSIFIED_DOCUMENT_LABEL = "Document necunoscut";

/**
 * …and the key that says the same thing.
 *
 * `lookup_document_type` really does hold a row with this key — displayed as
 * `NECLASIFICAT` on a migrated database and as `Unclassified` on a rebuilt
 * cloud project, a divergence `src/db/rebuild-known-differences.txt` records as
 * open and assigns to Slice #29.07 — pinned first in the admin list. Which is
 * why it cannot simply be looked up like any other key: a classifier answer of UNCLASSIFIED means "I could not
 * tell", and filing a document under the catch-all on the strength of it would
 * make "the model had no idea" indistinguishable from "the model said
 * NECLASIFICAT" — the very confusion finding F1 is about.
 */
export const UNCLASSIFIED_DOCUMENT_TYPE_KEY = "UNCLASSIFIED";

/**
 * Every name that MEANS "I could not tell", independent of what is stored.
 *                                        (Slice #29.06, fourth review round)
 *
 * `Document necunoscut` is a protocol constant — `scan-folder`'s route writes
 * it itself when the model gives no label — and the other two are the display
 * name the catch-all row carries **on the two databases this project actually
 * has**:
 *
 *   - a migrated dev database calls it `NECLASIFICAT`
 *     (`migration_043_doctype_cleanup.sql`);
 *   - a **rebuilt cloud project calls it `Unclassified`**, because
 *     `src/db/sync-reference-data.sql:132` seeds that name and migration_043
 *     never runs against it. That is not speculation: Slice #31.01 measured it
 *     and `src/db/rebuild-known-differences.txt` records it under
 *     "NOT ACCEPTED - RECORDED", with reconciling it assigned to Slice #29.07.
 *
 * ⚠️ **THIS LIST AND `declinesAgainst`'S ROW READ ARE NOT ALTERNATIVES, AND A
 * ROUND SPENT BELIEVING THEY WERE.** The third review round deleted these two
 * literals, arguing the name is data and the row is the only honest source. The
 * fourth round measured what that costs on the cloud database: the row is
 * called `Unclassified`, Haiku is asked for a *Romanian* name beside an
 * UNCLASSIFIED key, so it writes "Neclasificat" — which matches neither the
 * sentinel nor the row — and the resolver CREATES a `lookup_document_type` row
 * named "Neclasificat", origin IMPORT, files the document on it, draws no note
 * because the outcome is `created`, and then spends a billed discovery read
 * looking for a form for a type that means "unclassified". Findings F1 and F7,
 * rebuilt inside the fix for them. The list covers the names the row is known
 * to have; the row read covers the name Adrian gives it tomorrow.
 *
 * ⚠️ **A hand-created type genuinely named "Neclasificat" is NOT locked out by
 * this — and a FIFTH round moved the test to make that true.** The claim was
 * made in round four and was false when made: the list lived inside
 * `classifiedLabelOf`, which `matchDocumentType` calls to get the label, so it
 * ran BEFORE the name pass rather than after it and a stored row of that name
 * could never be reached by any classifier answer. It lives in
 * `declinesAgainst` now, which `resolveAgainstTypes` asks strictly after
 * `matchDocumentType` — so a stored row wins, and the list only ever speaks
 * about a name nothing holds.
 */
const UNCLASSIFIED_LABELS = [
  UNCLASSIFIED_DOCUMENT_LABEL,
  "Neclasificat",
  "Unclassified",
] as const;

/**
 * Does this NAME mean "no answer", whoever wrote it?
 *
 * ⚠️ **Asked of a stored row's name as well as of a model's label, and a sixth
 * review round is why.** An archive can hold a `lookup_document_type` row
 * literally called "Neclasificat" — pre-#29.06 `ai-interpret` name-matched
 * byte-for-byte, so a Romanian "Neclasificat" missed the uppercase
 * `NECLASIFICAT` row and was CREATED as a second type. That row is keyed
 * `NECLASIFICAT`, not `UNCLASSIFIED`, so the key guard does not cover it, and
 * without this test the name pass would match it and report an ordinary
 * `matched`: every declining document filed silently under a type meaning
 * "unclassified", and then given a billed discovery read. Finding F1, on the
 * exact archive this slice was written for.
 *
 * ⚠️ **The cost is stated rather than hidden: a type a person deliberately
 * named "Neclasificat" cannot be reached by a CLASSIFIER answer.** It can still
 * be chosen by hand in the document form's dropdown; what it cannot do is
 * collect documents automatically. That is the right way round — a type whose
 * name means "unclassified" is not somewhere an import should be filing things
 * on its own — and it is the trade the fifth round got backwards by making the
 * legitimate case reachable and the junk case silent.
 */
function meansUnclassified(name: string): boolean {
  return UNCLASSIFIED_LABELS.some((known) => sameDocumentTypeName(known, name));
}

/**
 * Two names a business user would read as the same name.
 *
 * NFD then strip combining marks, rather than a Romanian character map: `ș`
 * and `ț` exist in Unicode in two spellings each — comma-below (U+0219/U+021B,
 * correct Romanian) and cedilla (U+015F/U+0163, what older Windows keyboards
 * and a good deal of scanned OCR produce) — and NFD reduces both to `s`/`t`
 * without the map having to list them. It also folds every OTHER language's
 * accents, which costs nothing and is the safe direction: over-folding merges
 * two names that would look identical on screen anyway.
 *
 * NOT used for storage or lookup: `lookup_document_type.name` keeps exactly
 * what the user or the model wrote, and nothing ever writes the normalised
 * form anywhere.
 */
export function normaliseDocumentTypeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * ⚠️ **An empty normalised form is never equal to anything, including another
 * empty one.** A name of "—" or of a single space normalises to "", and two
 * such names are not evidence that they are the same type; treating them as
 * equal would let one punctuation-only type absorb every other one. The same
 * guard `sameTypeName` carried in the review dialog, kept when it moved here.
 */
export function sameDocumentTypeName(a: string, b: string): boolean {
  const left = normaliseDocumentTypeName(a);
  return left.length > 0 && left === normaliseDocumentTypeName(b);
}

/** What a classifier hands over: a key it recognised, a label it read, or neither. */
export type ClassifierAnswer = {
  /** `lookup_document_type.key`, when the model produced one it was taught. */
  typeKey?: string | null;
  /** …and the human-readable label it read off the document. */
  label?: string | null;
};

/** The three columns any resolver needs off a stored type. */
export type DocumentTypeCandidate = {
  id: string;
  key: string;
  name: string;
};

/**
 * The label, trimmed — or `null` when the answer carries no usable one.
 *
 * ⚠️ **THIS ANSWERS "IS THERE A LABEL AT ALL", NOT "WHAT DOES IT MEAN", AND A
 * FIFTH ROUND MOVED THE DIFFERENCE OUT.** "Document necunoscut" comes back from
 * here unchanged — `declinesAgainst` is what knows it means the model declined.
 * The split is not tidiness: `matchDocumentType` calls this function to GET its
 * label, so any test of MEANING living here would run before the name pass, and
 * that is what made a stored type genuinely called "Neclasificat" unreachable
 * by any classifier answer for one round.
 *
 * What is still refused here is a label that is not a label: absent, blank, or
 * one that normalises to nothing. A type created from any of those would be a
 * `lookup_document_type` row named after the absence of an answer — permanent,
 * and offered in the type dropdown of every document forever.
 *
 * ⚠️ **AND NEITHER IS A LABEL THAT NORMALISES TO NOTHING — an adversarial round
 * found what leaving that out costs, and it is the worst ending in this
 * module.** "—", "-", "...", "?" and "·" are all real classifier output, and
 * they normalise to the empty string, which `sameDocumentTypeName` refuses to
 * match against ANYTHING, including an identical row. So such a label could
 * never match a stored type: `matchDocumentType` returned null, the resolver
 * created a row, and the NEXT document of the same label did not match it
 * either — one junk `lookup_document_type` row per document, thirty for a
 * thirty-page folder, and thirty more on the next run.
 *
 * The pre-slice code did not have this hole for an accidental reason: its name
 * index was keyed on the RAW lowercased label, so "—" deduped against itself.
 * The fold that fixes the diacritics bug is what opened it, which is why the
 * guard belongs here — on the one function that decides what a usable label is
 * — rather than at the two call sites that would each have to remember.
 */
export function classifiedLabelOf(answer: ClassifierAnswer): string | null {
  const trimmed = answer.label?.trim();
  if (!trimmed) return null;
  if (normaliseDocumentTypeName(trimmed) === "") return null;
  return trimmed;
}

/** Which stored type the answer meant, and how that was decided. */
export type DocumentTypeMatch<T extends DocumentTypeCandidate> = {
  row: T;
  /** `key` — the model named a key we hold. `name` — its label reads as one. */
  how: "key" | "name";
};

/**
 * The stored type a classifier's answer means, or `null` if we hold none.
 *
 * Key first, then name, and the order is the one both old writers already
 * used: a key is a fact the model was taught, a label is prose it read.
 *
 * ⚠️ **An UNCLASSIFIED key is skipped rather than looked up, and BOTH callers
 * already did this — measured, not assumed.** `lookup_document_type` really
 * holds a NECLASIFICAT row, so a naive lookup would succeed and file the
 * document under the catch-all on the strength of an answer that says nothing.
 * `ensureDocType` skipped the key explicitly; `ai-interpret` never let one
 * through, because it narrows `suggestedTypeKey` to `KNOWN_TYPE_KEYS` minus
 * UNCLASSIFIED where it reads the model's output. Hoisting the test here is
 * what makes it a property of the rule rather than of two call sites, and it
 * means the LABEL is still tried — where that is absent too, the caller keeps
 * whatever it had.
 *
 * ⚠️ **The first name match wins, and two rows CAN share a normalised name.**
 * Nothing in the schema makes `name` unique — only `key` is — so an archive
 * that already holds "Contract de arendă" and "Contract de arenda" from before
 * this slice has two rows that both answer here. Picking the first in the
 * order the caller read them is stable (both the route and the resolver read
 * `listValues`' order: UNCLASSIFIED pinned, then by name) and, more to the
 * point, it is the same row every time — a resolver that picked differently on
 * two consecutive documents would split one folder's archive across both rows.
 * Merging them is a different problem with a different answer and is not this
 * slice's.
 */
export function matchDocumentType<T extends DocumentTypeCandidate>(
  rows: readonly T[],
  answer: ClassifierAnswer,
): DocumentTypeMatch<T> | null {
  const typeKey = answer.typeKey?.trim();
  if (typeKey && typeKey !== UNCLASSIFIED_DOCUMENT_TYPE_KEY) {
    const byKey = rows.find((row) => row.key === typeKey);
    if (byKey) return { row: byKey, how: "key" };
  }

  const label = classifiedLabelOf(answer);
  if (label === null) return null;

  // ⚠️ **NO ROW THAT MEANS "NO ANSWER" IS A NAME MATCH — by key OR by name.**
  // A classifier's prose must never land on one, however it is spelled:
  // `migration_043` renamed the catch-all to NECLASIFICAT and the classify
  // prompt asks for a short Romanian name beside the key, so "Neclasificat" is
  // exactly what a declining model writes, and matching it would report the
  // silence finding F1 is about as an ordinary match.
  //
  //   - `key === "UNCLASSIFIED"` catches the catch-all whatever it is RENAMED
  //     to (a second review round);
  //   - `meansUnclassified(row.name)` catches a row that is NOT the catch-all
  //     and is named like one — which an archive really can hold, because the
  //     byte-for-byte matching this slice replaces created exactly that (a
  //     sixth review round).
  //
  // What happens to such a label instead is `declinesAgainst`'s business.
  const byName = rows.find(
    (row) =>
      row.key !== UNCLASSIFIED_DOCUMENT_TYPE_KEY &&
      !meansUnclassified(row.name) &&
      sameDocumentTypeName(row.name, label),
  );
  return byName ? { row: byName, how: "name" } : null;
}

/**
 * Does this answer amount to "I could not tell", GIVEN what the archive holds?
 *                                        (Slice #29.06, third review round)
 *
 * Two halves, and the second is the one no constant can supply:
 *
 *   - a label that is empty or normalises to nothing — decided by
 *     `classifiedLabelOf`, which needs no rows — and the names that MEAN "no
 *     answer" whatever is stored (`UNCLASSIFIED_LABELS`), tested HERE and
 *     deliberately not there: `matchDocumentType` calls `classifiedLabelOf` to
 *     get its label, so a test inside it would run before the name pass and
 *     make a stored type of that name permanently unreachable. A fifth review
 *     round found exactly that;
 *   - **the catch-all row's CURRENT display name**, whatever it is. The two
 *     names it is known to have are in `UNCLASSIFIED_LABELS` above, because a
 *     rebuilt cloud project and a migrated dev database genuinely disagree
 *     about it today; this half is what follows the rename Adrian makes from
 *     Reference Data tomorrow, which no constant can anticipate. A model that
 *     answers with that name is declining, and a resolver that did not know it
 *     would CREATE a second row of the same display name — two identical
 *     entries in every document's type dropdown, which is exactly the F7 shape
 *     this slice exists to remove.
 *
 * ⚠️ **Keyed on `key === "UNCLASSIFIED"`, not on the name matching a literal.**
 * The key is the immutable fact (`migration_043` says so in as many words:
 * "display name only; key stays UNCLASSIFIED so existing code references
 * continue to work"), so this follows a rename and does not have to be updated
 * with one.
 */
export function declinesAgainst<T extends DocumentTypeCandidate>(
  rows: readonly T[],
  answer: ClassifierAnswer,
): boolean {
  const label = classifiedLabelOf(answer);
  if (label === null) return true;
  if (meansUnclassified(label)) return true;
  return rows.some(
    (row) => row.key === UNCLASSIFIED_DOCUMENT_TYPE_KEY && sameDocumentTypeName(row.name, label),
  );
}

/** What a classifier's answer amounts to, against the types the archive holds. */
export type AnswerResolution<T extends DocumentTypeCandidate> =
  /** A type we already hold, and how that was decided. */
  | { kind: "match"; row: T; how: "key" | "name" }
  /** The model declined — no label, an empty one, or the catch-all's own name. */
  | { kind: "declined" }
  /** A real label naming a type nothing holds yet. */
  | { kind: "create"; name: string };

/**
 * THE whole rule, in one call.                (Slice #29.06, third round)
 *
 * ⚠️ **One function rather than two, and a review round is why.** The callers
 * used to ask `matchDocumentType` and then `classifiedLabelOf` in sequence, and
 * a rule that is two calls is a rule two callers can compose differently — the
 * wizard grew a fallback test the resolver did not have, on one of its two
 * exits, and it took a round to notice that the test was dead on one path and
 * wrong on the other. Everything that turns a classifier's answer into a
 * decision now asks exactly this, and gets three answers it must handle.
 */
export function resolveAgainstTypes<T extends DocumentTypeCandidate>(
  rows: readonly T[],
  answer: ClassifierAnswer,
): AnswerResolution<T> {
  const match = matchDocumentType(rows, answer);
  if (match) return { kind: "match", row: match.row, how: match.how };
  if (declinesAgainst(rows, answer)) return { kind: "declined" };
  // Non-null by construction: `declinesAgainst` returns true for every answer
  // `classifiedLabelOf` refuses, so reaching here means it gave a label.
  return { kind: "create", name: classifiedLabelOf(answer) as string };
}
