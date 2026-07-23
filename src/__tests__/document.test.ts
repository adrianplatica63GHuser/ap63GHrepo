/**
 * Unit tests for document validation schemas and type-config helpers.
 *
 * Document type is no longer a hardcoded enum (Slice #15.05) — it's a uuid
 * FK (`documentTypeId`) into the admin-managed `lookup_document_type` table.
 * `getTypeConfig` is keyed by `lookup_document_type.key` (a plain string
 * slug), not a Postgres enum value.
 */

import {
  documentCreateSchema,
  documentUpdateSchema,
} from "@/lib/documents/validation";
import { getTypeConfig } from "@/lib/documents/type-config";
import { customFieldsEqual, parseTemplateFields } from "@/lib/documents/template-fields";

// A syntactically valid (RFC 4122 v4-shaped) uuid to stand in for a real
// lookup_document_type.id in tests that don't care which type it resolves to.
// Zod v4's z.string().uuid() enforces the version/variant nibbles strictly
// (version char in [1-8], variant char in [89abAB]) — unlike Zod v3, which
// accepted any UUID-shaped string. Real Postgres gen_random_uuid() values
// always satisfy this, so the fixture must too.
const SOME_TYPE_ID = "11111111-1111-4111-8111-111111111111";

// ---------------------------------------------------------------------------
// documentCreateSchema
// ---------------------------------------------------------------------------

