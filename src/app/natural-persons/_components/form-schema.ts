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
  NaturalPersonUpdate,
} from "@/lib/persons/validation";

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
    notes: z.string().max(300, "Notes is limited to 300 characters"),
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
  // ID doc type and number paired
  .refine(
    (d) =>
      Boolean(d.idDocumentType.trim()) === Boolean(d.idDocumentNumber.trim()),
    {
      message: "ID Type and ID Number must be both set or both empty",
      path: ["idDocumentNumber"],
    },
  )
  // At least one contact
  .refine(
    (d) =>
      [
        d.personalPhone1,
        d.personalPhone2,
        d.workPhone,
        d.personalEmail1,
        d.personalEmail2,
        d.workEmail,
      ].some((v) => v.trim().length > 0),
    {
      message: "At least one phone or email is required",
      path: ["personalPhone1"],
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
  .refine(
    (d) => addressBlockHasCountryWhenNeeded(d.addresses.CORRESPONDENCE),
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
  notes: "",
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
    notes: input.notes ?? "",
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
  for (const kind of ADDRESS_KINDS) {
    const a = blockToAddress(kind, values.addresses[kind]);
    if (a) addresses.push(a);
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
    notes: blank(values.notes),
    addresses,
  };
}
