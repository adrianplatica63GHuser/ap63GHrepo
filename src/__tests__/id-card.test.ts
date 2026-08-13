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
  isIdCardTypeName,
  isIdCardEntry,
  ID_CARD_TYPE_KEYS,
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
// The TYPE-name test   (Slice #27.05)
// ---------------------------------------------------------------------------

describe("isIdCardTypeName — which document TYPE is the identity-card type", () => {
  /**
   * ⚠️ **A second, NARROWER test than `isIdCardLabel`, and both directions cost
   * something real.** #27.05 reads one document of every type with no custom
   * form and offers the fields for review — so a false NEGATIVE here opens that
   * review on an identity card with `cnp`, `nume` and `domiciliu` pre-ticked,
   * and one press puts a freely-editable copy of somebody's national identity
   * number on every card in the archive. A false POSITIVE silently costs a real
   * type its form: excluded from discovery for the whole run, with no error, no
   * count and nothing on screen.
   *
   * The two lists below are the ones two adversarial rounds produced.
   */
  it("matches every wording a card's TYPE is actually stored under", () => {
    for (const name of [
      "Carte de Identitate",
      "carte identitate",
      // ⚠️ The definite article, which `ID_CARD_NOTE_LINE` itself uses.
      "Cartea de identitate",
      "Act de identitate",
      "Acte de identitate",
      "Cărți de identitate",
      // …and the same word with the diacritic dropped by a scan.
      "Carti de identitate",
      // ⚠️ The pre-1997 official name, and the label a model reaches for.
      // `ensureDocType` POSTs the scan's label as a type NAME, so the run that
      // correctly declines to read a card can persist exactly this row — and
      // the NEXT run finds it in the type list.
      "Buletin de identitate",
      "BULETIN DE IDENTITATE",
    ]) {
      expect(isIdCardTypeName(name)).toBe(true);
    }
  });

  it("refuses the type names a land-registry archive really holds", () => {
    for (const name of [
      // The false positives `isIdCardLabel` produces on this distribution: its
      // bare-"buletin" and standalone-"CI" arms are right for a model reading a
      // scanned image and wrong for a row in a type list.
      "Buletin de analiză",
      "Buletin de încercare",
      "Copie CI",
      "Fișa CI",
      "Buletin",
      "CI",
      "C.I.",
      // A car's registration document — the veto, which is shared.
      "Carte de identitate a vehiculului",
      // And the seeded types, none of which may lose its form to this.
      "Contract de Vânzare",
      "Certificat de Moștenitor",
      "Act de Adjudecare",
      "Act de Donație",
      "Act Cadastru",
      "Certificat de Urbanism",
      "Extras din Carte Funciară",
      "Titlu de Proprietate",
      "Hotărâre Judecătorească",
      "Aviz de Instituție",
    ]) {
      expect(isIdCardTypeName(name)).toBe(false);
    }
  });

  it("is silent about nothing at all", () => {
    expect(isIdCardTypeName("")).toBe(false);
    expect(isIdCardTypeName("   ")).toBe(false);
    expect(isIdCardTypeName(null)).toBe(false);
    expect(isIdCardTypeName(undefined)).toBe(false);
  });
});
