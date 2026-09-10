/**
 * The version diff reads the snapshot registry, not its own copy of it.
 *                                                              (Slice #34.19)
 *
 * `src/lib/versioning/snapshot-registry.ts` is the single source for the key
 * set of every versioned JSONB snapshot, guarded against the TypeScript types
 * by `AssertExactKeys` at compile time and by `snapshot-registry.test.ts` at
 * run time. Four `form-schema.ts` files then decide which fields the VERSION
 * VIEW diffs — and until this slice each of them wrote the list out again:
 *
 *   documents        DOC_FIELD_KEYS       20 literals, `satisfies keyof FormValues`
 *   properties       PROPERTY_SNAP_KEYS    9 literals, `(keyof …)[]` ← WRONG
 *   natural-persons  NAT_STRING_KEYS      23 literals, `satisfies keyof FormValues`
 *   judicial-persons JUD_STRING_KEYS       8 literals, bare `as const`, no guard
 *
 * Only the last of those had no guard at all. The property one was annotated
 * `(keyof PropertySnapshotProperty)[]`, which is a guard in one direction — a
 * FOREIGN key would not compile — and silent about the direction that mattered:
 * it was a key SHORT. `calculatedAreaMp` was in the registry and not in the
 * diff list. That is the same absence
 * `object-writers-enumerated.test.ts` records for `snapshotsEqual` — "written
 * into every snapshot and compared in none" — found a second time, in a second
 * hand-written list, in the same entity. The other three happened to agree,
 * which is a fact about that day rather than a property of the code.
 *
 * ⚠️ **THE FIXTURES ARE BUILT FROM THE REGISTRY, WHICH IS THE POINT.** A
 * hand-written "before"/"after" snapshot would go stale the moment a snapshot
 * grew a field, and the assertion would then be comparing two lists that had
 * BOTH forgotten it. Building both sides from the registry arrays means a new
 * registry key is diffed by this suite on the day it is added, and a form that
 * does not diff it fails here.
 *
 * ⚠️ **`notes` IS ASSERTED TWICE OVER, BECAUSE IT IS THE DELTA THAT MAKES THIS
 * A UNION RATHER THAN AN ASSIGNMENT.** For a PERSON it is not a registry key
 * at all — it lives beside `natural` / `judicial` on the snapshot, on the base
 * `person` row — so the form lists add it back. If the registry ever grows a
 * `notes` of its own, the "not in the registry" assertions below go red rather
 * than the key being silently counted twice.
 */

import {
  DOCUMENT_SNAPSHOT_KEYS,
  JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS,
  NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS,
  PERSON_ADDRESS_SNAPSHOT_KEYS,
  PROPERTY_SNAPSHOT_ADDRESS_KEYS,
  PROPERTY_SNAPSHOT_PROPERTY_KEYS,
} from "@/lib/versioning/snapshot-registry";
import { computeFieldHighlights as docHighlights } from "@/app/documents/_components/form-schema";
import {
  computeFieldHighlights as propHighlights,
  versionLabelColor as propLabel,
} from "@/app/properties/_components/form-schema";
import { computeFieldHighlights as natHighlights } from "@/app/natural-persons/_components/form-schema";
import { computeFieldHighlights as judHighlights } from "@/app/judicial-persons/_components/form-schema";
import type { DocumentSnapshot } from "@/lib/documents/validation";
import type {
  PropertySnapshot,
  PropertySnapshotAddress,
  PropertySnapshotProperty,
} from "@/lib/properties/validation";
import type {
  NaturalPersonSnapshot,
  NaturalPersonSnapshotFields,
  PersonAddressSnapshot,
} from "@/lib/persons/validation";
import type {
  JudicialPersonSnapshot,
  JudicialPersonSnapshotFields,
} from "@/lib/judicial-persons/validation";

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Every key in `keys` set to `value` — the booleans given `flag` instead. */
function fill(
  keys: readonly string[],
  value: string | null,
  booleans: readonly string[] = [],
  flag = false,
): Record<string, unknown> {
  return Object.fromEntries(
    keys.map((k) => [k, booleans.includes(k) ? flag : value]),
  );
}

