/**
 * Which document types an import spends a schema-free read on.  (Slice #27.05)
 *
 * The run now reads one document of every type it meets that has no custom
 * form, and offers the fields for review once the rows have settled. Two
 * questions decide that, they differ by exactly one term, and both of them are
 * asked inside a loop with three tasks in flight — which is the one place a
 * test cannot reach. So they live in `discover-run.ts` and are held here:
 *
 *  1. **Should the run PAY for this type?** One read per type per run, never on
 *     a type that already has a form, and never on the fallback type — that one
 *     is not a type whose form is missing, it is the type that means "we do not
 *     know", and every unclassified document in the archive shares it.
 *  2. **Should the ROW say the type is waiting for a form?** The same question
 *     without the per-run claim: the second, third and fortieth document of a
 *     new type all report a type that is waiting, and only the first is read.
 *
 * Nothing here makes a network call. `discoverForType` is a fetch wrapper and is
 * covered by the same argument `runAiInterpret`'s own suite makes about its.
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
import {
  shouldDiscoverType,
  typeAwaitsForm,
  typeMayHoldAForm,
} from "@/lib/import/discover-run";

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
 * `UNCLASSIFIED` alone, so the import's id-only rule reached none of them —
 * spent a billed discovery read on each and was then refused at the save.
 *
 * ⚠️ **`null`/`null` is in here on purpose and is NOT a catch-all row.** It is
 * "the caller has no row", which is what the two import call sites pass for a
 * type `runAiInterpret` invented mid-run. It must behave exactly as an ordinary
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

const ask = (over: Partial<Parameters<typeof shouldDiscoverType>[0]> = {}) =>
  shouldDiscoverType({
    typeId: "type-arenda",
    ...PLAIN,
    fallbackTypeId: FALLBACK,
    typeHasForm: false,
    typeIsIdCard: false,
    claimedTypeIds: new Set<string>(),
    // Slice #32.05 — the ordinary run. Every test below that does not say
    // otherwise is a run nobody waived.
    formsWaived: false,
    ...over,
  });

describe("whether the run spends a discovery read on a type", () => {
  it("reads a type it has never met that has no form", () => {
    expect(ask()).toBe(true);
  });

  it("does not read a type that already has a form", () => {
    // A discovery on a type WITH a form is a perfectly normal thing to do by
    // hand — it is how you find what is still unrecognised — and exactly the
    // wrong thing to do unasked, forty times, at a model call each.
    expect(ask({ typeHasForm: true })).toBe(false);
  });

  it("reads a type ONCE per run, however many documents of it arrive", () => {
    const claimed = new Set<string>();
    expect(ask({ claimedTypeIds: claimed })).toBe(true);
    claimed.add("type-arenda");
    expect(ask({ claimedTypeIds: claimed })).toBe(false);
  });

  it("⚠️ buys nothing at all once the run's forms are waived", () => {
    // Slice #32.05. The user pressed "continue without forms" on the stop
    // screen, which is a decision about what the run SPENDS. It holds for every
    // type the run meets afterwards, including the types the stop screen could
    // not name — a `new` type has no id there, and `runAiInterpret` can invent
    // one mid-run — which is exactly why the waiver is one boolean and not a
    // set of ids.
    expect(ask({ formsWaived: true })).toBe(false);
    expect(ask({ formsWaived: true, typeHasForm: true })).toBe(false);
    expect(ask({ formsWaived: true, typeId: "type-invented-mid-run" })).toBe(false);
  });

  it("⚠️ the waiver overrides every other input, and only in one direction", () => {
    // Slice #32.05, and the mirror of the test above it: with the waiver on,
    // the spending answer is NO over the whole input space, whatever the
    // reporting answer is. A waiver that let one combination through would be a
    // billed read the user has just declined to pay for, and the combination it
    // would let through is the one nobody constructs by hand.
    for (const typeId of ["type-arenda", FALLBACK, ""]) {
      for (const typeHasForm of [true, false]) {
        for (const fallbackTypeId of [FALLBACK, null]) {
          for (const typeIsIdCard of [true, false]) {
            expect(
              shouldDiscoverType({
                typeId,
                ...PLAIN,
                fallbackTypeId,
                typeHasForm,
                typeIsIdCard,
                claimedTypeIds: new Set<string>(),
                formsWaived: true,
              }),
            ).toBe(false);
          }
        }
      }
    }
  });

  it("⚠️ refuses the fallback type outright", () => {
    // The trap #27.04 was opened to close, rebuilt inside an unattended loop:
    // one unclassified document's fields, proposed for the catch-all every
    // unclassified document in the archive shares, with the ticks pre-set.
    expect(ask({ typeId: FALLBACK })).toBe(false);
  });

  it("still refuses a claimed fallback, and a formed one", () => {
    // Order of the terms must not matter — each is a veto on its own.
    expect(ask({ typeId: FALLBACK, typeHasForm: true })).toBe(false);
    expect(ask({ typeId: FALLBACK, claimedTypeIds: new Set([FALLBACK]) })).toBe(false);
  });

  it("⚠️ never reads the identity-card TYPE, whatever the bucket or the scan says", () => {
    // Two rounds. The first: `interpretSkipReason` answers `id-card` only when
    // the person action is on offer, which needs exactly one Property — so a
    // card under `common` or `floating` is read by the general extract, its
    // type has no form, and it is not the fallback, and every other term said
    // yes. The second: the fix then asked the SCAN, and this rule is about the
    // TYPE — a mislabelled card the model re-types onto CARTE_IDENTITATE has a
    // false scan signal, and a document the model correctly re-types AWAY from
    // a card has a true one. The caller answers from the type's key or name.
    expect(ask({ typeIsIdCard: true })).toBe(false);
    expect(
      typeAwaitsForm({
        typeId: "type-carte-identitate",
        typeKey: "CARTE_IDENTITATE",
        typeName: "Carte de identitate",
        fallbackTypeId: FALLBACK,
        typeHasForm: false,
        typeIsIdCard: true,
      }),
    ).toBe(false);
  });

  it("refuses an empty type id", () => {
    // Cannot happen — `document_type_id` is NOT NULL and the loop resolves one
    // before it creates the row — but the value that reaches here comes out of
    // a JSON response, and an empty one would claim a queue slot no dialog
    // could ever be opened for.
    expect(ask({ typeId: "" })).toBe(false);
  });

  it("reads normally when the fallback type is not known", () => {
    // `fallbackTypeId: null` must not make every type look like the fallback.
    expect(ask({ fallbackTypeId: null })).toBe(true);
    expect(ask({ typeId: "", fallbackTypeId: null })).toBe(false);
  });
});

describe("whether the ROW says the type is waiting for a form", () => {
  it("says so for every document of a formless type, not just the read one", () => {
    // The one term that differs, and the whole reason these are two functions:
    // a claim stops the second read, and must not stop the second sentence.
    const claimed = new Set(["type-arenda"]);
    expect(ask({ claimedTypeIds: claimed })).toBe(false);
    expect(
      typeAwaitsForm({
        typeId: "type-arenda",
        ...PLAIN,
        fallbackTypeId: FALLBACK,
        typeHasForm: false,
        typeIsIdCard: false,
      }),
    ).toBe(true);
  });

  it("is silent about a type that has a form, and about the fallback", () => {
    expect(
      typeAwaitsForm({
        typeId: "type-arenda",
        ...PLAIN,
        fallbackTypeId: FALLBACK,
        typeHasForm: true,
        typeIsIdCard: false,
      }),
    ).toBe(false);
    expect(
      typeAwaitsForm({
        typeId: FALLBACK,
        ...PLAIN,
        fallbackTypeId: FALLBACK,
        typeHasForm: false,
        typeIsIdCard: false,
      }),
    ).toBe(false);
  });

  it("⚠️ still SAYS the type is waiting for a form on a waived run", () => {
    // The half of the split that must not move, and it belongs in THIS describe
    // — the reporting one — because that is the question it answers.
    // `typeAwaitsForm` is what the ROW reports, and a waived type is still a
    // type with no form: the archive now holds documents on it, which is the
    // honest thing to say, and the one thing a waiver must never do is silence
    // it. If this ever goes false, the result screen starts reporting a fully
    // landed import over documents whose values have nowhere to go. Note the
    // shape of the guard: `typeAwaitsForm` takes NO `formsWaived`, so this test
    // is a statement about the signature as much as about the answer.
    expect(
      typeAwaitsForm({
        typeId: "type-arenda",
        ...PLAIN,
        fallbackTypeId: FALLBACK,
        typeHasForm: false,
        typeIsIdCard: false,
      }),
    ).toBe(true);
  });

  it("agrees with the spending rule everywhere the claim is empty", () => {
    // The invariant that keeps a screen from describing a decision the loop did
    // not make: with nothing claimed, the two answers are the same answer.
    //
    // ⚠️ **Slice #34.10 widened the space to the row's two columns**, which is
    // where the two rules could newly come apart: `typeAwaitsForm` reads them
    // and `shouldDiscoverType` only passes them on, so a term added to one and
    // forgotten in the other shows up here as a spending decision the row does
    // not describe. 3 × 2 × 2 × 2 × 5 = 240 combinations.
    for (const typeId of ["type-arenda", FALLBACK, ""]) {
      for (const typeHasForm of [true, false]) {
        for (const fallbackTypeId of [FALLBACK, null]) {
          for (const typeIsIdCard of [true, false]) {
            for (const row of CATCH_ALL_FIXTURE) {
              const { typeKey, typeName } = row;
              expect([
                row.what,
                shouldDiscoverType({
                  typeId,
                  typeKey,
                  typeName,
                  fallbackTypeId,
                  typeHasForm,
                  typeIsIdCard,
                  claimedTypeIds: new Set<string>(),
                  formsWaived: false,
                }),
              ]).toEqual([
                row.what,
                typeAwaitsForm({
                  typeId,
                  typeKey,
                  typeName,
                  fallbackTypeId,
                  typeHasForm,
                  typeIsIdCard,
                }),
              ]);
            }
          }
        }
      }
    }
  });
});


describe("⚠️ one rule at every door — Slice #34.10", () => {
  it("gives the SAME answer as the write door's predicate on every row", () => {
    // The claim the slice is built on, stated as an equality rather than as
    // two lists that happen to match. `documentTypeIsCatchAll` is what the
    // value-lists write door (`catchAllFormRefusal`) and Reference Data's
    // backlog filter already ask; `typeMayHoldAForm` is what the import's
    // discovery loop and DocTypeEngine's picker ask. Before this slice the
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
    // This is the exact input the slice exists for: before it, this was `true`,
    // the import bought a read, and the save was refused.
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
    // widening: two import call sites pass `null`/`null` for a type
    // `runAiInterpret` invented, and if that read as "catch-all" the run would
    // silently stop reporting and stop reading every such type.
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

    // The import dialog's five sites all read the row they looked up, and the
    // `?? null` is the mid-run-invented type the module header argues about.
    //
    // ⚠️ **FIVE SINCE #34.24, AND THE FIFTH SPELLS IT DIFFERENTLY ON PURPOSE.**
    // `handleRecheckTypeForm` returns before this call when its fresh list does
    // not hold the type (`if (row === null)`), so at the call it HAS a row and
    // says so — `typeKey: row.key` — where the other four carry a `?? null` for
    // the type `runAiInterpret` can invent mid-run. That is this test's own rule
    // being followed, not bent: the shape it exists to catch is a site with a
    // row in a local variable passing `null` anyway, which is the opposite. So
    // the assertion is "both columns, read from a row" rather than one
    // variable's name.
    // ⚠️ **Comments stripped: this counts CALLS, so it must not see the
    // eighteen places that file discusses these two functions by name.** None
    // of them currently spells `({`, so the raw version passed — and would go
    // red the day somebody wrote one that did, over code that is correct.
    const dialog = stripComments(
      readFileSync(
        join(process.cwd(), "src/app/admin/import/_components/bulk-import-dialog.tsx"),
        "utf8",
      ),
    );
    const calls = [
      ...dialog.matchAll(/(?:typeAwaitsForm|shouldDiscoverType)\(\{[\s\S]*?\}\)/g),
    ].map((m) => m[0]);
    expect(calls).toHaveLength(5);
    for (const call of calls) {
      // Both columns, each read from a row — either the nullable lookup the
      // four older sites share, or the narrowed one #34.24's site has after its
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
 * ⚠️ **What a RETRY may spend, once the catalogue read behind it has failed.**
 *                                                              (Slice #34.11)
 *
 * `enrichDiscoverSteps` said "no rows" in one field for two unrelated reasons:
 * the catalogue read did not come back (it threw, or it answered a 200 whose
 * JSON carried no `items` array), or — one `?.find` later, on a list that DID
 * come back — this id is not in it. The retry handler's docblock asserted the
 * second, in writing, and answered accordingly: on a 502 between its two reads
 * it bought a billed discovery on the narrow, id-only answer #34.10 widened
 * both predicates precisely to stop them giving.
 *
 * ⚠️ **And the sentence it asserted was the RUN LOOP's, which is where the
 * ordering makes it true.** There the list is `docTypeItems`, read at the start
 * of the run, so a type the re-classify route invents mid-run is genuinely
 * missing from it. In the retry handler the same GET runs AFTER
 * `runAiInterpret`, so that type is present — which is why `readFailed` is
 * asked here and why the two sites are pinned separately below.
 *
 * Everything below is source inspection, and the reason is the same one the
 * `every call site hands the predicate the row's two columns` test gives above:
 * the handler is 200 lines inside a 7,000-line client component, behind a
 * billed model call, three refs and a mounted guard. What can be pinned cheaply
 * is that the terms are there, that they are the terms the argument was made
 * about, and that the readers this slice deliberately did NOT change are still
 * shaped the way that makes them safe.
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

  /**
   * The retry's own guard: from the `if (` that opens it to the billed call it
   * gates, claim included.
   *
   * ⚠️ **Bounded by `discoverForType` rather than by `shouldDiscoverType`**, so
   * it holds the whole condition whichever order the terms are written in —
   * they are all pure reads and reordering them changes nothing — and it holds
   * the branch's first statement, which is where the claim has to be. It still
   * starts below the `if (preflight.sessionLost)` block a few lines above,
   * which mentions `abortRef` and is entitled to.
   */
  const guardOf = (code: string) => {
    // ⚠️ The SECOND anchor is searched from the preflight, because the run
    // loop sixteen hundred lines above spells `const discovered = await
    // discoverForType(` too — and taking the first match put the window in the
    // wrong handler, where it matched nothing and passed every negative
    // assertion in this block. (The first anchor needs no such guard: it occurs
    // exactly once in the file.)
    //
    // ⚠️ **The opening `if (` is found by looking BACK from the call it gates,
    // not forward from the preflight.** Taking the last `if (` in the whole
    // window meant an ordinary `if (!mountedRef.current) return;` added between
    // the claim and the billed read — this file does one on every await —
    // moved the window past the condition and turned four assertions red over
    // a guard nobody had touched.
    const start = code.indexOf("const preflight = await");
    const call = code.indexOf("const discovered = await discoverForType(", start);
    const region = code.slice(start, call);
    return region.slice(region.lastIndexOf("if (", region.indexOf("shouldDiscoverType({")));
  };

  it("⚠️ says WHY it has no rows, on every return `enrichDiscoverSteps` has", () => {
    // The field itself. `boolean` and not `boolean | undefined`: a reader that
    // can forget to ask is the state this slice is removing, not adding.
    expect(dialog).toContain("readFailed: boolean;");

    // Both returns, counted rather than named, so a third one added later
    // cannot ship without an answer. The body is taken to the first
    // column-zero `}` after the declaration, which is this function's own end.
    const from = dialog.indexOf("async function enrichDiscoverSteps(");
    expect(from).toBeGreaterThan(-1);
    const body = dialog.slice(from, dialog.indexOf("\n}", from));
    const returns = [...body.matchAll(/return \{/g)].length;
    expect(returns).toBe(2);
    expect([...body.matchAll(/readFailed: (?:true|false)/g)]).toHaveLength(returns);

    // ⚠️ **…and an EMPTY list still takes the failed-read return**, which is
    // half of what three comments in this slice now promise and what the flag
    // gates a billed call on. Narrowing this to `fresh === null` leaves every
    // other assertion here green while `readFailed` quietly stops covering the
    // 200 whose JSON carried no `items` — the case the function's own header
    // spends a paragraph on.
    expect(body).toContain("if (fresh === null || fresh.length === 0) {");

    // …and each one carries the answer that belongs to it: the early return is
    // the failed read, the tail return is the list that arrived. Both written
    // to survive a reflow — the early return is one 93-character line today and
    // a fifth field would break it across four.
    expect(body).toMatch(/names: null,[\s\S]{0,200}readFailed: true,[\s\S]{0,200}typeRows: null/);
    expect(body).toMatch(/names: fresh\.map\([\s\S]{0,200}readFailed: false,/);
  });

  it("⚠️ refuses the retry's discovery on a failed read, BESIDE the lost session", () => {
    // The retry's call is the second of the two in the file; the first is the
    // run loop's, which decides from `docTypeItems` and is out of this slice's
    // scope. Structurally proven rather than assumed: `preflight` does not
    // exist yet where the run loop asks.
    const calls = [...dialog.matchAll(/shouldDiscoverType\(\{/g)].map((m) => m.index ?? -1);
    expect(calls).toHaveLength(2);
    expect(dialog.indexOf("const preflight = await enrichDiscoverSteps(")).toBeGreaterThan(
      calls[0],
    );

    // Both terms guard the retry's call, and both are negations of a fact the
    // preflight reported — never of `abortRef`, the one-way latch two reviewers
    // rejected for the `sessionLost` term and which would fail the same way
    // here.
    //
    // ⚠️ **Cut at the guard's own `if (` rather than a fixed number of
    // characters back.** `stripComments` replaces a comment with its own
    // newlines so line numbers survive, and this slice's argument runs to
    // thirty lines of them — a window wide enough to hold both terms today
    // narrows to one the moment somebody adds a sentence. The window ends at
    // the billed call rather than at `shouldDiscoverType`, so reordering the
    // terms — which changes nothing, they are all pure reads — does not turn
    // this red.
    const guard = guardOf(dialog);
    // ⚠️ **The two `not`s below read the CONDITION, not the whole window.** The
    // window runs on to the billed call so the claim can be pinned inside it,
    // and both of these are statements about the terms: `||` is an ordinary
    // default in the statements between, and an `if (abortRef.current) return;`
    // ahead of the spend would be an improvement rather than the witness this
    // guard rejected twice. A round found each of them red over such a line,
    // with a message pointing at a condition nobody had touched.
    const condition = guard.slice(0, guard.indexOf(") {"));
    expect(guard).toContain("!preflight.sessionLost &&");
    expect(guard).toContain("!preflight.readFailed &&");
    expect(guard).toContain("shouldDiscoverType({");
    expect(condition).not.toContain("abortRef");

    // ⚠️ **AND the terms are ANDed.** `toContain` says a term is present, not
    // that it can refuse: `… && shouldDiscoverType({…}) || somethingElse` keeps
    // every assertion above green and puts the billed call back on a failed
    // read. Anything that genuinely needs an `||` in this condition is a
    // widening of what the archive spends, and going red here is the correct
    // way to find that out.
    expect(condition.replace(/shouldDiscoverType\(\{[\s\S]*?\}\)/, "")).not.toContain("||");

    // ⚠️ …and it asks the NAMED fact, not the null it happens to equal.
    // `readFailed` and `typeRows === null` are the same boolean — the two
    // returns set them together — so this pins a spelling, deliberately: the
    // null test says "there happen to be no rows" where the archive's money is
    // being decided on "the read did not come back", and the two stop being the
    // same thing the day a third return is written.
    expect(dialog).not.toContain("preflight.typeRows !== null");
    expect(dialog).toMatch(/preflight\.typeRows\?\.find\(\(\w+\) => \w+\.id === finalTypeId\)/);
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
    // archive, as still waiting for a form. The re-type half of the test the
    // `typeFormAdded` clear beside it uses — not the whole of it, which also
    // fires on `awaitsForm`, the answer this branch exists to distrust.
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

    // The other two named readers ask it a question instead of walking it —
    // and so does the second enrichment's widening of `typeAbsolved`, which is
    // why the count below is three and not two. `=== true` is what makes
    // `undefined` — the answer `?.some` gives on a null — read as "no". A
    // truthiness test would answer the same today and stop doing so the day
    // somebody negates it; this is the property, pinned rather than
    // inherited.
    const asks = [...dialog.matchAll(/\.typeRows\?\.some\(/g)].map((m) => m.index ?? -1);
    expect(asks).toHaveLength(3);
    for (const at of asks) {
      expect([at, /\)\s*===\s*true/.test(dialog.slice(at, at + 200))]).toEqual([at, true]);
    }
    expect(dialog).not.toMatch(/!\s*\w+\.typeRows\?\.some\(/);
  });

  it("⚠️ consults `discoverClaimedRef` no differently on either path", () => {
    // The ref keeps a failed DISCOVERY claimed on purpose — one rate limit must
    // not buy three more attempts inside a run — and this slice does not touch
    // that. A failed CATALOGUE read is a different thing entirely: no discovery
    // is made, so there is nothing to claim, and the type stays discoverable by
    // the next retry once the archive can be read again.
    expect([...dialog.matchAll(/claimedTypeIds: discoverClaimedRef\.current/g)]).toHaveLength(2);
    expect([...dialog.matchAll(/discoverClaimedRef\.current\.add\(/g)]).toHaveLength(2);

    // ⚠️ **Inside the branch the guard opens AND ahead of the billed call** —
    // which is what the window says, since it runs from the guard's own `if (`
    // to `discoverForType`. Both halves are load-bearing. A round found the
    // first draft of this test green under the mutation it exists to stop:
    // hoisting the `add` out of the branch claims the type on a failed
    // catalogue read, nothing ever lowers that ref, and the type is then
    // unreachable for the rest of the run — including after the archive becomes
    // readable again. And a claim made AFTER the `await` lets a second press
    // land while the first read is still in flight, buying it twice.
    expect(guardOf(dialog)).toContain("discoverClaimedRef.current.add(finalTypeId);");
  });
});
