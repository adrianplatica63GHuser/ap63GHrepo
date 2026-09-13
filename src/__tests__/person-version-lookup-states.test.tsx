/**
 * A person's version can say „valoare ștearsă" too.             (Slice #34.27)
 *
 * WHAT IS AT RISK
 * ---------------
 * Deleting a lookup row is OFFERED even when a version snapshot still names it
 * — `dependents.ts` decides on purpose that snapshots are not dependents — so
 * the archive genuinely contains person versions whose `physicalPersonTypeId`,
 * `citizenshipId` or `judicialPersonTypeId` points at a row that no longer
 * exists. Slice #34.17 answered that for the property form; on the two person
 * forms each of those still rendered an EMPTY BOX, indistinguishable from a
 * field nobody ever filled in. This slice copies the pattern rather than
 * inventing it: the five states live in `src/lib/versioning/snapshot-lookup.ts`
 * and are tested there, and what is new here is each form's ADAPTER — the part
 * a test of the resolver cannot see.
 *
 * ⚠️ **`pending` IS THE STATE THAT COULD SHIP A LIE, AND IT IS TESTED FIRST.**
 * The option lists arrive from `useQuery` and are `undefined` until they
 * resolve — and stay `undefined` when the fetch fails. An adapter that read
 * "not in the list" as "deleted" would label every historical lookup on the
 * page „valoare ștearsă" for as long as the list was unread, and for ever if it
 * could not be read at all. The natural-person form is the dangerous one: its
 * two lists come from hooks that return `options: data ?? NO_OPTIONS`, so the
 * `undefined` is already gone by the time a caller sees it and only `listState`
 * still separates "unread" from "empty".
 *
 * ⚠️ **AND THE `isOnLatest` GATE IS THE OTHER HALF A RESOLVER TEST CANNOT SEE.**
 * Every assertion about a state passes just as happily against a form that
 * prints „valoare ștearsă" over the LIVE, EDITABLE row. Both adapters hold that
 * condition, so it is asserted here rather than read out of a component.
 *
 * The last `describe` is a BEHAVIOUR guard: comments are stripped before
 * anything is matched, so a docblock saying the right thing cannot make it
 * pass.
 */

import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

import { SnapshotValue } from "@/components/versioning/snapshot-value";
import { stripComments } from "@/lib/dev/strip-comments";
import {
  snapshotReplacesPicker,
  type SnapshotLookupOption,
  type SnapshotLookupState,
} from "@/lib/versioning/snapshot-lookup";
import {
  restoreBlockedBy as naturalRestoreBlockedBy,
  snapshotLookupStates as naturalLookupStates,
  type NaturalLookupList,
} from "@/app/natural-persons/_components/form-schema";
import {
  restoreBlockedBy as judicialRestoreBlockedBy,
  snapshotLookupStates as judicialLookupStates,
} from "@/app/judicial-persons/_components/form-schema";
import type { NaturalPersonSnapshot } from "@/lib/persons/validation";
import type { JudicialPersonSnapshot } from "@/lib/judicial-persons/validation";

// ---------------------------------------------------------------------------
// Fixtures — the shapes the two forms really hand their adapters
// ---------------------------------------------------------------------------

const DELETED_LABEL = "valoare ștearsă";

/**
 * The none-option the judicial form prepends before handing its array over.
 *
 * ⚠️ **THE TWO FORMS HAND OVER DIFFERENT ARRAYS, AND THE FIXTURES COPY THAT
 * RATHER THAN TIDY IT.** The judicial form passes
 * `judicialPersonTypeSelectOptions`, which starts with this; the natural form
 * passes the hook's own `personTypeOptions` / `citizenshipOptions`, which do
 * NOT — it prepends the none-option only for the `<select>`. Either is safe,
 * because `resolveSnapshotLookup` returns `empty` for a blank id before it ever
 * reads the list, and that is asserted below rather than assumed.
 */
const NONE: SnapshotLookupOption = { value: "", label: "—" };

