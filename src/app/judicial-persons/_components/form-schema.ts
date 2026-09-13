/**
 * Zod schema for the Judicial Person form values.
 *
 * Mirrors the natural-person form-schema pattern. The form works with plain
 * strings (no null/undefined); `toApiPayload` blanks empty strings to null
 * and drops address blocks where Country is empty.
 *
 * Contact persons are stored as:
 *   contactPerson1Id   — person.id (empty string = not set)
 *   contactPerson1Name — display name for rendering only (never sent to API)
 *   (same for contact person 2)
 *
 * judicialPersonTypeId — lookup_judicial_person_type.id (empty string = not
 * set). Replaces the old hardcoded judicial_type enum as of Slice #15.07;
 * the dropdown is now populated from Administration -> Reference Data ->
 * "Judicial Person Types".
 *
 * correspondenceSameAsHq — when true, the CORRESPONDENCE address block is
 * hidden in the UI and omitted from the API payload entirely.
 */

import { z } from "zod/v4";
import type {
  JudicialPersonCreate,
  JudicialPersonSnapshot,
  JudicialPersonUpdate,
} from "@/lib/judicial-persons/validation";
import type { PersonAddressSnapshot } from "@/lib/persons/validation";
import {
  JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS,
  PERSON_ADDRESS_SNAPSHOT_KEYS,
} from "@/lib/versioning/snapshot-registry";
import {
  resolveSnapshotLookup,
  type SnapshotLookupOption,
  type SnapshotLookupState,
} from "@/lib/versioning/snapshot-lookup";
import {
  diffFieldMap,
  labelColorFromHighlights,
  normVal,
  type HighlightColor,
} from "@/lib/versioning/field-diff";

type AddressKind = "HEADQUARTERS" | "CORRESPONDENCE";

const addressBlockSchema = z.object({
  streetLine: z.string(),
  postalCode: z.string(),
  locality: z.string(),
  county: z.string(),
  country: z.string(),
  notes: z.string(),
});

export type AddressBlock = z.infer<typeof addressBlockSchema>;

export const formSchema = z
  .object({
    name: z.string(),
    nickname: z.string(),
    // lookup_judicial_person_type.id; "" = not set.
    judicialPersonTypeId: z.string(),
    cuiNumber: z.string(),
    tradeRegisterNumber: z.string(),
    // Contact person 1: ID stored as string; empty = not linked.
    contactPerson1Id: z.string(),
    contactPerson1Name: z.string(), // read-only display; never sent to API
    // Contact person 2
    contactPerson2Id: z.string(),
    contactPerson2Name: z.string(), // read-only display; never sent to API
    notes: z.string().max(300, "Notes is limited to 300 characters"),
    correspondenceSameAsHq: z.boolean(),
    addresses: z.object({
      HEADQUARTERS: addressBlockSchema,
      CORRESPONDENCE: addressBlockSchema,
    }),
  })
  // Name is the only required field
  .refine((d) => d.name.trim().length > 0, {
    message: "Name is required",
    path: ["name"],
  })
  // Registered-office address: if any non-Country field is filled, Country must be too
  .refine((d) => addressBlockHasCountryWhenNeeded(d.addresses.HEADQUARTERS), {
    message: "Country is required for the Registered Office address",
    path: ["addresses", "HEADQUARTERS", "country"],
  })
  // Correspondence address only needs validation when not hidden by the checkbox
  .refine(
    (d) =>
      d.correspondenceSameAsHq ||
      addressBlockHasCountryWhenNeeded(d.addresses.CORRESPONDENCE),
    {
      message: "Country is required for the Correspondence address",
      path: ["addresses", "CORRESPONDENCE", "country"],
    },
  );

export type FormValues = z.infer<typeof formSchema>;

