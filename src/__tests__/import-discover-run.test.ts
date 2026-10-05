/**
 * Which document types may have a form, and which are waiting for one.
 *                                                  (Slice #27.05, #29.09, #37.85)
 *
 * Until Slice #37.85 the import also read one document of every type it met
 * without a form and offered the fields for review — `discoverForType`, and
 * `shouldDiscoverType` deciding when to pay for it. #37.85 removed both: one
 * document is never evidence for a type's form. What is held here now is the
 * REPORTING rule that stayed (`typeAwaitsForm`: should the row say the type is
 * waiting for a form?), the wider rule beneath it (`typeMayHoldAForm`), the
 * import's call sites of the first, and a guard that the discovery stage does
 * not come back.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ⚠️ **`@/lib/dev/strip-comments`, NOT a local two-regex copy — and Slice
// #34.10's first draft wrote the copy, in three files at once.** That module
// exists because #34.06's own review deleted exactly this shape from
// `upload-file-types.test.ts`: a regex stripper is provably wrong on `//`
// inside a string or a regex literal (`accept="image/*"`,
// `p.replace(/https?:\/\//, "")`), and OVER-stripping turns a NEGATIVE
// assertion green — a false pass, which is the worst direction for a guard.
// Measured by an adversarial round on this slice: the regex and the lexer
// disagree on 105 of 566 files under `src/`, by up to 8,817 characters.
import { stripComments } from "@/lib/dev/strip-comments";
import { documentTypeIsCatchAll } from "@/lib/documents/document-type-match";
import * as discoverRun from "@/lib/import/discover-run";
import { typeAwaitsForm, typeMayHoldAForm } from "@/lib/import/discover-run";

const FALLBACK = "type-altul";

/**
 * A row that carries neither witness — the ordinary type every test below is
 * about unless it says otherwise.                               (Slice #34.10)
 */
const PLAIN = { typeKey: "CONTRACT_ARENDA", typeName: "Contract de arendă" };

/**
 * The rows the two rules used to disagree about.                (Slice #34.10)
 *
 * ⚠️ **The middle three are the whole slice.** `catch-all-form-guard.ts` named
 * them as the gap it was leaving open: a row keyed `NECLASIFICAT` rather than
 * `UNCLASSIFIED`, and a row that carries neither key and is merely NAMED
 * "Neclasificat" or "Unclassified". `catchAllType` resolves the key
 * `UNCLASSIFIED` alone, so the import's id-only rule reached none of them.
 *
 * ⚠️ **`null`/`null` is in here on purpose and is NOT a catch-all row.** It is
 * "the caller has no row", which is what the run loop passes for a type
 * `runAiInterpret` invented mid-run. It must behave exactly as an ordinary
 * type does, or the widening would have silently stopped the import reporting
 * every such type.
 */
const CATCH_ALL_FIXTURE = [
  { what: "an ordinary type", typeKey: "CONTRACT_ARENDA", typeName: "Contract de arendă", isCatchAll: false },
  { what: "no row at all", typeKey: null, typeName: null, isCatchAll: false },
  { what: "the seeded catch-all", typeKey: "UNCLASSIFIED", typeName: "NECLASIFICAT", isCatchAll: true },
  { what: "the second row, keyed NECLASIFICAT", typeKey: "NECLASIFICAT", typeName: "Neclasificat", isCatchAll: true },
  { what: "a slugged key, named Neclasificat", typeKey: "NECLASIFICAT_2", typeName: "Neclasificat", isCatchAll: true },
] as const;

const awaits = (over: Partial<Parameters<typeof typeAwaitsForm>[0]> = {}) =>
  typeAwaitsForm({
    typeId: "type-arenda",
    ...PLAIN,
    fallbackTypeId: FALLBACK,
    typeHasForm: false,
    typeIsIdCard: false,
    ...over,
  });

