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
  isIdentityLabel,
  isIdentityEntry,
  IDENTITY_READ_TYPE_KEYS,
  looksLikeIdCardName,
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

describe("isIdentityLabel", () => {
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
    expect(isIdentityLabel(label)).toBe(true);
  });

  it("accepts a diacritic-bearing label (regression: raw toLowerCase missed these)", () => {
    expect(isIdentityLabel("Carte de identitate românească")).toBe(true);
  });

  it.each([
    "Contract de Vânzare",
    "Titlu de Proprietate",
    "Extras din Carte Funciară",
    "Certificat de Moștenitor",
    "Document necunoscut",
  ])("rejects %j", (label) => {
    expect(isIdentityLabel(label)).toBe(false);
  });

  it("rejects a vehicle registration card (regression: substring match sent CIV to the ID extractor)", () => {
    expect(isIdentityLabel("Carte de identitate a vehiculului")).toBe(false);
    expect(isIdentityLabel("Carte de identitate auto")).toBe(false);
  });

  it("does not fire on CI embedded in another token", () => {
    expect(isIdentityLabel("CIF 12345678")).toBe(false);
    expect(isIdentityLabel("Cinci parcele")).toBe(false);
  });

  it("handles null / undefined / empty", () => {
    expect(isIdentityLabel(null)).toBe(false);
    expect(isIdentityLabel(undefined)).toBe(false);
    expect(isIdentityLabel("")).toBe(false);
  });
});

describe("isIdentityEntry", () => {
  it.each(IDENTITY_READ_TYPE_KEYS)("accepts typeKey %s regardless of label", (key) => {
    expect(isIdentityEntry({ typeKey: key, description: "Ceva nerelevant" })).toBe(true);
  });

  it("lets a confident non-ID typeKey veto a matching label", () => {
    expect(
      isIdentityEntry({
        typeKey: "CONTRACT_VANZARE",
        description: "Contract de vânzare cu buletin anexat",
      }),
    ).toBe(false);
  });

  it("falls through to the label when the key is UNCLASSIFIED", () => {
    expect(isIdentityEntry({ typeKey: "UNCLASSIFIED", description: "Buletin" })).toBe(true);
    expect(isIdentityEntry({ typeKey: "UNCLASSIFIED", description: "Titlu de Proprietate" })).toBe(false);
  });

  it("falls through to the label when there is no key at all", () => {
    expect(isIdentityEntry({ description: "Carte de Identitate" })).toBe(true);
    expect(isIdentityEntry({ typeKey: null, description: "Carte de Identitate" })).toBe(true);
    expect(isIdentityEntry({ typeKey: "  ", description: "Carte de Identitate" })).toBe(true);
  });

  it("rejects an entry with neither signal", () => {
    expect(isIdentityEntry({})).toBe(false);
    expect(isIdentityEntry(null)).toBe(false);
    expect(isIdentityEntry(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Slice #26.08 — the same question, asked of a NAME
// ---------------------------------------------------------------------------

describe("looksLikeIdCardName", () => {
  /**
   * The weak signal, used at the Pre-existing stage, several stages before
   * Haiku has seen anything. It is allowed — meant — to over-claim: a false
   * positive costs a duplicate document and a false negative costs a PERSON,
   * because a wrong name-and-size match on a card is what the whole carve-out
   * exists to prevent.
   */
  it("reads the ordinary spellings, however they are separated", () => {
    for (const name of [
      "Buletin.jpg",
      "buletin popescu.png",
      "Buletin-Popescu.jpg",
      "CI Popescu.jpg",
      "Carte de identitate.pdf",
      "act de identitate.tif",
      "ID card.png",
    ]) {
      expect({ name, idCard: looksLikeIdCardName(name) }).toEqual({ name, idCard: true });
    }
  });

  it("⚠️ reads UNDERSCORES as separators, which `\\b` alone does not", () => {
    // `_` is an ASCII WORD character, so `\b` does not fire beside it and every
    // underscore-separated spelling was missed — while underscore is this
    // archive's own convention (`folderNameToTitleHint` exists to turn
    // `CVC_2021-04-12` into a title). Found by #26.08's adversarial review.
    for (const name of [
      "Buletin_Popescu.jpg",
      "Buletin_2.jpg",
      "Carte_de_identitate.jpg",
      "act_de_identitate.png",
    ]) {
      expect({ name, idCard: looksLikeIdCardName(name) }).toEqual({ name, idCard: true });
    }
  });

  it("keeps the veto and the word boundaries once underscores are spaces", () => {
    // Over-claiming is cheap; claiming EVERYTHING would empty the stage of its
    // value, so the negative half matters too.
    for (const name of [
      "Contract_vanzare.pdf",
      "Buletinul_Oficial.pdf",
      "carte_de_identitate_a_vehiculului.jpg",
      "coord 48-50.txt",
      "Certificat.pdf",
      "cinci pagini.pdf",
    ]) {
      expect({ name, idCard: looksLikeIdCardName(name) }).toEqual({ name, idCard: false });
    }
  });

  it("strips only a real extension, so a dotfile is matched whole", () => {
    // `dot > 0` rather than `dot >= 0`: `.buletin` is all stem, and slicing at
    // index 0 would leave nothing to match.
    expect(looksLikeIdCardName(".buletin")).toBe(true);
    expect(looksLikeIdCardName("buletin")).toBe(true);
    expect(looksLikeIdCardName("plan.buletin")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The TYPE-name test   (Slice #27.05) — retired in Slice 40.82
// ---------------------------------------------------------------------------
//
// `isIdCardTypeName` judged a document TYPE by its name. Since migration_118 an identity type is recognised by its
// marker (`documentTypeIsIdentity`, src/__tests__/identity-document-kinds.test.ts), so a type NAMED like a card is an
// ordinary type unless it carries one. The scan-side tests above (`isIdentityLabel`, `isIdentityEntry`) are unchanged.