function addressBlockHasCountryWhenNeeded(b: AddressBlock): boolean {
  const otherFilled =
    b.streetLine.trim().length > 0 ||
    b.postalCode.trim().length > 0 ||
    b.locality.trim().length > 0 ||
    b.county.trim().length > 0 ||
    b.notes.trim().length > 0;
  if (!otherFilled) return true;
  return b.country.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Defaults (empty create form)
// ---------------------------------------------------------------------------

const emptyAddressBlock: AddressBlock = {
  streetLine: "",
  postalCode: "",
  locality: "",
  county: "",
  country: "",
  notes: "",
};

export const emptyFormValues: FormValues = {
  name: "",
  nickname: "",
  judicialPersonTypeId: "",
  cuiNumber: "",
  tradeRegisterNumber: "",
  contactPerson1Id: "",
  contactPerson1Name: "",
  contactPerson2Id: "",
  contactPerson2Name: "",
  notes: "",
  correspondenceSameAsHq: false,
  addresses: {
    HEADQUARTERS: { ...emptyAddressBlock },
    CORRESPONDENCE: { ...emptyAddressBlock },
  },
};

// ---------------------------------------------------------------------------
// Mapping: DB record -> form values (edit mode)
// ---------------------------------------------------------------------------

type JudicialRow = {
  name: string;
  nickname: string | null;
  judicialPersonTypeId: string | null;
  cuiNumber: string | null;
  tradeRegisterNumber: string | null;
  contactPerson1Id: string | null;
  contactPerson2Id: string | null;
  correspondenceSameAsHq: boolean;
};

type AddressRow = {
  kind: string;
  streetLine: string | null;
  postalCode: string | null;
  locality: string | null;
  county: string | null;
  country: string;
  notes: string | null;
};

export function fromApiPayload(input: {
  judicial: JudicialRow | null;
  addresses: AddressRow[];
  notes: string | null;
  contactPerson1Name: string | null;
  contactPerson2Name: string | null;
}): FormValues {
  const j = input.judicial;

  const hq = input.addresses.find((a) => a.kind === "HEADQUARTERS");
  const corr = input.addresses.find((a) => a.kind === "CORRESPONDENCE");

  const toBlock = (row: AddressRow | undefined): AddressBlock =>
    row
      ? {
          streetLine: row.streetLine ?? "",
          postalCode: row.postalCode ?? "",
          locality: row.locality ?? "",
          county: row.county ?? "",
          country: row.country,
          notes: row.notes ?? "",
        }
      : { ...emptyAddressBlock };

  return {
    name: j?.name ?? "",
    nickname: j?.nickname ?? "",
    judicialPersonTypeId: j?.judicialPersonTypeId ?? "",
    cuiNumber: j?.cuiNumber ?? "",
    tradeRegisterNumber: j?.tradeRegisterNumber ?? "",
    contactPerson1Id: j?.contactPerson1Id ?? "",
    contactPerson1Name: input.contactPerson1Name ?? "",
    contactPerson2Id: j?.contactPerson2Id ?? "",
    contactPerson2Name: input.contactPerson2Name ?? "",
    notes: input.notes ?? "",
    correspondenceSameAsHq: j?.correspondenceSameAsHq ?? false,
    addresses: {
      HEADQUARTERS: toBlock(hq),
      CORRESPONDENCE: toBlock(corr),
    },
  };
}

// ---------------------------------------------------------------------------
// Mapping: form values -> API payload
// ---------------------------------------------------------------------------

function blank(s: string): string | null {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function blockToAddress(
  kind: AddressKind,
  block: AddressBlock,
): JudicialPersonCreate["addresses"][number] | null {
  const country = blank(block.country);
  if (!country) return null;
  return {
    kind,
    streetLine: blank(block.streetLine),
    postalCode: blank(block.postalCode),
    locality: blank(block.locality),
    county: blank(block.county),
    country,
    notes: blank(block.notes),
  };
}

export function toApiPayload(
  values: FormValues,
): JudicialPersonCreate & JudicialPersonUpdate {
  const addresses: JudicialPersonCreate["addresses"] = [];

  // Always try to persist the HEADQUARTERS address.
  const hq = blockToAddress("HEADQUARTERS", values.addresses.HEADQUARTERS);
  if (hq) addresses.push(hq);

  // Only persist CORRESPONDENCE when the "same as" checkbox is NOT checked.
  if (!values.correspondenceSameAsHq) {
    const corr = blockToAddress(
      "CORRESPONDENCE",
      values.addresses.CORRESPONDENCE,
    );
    if (corr) addresses.push(corr);
  }

  return {
    name: values.name.trim(),
    nickname: blank(values.nickname),
    judicialPersonTypeId: blank(values.judicialPersonTypeId),
    cuiNumber: blank(values.cuiNumber),
    tradeRegisterNumber: blank(values.tradeRegisterNumber),
    contactPerson1Id: blank(values.contactPerson1Id),
    contactPerson2Id: blank(values.contactPerson2Id),
    correspondenceSameAsHq: values.correspondenceSameAsHq,
    notes: blank(values.notes),
    addresses,
  };
}

// ===========================================================================
// Versioning (Slice #18.05) — snapshot conversion + pure diff helpers
//
// A "version" is a full snapshot of the judicial person (own fields + notes +
// the same-as-HQ flag + HEADQUARTERS/CORRESPONDENCE address blocks). These
// helpers hydrate a snapshot into the form's value shape and derive — purely,
// by diffing snapshot N against N-1 — the version label colour and per-field
// highlight frames (green = added, red = modified/deleted). All pure, so they
// unit-test directly.
// ===========================================================================

// String form-field names that participate in the diff. The contact-person
// *Name fields are display-only (they follow the ids) and excluded.
//
// ⚠️ **DERIVED FROM THE REGISTRY SINCE SLICE #34.19, AND THIS LIST HAD NO
// GUARD AT ALL.** The eight literals that stood here carried a bare `as const`
// — not even the `satisfies readonly (keyof …)[]` its natural-person twin had
// — so nothing anywhere checked them against
// `JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS`
// (src/lib/versioning/snapshot-registry.ts), which is the single source for
// the snapshot's own fields and is guarded by `AssertExactKeys` at compile
// time and by src/__tests__/snapshot-registry.test.ts at run time.
//
// Same union as the natural-person form, for the same two reasons: `notes`
// sits beside `judicial` on the snapshot rather than inside it and is added
// back, and `correspondenceSameAsHq` is a boolean that is held out of the
// string list and rejoined stringified in JUD_DIFF_KEYS below.
const JUD_STRING_KEYS = [
  ...JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS.filter(
    (key): key is Exclude<
      (typeof JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS)[number],
      "correspondenceSameAsHq"
    > => key !== "correspondenceSameAsHq",
  ),
  "notes",
] as const satisfies readonly (keyof Omit<FormValues, "addresses" | "correspondenceSameAsHq">)[];

// Full diff key set — the string fields plus the same-as-HQ flag (stringified
// to "true"/"false" so it diffs uniformly).
const JUD_DIFF_KEYS = [...JUD_STRING_KEYS, "correspondenceSameAsHq"] as const satisfies readonly (keyof Omit<FormValues, "addresses">)[];

// The address block is the registry's outright — same six keys, no delta.
const ADDR_KEYS: readonly (keyof PersonAddressSnapshot)[] = PERSON_ADDRESS_SNAPSHOT_KEYS;

export type JudicialFieldHighlights = {
  /** Keyed by form field name (incl. notes and correspondenceSameAsHq). */
  fields: Partial<Record<(typeof JUD_DIFF_KEYS)[number], HighlightColor>>;
  addresses: {
    HEADQUARTERS:   Partial<Record<keyof PersonAddressSnapshot, HighlightColor>>;
    CORRESPONDENCE: Partial<Record<keyof PersonAddressSnapshot, HighlightColor>>;
  };
};

/** Flatten a snapshot's own fields (+ notes + same-as-HQ flag) into a string map. */
function snapshotFieldMap(
  snap: JudicialPersonSnapshot,
): Record<(typeof JUD_DIFF_KEYS)[number], string | null> {
  return {
    name:                 snap.judicial.name,
    nickname:             snap.judicial.nickname,
    judicialPersonTypeId: snap.judicial.judicialPersonTypeId,
    cuiNumber:            snap.judicial.cuiNumber,
    tradeRegisterNumber:  snap.judicial.tradeRegisterNumber,
    contactPerson1Id:     snap.judicial.contactPerson1Id,
    contactPerson2Id:     snap.judicial.contactPerson2Id,
    notes:                snap.notes,
    correspondenceSameAsHq: snap.judicial.correspondenceSameAsHq ? "true" : "false",
  };
}

function addrMap(
  a: PersonAddressSnapshot | null,
): Record<keyof PersonAddressSnapshot, string | null> {
  return {
    streetLine: a?.streetLine ?? null,
    postalCode: a?.postalCode ?? null,
    locality:   a?.locality   ?? null,
    county:     a?.county     ?? null,
    country:    a?.country    ?? null,
    notes:      a?.notes      ?? null,
  };
}

/** Snapshot → RHF form values (edit/view hydration). Contact-person display
 *  names aren't stored in the snapshot, so historical views render the linked
 *  id; the highlight still flags the change. */
export function snapshotToFormValues(snap: JudicialPersonSnapshot): FormValues {
  const addresses: AddressRow[] = [];
  if (snap.addresses.HEADQUARTERS) {
    addresses.push({ kind: "HEADQUARTERS", ...snap.addresses.HEADQUARTERS, country: snap.addresses.HEADQUARTERS.country ?? "" });
  }
  if (snap.addresses.CORRESPONDENCE) {
    addresses.push({ kind: "CORRESPONDENCE", ...snap.addresses.CORRESPONDENCE, country: snap.addresses.CORRESPONDENCE.country ?? "" });
  }
  return fromApiPayload({
    judicial: snap.judicial as unknown as JudicialRow,
    addresses,
    notes: snap.notes,
    contactPerson1Name: null,
    contactPerson2Name: null,
  });
}

/** Per-field highlight frames for `curr` vs `prev` (empty for version 0). */
export function computeFieldHighlights(
  prev: JudicialPersonSnapshot | null,
  curr: JudicialPersonSnapshot,
): JudicialFieldHighlights {
  return {
    fields: diffFieldMap(
      prev ? snapshotFieldMap(prev) : null,
      snapshotFieldMap(curr),
      JUD_DIFF_KEYS,
    ),
    addresses: {
      HEADQUARTERS: diffFieldMap(
        prev ? addrMap(prev.addresses.HEADQUARTERS) : null,
        addrMap(curr.addresses.HEADQUARTERS),
        ADDR_KEYS,
      ),
      CORRESPONDENCE: diffFieldMap(
        prev ? addrMap(prev.addresses.CORRESPONDENCE) : null,
        addrMap(curr.addresses.CORRESPONDENCE),
        ADDR_KEYS,
      ),
    },
  };
}

/** Version label colour. v0 green; red if any field modified/deleted; else green. */
export function versionLabelColor(
  prev: JudicialPersonSnapshot | null,
  curr: JudicialPersonSnapshot,
): HighlightColor {
  if (!prev) return "green";
  const h = computeFieldHighlights(prev, curr);
  return labelColorFromHighlights(
    true,
    h.fields,
    h.addresses.HEADQUARTERS,
    h.addresses.CORRESPONDENCE,
  );
}

/** True when two form-value sets are equal field-by-field (empty == ""). The
 *  contact-person display names follow their ids and are excluded. */
export function formValuesEqual(a: FormValues, b: FormValues): boolean {
  for (const k of JUD_STRING_KEYS) {
    if (normVal(a[k]) !== normVal(b[k])) return false;
  }
  if (a.correspondenceSameAsHq !== b.correspondenceSameAsHq) return false;
  for (const kind of ["HEADQUARTERS", "CORRESPONDENCE"] as const) {
    for (const k of ADDR_KEYS) {
      if (normVal(a.addresses[kind][k]) !== normVal(b.addresses[kind][k])) return false;
    }
  }
  return true;
}

// ===========================================================================
// A version's lookup value, and what the version view prints    (Slice #34.27)
//
// `judicialPersonTypeId` stores a row of an admin-managed list.
// `src/lib/admin/value-lists/dependents.ts` decides ON PURPOSE that a version
// snapshot is NOT a dependent — a version records what was true when it was
// saved, so re-pointing it would rewrite history and deleting it would destroy
// history — so an admin may delete a `lookup_judicial_person_type` row that
// only a snapshot still names. Paging back to that version then showed an
// EMPTY BOX with nothing to explain it. The live column cannot reach that state
// (it is `ON DELETE SET NULL`), so this is a snapshot-only problem and the
// answer belongs on the version view.
//
// ⚠️ **THIS IS NOT `optionsWithUnlistedValues` COMING BACK.** That function,
// deleted in Slice #34.03 along with the `allowUnlistedValue` prop, synthesised
// an `<option>` INSIDE A LIVE PICKER, so a value the list did not hold stayed
// selectable and could be saved back. Nothing here is selectable and nothing
// here is written: the version view prints a value INSTEAD of offering a
// picker, and the dangling id never enters the DOM.
//
// ⚠️ **THE `isOnLatest` GATE IS IN HERE RATHER THAN AT THE CALL SITE, AND THAT
// IS THE POINT.** It is the one condition whose failure is invisible in a test
// of the resolver: drop it and the LIVE, EDITABLE row would print „valoare
// ștearsă" over a picker the user is allowed to change. Pure and exported, so
// that condition is a unit test rather than a source-reading guard. The
// property and natural-person forms put it in the same place for the same
// reason.
// ===========================================================================

/** The one judicial-person field whose stored value is a row of a lookup list. */
export type JudicialLookupField = "judicialPersonTypeId";

export type JudicialLookupStates = Record<JudicialLookupField, SnapshotLookupState>;

/**
 * A FRESH object every time, not a shared constant.
 *
 * ⚠️ A review round found a module-level singleton in the property form's copy
 * of this, frozen — SHALLOWLY, so the member inside it stayed writable. One
 * stray mutation would have corrupted every later call in the tab, and it would
 * have landed on the LATEST version: a live, editable field labelled as a value
 * that is perfectly fine. One object literal per render is not a cost worth
 * reasoning about; a process-wide singleton is. It is a single-member record
 * today and the reasoning does not depend on the count.
 */
function nothingRecorded(): JudicialLookupStates {
  return { judicialPersonTypeId: { kind: "empty" } };
}

/**
 * What the VIEWED version recorded in its lookup field.
 *
 * `isOnLatest` short-circuits to `empty`: the latest version IS the live row,
 * and the column is `ON DELETE SET NULL`, so deleting a lookup row blanks it
 * there rather than stranding an id — the live copy cannot reach `deleted`, and
 * a label printed over an editable picker would be both wrong and unchangeable.
 *
 * ⚠️ **`judicialTypes` IS THE QUERY'S DATA — `undefined` while it is unread,
 * and STILL `undefined` when the read failed.** That is what separates "the
 * list holds no such row" from "nobody has read the list", and treating the
 * second as the first would label every historical type „valoare ștearsă" for
 * as long as the list was unread. `fetchJudicialPersonTypes` in
 * `judicial-person-form.tsx` rejects `res.redirected` as well as `!res.ok`
 * (Slice #34.04), so an expired session throws rather than caching the login
 * page's `{}` as a successful empty array — checked for this slice, on that
 * fetcher, before `[]` was trusted as a real `deleted`.
 *
 * ⚠️ **THE NATURAL-PERSON ADAPTER TAKES A DIFFERENT SHAPE — `{ options,
 * listState }` — AND THAT IS NOT AN INCONSISTENCY TO TIDY.** Its two lists come
 * from hooks that return `options: data ?? NO_OPTIONS`, so the `undefined` is
 * already gone by the time the form sees it and `listState` is what
 * reconstructs it. This list does not go through a hook, so its `data` still
 * carries the distinction and there is nothing to reconstruct. Which shape a
 * third form copies is decided by where its list comes from.
 *
 * There is no `recorded` state to answer: no migration ever turned a free-TEXT
 * judicial-person column into an FK the way migration_078 did to
 * `property.tarla_sola`, so a snapshot holds an id or it holds nothing.
 */
export function snapshotLookupStates(input: {
  snapshot:      JudicialPersonSnapshot | undefined;
  isOnLatest:    boolean;
  judicialTypes: readonly SnapshotLookupOption[] | undefined;
}): JudicialLookupStates {
  if (input.isOnLatest || !input.snapshot) return nothingRecorded();
  return {
    judicialPersonTypeId: resolveSnapshotLookup({
      id:      input.snapshot.judicial.judicialPersonTypeId,
      options: input.judicialTypes,
    }),
  };
}

/**
 * The field that makes "Make this version current" IMPOSSIBLE, in display order.
 *                                                              (Slice #34.27)
 *
 * "Make current" re-saves `form.getValues()` — the values `snapshotToFormValues`
 * put on the form when the version was opened, which is the snapshot's own
 * content. A `deleted` id is still among them and `judicial_person.
 * judicial_person_type_id` is a foreign key, so the PATCH comes back 23503 and
 * `dbErrorToResponse` hands the user the string „Foreign key violation", in
 * English.
 *
 * ⚠️ **THIS SLICE IS WHAT MAKES THE PRESS LIKELY, WHICH IS WHY IT ARRIVES WITH
 * THE REFUSAL.** Before it the field was an empty box and the press was a
 * mistake; „valoare ștearsă" is precisely the cue that invites a user to repair
 * the record by restoring the version.
 *
 * A list rather than a boolean, and a `filter` over a one-member order rather
 * than an `if`: the dialog NAMES the field, and the day this form grows a
 * second lookup the shape does not have to change. The property and
 * natural-person forms read identically.
 *
 * `pending` never blocks — an unread list is not evidence of anything; see the
 * natural-person twin for the whole argument, which is the same one.
 */
const JUDICIAL_LOOKUP_FIELD_ORDER: JudicialLookupField[] = ["judicialPersonTypeId"];

export function restoreBlockedBy(states: JudicialLookupStates): JudicialLookupField[] {
  return JUDICIAL_LOOKUP_FIELD_ORDER.filter((f) => states[f].kind === "deleted");
}
