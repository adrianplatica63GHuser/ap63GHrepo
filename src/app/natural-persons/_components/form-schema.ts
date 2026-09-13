/**
 * Zod schema for the Natural Person form values.
 *
 * Distinct from the API schema in `src/lib/persons/validation.ts` because
 * forms work with strings (no nulls/undefineds for empty fields). The
 * `formToApiPayload` helper translates form values → API payload, blanking
 * out empty strings to null and dropping address blocks where Country
 * isn't filled.
 *
 * Validation rules mirror the API/DB constraints so the Save button only
 * lights up when the payload would actually be accepted.
 */

import { z } from "zod/v4";
import type {
  NaturalPersonCreate,
  NaturalPersonSnapshot,
  NaturalPersonUpdate,
  PersonAddressSnapshot,
} from "@/lib/persons/validation";
import {
  NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS,
  PERSON_ADDRESS_SNAPSHOT_KEYS,
} from "@/lib/versioning/snapshot-registry";
import type { LookupListState } from "@/hooks/use-lookup-options";
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

type AddressKind = "HOME" | "CORRESPONDENCE";

// One address block in form-shape (all strings, including country which
// in the API is required-when-row-present).
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
    firstName: z.string(),
    lastName: z.string(),
    nickname: z.string(),
    cnp: z.string(),
    idDocumentType: z.string(), // "" | "ID_CARD" | "PASSPORT"
    idDocumentNumber: z.string(),
    gender: z.string(), // "" | "MALE" | "FEMALE"
    dateOfBirth: z.string(), // "" | "YYYY-MM-DD"
    personalPhone1: z.string(),
    personalPhone2: z.string(),
    workPhone: z.string(),
    personalEmail1: z.string(),
    personalEmail2: z.string(),
    workEmail: z.string(),
    placeOfBirth: z.string(),
    idIssuingAuthority: z.string(),
    idValidFrom: z.string(), // "" | "YYYY-MM-DD"
    idValidUntil: z.string(), // "" | "YYYY-MM-DD"
    idCardNumber: z.string(),
    idMrzRaw: z.string(),
    citizenshipId: z.string(), // "" | uuid
    // Slice #18.16.VL: Professional Type FK (lookup_person_type); "" = unset.
    physicalPersonTypeId: z.string(),
    notes: z.string().max(300, "Notes is limited to 300 characters"),
    // Slice #19.01: when true, CORRESPONDENCE block is hidden and not stored.
    correspondenceSameAsHome: z.boolean(),
    addresses: z.object({
      HOME: addressBlockSchema,
      CORRESPONDENCE: addressBlockSchema,
    }),
  })
  // At least one of firstName / lastName
  .refine(
    (d) => d.firstName.trim().length > 0 || d.lastName.trim().length > 0,
    {
      message: "At least one of First Name or Last Name is required",
      path: ["lastName"],
    },
  )
  // Each address block: if any non-Country field is filled, Country must be too
  .refine(
    (d) => addressBlockHasCountryWhenNeeded(d.addresses.HOME),
    {
      message: "Country is required for the Home address",
      path: ["addresses", "HOME", "country"],
    },
  )
  // Correspondence address only needs validation when not hidden by the checkbox
  .refine(
    (d) =>
      d.correspondenceSameAsHome ||
      addressBlockHasCountryWhenNeeded(d.addresses.CORRESPONDENCE),
    {
      message: "Country is required for the Correspondence address",
      path: ["addresses", "CORRESPONDENCE", "country"],
    },
  );

export type FormValues = z.infer<typeof formSchema>;

