/**
 * Zod schema for the Judicial Person form values.
 *
 * Mirrors the natural-person form-schema pattern. The form works with plain
 * strings (no null/undefined); `toApiPayload` blanks empty strings to null
 * and drops address blocks where Country is empty.
 *
 * The `fromApiPayload` helper converts a DB record (person + judicial_person
 * + addresses) back into the flat string-based form shape for edit mode.
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
    judicialType: z.string(), // "" | "SRL" | "SA" | ...
    cuiNumber: z.string(),
    tradeRegisterNumber: z.string(),
    contactPerson1: z.string(),
    contactPerson2: z.string(),
    notes: z.string().max(300, "Notes is limited to 300 characters"),
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
  // Each address: if any non-Country field is filled, Country must be too
  .refine((d) => addressBlockHasCountryWhenNeeded(d.addresses.HEADQUARTERS), {
    message: "Country is required for the Registered Office address",
    path: ["addresses", "HEADQUARTERS", "country"],
  })
  .refine(
    (d) => addressBlockHasCountryWhenNeeded(d.addresses.CORRESPONDENCE),
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
  judicialType: "",
  cuiNumber: "",
  tradeRegisterNumber: "",
  contactPerson1: "",
  contactPerson2: "",
  notes: "",
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
  judicialType:
    | "SRL"
    | "SA"
    | "SRL_D"
    | "PFA"
    | "II"
    | "IF"
    | "ONG"
    | "OTHER"
    | null;
  cuiNumber: string | null;
  tradeRegisterNumber: string | null;
  contactPerson1: string | null;
  contactPerson2: string | null;
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
    judicialType: j?.judicialType ?? "",
    cuiNumber: j?.cuiNumber ?? "",
    tradeRegisterNumber: j?.tradeRegisterNumber ?? "",
    contactPerson1: j?.contactPerson1 ?? "",
    contactPerson2: j?.contactPerson2 ?? "",
    notes: input.notes ?? "",
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

type JudicialTypeEnum =
  | "SRL"
  | "SA"
  | "SRL_D"
  | "PFA"
  | "II"
  | "IF"
  | "ONG"
  | "OTHER";

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
  for (const kind of ADDRESS_KINDS) {
    const a = blockToAddress(kind, values.addresses[kind]);
    if (a) addresses.push(a);
  }

  return {
    name: values.name.trim(),
    nickname: blank(values.nickname),
    judicialType: blank(values.judicialType) as JudicialTypeEnum | null,
    cuiNumber: blank(values.cuiNumber),
    tradeRegisterNumber: blank(values.tradeRegisterNumber),
    contactPerson1: blank(values.contactPerson1),
    contactPerson2: blank(values.contactPerson2),
    notes: blank(values.notes),
    addresses,
  };
}
