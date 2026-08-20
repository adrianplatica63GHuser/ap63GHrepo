/**
 * One rule about when two document type names are the same name.
 *                                                              (Slice #29.06)
 *
 * Three pieces of code used to answer this three ways, and the archive Adrian
 * ran in #29.01 is what the disagreement produced: two sale-purchase types out
 * of one document, and an identity card filed under NECLASIFICAT because its
 * create lost a race that a UNIQUE constraint decided on a key the NAME test
 * could not see.
 *
 * The section that matters most here is the third: the implication between the
 * key slug and this fold. It is not a property anybody would notice breaking by
 * reading the code, and breaking it turns the resolver's retry loop from "one
 * round settles it" into "three rounds and a 500".
 */

import {
  UNCLASSIFIED_DOCUMENT_LABEL,
  UNCLASSIFIED_DOCUMENT_TYPE_KEY,
  classifiedLabelOf,
  declinesAgainst,
  matchDocumentType,
  normaliseDocumentTypeName,
  resolveAgainstTypes,
  sameDocumentTypeName,
  type DocumentTypeCandidate,
} from "@/lib/documents/document-type-match";
import { slugifyLookupKey } from "@/lib/admin/value-lists/keys";

/**
 * Names off the real archive, plus the pairs that cost a slice each.
 *
 * ⚠️ **`ș` and `ț` appear in BOTH Unicode spellings.** Comma-below
 * (U+0219/U+021B) is correct Romanian; cedilla (U+015F/U+0163) is what older
 * Windows keyboards and a good deal of scanned OCR produce, and the two are
 * indistinguishable at the size a business user reads a dropdown at. A fold
 * that handled one and not the other would split the archive down a line
 * nobody can see.
 */
const ARCHIVE_NAMES = [
  "Contract de vânzare-cumpărare",
  "Contract de arendă",
  "Contract de arenda",
  "Titlu de proprietate",
  "titlu de proprietate",
  "Titlu de Proprietate",
  "Titlu-de-proprietate",
  "Proces verbal",
  "Proces-verbal",
  "Carte de identitate",
  "Extras de carte funciară",
  "Extras de carte funciara",
  "Autorizație de construire",
  "Autorizaţie de construire", // cedilla ţ, not comma-below ț
  "Adeverință",
  "Adeverinţă",
  "Certificat fiscal",
  "Încheiere de autentificare",
  "Incheiere de autentificare",
];

describe("normaliseDocumentTypeName", () => {
  it("folds case, spacing, punctuation and diacritics", () => {
    expect(normaliseDocumentTypeName("Contract de arendă")).toBe("contractdearenda");
    expect(normaliseDocumentTypeName("contract de arenda")).toBe("contractdearenda");
    expect(normaliseDocumentTypeName("Proces-verbal")).toBe("procesverbal");
    expect(normaliseDocumentTypeName("  Proces  verbal  ")).toBe("procesverbal");
  });

  /**
   * ⚠️ **Both Unicode spellings of every Romanian diacritic, measured rather
   * than assumed.** The comma-below letters decompose under NFD and the cedilla
   * ones do too, which is why a `.normalize("NFD")` beats the hand-written
   * character map `slugifyLookupKey` uses — that map lists both spellings
   * explicitly, and would silently miss a third.
   */
  it.each([
    ["ă", "a"], ["â", "a"], ["î", "i"],
    ["ș", "s"], ["ş", "s"],
    ["ț", "t"], ["ţ", "t"],
    ["Ă", "a"], ["Â", "a"], ["Î", "i"],
    ["Ș", "s"], ["Ş", "s"], ["Ț", "t"], ["Ţ", "t"],
  ])("folds %s to %s", (input, expected) => {
    expect(normaliseDocumentTypeName(input)).toBe(expected);
  });
});

