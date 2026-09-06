/**
 * Resolving a model's free-text reading against a lookup list.   (Slice #34.02)
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * `extract-id-card`'s route already did this once, for citizenship: it takes
 * the model's `citizenshipRaw` — "ROU", "Romana", "cetățenie: română" — and
 * resolves it against the LIVE `lookup_citizenship` rows by exact name, by
 * substring, and through a 26-entry alias table. Where it cannot, it flags the
 * field rather than guessing, "per Adrian's standing instruction".
 *
 * #34.02 needs exactly that for a card's ISSUING AUTHORITY, and the instruction
 * it carries is to reuse the matcher rather than write a second one. So the
 * rule moved here and the route calls it twice. One matcher, two alias tables.
 *
 * ⚠️ **WHAT THIS IS NOT ALLOWED TO DO: CREATE A ROW.**
 * `src/lib/import/id-card.ts` refuses, deliberately and at length, to mint a
 * `lookup_institution` row from a model's reading — "SPCLEP Bragadiru" read off
 * a card is a string, not a fact about this archive — and #34.02 KEEPS that
 * refusal. What #34.02 sets out to replace is the alternative that refusal
 * chose: put the authority into a free-text `subject` and move on, which throws
 * the reading away. ⚠️ **That replacement is not done yet** —
 * `src/lib/import/id-card.ts` is untouched and still writes the authority to
 * `subject`; this module and the route's `institutionId` are the half that
 * needs no schema, and the dropdown that consumes them waits on the migration
 * confirmation. This module answers "is there already a row that means this?" and
 * nothing else. A miss is a MISS, returned as `null`, so the caller can put the
 * raw string in front of a person beside an empty dropdown and let THEM make
 * the row in one click, with the model's spelling on screen. A person pressing
 * that button is the vouching that `lookup_institution.origin = 'MANUAL'`
 * records.
 *
 * ⚠️ **Containment is ONE-DIRECTIONAL: a row name inside a raw, never a raw
 * inside a row name.** So a row stored as "SPCLEP Bragadiru, Județul Ilfov"
 * is NOT found by a later card read as "SPCLEP Bragadiru", and the person is
 * offered the same empty dropdown twice and can make a duplicate row. That is
 * the pre-existing behaviour and this slice does not change it; the honest
 * claim is that the loop closes when the later reading CONTAINS the stored
 * name, which is the common case and not the only one.
 *
 * ⚠️ **A MISS IS THE EXPECTED ANSWER FOR AN ID CARD, NOT A FAILURE.** No
 * seeded institution is an identity-card issuer, so nothing here can or should
 * resolve SPCLEP. Widening the rules until it did would mean guessing an
 * authority onto a cadastral office or a court — wrong, and wrong silently.
 *
 * PURE ON PURPOSE. No React, no DB, no next/*. It takes rows the caller has
 * already read and returns an id or null, which is what lets one rule serve a
 * server route today and a dialog tomorrow. Unit-tested in
 * src/__tests__/lookup-name-match.test.ts.
 */

