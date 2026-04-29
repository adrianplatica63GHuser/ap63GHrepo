/**
 * Unit tests for the Property slice's validation and mapping logic.
 *
 * Covers:
 *  - The form-side Zod schema (surfaceAreaMp validation)
 *  - Form ↔ API payload mapping (toApiPayload, fromApiPayload)
 *  - The API-side Zod schemas (create / update / list-query)
 *
 * No DB access — pure schema / mapping code only.
 */

import {
  emptyFormValues,
  formSchema,
  fromApiPayload,
  toApiPayload,
  type FormValues,
  type Corner,
} from "@/app/properties/_components/form-schema";
import {
  propertyCreateSchema,
  propertyListQuerySchema,
  propertyUpdateSchema,
} from "@/lib/properties/validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minValid(over: Partial<FormValues> = {}): FormValues {
  return { ...emptyFormValues, ...over };
}

const sampleCorners: Corner[] = [
  { lat: 44.3754, lon: 25.9823 },
  { lat: 44.3762, lon: 25.9840 },
  { lat: 44.3748, lon: 25.9847 },
  { lat: 44.3740, lon: 25.9830 },
];

// ---------------------------------------------------------------------------
// formSchema
// ---------------------------------------------------------------------------

describe("formSchema", () => {
  it("accepts a completely empty form (no required fields)", () => {
    expect(formSchema.safeParse(emptyFormValues).success).toBe(true);
  });

  it("accepts a fully populated form", () => {
    const v = minValid({
      nickname:        "Lot 12",
      tarlaSola:       "T7",
      parcela:         "P145",
      cadastralNumber: "12345",
      carteFunciara:   "CF001",
      useCategory:     "CATEG1",
      surfaceAreaMp:   "450.50",
      notes:           "Some notes",
      address: {
        streetLine: "Strada Principală 10",
        postalCode: "077020",
        locality:   "Bragadiru",
        county:     "Ilfov",
        country:    "Romania",
        notes:      "",
      },
    });
    expect(formSchema.safeParse(v).success).toBe(true);
  });

  it("rejects a negative surfaceAreaMp", () => {
    const v = minValid({ surfaceAreaMp: "-10" });
    expect(formSchema.safeParse(v).success).toBe(false);
  });

  it("rejects a non-numeric surfaceAreaMp", () => {
    const v = minValid({ surfaceAreaMp: "abc" });
    expect(formSchema.safeParse(v).success).toBe(false);
  });

  it("accepts an empty string for surfaceAreaMp (means not set)", () => {
    const v = minValid({ surfaceAreaMp: "" });
    expect(formSchema.safeParse(v).success).toBe(true);
  });

  it("rejects notes longer than 300 characters", () => {
    const v = minValid({ notes: "x".repeat(301) });
    expect(formSchema.safeParse(v).success).toBe(false);
  });

  it("accepts notes at exactly 300 characters", () => {
    const v = minValid({ notes: "x".repeat(300) });
    expect(formSchema.safeParse(v).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toApiPayload
// ---------------------------------------------------------------------------

describe("toApiPayload", () => {
  it("converts empty strings to null on every nullable field", () => {
    const p = toApiPayload(emptyFormValues, []);
    expect(p.nickname).toBeNull();
    expect(p.tarlaSola).toBeNull();
    expect(p.parcela).toBeNull();
    expect(p.cadastralNumber).toBeNull();
    expect(p.carteFunciara).toBeNull();
    expect(p.useCategory).toBeNull();
    expect(p.surfaceAreaMp).toBeNull();
    expect(p.notes).toBeNull();
    expect(p.address).toBeNull();
    expect(p.corners).toEqual([]);
  });

  it("passes corners through unchanged", () => {
    const p = toApiPayload(emptyFormValues, sampleCorners);
    expect(p.corners).toEqual(sampleCorners);
  });

  it("parses surfaceAreaMp string to a number", () => {
    const p = toApiPayload(minValid({ surfaceAreaMp: "450.50" }), []);
    expect(p.surfaceAreaMp).toBe(450.5);
  });

  it("trims whitespace from text fields", () => {
    const p = toApiPayload(minValid({ nickname: "  Lot A  " }), []);
    expect(p.nickname).toBe("Lot A");
  });

  it("includes address when country is provided", () => {
    const p = toApiPayload(
      minValid({
        address: {
          streetLine: "Strada Principală 1",
          postalCode: "",
          locality:   "Bragadiru",
          county:     "Ilfov",
          country:    "Romania",
          notes:      "",
        },
      }),
      [],
    );
    expect(p.address).toMatchObject({
      streetLine: "Strada Principală 1",
      locality:   "Bragadiru",
      county:     "Ilfov",
      country:    "Romania",
      postalCode: null,
      notes:      null,
    });
  });

  it("omits address (null) when country is empty", () => {
    const p = toApiPayload(emptyFormValues, []);
    expect(p.address).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fromApiPayload
// ---------------------------------------------------------------------------

describe("fromApiPayload", () => {
  it("maps null property fields to empty strings", () => {
    const result = fromApiPayload({
      property: {
        nickname: null, tarlaSola: null, parcela: null,
        cadastralNumber: null, carteFunciara: null,
        useCategory: null, surfaceAreaMp: null, notes: null,
      },
      address: null,
    });
    expect(result.nickname).toBe("");
    expect(result.tarlaSola).toBe("");
    expect(result.surfaceAreaMp).toBe("");
    expect(result.address.country).toBe("");
  });

  it("maps surfaceAreaMp numeric string to string form value", () => {
    const result = fromApiPayload({
      property: {
        nickname: null, tarlaSola: null, parcela: null,
        cadastralNumber: null, carteFunciara: null,
        useCategory: null, surfaceAreaMp: "450.50", notes: null,
      },
      address: null,
    });
    expect(result.surfaceAreaMp).toBe("450.50");
  });

  it("maps address row fields correctly", () => {
    const result = fromApiPayload({
      property: {
        nickname: null, tarlaSola: null, parcela: null,
        cadastralNumber: null, carteFunciara: null,
        useCategory: null, surfaceAreaMp: null, notes: null,
      },
      address: {
        streetLine: "Strada X 5",
        postalCode: "077020",
        locality:   "Bragadiru",
        county:     "Ilfov",
        country:    "Romania",
        notes:      null,
      },
    });
    expect(result.address.streetLine).toBe("Strada X 5");
    expect(result.address.locality).toBe("Bragadiru");
    expect(result.address.country).toBe("Romania");
    expect(result.address.notes).toBe("");
  });

  it("returns an empty address block when address is null", () => {
    const result = fromApiPayload({
      property: {
        nickname: null, tarlaSola: null, parcela: null,
        cadastralNumber: null, carteFunciara: null,
        useCategory: null, surfaceAreaMp: null, notes: null,
      },
      address: null,
    });
    expect(result.address.country).toBe("");
    expect(result.address.streetLine).toBe("");
  });
});

// ---------------------------------------------------------------------------
// API schemas
// ---------------------------------------------------------------------------

describe("propertyCreateSchema", () => {
  it("accepts an empty payload (all fields optional)", () => {
    expect(propertyCreateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a fully populated payload", () => {
    expect(
      propertyCreateSchema.safeParse({
        nickname:        "Lot 12",
        tarlaSola:       "T7",
        parcela:         "P145",
        cadastralNumber: "12345",
        carteFunciara:   "CF001",
        useCategory:     "CATEG1",
        surfaceAreaMp:   450.5,
        notes:           "test",
        address: {
          country:    "Romania",
          locality:   "Bragadiru",
          county:     "Ilfov",
          streetLine: null,
          postalCode: null,
          notes:      null,
        },
        corners: [
          { lat: 44.3754, lon: 25.9823 },
          { lat: 44.3762, lon: 25.9840 },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects a corner with lat out of range", () => {
    expect(
      propertyCreateSchema.safeParse({
        corners: [{ lat: 200, lon: 25.9823 }],
      }).success,
    ).toBe(false);
  });

  it("rejects a corner with lon out of range", () => {
    expect(
      propertyCreateSchema.safeParse({
        corners: [{ lat: 44.37, lon: -200 }],
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid useCategory", () => {
    expect(
      propertyCreateSchema.safeParse({
        useCategory: "INVALID",
      }).success,
    ).toBe(false);
  });
});

describe("propertyUpdateSchema", () => {
  it("accepts an empty patch (nothing changes)", () => {
    expect(propertyUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial patch with only corners", () => {
    expect(
      propertyUpdateSchema.safeParse({
        corners: [{ lat: 44.37, lon: 25.98 }],
      }).success,
    ).toBe(true);
  });

  it("accepts address: null to clear the address", () => {
    expect(
      propertyUpdateSchema.safeParse({ address: null }).success,
    ).toBe(true);
  });
});

describe("propertyListQuerySchema", () => {
  it("applies defaults when fields are omitted", () => {
    const result = propertyListQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it("coerces string numeric params", () => {
    const result = propertyListQuerySchema.parse({ limit: "25", offset: "10" });
    expect(result.limit).toBe(25);
    expect(result.offset).toBe(10);
  });

  it("rejects limit above 200", () => {
    expect(propertyListQuerySchema.safeParse({ limit: "999" }).success).toBe(false);
  });

  it("rejects negative offset", () => {
    expect(propertyListQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
  });
});