const AVOCAT = "2c9b0d5a-1f44-4d6b-9d0a-3e7c8b1f5a20";
const NOTAR = "7a1e4c93-55b8-42f7-8c31-9d6b2f0a4e18";
const SRL = "b41f7c26-90a3-4e58-bb17-2d5e9a3c7f04";
const ROMANA = "5e8d2a71-6c94-4b3f-a052-8f1c7d9b3e26";
/** A row an admin deleted after a version had already recorded it. */
const GONE = "0f1d3f27-1a3f-4a1e-8f6d-5c2b9a7e4d10";

/** As the natural form hands them over: the hook's array, no none-option. */
const PERSON_TYPES: SnapshotLookupOption[] = [
  { value: AVOCAT, label: "Avocat" },
  { value: NOTAR, label: "Notar" },
];

const CITIZENSHIPS: SnapshotLookupOption[] = [{ value: ROMANA, label: "Română" }];

/** As the judicial form hands it over: assembled, none-option first. */
const JUDICIAL_TYPES: SnapshotLookupOption[] = [NONE, { value: SRL, label: "SRL" }];

/** A list the hook has read successfully. */
const loaded = (options: SnapshotLookupOption[]): NaturalLookupList => ({
  options,
  listState: "loaded",
});
/** A list whose first read has not come back yet. */
const loading = (): NaturalLookupList => ({ options: [], listState: "loading" });
/** A list whose read FAILED — `data` is still undefined, so still unread. */
const failed = (): NaturalLookupList => ({ options: [], listState: "failed" });

const EMPTY_NATURAL: NaturalPersonSnapshot["natural"] = {
  firstName: null,
  lastName: null,
  nickname: null,
  cnp: null,
  idDocumentType: null,
  idDocumentNumber: null,
  gender: null,
  dateOfBirth: null,
  personalPhone1: null,
  personalPhone2: null,
  workPhone: null,
  personalEmail1: null,
  personalEmail2: null,
  workEmail: null,
  placeOfBirth: null,
  idIssuingAuthority: null,
  idValidFrom: null,
  idValidUntil: null,
  idCardNumber: null,
  idMrzRaw: null,
  citizenshipId: null,
  physicalPersonTypeId: null,
  correspondenceSameAsHome: false,
};

function naturalSnap(
  over: Partial<NaturalPersonSnapshot["natural"]>,
): NaturalPersonSnapshot {
  return {
    notes: null,
    natural: { ...EMPTY_NATURAL, ...over },
    addresses: { HOME: null, CORRESPONDENCE: null },
  };
}

function judicialSnap(judicialPersonTypeId: string | null): JudicialPersonSnapshot {
  return {
    notes: null,
    judicial: {
      name: null,
      nickname: null,
      judicialPersonTypeId,
      cuiNumber: null,
      tradeRegisterNumber: null,
      contactPerson1Id: null,
      contactPerson2Id: null,
      correspondenceSameAsHq: false,
    },
    addresses: { HEADQUARTERS: null, CORRESPONDENCE: null },
  };
}

/** The natural adapter, with both lists loaded unless a case says otherwise. */
function natural(input: {
  snapshot?: NaturalPersonSnapshot;
  isOnLatest?: boolean;
  personTypes?: NaturalLookupList;
  citizenships?: NaturalLookupList;
}) {
  return naturalLookupStates({
    snapshot: input.snapshot,
    isOnLatest: input.isOnLatest ?? false,
    personTypes: input.personTypes ?? loaded(PERSON_TYPES),
    citizenships: input.citizenships ?? loaded(CITIZENSHIPS),
  });
}

// ---------------------------------------------------------------------------
// pending — an unread list is never a deleted row
// ---------------------------------------------------------------------------