describe("whether the ROW says the type is waiting for a form", () => {
  it("says so for a type that has no form", () => {
    expect(awaits()).toBe(true);
  });

  it("is silent about a type that has a form, and about the fallback", () => {
    expect(awaits({ typeHasForm: true })).toBe(false);
    expect(awaits({ typeId: FALLBACK })).toBe(false);
    expect(awaits({ typeId: FALLBACK, typeHasForm: true })).toBe(false);
  });

  it("⚠️ is silent about the identity-card TYPE, whatever the bucket or the scan says", () => {
    // The caller answers `typeIsIdCard` from the type's key or name, with the
    // scan only as the fallback for a type invented mid-run. A card's type must
    // never print "this type has no form yet" — its data comes from the
    // import's identity-card step.
    expect(awaits({ typeIsIdCard: true })).toBe(false);
    expect(
      awaits({
        typeId: "type-carte-identitate",
        typeKey: "CARTE_IDENTITATE",
        typeName: "Carte de identitate",
        typeIsIdCard: true,
      }),
    ).toBe(false);
  });

  it("refuses an empty type id", () => {
    // Cannot happen — `document_type_id` is NOT NULL — but the value comes out
    // of a JSON response.
    expect(awaits({ typeId: "" })).toBe(false);
  });

  it("answers normally when the fallback type is not known", () => {
    // `fallbackTypeId: null` must not make every type look like the fallback.
    expect(awaits({ fallbackTypeId: null })).toBe(true);
    expect(awaits({ typeId: "", fallbackTypeId: null })).toBe(false);
  });

  it("⚠️ takes no waiver: a waived run still SAYS the type is waiting", () => {
    // Slice #32.05. `typeAwaitsForm` is what the ROW reports, and a waived type
    // is still a type with no form. `formsWaived` is not one of its inputs —
    // this is a statement about the signature as much as about the answer.
    expect(awaits()).toBe(true);
  });
});

describe("⚠️ the import has no one-document discovery stage — Slice #37.85", () => {
  it("exports no spending rule and no discovery read", () => {
    // The module keeps only the two shared predicates.
    expect("discoverForType" in discoverRun).toBe(false);
    expect("shouldDiscoverType" in discoverRun).toBe(false);
    expect(typeof discoverRun.typeAwaitsForm).toBe("function");
    expect(typeof discoverRun.typeMayHoldAForm).toBe("function");
  });

  it("the bulk import neither reads a type for a form nor opens a review of one", () => {
    // Comments stripped: the dialog's comments may name the removed stage to
    // say it is gone; what must not exist is the CODE.
    const dialog = stripComments(
      readFileSync(
        join(process.cwd(), "src/app/admin/import/_components/bulk-import-dialog.tsx"),
        "utf8",
      ),
    );
    for (const gone of [
      "discoverForType",
      "shouldDiscoverType",
      "DiscoverReviewDialog",
      "discover-review-dialog",
      "discoverClaimedRef",
      "discoverStepsRef",
      'kind: "discover"',
    ]) {
      expect([gone, dialog.includes(gone)]).toEqual([gone, false]);
    }
  });
});

