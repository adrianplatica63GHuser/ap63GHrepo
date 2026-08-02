/**
 * Slice #23.01.Import — ID-card recognition for the import wizard.
 *
 * The pre-slice check was:
 *   label.toLowerCase().includes("carte de identitate") ||
 *   label.toLowerCase().includes("id card") ||
 *   label.toLowerCase().includes("buletin")
 * with no diacritic folding, no typeKey use, and no veto list. The cases
 * marked "regression" below are the ones that check let through or missed.
 */

import {
  foldRomanian,
  isIdCardLabel,
  isIdCardEntry,
  ID_CARD_TYPE_KEYS,
} from "@/lib/import/id-card";

describe("foldRomanian", () => {
  it("strips comma-below diacritics (correct Romanian encoding)", () => {
    expect(foldRomanian("Pășune Șoșea Țară")).toBe("pasune sosea tara");
  });

  it("strips cedilla diacritics (legacy OCR encoding of the same letters)", () => {
    // U+015F / U+0163 rather than U+0219 / U+021B — must fold identically.
    expect(foldRomanian("şosea ţara")).toBe("sosea tara");
  });

  it("lowercases and collapses whitespace", () => {
    expect(foldRomanian("  CARTE   DE\nIDENTITATE ")).toBe("carte de identitate");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(foldRomanian("   ")).toBe("");
  });
});

describe("isIdCardLabel", () => {
  it.each([
    "Carte de Identitate",
    "carte de identitate",
    "CARTE DE IDENTITATE",
    "Carte Identitate",
    "Buletin",
    "buletin de identitate",
    "Act de identitate",
    "ID card",
    "Identity Card",
    "C.I.",
    "CI",
  ])("accepts %j", (label) => {
    expect(isIdCardLabel(label)).toBe(true);
  });

  it("accepts a diacritic-bearing label (regression: raw toLowerCase missed these)", () => {
    expect(isIdCardLabel("Carte de identitate românească")).toBe(true);
  });

  it.each([
    "Contract de Vânzare",
    "Titlu de Proprietate",
    "Extras din Carte Funciară",
    "Certificat de Moștenitor",
    "Document necunoscut",
  ])("rejects %j", (label) => {
    expect(isIdCardLabel(label)).toBe(false);
  });

  it("rejects a vehicle registration card (regression: substring match sent CIV to the ID extractor)", () => {
    expect(isIdCardLabel("Carte de identitate a vehiculului")).toBe(false);
    expect(isIdCardLabel("Carte de identitate auto")).toBe(false);
  });

  it("does not fire on CI embedded in another token", () => {
    expect(isIdCardLabel("CIF 12345678")).toBe(false);
    expect(isIdCardLabel("Cinci parcele")).toBe(false);
  });

  it("handles null / undefined / empty", () => {
    expect(isIdCardLabel(null)).toBe(false);
    expect(isIdCardLabel(undefined)).toBe(false);
    expect(isIdCardLabel("")).toBe(false);
  });
});

describe("isIdCardEntry", () => {
  it.each(ID_CARD_TYPE_KEYS)("accepts typeKey %s regardless of label", (key) => {
    expect(isIdCardEntry({ typeKey: key, description: "Ceva nerelevant" })).toBe(true);
  });

  it("lets a confident non-ID typeKey veto a matching label", () => {
    expect(
      isIdCardEntry({
        typeKey: "CONTRACT_VANZARE",
        description: "Contract de vânzare cu buletin anexat",
      }),
    ).toBe(false);
  });

  it("falls through to the label when the key is UNCLASSIFIED", () => {
    expect(isIdCardEntry({ typeKey: "UNCLASSIFIED", description: "Buletin" })).toBe(true);
    expect(isIdCardEntry({ typeKey: "UNCLASSIFIED", description: "Titlu de Proprietate" })).toBe(false);
  });

  it("falls through to the label when there is no key at all", () => {
    expect(isIdCardEntry({ description: "Carte de Identitate" })).toBe(true);
    expect(isIdCardEntry({ typeKey: null, description: "Carte de Identitate" })).toBe(true);
    expect(isIdCardEntry({ typeKey: "  ", description: "Carte de Identitate" })).toBe(true);
  });

  it("rejects an entry with neither signal", () => {
    expect(isIdCardEntry({})).toBe(false);
    expect(isIdCardEntry(null)).toBe(false);
    expect(isIdCardEntry(undefined)).toBe(false);
  });
});