/**
 * Two spellings a business user would read as the same words.
 *
 * NFD then strip combining marks, rather than a Romanian character map: `ș`
 * and `ț` exist in Unicode in two spellings each — comma-below (U+0219/U+021B,
 * correct Romanian) and cedilla (U+015F/U+0163, what older Windows keyboards
 * and a good deal of scanned OCR produce) — and NFD reduces both to `s`/`t`
 * without the map having to list them. The same argument
 * `normaliseDocumentTypeName` makes one folder over.
 *
 * ⚠️ **SEPARATORS COLLAPSE TO ONE SPACE; THEY ARE NOT DELETED.** This is where
 * the fold deliberately differs from `normaliseDocumentTypeName`, which deletes
 * them. That function asks "are these two names one name?", where deleting is
 * right. This one feeds a SUBSTRING test, and a substring test over a string
 * with the gaps removed has no word boundaries left to respect: "ANAF" would be
 * found inside a hypothetical "…an afacerilor" the moment the space between
 * them was gone. Single spaces are what make `containsAsWord` mean anything.
 *
 * ⚠️ **A DOTTED ACRONYM JOINS BACK INTO ONE WORD**, so "S.P.C.L.E.P." folds to
 * `spclep` and not to `s p c l e p`. Without it the two spellings of every
 * acronym in this domain — OCPI, SPCLEP, DGEP — are different strings, and the
 * loop this slice exists to close would not close: a person adds "SPCLEP
 * Bragadiru" from one card and the next card, read as "S.P.C.L.E.P.
 * Bragadiru", would fail to find the row they had just made.
 *
 * ⚠️ **THE TRIGGER IS THE DOTS, NOT THE LETTER COUNT, and two review rounds
 * are why.** The rule started as "join any run of single-letter tokens", which
 * is the same thing for an acronym and catastrophic for ordinary Romanian: it
 * folded "Secția a 2-a" to `sectia a2a` (round 2 — fixed by excluding digits)
 * and "Secția a I-a" to `sectia aia` (round 3 — not fixed by that, because
 * roman numerals ARE letters, and a court section is written `a I-a` far more
 * often than `a 2-a`). `a` is an ordinary article and the numeral beside it is
 * ordinary text; no amount of counting letters can tell the two apart. The
 * dots can, because they are what an acronym actually carries. The cost is
 * that a space-separated acronym with no dots ("S P C L E P") does not join —
 * a spelling nothing in this domain produces.
 *
 * ⚠️ **Never written anywhere.** `lookup_*.name` keeps exactly what the person
 * or the model wrote; this form exists only for the duration of a comparison.
 */
export function foldLookupName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Two or more dotted single letters — "s.p.c.l.e.p." — become one word,
    // BEFORE the separators go, because the dots are the whole signal.
    .replace(/(?:[a-z]\.){2,}/g, (run) => run.replace(/\./g, ""))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Where does `haystack` contain `needle` as a whole word, or -1?
 *
 * ⚠️ **Index arithmetic rather than `\b`, and that is a project rule rather
 * than a preference** — `\b` is ASCII-only and this codebase forbids it for
 * matching Romanian (`C:\dev\CLAUDE.md` → Design habits). Both arguments here
 * are already folded to `[a-z0-9 ]`, so `\b` would in fact be safe; using it
 * anyway would leave a `\b` in a Romanian-matching file for the next reader to
 * copy somewhere it is not. It would also need the needle escaped, since a row
 * name is data.
 *
 * Whole-word, not bare `includes`, because the needle is the SHORTER string:
 * "OCPI" appearing inside a longer word is a coincidence, not a reading.
 */
function wordIndexOf(haystack: string, needle: string): number {
  if (needle === "") return -1;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return -1;
    const before = at === 0 ? " " : haystack[at - 1];
    const afterIdx = at + needle.length;
    const after = afterIdx >= haystack.length ? " " : haystack[afterIdx];
    if (before === " " && after === " ") return at;
    from = at + 1;
  }
}

/** `wordIndexOf` where only the yes/no matters. */
function containsAsWord(haystack: string, needle: string): boolean {
  return wordIndexOf(haystack, needle) !== -1;
}

/** The shape every lookup row this module can match arrives in. */
export type NamedLookupRow = { id: string; name: string };