const sorted = (xs: readonly string[]): string[] => [...xs].sort();

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

const DOC_EXPECTED = [...DOCUMENT_SNAPSHOT_KEYS].filter((k) => k !== "customFields");

function docSnap(value: string | null): DocumentSnapshot {
  return {
    ...fill(DOCUMENT_SNAPSHOT_KEYS, value),
    customFields: {},
  } as unknown as DocumentSnapshot;
}

describe("the document version diff is the registry minus customFields", () => {
  it("frames every registry field when it changes", () => {
    const framed = Object.keys(docHighlights(docSnap(null), docSnap("after")));
    expect(sorted(framed)).toEqual(sorted(DOC_EXPECTED));
  });

  it("still frames `notes`, which for a document IS a registry key", () => {
    expect([...DOCUMENT_SNAPSHOT_KEYS]).toContain("notes");
    expect(Object.keys(docHighlights(docSnap(null), docSnap("after")))).toContain("notes");
  });

  // There is no separate "never frames customFields" assertion: the set
  // equality above already excludes it, and a test that cannot fail is worse
  // than no test — it reads as coverage. `customFields` is a nested record with
  // no string to diff; `customFieldsEqual` compares it and the form's own note
  // on the schema field says so.
});

// ---------------------------------------------------------------------------
// Property — the entity whose hand-written list was actually wrong
// ---------------------------------------------------------------------------

function propSnap(value: string | null): PropertySnapshot {
  return {
    property: fill(PROPERTY_SNAPSHOT_PROPERTY_KEYS, value) as unknown as PropertySnapshotProperty,
    address: fill(PROPERTY_SNAPSHOT_ADDRESS_KEYS, value) as unknown as PropertySnapshotAddress,
    corners: [],
  };
}

describe("the property version diff is the registry outright", () => {
  it("frames every property field the registry holds", () => {
    const h = propHighlights(propSnap(null), propSnap("after"));
    expect(sorted(Object.keys(h.property))).toEqual(sorted(PROPERTY_SNAPSHOT_PROPERTY_KEYS));
  });

  it("frames every address field the registry holds, `notes` included", () => {
    const h = propHighlights(propSnap(null), propSnap("after"));
    expect(sorted(Object.keys(h.address))).toEqual(sorted(PROPERTY_SNAPSHOT_ADDRESS_KEYS));
    expect(Object.keys(h.address)).toContain("notes");
    expect(Object.keys(h.property)).toContain("notes");
  });

  it("includes calculatedAreaMp — the key the hand-written list was missing", () => {
    // Named explicitly so the regression that started this slice has a test of
    // its own, exactly as `object-writers-enumerated.test.ts` does for the
    // comparison half of the same defect.
    expect([...PROPERTY_SNAPSHOT_PROPERTY_KEYS]).toContain("calculatedAreaMp");
    expect(Object.keys(propHighlights(propSnap(null), propSnap("after")).property)).toContain(
      "calculatedAreaMp",
    );
  });

  /**
   * ⚠️ **THE LABEL COLOUR IS THE ONE PLACE THE NEW KEY COULD HAVE BEEN
   * VISIBLE, AND THIS IS THE CASE THAT MATTERS.** `versionLabelColor` reds a
   * version as soon as any framed field is a modification or a deletion, so a
   * red on `calculatedAreaMp` could in principle turn a green version red.
   * The pair that would do it — equal corners, different calculated areas —
   * is not one the corner geometry can produce, because the area IS computed
   * from the corners. What the app CAN produce is a snapshot written before
   * migration_033, which carries no such key at all: that reads as
   * null -> value, i.e. an addition, and an addition never flips the label.
   */
  it("does not turn a green version red when an older snapshot lacks the key", () => {
    const before = propSnap(null);
    // A pre-migration_033 snapshot: the key is simply absent from the JSONB.
    const pre = {
      ...before,
      property: Object.fromEntries(
        Object.entries(before.property).filter(([k]) => k !== "calculatedAreaMp"),
      ) as unknown as PropertySnapshotProperty,
    };
    const after: PropertySnapshot = {
      ...pre,
      property: { ...pre.property, calculatedAreaMp: "1234.00" },
    };
    expect(propHighlights(pre, after).property.calculatedAreaMp).toBe("green");
    expect(propLabel(pre, after)).toBe("green");
  });
});