describe("documentCreateSchema", () => {
  it("accepts a minimal valid payload (documentTypeId only)", () => {
    const result = documentCreateSchema.safeParse({ documentTypeId: SOME_TYPE_ID });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid documentTypeId", () => {
    const result = documentCreateSchema.safeParse({ documentTypeId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing documentTypeId", () => {
    const result = documentCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("coerces suprafata string to number", () => {
    const result = documentCreateSchema.safeParse({
      documentTypeId: SOME_TYPE_ID,
      suprafata:      "12.5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suprafata).toBe(12.5);
    }
  });

  it("rejects a negative suprafata", () => {
    const result = documentCreateSchema.safeParse({
      documentTypeId: SOME_TYPE_ID,
      suprafata:      -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a full TITLU_PROPRIETATE-shaped payload", () => {
    const result = documentCreateSchema.safeParse({
      documentTypeId: SOME_TYPE_ID,
      title:          "Titlu Teren Nord",
      nrDocument:     "123/2021",
      dateDocument:   "2021-06-15",
      emitent:        "Comisia Locală",
      bazaLegala:     "Legea 18/1991",
      uatProprietate: "Voluntari",
      uatProprietar:  "Voluntari",
      suprafata:      2.5,
      notes:          "Terenul din zona de nord",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full CERTIFICAT_MOSTENITOR-shaped payload", () => {
    const result = documentCreateSchema.safeParse({
      documentTypeId:     SOME_TYPE_ID,
      nrDocument:         "42/2022",
      dateDocument:       "2022-03-10",
      nrDosarSuccesoral:  "DOS-100/2022",
      dataDecesului:      "2021-12-01",
      ultimulDomiciliu:   "Str. Florilor 5, București",
      nrCertificatDeces:  "CD-555/2021",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a CONTRACT_INCHIRIERE-shaped payload with date range", () => {
    const result = documentCreateSchema.safeParse({
      documentTypeId: SOME_TYPE_ID,
      nrDocument:     "C-77/2023",
      dateDocument:   "2023-01-01",
      dateStart:      "2023-02-01",
      dateEnd:        "2024-01-31",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// documentUpdateSchema
// ---------------------------------------------------------------------------

describe("documentUpdateSchema", () => {
  it("accepts an empty patch (no fields required)", () => {
    const result = documentUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a partial patch with only notes", () => {
    const result = documentUpdateSchema.safeParse({
      notes: "Updated note",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a documentTypeId change", () => {
    const result = documentUpdateSchema.safeParse({
      documentTypeId: SOME_TYPE_ID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid documentTypeId in a patch", () => {
    const result = documentUpdateSchema.safeParse({
      documentTypeId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTypeConfig
// ---------------------------------------------------------------------------

describe("getTypeConfig", () => {
  it("returns the generic labels when key is null/undefined", () => {
    expect(getTypeConfig(null).labels.nrDocument).toBe("Nr. document");
    expect(getTypeConfig(undefined).labels.nrDocument).toBe("Nr. document");
  });

  it("returns generic labels for a type with no override (ACT_ADJUDECARE)", () => {
    const cfg = getTypeConfig("ACT_ADJUDECARE");
    expect(cfg.labels.nrDocument).toBe("Nr. document");
    expect(cfg.labels.dateDocument).toBe("Data autentificării");
    expect(cfg.labels.institution).toBe("Instituție înregistrare");
  });

  it("returns correct label override for TITLU_PROPRIETATE", () => {
    const cfg = getTypeConfig("TITLU_PROPRIETATE");
    expect(cfg.labels.nrDocument).toBe("Nr. titlu proprietate");
    expect(cfg.labels.dateDocument).toBe("Data eliberării");
    expect(cfg.labels.institution).toBe("Emitent");
  });

  it("returns correct label override for CERTIFICAT_MOSTENITOR", () => {
    const cfg = getTypeConfig("CERTIFICAT_MOSTENITOR");
    expect(cfg.labels.nrDocument).toBe("Nr. certificat de moștenitor");
    expect(cfg.labels.institution).toBe("Notariat");
  });

  it("returns correct label override for CONTRACT_INCHIRIERE", () => {
    const cfg = getTypeConfig("CONTRACT_INCHIRIERE");
    expect(cfg.labels.nrDocument).toBe("Nr. contract de închiriere");
  });

  it("returns correct label override for CONTRACT_VANZARE", () => {
    const cfg = getTypeConfig("CONTRACT_VANZARE");
    expect(cfg.labels.nrDocument).toBe("Nr. act autentic");
  });

  it("returns correct label override for ACT_DONATIE", () => {
    const cfg = getTypeConfig("ACT_DONATIE");
    expect(cfg.labels.institution).toBe("Notariat");
  });

  it("returns correct label override for TESTAMENT", () => {
    const cfg = getTypeConfig("TESTAMENT");
    expect(cfg.labels.institution).toBe("Notariat");
  });

  it("returns correct label override for CONTRACT_ARENDA", () => {
    const cfg = getTypeConfig("CONTRACT_ARENDA");
    expect(cfg.labels.nrDocument).toBe("Nr. contract de arendă");
  });

  it("falls back to generic labels for an unknown key", () => {
    const cfg = getTypeConfig("SOME_UNKNOWN_KEY");
    expect(cfg).toEqual(getTypeConfig(null));
  });

  it("no longer exposes per-type show flags (Slice #21.03.Import Phase 1 — one generic template for all types)", () => {
    const cfg = getTypeConfig("CERTIFICAT_MOSTENITOR") as Record<string, unknown>;
    expect(cfg.showTitlu).toBeUndefined();
    expect(cfg.showMostenitor).toBeUndefined();
    expect(cfg.showDateRange).toBeUndefined();
    expect(cfg.showValidUntil).toBeUndefined();
    expect(cfg.showSurveyor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Slice #21.03.Import — template-fields helpers
// ---------------------------------------------------------------------------

describe("parseTemplateFields", () => {
  it("returns an empty array for null/undefined/non-array input", () => {
    expect(parseTemplateFields(null)).toEqual([]);
    expect(parseTemplateFields(undefined)).toEqual([]);
    expect(parseTemplateFields("not-an-array")).toEqual([]);
    expect(parseTemplateFields({})).toEqual([]);
  });

  it("parses a well-formed field list and sorts by order", () => {
    const parsed = parseTemplateFields([
      { key: "b", labelRo: "B", labelEn: "B", type: "date", order: 2 },
      { key: "a", labelRo: "A", labelEn: "A", type: "text", order: 1 },
    ]);
    expect(parsed.map((f) => f.key)).toEqual(["a", "b"]);
    expect(parsed[1].type).toBe("date");
  });

  it("drops entries without a key, and falls back to 'text' for an invalid type", () => {
    const parsed = parseTemplateFields([
      { key: "", labelRo: "No key" },
      { key: "valid", labelRo: "Valid", type: "not-a-real-type" },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].key).toBe("valid");
    expect(parsed[0].type).toBe("text");
  });

  it("never throws on malformed entries", () => {
    expect(() => parseTemplateFields([null, 42, "x", { key: "ok" }])).not.toThrow();
    expect(parseTemplateFields([null, 42, "x", { key: "ok" }])).toHaveLength(1);
  });
});

describe("customFieldsEqual", () => {
  it("treats null and undefined as equal to an empty object", () => {
    expect(customFieldsEqual(null, undefined)).toBe(true);
    expect(customFieldsEqual(null, {})).toBe(true);
    expect(customFieldsEqual({}, {})).toBe(true);
  });

  it("treats a missing key the same as an explicit null value", () => {
    expect(customFieldsEqual({ a: null }, {})).toBe(true);
    expect(customFieldsEqual({}, { a: null })).toBe(true);
  });

  it("is insensitive to key order", () => {
    expect(customFieldsEqual({ a: "1", b: "2" }, { b: "2", a: "1" })).toBe(true);
  });

  it("detects an actual value change", () => {
    expect(customFieldsEqual({ a: "1" }, { a: "2" })).toBe(false);
  });

  it("detects an added or removed key", () => {
    expect(customFieldsEqual({ a: "1" }, { a: "1", b: "2" })).toBe(false);
  });
});