function addressBlockHasCountryWhenNeeded(b: AddressBlock): boolean {
  const otherFieldsFilled =
    b.streetLine.trim().length > 0 ||
    b.postalCode.trim().length > 0 ||
    b.locality.trim().length > 0 ||
    b.county.trim().length > 0 ||
    b.notes.trim().length > 0;
  if (!otherFieldsFilled) return true;
  return b.country.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Defaults (for empty create form)
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
  firstName: "",
  lastName: "",
  nickname: "",
  cnp: "",
  idDocumentType: "",
  idDocumentNumber: "",
  gender: "",
  dateOfBirth: "",
  personalPhone1: "",
  personalPhone2: "",
  workPhone: "",
  personalEmail1: "",
  personalEmail2: "",
  workEmail: "",
  placeOfBirth: "",
  idIssuingAuthority: "",
  idValidFrom: "",
  idValidUntil: "",
  idCardNumber: "",
  idMrzRaw: "",
  citizenshipId: "",
  physicalPersonTypeId: "",
  notes: "",
  correspondenceSameAsHome: true,
  addresses: {
    HOME: { ...emptyAddressBlock },
    CORRESPONDENCE: { ...emptyAddressBlock },
  },
};

// ---------------------------------------------------------------------------
// Mapping: API record → form values (for edit mode)
// ---------------------------------------------------------------------------

type NaturalRow = {
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  cnp: string | null;
  idDocumentType: "ID_CARD" | "PASSPORT" | null;
  idDocumentNumber: string | null;
  gender: "MALE" | "FEMALE" | null;
  dateOfBirth: string | null;
  personalPhone1: string | null;
  personalPhone2: string | null;
  workPhone: string | null;
  personalEmail1: string | null;
  personalEmail2: string | null;
  workEmail: string | null;
  placeOfBirth: string | null;
  idIssuingAuthority: string | null;
  idValidFrom: string | null;
  idValidUntil: string | null;
  idCardNumber: string | null;
  idMrzRaw: string | null;
  citizenshipId: string | null;
  // Slice #18.16.VL:
  physicalPersonTypeId: string | null;
  // Slice #19.01:
  correspondenceSameAsHome: boolean;
};

type AddressRow = {
  kind: AddressKind | "POSTAL" | "HEADQUARTERS";
  streetLine: string | null;
  postalCode: string | null;
  locality: string | null;
  county: string | null;
  country: string;
  notes: string | null;
};

export function fromApiPayload(input: {
  natural: NaturalRow | null;
  addresses: AddressRow[];
  notes: string | null;
  correspondenceSameAsHome?: boolean;
}): FormValues {
  const n = input.natural;

  const home = input.addresses.find((a) => a.kind === "HOME");
  const corr = input.addresses.find((a) => a.kind === "CORRESPONDENCE");

  return {
    firstName: n?.firstName ?? "",
    lastName: n?.lastName ?? "",
    nickname: n?.nickname ?? "",
    cnp: n?.cnp ?? "",
    idDocumentType: n?.idDocumentType ?? "",
    idDocumentNumber: n?.idDocumentNumber ?? "",
    gender: n?.gender ?? "",
    dateOfBirth: n?.dateOfBirth ?? "",
    personalPhone1: n?.personalPhone1 ?? "",
    personalPhone2: n?.personalPhone2 ?? "",
    workPhone: n?.workPhone ?? "",
    personalEmail1: n?.personalEmail1 ?? "",
    personalEmail2: n?.personalEmail2 ?? "",
    workEmail: n?.workEmail ?? "",
    placeOfBirth: n?.placeOfBirth ?? "",
    idIssuingAuthority: n?.idIssuingAuthority ?? "",
    idValidFrom: n?.idValidFrom ?? "",
    idValidUntil: n?.idValidUntil ?? "",
    idCardNumber: n?.idCardNumber ?? "",
    idMrzRaw: n?.idMrzRaw ?? "",
    citizenshipId: n?.citizenshipId ?? "",
    physicalPersonTypeId: n?.physicalPersonTypeId ?? "",
    notes: input.notes ?? "",
    correspondenceSameAsHome: input.correspondenceSameAsHome ?? n?.correspondenceSameAsHome ?? false,
    addresses: {
      HOME: home
        ? {
            streetLine: home.streetLine ?? "",
            postalCode: home.postalCode ?? "",
            locality: home.locality ?? "",
            county: home.county ?? "",
            country: home.country,
            notes: home.notes ?? "",
          }
        : { ...emptyAddressBlock },
      CORRESPONDENCE: corr
        ? {
            streetLine: corr.streetLine ?? "",
            postalCode: corr.postalCode ?? "",
            locality: corr.locality ?? "",
            county: corr.county ?? "",
            country: corr.country,
            notes: corr.notes ?? "",
          }
        : { ...emptyAddressBlock },
    },
  };
}