describe("sameDocumentTypeName", () => {
  it("is true for the pairs a business user reads as one name", () => {
    expect(sameDocumentTypeName("Contract de arendă", "Contract de arenda")).toBe(true);
    expect(sameDocumentTypeName("titlu de proprietate", "Titlu de Proprietate")).toBe(true);
    expect(sameDocumentTypeName("Proces verbal", "Proces-verbal")).toBe(true);
    expect(sameDocumentTypeName("Autorizație de construire", "Autorizaţie de construire")).toBe(true);
  });

  it("is false where the WORDING differs, which is what the archive relies on", () => {
    // The archive holds deliberate alternate wordings — AUTORIZATIE and
    // AUTORIZATIE_ALT among them — and a fuzzy test would collapse them.
    expect(sameDocumentTypeName("Autorizație de construire", "Autorizație de demolare")).toBe(false);
    expect(sameDocumentTypeName("Contract de vânzare", "Contract de arendă")).toBe(false);
  });

  /**
   * ⚠️ **Two names that normalise to nothing are not the same name.** "—" and
   * " " both fold to "", and treating those as equal would let one
   * punctuation-only type absorb every other one that a user ever typed badly.
   */
  it("never matches on an empty normalised form", () => {
    expect(sameDocumentTypeName("—", "···")).toBe(false);
    expect(sameDocumentTypeName("", "")).toBe(false);
    expect(sameDocumentTypeName("   ", "Contract")).toBe(false);
  });
});

/**
 * THE IMPLICATION THE RESOLVER'S RETRY LOOP RESTS ON.
 *
 * `slugifyLookupKey` decides `lookup_document_type.key`, which is UNIQUE, and
 * the resolver's advisory lock is keyed on the fold this module owns. Two names
 * that slug to ONE key while reading here as TWO names therefore take two
 * locks, race for one key, and cost an extra row: one of them lands on `_2`.
 * Holding the implication is what keeps that to the exotic cases.
 *
 * ⚠️ **It does NOT cost the attempt budget, and a seventh review round
 * measured that after three earlier versions of this paragraph claimed it
 * did.** `generateUniqueKey` re-reads the taken keys immediately before its
 * insert, so the loser usually computes `_2` and succeeds on the first attempt;
 * a 23505 only arises in the narrower window where its key SELECT also precedes
 * the winner's commit, and the retry absorbs that in one round.
 *
 * The converse does NOT hold and is not asserted: "Café" and "Caf" fold to
 * different names and slug to the same key (`slugifyLookupKey` drops `é` as a
 * non-`A-Z` character rather than folding it).
 */
describe("the key slug and the name fold agree", () => {
  it.each(
    ARCHIVE_NAMES.flatMap((a) => ARCHIVE_NAMES.map((b) => [a, b] as const)),
  )("same key ⇒ same name: %s / %s", (a, b) => {
    if (slugifyLookupKey(a) === slugifyLookupKey(b)) {
      expect(sameDocumentTypeName(a, b)).toBe(true);
    }
  });

  it("really does exercise the interesting case", () => {
    // A guard on the guard: if every pair above had a distinct key the loop
    // would pass by asserting nothing at all.
    const collisions = ARCHIVE_NAMES.flatMap((a) =>
      ARCHIVE_NAMES.filter((b) => b !== a && slugifyLookupKey(a) === slugifyLookupKey(b)),
    );
    expect(collisions.length).toBeGreaterThan(0);
  });

  /**
   * ⚠️ **AND THE IMPLICATION IS NOT UNIVERSAL — this is the counterexample,
   * pinned so nobody "fixes" it in the wrong direction.** `slugifyLookupKey`
   * folds only the fourteen Romanian letters and DROPS every other non-`A-Z0-9`
   * character, while `normaliseDocumentTypeName` decomposes under NFD and keeps
   * the base letter. So "Café" slugs to `CAF` and normalises to `cafe`: same
   * key as "Caf", different name.
   *
   * That is survivable: the two take different advisory locks, race for the key
   * `CAF`, and the loser's key generator — which re-reads immediately before
   * its insert — gives the new row `CAF_2`, usually without any error at all.
   * What it must NEVER be is silently assumed away, and three versions of this
   * comment got the mechanism wrong before a seventh review round ran it.
   * `MAX_ATTEMPTS` is eight because of concurrent WRITERS, not because of this
   * family; see its docblock in `resolve-document-type.ts`.
   *
   * Romanian is the only version that matters here, and Romanian is safe: the
   * table above is the archive's own vocabulary and every pair in it holds.
   */
  it("does not hold for a non-Romanian accent, and the resolver knows it", () => {
    expect(slugifyLookupKey("Café")).toBe(slugifyLookupKey("Caf"));
    expect(sameDocumentTypeName("Café", "Caf")).toBe(false);
  });
});

