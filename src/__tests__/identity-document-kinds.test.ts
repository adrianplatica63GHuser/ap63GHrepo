/**
 * The identity-document kinds registry.                                  (Slice 40.82)
 *
 * Adrian's four lists of 2026-10-26, as the design's matrix (section 2.2) sets them out, are code: one registry,
 * src/lib/identity-documents/kinds.ts. These pin the matrix field by field, the marker the application reads, and the
 * labels each field and kind needs in both message files.
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  IDENTITY_KINDS,
  IDENTITY_KIND_VALUES,
  IDENTITY_TYPE_KEYS,
  IDENTITY_VALUE_COLUMNS,
  IDENTITY_VALUE_KEYS,
  documentTypeIsIdentity,
  identityKindForTypeKey,
  identityKindOfType,
  identityValueKeysOf,
  kindHasField,
  type IdentityFieldKey,
  type IdentityKind,
} from "@/lib/identity-documents/kinds";

const fieldsOf = (kind: IdentityKind): IdentityFieldKey[] => IDENTITY_KINDS[kind].fields.map((f) => f.key);

describe("the four kinds", () => {
  it("are the four the marker's CHECK allows, each with its type key and Romanian name", () => {
    expect([...IDENTITY_KIND_VALUES]).toEqual(["CI_VECHE", "CI_NOU", "PASAPORT", "PASAPORT_CRDS"]);
    expect(IDENTITY_KIND_VALUES.map((k) => [IDENTITY_KINDS[k].typeKey, IDENTITY_KINDS[k].typeName])).toEqual([
      ["CARTE_IDENTITATE_VECHE", "Carte de Identitate (model vechi)"],
      ["CARTE_IDENTITATE", "Carte de Identitate (model nou)"],
      ["PASAPORT", "Pașaport"],
      ["PASAPORT_CRDS", "Pașaport CRDS"],
    ]);
    expect([...IDENTITY_TYPE_KEYS].sort()).toEqual(["CARTE_IDENTITATE", "CARTE_IDENTITATE_VECHE", "PASAPORT", "PASAPORT_CRDS"]);
  });

  it("migration_118 writes the same four types and the same CHECK", () => {
    const sql = readFileSync(join(process.cwd(), "src/db/migration_118_identity_documents.sql"), "utf8");
    for (const kind of IDENTITY_KIND_VALUES) {
      const { typeKey, typeName } = IDENTITY_KINDS[kind];
      expect(sql).toContain(`('${typeKey}',`);
      expect(sql).toContain(`'${typeName}'`);
      expect(sql).toContain(`'${kind}'`);
    }
    expect(sql).toContain("identity_kind IN ('CI_VECHE', 'CI_NOU', 'PASAPORT', 'PASAPORT_CRDS')");
  });
});

describe("each kind's fields — the design's matrix, Adrian's lists exactly", () => {
  it("model vechi (the booklet): no CNP, no sex, no validity end, no MRZ (Q #15)", () => {
    expect(fieldsOf("CI_VECHE")).toEqual([
      "lastName", "firstName", "fatherFirstName", "motherFirstName", "dateOfBirth", "placeOfBirth", "civilStatus",
      "domicileAddress", "dateDocument", "issuer", "issuerOfficer", "nrDocument",
    ]);
    for (const absent of ["cnp", "sex", "dateValidUntil", "mrz", "cardNumber"] as const) expect(kindHasField("CI_VECHE", absent)).toBe(false);
  });

  it("model nou: Nr. card kept, optional (Q #17); no date of birth", () => {
    expect(fieldsOf("CI_NOU")).toEqual([
      "nrDocument", "cnp", "sex", "lastName", "firstName", "nationality", "placeOfBirth", "domicileAddress", "issuer",
      "dateDocument", "dateValidUntil", "mrz", "cardNumber",
    ]);
    expect(kindHasField("CI_NOU", "dateOfBirth")).toBe(false);
  });

  it("the two passports share every field but the domicile: a county, or a country for CRDS", () => {
    const common = ["passportType", "countryCode", "nrDocument", "lastName", "firstName", "nationality", "dateOfBirth", "sex", "placeOfBirth", "dateDocument", "issuer", "dateValidUntil", "cnp"];
    expect(fieldsOf("PASAPORT")).toEqual([...common, "domicileCounty", "mrz"]);
    expect(fieldsOf("PASAPORT_CRDS")).toEqual([...common, "domicileCountry", "mrz"]);
  });

  it("every kind has the four common fields, as the document's own columns", () => {
    for (const kind of IDENTITY_KIND_VALUES) {
      const common = IDENTITY_KINDS[kind].fields.filter((f) => f.target === "document").map((f) => [f.key, f.column]);
      const expected = [["nrDocument", "nr_document"], ["dateDocument", "date_document"], ["issuer", "issuer_person_id"]];
      if (kind !== "CI_VECHE") expected.push(["dateValidUntil", "date_valid_until"]);
      expect(common.sort()).toEqual(expected.sort());
    }
  });

  it("no field twice in a kind, and every identity field is a column of identity_document", () => {
    for (const kind of IDENTITY_KIND_VALUES) {
      const keys = fieldsOf(kind);
      expect(new Set(keys).size).toBe(keys.length);
      for (const f of IDENTITY_KINDS[kind].fields.filter((x) => x.target === "identity")) {
        expect(IDENTITY_VALUE_COLUMNS[f.key as keyof typeof IDENTITY_VALUE_COLUMNS]).toBe(f.column);
      }
    }
  });

  it("every identity_document column is some kind's field", () => {
    const used = new Set(IDENTITY_KIND_VALUES.flatMap((k) => identityValueKeysOf(k)));
    expect(IDENTITY_VALUE_KEYS.filter((k) => !used.has(k))).toEqual([]);
  });

  it("the widths the design names: Nume M, Prenume M, Sex XS, Emisă de L, MRZ L on two lines, Domiciliu XL (40.83: from IDENTITY_DOCUMENT)", () => {
    const w = (kind: IdentityKind, key: IdentityFieldKey) => IDENTITY_KINDS[kind].fields.find((f) => f.key === key)!.width;
    expect(w("CI_NOU", "lastName").step).toBe("M");
    expect(w("CI_NOU", "firstName").step).toBe("M");
    expect(w("CI_NOU", "sex")).toEqual({ step: "XS", kind: "select" });
    expect(w("CI_NOU", "issuer").step).toBe("L");
    expect(w("CI_NOU", "mrz")).toMatchObject({ step: "L", kind: "lines", rows: 2 });
    expect(w("CI_NOU", "domicileAddress").step).toBe("XL");
  });
});

describe("labels: every kind and field has one in both message files", () => {
  const messages = (locale: string) =>
    JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8")) as Record<string, unknown>;
  const at = (obj: unknown, path: string): unknown =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);

  it.each(["ro-RO", "en-GB"])("%s", (locale) => {
    const m = messages(locale);
    const missing: string[] = [];
    for (const kind of IDENTITY_KIND_VALUES) {
      const def = IDENTITY_KINDS[kind];
      if (typeof at(m, def.messageKey) !== "string") missing.push(def.messageKey);
      for (const f of def.fields) if (typeof at(m, f.messageKey) !== "string") missing.push(f.messageKey);
    }
    expect(missing).toEqual([]);
  });
});

describe("documentTypeIsIdentity reads the marker, else the key — never the name", () => {
  it("believes the marker when the row carries it", () => {
    expect(identityKindOfType({ key: "WHATEVER", identityKind: "PASAPORT_CRDS" })).toBe("PASAPORT_CRDS");
    expect(identityKindOfType({ key: "CARTE_IDENTITATE", identityKind: null })).toBeNull();
    expect(documentTypeIsIdentity({ key: "CARTE_IDENTITATE", identityKind: "CI_NOU" })).toBe(true);
  });

  it("falls back to the four keys when the row does not carry the column", () => {
    expect(identityKindForTypeKey("CARTE_IDENTITATE")).toBe("CI_NOU");
    expect(identityKindForTypeKey(" CARTE_IDENTITATE_VECHE ")).toBe("CI_VECHE");
    expect(identityKindForTypeKey("CONTRACT_VANZARE")).toBeNull();
    expect(documentTypeIsIdentity({ key: "PASAPORT" })).toBe(true);
    expect(documentTypeIsIdentity({ key: "CONTRACT_VANZARE" })).toBe(false);
  });

  it("is false on nothing", () => {
    expect(documentTypeIsIdentity(null)).toBe(false);
    expect(documentTypeIsIdentity(undefined)).toBe(false);
    expect(documentTypeIsIdentity({})).toBe(false);
  });
});
