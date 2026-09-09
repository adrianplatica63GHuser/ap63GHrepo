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

    // The import dialog's four sites all read the row it looked up, and the
    // `?? null` is the mid-run-invented type the module header argues about.
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
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call).toContain("typeKey: finalTypeRow?.key ?? null");
      expect(call).toContain("typeName: finalTypeRow?.name ?? null");
      // ⚠️ Never a bare `null` literal: that would be the false claim above.
      expect(call).not.toMatch(/typeKey: null/);
      expect(call).not.toMatch(/typeName: null/);
    }
    // …and `finalTypeRow` really is looked up from a list, twice — once in the
    // run loop off `docTypeItems`, once in the retry off `preflight.typeRows`.
    expect([...dialog.matchAll(/const finalTypeRow =/g)]).toHaveLength(2);
    expect(dialog).toContain("docTypeItems.find((i) => i.id === finalTypeId)");
    expect(dialog).toContain("preflight.typeRows?.find((r) => r.id === finalTypeId)");
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