// ---------------------------------------------------------------------------
// Natural person — registry ∪ { notes }
// ---------------------------------------------------------------------------

function addr(value: string | null): PersonAddressSnapshot {
  return fill(PERSON_ADDRESS_SNAPSHOT_KEYS, value) as unknown as PersonAddressSnapshot;
}

function natSnap(value: string | null, sameAsHome: boolean): NaturalPersonSnapshot {
  return {
    notes: value,
    natural: fill(
      NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS,
      value,
      ["correspondenceSameAsHome"],
      sameAsHome,
    ) as unknown as NaturalPersonSnapshotFields,
    addresses: { HOME: addr(value), CORRESPONDENCE: addr(value) },
  };
}

describe("the natural-person version diff is the registry plus notes", () => {
  const h = natHighlights(natSnap(null, false), natSnap("after", true));

  it("frames every registry field and `notes`", () => {
    expect(sorted(Object.keys(h.fields))).toEqual(
      sorted([...NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS, "notes"]),
    );
  });

  it("adds `notes` because the registry does not hold it for a person", () => {
    expect([...NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS]).not.toContain("notes");
    expect(Object.keys(h.fields)).toContain("notes");
  });

  it("keeps the same-as-home flag in the diff, stringified", () => {
    expect([...NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS]).toContain("correspondenceSameAsHome");
    expect(h.fields.correspondenceSameAsHome).toBe("red"); // "false" -> "true"
  });

  it("frames both address blocks against the registry's address keys", () => {
    expect(sorted(Object.keys(h.addresses.HOME))).toEqual(sorted(PERSON_ADDRESS_SNAPSHOT_KEYS));
    expect(sorted(Object.keys(h.addresses.CORRESPONDENCE))).toEqual(
      sorted(PERSON_ADDRESS_SNAPSHOT_KEYS),
    );
  });
});

// ---------------------------------------------------------------------------
// Judicial person — registry ∪ { notes }
// ---------------------------------------------------------------------------

function judSnap(value: string | null, sameAsHq: boolean): JudicialPersonSnapshot {
  return {
    notes: value,
    judicial: fill(
      JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS,
      value,
      ["correspondenceSameAsHq"],
      sameAsHq,
    ) as unknown as JudicialPersonSnapshotFields,
    addresses: { HEADQUARTERS: addr(value), CORRESPONDENCE: addr(value) },
  };
}

describe("the judicial-person version diff is the registry plus notes", () => {
  const h = judHighlights(judSnap(null, false), judSnap("after", true));

  it("frames every registry field and `notes`", () => {
    expect(sorted(Object.keys(h.fields))).toEqual(
      sorted([...JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS, "notes"]),
    );
  });

  it("adds `notes` because the registry does not hold it for a person", () => {
    expect([...JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS]).not.toContain("notes");
    expect(Object.keys(h.fields)).toContain("notes");
  });

  it("keeps the same-as-HQ flag in the diff, stringified", () => {
    expect([...JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS]).toContain("correspondenceSameAsHq");
    expect(h.fields.correspondenceSameAsHq).toBe("red"); // "false" -> "true"
  });

  it("frames both address blocks against the registry's address keys", () => {
    expect(sorted(Object.keys(h.addresses.HEADQUARTERS))).toEqual(
      sorted(PERSON_ADDRESS_SNAPSHOT_KEYS),
    );
    expect(sorted(Object.keys(h.addresses.CORRESPONDENCE))).toEqual(
      sorted(PERSON_ADDRESS_SNAPSHOT_KEYS),
    );
  });
});