describe("an unread list never accuses a row of being deleted", () => {
  it("is pending on the natural form while either list is still loading", () => {
    const snap = naturalSnap({ physicalPersonTypeId: AVOCAT, citizenshipId: ROMANA });
    expect(natural({ snapshot: snap, personTypes: loading() })).toEqual({
      physicalPersonTypeId: { kind: "pending" },
      citizenshipId: { kind: "resolved", label: "Română" },
    });
    expect(natural({ snapshot: snap, citizenships: loading() })).toEqual({
      physicalPersonTypeId: { kind: "resolved", label: "Avocat" },
      citizenshipId: { kind: "pending" },
    });
  });

  it("treats a list that could not be read exactly like an unread one", () => {
    // ⚠️ This is the case the hook's shape hides. `useCitizenshipOptions`
    // returns `options: data ?? NO_OPTIONS`, so a FAILED read and a list that
    // genuinely holds no rows both arrive as `[]`. Only `listState` still
    // separates them — and `fetchValueList` rejects `res.redirected` as well as
    // `!res.ok` (Slice #34.04), so an expired session's login-page HTML throws
    // instead of caching `{}` as a successful empty array.
    const snap = naturalSnap({ citizenshipId: ROMANA });
    expect(natural({ snapshot: snap, citizenships: failed() }).citizenshipId).toEqual({
      kind: "pending",
    });
  });

  it("is pending on the judicial form while the query has no data", () => {
    expect(
      judicialLookupStates({
        snapshot: judicialSnap(SRL),
        isOnLatest: false,
        judicialTypes: undefined,
      }),
    ).toEqual({ judicialPersonTypeId: { kind: "pending" } });
  });

  it("prints NOTHING AT ALL while it is pending — not a blank sentence", () => {
    // `pending` hands the field back to the picker. The picker's own blank is
    // what every field on these forms has shown while its list loaded since
    // Slice #32.13; what `pending` buys is that the transient is a blank rather
    // than a wrong sentence, which is a state nothing can recover from once a
    // user has read it.
    const state = natural({
      snapshot: naturalSnap({ citizenshipId: ROMANA }),
      citizenships: failed(),
    }).citizenshipId;
    expect(snapshotReplacesPicker(state)).toBe(false);
    expect(show(state).innerHTML).toBe("");
  });
});

// ---------------------------------------------------------------------------
// The latest version is the live row and is never labelled
// ---------------------------------------------------------------------------

describe("the LIVE row keeps its picker, whatever the list says", () => {
  it("reads NOTHING on the latest natural version, whatever the snapshot holds", () => {
    // Both columns are ON DELETE SET NULL, so the live copy cannot hold a
    // stranded id — and a label printed over a picker the user is allowed to
    // change would be both wrong and unchangeable.
    expect(
      natural({
        snapshot: naturalSnap({ physicalPersonTypeId: GONE, citizenshipId: GONE }),
        isOnLatest: true,
      }),
    ).toEqual({
      physicalPersonTypeId: { kind: "empty" },
      citizenshipId: { kind: "empty" },
    });
  });

  it("reads NOTHING on the latest judicial version, whatever the snapshot holds", () => {
    expect(
      judicialLookupStates({
        snapshot: judicialSnap(GONE),
        isOnLatest: true,
        judicialTypes: JUDICIAL_TYPES,
      }),
    ).toEqual({ judicialPersonTypeId: { kind: "empty" } });
  });

  it("leaves the picker in place for every state it returns on the latest", () => {
    const nat = natural({
      snapshot: naturalSnap({ physicalPersonTypeId: GONE, citizenshipId: GONE }),
      isOnLatest: true,
    });
    for (const state of Object.values(nat)) {
      expect(snapshotReplacesPicker(state)).toBe(false);
    }
    const jud = judicialLookupStates({
      snapshot: judicialSnap(GONE),
      isOnLatest: true,
      judicialTypes: [],
    });
    expect(snapshotReplacesPicker(jud.judicialPersonTypeId)).toBe(false);
  });

  it("reads nothing when no version has loaded yet", () => {
    expect(natural({ snapshot: undefined })).toEqual({
      physicalPersonTypeId: { kind: "empty" },
      citizenshipId: { kind: "empty" },
    });
    expect(
      judicialLookupStates({
        snapshot: undefined,
        isOnLatest: false,
        judicialTypes: JUDICIAL_TYPES,
      }),
    ).toEqual({ judicialPersonTypeId: { kind: "empty" } });
  });

  it("hands back a FRESH object each time it reads nothing", () => {
    // ⚠️ A review round found a module-level singleton in the property form's
    // copy of this, frozen SHALLOWLY — so its members stayed writable, and one
    // stray mutation would have corrupted every later call in the tab.
    const a = natural({ snapshot: undefined });
    const b = natural({ snapshot: undefined });
    expect(a).not.toBe(b);
    expect(a.citizenshipId).not.toBe(b.citizenshipId);

    const ja = judicialLookupStates({ snapshot: undefined, isOnLatest: true, judicialTypes: undefined });
    const jb = judicialLookupStates({ snapshot: undefined, isOnLatest: true, judicialTypes: undefined });
    expect(ja).not.toBe(jb);
    expect(ja.judicialPersonTypeId).not.toBe(jb.judicialPersonTypeId);
  });
});