describe("classifiedLabelOf", () => {
  it("trims a real label", () => {
    expect(classifiedLabelOf({ label: "  Contract de arendă " })).toBe("Contract de arendă");
  });

  it.each([[undefined], [null], [""], ["   "]])("refuses %p as a label", (label) => {
    expect(classifiedLabelOf({ label })).toBeNull();
  });

  /**
   * ⚠️ **A LABEL THAT NORMALISES TO NOTHING IS NOT A LABEL, AND AN ADVERSARIAL
   * ROUND IS WHY THIS TEST EXISTS.** `sameDocumentTypeName` refuses an empty
   * normalised form against ANYTHING, including an identical string — which is
   * right for a duplicate-name refusal and catastrophic for a create path.
   * Without this guard, a scan classifying thirty pages as "—" produced thirty
   * `lookup_document_type` rows, one per document, because the resolver could
   * never match the row it had just made; and thirty more on the next run. The
   * pre-slice code deduped these by accident, on the raw lowercased label.
   */
  it.each([["—"], ["-"], ["..."], ["?"], ["·"], ["/"], ["§ —"]])(
    "refuses %p, which normalises to nothing and so could never match itself",
    (label) => {
      expect(normaliseDocumentTypeName(label)).toBe("");
      expect(classifiedLabelOf({ label })).toBeNull();
    },
  );

  /**
   * ⚠️ **THE CATCH-ALL'S OWN NAME IS A WAY OF SAYING "I COULD NOT TELL", and a
   * second review round found it wide open.** `migration_043_doctype_cleanup`
   * renamed the UNCLASSIFIED row to `NECLASIFICAT`, and the classify prompt
   * asks for a short Romanian name beside the key — so "Neclasificat" is the
   * label a model produces when it declines. It is not "Document necunoscut",
   * it normalises to something non-empty, and it would have NAME-matched the
   * catch-all row and been reported as an ordinary match: the document filed
   * under NECLASIFICAT with the result screen saying nothing at all, which is
   * finding F1's silence reached through the door the key guard does not cover.
   */
  /**
   * ⚠️ **THE SENTINEL IS NOT REFUSED HERE EITHER, AND A FIFTH REVIEW ROUND
   * MOVED IT.** This function answers one question — "is there a label at all"
   * — and `matchDocumentType` calls it to GET that label. Every name test that
   * lived here therefore ran before the name pass; the one that mattered made a
   * stored type genuinely called "Neclasificat" unreachable by any classifier
   * answer. What a name MEANS is `declinesAgainst`'s question, asked strictly
   * after the match.
   */
  it.each([["document necunoscut"], ["Document  necunoscut."], ["DOCUMENT NECUNOSCUT"]])(
    "hands %p back — what it MEANS is decided one function along",
    (label) => {
      expect(classifiedLabelOf({ label })).toBe(label.trim());
    },
  );

  /**
   * ⚠️ **The catch-all's names are NOT refused here, and a fifth review round
   * moved the test that used to do it.** `matchDocumentType` calls this
   * function to get its label, so a name test living here runs BEFORE the name
   * pass — which made a stored type genuinely called "Neclasificat"
   * unreachable by any classifier answer. The rule is `declinesAgainst`'s, and
   * `resolveAgainstTypes` asks it strictly after the match.
   */
  it.each([["Neclasificat"], ["Unclassified"]])(
    "hands %p back too — a stored type may legitimately be called that",
    (label) => {
      expect(classifiedLabelOf({ label })).toBe(label);
    },
  );
});

