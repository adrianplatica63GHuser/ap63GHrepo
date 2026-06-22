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
  JudicialPersonUpdate,
} from "@/lib/judicial-persons/validation";

const ADDRESS_KINDS = ["HEADQUARTERS", "CORRESPONDENCE"] as const;
type AddressKind = (typeof ADDRESS_KINDS)[number];

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
