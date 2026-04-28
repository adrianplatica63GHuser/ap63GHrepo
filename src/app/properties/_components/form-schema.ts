/**
 * Zod schema for the Property form values.
 *
 * All fields are plain strings (React Hook Form convention).
 * `corners` are managed separately as React state — not registered with RHF.
 * `toApiPayload` converts form values + corners into the shape the API expects.
 */

import { z } from "zod/v4";
import type { PropertyCreate, PropertyUpdate } from "@/lib/properties/validation";

// ---------------------------------------------------------------------------
// Corner (client-side, WGS84 decimal degrees)
// ---------------------------------------------------------------------------

export type Corner = { lat: number; lon: number };

// ---------------------------------------------------------------------------
// Form schema — all strings; validated on the client before submission
// ---------------------------------------------------------------------------

const addressBlockSchema = z.object({
  streetLine: z.string(),
  postalCode: z.string(),
  locality:   z.string(),
  county:     z.string(),
  country:    z.string(),
  notes:      z.string(),
});

export type AddressBlock = z.infer<typeof addressBlockSchema>;

export const formSchema = z.object({
  nickname:        z.string(),
  tarlaSola:       z.string(),
  parcela:         z.string(),
  cadastralNumber: z.string(),
  carteFunciara:   z.string(),
  useCategory:     z.string(), // "" | "CATEG1" | "CATEG2" | "CATEG3"
  surfaceAreaMp:   z
    .string()
    .refine(
      (v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) > 0),
      { message: "Surface area must be a positive number" },
    ),
  notes:   z.string().max(300, "Notes limited to 300 characters"),
  address: addressBlockSchema,
});

export type FormValues = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// Empty defaults
// ---------------------------------------------------------------------------

const emptyAddress: AddressBlock = {
  streetLine: "", postalCode: "", locality: "",
  county: "",    country: "",    notes: "",
};

export const emptyFormValues: FormValues = {
  nickname: "", tarlaSola: "", parcela: "",
  cadastralNumber: "", carteFunciara: "",
  useCategory: "", surfaceAreaMp: "", notes: "",
  address: { ...emptyAddress },
};

// ---------------------------------------------------------------------------
// API record → form values (edit mode)
// ---------------------------------------------------------------------------

type PropertyRow = {
  nickname:        string | null;
  tarlaSola:       string | null;
  parcela:         string | null;
  cadastralNumber: string | null;
  carteFunciara:   string | null;
  useCategory:     string | null;
  surfaceAreaMp:   string | null;
  notes:           string | null;
};

type AddressRow = {
  streetLine: string | null;
  postalCode: string | null;
  locality:   string | null;
  county:     string | null;
  country:    string;
  notes:      string | null;
};

export function fromApiPayload(input: {
  property: PropertyRow;
  address:  AddressRow | null;
}): FormValues {
  const p = input.property;
  const a = input.address;
  return {
    nickname:        p.nickname        ?? "",
    tarlaSola:       p.tarlaSola       ?? "",
    parcela:         p.parcela         ?? "",
    cadastralNumber: p.cadastralNumber ?? "",
    carteFunciara:   p.carteFunciara   ?? "",
    useCategory:     p.useCategory     ?? "",
    surfaceAreaMp:   p.surfaceAreaMp   ?? "",
    notes:           p.notes           ?? "",
    address: a
      ? {
          streetLine: a.streetLine ?? "",
          postalCode: a.postalCode ?? "",
          locality:   a.locality   ?? "",
          county:     a.county     ?? "",
          country:    a.country,
          notes:      a.notes      ?? "",
        }
      : { ...emptyAddress },
  };
}

// ---------------------------------------------------------------------------
// Form values → API payload
// ---------------------------------------------------------------------------

function blank(s: string): string | null {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

export function toApiPayload(
  values: FormValues,
  corners: Corner[],
): PropertyCreate & PropertyUpdate {
  const addrCountry = blank(values.address.country);

  return {
    nickname:        blank(values.nickname),
    tarlaSola:       blank(values.tarlaSola),
    parcela:         blank(values.parcela),
    cadastralNumber: blank(values.cadastralNumber),
    carteFunciara:   blank(values.carteFunciara),
    useCategory:     blank(values.useCategory) as "CATEG1" | "CATEG2" | "CATEG3" | null,
    surfaceAreaMp:   blank(values.surfaceAreaMp) != null
                       ? parseFloat(values.surfaceAreaMp)
                       : null,
    notes: blank(values.notes),
    address: addrCountry
      ? {
          streetLine: blank(values.address.streetLine),
          postalCode: blank(values.address.postalCode),
          locality:   blank(values.address.locality),
          county:     blank(values.address.county),
          country:    addrCountry,
          notes:      blank(values.address.notes),
        }
      : null,
    corners: corners.map((c) => ({ lat: c.lat, lon: c.lon })),
  };
}