/**
 * THE HOLE THE SECOND ROUND FOUND AND THE THIRD ROUND MOVED.
 *
 * `migration_043_doctype_cleanup.sql` renamed the UNCLASSIFIED row to
 * NECLASIFICAT, and `CLASSIFY_SYSTEM_PROMPT` asks the model for a short
 * Romanian name beside the key — so "Neclasificat" is what a declining model
 * writes. Without this rule it NAME-matched the catch-all row and was reported
 * as an ordinary match: the document filed under NECLASIFICAT with the result
 * screen saying nothing at all, which is finding F1's silence.
 *
 * The rule is keyed on `key === "UNCLASSIFIED"` and reads the NAME off the row,
 * so it survives the rename that made this a bug in the first place.
 */
describe("declinesAgainst", () => {
  const rows: DocumentTypeCandidate[] = [
    { id: "u", key: UNCLASSIFIED_DOCUMENT_TYPE_KEY, name: "NECLASIFICAT" },
    { id: "a", key: "CONTRACT_DE_ARENDA", name: "Contract de arendă" },
  ];

  it.each([
    ["Neclasificat"],
    ["NECLASIFICAT"],
    ["neclasificat"],
    ["Ne-clasificat"],
    ["Neclasificat "],
    [UNCLASSIFIED_DOCUMENT_LABEL],
    ["document necunoscut"],
    ["Document  necunoscut."],
    ["DOCUMENT NECUNOSCUT"],
    ["Unclassified"],
    ["—"],
    [""],
    ["   "],
  ])("declines %p", (label) => {
    expect(declinesAgainst(rows, { label })).toBe(true);
  });

  it("does not decline a real name", () => {
    expect(declinesAgainst(rows, { label: "Contract de arendă" })).toBe(false);
    expect(declinesAgainst(rows, { label: "Contract de comodat" })).toBe(false);
  });

  /**
   * ⚠️ **It follows a RENAME, which is the whole reason it reads the row.**
   * Rename the catch-all to "Diverse" from Reference Data and a model answering
   * "Diverse" is still declining — where a literal list would have let the
   * resolver mint a SECOND row named "Diverse", two identical entries in every
   * document's type dropdown, which is the F7 shape this slice removes.
   */
  /**
   * ⚠️ **THE BUG ROUND FIVE FOUND, PINNED.** Round four claimed a stored type
   * genuinely named "Neclasificat" was still reachable "because
   * `resolveAgainstTypes` asks `matchDocumentType` FIRST". It was not:
   * `matchDocumentType` calls `classifiedLabelOf` to get its label, and the
   * literal list lived in there — so the label was refused before the name pass
   * ever ran, and no classifier answer could reach the row. The list moved into
   * this function, which `resolveAgainstTypes` asks strictly after the match.
   */
  it("declines a stored row that is named like the catch-all, whatever its key", () => {
    const handMade: DocumentTypeCandidate[] = [
      { id: "u", key: UNCLASSIFIED_DOCUMENT_TYPE_KEY, name: "Diverse" },
      { id: "h", key: "NECLASIFICAT", name: "Neclasificat" },
    ];
    expect(resolveAgainstTypes(handMade, { label: "Neclasificat" })).toEqual({ kind: "declined" });
    expect(resolveAgainstTypes([handMade[0]], { label: "Neclasificat" }))
      .toEqual({ kind: "declined" });
    // ⚠️ **The fifth round asserted a `match` here and the sixth reversed it.**
    // The trade was measured the wrong way round: a type a person deliberately
    // named "Neclasificat" is not somewhere an import should file documents on
    // its own, while a JUNK row of that name is a real artefact of the
    // byte-for-byte matching this slice replaces — and matching it is silent.
  });

  it("follows a rename of the catch-all row", () => {
    const renamed: DocumentTypeCandidate[] = [
      { id: "u", key: UNCLASSIFIED_DOCUMENT_TYPE_KEY, name: "Diverse" },
    ];
    expect(declinesAgainst(renamed, { label: "Diverse" })).toBe(true);
    expect(declinesAgainst(renamed, { label: "diverse " })).toBe(true);
    // ⚠️ **The old name goes on declining, and that is right rather than
    // leftover.** A fourth review round changed this from `false`: the literal
    // list is not "the row's name, cached" — it is the set of names that MEAN
    // "I could not tell" to a model, and "Neclasificat" says that whatever the
    // row happens to be called this week. A real type of that name is still
    // reachable, because `resolveAgainstTypes` matches stored rows first.
    expect(declinesAgainst(renamed, { label: "Neclasificat" })).toBe(true);
    // A name that is neither the row's nor a sentinel is a real answer.
    expect(declinesAgainst(renamed, { label: "Contract de comodat" })).toBe(false);
  });

  /**
   * ⚠️ **An archive with no catch-all row at all.** #29.04 made lookup deletes
   * real and nothing protects that row, so this is reachable. Declining then
   * falls back to the protocol sentinel alone, which is the honest answer:
   * there is no row whose name means "no answer".
   */
  it("still declines by name when the catch-all row is gone", () => {
    const noCatchAll: DocumentTypeCandidate[] = [
      { id: "a", key: "CONTRACT_DE_ARENDA", name: "Contract de arendă" },
    ];
    expect(declinesAgainst(noCatchAll, { label: UNCLASSIFIED_DOCUMENT_LABEL })).toBe(true);
    // ⚠️ **`true`, and a fourth review round changed this line from `false`.**
    // The third round had deleted the "Neclasificat"/"Unclassified" literals on
    // the theory that only the row's own name matters, and this assertion
    // PINNED that theory as correct. On a cloud project rebuilt before Slice
    // #29.07 the row is named `Unclassified` (measured at Slice #31.01; #29.07
    // changed the SEED to `NECLASIFICAT`, which renames nothing already
    // seeded) while the model, asked for a Romanian name, writes
    // "Neclasificat" — so the literals are what stands
    // between that archive and a junk type named after the absence of an
    // answer. See `UNCLASSIFIED_LABELS`.
    expect(declinesAgainst(noCatchAll, { label: "Neclasificat" })).toBe(true);
  });

  /**
   * ⚠️ **BOTH NAMES THE CATCH-ALL HAS EVER HAD, side by side.** A migrated dev
   * database calls it NECLASIFICAT; a cloud project rebuilt BEFORE Slice #29.07
   * calls it Unclassified, because the seed said so until that slice changed it.
   * Every project seeded before then still holds the English name — renaming
   * the seed renames nothing that already exists — so both rows are live and
   * both cases stay here. The model is asked for a Romanian name whichever it
   * is talking to. Neither archive may end up with a second row meaning "no
   * answer".
   */
  it.each([
    ["migrated dev", "NECLASIFICAT"],
    ["rebuilt cloud", "Unclassified"],
  ])("declines a Romanian 'Neclasificat' on a %s database", (_label, storedName) => {
    const rows: DocumentTypeCandidate[] = [
      { id: "u", key: UNCLASSIFIED_DOCUMENT_TYPE_KEY, name: storedName },
      { id: "a", key: "CONTRACT_DE_ARENDA", name: "Contract de arendă" },
    ];
    expect(resolveAgainstTypes(rows, { typeKey: "UNCLASSIFIED", label: "Neclasificat" }))
      .toEqual({ kind: "declined" });
    expect(resolveAgainstTypes(rows, { typeKey: "UNCLASSIFIED", label: "Unclassified" }))
      .toEqual({ kind: "declined" });
    // …and an ordinary answer is untouched on both.
    expect(resolveAgainstTypes(rows, { label: "contract de arenda" }).kind).toBe("match");
  });
});

