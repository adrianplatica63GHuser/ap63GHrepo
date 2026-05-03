/**
 * Unit tests for paperwork validation schemas and type-config helpers.
 */

import {
  paperworkCreateSchema,
  paperworkUpdateSchema,
  PAPERWORK_TYPES,
} from "@/lib/paperwork/validation";
import { getTypeConfig } from "@/lib/paperwork/type-config";

// ---------------------------------------------------------------------------
// paperworkCreateSchema
// ---------------------------------------------------------------------------

describe("paperworkCreateSchema", () => {
  it("accepts a minimal valid payload (type only)", () => {
    const result = paperworkCreateSchema.safeParse({ type: "ACT_ADJUDECARE" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown type", () => {
    const result = paperworkCreateSchema.safeParse({ type: "INVALID_TYPE" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing type", () => {
    const result = paperworkCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts all 19 valid type values", () => {
    for (const type of PAPERWORK_TYPES) {
      const result = paperworkCreateSchema.safeParse({ type });
      expect(result.success).toBe(true);
    }
  });

  it("coerces suprafata string to number", () => {
    const result = paperworkCreateSchema.safeParse({
      type:      "TITLU_PROPRIETATE",
      suprafata: "12.5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suprafata).toBe(12.5);
    }
  });

  it("rejects a negative suprafata", () => {
    const result = paperworkCreateSchema.safeParse({
      type:      "TITLU_PROPRIETATE",
      suprafata: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a full TITLU_PROPRIETATE payload", () => {
    const result = paperworkCreateSchema.safeParse({
      type:           "TITLU_PROPRIETATE",
      title:          "Titlu Teren Nord",
      nrDocument:     "123/2021",
      dateDocument:   "2021-06-15",
      institution:    "OCPI Ilfov",
      emitent:        "Comisia Locală",
      bazaLegala:     "Legea 18/1991",
      uatProprietate: "Voluntari",
      uatProprietar:  "Voluntari",
      suprafata:      2.5,
      titularText:    "Ion Popescu",
      defunctText:    "Maria Popescu",
      notes:          "Terenul din zona de nord",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full CERTIFICAT_MOSTENITOR payload", () => {
    const result = paperworkCreateSchema.safeParse({
      type:               "CERTIFICAT_MOSTENITOR",
      nrDocument:         "42/2022",
      dateDocument:       "2022-03-10",
      institution:        "Notariat Popescu",
      nrDosarSuccesoral:  "DOS-100/2022",
      dataDecesului:      "2021-12-01",
      ultimulDomiciliu:   "Str. Florilor 5, București",
      nrCertificatDeces:  "CD-555/2021",
      defunctText:        "Maria Popescu",
      partiesBText:       "Ion Popescu, Ana Ionescu",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a CONTRACT_INCHIRIERE payload with date range", () => {
    const result = paperworkCreateSchema.safeParse({
      type:         "CONTRACT_INCHIRIERE",
      nrDocument:   "C-77/2023",
      dateDocument: "2023-01-01",
      institution:  "Primăria Sector 1",
      dateStart:    "2023-02-01",
      dateEnd:      "2024-01-31",
      partiesAText: "SC Proprietăți SRL",
      partiesBText: "Ioan Chirias",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// paperworkUpdateSchema
// ---------------------------------------------------------------------------

describe("paperworkUpdateSchema", () => {
  it("accepts an empty patch (no fields required)", () => {
    const result = paperworkUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a partial patch with only notes", () => {
    const result = paperworkUpdateSchema.safeParse({
      notes: "Updated note",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a type change", () => {
    const result = paperworkUpdateSchema.safeParse({
      type: "CONTRACT_VANZARE",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PAPERWORK_TYPES
// ---------------------------------------------------------------------------

describe("PAPERWORK_TYPES", () => {
  it("contains exactly 19 values", () => {
    expect(PAPERWORK_TYPES).toHaveLength(19);
  });

  it("includes TITLU_PROPRIETATE", () => {
    expect(PAPERWORK_TYPES).toContain("TITLU_PROPRIETATE");
  });

  it("includes ACT_DONATIE (confirmed addition)", () => {
    expect(PAPERWORK_TYPES).toContain("ACT_DONATIE");
  });

  it("includes TESTAMENT (confirmed addition)", () => {
    expect(PAPERWORK_TYPES).toContain("TESTAMENT");
  });
});

// ---------------------------------------------------------------------------
// getTypeConfig
// ---------------------------------------------------------------------------

describe("getTypeConfig", () => {
  it("returns generic config for a simple type (ACT_ADJUDECARE)", () => {
    const cfg = getTypeConfig("ACT_ADJUDECARE");
    expect(cfg.showTitlu).toBe(false);
    expect(cfg.showMostenitor).toBe(false);
    expect(cfg.showParties).toBe(false);
    expect(cfg.showDateRange).toBe(false);
    expect(cfg.showDefunct).toBe(false);
  });

  it("returns correct config for TITLU_PROPRIETATE", () => {
    const cfg = getTypeConfig("TITLU_PROPRIETATE");
    expect(cfg.showTitlu).toBe(true);
    expect(cfg.showDefunct).toBe(true);
    expect(cfg.labels.nrDocument).toBe("Nr. titlu proprietate");
  });

  it("returns correct config for CERTIFICAT_MOSTENITOR", () => {
    const cfg = getTypeConfig("CERTIFICAT_MOSTENITOR");
    expect(cfg.showMostenitor).toBe(true);
    expect(cfg.showParties).toBe(true);
    expect(cfg.showDefunct).toBe(true);
    expect(cfg.labels.partiesBText).toBe("Moștenitori");
  });

  it("returns correct config for CONTRACT_INCHIRIERE", () => {
    const cfg = getTypeConfig("CONTRACT_INCHIRIERE");
    expect(cfg.showParties).toBe(true);
    expect(cfg.showDateRange).toBe(true);
    expect(cfg.labels.partiesAText).toBe("Proprietari");
    expect(cfg.labels.partiesBText).toBe("Chiriași");
  });

  it("returns correct config for CONTRACT_VANZARE", () => {
    const cfg = getTypeConfig("CONTRACT_VANZARE");
    expect(cfg.showParties).toBe(true);
    expect(cfg.showDateRange).toBe(false);
    expect(cfg.labels.partiesAText).toBe("Vânzători");
    expect(cfg.labels.partiesBText).toBe("Cumpărători");
  });

  it("returns correct config for ACT_DONATIE", () => {
    const cfg = getTypeConfig("ACT_DONATIE");
    expect(cfg.showParties).toBe(true);
    expect(cfg.labels.partiesAText).toBe("Donatori");
    expect(cfg.labels.partiesBText).toBe("Donatari");
  });

  it("returns correct config for TESTAMENT", () => {
    const cfg = getTypeConfig("TESTAMENT");
    expect(cfg.showDefunct).toBe(true);
    expect(cfg.showParties).toBe(false);
    expect(cfg.labels.defunctText).toBe("Testator");
  });

  it("returns correct config for CONTRACT_ARENDA (date range + parties)", () => {
    const cfg = getTypeConfig("CONTRACT_ARENDA");
    expect(cfg.showDateRange).toBe(true);
    expect(cfg.showParties).toBe(true);
  });
});