// ---------------------------------------------------------------------------
// What the version view prints, field by field
// ---------------------------------------------------------------------------

function show(state: SnapshotLookupState) {
  const { container } = render(
    <SnapshotValue state={state} deletedLabel={DELETED_LABEL} className="ring-2" />,
  );
  return container;
}

describe("paging back to a person's version", () => {
  const CASES = [
    {
      field: "physicalPersonTypeId",
      label: "Avocat",
      states: (id: string | null) =>
        natural({ snapshot: naturalSnap({ physicalPersonTypeId: id }) })
          .physicalPersonTypeId,
      live: AVOCAT,
    },
    {
      field: "citizenshipId",
      label: "Română",
      states: (id: string | null) =>
        natural({ snapshot: naturalSnap({ citizenshipId: id }) }).citizenshipId,
      live: ROMANA,
    },
    {
      field: "judicialPersonTypeId",
      label: "SRL",
      states: (id: string | null) =>
        judicialLookupStates({
          snapshot: judicialSnap(id),
          isOnLatest: false,
          judicialTypes: JUDICIAL_TYPES,
        }).judicialPersonTypeId,
      live: SRL,
    },
  ] as const;

  it.each(CASES.map((c) => [c.field, c] as const))(
    "%s resolves to the row's CURRENT label and keeps the picker",
    (_field, c) => {
      const state = c.states(c.live);
      expect(state).toEqual({ kind: "resolved", label: c.label });
      // `resolved` is an ordinary option: the picker showing it selected is
      // both correct and the behaviour every version has had since #18.02.
      expect(snapshotReplacesPicker(state)).toBe(false);
      expect(show(state).innerHTML).toBe("");
    },
  );

  it.each(CASES.map((c) => [c.field, c] as const))(
    "%s says the value was deleted when only the snapshot still names the row",
    (_field, c) => {
      const state = c.states(GONE);
      expect(state.kind).toBe("deleted");
      expect(snapshotReplacesPicker(state)).toBe(true);
      show(state);
      expect(screen.getByText(DELETED_LABEL)).toBeInTheDocument();
    },
  );

  it.each(CASES.map((c) => [c.field, c] as const))(
    "%s is empty — not deleted — when the snapshot recorded nothing",
    (_field, c) => {
      const state = c.states(null);
      expect(state).toEqual({ kind: "empty" });
      expect(snapshotReplacesPicker(state)).toBe(false);
    },
  );

  it.each(CASES.map((c) => [c.field, c] as const))(
    "%s never puts the deleted id into a control",
    (_field, c) => {
      // The hole `optionsWithUnlistedValues` left and Slice #34.03 closed: a
      // synthesised `<option>` would put a dangling uuid one `setValue` away
      // from a save. Nothing here is selectable and nothing here is written.
      const container = show(c.states(GONE));
      expect(container.querySelector("select")).toBeNull();
      expect(container.querySelector("option")).toBeNull();
      expect(container.querySelector("input")).toBeNull();
      expect(container.innerHTML).not.toContain(GONE);
    },
  );

  it("calls an id deleted when the list loaded EMPTY — every row really is gone", () => {
    expect(
      natural({
        snapshot: naturalSnap({ citizenshipId: ROMANA }),
        citizenships: loaded([]),
      }).citizenshipId.kind,
    ).toBe("deleted");
    expect(
      judicialLookupStates({
        snapshot: judicialSnap(SRL),
        isOnLatest: false,
        judicialTypes: [],
      }).judicialPersonTypeId.kind,
    ).toBe("deleted");
  });

  it("never matches the none-option the judicial array carries", () => {
    // A snapshot's `""`/null is `empty` long before any lookup happens, which
    // is what makes it safe for one form to hand over an assembled array and
    // the other to hand over the hook's.
    expect(
      natural({ snapshot: naturalSnap({ citizenshipId: "" }) }).citizenshipId,
    ).toEqual({ kind: "empty" });
    expect(JUDICIAL_TYPES[0].value).toBe("");
    expect(
      judicialLookupStates({
        snapshot: judicialSnap(""),
        isOnLatest: false,
        judicialTypes: JUDICIAL_TYPES,
      }).judicialPersonTypeId,
    ).toEqual({ kind: "empty" });
  });
});