/**
 * A raw reading resolved against a list, or `null` because nothing matched.
 *
 * Four stages, the first three of them the tests the citizenship matcher already
 * ran — though not in the shape it ran them, and a review round asked for that
 * to be said. The old matcher was ONE interleaved pass per row
 * (`name === norm || norm.includes(name)`), so the first row satisfying either
 * test won; these stages ask every row the first question before any row the
 * second. It is the better order — with rows "Notariat" and "Notariat Public"
 * and a raw of "Notariat Public", the old pass answered "Notariat" — and it is
 * a second deliberate behaviour change, alongside the diacritic fold:
 *
 *   1. the folded raw IS a row's folded name;
 *   2. the folded raw CONTAINS a row's folded name as a whole word — which
 *      catches "cetățenie: română", and "O.C.P.I. Ilfov" against a row named
 *      "OCPI";
 *   3. the folded raw IS a key in the caller's alias table, whose value names a
 *      row — "ROU", "Agenția Națională de Administrare Fiscală";
 *   4. the folded raw CONTAINS an alias key as a whole word, earliest in the
 *      raw first — "Judecătoria Buftea", "Tribunalul Ilfov". Stage 4 is the one
 *      addition, and it is strictly additive: every raw that resolved through
 *      stage 3 still resolves there first.
 *
 * ⚠️ **AN AMBIGUOUS RAW STILL RESOLVES RATHER THAN REFUSING, and the caller's
 * order still decides which way.** "Americană/Română" contains two seeded
 * citizenship names and answers `Română`, because the seed gives it
 * `sort_order` 1 and the route reads in that order. Refusing instead — and
 * letting the caller flag the field for a person — is arguably better and was
 * deliberately NOT taken here: it changes a shipped citizenship path inside a
 * slice meant to be reusing it. Worth revisiting when somebody has an opinion
 * about what a two-citizenship reading should do.
 *
 * The ONE place caller order is overridden is stated at stage 2 below: a match
 * whose name sits inside another match's name loses to the longer one.
 *
 * ⚠️ **An empty fold matches nothing, including another empty fold.** A raw of
 * "—" or of a single space folds to "", and two such are not evidence that they
 * are the same thing — the guard `sameDocumentTypeName` carries, for the same
 * reason: one punctuation-only row would otherwise absorb every reading.
 */
