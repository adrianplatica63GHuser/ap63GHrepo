/**
 * A person's identity documents, and natural_person's id_* columns read by nothing.          (Slice 40.85)
 *
 * - `orderPersonIdentityDocuments`: the current one first — valid today with the latest issue date, else the latest
 *   issued — then the others, latest issued first; VALABIL / EXPIRAT per row; one row per document.
 * - `identityNumberKey` / `identityDocumentForQuote`: a deed's quoted number matched against the person's documents.
 * - No screen, API, matching rule or deed reader reads or writes natural_person's id_* columns: the source scan below
 *   names the only files that may still spell them, each with its reason.
 * Invented values only.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import {
  identityDocumentForQuote,
  identityNumberKey,
  orderPersonIdentityDocuments,
  personIdentityDocumentOf,
  personIdentityLabel,
  type PersonIdentityDocument,
} from "@/lib/identity-documents/person-list";
import { LEGACY_PERSON_ID_CARD_KEYS } from "@/lib/persons/legacy-id-card";
import { NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS } from "@/lib/versioning/snapshot-registry";
import { NP_ROWS } from "@/lib/ui/field-widths";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

const doc = (over: Partial<PersonIdentityDocument>): PersonIdentityDocument => ({
  id: "d",
  code: "DOC00001",
  kind: "CI_NOU",
  typeName: "Carte de Identitate (tip nou)",
  typeShortName: "CI",
  nrDocument: null,
  dateDocument: null,
  dateValidUntil: null,
  issuerName: null,
  ...over,
});
const TODAY = new Date(2026, 9, 26);

describe("the order of „Acte de identitate”", () => {
  it("the one valid today with the latest issue date first, then the latest issued", () => {
    const oldCard = doc({ id: "a", code: "DOC1", dateDocument: "2010-01-01", dateValidUntil: "2020-01-01" });
    const passport = doc({ id: "b", code: "DOC2", kind: "PASAPORT", typeShortName: null, typeName: "Pașaport", dateDocument: "2022-09-01", dateValidUntil: "2032-09-01" });
    const card = doc({ id: "c", code: "DOC3", dateDocument: "2021-05-05", dateValidUntil: "2031-05-05" });
    const booklet = doc({ id: "e", code: "DOC4", kind: "CI_VECHE", typeShortName: "CI vechi", dateDocument: "1995-06-02" });
    const rows = orderPersonIdentityDocuments([oldCard, card, booklet, passport], TODAY, 90);
    expect(rows.map((r) => r.id)).toEqual(["b", "c", "a", "e"]);
    expect(rows.map((r) => r.current)).toEqual([true, false, false, false]);
    expect(rows.map((r) => r.status?.kind ?? null)).toEqual(["valid", "valid", "expired", null]);
  });

  it("none valid today: the latest issued is the current one", () => {
    const rows = orderPersonIdentityDocuments(
      [doc({ id: "a", dateDocument: "2001-01-01", dateValidUntil: "2011-01-01" }), doc({ id: "b", dateDocument: "2011-01-01", dateValidUntil: "2021-01-01" })],
      TODAY,
      90,
    );
    expect(rows[0]).toMatchObject({ id: "b", current: true });
  });

  it("one row per document, and nothing for none", () => {
    expect(orderPersonIdentityDocuments([doc({ id: "a" }), doc({ id: "a" })], TODAY, 90)).toHaveLength(1);
    expect(orderPersonIdentityDocuments([], TODAY, 90)).toEqual([]);
  });

  it("EXPIRĂ ÎN n ZILE inside the person's expiry window", () => {
    const [r] = orderPersonIdentityDocuments([doc({ dateValidUntil: "2026-11-10" })], TODAY, 30);
    expect(r.status).toEqual({ kind: "expiringSoon", days: 15 });
  });

  it("the kind's short name, else its name; a row of an ordinary type is not one of the list", () => {
    expect(personIdentityLabel({ typeName: "Carte de Identitate (tip nou)", typeShortName: "CI" })).toBe("CI");
    expect(personIdentityLabel({ typeName: "Pașaport", typeShortName: null })).toBe("Pașaport");
    const raw = { id: "x", code: "D", typeName: "Adeverință", typeShortName: null, nrDocument: null, dateDocument: null, dateValidUntil: null, issuerName: null };
    expect(personIdentityDocumentOf({ ...raw, identityKind: null })).toBeNull();
    expect(personIdentityDocumentOf({ ...raw, identityKind: "PASAPORT", nrDocument: "  051 " })).toMatchObject({ kind: "PASAPORT", nrDocument: "051" });
  });
});

describe("a deed's quoted CI number (Ask first 4)", () => {
  it("is compared without spaces, case or the „seria” / „nr.” words", () => {
    expect(identityNumberKey("IF 123456")).toBe("IF123456");
    expect(identityNumberKey("seria if nr. 123456")).toBe("IF123456");
    expect(identityNumberKey(null)).toBe("");
  });

  it("names the person's document that carries it, else the current one", () => {
    const rows = orderPersonIdentityDocuments(
      [doc({ id: "old", nrDocument: "IF 111111", dateDocument: "2010-01-01", dateValidUntil: "2020-01-01" }), doc({ id: "new", nrDocument: "IF 222222", dateDocument: "2020-01-01", dateValidUntil: "2030-01-01" })],
      TODAY,
      90,
    );
    expect(identityDocumentForQuote(rows, "if111111")?.id).toBe("old");
    expect(identityDocumentForQuote(rows, "XX 000000")?.id).toBe("new");
    expect(identityDocumentForQuote(rows, null)?.id).toBe("new");
    expect(identityDocumentForQuote([], "IF 111111")).toBeNull();
  });
});

describe("natural_person's id_* columns: read and written by nothing", () => {
  it("not in a person's version since 40.85, nor on the person's rows; Cetățenie on „Identitate”", () => {
    for (const k of LEGACY_PERSON_ID_CARD_KEYS) {
      expect((NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS as readonly string[]).includes(k)).toBe(false);
      expect(NP_ROWS.identity.flat()).not.toContain(k);
    }
    expect(NP_ROWS.identity.flat()).toContain("citizenshipId");
    const row = NP_ROWS.identity.find((r) => (r as readonly string[]).includes("citizenshipId")) as readonly string[];
    expect(row).toEqual(["placeOfBirth", "citizenshipId"]);
  });

  /**
   * The source files that may still spell a column or its field: each with its reason. A new reader fails here.
   */
  const ALLOWED: Record<string, string> = {
    "src/db/schema/index.ts": "the columns themselves, until Adrian's go-ahead drops them (the register)",
    "src/lib/persons/legacy-id-card.ts": "their names, so the API omits them and the history shows them",
    "src/lib/persons/validation.ts": "the API's schemas omit them",
    "src/app/natural-persons/_components/form-schema.ts": "the import's card dialog's own form (idCardFormSchema), until 40.86",
    "src/app/natural-persons/_components/person-identity-documents.tsx": "a version before 40.85, shown read-only",
    "src/app/admin/import/_components/id-card-person-dialog.tsx": "the import's card dialog — 40.86",
    "src/app/api/admin/import/extract-id-card/route.ts": "the import's card read — 40.86",
    "src/lib/import/id-card.ts": "the import's card read — 40.86",
    "src/lib/import/identity-read.ts": "the import's read of the four kinds: the card's values, to the document (40.86)",
    "src/lib/ui/field-widths.ts": "the import's card dialog's rows (ID_CARD_DIALOG_ROWS) — 40.86",
    "src/lib/documents/ai-extract.ts": "a deed's quoted number, shown and matched, never stored (Ask first 4)",
    "src/app/api/documents/[id]/ai-interpret/route.ts": "the same quote, matched against identity documents",
    "src/lib/persons/queries.ts": "the match candidate's number — an identity document's",
    "src/components/persons/person-resolution-dialog.tsx": "shows the quote and the candidate's document number",
    "src/components/persons/parents-resolution.tsx": "a parent has no number to quote (null)",
    "src/app/documents/_components/ai-party-linker-dialog.tsx": "shows the deed's quote",
    "src/lib/import/classify-prompts.ts": "the deed reader's prompt asks for the quote",
    "src/lib/versioning/snapshot-registry.ts": "the comment that says they left",
    "src/components/forms/async-select.tsx": "a comment about pg enums",
    "src/db/seed.ts": "the base seed's card numbers, which it files as identity documents since 40.85",
    "src/lib/documents/type-config.ts": "a comment about the document's own number",
  };
  const PATTERN = /\bid(DocumentType|DocumentNumber|CardNumber|ValidFrom|ValidUntil|IssuingAuthority|MrzRaw)\b|\bid_(document_type|document_number|card_number|valid_from|valid_until|issuing_authority|mrz_raw)\b/;

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === "__tests__" || name === "node_modules") continue;
        walk(p, out);
      } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
  }

  it("no other file of the app spells one", () => {
    const offenders = walk(join(ROOT, "src"))
      .map((p) => relative(ROOT, p).split("\\").join("/"))
      .filter((f) => !(f in ALLOWED) && PATTERN.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("the deed linker writes none of them onto a person it creates", () => {
    const linker = read("src", "app", "documents", "_components", "ai-party-linker-dialog.tsx");
    const create = linker.slice(linker.indexOf('party.personType === "NATURAL"'), linker.indexOf('fetch("/api/people"'));
    expect(create).not.toMatch(/idDocumentType:|idDocumentNumber:|idIssuingAuthority:/);
  });
});