// ---------------------------------------------------------------------------
// What a restore can and cannot do with the version on screen
//
// ⚠️ **THIS ARRIVED WITH THE PRINTING HALF ON PURPOSE.** Before this slice the
// field was an empty box and "Make current" on a version with a deleted lookup
// row was a mistake nobody was invited to make; „valoare ștearsă" is exactly
// the cue that invites a user to repair the record by restoring the version —
// which re-saves the form, dangling uuid and all, into a foreign key, and comes
// back 23503 as the English string „Foreign key violation". Both reviews of
// this slice found the half-port independently.
// ---------------------------------------------------------------------------

describe("restoreBlockedBy", () => {
  it("blocks on a deleted row — the restore would PATCH a dangling uuid", () => {
    expect(
      naturalRestoreBlockedBy(natural({ snapshot: naturalSnap({ citizenshipId: GONE }) })),
    ).toEqual(["citizenshipId"]);
    expect(
      judicialRestoreBlockedBy(
        judicialLookupStates({
          snapshot: judicialSnap(GONE),
          isOnLatest: false,
          judicialTypes: JUDICIAL_TYPES,
        }),
      ),
    ).toEqual(["judicialPersonTypeId"]);
  });

  it("names BOTH natural fields, in display order, when both are gone", () => {
    // The dialog names the fields rather than counting them: the two sit in
    // different sections of the form, so "a value" would be a reason nobody
    // could act on. Display order is Professional Type (Identification) then
    // Citizenship (ID card).
    expect(
      naturalRestoreBlockedBy(
        natural({ snapshot: naturalSnap({ physicalPersonTypeId: GONE, citizenshipId: GONE }) }),
      ),
    ).toEqual(["physicalPersonTypeId", "citizenshipId"]);
  });

  it("blocks nothing on a row that is still there", () => {
    expect(
      naturalRestoreBlockedBy(
        natural({ snapshot: naturalSnap({ physicalPersonTypeId: AVOCAT, citizenshipId: ROMANA }) }),
      ),
    ).toEqual([]);
  });

  it("blocks nothing on an UNREAD list — an unread list is not evidence", () => {
    // ⚠️ Refusing on `pending` would take every restore away for as long as a
    // value-list fetch kept failing, on evidence nobody has read. The cost is
    // that a restore can still reach the 23503 inside that window; the form
    // re-checks this predicate when the confirmation dialog is answered, which
    // closes the narrower case of a list that resolves while it is open.
    expect(
      naturalRestoreBlockedBy(
        natural({ snapshot: naturalSnap({ citizenshipId: GONE }), citizenships: failed() }),
      ),
    ).toEqual([]);
    expect(
      judicialRestoreBlockedBy(
        judicialLookupStates({
          snapshot: judicialSnap(GONE),
          isOnLatest: false,
          judicialTypes: undefined,
        }),
      ),
    ).toEqual([]);
  });

  it("blocks nothing on the latest version", () => {
    // The live row cannot hold a stranded id, so the refusal must never appear
    // over the one version the user is allowed to edit.
    expect(
      naturalRestoreBlockedBy(
        natural({
          snapshot: naturalSnap({ physicalPersonTypeId: GONE, citizenshipId: GONE }),
          isOnLatest: true,
        }),
      ),
    ).toEqual([]);
    expect(
      judicialRestoreBlockedBy(
        judicialLookupStates({ snapshot: judicialSnap(GONE), isOnLatest: true, judicialTypes: [] }),
      ),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The wiring — that the forms actually ask, and ask correctly
//
// ⚠️ **A BEHAVIOUR GUARD: comments are stripped first.** Everything above
// passes just as happily against a form that never calls either adapter, or
// that calls the natural one with `citizenshipOptions` alone — which is the
// shape that would put „valoare ștearsă" under every unread list on the page.
// ---------------------------------------------------------------------------

const SRC = join(process.cwd(), "src");

const FORMS = [
  {
    label: "natural-person form",
    file: join("app", "natural-persons", "_components", "natural-person-form.tsx"),
    fields: ["physicalPersonTypeId", "citizenshipId"],
  },
  {
    label: "judicial-person form",
    file: join("app", "judicial-persons", "_components", "judicial-person-form.tsx"),
    fields: ["judicialPersonTypeId"],
  },
] as const;

const formSource = (file: string) =>
  stripComments(readFileSync(join(SRC, file), "utf8"));

describe("both person forms print what the snapshot recorded", () => {
  it.each(FORMS.map((f) => [f.label, f] as const))(
    "%s reads its version's lookup states and hands each select its own",
    (_label, form) => {
      const code = formSource(form.file);
      expect(code).toContain("snapshotLookupStates(");
      expect(code).toContain('from "@/components/versioning/snapshot-value"');
      // ⚠️ **THE CONDITION ITSELF, NOT MERELY A MENTION OF IT.** An adversarial
      // round added one `!` — `if (snapshot && !snapshotReplacesPicker(...))` —
      // and every other assertion in this file stayed green, while on screen
      // all three selects lost their control entirely: `SnapshotValue` returns
      // `null` for `empty`, `pending` and `resolved`, so create mode, edit mode
      // and the latest version would each render an empty labelled box.
      expect(code).toMatch(/if \(snapshot && snapshotReplacesPicker\(snapshot\)\)/);
      // And that the thing it prints is the state it was handed.
      expect(code).toMatch(/<SnapshotValue[\s\S]{0,80}?state=\{snapshot\}/);
      for (const field of form.fields) {
        expect(code).toMatch(
          new RegExp(`name="${field}"[\\s\\S]{0,600}?snapshot=\\{snapshotLookups\\.${field}\\}`),
        );
      }
    },
  );

  it.each(FORMS.map((f) => [f.label, f] as const))(
    "%s prints the value in a labelled group rather than beside a dangling span",
    (_label, form) => {
      // `role="group"` + `aria-labelledby`: the value is no longer a control
      // for a `<label>` to point at, and a `<span>` beside a `<div>` is nothing
      // to a screen reader.
      const code = formSource(form.file);
      expect(code).toMatch(/role="group"[\s\S]{0,120}?aria-labelledby=\{labelId\}/);
      // ⚠️ **`tSnapshot`, not `tShared`.** Both forms bind `tShared` to
      // `shared.readonlyView` at component scope, and
      // `record-list-agreement.test.ts` requires every `tShared("key")` in a
      // file to resolve under the first namespace that name is bound to — so a
      // second `tShared` here composed `shared.readonlyView.snapshotValue.
      // deleted` and that suite caught it. The label gets its own binding.
      expect(code).toMatch(/<SnapshotValue[\s\S]{0,200}?deletedLabel=\{tSnapshot\("snapshotValue\.deleted"\)\}/);
      expect(code).toMatch(/const tSnapshot = useTranslations\("shared"\);/);
      // And the component-scope binding is left alone: a `tShared` re-bound to
      // `shared` would take `shared.readonlyView.modifyNeedsLatest` with it.
      expect(code).toMatch(/const tShared = useTranslations\("shared\.readonlyView"\);/);
    },
  );

  it("hands the natural adapter the list STATE, not the bare options array", () => {
    // ⚠️ THE ONE THAT MATTERS. `options: data ?? NO_OPTIONS` means the array
    // alone cannot say "unread"; passing it alone would label every historical
    // lookup „valoare ștearsă" until the list arrived, and for ever if it never
    // did. Read out of the source rather than asserted against a literal,
    // because a guard that cannot see the shape it is written against is worse
    // than none.
    const code = formSource(FORMS[0].file);
    const call = code.slice(code.indexOf("snapshotLookupStates({"));
    const args = call.slice(0, call.indexOf("});") + 1);
    // ⚠️ BOTH members of both pairs. A round cross-wired one — `personTypes: {
    // options: citizenshipOptions, listState: personTypeListState }` — and a
    // regex that looked only at `listState` stayed green, while the Professional
    // Type field resolved against the citizenship list: plausible labels for the
    // wrong field, and „valoare ștearsă" over rows that are perfectly alive.
    expect(args).toMatch(
      /personTypes:\s*\{\s*options:\s*personTypeOptions\s*,\s*listState:\s*personTypeListState\s*\}/,
    );
    expect(args).toMatch(
      /citizenships:\s*\{\s*options:\s*citizenshipOptions\s*,\s*listState:\s*citizenshipListState\s*\}/,
    );
  });

  it("gates the judicial adapter on the QUERY's data, not the assembled array", () => {
    // The assembled array is never `undefined` — the none-option is prepended
    // unconditionally — so gating on it would make every id `deleted` the
    // moment the list failed to read.
    // ⚠️ The whole ternary, both arms. A round wrote `judicialPersonTypes ? []
    // : undefined` and a regex that stopped at the `?` stayed green, while
    // every historical type read „valoare ștearsă" the moment the list loaded.
    const code = formSource(FORMS[1].file);
    expect(code).toMatch(
      /judicialTypes:\s*judicialPersonTypes\s*\?\s*judicialPersonTypeSelectOptions\s*:\s*undefined/,
    );
  });

  it.each(FORMS.map((f) => [f.label, f] as const))(
    "%s refuses the restore instead of PATCHing a dangling uuid",
    (_label, form) => {
      // The press stays ENABLED and swaps dialogs: a disabled button puts its
      // reason in a `title`, on a control out of the tab order and unannounced.
      // And `handleMakeCurrent` re-checks, for the list that resolves while the
      // confirmation dialog is open.
      const code = formSource(form.file);
      expect(code).toContain("restoreBlockedBy(");
      // The button stays enabled and SWAPS dialogs.
      expect(code).toMatch(/restoreBlocked\.length > 0[\s\S]{0,80}?setShowCannotRestore\(true\)\s*:\s*setConfirmMakeCurrent\(true\)/);
      // ⚠️ **`handleMakeCurrent` re-checks, and CLOSES the confirmation on its
      // way — both halves.** A round dropped `setConfirmMakeCurrent(false)` and
      // an earlier version of this regex, which spanned the two lines without
      // requiring the close, stayed green: on screen the confirmation and the
      // refusal would then render stacked.
      expect(code).toMatch(
        /if \(restoreBlocked\.length > 0\) \{\s*setConfirmMakeCurrent\(false\);\s*setShowCannotRestore\(true\);\s*return;/,
      );
      expect(code).toMatch(
        /showCannotRestore && restoreBlocked\.length > 0[\s\S]{0,400}?makeCurrent\.blocked"/,
      );
    },
  );

  it.each(FORMS.map((f) => [f.label, f] as const))(
    "%s closes both make-current dialogs when the user walks to another version",
    (_label, form) => {
      // ⚠️ **`ConfirmDialog` HAS NO FOCUS TRAP AND THE ◀/▶ NAV IS PORTALLED
      // OUTSIDE IT**, so Shift+Tab and Enter step to another version with a
      // dialog still up. The refusal would then name fields from a version
      // nobody is looking at — or reopen, unpressed, on the next blocked
      // version. The confirmation is the worse half: it would restore the
      // version the user ARRIVED at, not the one they agreed to.
      // `property-form.tsx` has cleared both inside `goToVersion` since #34.17;
      // an adversarial round found both person forms missing it.
      const code = formSource(form.file);
      const body = code.slice(code.indexOf("const goToVersion = (target: number) => {"));
      const head = body.slice(0, body.indexOf("setViewingVersion(target);"));
      expect(head).toContain("setShowCannotRestore(false);");
      expect(head).toContain("setConfirmMakeCurrent(false);");
      // Before the `if (!snap) return;` early exit, or a version that has not
      // loaded leaves them up.
      expect(head.indexOf("setShowCannotRestore(false);")).toBeLessThan(
        head.indexOf("if (!snap) return;"),
      );
      expect(head.indexOf("setConfirmMakeCurrent(false);")).toBeLessThan(
        head.indexOf("if (!snap) return;"),
      );
    },
  );

  it("hands `isOnLatest` to the adapter instead of deciding at the call site", () => {
    // The gate is inside the adapters, which is what makes it a unit test
    // rather than a source-reading guard; the forms' job is to pass the fact.
    for (const form of FORMS) {
      const code = formSource(form.file);
      const call = code.slice(code.indexOf("snapshotLookupStates({"));
      expect(call.slice(0, call.indexOf("});") + 1)).toContain("isOnLatest");
    }
  });
});

// ---------------------------------------------------------------------------
// The copy exists, in the locale that ships
// ---------------------------------------------------------------------------

describe("the sentences the user reads", () => {
  const messages = (locale: string) =>
    JSON.parse(
      readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
    ) as Record<string, { makeCurrent?: Record<string, string | undefined> }>;

  it("carries the deleted-value label both forms print", () => {
    // `DEFAULT_LOCALE` is ro-RO, so a missing key renders as a raw key path in
    // the shipping locale. Both keys predate this slice (#34.17 wrote them);
    // this asserts the two new call sites are asking for something that exists.
    const shared = JSON.parse(
      readFileSync(join(process.cwd(), "messages", "ro-RO.json"), "utf8"),
    ) as { shared: { snapshotValue?: { deleted?: string } } };
    expect(shared.shared.snapshotValue?.deleted).toBe(DELETED_LABEL);
  });

  it.each(["ro-RO", "en-GB"])("refuses the restore in %s, and NAMES the fields", (locale) => {
    for (const ns of ["naturalPerson", "judicialPerson"]) {
      const mc = messages(locale)[ns]?.makeCurrent ?? {};
      expect(typeof mc.blockedTitle).toBe("string");
      expect(typeof mc.blocked).toBe("string");
      // ⚠️ **A TRAILING, LABELLED LIST.** `{fields}` is what stops the refusal
      // saying "a value" about a field that may be in another section of the
      // form — and it goes last, so a list of two names cannot be read as the
      // middle of a sentence.
      // ⚠️ **A TRAILING, LABELLED LIST.** `restoreBlockedBy` returns one name
      // or two, so any sentence whose verb sits next to `{fields}` has to agree
      // with a number nobody knows at write time. Keeping the placeholder last
      // is what makes the copy number-agnostic. A character-count version of
      // this assertion admitted „… Fields: {fields} is gone." — these two are
      // `snapshot-lookup.test.tsx`'s, verbatim, because they are the ones that
      // hold the shape rather than its length.
      expect(mc.blocked).toMatch(/\{fields\}\.?$/);
      // …and no SINGULAR lead-in label either: „Câmpul: {fields}." keeps the
      // placeholder last and still disagrees with two.
      expect(mc.blocked).not.toMatch(/\b(Câmpul|Field):\s*\{fields\}/);
      // Single-button info dialog: it reuses `ok` and never offers `cancel`.
      expect(typeof mc.ok).toBe("string");
    }
  });

  it("is spelled with comma-below ș and with ă in ro-RO", () => {
    for (const ns of ["naturalPerson", "judicialPerson"]) {
      const ro = messages("ro-RO")[ns]?.makeCurrent?.blocked ?? "";
      expect(ro).toContain("ș"); // ș, not the Turkish cedilla ş (U+015F)
      expect(ro).toContain("ă");
      expect(ro).not.toContain("ş");
    }
  });

  it("leaves the document namespace alone, like the form", () => {
    for (const locale of ["ro-RO", "en-GB"]) {
      expect(messages(locale).document?.makeCurrent?.blocked).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// document-form.tsx is NOT in this slice, and that is deliberate
// ---------------------------------------------------------------------------

describe("the third form is still waiting", () => {
  it("has not been half-converted along the way", () => {
    // #34.17: „`document-form.tsx` is the awkward one, because its select is
    // raw (allow-listed out of `async-select-single-source`) and
    // `documentTypeId` drives the custom-field form." Its own slice, with its
    // own review — not a third of this one. This asserts the leaving-alone, so
    // a future reader sees it was a decision rather than an oversight.
    const code = formSource(join("app", "documents", "_components", "document-form.tsx"));
    // Two negatives need a positive beside them: `stripComments` over-stripping
    // would turn both into false passes. Its own header warns about exactly
    // that, so this asserts the file is still the file.
    expect(code).toContain("documentTypeId");
    expect(code).not.toContain("snapshotLookupStates(");
    expect(code).not.toContain("SnapshotValue");
  });
});
