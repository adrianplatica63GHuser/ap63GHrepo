/**
 * Unit tests for the Judicial Person slice's validation and mapping logic.
 *
 * Covers:
 *  - The form-side Zod schema (UI rules: name required, address-country
 *    pairing, notes length)
 *  - Form <-> API payload mapping (toApiPayload, fromApiPayload)
 *  - The API-side Zod schemas (create / update / list-query)
 *
 * No DB access — pure schema/mapping code only.
 */

import {
  emptyFormValues,
  formSchema,
  fromApiPayload,
  toApiPayload,
  type FormValues,
} from "@/app/judicial-persons/_components/form-schema";
import {
  judicialListQuerySchema,
  judicialPersonCreateSchema,
} from "@/lib/judicial-persons/validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimally valid FormValues — name is filled, addresses are empty. */
function minValid(over: Partial<FormValues> = {}): FormValues {
  return {
    ...emptyFormValues,
    name: "SC Exemplu SRL",
    ...over,
  };
}

// ---------------------------------------------------------------------------
// formSchema — name requirement
// ---------------------------------------------------------------------------

describe("formSchema — name requirement", () => {
  it("rejects a completely empty form", () => {
    expect(formSchema.safeParse(emptyFormValues).success).toBe(false);
  });

  it("accepts a form with only name filled", () => {
    expect(formSchema.safeParse(minValid()).success).toBe(true);
  });

  it("rejects when name is whitespace only", () => {
    expect(formSchema.safeParse(minValid({ name: "   " })).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formSchema — address country
// ---------------------------------------------------------------------------

describe("formSchema — address country", () => {
  it("accepts both address blocks empty", () => {
    expect(formSchema.safeParse(minValid()).success).toBe(true);
  });

  it("rejects HEADQUARTERS with street but no country", () => {
    const v = minValid({
      addresses: {
        HEADQUARTERS: {
          ...emptyFormValues.addresses.HEADQUARTERS,
          streetLine: "Calea Victoriei 1",
        },
        CORRESPONDENCE: emptyFormValues.addresses.CORRESPONDENCE,
      },
    });
    expect(formSchema.safeParse(v).success).toBe(false);
  });

  it("accepts HEADQUARTERS with street and country", () => {
    const v = minValid({
      addresses: {
        HEADQUARTERS: {
          ...emptyFormValues.addresses.HEADQUARTERS,
          streetLine: "Calea Victoriei 1",
          country: "Romania",
        },
        CORRESPONDENCE: emptyFormValues.addresses.CORRESPONDENCE,
      },
    });
    expect(formSchema.safeParse(v).success).toBe(true);
  });

  it("rejects CORRESPONDENCE with locality but no country", () => {
    const v = minValid({
      addresses: {
        HEADQUARTERS: emptyFormValues.addresses.HEADQUARTERS,
        CORRESPONDENCE: {
          ...emptyFormValues.addresses.CORRESPONDENCE,
          locality: "Cluj-Napoca",
        },
      },
    });
    expect(formSchema.safeParse(v).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formSchema — notes length
// ---------------------------------------------------------------------------

describe("formSchema — notes length", () => {
  it("accepts notes at exactly 300 characters", () => {
    expect(formSchema.safeParse(minValid({ notes: "x".repeat(300) })).success).toBe(true);
  });

  it("rejects notes longer than 300 characters", () => {
    expect(formSchema.safeParse(minValid({ notes: "x".repeat(301) })).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toApiPayload — form -> API
// ---------------------------------------------------------------------------

describe("toApiPayload", () => {
  it("converts empty optional string fields to null", () => {
    const payload = toApiPayload(minValid());
    expect(payload.nickname).toBeNull();
    expect(payload.judicialType).toBeNull();
    expect(payload.cuiNumber).toBeNull();
    expect(payload.tradeRegisterNumber).toBeNull();
    expect(payload.contactPerson1).toBeNull();
    expect(payload.contactPerson2).toBeNull();
    expect(payload.notes).toBeNull();
  });

  it("trims surrounding whitespace from name", () => {
    const payload = toApiPayload(minValid({ name: "  SC Test SRL  " }));
    expect(payload.name).toBe("SC Test SRL");
  });

  it("passes through a valid judicialType value", () => {
    const payload = toApiPayload(minValid({ judicialType: "SRL" }));
    expect(payload.judicialType).toBe("SRL");
  });

  it("drops an address block that has no country", () => {
    const v = minValid({
      addresses: {
        HEADQUARTERS: {
          ...emptyFormValues.addresses.HEADQUARTERS,
          streetLine: "Strada X 1",
          // country intentionally blank
        },
        CORRESPONDENCE: emptyFormValues.addresses.CORRESPONDENCE,
      },
    });
    expect(toApiPayload(v).addresses).toEqual([]);
  });

  it("includes an address block that has country, blanking other empty fields", () => {
    const v = minValid({
      addresses: {
        HEADQUARTERS: {
          streetLine: "Calea Victoriei 1",
          postalCode: "",
          locality: "",
          county: "",
          country: "Romania",
          notes: "",
        },
        CORRESPONDENCE: emptyFormValues.addresses.CORRESPONDENCE,
      },
    });
    expect(toApiPayload(v).addresses).toEqual([
      {
        kind: "HEADQUARTERS",
        streetLine: "Calea Victoriei 1",
        postalCode: null,
        locality: null,
        county: null,
        country: "Romania",
        notes: null,
      },
    ]);
  });

  it("includes both address blocks when both have country", () => {
    const v = minValid({
      addresses: {
        HEADQUARTERS: { ...emptyFormValues.addresses.HEADQUARTERS, country: "Romania" },
        CORRESPONDENCE: { ...emptyFormValues.addresses.CORRESPONDENCE, country: "Romania" },
      },
    });
    expect(toApiPayload(v).addresses).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// fromApiPayload — API -> form
// ---------------------------------------------------------------------------

describe("fromApiPayload", () => {
  it("maps null fields to empty strings", () => {
    const result = fromApiPayload({
      judicial: {
        name: "SC Exemplu SRL",
        nickname: null,
        judicialType: null,
        cuiNumber: null,
        tradeRegisterNumber: null,
        contactPerson1: null,
        contactPerson2: null,
      },
      addresses: [],
      notes: null,
    });
    expect(result.nickname).toBe("");
    expect(result.judicialType).toBe("");
    expect(result.cuiNumber).toBe("");
    expect(result.notes).toBe("");
    expect(result.addresses.HEADQUARTERS.country).toBe("");
    expect(result.addresses.CORRESPONDENCE.country).toBe("");
  });

  it("preserves non-null judicial fields", () => {
    const result = fromApiPayload({
      judicial: {
        name: "SC Test SA",
        nickname: "Test",
        judicialType: "SA",
        cuiNumber: "RO12345678",
        tradeRegisterNumber: "J40/123/2020",
        contactPerson1: "Ion Popescu",
        contactPerson2: null,
      },
      addresses: [],
      notes: "Some notes",
    });
    expect(result.name).toBe("SC Test SA");
    expect(result.nickname).toBe("Test");
    expect(result.judicialType).toBe("SA");
    expect(result.cuiNumber).toBe("RO12345678");
    expect(result.tradeRegisterNumber).toBe("J40/123/2020");
    expect(result.contactPerson1).toBe("Ion Popescu");
    expect(result.contactPerson2).toBe("");
    expect(result.notes).toBe("Some notes");
  });

  it("places addresses into HEADQUARTERS and CORRESPONDENCE buckets", () => {
    const result = fromApiPayload({
      judicial: null,
      addresses: [
        {
          kind: "HEADQUARTERS",
          streetLine: "HQ St 1",
          postalCode: null,
          locality: null,
          county: null,
          country: "Romania",
          notes: null,
        },
        {
          kind: "CORRESPONDENCE",
          streetLine: "PO Box 2",
          postalCode: null,
          locality: null,
          county: null,
          country: "Romania",
          notes: null,
        },
      ],
      notes: null,
    });
    expect(result.addresses.HEADQUARTERS.streetLine).toBe("HQ St 1");
    expect(result.addresses.HEADQUARTERS.country).toBe("Romania");
    expect(result.addresses.CORRESPONDENCE.streetLine).toBe("PO Box 2");
  });

  it("returns empty blocks when no matching address kind present", () => {
    const result = fromApiPayload({
      judicial: null,
      addresses: [
        {
          kind: "HOME",
          streetLine: "Home St",
          postalCode: null,
          locality: null,
          county: null,
          country: "Romania",
          notes: null,
        },
      ],
      notes: null,
    });
    expect(result.addresses.HEADQUARTERS.streetLine).toBe("");
    expect(result.addresses.CORRESPONDENCE.streetLine).toBe("");
  });
});

// ---------------------------------------------------------------------------
// judicialPersonCreateSchema (API)
// ---------------------------------------------------------------------------

describe("judicialPersonCreateSchema (API)", () => {
  it("accepts minimal valid input — name only", () => {
    const result = judicialPersonCreateSchema.safeParse({ name: "SC Test SRL" });
    expect(result.success).toBe(true);
  });

  it("rejects when name is absent", () => {
    const result = judicialPersonCreateSchema.safeParse({ nickname: "Test" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid judicialType enum value", () => {
    const result = judicialPersonCreateSchema.safeParse({
      name: "SC Test SRL",
      judicialType: "SRL",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid judicialType value", () => {
    const result = judicialPersonCreateSchema.safeParse({
      name: "SC Test SRL",
      judicialType: "INVENTED_TYPE",
    });
    expect(result.success).toBe(false);
  });

  it("accepts cuiNumber as optional", () => {
    const result = judicialPersonCreateSchema.safeParse({ name: "SC Test SRL" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// judicialListQuerySchema
// ---------------------------------------------------------------------------

describe("judicialListQuerySchema", () => {
  it("coerces stringified numeric query params to numbers", () => {
    const result = judicialListQuerySchema.parse({ limit: "10", offset: "5" });
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(5);
  });

  it("applies defaults when fields are omitted", () => {
    const result = judicialListQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it("rejects limit above 200", () => {
    expect(judicialListQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });

  it("rejects negative offset", () => {
    expect(judicialListQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
  });
});