// ---------------------------------------------------------------------------
// The display contract: no form asks for a frame the diff does not compute
// ---------------------------------------------------------------------------

/**
 * ⚠️ **ONE DIRECTION ONLY, AND THAT IS DELIBERATE.** This asserts that every
 * key a form renders a frame for is a key the diff computes — a rename or a
 * dropped field turns a silently-never-highlighted input into a red test. It
 * does NOT assert the reverse, that every computed key is rendered: a
 * hand-written list checked in both directions against a scan of the
 * component's own source is the trap #34.08 shipped a failing `npx jest` on,
 * and it would freeze today's contract as if it were an invariant.
 *
 * The reverse direction is a real fact worth stating here in prose rather than
 * as an assertion: `calculatedAreaMp` is computed and NOT rendered, because
 * property-form.tsx draws the calculated area with `ReadOnlyField`, which
 * takes no `highlight` prop. So the set of fields the version view actually
 * frames is exactly what it was before this slice. A later slice that wants
 * that frame drawn adds the prop; nothing here has to change for it.
 */
describe("every frame a form renders is a frame the diff computes", () => {
  // ⚠️ **EACH ROW CARRIES ITS OWN EXPECTED COUNT, MEASURED.** One shared
  // `toBeGreaterThan(3)` sat below every real value (7, 9, 7, 24, 9) and so
  // caught only a regex that had stopped matching almost everything — a
  // regex that found four of twenty-four would have passed it. The count is
  // the number of frames the form renders TODAY; a slice that adds or removes
  // one updates the number here, which is the point at which somebody reads
  // this comment.
  const FORMS: ReadonlyArray<[string, string, readonly string[], number]> = [
    [
      "src/app/documents/_components/document-form.tsx",
      "displayHighlights\\?\\.([A-Za-z0-9_]+)",
      DOC_EXPECTED,
      7,
    ],
    [
      "src/app/properties/_components/property-form.tsx",
      "displayHighlights\\?\\.property\\.([A-Za-z0-9_]+)",
      PROPERTY_SNAPSHOT_PROPERTY_KEYS,
      9,
    ],
    [
      "src/app/properties/_components/property-form.tsx",
      "displayHighlights\\?\\.address\\.([A-Za-z0-9_]+)",
      PROPERTY_SNAPSHOT_ADDRESS_KEYS,
      7,
    ],
    [
      "src/app/natural-persons/_components/natural-person-form.tsx",
      "displayHighlights\\?\\.fields\\.([A-Za-z0-9_]+)",
      [...NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS, "notes"],
      24,
    ],
    [
      "src/app/judicial-persons/_components/judicial-person-form.tsx",
      "displayHighlights\\?\\.fields\\.([A-Za-z0-9_]+)",
      [...JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS, "notes"],
      9,
    ],
  ];

  // A plain loop rather than `it.each`, for the reason
  // `document-type-catalogue-single-source.test.ts` states: the sandbox
  // harness these suites are first run under has no `@types/jest`, and a
  // readonly tuple table types every parameter as `any` there.
  for (const [file, pattern, computed, count] of FORMS) {
    it(`${file} + ${pattern} names only computed keys`, () => {
      const rendered = [
        ...new Set([...read(file).matchAll(new RegExp(pattern, "g"))].map((m) => m[1])),
      ];
      // A regex that matched nothing — or that quietly stopped matching most of
      // what it used to — would otherwise make this pass by checking nothing.
      expect([file, pattern, rendered.length]).toEqual([file, pattern, count]);
      expect(rendered.filter((k) => !computed.includes(k))).toEqual([]);
    });
  }
});
