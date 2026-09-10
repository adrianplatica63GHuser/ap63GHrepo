/**
 * A version that can say „valoare ștearsă".                     (Slice #34.17)
 *
 * WHAT IS AT RISK
 * ---------------
 * Deleting a lookup row is OFFERED even when a version snapshot still names it
 * — `dependents.ts` decides on purpose that snapshots are not dependents — so
 * the archive genuinely contains versions whose `propertyTypeId`,
 * `useCategoryId` or `tarlaId` points at a row that no longer exists. Until
 * this slice each of those rendered an EMPTY BOX, indistinguishable from a
 * field nobody ever filled in. A separate population renders the same empty box
 * permanently: every property version written before migration_078 holds the
 * tarla as `tarlaSola` TEXT with no id at all, because Slice #34.03 deliberately
 * did not rewrite `property_version.snapshot`.
 *
 * The three cases the slice owes an answer to are asserted at the bottom, on
 * snapshot objects of the shape the database really holds — including the
 * legacy one, which is built through `unknown` because `AssertExactKeys` keeps
 * `tarlaSola` out of the current type by design.
 *
 * ⚠️ **THE FOURTH CASE IS THE ONE THAT COULD SHIP A LIE**, and it has no
 * screenshot to prompt it: the option lists arrive from `useQuery` and are
 * `undefined` until they resolve — and stay `undefined` when the fetch fails.
 * A resolver that read "not in the list" as "deleted" would label every
 * historical lookup on the page „valoare ștearsă" for as long as the list was
 * unread, and for ever if it could not be read at all. `pending` is that case
 * and it is tested first, because it is the one a reviewer looking at a working
 * screen would never think to try.
 */

import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

import {
  restoreBlockedBy,
  restoreDropsRecorded,
  snapshotLookupStates,
} from "@/app/properties/_components/form-schema";
import { SnapshotValue } from "@/components/versioning/snapshot-value";
import {
  resolveSnapshotLookup,
  snapshotRecordedText,
  snapshotReplacesPicker,
  type SnapshotLookupOption,
  type SnapshotLookupState,
} from "@/lib/versioning/snapshot-lookup";
import type { PropertySnapshot } from "@/lib/properties/validation";

// ---------------------------------------------------------------------------
// Fixtures — the shapes the property form really hands the resolver
// ---------------------------------------------------------------------------

const NONE: SnapshotLookupOption = { value: "", label: "— niciunul —" };

const ARABIL = "63877b7f-dcd6-4509-a3c7-e0ba7c00dbea";
const GARAJ = "f57ad7a3-8487-4a32-be98-93e2bd892b45";
/** A row an admin deleted after a version had already recorded it. */
const GONE = "0f1d3f27-1a3f-4a1e-8f6d-5c2b9a7e4d10";

const TYPES: SnapshotLookupOption[] = [
  NONE,
  { value: ARABIL, label: "Teren arabil" },
  { value: GARAJ, label: "Garaj" },
];

/** The tarla list, whose label is the indicativ (plus its description). */
const TARLA_ROW = "9c1a5b6e-77a2-4a0f-9d3e-2b8c4f6a1e05";
const TARLA: SnapshotLookupOption[] = [
  NONE,
  { value: TARLA_ROW, label: "T47/2 — Lunca Mare" },
];

const EMPTY_PROP: PropertySnapshot["property"] = {
  propertyTypeId: null,
  nickname: null,
  tarlaId: null,
  parcela: null,
  cadastralNumber: null,
  carteFunciara: null,
  useCategoryId: null,
  surfaceAreaMp: null,
  calculatedAreaMp: null,
  notes: null,
};

function propSnap(
  over: Partial<PropertySnapshot["property"]>,
): PropertySnapshot["property"] {
  return { ...EMPTY_PROP, ...over };
}

/**
 * A snapshot written before migration_078: the tarla is the CODE as text under
 * `tarlaSola`, and there is no `tarlaId` key at all. Cast through `unknown`
 * because the current type does not have that key — which is the point.
 */
