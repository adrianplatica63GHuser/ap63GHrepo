/**
 * One matcher, two lookup lists.                                (Slice #34.02)
 *
 * The rule these tests cover used to live inside
 * `src/app/api/admin/import/extract-id-card/route.ts` and served citizenship
 * alone. #34.02 needed the same three stages for a card's ISSUING AUTHORITY,
 * and the instruction was to reuse the matcher rather than write a second one —
 * so the two things worth asserting are that the citizenship path still answers
 * what it answered (plus the diacritic case it always got wrong), and that an
 * institution the list does not hold comes back as a MISS rather than being
 * guessed onto a row that means something else.
 *
 * The miss is the feature: a `null` here is what puts the model's spelling in
 * front of a person beside an empty dropdown with an "adaugă" button. Nothing
 * in this module may create a row, and no test here should ever make it look
 * like it could.
 */

import fs from "node:fs";
import path from "node:path";

import {
  CITIZENSHIP_ALIASES,
  INSTITUTION_ALIASES,
  foldLookupName,
  matchCitizenship,
  matchInstitution,
  matchLookupByName,
  type NamedLookupRow,
} from "@/lib/import/lookup-name-match";

/**
 * The two seeded lists, READ FROM THE SEED rather than transcribed.
 *
 * ⚠️ **A third review round is why these are parsed and not literals.** The
 * fixtures were hand-copies of `sync-reference-data.sql`, and every "resolves
 * against a row the archive really has" assertion below would have stayed green
 * against a list the archive no longer had — a renamed seeded row is invisible
 * to a test that carries its own copy of the name. Worse, the alias-target
 * assertion at the bottom claimed the table "cannot rot unnoticed" while
 * checking the fixture rather than the seed. `document-type-catalogue-
 * single-source.test.ts` already solved this exact problem in this repo; the
 * comment-stripping and the every-tuple regex are its lessons, not new ones.
 */
const ROOT = process.cwd();

