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
  diffFieldMap,
  labelColorFromHighlights,
  normVal,
  type HighlightColor,
} from "@/lib/versioning/field-diff";

const ADDRESS_KINDS = ["HOME", "CORRESPONDENCE"] as const;
type AddressKind = (typeof ADDRESS_KINDS)[number];

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
const NAT_STRING_KEYS = [
  "firstName", "lastName", "nickname", "cnp", "idDocumentType",
  "idDocumentNumber", "gender", "dateOfBirth", "personalPhone1",
  "personalPhone2", "workPhone", "personalEmail1", "personalEmail2",
  "workEmail", "placeOfBirth", "idIssuingAuthority", "idValidFrom",
  "idValidUntil", "idCardNumber", "idMrzRaw", "citizenshipId",
  // Slice #18.16.VL:
  "physicalPersonTypeId",
  "notes",
] as const satisfies readonly (keyof Omit<FormValues, "addresses" | "correspondenceSameAsHome">)[];

// Full diff key set — string fields plus the same-as-home flag (stringified
// to "true"/"false" so it diffs uniformly). Mirrors JUD_DIFF_KEYS.
const NAT_DIFF_KEYS = [...NAT_STRING_KEYS, "correspondenceSameAsHome"] as const satisfies readonly (keyof Omit<FormValues, "addresses">)[];

const ADDR_KEYS = [
  "streetLine", "postalCode", "locality", "county", "country", "notes",
] as const satisfies readonly (keyof PersonAddressSnapshot)[];

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