// ---------------------------------------------------------------------------
// Mapping: form values → API payload
// ---------------------------------------------------------------------------

function blank(s: string): string | null {
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function blockToAddress(
  kind: AddressKind,
  block: AddressBlock,
): NaturalPersonCreate["addresses"][number] | null {
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
): NaturalPersonCreate & NaturalPersonUpdate {
  const addresses: NaturalPersonCreate["addresses"] = [];

  // Always try to persist the HOME address.
  const homeAddr = blockToAddress("HOME", values.addresses.HOME);
  if (homeAddr) addresses.push(homeAddr);

  // Only persist CORRESPONDENCE when the "same as home" checkbox is NOT checked.
  if (!values.correspondenceSameAsHome) {
    const corrAddr = blockToAddress("CORRESPONDENCE", values.addresses.CORRESPONDENCE);
    if (corrAddr) addresses.push(corrAddr);
  }

  return {
    firstName: blank(values.firstName),
    lastName: blank(values.lastName),
    nickname: blank(values.nickname),
    cnp: blank(values.cnp),
    idDocumentType:
      blank(values.idDocumentType) as "ID_CARD" | "PASSPORT" | null,
    idDocumentNumber: blank(values.idDocumentNumber),
    gender: blank(values.gender) as "MALE" | "FEMALE" | null,
    dateOfBirth: blank(values.dateOfBirth),
    personalPhone1: blank(values.personalPhone1),
    personalPhone2: blank(values.personalPhone2),
    workPhone: blank(values.workPhone),
    personalEmail1: blank(values.personalEmail1),
    personalEmail2: blank(values.personalEmail2),
    workEmail: blank(values.workEmail),
    placeOfBirth: blank(values.placeOfBirth),
    idIssuingAuthority: blank(values.idIssuingAuthority),
    idValidFrom: blank(values.idValidFrom),
    idValidUntil: blank(values.idValidUntil),
    idCardNumber: blank(values.idCardNumber),
    idMrzRaw: blank(values.idMrzRaw),
    citizenshipId: blank(values.citizenshipId),
    // Slice #18.16.VL:
    physicalPersonTypeId: blank(values.physicalPersonTypeId),
    notes: blank(values.notes),
    // Slice #19.01:
    correspondenceSameAsHome: values.correspondenceSameAsHome,
    addresses,
  };
}

// ===========================================================================
// Versioning (Slice #18.05) — snapshot conversion + pure diff helpers
//
// A "version" is a full snapshot of the natural person (own fields + notes +
// HOME/CORRESPONDENCE address blocks). These helpers hydrate a snapshot into
// the form's value shape and derive — purely, by diffing snapshot N against
// N-1 — the version label colour and per-field highlight frames (green = added,
// red = modified/deleted). No corners (persons have none). All pure, so they
// unit-test directly.
// ===========================================================================

// String-valued form field names (all top-level fields except the boolean
// correspondenceSameAsHome and the nested addresses).
//
// ⚠️ **DERIVED FROM THE REGISTRY SINCE SLICE #34.19, THROUGH A UNION RATHER
// THAN AN ASSIGNMENT.** `NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS`
// (src/lib/versioning/snapshot-registry.ts) is the single source for what a
// natural-person snapshot's own fields are, guarded by `AssertExactKeys` at
// compile time and by src/__tests__/snapshot-registry.test.ts at run time. The
// literals that stood here were a second copy with only a `satisfies` on the
// FORM type behind them — which catches a key the form does not have, and says
// nothing at all about a snapshot field the list forgot.
//
// A straight assignment will not do, and the two differences are the whole
// reason this is written as a union:
//   * `notes` is NOT a registry key. It lives beside `natural` on the snapshot
//     (`snap.notes`, see snapshotFieldMap below), not inside it, so it is
//     added back here — and it is a real diffed field, not a display extra.
//   * `correspondenceSameAsHome` IS a registry key but is a boolean rather
//     than a string, so it is held out of the string list and rejoined in
//     NAT_DIFF_KEYS below, stringified. Excluding it by TYPE rather than by
//     hand is what keeps `formValuesEqual`'s `normVal(a[k])` sound.
const NAT_STRING_KEYS = [
  ...NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS.filter(
    (key): key is Exclude<
      (typeof NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS)[number],
      "correspondenceSameAsHome"
    > => key !== "correspondenceSameAsHome",
  ),
  "notes",
] as const satisfies readonly (keyof Omit<FormValues, "addresses" | "correspondenceSameAsHome">)[];

// Full diff key set — string fields plus the same-as-home flag (stringified
// to "true"/"false" so it diffs uniformly). Mirrors JUD_DIFF_KEYS.
const NAT_DIFF_KEYS = [...NAT_STRING_KEYS, "correspondenceSameAsHome"] as const satisfies readonly (keyof Omit<FormValues, "addresses">)[];

// The address block is the registry's outright — same six keys, no delta.
const ADDR_KEYS: readonly (keyof PersonAddressSnapshot)[] = PERSON_ADDRESS_SNAPSHOT_KEYS;

export type NaturalFieldHighlights = {
  /** Keyed by form field name (incl. notes and correspondenceSameAsHome). */
  fields: Partial<Record<(typeof NAT_DIFF_KEYS)[number], HighlightColor>>;
  addresses: {
    HOME:           Partial<Record<keyof PersonAddressSnapshot, HighlightColor>>;
    CORRESPONDENCE: Partial<Record<keyof PersonAddressSnapshot, HighlightColor>>;
  };
};

/** Flatten a snapshot's own fields (+ notes + same-as-home flag) into a string map. */
function snapshotFieldMap(
  snap: NaturalPersonSnapshot,
): Record<(typeof NAT_DIFF_KEYS)[number], string | null> {
  return {
    firstName:          snap.natural.firstName,
    lastName:           snap.natural.lastName,
    nickname:           snap.natural.nickname,
    cnp:                snap.natural.cnp,
    idDocumentType:     snap.natural.idDocumentType,
    idDocumentNumber:   snap.natural.idDocumentNumber,
    gender:             snap.natural.gender,
    dateOfBirth:        snap.natural.dateOfBirth,
    personalPhone1:     snap.natural.personalPhone1,
    personalPhone2:     snap.natural.personalPhone2,
    workPhone:          snap.natural.workPhone,
    personalEmail1:     snap.natural.personalEmail1,
    personalEmail2:     snap.natural.personalEmail2,
    workEmail:          snap.natural.workEmail,
    placeOfBirth:       snap.natural.placeOfBirth,
    idIssuingAuthority: snap.natural.idIssuingAuthority,
    idValidFrom:        snap.natural.idValidFrom,
    idValidUntil:       snap.natural.idValidUntil,
    idCardNumber:       snap.natural.idCardNumber,
    idMrzRaw:           snap.natural.idMrzRaw,
    citizenshipId:      snap.natural.citizenshipId,
    physicalPersonTypeId: snap.natural.physicalPersonTypeId,
    notes:              snap.notes,
    // Boolean → stringified so diffFieldMap can compare uniformly.
    correspondenceSameAsHome: snap.natural.correspondenceSameAsHome ? "true" : "false",
  };
}

/** An address block snapshot → flat string map (all-null when the block is absent). */
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

/** Snapshot → RHF form values (edit/view hydration). */
export function snapshotToFormValues(snap: NaturalPersonSnapshot): FormValues {
  const addresses: AddressRow[] = [];
  if (snap.addresses.HOME) {
    addresses.push({ kind: "HOME", ...snap.addresses.HOME, country: snap.addresses.HOME.country ?? "" });
  }
  if (snap.addresses.CORRESPONDENCE) {
    addresses.push({ kind: "CORRESPONDENCE", ...snap.addresses.CORRESPONDENCE, country: snap.addresses.CORRESPONDENCE.country ?? "" });
  }
  return fromApiPayload({
    natural: snap.natural as unknown as NaturalRow,
    addresses,
    notes: snap.notes,
    correspondenceSameAsHome: snap.natural.correspondenceSameAsHome,
  });
}

/** Per-field highlight frames for `curr` vs `prev` (empty for version 0). */
export function computeFieldHighlights(
  prev: NaturalPersonSnapshot | null,
  curr: NaturalPersonSnapshot,
): NaturalFieldHighlights {
  return {
    fields: diffFieldMap(
      prev ? snapshotFieldMap(prev) : null,
      snapshotFieldMap(curr),
      NAT_DIFF_KEYS,
    ),
    addresses: {
      HOME: diffFieldMap(
        prev ? addrMap(prev.addresses.HOME) : null,
        addrMap(curr.addresses.HOME),
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
  prev: NaturalPersonSnapshot | null,
  curr: NaturalPersonSnapshot,
): HighlightColor {
  if (!prev) return "green";
  const h = computeFieldHighlights(prev, curr);
  return labelColorFromHighlights(true, h.fields, h.addresses.HOME, h.addresses.CORRESPONDENCE);
}

/** True when two form-value sets are equal field-by-field (empty == ""). Used
 *  by edit mode to detect divergence from the loaded baseline, independent of
 *  RHF's reset-sensitive `isDirty`. */
export function formValuesEqual(a: FormValues, b: FormValues): boolean {
  for (const k of NAT_STRING_KEYS) {
    if (normVal(a[k]) !== normVal(b[k])) return false;
  }
  if (a.correspondenceSameAsHome !== b.correspondenceSameAsHome) return false;
  for (const kind of ["HOME", "CORRESPONDENCE"] as const) {
    for (const k of ADDR_KEYS) {
      if (normVal(a.addresses[kind][k]) !== normVal(b.addresses[kind][k])) return false;
    }
  }
  return true;
}

// ===========================================================================
// A version's lookup values, and what the version view prints   (Slice #34.27)
//
// The two fields below store a row of an admin-managed list.
// `src/lib/admin/value-lists/dependents.ts` decides ON PURPOSE that a version
// snapshot is NOT a dependent — a version records what was true when it was
// saved, so re-pointing it would rewrite history and deleting it would destroy
// history — so an admin may delete a `lookup_person_type` or
// `lookup_citizenship` row that only a snapshot still names. Paging back to
// that version then showed an EMPTY BOX with nothing to explain it. The live
// columns cannot reach that state (they are `ON DELETE SET NULL`), so this is a
// snapshot-only problem and the answer belongs on the version view.
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
// property form put it in the same place for the same reason
// (`properties/_components/form-schema.ts`).
//
// ⚠️ **`citizenshipId` HAS A RULE ABOUT IT ONE MODULE AWAY, AND THIS IS NOT
// THAT RULE.** `src/lib/import/id-card-review.ts` decides what an identity-card
// read may WRITE into `citizenship_id`, by asking whether the select can show
// the value. This decides what a VERSION VIEW PRINTS for the same column, on a
// screen where nothing is written at all. Different questions, same field.
// ===========================================================================

/** The two natural-person fields whose stored value is a row of a lookup list. */
export type NaturalLookupField = "physicalPersonTypeId" | "citizenshipId";

export type NaturalLookupStates = Record<NaturalLookupField, SnapshotLookupState>;

/**
 * One value list as its hook hands it back.
 *
 * ⚠️ **BOTH MEMBERS, AND THE SECOND ONE IS THE WHOLE REASON THIS TYPE EXISTS.**
 * `useCitizenshipOptions` / `usePersonTypeOptions` return `options: data ??
 * NO_OPTIONS`, so an UNREAD list and a list that genuinely holds no rows are
 * both `[]` by the time a caller sees them. Reading `options` alone would
 * therefore label every historical lookup on the page „valoare ștearsă" for as
 * long as the list was unread — and for ever if it could not be read at all,
 * which is a confident sentence measured against nothing. `listState` is what
 * still separates the two: `"loaded"` is exactly `data !== undefined`
 * (`lookupListState` returns it only when the query is not pending), so
 * `readList` below reconstructs the `undefined` the resolver needs.
 *
 * The property form hands its resolver `query.data ? assembledOptions :
 * undefined` directly, because its three lists are plain `useQuery` call sites
 * whose `data` it can see. These two are not; this is the same distinction
 * arrived at through the hook's own shape. ⚠️ **The judicial-person adapter
 * takes the property form's shape rather than this one, DELIBERATELY** — its
 * one list is a plain `useQuery` in the component, so its `data` is still
 * `undefined` when unread and there is nothing to reconstruct. Two shapes, one
 * distinction; which one a third form copies is decided by where its list comes
 * from, not by taste.
 */
export type NaturalLookupList = {
  options:   readonly SnapshotLookupOption[];
  listState: LookupListState;
};

/**
 * The option list, or `undefined` while nobody has successfully read it.
 *
 * ⚠️ **An empty-but-LOADED list is a real `deleted`, and that is only safe
 * because of Slice #34.04.** A list that read back as `[]` used to be reachable
 * without anybody deleting anything: an expired session answered the value-list
 * fetch with a redirect to the login page, whose HTML parsed to `{}`, and
 * `data.items ?? []` cached that as a successful empty array. `fetchValueList`
 * — the single fetcher behind BOTH hooks below — now rejects `res.redirected`
 * as well as `!res.ok`, so an unreadable list throws, leaves `data` undefined,
 * and lands in `pending` instead. That guard was checked for this slice, on
 * that fetcher, before `[]` was trusted here.
 *
 * ⚠️ **`"loaded"` MEANS "there is data", NOT "the data is current", AND THAT
 * GAP IS INHERITED RATHER THAN INTRODUCED HERE.** `lookupListState` reports
 * `isLoadingError` rather than `isError` on purpose (its docblock argues why),
 * so a FAILED BACKGROUND REFETCH of a list that was read successfully earlier
 * keeps the last good array and still says `"loaded"` — and the red hint under
 * the field renders only on `"failed"`, so nothing says otherwise on screen. In
 * that window a row added since the cached read prints „valoare ștearsă", and a
 * row deleted since it prints its old label. The property form has the same
 * window through `query.data`, which is also the stale value; closing it means
 * changing what „read" means for every dropdown in the app, not just here.
 */
function readList(list: NaturalLookupList): readonly SnapshotLookupOption[] | undefined {
  return list.listState === "loaded" ? list.options : undefined;
}

/**
 * A FRESH object every time, not a shared constant.
 *
 * ⚠️ A review round found a module-level singleton in the property form's copy
 * of this, frozen — SHALLOWLY, so the members inside it stayed writable. One
 * stray mutation would have corrupted every later call in the tab, and it would
 * have landed on the LATEST version: a live, editable field labelled as a value
 * that is perfectly fine. Two object literals per render is not a cost worth
 * reasoning about; a process-wide singleton is.
 */
function nothingRecorded(): NaturalLookupStates {
  return {
    physicalPersonTypeId: { kind: "empty" },
    citizenshipId:        { kind: "empty" },
  };
}

/**
 * What the VIEWED version recorded in each of the two lookup fields.
 *
 * `isOnLatest` short-circuits everything to `empty`: the latest version IS the
 * live row, and both columns are `ON DELETE SET NULL`, so deleting a lookup row
 * blanks them there rather than stranding an id — the live copy cannot reach
 * `deleted`, and a label printed over an editable picker would be both wrong
 * and unchangeable.
 *
 * Neither field has a `recorded` state to answer: no migration ever turned a
 * free-TEXT person column into an FK the way migration_078 did to
 * `property.tarla_sola`, so a natural-person snapshot holds an id or it holds
 * nothing. `recorded` stays unreachable here, and `snapshot-lookup.ts` keeps
 * owning it for the one field that has it.
 */
export function snapshotLookupStates(input: {
  snapshot:     NaturalPersonSnapshot | undefined;
  isOnLatest:   boolean;
  personTypes:  NaturalLookupList;
  citizenships: NaturalLookupList;
}): NaturalLookupStates {
  if (input.isOnLatest || !input.snapshot) return nothingRecorded();
  const n = input.snapshot.natural;
  return {
    physicalPersonTypeId: resolveSnapshotLookup({
      id:      n.physicalPersonTypeId,
      options: readList(input.personTypes),
    }),
    citizenshipId: resolveSnapshotLookup({
      id:      n.citizenshipId,
      options: readList(input.citizenships),
    }),
  };
}

/**
 * The fields that make "Make this version current" IMPOSSIBLE, in display order.
 *                                                              (Slice #34.27)
 *
 * "Make current" re-saves `form.getValues()` — the values `snapshotToFormValues`
 * put on the form when the version was opened, which is the snapshot's own
 * content. A `deleted` id is still among them and its column is a foreign key,
 * so the PATCH comes back 23503 and `dbErrorToResponse` hands the user the
 * string „Foreign key violation", in English.
 *
 * ⚠️ **THIS SLICE IS WHAT MAKES THE PRESS LIKELY, WHICH IS WHY IT ARRIVES WITH
 * THE REFUSAL.** Before it the field was an empty box and the press was a
 * mistake; „valoare ștearsă" is precisely the cue that invites a user to repair
 * the record by restoring the version. The property form has carried this
 * predicate since #34.17 for the same reason and with the same wording.
 *
 * So the press is REFUSED, in a single-button dialog that NAMES the fields —
 * not by greying the button out, which puts the reason in a `title` on a
 * control that is out of the tab order and unannounced.
 *
 * Neither field can reach `recorded`, so there is no `restoreDropsRecorded`
 * sibling here: nothing a person version holds is text without an id.
 *
 * `pending` never blocks: an unread list is not evidence of anything. It
 * usually resolves in one round trip and it does NOT always — a value-list
 * fetch that keeps failing leaves the query's data `undefined` for as long as
 * the failure lasts, and in that window a deleted row is indistinguishable from
 * an unread one, so a restore can still reach the 23503 this function exists to
 * prevent. Refusing on `pending` would be worse: it would take every restore
 * away for the same window, on evidence nobody has read. `handleMakeCurrent`
 * re-checks this predicate for the narrower case it CAN close: a list that
 * resolves while the confirmation dialog is open.
 */
const NATURAL_LOOKUP_FIELD_ORDER: NaturalLookupField[] = [
  "physicalPersonTypeId",
  "citizenshipId",
];

export function restoreBlockedBy(states: NaturalLookupStates): NaturalLookupField[] {
  return NATURAL_LOOKUP_FIELD_ORDER.filter((f) => states[f].kind === "deleted");
}