describe("⚠️ one rule at every door — Slice #34.10", () => {
  it("gives the SAME answer as the write door's predicate on every row", () => {
    // The claim the slice is built on, stated as an equality rather than as
    // two lists that happen to match. `documentTypeIsCatchAll` is what the
    // value-lists write door (`catchAllFormRefusal`) and Reference Data's
    // backlog filter already ask; `typeMayHoldAForm` is what the import's
    // rows (through `typeAwaitsForm`) and DocTypeEngine's picker ask. Before
    // this slice the
    // second was narrower than the first on three of these five rows.
    for (const row of CATCH_ALL_FIXTURE) {
      const byRow = documentTypeIsCatchAll({ key: row.typeKey, name: row.typeName });
      expect([row.what, byRow]).toEqual([row.what, row.isCatchAll]);
      // …and the import's own rule now refuses exactly those rows, with no
      // fallback id in hand at all — which is the case that used to let them
      // through.
      expect([
        row.what,
        typeMayHoldAForm({
          typeId: "some-uuid",
          typeKey: row.typeKey,
          typeName: row.typeName,
          fallbackTypeId: null,
          typeIsIdCard: false,
        }),
      ]).toEqual([row.what, !row.isCatchAll]);
    }
  });

  it("⚠️ keeps the id witness as well as the name one, and both are needed", () => {
    // Not belt-and-braces: they answer for different callers, and dropping
    // either narrows the rule for the callers that depend on it.
    //
    // The id alone, with no row to read — the mid-run-invented type.
    expect(
      typeMayHoldAForm({
        typeId: FALLBACK,
        typeKey: null,
        typeName: null,
        fallbackTypeId: FALLBACK,
        typeIsIdCard: false,
      }),
    ).toBe(false);
    // The row alone, with no fallback resolved — the value-lists doors' case,
    // and the second row an archive can hold.
    expect(
      typeMayHoldAForm({
        typeId: "some-other-uuid",
        typeKey: "NECLASIFICAT",
        typeName: "Neclasificat",
        fallbackTypeId: null,
        typeIsIdCard: false,
      }),
    ).toBe(false);
    // ⚠️ And the row the id witness alone would MISS — the archive's second
    // catch-all, sitting beside a correctly-resolved fallback that is not it.
    // This is the exact input the slice exists for: before it, this was `true`.
    expect(
      typeMayHoldAForm({
        typeId: "some-other-uuid",
        typeKey: "NECLASIFICAT",
        typeName: "Neclasificat",
        fallbackTypeId: FALLBACK,
        typeIsIdCard: false,
      }),
    ).toBe(false);
  });

  it("⚠️ narrows nothing for a type whose row is simply absent", () => {
    // The direction that would be a REGRESSION rather than the intended
    // widening: the run loop passes `null`/`null` for a type `runAiInterpret`
    // invented, and if that read as "catch-all" the run would silently stop
    // reporting every such type.
    expect(
      typeAwaitsForm({
        typeId: "type-invented-mid-run",
        typeKey: null,
        typeName: null,
        fallbackTypeId: FALLBACK,
        typeHasForm: false,
        typeIsIdCard: false,
      }),
    ).toBe(true);
  });

  it("⚠️ every call site hands the predicate the row's two columns", () => {
    // The reason `typeKey`/`typeName` are required-and-nullable rather than
    // optional, made into a test rather than left to the type checker.
    //
    // The type checker catches a call site that omits them ENTIRELY. What it
    // cannot catch is the shape this rule is actually about: a call site that
    // passes `null` for both because that was the quickest way to make `tsc`
    // green, on a screen that has the row sitting in a local variable. That
    // reads as "this caller has no row", which is a claim — and a false one
    // there — and it silently restores the narrow rule for that caller.
    //
    // So: the four sites that DO hold a row must be seen to read from it, and
    // the two that hand `null` must be the two the comments in
    // `bulk-import-dialog.tsx` argue for by name.
    const SITES: Array<[string, string, RegExp]> = [
      [
        "type-form-gate existingTypeOf",
        "src/lib/import/type-form-gate.ts",
        /typeKey: row\.key,\s*\n\s*typeName: row\.name,/,
      ],
      [
        "type-form-gate newTypeOf",
        "src/lib/import/type-form-gate.ts",
        /typeKey: key,\s*\n\s*typeName: name,/,
      ],
      [
        "doc-type-engine picker",
        "src/app/admin/doc-type-engine/_components/doc-type-engine.tsx",
        /typeKey: row\.key,\s*\n\s*typeName: row\.name,/,
      ],
    ];
    for (const [what, file, pattern] of SITES) {
      const code = stripComments(readFileSync(join(process.cwd(), file), "utf8"));
      expect([what, pattern.test(code)]).toEqual([what, true]);
    }

    // The import dialog's THREE sites (five until #37.85 removed the two
    // `shouldDiscoverType` calls) all read the row they looked up. The run loop
    // and the retry carry a `?? null` for the type `runAiInterpret` can invent
    // mid-run; `handleRecheckTypeForm` returns before its call when its fresh
    // list does not hold the type, so at the call it HAS a row and says so —
    // `typeKey: row.key`. The shape this test exists to catch is a site with a
    // row in a local variable passing `null` anyway.
    // ⚠️ **Comments stripped: this counts CALLS, so it must not see the places
    // that file discusses the function by name.**
    const dialog = stripComments(
      readFileSync(
        join(process.cwd(), "src/app/admin/import/_components/bulk-import-dialog.tsx"),
        "utf8",
      ),
    );
    const calls = [
      ...dialog.matchAll(/typeAwaitsForm\(\{[\s\S]*?\}\)/g),
    ].map((m) => m[0]);
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      // Both columns, each read from a row — either the nullable lookup the
      // two older sites share, or the narrowed one #34.24's site has after its
      // own null branch has returned.
      expect([call, /typeKey: (?:finalTypeRow\?\.key \?\? null|row\.key),/.test(call)]).toEqual([
        call,
        true,
      ]);
      expect([
        call,
        /typeName: (?:finalTypeRow\?\.name \?\? null|row\.name),/.test(call),
      ]).toEqual([call, true]);
      // ⚠️ Never a bare `null` literal: that would be the false claim above.
      expect(call).not.toMatch(/typeKey: null/);
      expect(call).not.toMatch(/typeName: null/);
    }
    // …and every one of those rows really is looked up from a list:
    // `finalTypeRow` twice — once in the run loop off `docTypeItems`, once in
    // the retry off `preflight.typeRows` — and #34.24's own `row` off the fresh
    // list its free GET has just read.
    expect([...dialog.matchAll(/const finalTypeRow =/g)]).toHaveLength(2);
    expect(dialog).toContain("docTypeItems.find((i) => i.id === finalTypeId)");
    expect(dialog).toContain("preflight.typeRows?.find((r) => r.id === finalTypeId)");
    expect(dialog).toContain("const row = fresh.typeRows?.find((r) => r.id === typeId) ?? null;");
  });

  it("⚠️ reads a BLANK key as 'ask the name', not as a catch-all", () => {
    // `type-form-gate.ts`'s `createdKeyOf` blanks `UNCLASSIFIED` to `""` on
    // purpose, so a synthetic row can arrive here with an empty key and a real
    // name. An empty key that refused would have stopped the gate reporting
    // every type the run would create.
    expect(
      typeMayHoldAForm({
        typeId: "new:0",
        typeKey: "",
        typeName: "Contract de vânzare",
        fallbackTypeId: FALLBACK,
        typeIsIdCard: false,
      }),
    ).toBe(true);
    expect(
      typeMayHoldAForm({
        typeId: "new:1",
        typeKey: "",
        typeName: "Neclasificat",
        fallbackTypeId: FALLBACK,
        typeIsIdCard: false,
      }),
    ).toBe(false);
  });
});

