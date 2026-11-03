/**
 * Slice 41.53 — the notary office chosen on „Identificarea actului" is a „Notar" link in „Legături".
 *
 * The sync runs inside the document's own transaction, against the database, so what is pinned here is its RULE and
 * its WIRING: which types (the label decides), that both create and update call it, that it removes only the rows it
 * marked (a „Notar" link made by hand survives) and adds none beside a hand-made one, that a dissociation of its row is
 * refused on both routes, and the migration's backfill and seed. TC-DOC-29 drives it end to end.
 */
import { readFileSync } from "fs";
import { join } from "path";

import { issuerIsNotary } from "@/lib/documents/type-config";
import { IssuerLinkDissociationError } from "@/lib/documents/issuer-link-error";
import { issuerLinkToResponse } from "@/lib/api/errors";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const QUERIES = read("src", "lib", "documents", "queries.ts");
const sync = QUERIES.slice(QUERIES.indexOf("export async function syncIssuerNotaryLink"), QUERIES.indexOf("/**\n * ⚠️ **`linkId` IS REQUIRED"));

describe("which types (Ask first 4)", () => {
  it("the five labelled „Notariat”, and no other", () => {
    for (const k of ["CERTIFICAT_MOSTENITOR", "CONTRACT_VANZARE", "ACT_ADITIONAL", "ACT_DONATIE", "TESTAMENT"]) expect([k, issuerIsNotary(k)]).toEqual([k, true]);
    for (const k of ["CONTRACT_INCHIRIERE", "CONTRACT_ARENDA", "ADEVERINTA", "PLAN_PARCELAR", null, undefined]) expect([k, issuerIsNotary(k)]).toEqual([k, false]);
  });
});

describe("the sync (Ask firsts 1, 2 and 6)", () => {
  it("runs in create and in update, inside their transaction", () => {
    const create = QUERIES.slice(QUERIES.indexOf("export async function createDocument"), QUERIES.indexOf("export async function updateDocument"));
    const update = QUERIES.slice(QUERIES.indexOf("export async function updateDocument"), QUERIES.indexOf("export async function existingDocumentIds"));
    expect(create).toContain("await syncIssuerNotaryLink(tx, row.id);");
    expect(update).toContain("await syncIssuerNotaryLink(tx, id);");
  });

  it("removes only the rows it marked, and adds none beside a hand-made „Notar” link", () => {
    // What it may delete is read from `from_issuer = true` rows only.
    expect(sync).toMatch(/eq\(personDocument\.fromIssuer, true\)/);
    expect(sync).toMatch(/tx\.delete\(personDocument\)\.where\(inArray\(personDocument\.id, stale\)\)/);
    expect(sync.match(/tx\.delete\(/g)).toHaveLength(1);
    // Before inserting: any „Notar" link of the issuer on the document — hand-made included — means nothing to add.
    expect(sync).toMatch(/eq\(personDocument\.personId, issuer\), eq\(personDocument\.personRoleId, notar\.id\)\)\)\s*\.limit\(1\);\s*if \(has\) return;/);
    expect(sync).toContain("fromIssuer: true");
    // The type's label decides, so a type that stops being „Notariat" loses the link.
    expect(sync).toContain("issuerIsNotary(doc.typeKey) ? doc.issuerPersonId : null");
  });

  it("is refused on both dissociation routes, with the screen's sentence", async () => {
    expect(QUERIES).toMatch(/export async function dissociatePersonFromDocument[\s\S]{0,400}await refuseIssuerLink\(linkId\);/);
    const person = read("src", "app", "api", "people", "[id]", "documents", "[documentId]", "route.ts");
    expect(person).toContain("await refuseIssuerLink(linkId);");
    for (const r of [person, read("src", "app", "api", "documents", "[id]", "persons", "[personId]", "route.ts")]) expect(r).toContain("issuerLinkToResponse(err)");
    const res = issuerLinkToResponse(new IssuerLinkDissociationError("x"))!;
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Biroul notarial se schimbă din „Identificarea actului”.", code: "ISSUER_LINK" });
    expect(issuerLinkToResponse(new Error("other"))).toBeNull();
    const ro = JSON.parse(read("messages", "ro-RO.json"));
    const en = JSON.parse(read("messages", "en-GB.json"));
    expect(ro.document.persons.issuerLink).toBe("Biroul notarial se schimbă din „Identificarea actului”.");
    expect(en.document.persons.issuerLink).toBe("The notary office is changed on „Document identification”.");
    expect(ro.shared.document.issuerLink).toBe(ro.document.persons.issuerLink);
  });
});

describe("the migration (Ask firsts 2, 3 and 5)", () => {
  const sql = read("src", "db", "migration_126_notary_link_from_issuer.sql");
  it("adds the mark, the three roles and the backfill — inserts only", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS from_issuer boolean NOT NULL DEFAULT false");
    expect(sql).toMatch(/d\.key IN \('ACT_ADITIONAL', 'ACT_DONATIE', 'TESTAMENT'\)/);
    expect(sql).toMatch(/t\.key IN \('ACT_ADITIONAL', 'ACT_DONATIE', 'CERTIFICAT_MOSTENITOR', 'CONTRACT_VANZARE', 'TESTAMENT'\)/);
    expect(sql).not.toMatch(/\b(DELETE|UPDATE|DROP)\b/);
    const seed = read("src", "db", "sync-reference-data.sql");
    for (const t of ["Act Adițional", "Act de Donație", "Testament"]) expect(seed).toMatch(new RegExp(`\\('${t}',\\s+'Notar'\\)`));
  });
});
