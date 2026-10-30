/**
 * The import reads all four identity kinds.                                               (Slice 40.86)
 *
 * - the read's kind wins over the classifier's key, which is only its fallback (Ask first 1);
 * - the four keys are the identity read's, and a passport's label is an identity label (Ask first 2);
 * - the card's values go to the document's identity values, the kind's own fields only, a misread CNP nowhere
 *   (Ask first 3); a passport's domicile is its county or its country (Ask first 4);
 * - an existing person gets only its empty fields (Ask first 3);
 * - the route asks for the kind and returns it; the multi-card rule counts people, not kinds (Ask first 5).
 * Invented values only — no real card.
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  cardFieldsOfKind,
  domicileLineOf,
  fillEmptyPersonPatch,
  identityKindOfRead,
  identityValuesFromRead,
  usableCnp,
} from "@/lib/import/identity-read";
import { IDENTITY_READ_TYPE_KEYS, isIdentityEntry, isIdentityLabel, looksLikeIdCardName } from "@/lib/import/id-card";
import { IDENTITY_KINDS, IDENTITY_TYPE_KEYS, identityValueKeysOf } from "@/lib/identity-documents/kinds";
import { cnpControlDigit } from "@/lib/identity-documents/validation";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const CNP = (() => {
  const first12 = "185042140012";
  return `${first12}${cnpControlDigit(first12)}`;
})();

describe("the kind (Ask first 1)", () => {
  it("the read's kind wins; else the document's type; else tip nou", () => {
    expect(identityKindOfRead("PASAPORT", "CARTE_IDENTITATE")).toBe("PASAPORT");
    expect(identityKindOfRead(null, "CARTE_IDENTITATE_VECHE")).toBe("CI_VECHE");
    expect(identityKindOfRead("NOT_A_KIND", "PASAPORT_CRDS")).toBe("PASAPORT_CRDS");
    expect(identityKindOfRead(undefined, "CONTRACT_VANZARE")).toBe("CI_NOU");
    expect(identityKindOfRead(undefined, null)).toBe("CI_NOU");
  });
});

describe("the identity read takes all four kinds (Ask first 2)", () => {
  it("the four keys, the same as the kinds'", () => {
    expect([...IDENTITY_READ_TYPE_KEYS].sort()).toEqual([...IDENTITY_TYPE_KEYS].sort());
    for (const key of IDENTITY_TYPE_KEYS) expect(isIdentityEntry({ typeKey: key })).toBe(true);
    expect(isIdentityEntry({ typeKey: "CONTRACT_VANZARE", description: "Pașaport" })).toBe(false);
  });

  it("a passport's label is an identity label; an energy or a pet passport is not", () => {
    expect(isIdentityLabel("Pașaport")).toBe(true);
    expect(isIdentityLabel("Pasaport CRDS")).toBe(true);
    expect(isIdentityLabel("Romanian passport")).toBe(true);
    expect(isIdentityLabel("Buletin de identitate")).toBe(true);
    expect(isIdentityLabel("Pașaport energetic al clădirii")).toBe(false);
    expect(isIdentityLabel("Pașaport canin")).toBe(false);
    expect(isIdentityLabel("Carte de identitate a vehiculului")).toBe(false);
    expect(looksLikeIdCardName("Pasaport_Popescu.jpg")).toBe(true);
  });

  it("the import's own files ask the read's question, never a card-only one", () => {
    for (const f of [
      ["src", "app", "admin", "import", "_components", "bulk-import-dialog.tsx"],
      ["src", "app", "admin", "import", "_components", "import-wizard.tsx"],
    ]) {
      const src = read(...f);
      expect(src).toContain("isIdentityEntry(");
      expect(src).not.toMatch(/\bisIdCardEntry\b/);
    }
  });
});

describe("where the values go (Ask first 3, 4)", () => {
  const read = {
    lastName: "Testescu", firstName: "Ion", gender: "MALE", dateOfBirth: "1985-04-21", cnp: CNP,
    placeOfBirth: "Mun. București", citizenshipRaw: "Română / ROU", idCardNumber: "000111", idMrzRaw: "IDROU<<\nX",
    addressStreetLine: "Str. Probei nr. 1", addressLocality: "Bragadiru", addressCounty: "Ilfov", addressCountry: "România",
    civilStatus: "necăsătorit", issuerOfficer: "Plt. Test", passportType: "P", countryCode: "ROU",
  };
  const parents = { father: "Ilie", mother: "Ana" };

  it.each(Object.keys(IDENTITY_KINDS) as (keyof typeof IDENTITY_KINDS)[])("%s: only its own fields", (kind) => {
    const v = identityValuesFromRead(kind, read, parents);
    const own = new Set<string>(identityValueKeysOf(kind));
    for (const k of Object.keys(v)) expect([kind, k, own.has(k)]).toEqual([kind, k, true]);
    expect(v.lastName).toBe("Testescu");
  });

  it("tip nou: CNP, sex, the domicile as one line, the MRZ, Nr. card — no date of birth (the card has none)", () => {
    const v = identityValuesFromRead("CI_NOU", read, parents);
    expect(v).toMatchObject({ cnp: CNP, sex: "MALE", domicileAddress: "Str. Probei nr. 1, Bragadiru, jud. Ilfov", mrz: "IDROU<<\nX", cardNumber: "000111" });
    expect(v).not.toHaveProperty("dateOfBirth");
  });

  it("tip vechi: the parents, the civil status, the officer; no CNP, no MRZ", () => {
    const v = identityValuesFromRead("CI_VECHE", read, parents);
    expect(v).toMatchObject({ fatherFirstName: "Ilie", motherFirstName: "Ana", civilStatus: "necăsătorit", issuerOfficer: "Plt. Test", dateOfBirth: "1985-04-21" });
    expect(v).not.toHaveProperty("cnp");
    expect(v).not.toHaveProperty("mrz");
  });

  it("a passport's domicile is its county; a CRDS passport's its country", () => {
    expect(identityValuesFromRead("PASAPORT", read)).toMatchObject({ domicileCounty: "Ilfov", passportType: "P", countryCode: "ROU" });
    expect(identityValuesFromRead("PASAPORT", read)).not.toHaveProperty("domicileCountry");
    expect(identityValuesFromRead("PASAPORT_CRDS", { ...read, addressCountry: "Spania" })).toMatchObject({ domicileCountry: "Spania" });
    expect(identityValuesFromRead("PASAPORT_CRDS", read)).not.toHaveProperty("domicileCounty");
  });

  it("a misread CNP goes nowhere; a date not ISO goes nowhere", () => {
    const bad = `${CNP.slice(0, 12)}${(Number(CNP[12]) + 1) % 10}`;
    expect(usableCnp(bad)).toBeNull();
    expect(identityValuesFromRead("CI_NOU", { ...read, cnp: bad })).not.toHaveProperty("cnp");
    expect(identityValuesFromRead("CI_VECHE", { ...read, dateOfBirth: "21.04.1985" })).not.toHaveProperty("dateOfBirth");
  });

  it("the domicile line: what is printed, in order; nothing when nothing is", () => {
    expect(domicileLineOf({ addressLocality: "Sector 6" })).toBe("Sector 6");
    expect(domicileLineOf({ addressCounty: "Județul Ilfov" })).toBe("jud. Ilfov");
    expect(domicileLineOf({})).toBeNull();
  });

  it("the review's card fields follow the kind", () => {
    expect(cardFieldsOfKind("CI_NOU")).toEqual(["idDocumentNumber", "idCardNumber", "idValidFrom", "idValidUntil", "idIssuingAuthority"]);
    expect(cardFieldsOfKind("CI_VECHE")).toEqual(["idDocumentNumber", "idValidFrom", "idIssuingAuthority"]);
    expect(cardFieldsOfKind("PASAPORT")).toEqual(["idDocumentNumber", "idValidFrom", "idValidUntil", "idIssuingAuthority"]);
  });

  it("an existing person: only the empty fields, nothing overwritten, a misread CNP never", () => {
    expect(fillEmptyPersonPatch({ cnp: null, gender: "", dateOfBirth: null, placeOfBirth: "Cluj", citizenshipId: null }, { cnp: CNP, gender: "MALE", dateOfBirth: "1985-04-21", placeOfBirth: "București", citizenshipId: "c-1" })).toEqual({
      cnp: CNP, gender: "MALE", dateOfBirth: "1985-04-21", citizenshipId: "c-1",
    });
    expect(fillEmptyPersonPatch({ cnp: "1111111111111" }, { cnp: CNP })).toEqual({});
    expect(fillEmptyPersonPatch({}, { cnp: "1850421400124" })).toEqual({});
  });
});

describe("the read and the review", () => {
  const route = read("src", "app", "api", "admin", "import", "extract-id-card", "route.ts");
  const dialog = read("src", "app", "admin", "import", "_components", "id-card-person-dialog.tsx");

  it("the route asks for the kind first, from what the image shows, and returns it", () => {
    for (const k of ["CI_VECHE", "CI_NOU", "PASAPORT", "PASAPORT_CRDS"]) expect(route).toContain(`"${k}"`);
    expect(route).toContain("never from a file name");
    expect(route).toMatch(/kind: isIdentityKind\(raw\.kind\) \? raw\.kind : null/);
    expect(route).toMatch(/return Response\.json\(\{\s*kind: parsed\.kind,/);
  });

  it("one person's card and passport on one sheet is one person (Ask first 5)", () => {
    expect(route).toContain("ONE person's card and passport on one sheet are all ONE person (count people, not kinds)");
    expect(read("src", "lib", "import", "classify-prompts.ts")).toContain("ONE person's card and passport on one sheet are all ONE person");
  });

  it("the dialog files under the read's kind, writes the kind's values to the document, fills an existing person's empty fields", () => {
    expect(dialog).toContain("identityKindOfRead(readKindRaw,");
    expect(dialog).toContain("identityValuesFromRead(writeKind, read, readParents)");
    expect(dialog).toMatch(/retypeTo \? \{ documentTypeId: retypeTo \} : \{\}/);
    expect(dialog).toContain("await fillEmptyPersonFields(personId, getValues());");
    // natural_person's id_* columns: the person's payload is `toApiPayload`, which leaves them out (40.85).
    expect(dialog).not.toMatch(/idDocumentType:\s*values\./);
  });
});