export function matchLookupByName(
  raw: string | null | undefined,
  rows: readonly NamedLookupRow[],
  aliases: Readonly<Record<string, string>> = {},
): string | null {
  if (!raw) return null;
  const norm = foldLookupName(raw);
  if (norm === "") return null;

  const folded = rows
    .map((r) => ({ row: r, name: foldLookupName(r.name) }))
    .filter((r) => r.name !== "");

  const exact = folded.find((r) => r.name === norm);
  if (exact) return exact.row.id;

  // ⚠️ **CALLER ORDER WINS, EXCEPT WHERE ONE MATCH'S NAME IS INSIDE ANOTHER'S —
  // and it took two review rounds to get this narrow.**
  //
  // Round 1 found the real defect: with both `Primăria Municipiului` and
  // `Primăria Municipiului București` in the list, "Primăria Municipiului
  // București, Sector 6" resolved to the GENERIC row, because a plain `find`
  // takes whichever row Postgres returned first and the seeded rows come back
  // first. That is the silent wrong guess `INSTITUTION_ALIASES` refuses to make
  // for `primaria`, arriving through the other door — and it becomes reachable
  // the first time this slice's "adaugă" button is used.
  //
  // ⚠️ **Round 2 found that the obvious fix — sort by length — was WORSE than
  // the defect, on the list this project cares most about.** `romana` is the
  // SHORTEST folded name in `lookup_citizenship`, so sorting by length made
  // every raw naming Română plus one other citizenship resolve to the other
  // one: "Americană/Română" answered `Americană`, in a Romanian property
  // archive. It also threw away the `sort_order` the seed sets deliberately
  // (Română is 1) and that the route's own `orderBy` was added to respect.
  //
  // So the preference is exactly the relation round 1 found and nothing wider:
  // a match is skipped only when ANOTHER match's name strictly contains it as a
  // word. `Primăria Municipiului` is inside `Primăria Municipiului București`
  // and loses; `romana` is not inside `americana` and keeps its place. Strictly
  // longer, so two rows folding to the SAME name cannot eliminate each other —
  // an archive holding both "Notariat" and "notariat" still answers, in caller
  // order.
  const matches = folded.filter((r) => containsAsWord(norm, r.name));
  const contained = matches.find(
    (m) =>
      !matches.some(
        (other) => other.name.length > m.name.length && containsAsWord(other.name, m.name),
      ),
  );
  if (contained) return contained.row.id;

  const rowNamed = (aliasValue: string): string | null => {
    const target = foldLookupName(aliasValue);
    const match = folded.find((r) => r.name === target);
    return match ? match.row.id : null;
  };

  // ⚠️ **`Object.hasOwn`, NEVER a bare `aliases[norm]`, and a review round found
  // the crash.** `Object.freeze({...})` keeps `Object.prototype`, so
  // `aliases["constructor"]` yields the `Object` FUNCTION, `if (whole)` is
  // truthy, and the function reaches `foldLookupName` as
  // `TypeError: value.normalize is not a function`. Both raws that reach this
  // module are model-controlled strings, and the fold's own output alphabet
  // `[a-z0-9 ]` contains "constructor" exactly — so a card image was one
  // unhandled 500 away, in a route where this call sits outside every
  // `catch`. Stage 4 was never exposed: it walks `Object.keys`.
  const whole = Object.hasOwn(aliases, norm) ? aliases[norm] : undefined;
  if (whole) {
    const id = rowNamed(whole);
    if (id) return id;
  }

  // ⚠️ **EARLIEST IN THE RAW FIRST, then longest key — BECAUSE AN ALIAS TABLE
  // HAS NO `sort_order`, not because position is this module's principle.**
  // The rows above have a curated order and use it; alias keys have nothing, so
  // position in the reading is the only signal left, and it is a reasonable one
  // (an authority line names its body first). Round 2 found the alternative
  // failing on "Tribunalul Ilfov - Judecătoria Buftea", where sorting by key
  // length alone answered `Judecătorie` for a decision the Tribunal issued.
  // Length is the tie-break, so `consiliul judetean` still beats `consiliul`
  // where both start at the same place.
  //
  // ⚠️ **The two stages therefore break ties differently, and round 3 is why
  // that is stated rather than smoothed over.** A raw naming two bodies answers
  // by `sort_order` when both are spelled as row names (stage 2) and by
  // position when they arrive through aliases (stage 4) — so "Tribunalul Ilfov
  // … Judecătorie" answers `Judecătorie`, the row named second. Making stage 2
  // positional too would re-break "Americană/Română", which is the case the
  // curated order exists for. A per-list policy is the real answer and it needs
  // a person with an opinion about what a two-body reading means; until then
  // the honest description is this one.
  const hits = Object.keys(aliases)
    .map((key) => ({ key, at: wordIndexOf(norm, key) }))
    .filter((h) => h.at !== -1)
    .sort((a, b) => a.at - b.at || b.key.length - a.key.length);
  for (const hit of hits) {
    const id = rowNamed(aliases[hit.key]);
    if (id) return id;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Citizenship
// ---------------------------------------------------------------------------

/**
 * Common ISO / English aliases for the seeded citizenship list (Slice 9.1
 * names), moved here verbatim from `extract-id-card`'s route.
 *
 * ⚠️ **Keys are FOLDED forms.** The route's table was keyed on
 * `raw.trim().toLowerCase()`, which never folded diacritics — so a card read as
 * "Romana" (no diacritic, which is what a great many scans produce, and one of
 * the two examples the route's own prompt gives the model) missed the direct
 * test against "Română", missed this table, and was flagged low-confidence for
 * a value the seeded list plainly holds. Folding both sides fixes it without
 * adding an entry, which is why "romana" is not below: it does not need to be.
 */
export const CITIZENSHIP_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  rou: "Română",
  ro: "Română",
  romania: "Română",
  romanian: "Română",
  md: "Moldoveană",
  mda: "Moldoveană",
  moldova: "Moldoveană",
  usa: "Americană",
  us: "Americană",
  american: "Americană",
  deu: "Germană",
  germany: "Germană",
  german: "Germană",
  fra: "Franceză",
  france: "Franceză",
  french: "Franceză",
  ita: "Italiană",
  italy: "Italiană",
  italian: "Italiană",
  esp: "Spaniolă",
  spain: "Spaniolă",
  spanish: "Spaniolă",
  gbr: "Engleză",
  uk: "Engleză",
  england: "Engleză",
  english: "Engleză",
});

/** Loose match of a free-text citizenship string against `lookup_citizenship`. */
export function matchCitizenship(
  raw: string | null | undefined,
  rows: readonly NamedLookupRow[],
): string | null {
  return matchLookupByName(raw, rows, CITIZENSHIP_ALIASES);
}

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------