function legacyPropSnap(tarlaSola: string): PropertySnapshot["property"] {
  const { tarlaId: _dropped, ...rest } = EMPTY_PROP;
  return { ...rest, tarlaSola } as unknown as PropertySnapshot["property"];
}

// ---------------------------------------------------------------------------
// pending — an unread list is never a deleted row
// ---------------------------------------------------------------------------

describe("an unread option list says nothing", () => {
  it("is pending while the query has not resolved", () => {
    expect(resolveSnapshotLookup({ id: ARABIL, options: undefined })).toEqual({
      kind: "pending",
    });
  });

  it("treats a list that could not be read exactly like an unread one", () => {
    // `fetchValueList` throws on `res.redirected || !res.ok` (Slice #34.04),
    // so a list that has never been read successfully leaves `data` undefined
    // rather than caching an empty array — and arrives here as the same
    // `undefined` an unresolved query does. (A query that succeeded EARLIER
    // keeps its last good data across a failed refetch, which is React Query's
    // behaviour and not this function's business: that data is a real list,
    // just possibly a stale one.)
    expect(resolveSnapshotLookup({ id: GONE, options: undefined }).kind).toBe("pending");
  });

  it("does not take the field over from the picker", () => {
    expect(snapshotReplacesPicker({ kind: "pending" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The five states
// ---------------------------------------------------------------------------

describe("resolveSnapshotLookup", () => {
  it("resolves an id the list still offers to that row's CURRENT label", () => {
    expect(resolveSnapshotLookup({ id: ARABIL, options: TYPES })).toEqual({
      kind: "resolved",
      label: "Teren arabil",
    });
  });

  it("calls an id the loaded list does not offer deleted", () => {
    expect(resolveSnapshotLookup({ id: GONE, options: TYPES })).toEqual({
      kind: "deleted",
    });
  });

  it("calls it deleted when the list loaded EMPTY — every row really is gone", () => {
    // Only safe because an unreadable list is `undefined` rather than `[]`; see
    // the pending block above and the header of snapshot-lookup.ts.
    expect(resolveSnapshotLookup({ id: GONE, options: [] }).kind).toBe("deleted");
  });

  it("is empty when the snapshot recorded nothing", () => {
    expect(resolveSnapshotLookup({ id: null, options: TYPES })).toEqual({ kind: "empty" });
    expect(resolveSnapshotLookup({ id: undefined, options: TYPES }).kind).toBe("empty");
    expect(resolveSnapshotLookup({ id: "   ", options: TYPES }).kind).toBe("empty");
  });

  it("is empty rather than pending for an absent id on an unread list", () => {
    // Nothing to resolve, so nothing to wait for: the picker's "— niciunul —"
    // is already the right answer and must not flicker into a label.
    expect(resolveSnapshotLookup({ id: null, options: undefined }).kind).toBe("empty");
  });

  it("returns text the snapshot recorded itself when there is no id", () => {
    expect(
      resolveSnapshotLookup({ id: null, recordedText: "T47/2", options: TARLA }),
    ).toEqual({ kind: "recorded", text: "T47/2" });
  });

  it("trims recorded text and treats blank as nothing recorded", () => {
    expect(
      resolveSnapshotLookup({ id: null, recordedText: "  T3  ", options: TARLA }),
    ).toEqual({ kind: "recorded", text: "T3" });
    expect(
      resolveSnapshotLookup({ id: null, recordedText: "   ", options: TARLA }).kind,
    ).toBe("empty");
  });

  it("lets an id win over recorded text, so `recorded` means 'never an id'", () => {
    expect(
      resolveSnapshotLookup({ id: ARABIL, recordedText: "T47/2", options: TYPES }),
    ).toEqual({ kind: "resolved", label: "Teren arabil" });
    expect(
      resolveSnapshotLookup({ id: GONE, recordedText: "T47/2", options: TYPES }).kind,
    ).toBe("deleted");
  });

  it("never matches the none-option, which every list carries", () => {
    // `noneOption` has value "", and "" is not an id — a snapshot holding it
    // must read as empty rather than resolving to "— niciunul —".
    expect(resolveSnapshotLookup({ id: "", options: TYPES }).kind).toBe("empty");
  });
});

describe("snapshotRecordedText", () => {
  it("reads a key the current type no longer has", () => {
    expect(snapshotRecordedText({ tarlaSola: "T47/2" }, "tarlaSola")).toBe("T47/2");
  });

  it("trims, and reads blank or missing as nothing", () => {
    expect(snapshotRecordedText({ tarlaSola: "  T3 " }, "tarlaSola")).toBe("T3");
    expect(snapshotRecordedText({ tarlaSola: "  " }, "tarlaSola")).toBeNull();
    expect(snapshotRecordedText({}, "tarlaSola")).toBeNull();
  });

  it("survives the shapes a jsonb column can actually hand it", () => {
    expect(snapshotRecordedText(undefined, "tarlaSola")).toBeNull();
    expect(snapshotRecordedText(null, "tarlaSola")).toBeNull();
    expect(snapshotRecordedText("T47/2", "tarlaSola")).toBeNull();
    expect(snapshotRecordedText({ tarlaSola: 47 }, "tarlaSola")).toBeNull();
  });
});

describe("snapshotReplacesPicker", () => {
  it("takes the field over only for what the picker cannot show", () => {
    expect(snapshotReplacesPicker({ kind: "deleted" })).toBe(true);
    expect(snapshotReplacesPicker({ kind: "recorded", text: "T47/2" })).toBe(true);
    expect(snapshotReplacesPicker({ kind: "resolved", label: "Garaj" })).toBe(false);
    expect(snapshotReplacesPicker({ kind: "empty" })).toBe(false);
    expect(snapshotReplacesPicker({ kind: "pending" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// What the version view actually renders
// ---------------------------------------------------------------------------

const DELETED_LABEL = "valoare ștearsă";

function show(state: SnapshotLookupState) {
  const { container } = render(
    <SnapshotValue state={state} deletedLabel={DELETED_LABEL} className="ring-2" />,
  );
  return container;
}

describe("SnapshotValue", () => {
  it("says the deleted-value label for a row nobody can see any more", () => {
    show({ kind: "deleted" });
    expect(screen.getByText(DELETED_LABEL)).toBeInTheDocument();
  });

  it("prints the snapshot's own recorded text verbatim", () => {
    show({ kind: "recorded", text: "T47/2" });
    expect(screen.getByText("T47/2")).toBeInTheDocument();
    expect(screen.queryByText(DELETED_LABEL)).not.toBeInTheDocument();
  });

  it("italicises the label and NOT the data, so prose reads as prose", () => {
    expect(show({ kind: "deleted" }).firstElementChild?.className).toContain("italic");
    expect(
      show({ kind: "recorded", text: "T47/2" }).firstElementChild?.className,
    ).not.toContain("italic");
  });

  it("carries the version diff frame it was given", () => {
    expect(show({ kind: "deleted" }).firstElementChild?.className).toContain("ring-2");
  });

  it("renders nothing at all for the three states the picker handles", () => {
    expect(show({ kind: "resolved", label: "Garaj" }).innerHTML).toBe("");
    expect(show({ kind: "empty" }).innerHTML).toBe("");
    expect(show({ kind: "pending" }).innerHTML).toBe("");
  });

  it("never puts the value into a control", () => {
    const c = show({ kind: "recorded", text: "T47/2" });
    expect(c.querySelector("select")).toBeNull();
    expect(c.querySelector("option")).toBeNull();
    expect(c.querySelector("input")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The wiring — which version is being read, and what may be done with it
//
// ⚠️ **THIS IS THE HALF A TEST OF THE RESOLVER ALONE CANNOT SEE**, and a review
// round said so in as many words: every assertion above passes just as happily
// against a form that prints „valoare ștearsă" over the LIVE editable row.
// `snapshotLookupStates` exists so that condition is a unit test.
// ---------------------------------------------------------------------------

function fullSnap(over: Partial<PropertySnapshot["property"]>): PropertySnapshot {
  return { property: propSnap(over), address: null, corners: [] };
}

const LISTS = { propertyTypes: TYPES, useCategories: TYPES, tarla: TARLA };
const NOTHING = {
  propertyTypeId: { kind: "empty" },
  useCategoryId: { kind: "empty" },
  tarlaId: { kind: "empty" },
};

describe("snapshotLookupStates", () => {
  it("reads NOTHING on the latest version, whatever the snapshot holds", () => {
    // The latest is the live row: all three columns are ON DELETE SET NULL, so
    // it cannot hold a stranded id — and a label printed over a picker the user
    // is allowed to change would be both wrong and unchangeable.
    const states = snapshotLookupStates({
      snapshot: fullSnap({ propertyTypeId: GONE, useCategoryId: GONE, tarlaId: GONE }),
      isOnLatest: true,
      ...LISTS,
    });
    expect(states).toEqual(NOTHING);
    expect(restoreBlockedBy(states)).toEqual([]);
  });

  it("reads nothing when no version has loaded yet", () => {
    expect(
      snapshotLookupStates({ snapshot: undefined, isOnLatest: false, ...LISTS }),
    ).toEqual(NOTHING);
  });

  it("classifies all three fields of one historical version", () => {
    const states = snapshotLookupStates({
      snapshot: fullSnap({ propertyTypeId: GARAJ, useCategoryId: GONE, tarlaId: null }),
      isOnLatest: false,
      ...LISTS,
    });
    expect(states.propertyTypeId).toEqual({ kind: "resolved", label: "Garaj" });
    expect(states.useCategoryId).toEqual({ kind: "deleted" });
    expect(states.tarlaId).toEqual({ kind: "empty" });
  });

  it("finds the pre-#34.03 tarla text without being told the key", () => {
    const legacy: PropertySnapshot = {
      property: legacyPropSnap("T47/2"),
      address: null,
      corners: [],
    };
    const states = snapshotLookupStates({ snapshot: legacy, isOnLatest: false, ...LISTS });
    expect(states.tarlaId).toEqual({ kind: "recorded", text: "T47/2" });
  });

  it("hands back a FRESH object each time it reads nothing", () => {
    // ⚠️ A review round caught a shared module-level constant here, frozen —
    // shallowly, so the three members inside it stayed writable. One stray
    // mutation would have corrupted every later call in the tab, and it would
    // have landed on the LATEST version: "Make current" refused for ever,
    // naming a field that is perfectly fine.
    const a = snapshotLookupStates({ snapshot: undefined, isOnLatest: true, ...LISTS });
    const b = snapshotLookupStates({ snapshot: undefined, isOnLatest: true, ...LISTS });
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.propertyTypeId).not.toBe(b.propertyTypeId);
    a.propertyTypeId = { kind: "deleted" };
    expect(
      snapshotLookupStates({ snapshot: undefined, isOnLatest: true, ...LISTS }).propertyTypeId,
    ).toEqual({ kind: "empty" });
  });

  it("leaves every field pending while its own list is unread", () => {
    const states = snapshotLookupStates({
      snapshot: fullSnap({ propertyTypeId: GARAJ, useCategoryId: GONE, tarlaId: GONE }),
      isOnLatest: false,
      propertyTypes: undefined,
      useCategories: undefined,
      tarla: undefined,
    });
    expect(states.propertyTypeId.kind).toBe("pending");
    expect(states.useCategoryId.kind).toBe("pending");
    expect(states.tarlaId.kind).toBe("pending");
  });
});

const LEGACY: PropertySnapshot = {
  property: legacyPropSnap("T47/2"),
  address: null,
  corners: [],
};

describe("restoreBlockedBy / restoreDropsRecorded", () => {
  it("blocks on a deleted row — the restore would PATCH a dangling uuid", () => {
    const states = snapshotLookupStates({
      snapshot: fullSnap({ useCategoryId: GONE }),
      isOnLatest: false,
      ...LISTS,
    });
    expect(restoreBlockedBy(states)).toEqual(["useCategoryId"]);
    expect(restoreDropsRecorded(states)).toEqual([]);
  });

  it("does NOT block on recorded text — it discloses it instead", () => {
    // ⚠️ The first draft of this slice blocked here, and a review round showed
    // that was worse than what it prevented: "Make current" is the only
    // one-click route back to a pre-#34.03 version's corners, areas and notes,
    // and the tarla cannot be carried back either way — `snapshotToFormValues`
    // puts "" on the form and `toApiPayload` sends null, exactly as it did when
    // the box was merely empty. So the dialog names it and the restore stands.
    const states = snapshotLookupStates({ snapshot: LEGACY, isOnLatest: false, ...LISTS });
    expect(restoreBlockedBy(states)).toEqual([]);
    expect(restoreDropsRecorded(states)).toEqual(["tarlaId"]);
  });

  it("separates the two, in display order, on a version that has both", () => {
    const legacyAndDeleted: PropertySnapshot = {
      property: { ...legacyPropSnap("T47/2"), propertyTypeId: GONE },
      address: null,
      corners: [],
    };
    const states = snapshotLookupStates({
      snapshot: legacyAndDeleted,
      isOnLatest: false,
      ...LISTS,
    });
    expect(restoreBlockedBy(states)).toEqual(["propertyTypeId"]);
    expect(restoreDropsRecorded(states)).toEqual(["tarlaId"]);
  });

  it("blocks nothing on the latest version", () => {
    // The gate again, from the side that matters most: a live row can never
    // disable its own Save path.
    const states = snapshotLookupStates({
      snapshot: fullSnap({ propertyTypeId: GONE, useCategoryId: GONE, tarlaId: GONE }),
      isOnLatest: true,
      ...LISTS,
    });
    expect(restoreBlockedBy(states)).toEqual([]);
    expect(restoreDropsRecorded(states)).toEqual([]);
  });

  it("does not block on a row that is still there, or on an unread list", () => {
    expect(
      restoreBlockedBy(
        snapshotLookupStates({
          snapshot: fullSnap({ propertyTypeId: GARAJ }),
          isOnLatest: false,
          ...LISTS,
        }),
      ),
    ).toEqual([]);
    expect(
      restoreBlockedBy(
        snapshotLookupStates({
          snapshot: fullSnap({ propertyTypeId: GONE }),
          isOnLatest: false,
          propertyTypes: undefined,
          useCategories: undefined,
          tarla: undefined,
        }),
      ),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The three cases the slice owes an answer to, on real snapshot shapes
// ---------------------------------------------------------------------------

describe("paging back to a version", () => {
  it("renders the label when the lookup row is still there", () => {
    const snap = propSnap({ propertyTypeId: GARAJ });
    const state = resolveSnapshotLookup({ id: snap.propertyTypeId, options: TYPES });
    expect(state).toEqual({ kind: "resolved", label: "Garaj" });
    expect(snapshotReplacesPicker(state)).toBe(false); // the picker still shows it
  });

  it("says the value was deleted when only the snapshot still names the row", () => {
    const snap = propSnap({ useCategoryId: GONE });
    const state = resolveSnapshotLookup({ id: snap.useCategoryId, options: TYPES });
    expect(state.kind).toBe("deleted");
    show(state);
    expect(screen.getByText(DELETED_LABEL)).toBeInTheDocument();
  });

  it("prints a pre-#34.03 version's recorded tarla text", () => {
    const snap = legacyPropSnap("T47/2");
    // What the property form does with a snapshot of this vintage: no id in it,
    // and the old text still sitting under a key the type does not have.
    const state = resolveSnapshotLookup({
      id: snap.tarlaId,
      recordedText: snapshotRecordedText(snap, "tarlaSola"),
      options: TARLA,
    });
    expect(state).toEqual({ kind: "recorded", text: "T47/2" });
    show(state);
    expect(screen.getByText("T47/2")).toBeInTheDocument();
  });

  it("says deleted — not blank — for a tarla whose row is gone since #34.03", () => {
    const snap = propSnap({ tarlaId: GONE });
    const state = resolveSnapshotLookup({
      id: snap.tarlaId,
      recordedText: snapshotRecordedText(snap, "tarlaSola"),
      options: TARLA,
    });
    expect(state.kind).toBe("deleted");
  });
});

// ---------------------------------------------------------------------------
// The copy exists, in the locale that ships
// ---------------------------------------------------------------------------

describe("the sentence the user reads", () => {
  const messages = (locale: string) =>
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"),
    ) as {
      shared: { snapshotValue?: { deleted?: string } };
      property?: {
        makeCurrent?: {
          blockedTitle?: string;
          blocked?: string;
          dropsRecorded?: string;
        };
        fields?: Record<string, string | undefined>;
      };
    };

  it("is in ro-RO under the key the form asks for", () => {
    // `DEFAULT_LOCALE` is ro-RO, so a missing key renders as a raw key path in
    // the shipping locale — which is why the string is written straight into
    // the message file rather than held back for review.
    expect(messages("ro-RO").shared.snapshotValue?.deleted).toBe(DELETED_LABEL);
  });

  it("is spelled with comma-below ș and with ă", () => {
    const ro = messages("ro-RO").shared.snapshotValue?.deleted ?? "";
    expect(ro).toContain("ș"); // ș, not the Turkish cedilla ş (U+015F)
    expect(ro).toContain("ă"); // ă
    expect(ro).not.toContain("ş");
  });

  it("has an English sibling", () => {
    expect(messages("en-GB").shared.snapshotValue?.deleted).toBe("deleted value");
  });

  it("refuses a restore in both locales, and NAMES the fields", () => {
    // `{fields}` is what stops the refusal saying "a value" about a field that
    // may not be on screen at all — `hideTarlaParcela` removes the tarla for
    // urban property types. It is a dialog rather than a disabled button's
    // `title` for the same reason: a reason nobody can read is not a reason.
    for (const locale of ["ro-RO", "en-GB"]) {
      const mc = messages(locale).property?.makeCurrent ?? {};
      expect(typeof mc.blockedTitle).toBe("string");
      expect(typeof mc.blocked).toBe("string");
      // ⚠️ **A TRAILING, LABELLED LIST — and the first version of this
      // assertion could not fail.** `restoreBlockedBy` returns one, two or
      // three names, so any sentence whose verb sits next to `{fields}` has to
      // agree with a number nobody knows at write time: an earlier draft read
      // „…: {fields} indică o valoare ștearsă", which is wrong for two. Keeping
      // the placeholder last is what makes the copy number-agnostic, and it is
      // the only part of the shape a test can hold on to.
      expect(mc.blocked).toMatch(/\{fields\}\.?$/);
      // …and no SINGULAR lead-in label either: „Câmpul: {fields}." keeps the
      // placeholder last and still disagrees with two.
      expect(mc.blocked).not.toMatch(/\b(Câmpul|Field):\s*\{fields\}/);
    }
  });

  it("discloses a dropped value in both locales, and NAMES the field", () => {
    for (const locale of ["ro-RO", "en-GB"]) {
      const mc = messages(locale).property?.makeCurrent ?? {};
      expect(typeof mc.dropsRecorded).toBe("string");
      expect(mc.dropsRecorded).toContain("{fields}");
      // ⚠️ It must NOT promise a new version: when nothing else about the
      // restored version differs, `snapshotsEqual` compares `tarlaId` — null on
      // both sides — and writes no version row at all, while the live column is
      // cleared regardless. So the sentence talks about the PROPERTY. The
      // pattern is deliberately loose in both languages ("versiune nouă" and
      // "versiunea nouă" both count); an earlier draft matched only the second.
      // Both Romanian word orders („versiunea nouă" and „noua versiune"), the
      // "next version" phrasings, and the English ones — a review round showed
      // the first draft caught only noun-then-adjective, which is the half that
      // misses in the locale that ships.
      expect(mc.dropsRecorded).not.toMatch(
        /nou\w*\s+versiun|versiun\w*\s+(nou|următoare)|new[- ]version|newly created version|version \{next\}/i,
      );
    }
  });

  it("names the three lookup fields the way the form labels them", () => {
    for (const locale of ["ro-RO", "en-GB"]) {
      const fields = messages(locale).property?.fields ?? {};
      for (const key of ["propertyType", "useCategory", "tarlaSola"]) {
        expect(typeof fields[key]).toBe("string");
      }
    }
  });
});
