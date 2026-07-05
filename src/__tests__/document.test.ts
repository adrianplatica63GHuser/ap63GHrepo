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
  it("returns the generic config when key is null/undefined", () => {
    expect(getTypeConfig(null).showTitlu).toBe(false);
    expect(getTypeConfig(undefined).showDateRange).toBe(false);
  });

  it("returns generic config for a simple type (ACT_ADJUDECARE)", () => {
    const cfg = getTypeConfig("ACT_ADJUDECARE");
    expect(cfg.showTitlu).toBe(false);
    expect(cfg.showMostenitor).toBe(false);
    expect(cfg.showDateRange).toBe(false);
    expect(cfg.showValidUntil).toBe(false);
  });

  it("returns correct config for TITLU_PROPRIETATE", () => {
    const cfg = getTypeConfig("TITLU_PROPRIETATE");
    expect(cfg.showTitlu).toBe(true);
    expect(cfg.labels.nrDocument).toBe("Nr. titlu proprietate");
  });

  it("returns correct config for CERTIFICAT_MOSTENITOR", () => {
    const cfg = getTypeConfig("CERTIFICAT_MOSTENITOR");
    expect(cfg.showMostenitor).toBe(true);
    expect(cfg.labels.nrDocument).toBe("Nr. certificat de moștenitor");
  });

  it("returns correct config for CONTRACT_INCHIRIERE", () => {
    const cfg = getTypeConfig("CONTRACT_INCHIRIERE");
    expect(cfg.showDateRange).toBe(true);
    expect(cfg.labels.nrDocument).toBe("Nr. contract de închiriere");
  });

  it("returns correct config for CONTRACT_VANZARE", () => {
    const cfg = getTypeConfig("CONTRACT_VANZARE");
    expect(cfg.showDateRange).toBe(false);
    expect(cfg.labels.nrDocument).toBe("Nr. act autentic");
  });

  it("returns correct config for ACT_DONATIE", () => {
    const cfg = getTypeConfig("ACT_DONATIE");
    expect(cfg.showTitlu).toBe(false);
    expect(cfg.labels.institution).toBe("Notariat");
  });

  it("returns correct config for TESTAMENT", () => {
    const cfg = getTypeConfig("TESTAMENT");
    expect(cfg.showTitlu).toBe(false);
    expect(cfg.labels.institution).toBe("Notariat");
  });

  it("returns correct config for CONTRACT_ARENDA (date range)", () => {
    const cfg = getTypeConfig("CONTRACT_ARENDA");
    expect(cfg.showDateRange).toBe(true);
  });

  it("falls back to generic config for an unknown key", () => {
    const cfg = getTypeConfig("SOME_UNKNOWN_KEY");
    expect(cfg).toEqual(getTypeConfig(null));
  });
});