function seededNames(table: string, columns: string): string[] {
  const sql = fs
    .readFileSync(path.join(ROOT, "src/db/sync-reference-data.sql"), "utf8")
    .split("\n")
    // Comments first, then cut at the `;` — that order, because a block's own
    // comments can mention one.
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
  const start = sql.indexOf(`INSERT INTO ${table} (${columns}) VALUES`);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf(";", start);
  expect(end).toBeGreaterThan(start);
  // Every tuple, not the first per line: this file writes several lookup tables
  // multiple tuples to a line.
  return [...sql.slice(start, end).matchAll(/\('([^']*)'/g)].map((m) => m[1]);
}

/** The seeded `lookup_citizenship` list, in seed order (= `sort_order`). */
const CITIZENSHIPS: NamedLookupRow[] = seededNames(
  "lookup_citizenship",
  "name, sort_order",
).map((name, i) => ({ id: `c${i}-${foldLookupName(name)}`, name }));

/** The seeded `lookup_institution` list — note what is NOT in it. */
const INSTITUTIONS: NamedLookupRow[] = seededNames(
  "lookup_institution",
  "name, institution_type, sort_order",
).map((name, i) => ({ id: `i${i}-${foldLookupName(name)}`, name }));

/** The id of the seeded row with this exact name — fails loudly if it is gone. */
function seeded(rows: NamedLookupRow[], name: string): string {
  const row = rows.find((r) => r.name === name);
  expect(row).toBeDefined();
  return row!.id;
}

const c_ro = seeded(CITIZENSHIPS, "Română");
const c_md = seeded(CITIZENSHIPS, "Moldoveană");
const c_us = seeded(CITIZENSHIPS, "Americană");
const c_de = seeded(CITIZENSHIPS, "Germană");
const c_fr = seeded(CITIZENSHIPS, "Franceză");
const c_it = seeded(CITIZENSHIPS, "Italiană");
const c_es = seeded(CITIZENSHIPS, "Spaniolă");
const c_en = seeded(CITIZENSHIPS, "Engleză");

const i_ocpi = seeded(INSTITUTIONS, "OCPI");
const i_prim = seeded(INSTITUTIONS, "Primăria Municipiului");
const i_anaf = seeded(INSTITUTIONS, "ANAF");
const i_not = seeded(INSTITUTIONS, "Notariat");
const i_jud = seeded(INSTITUTIONS, "Judecătorie");
const i_trib = seeded(INSTITUTIONS, "Tribunal");

describe("foldLookupName", () => {
  it("folds both Unicode spellings of ș and ț to the same form", () => {
    // Comma-below (correct Romanian) and cedilla (older keyboards, OCR).
    expect(foldLookupName("Judecătorie")).toBe(foldLookupName("Judecatorie"));
    expect(foldLookupName("ș")).toBe("s");
    expect(foldLookupName("ş")).toBe("s");
    expect(foldLookupName("ț")).toBe("t");
    expect(foldLookupName("ţ")).toBe("t");
  });

  it("collapses separators to a single space instead of deleting them", () => {
    // The one place this fold differs from `normaliseDocumentTypeName`, and the
    // reason is the substring test: with the gaps removed there are no word
    // boundaries left for `containsAsWord` to respect.
    expect(foldLookupName("Consiliu-Județean")).toBe("consiliu judetean");
    expect(foldLookupName("Oficiul  de   Cadastru")).toBe("oficiul de cadastru");
  });

  it("joins a DOTTED acronym back into one word", () => {
    // Without this, "S.P.C.L.E.P. Bragadiru" and "SPCLEP Bragadiru" are two
    // different strings — and the loop the "adaugă" button closes would not
    // close: the next card would fail to find the row a person had just made.
    expect(foldLookupName("S.P.C.L.E.P.  Bragadiru")).toBe("spclep bragadiru");
    expect(foldLookupName("O.C.P.I. Ilfov")).toBe("ocpi ilfov");
    expect(foldLookupName("O.C.P.I. Ilfov 2")).toBe("ocpi ilfov 2");
  });

  it("leaves undotted single letters alone — digits AND roman numerals", () => {
    // ⚠️ Two review rounds. The rule started as "join any run of single-letter
    // tokens", which folded "Secția a 2-a" to `sectia a2a`; excluding digits
    // fixed that and left "Secția a I-a" folding to `sectia aia`, which is the
    // spelling a Romanian court section actually uses. `a` is an ordinary
    // article and what follows it is ordinary text — no amount of counting
    // letters separates that from an acronym. The dots do.
    expect(foldLookupName("Tribunalul Ilfov Secția a 2-a")).toBe("tribunalul ilfov sectia a 2 a");
    expect(foldLookupName("Secția a I-a")).toBe("sectia a i a");
    expect(foldLookupName("Secția a V-a Civilă")).toBe("sectia a v a civila");
    expect(foldLookupName("Sector 4 A")).toBe("sector 4 a");
    expect(foldLookupName("Judecătoria a Buftea")).toBe("judecatoria a buftea");
  });

  it("folds punctuation-only input to the empty string", () => {
    expect(foldLookupName("—")).toBe("");
    expect(foldLookupName("   ")).toBe("");
  });
});

describe("matchLookupByName — the three stages", () => {
  it("matches an exact folded name", () => {
    expect(matchLookupByName("Română", CITIZENSHIPS)).toBe(c_ro);
  });

  it("matches a row name contained as a whole word", () => {
    expect(matchLookupByName("cetățenie: română", CITIZENSHIPS)).toBe(c_ro);
  });

  it("does NOT match a row name buried inside a longer word", () => {
    // Whole-word, not bare `includes` — the row name is the shorter string, so
    // finding it inside another word is a coincidence and not a reading.
    expect(matchLookupByName("transilvanaromana", [{ id: "x", name: "romana" }])).toBeNull();
  });

  it("reaches the alias table only after the two row-name stages", () => {
    expect(matchLookupByName("ROU", CITIZENSHIPS, CITIZENSHIP_ALIASES)).toBe(c_ro);
    // …and an alias never beats a real row name: "Română" is stage 1.
    expect(matchLookupByName("Română", CITIZENSHIPS, { romana: "Engleză" })).toBe(c_ro);
  });

  it("matches an alias key contained as a whole word, longest key first", () => {
    const rows: NamedLookupRow[] = [{ id: "a", name: "Alpha" }, { id: "b", name: "Beta" }];
    // ⚠️ The alias KEY must not also be a row name, or stage 2 answers first
    // and the assertion passes with stage 4 deleted. A review round found the
    // first version of this test doing exactly that.
    expect(matchLookupByName("dosarul zeta ceva", rows, { zeta: "Beta" })).toBe("b");
    expect(matchLookupByName("dosarul zeta ceva", rows)).toBeNull();
    // Longest key first: both keys are contained, the specific one wins.
    expect(
      matchLookupByName("consiliul judetean ilfov", rows, {
        consiliul: "Alpha",
        "consiliul judetean": "Beta",
      }),
    ).toBe("b");
  });

  it("prefers a matching name that CONTAINS another matching name", () => {
    // ⚠️ Round 1's finding. `find` over the caller's order takes whichever row
    // the database returned first — and the seeded rows come back first, so the
    // generic row beat the specific row a person had just added through the
    // button this slice is building. Both orders must answer the same, and it
    // must be the specific one.
    const generic = { id: "g", name: "Primăria Municipiului" };
    const specific = { id: "s", name: "Primăria Municipiului București" };
    const raw = "Primăria Municipiului București, Sector 6";
    expect(matchLookupByName(raw, [generic, specific])).toBe("s");
    expect(matchLookupByName(raw, [specific, generic])).toBe("s");
  });

  it("keeps caller order for two matches where neither name is inside the other", () => {
    // ⚠️ Round 2's finding, and the reason the rule above is a containment test
    // rather than a sort by length. `romana` is the SHORTEST folded name in the
    // seeded citizenship list, so a longest-first sort made every raw naming
    // Română plus one other citizenship answer the OTHER one — in a Romanian
    // property archive, and against the `sort_order` the seed sets on purpose.
    expect(matchCitizenship("Americană/Română", CITIZENSHIPS)).toBe(c_ro);
    expect(matchCitizenship("Română si Germană", CITIZENSHIPS)).toBe(c_ro);
    expect(matchCitizenship("Romana/Moldoveana", CITIZENSHIPS)).toBe(c_ro);
  });

  it("still answers when two rows fold to the same name", () => {
    // Strictly-longer, so neither can eliminate the other and the list does not
    // go silent on an archive holding both spellings.
    const rows: NamedLookupRow[] = [
      { id: "n1", name: "Notariat" },
      { id: "n2", name: "notariat" },
    ];
    expect(matchLookupByName("emis de Notariat", rows)).toBe("n1");
    expect(matchLookupByName("emis de Notariat", [rows[1], rows[0]])).toBe("n2");
  });

  it("survives a raw that names an Object.prototype member", () => {
    // ⚠️ A frozen object literal still has a prototype, so a bare
    // `aliases["constructor"]` yields the Object FUNCTION, passes an `if`, and
    // reaches the fold as `TypeError: value.normalize is not a function`. Both
    // raws that reach this module are model-controlled strings and the fold's
    // alphabet contains "constructor" exactly, so a card image was one
    // unhandled 500 away.
    //
    // ⚠️ **"constructor" is the ONLY reachable one, so it is the only one
    // asserted.** A second round pointed out that `toString` and
    // `hasOwnProperty` fold to `tostring` / `hasownproperty` and would pass
    // with the fix reverted — coverage advertised rather than held. After the
    // fold, `__proto__` is `proto` and `valueOf` is `valueof`; `constructor`
    // survives it intact and nothing else does.
    expect(matchCitizenship("constructor", CITIZENSHIPS)).toBeNull();
    expect(matchInstitution("constructor", INSTITUTIONS)).toBeNull();
    expect(matchLookupByName("constructor", CITIZENSHIPS, CITIZENSHIP_ALIASES)).toBeNull();
  });

  it("never matches on an empty fold, in either direction", () => {
    expect(matchLookupByName("—", CITIZENSHIPS)).toBeNull();
    expect(matchLookupByName("Română", [{ id: "junk", name: "—" }])).toBeNull();
  });

  it("returns null for a missing or blank raw", () => {
    expect(matchLookupByName(null, CITIZENSHIPS)).toBeNull();
    expect(matchLookupByName(undefined, CITIZENSHIPS)).toBeNull();
    expect(matchLookupByName("", CITIZENSHIPS)).toBeNull();
  });

  it("ignores an alias naming a row this database does not hold", () => {
    // An alias table entry costs its line and nothing else when the row is not
    // there — which is what lets INSTITUTION_ALIASES be written against the
    // seeded list without breaking an archive that has edited it.
    expect(matchLookupByName("something", [{ id: "a", name: "A" }], { something: "Not A Row" })).toBeNull();
  });
});

describe("matchCitizenship — what the route used to do, and the case it got wrong", () => {
  it.each([
    ["Română", c_ro],
    ["ROU", c_ro],
    ["Romania", c_ro],
    ["romanian", c_ro],
    ["MDA", c_md],
    ["USA", c_us],
    ["german", c_de],
    ["french", c_fr],
    ["italian", c_it],
    ["spanish", c_es],
    ["english", c_en],
  ])("resolves %s", (raw, expected) => {
    expect(matchCitizenship(raw, CITIZENSHIPS)).toBe(expected);
  });

  it("resolves a diacritic-less reading the old matcher missed", () => {
    // ⚠️ The route's own prompt tells the model this field arrives as "ROU" or
    // "Romana" — and "Romana" was in NEITHER the direct test (which compared
    // raw bytes against "Română") NOR the 26-entry alias table. So the single
    // most likely spelling on a scanned card was flagged low-confidence for a
    // value the seeded list plainly holds. Folding both sides fixes it without
    // adding an alias.
    expect(matchCitizenship("Romana", CITIZENSHIPS)).toBe(c_ro);
    expect(matchCitizenship("cetatenie romana", CITIZENSHIPS)).toBe(c_ro);
  });

  it("resolves an alias buried in a labelled reading (the new stage 4)", () => {
    // The one genuinely new behaviour on a SHIPPED path, so it is asserted
    // rather than left to the institution tests. The old matcher looked the
    // alias table up on the whole string only, so a card read as
    // "Cetăţenie/Nationality: ROU" — the label printed on a Romanian CI —
    // reached neither the direct test nor the table.
    expect(matchCitizenship("Cetăţenie/Nationality: ROU", CITIZENSHIPS)).toBe(c_ro);
    expect(matchCitizenship("Republica Moldova", CITIZENSHIPS)).toBe(c_md);
  });

  it("does not let a two-letter alias key fire on a word that merely contains it", () => {
    // `ro`, `us`, `uk`, `md` are alias keys. Whole-word containment is what
    // stops "Rousseau" or "Prusia" resolving to a citizenship.
    expect(matchCitizenship("Rousseau", CITIZENSHIPS)).toBeNull();
    expect(matchCitizenship("Prusia", CITIZENSHIPS)).toBeNull();
    expect(matchCitizenship("Belarus", CITIZENSHIPS)).toBeNull();
  });

  it("stops matching a citizenship that merely starts with a row name", () => {
    // ⚠️ **A deliberate behaviour change, found by measuring the old matcher
    // against the new over ~90 real readings: it is the only INPUT where the
    // old code answered and the new one does not. (The other change runs the
    // other way — see the stage list in the module: asking every row the exact
    // question before any row the substring question can pick a DIFFERENT row,
    // and a better one.)** The old bare `includes`
    // resolved "Aromână" to `Română` — Aromanian is an ethnic group, not
    // Romanian citizenship. Whole-word containment refuses it, which is right,
    // and the raw is then flagged low-confidence for a person to decide.
    expect(matchCitizenship("Aromână", CITIZENSHIPS)).toBeNull();
  });

  it("returns null for a citizenship the list does not hold", () => {
    expect(matchCitizenship("Suedeză", CITIZENSHIPS)).toBeNull();
  });
});

describe("matchInstitution — the miss is the point", () => {
  it.each([
    "SPCLEP Bragadiru",
    "S.P.C.L.E.P. Bragadiru",
    "Poliția Bragadiru",
    "SPCLEP Sector 4",
    "DEPABD",
  ])("returns null for %s, because no seeded row is an identity-card issuer", (raw) => {
    // ⚠️ This is the assertion the slice exists for. A `null` here reaches the
    // dialog as the raw string beside an EMPTY dropdown with an "adaugă"
    // button — not as a free-text `subject` the archive can never search, and
    // not as a row minted from a model's reading, which
    // `src/lib/import/id-card.ts` refuses and #34.02 keeps refusing.
    expect(matchInstitution(raw, INSTITUTIONS)).toBeNull();
  });

  it("refuses a reading that does not actually name a seeded row", () => {
    // ⚠️ The distinction round 3 insisted on. "Primăria Municipiului Ploiești"
    // DOES resolve, and rightly — the raw spells the row's own name. These two
    // do not name any row and there is no alias for them, so they miss. That is
    // the whole rule: no alias may fold a body into a row of a different scope,
    // and a raw that names a row is not an alias.
    expect(matchInstitution("Primăria Orașului Bragadiru", INSTITUTIONS)).toBeNull();
    expect(matchInstitution("Consiliul Local Bragadiru", INSTITUTIONS)).toBeNull();
  });

  it("resolves a reading that spells a seeded row's own name out", () => {
    expect(matchInstitution("Primăria Municipiului Ploiești", INSTITUTIONS)).toBe(i_prim);
    expect(
      matchInstitution("ANAF - Administrația Județeană a Finanțelor Publice Ilfov", INSTITUTIONS),
    ).toBe(i_anaf);
  });

  it("keeps no alias that folds a body into a row of a different kind", () => {
    // The failure this guards: an alias table stretched to cover more readings
    // maps a NATIONAL body onto a COUNTY-office row, or a local office onto a
    // national one — the same silent wrong guess it refuses to make for SPCLEP,
    // in the direction nobody checks. A review round found two of these
    // (`ancpi` → OCPI, `administratia financiara` → ANAF) and removed both.
    expect(matchInstitution("ANCPI", INSTITUTIONS)).toBeNull();
    expect(matchInstitution("Administrația Financiară Ilfov", INSTITUTIONS)).toBeNull();
  });

  it.each([
    ["OCPI", i_ocpi],
    ["O.C.P.I. Ilfov", i_ocpi],
    ["Oficiul de Cadastru și Publicitate Imobiliară", i_ocpi],
    ["ANAF", i_anaf],
    ["Agenția Națională de Administrare Fiscală", i_anaf],
    ["Judecătoria Buftea", i_jud],
    // The genitive is what a document header actually prints — "Hotărârea
    // Tribunalului Ilfov", "Încheierea Judecătoriei Buftea" — and whole-word
    // containment refuses the -lui / -ei forms unless the table carries them.
    ["Judecătoriei Buftea", i_jud],
    ["Tribunalul Ilfov", i_trib],
    ["Hotărârea Tribunalului Ilfov", i_trib],
    ["Notar public", i_not],
    ["Consiliul Județean Ilfov", seeded(INSTITUTIONS, "Consiliu Județean")],
    ["Primăria Municipiului", i_prim],
    ["Primăria Municipiului Bragadiru", i_prim],
  ])("resolves %s against a row the archive really has", (raw, expected) => {
    expect(matchInstitution(raw, INSTITUTIONS)).toBe(expected);
  });

  it("takes the authority named FIRST when a raw names two courts", () => {
    // ⚠️ Round 2's finding on stage 4. Sorting alias keys by length alone
    // answered `Judecătorie` for "Tribunalul Ilfov - Judecătoria Buftea",
    // because `judecatoria` is the longer key — on an appeal decision the
    // Tribunal is the issuer. An alias table has no `sort_order` to respect, so
    // position in the reading is the signal, and an authority line names its
    // body first.
    expect(matchInstitution("Tribunalul Ilfov - Judecătoria Buftea", INSTITUTIONS)).toBe(i_trib);
    expect(matchInstitution("Judecătoria Buftea, Tribunalul Ilfov", INSTITUTIONS)).toBe(i_jud);
  });

  it("matches an institution a person added a moment ago, with the card's own spelling", () => {
    // The loop the "adaugă" button closes: the row is created from the model's
    // reading BY A PERSON, and the next card carrying the same authority
    // resolves against it with no alias and no code change.
    const withSpclep = [...INSTITUTIONS, { id: "i-new", name: "SPCLEP Bragadiru" }];
    expect(matchInstitution("SPCLEP Bragadiru", withSpclep)).toBe("i-new");
    expect(matchInstitution("S.P.C.L.E.P. BRAGADIRU", withSpclep)).toBe("i-new");
  });
});

describe("the alias tables are frozen data, not behaviour", () => {
  it("keys are already in folded form, so a lookup can never miss on spelling", () => {
    for (const key of Object.keys(CITIZENSHIP_ALIASES)) {
      expect(foldLookupName(key)).toBe(key);
    }
    for (const key of Object.keys(INSTITUTION_ALIASES)) {
      expect(foldLookupName(key)).toBe(key);
    }
  });

  it("every alias in both tables names a row the SEED really holds", () => {
    // An alias pointing at nothing is dead weight. Both fixtures are parsed
    // from `sync-reference-data.sql`, so renaming a seeded row fails this
    // rather than leaving the table quietly pointing at a name that is gone.
    const inst = new Set(INSTITUTIONS.map((r) => foldLookupName(r.name)));
    for (const target of Object.values(INSTITUTION_ALIASES)) {
      expect(inst.has(foldLookupName(target))).toBe(true);
    }
    const cit = new Set(CITIZENSHIPS.map((r) => foldLookupName(r.name)));
    for (const target of Object.values(CITIZENSHIP_ALIASES)) {
      expect(cit.has(foldLookupName(target))).toBe(true);
    }
  });

  it("no alias key is a row's own folded name, because such a key can never fire", () => {
    // ⚠️ `primaria municipiului` was exactly that: stage 1 or stage 2 answers
    // first, and where the row is absent the alias resolves to nothing anyway.
    // "Every alias names a real row" passed it happily, which is how a dead
    // entry survives a review.
    const inst = new Set(INSTITUTIONS.map((r) => foldLookupName(r.name)));
    for (const key of Object.keys(INSTITUTION_ALIASES)) {
      expect(inst.has(key)).toBe(false);
    }
    const cit = new Set(CITIZENSHIPS.map((r) => foldLookupName(r.name)));
    for (const key of Object.keys(CITIZENSHIP_ALIASES)) {
      expect(cit.has(key)).toBe(false);
    }
  });
});