/**
 * ⚠️ **What a RETRY may claim, once the catalogue read behind it has failed.**
 *                                                              (Slice #34.11)
 *
 * The catalogue read said "no rows" in one field for two unrelated reasons:
 * the read did not come back (it threw, or it answered a 200 whose JSON carried
 * no `items` array), or — one `?.find` later, on a list that DID come back —
 * this id is not in it. #34.11 named the first `readFailed`. (Until #37.85 it
 * also gated a billed discovery read on it; that read is gone, and what is
 * pinned now is the row's `typeFormMissing` write.)
 *
 * Everything below is source inspection: the handler is inside a large client
 * component, behind a billed model call, three refs and a mounted guard. What
 * can be pinned cheaply is that the terms are there, and that the readers this
 * slice deliberately did NOT change are still shaped the way that makes them
 * safe.
 */
describe("⚠️ the retry path's witness for the catalogue read — Slice #34.11", () => {
  const DIALOG = "src/app/admin/import/_components/bulk-import-dialog.tsx";

  /**
   * ⚠️ **Comments stripped, and `@/lib/dev/strip-comments` rather than a local
   * regex** — the argument is written out at this file's own import of it. It
   * matters more here than anywhere else in the file: this slice's whole
   * output is comments plus four short terms, and a regex stripper that
   * over-strips turns the negative assertions below green over broken code.
   */
  const dialog = stripComments(readFileSync(join(process.cwd(), DIALOG), "utf8"));

  it("⚠️ says WHY it has no rows, on every return `readTypeCatalogue` has", () => {
    // The field itself. `boolean` and not `boolean | undefined`: a reader that
    // can forget to ask is the state this slice is removing, not adding.
    expect(dialog).toContain("readFailed: boolean;");

    // Both returns, counted rather than named, so a third one added later
    // cannot ship without an answer. The body is taken to the first
    // column-zero `}` after the declaration, which is this function's own end.
    const from = dialog.indexOf("async function readTypeCatalogue(");
    expect(from).toBeGreaterThan(-1);
    const body = dialog.slice(from, dialog.indexOf("\n}", from));
    const returns = [...body.matchAll(/return \{/g)].length;
    expect(returns).toBe(2);
    expect([...body.matchAll(/readFailed: (?:true|false)/g)]).toHaveLength(returns);

    // ⚠️ **…and an EMPTY list still takes the failed-read return.** Narrowing
    // this to `fresh === null` leaves every other assertion here green while
    // `readFailed` quietly stops covering the 200 whose JSON carried no `items`.
    expect(body).toContain("if (fresh === null || fresh.length === 0) {");

    // …and each one carries the answer that belongs to it: the early return is
    // the failed read, the tail return is the list that arrived.
    expect(body).toMatch(/readFailed: true,[\s\S]{0,200}typeRows: null/);
    expect(body).toMatch(/sessionLost: false,[\s\S]{0,200}readFailed: false,/);
  });

  it("⚠️ asks the NAMED fact, not the null it happens to equal", () => {
    // `readFailed` and `typeRows === null` are the same boolean — the two
    // returns set them together — so this pins a spelling, deliberately: the
    // null test says "there happen to be no rows" where the decision is about
    // "the read did not come back".
    expect(dialog).not.toContain("preflight.typeRows !== null");
    expect(dialog).toMatch(/preflight\.typeRows\?\.find\(\(\w+\) => \w+\.id === finalTypeId\)/);
    // The preflight is the retry's own read, after its model call.
    expect(dialog).toContain("const preflight = await readTypeCatalogue();");
  });

  it("⚠️ withholds the `typeFormMissing` write on a failed read — and clears it on a re-type", () => {
    // `updateResult` spreads the patch over the row, so an absent key keeps the
    // row's previous answer and an explicit `undefined` erases it. On a failed
    // read the computed answer is a claim made off a witness nobody has, so it
    // is not written at all.
    const at = dialog.indexOf("typeFormMissing: (awaitsForm");
    expect(at).toBeGreaterThan(-1);
    // …and there is no second, ungated copy of the same write left behind.
    expect([...dialog.matchAll(/typeFormMissing: \(awaitsForm/g)]).toHaveLength(1);
    const spreadAt = dialog.lastIndexOf("...(preflight.readFailed", at);
    expect(spreadAt).toBeGreaterThan(-1);
    const spread = dialog.slice(spreadAt, at);

    // ⚠️ **The failed-read side never writes a CLAIM.** Asserted as a property
    // rather than as the exact punctuation of the ternary, which a later
    // reader is entitled to reformat: what must not happen is a `true` reaching
    // the row off a list nobody read.
    expect(spread).not.toContain("typeFormMissing: true");

    // ⚠️ **…and on a RE-TYPE it clears rather than keeps.** The patch has just
    // written `documentTypeId: finalTypeId`, and every reader downstream reads
    // the flag against that column — so a `true` earned about the OLD type
    // would name the new one, which may be the most complete type in the
    // archive, as still waiting for a form.
    //
    // ⚠️ **Matched as ONE expression, through BOTH arms of the outer ternary,
    // and each half of that is a round's worth of learning.** Two `toContain`s
    // cannot say which arm the clear is on — swap them and the row keeps a
    // stale `true` on the re-type and loses a good one where nothing moved,
    // with both strings still present. And stopping at the inner ternary cannot
    // say the computed answer is still the ELSE arm: un-nest it to a sibling
    // key after the spread and it wins on every path, `readFailed` included,
    // which is the permanent false claim this slice exists to stop. The `\)?`
    // keeps a later parenthesisation or reflow of the inner ternary green.
    expect(dialog.slice(spreadAt)).toMatch(
      /interpreted\.documentTypeId !== null\s*\?\s*\{\s*typeFormMissing: undefined\s*\}\s*:\s*\{\s*\}\s*\)?\s*:\s*\{\s*typeFormMissing: \(awaitsForm/,
    );

    // ⚠️ **AND NOTHING WRITES THE KEY ANYWHERE ELSE IN THE SAME PATCH — the
    // WHOLE patch, not just what follows.** A literal property after a spread
    // wins, TypeScript allows it and so does lint; this file records a fifth
    // adversarial round losing a whole conditional spread to a plain
    // `aiFieldCount:` written below it. But the window has to open at the top
    // of the patch, because the direction that actually defeats THIS spread is
    // the other one: its failed-read arm is `{}`, and an absent key overrides
    // nothing — so a `typeFormMissing` written ABOVE it survives on exactly the
    // path the slice exists to protect. That is the house style two dozen lines
    // up in this very object (`aiFieldCount:` first, refined by a later
    // spread), which is what makes it the likely edit rather than the clever
    // one. Two occurrences, being the ternary's two arms.
    const patchStart = dialog.lastIndexOf("updateResult(path, {", spreadAt);
    const patchEnd = dialog.indexOf("});", at);
    expect(patchStart).toBeGreaterThan(-1);
    expect(patchEnd).toBeGreaterThan(spreadAt);
    expect([...dialog.slice(patchStart, patchEnd).matchAll(/typeFormMissing:/g)]).toHaveLength(2);
  });

  it("⚠️ leaves the three readers of an unread list answering `false`", () => {
    // `absorbTypeList` walks it, so its safety is the `?? []`: an unread list
    // refreshes no ref and absolves no type.
    expect(dialog).toMatch(/for \(const \w+ of \w+\.typeRows \?\? \[\]\)/);

    // The retry's two flags ask it a question instead of walking it (a third,
    // the second enrichment's widening of `typeAbsolved`, went with #37.85's
    // discovery read). `=== true` is what makes `undefined` — the answer
    // `?.some` gives on a null — read as "no". A truthiness test would answer
    // the same today and stop doing so the day somebody negates it.
    const asks = [...dialog.matchAll(/\.typeRows\?\.some\(/g)].map((m) => m.index ?? -1);
    expect(asks).toHaveLength(2);
    for (const at of asks) {
      expect([at, /\)\s*===\s*true/.test(dialog.slice(at, at + 200))]).toEqual([at, true]);
    }
    expect(dialog).not.toMatch(/!\s*\w+\.typeRows\?\.some\(/);
  });
});