/**
 * Aliases for the seeded `lookup_institution` list.
 *
 * ⚠️ **DELIBERATELY SHORT, AND NOT AN ATTEMPT TO COVER IDENTITY CARDS.** The
 * seven seeded rows — OCPI, Primăria Municipiului, Consiliu Județean, ANAF,
 * Notariat, Judecătorie, Tribunal — contain no identity-card issuer at all, so
 * no alias table could resolve "SPCLEP Bragadiru" or "Poliția Bragadiru"
 * against them, and one that pretended to would be mapping a reading onto a row
 * that means something else. A card's authority is therefore expected to MISS,
 * and the miss is the feature: it surfaces the raw string beside an empty
 * dropdown with an "adaugă" button, and the archive gets the row a PERSON
 * vouched for, spelled the way the card spells it.
 *
 * ⚠️ **AN ALIAS MAY ONLY EXPAND A ROW'S OWN NAME, OR NAME AN INSTANCE OF A ROW
 * THAT IS A GENERIC KIND — a review round removed the two that did neither.**
 * `ancpi` pointed at `OCPI`: ANCPI is the NATIONAL agency and the seeded row is
 * the county office (`institution_type` "Cadastru"). `administratia financiara`
 * pointed at `ANAF` and is the mirror image — a local office folded into the
 * national body. Both are gone. What survives is `Agenția Națională de
 * Administrare Fiscală` → `ANAF` (the row's own name, written out) and
 * `judecatoria`/`tribunalul` → `Judecătorie`/`Tribunal` (a court IS one of
 * those, and the row is the kind).
 *
 * ⚠️ **THIS RULE IS ABOUT THE TABLE, NOT ABOUT MATCHING GENERALLY, and a third
 * round is why that is said out loud.** Stage 2 resolves "ANAF - Administrația
 * Județeană a Finanțelor Publice Ilfov" to `ANAF` and "Primăria Municipiului
 * Ploiești" to `Primăria Municipiului` — not because of an alias, but because
 * the raw spells the row's own name. Removing `administratia financiara` never
 * blocked that and was not meant to; it blocked the phrasings that name the
 * office WITHOUT naming the row.
 *
 * ⚠️ **No key may equal a row's own folded name.** `primaria municipiului` was
 * such a key and could never fire: stage 1 or stage 2 answers first, and where
 * the row is absent the alias resolves to nothing anyway. A test asserts this
 * now, because "every alias names a real row" passed it happily.
 *
 * "Judecătoria Buftea" → `Judecătorie` and "Tribunalul Ilfov" → `Tribunal` are
 * here because those rows ARE the generic kind, carrying `institution_type`
 * "Juridic". "Primăria …" is deliberately absent for the mirror-image reason:
 * the seeded row is `Primăria Municipiului`, which is not a generic town hall
 * but a specific one, and folding "Primăria Bragadiru" — an oraș, not a
 * municipiu — into it would be the same silent wrong guess this table refuses
 * to make for SPCLEP. `Consiliu Județean` gets `consiliul judetean` and NOT
 * `consiliul local`, on the same rule.
 *
 * The table's real job is the expansions and abbreviations a model writes for
 * rows that DO exist, on the documents (not cards) where those authorities
 * appear. An entry naming a row this database does not hold resolves to nothing
 * and costs only its line — asserted, so it cannot rot unnoticed.
 *
 * Keys are folded forms — see `CITIZENSHIP_ALIASES`.
 */
export const INSTITUTION_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "agentia nationala de administrare fiscala": "ANAF",
  "oficiul de cadastru si publicitate imobiliara": "OCPI",
  "oficiul de cadastru": "OCPI",
  "consiliul judetean": "Consiliu Județean",
  "birou notarial": "Notariat",
  "birou notar public": "Notariat",
  "notar public": "Notariat",
  judecatoria: "Judecătorie",
  judecatoriei: "Judecătorie",
  tribunalul: "Tribunal",
  tribunalului: "Tribunal",
});

/**
 * Loose match of a model's issuing-authority reading against
 * `lookup_institution`.
 *
 * Returns `null` far more often than `matchCitizenship` does, on purpose — see
 * `INSTITUTION_ALIASES`. A `null` here is an instruction to ASK, never a licence
 * to create.
 */
export function matchInstitution(
  raw: string | null | undefined,
  rows: readonly NamedLookupRow[],
): string | null {
  return matchLookupByName(raw, rows, INSTITUTION_ALIASES);
}