/**
 * The whole rule in one call — what both writers actually ask.
 *
 * ⚠️ **Three answers, not two, and the third round collapsed two call sites
 * into this because two calls are a rule two callers compose differently.**
 */
describe("resolveAgainstTypes", () => {
  const rows: DocumentTypeCandidate[] = [
    { id: "u", key: UNCLASSIFIED_DOCUMENT_TYPE_KEY, name: "NECLASIFICAT" },
    { id: "a", key: "CONTRACT_DE_ARENDA", name: "Contract de arendă" },
  ];

  it("matches what the archive holds", () => {
    expect(resolveAgainstTypes(rows, { typeKey: "CONTRACT_DE_ARENDA" })).toEqual({
      kind: "match", row: rows[1], how: "key",
    });
    expect(resolveAgainstTypes(rows, { label: "contract de arenda" })).toEqual({
      kind: "match", row: rows[1], how: "name",
    });
  });

  it.each([
    [{ }],
    [{ typeKey: UNCLASSIFIED_DOCUMENT_TYPE_KEY }],
    [{ label: UNCLASSIFIED_DOCUMENT_LABEL }],
    [{ label: "Neclasificat" }],
    [{ label: "—" }],
    [{ typeKey: UNCLASSIFIED_DOCUMENT_TYPE_KEY, label: "NECLASIFICAT" }],
  ])("declines %p", (answer) => {
    expect(resolveAgainstTypes(rows, answer)).toEqual({ kind: "declined" });
  });

  it("asks for a create only on a real label nothing holds", () => {
    expect(resolveAgainstTypes(rows, { label: "  Contract de comodat " })).toEqual({
      kind: "create", name: "Contract de comodat",
    });
  });

  /**
   * ⚠️ **Every answer is exactly one of the three**, which is what lets both
   * writers `switch` on it without a default arm that quietly does the wrong
   * thing.
   */
  it("never returns a create with a name classifiedLabelOf would refuse", () => {
    for (const label of ["", "  ", "—", UNCLASSIFIED_DOCUMENT_LABEL, "Neclasificat"]) {
      const r = resolveAgainstTypes(rows, { label });
      expect(r.kind).toBe("declined");
    }
  });
});

