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

import { shouldDiscoverType, typeAwaitsForm } from "@/lib/import/discover-run";

const FALLBACK = "type-altul";

const ask = (over: Partial<Parameters<typeof shouldDiscoverType>[0]> = {}) =>
  shouldDiscoverType({
    typeId: "type-arenda",
    fallbackTypeId: FALLBACK,
    typeHasForm: false,
    typeIsIdCard: false,
    claimedTypeIds: new Set<string>(),
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
        fallbackTypeId: FALLBACK,
        typeHasForm: true,
        typeIsIdCard: false,
      }),
    ).toBe(false);
    expect(
      typeAwaitsForm({
        typeId: FALLBACK,
        fallbackTypeId: FALLBACK,
        typeHasForm: false,
        typeIsIdCard: false,
      }),
    ).toBe(false);
  });

  it("agrees with the spending rule everywhere the claim is empty", () => {
    // The invariant that keeps a screen from describing a decision the loop did
    // not make: with nothing claimed, the two answers are the same answer.
    for (const typeId of ["type-arenda", FALLBACK, ""]) {
      for (const typeHasForm of [true, false]) {
        for (const fallbackTypeId of [FALLBACK, null]) {
          for (const typeIsIdCard of [true, false]) {
            expect(
              shouldDiscoverType({
                typeId,
                fallbackTypeId,
                typeHasForm,
                typeIsIdCard,
                claimedTypeIds: new Set<string>(),
              }),
            ).toBe(
              typeAwaitsForm({ typeId, fallbackTypeId, typeHasForm, typeIsIdCard }),
            );
          }
        }
      }
    }
  });
});
