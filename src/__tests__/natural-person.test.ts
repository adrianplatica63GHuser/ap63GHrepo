/**
 * Unit tests for the Natural Person slice's validation and mapping logic.
 *
 * Covers:
 *  - The form-side Zod schema (UI rules: name, contact, ID-doc pairing,
 *    address-country pairing, notes length)
 *  - Form ↔ API payload mapping (toApiPayload, fromApiPayload)
 *  - The API-side Zod schemas (create / update / list-query)
 *
 * No DB access — these all run against pure schema/mapping code, so they
 * stay in the regular `npm test` lane (no migration or seed needed).
 *
 * A future commit will add a separate integration suite that hits the
 * actual Drizzle queries against a test DB.
 */

import {
  emptyFormValues,
  formSchema,
  fromApiPayload,
  toApiPayload,
  type FormValues,
} from "@/app/natural-persons/_components/form-schema";
import {
  listQuerySchema,
  naturalPersonCreateSchema,
} from "@/lib/persons/validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A minimally valid FormValues object — passes all refinements:
 *  - has a first name (satisfies name requirement)
 *  - has an email (satisfies contact requirement)
 *  - both ID doc fields empty (paired)
 *  - both address blocks empty (no country needed)
 */
function minValid(over: Partial<FormValues> = {}): FormValues {
  return {
    ...emptyFormValues,
    firstName: "Adrian",
    personalEmail1: "adrian@example.ro",
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Form schema — refinement rules
// ---------------------------------------------------------------------------

describe("formSchema — name requirement", () => {
  it("rejects a completely empty form", () => {
    expect(formSchema.safeParse(emptyFormValues).success).toBe(false);
  });

  it("accepts firstName only", () => {
    expect(formSchema.safeParse(minValid()).success).toBe(true);
  });

  it("accepts lastName only", () => {
    const v: FormValues = {
      ...emptyFormValues,
      lastName: "Popescu",
      personalEmail1: "x@y.z",
    };
    expect(formSchema.safeParse(v).success).toBe(true);
  });

  it("rejects when neither firstName nor lastName is provided", () => {
    const v: FormValues = { ...emptyFormValues, personalEmail1: "x@y.z" };
    expect(formSchema.safeParse(v).success).toBe(false);
  });
});

describe("formSchema — ID document pairing", () => {
  it("accepts both fields empty", () => {
    expect(formSchema.safeParse(minValid()).success).toBe(true);
  });

  it("accepts both fields filled", () => {
    const v = minValid({
      idDocumentType: "ID_CARD",
      idDocumentNumber: "RX123456",
    });
    expect(formSchema.safeParse(v).success).toBe(true);
  });

  it("rejects type without number", () => {
    expect(
      formSchema.safeParse(minValid({ idDocumentType: "ID_CARD" })).success,
    ).toBe(false);
  });

  it("rejects number without type", () => {
    expect(
      formSchema.safeParse(minValid({ idDocumentNumber: "RX123" })).success,
    ).toBe(false);
  });
});

describe("formSchema — contact requirement", () => {
  it("rejects when no phone or email is filled", () => {
    const v: FormValues = { ...emptyFormValues, firstName: "Adrian" };
    expect(formSchema.safeParse(v).success).toBe(false);
  });

  it("accepts with personalPhone1 only", () => {
    const v: FormValues = {
      ...emptyFormValues,
      firstName: "Adrian",
      personalPhone1: "+40700000000",
    };
    expect(formSchema.safeParse(v).success).toBe(true);
  });

  it("accepts with workEmail only", () => {
    const v: FormValues = {
      ...emptyFormValues,
      firstName: "Adrian",
      workEmail: "a@firma.ro",
    };
    expect(formSchema.safeParse(v).success).toBe(true);
  });
});

describe("formSchema — address country", () => {
  it("accepts both address blocks empty", () => {
    expect(formSchema.safeParse(minValid()).success).toBe(true);
  });

  it("rejects HOME with street but no country", () => {
    const v = minValid({
      addresses: {
        HOME: {
          ...emptyFormValues.addresses.HOME,
          streetLine: "Strada Florilor 12",
        },
        CORRESPONDENCE: emptyFormValues.addresses.CORRESPONDENCE,
      },
    });
    expect(formSchema.safeParse(v).success).toBe(false);
  });

  it("accepts HOME with street and country", () => {
    const v = minValid({
      addresses: {
        HOME: {
          ...emptyFormValues.addresses.HOME,
          streetLine: "Strada Florilor 12",
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
        HOME: emptyFormValues.addresses.HOME,
        CORRESPONDENCE: {
          ...emptyFormValues.addresses.CORRESPONDENCE,
          locality: "București",
        },
      },
    });
    expect(formSchema.safeParse(v).success).toBe(false);
  });
});

describe("formSchema — notes length", () => {
  it("accepts notes at exactly 300 characters", () => {
    const v = minValid({ notes: "x".repeat(300) });
    expect(formSchema.safeParse(v).success).toBe(true);
  });

  it("rejects notes longer than 300 characters", () => {
    const v = minValid({ notes: "x".repeat(301) });
    expect(formSchema.safeParse(v).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toApiPayload — form → API
// ---------------------------------------------------------------------------

describe("toApiPayload", () => {
  it("converts empty strings to null on every nullable field", () => {
    const payload = toApiPayload(minValid());
    expect(payload.lastName).toBeNull();
    expect(payload.nickname).toBeNull();
    expect(payload.cnp).toBeNull();
    expect(payload.idDocumentType).toBeNull();
    expect(payload.idDocumentNumber).toBeNull();
    expect(payload.gender).toBeNull();
    expect(payload.dateOfBirth).toBeNull();
    expect(payload.notes).toBeNull();
  });

  it("trims surrounding whitespace from strings", () => {
    const payload = toApiPayload(minValid({ firstName: "  Adrian  " }));
    expect(payload.firstName).toBe("Adrian");
  });

  it("drops an address block that has no country", () => {
    const v = minValid({
      addresses: {
        HOME: {
          ...emptyFormValues.addresses.HOME,
          streetLine: "Strada X 1",
          // country intentionally blank — would fail formSchema, but
          // toApiPayload itself just filters this block out.
        },
        CORRESPONDENCE: emptyFormValues.addresses.CORRESPONDENCE,
      },
    });
    expect(toApiPayload(v).addresses).toEqual([]);
  });

  it("includes an address block that has country, blanking other empties", () => {
    const v = minValid({
      addresses: {
        HOME: {
          streetLine: "Strada X 1",
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
        kind: "HOME",
        streetLine: "Strada X 1",
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
        HOME: { ...emptyFormValues.addresses.HOME, country: "Romania" },
        CORRESPONDENCE: {
          ...emptyFormValues.addresses.CORRESPONDENCE,
          country: "Romania",
        },
      },
    });
    expect(toApiPayload(v).addresses).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// fromApiPayload — API → form
// ---------------------------------------------------------------------------

describe("fromApiPayload", () => {
  it("maps null fields to empty strings", () => {
    const result = fromApiPayload({
      natural: {
        firstName: null,
        lastName: null,
        nickname: null,
        cnp: null,
        idDocumentType: null,
        idDocumentNumber: null,
        gender: null,
        dateOfBirth: null,
        personalPhone1: null,
        personalPhone2: null,
        workPhone: null,
        personalEmail1: null,
        personalEmail2: null,
        workEmail: null,
      },
      addresses: [],
      notes: null,
    });
    expect(result.firstName).toBe("");
    expect(result.cnp).toBe("");
    expect(result.notes).toBe("");
    expect(result.addresses.HOME.country).toBe("");
    expect(result.addresses.CORRESPONDENCE.country).toBe("");
  });

  it("places addresses into HOME and CORRESPONDENCE buckets", () => {
    const result = fromApiPayload({
      natural: null,
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
        {
          kind: "CORRESPONDENCE",
          streetLine: "PO Box 1",
          postalCode: null,
          locality: null,
          county: null,
          country: "Romania",
          notes: null,
        },
      ],
      notes: null,
    });
    expect(result.addresses.HOME.streetLine).toBe("Home St");
    expect(result.addresses.HOME.country).toBe("Romania");
    expect(result.addresses.CORRESPONDENCE.streetLine).toBe("PO Box 1");
  });

  it("leaves bucket empty when an unsupported address kind is present", () => {
    // POSTAL/HEADQUARTERS may exist in the DB (used by judicial persons,
    // future). The natural-person form only shows HOME + CORRESPONDENCE.
    const result = fromApiPayload({
      natural: null,
      addresses: [
        {
          kind: "HEADQUARTERS",
          streetLine: "HQ",
          postalCode: null,
          locality: null,
          county: null,
          country: "Romania",
          notes: null,
        },
      ],
      notes: null,
    });
    expect(result.addresses.HOME.streetLine).toBe("");
    expect(result.addresses.CORRESPONDENCE.streetLine).toBe("");
  });
});

// ---------------------------------------------------------------------------
// API schemas (validation.ts)
// ---------------------------------------------------------------------------

describe("naturalPersonCreateSchema (API)", () => {
  it("accepts minimal valid input", () => {
    const result = naturalPersonCreateSchema.safeParse({
      firstName: "Adrian",
      personalEmail1: "adrian@example.ro",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when no name is provided", () => {
    const result = naturalPersonCreateSchema.safeParse({
      personalEmail1: "x@y.z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when no contact is provided", () => {
    const result = naturalPersonCreateSchema.safeParse({
      firstName: "Adrian",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unpaired ID document fields", () => {
    const result = naturalPersonCreateSchema.safeParse({
      firstName: "Adrian",
      personalEmail1: "x@y.z",
      idDocumentType: "ID_CARD",
    });
    expect(result.success).toBe(false);
  });
});

describe("listQuerySchema", () => {
  it("coerces stringified numeric query params to numbers", () => {
    const result = listQuerySchema.parse({ limit: "10", offset: "5" });
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(5);
  });

  it("applies defaults when fields are omitted", () => {
    const result = listQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it("rejects limit above 200", () => {
    expect(listQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });

  it("rejects negative offset", () => {
    expect(listQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
  });
});