describe("matchDocumentType", () => {
  const rows: DocumentTypeCandidate[] = [
    // The row's real display name since migration_043 — see the declining-label
    // tests above for why a classifier that answers with it is not a match.
    { id: "u", key: UNCLASSIFIED_DOCUMENT_TYPE_KEY, name: "NECLASIFICAT" },
    { id: "a", key: "CONTRACT_DE_ARENDA", name: "Contract de arendă" },
    { id: "t", key: "TITLU_DE_PROPRIETATE", name: "Titlu de proprietate" },
  ];

  it("matches a key before a label, and says so", () => {
    expect(
      matchDocumentType(rows, { typeKey: "TITLU_DE_PROPRIETATE", label: "Contract de arendă" }),
    ).toEqual({ row: rows[2], how: "key" });
  });

  it("matches a label under the shared fold", () => {
    expect(matchDocumentType(rows, { label: "contract de arenda" })).toEqual({
      row: rows[1],
      how: "name",
    });
  });

  /**
   * ⚠️ **The row really is in the list, which is what makes this a trap.**
   * `lookup_document_type` holds NECLASIFICAT, so a naive key lookup succeeds
   * and files the document under the catch-all on the strength of an answer
   * that says nothing — making "the model had no idea" indistinguishable from
   * "the model said NECLASIFICAT". That is finding F1 in one line.
   */
  it("never resolves an UNCLASSIFIED key, even though the row exists", () => {
    expect(matchDocumentType(rows, { typeKey: UNCLASSIFIED_DOCUMENT_TYPE_KEY })).toBeNull();
    // …and the LABEL is still tried.
    expect(
      matchDocumentType(rows, {
        typeKey: UNCLASSIFIED_DOCUMENT_TYPE_KEY,
        label: "Titlu de proprietate",
      }),
    ).toEqual({ row: rows[2], how: "name" });
  });

  it("answers null for an unknown label and for no answer at all", () => {
    expect(matchDocumentType(rows, { label: "Contract de comodat" })).toBeNull();
    expect(matchDocumentType(rows, {})).toBeNull();
    expect(matchDocumentType(rows, { label: UNCLASSIFIED_DOCUMENT_LABEL })).toBeNull();
    // …and a punctuation-only label, which reaches `classifiedLabelOf` and is
    // refused there rather than being carried into a create. The CALLER then
    // answers `unclassified`, which is the honest reading of "—".
    expect(matchDocumentType(rows, { label: "—" })).toBeNull();
  });

  /**
   * ⚠️ **The catch-all is unreachable by NAME as well as by key**, whatever it
   * is called. This is only half the rule and deliberately so: it keeps a
   * classifier's prose off the catch-all ROW. What happens to such a label next
   * is `declinesAgainst`'s business — `UNCLASSIFIED_LABELS` covers the two
   * names the row is known to carry across this project's two databases, and
   * the row read covers the name Adrian gives it tomorrow from Reference Data,
   * which no constant can know. A label reading like a renamed catch-all
   * therefore declines rather than falling through to a create, which is what
   * stops a second row of that display name.
   */
  it("never name-matches the catch-all row, whatever it has been renamed to", () => {
    const renamed: DocumentTypeCandidate[] = [
      { id: "u", key: UNCLASSIFIED_DOCUMENT_TYPE_KEY, name: "Diverse" },
      { id: "a", key: "CONTRACT_DE_ARENDA", name: "Contract de arendă" },
    ];
    expect(matchDocumentType(renamed, { label: "Diverse" })).toBeNull();
    // …and the ordinary row beside it is still matched, so the guard is narrow.
    expect(matchDocumentType(renamed, { label: "contract de arenda" })?.row.id).toBe("a");
  });

  /**
   * ⚠️ **A ROW NAMED LIKE THE CATCH-ALL BUT KEYED OTHERWISE IS NOT A MATCH,
   * and a sixth review round found the silence it otherwise causes.** Such a
   * row is not hypothetical: pre-#29.06 `ai-interpret` name-matched
   * byte-for-byte, the migrated dev database calls the catch-all
   * `NECLASIFICAT`, and the classify prompt asks Haiku for a short Romanian
   * name — so "Neclasificat" missed the uppercase row and was CREATED as a
   * second type, keyed `NECLASIFICAT`. Matching it reports an ordinary
   * `matched`, so the row says nothing and the document is filed under a type
   * meaning "unclassified", which is finding F1 on the very archive this slice
   * was written for.
   *
   * The stated cost: a type a person deliberately named "Neclasificat" cannot
   * collect documents from a classifier either. It can still be chosen by hand.
   */
  it("never name-matches a row that MEANS unclassified, whatever its key", () => {
    const junk: DocumentTypeCandidate[] = [
      { id: "u", key: UNCLASSIFIED_DOCUMENT_TYPE_KEY, name: "NECLASIFICAT" },
      { id: "j", key: "NECLASIFICAT", name: "Neclasificat" },
      { id: "d", key: "DOCUMENT_NECUNOSCUT", name: "Document necunoscut" },
      { id: "a", key: "CONTRACT_DE_ARENDA", name: "Contract de arendă" },
    ];
    expect(matchDocumentType(junk, { label: "Neclasificat" })).toBeNull();
    expect(matchDocumentType(junk, { label: UNCLASSIFIED_DOCUMENT_LABEL })).toBeNull();
    expect(resolveAgainstTypes(junk, { typeKey: "UNCLASSIFIED", label: "Neclasificat" }))
      .toEqual({ kind: "declined" });
    // …and an ordinary row beside them is untouched, so the guard is narrow.
    expect(matchDocumentType(junk, { label: "contract de arenda" })?.row.id).toBe("a");
  });

  it("takes the FIRST row when two share a normalised name", () => {
    // Nothing makes `name` unique, so an archive from before this slice can
    // hold both spellings. Whichever is returned must be the same one every
    // time, or one folder's documents split across two rows.
    const twins: DocumentTypeCandidate[] = [
      { id: "1", key: "CONTRACT_DE_ARENDA", name: "Contract de arendă" },
      { id: "2", key: "CONTRACT_DE_ARENDA_2", name: "Contract de arenda" },
    ];
    expect(matchDocumentType(twins, { label: "CONTRACT DE ARENDA" })?.row.id).toBe("1");
    expect(matchDocumentType(twins, { label: "contract de arendă" })?.row.id).toBe("1");
  });
});
