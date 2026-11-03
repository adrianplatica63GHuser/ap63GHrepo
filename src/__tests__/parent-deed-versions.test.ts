/**
 * Slice 41.54 — linking or unlinking „Actul modificat" makes a new version of the act adițional.
 *
 * The read rule for an older version (`deedOfVersion`), and the wiring the database runs: the snapshot's block, the
 * equality that gives an old history no phantom version, both link writes in one transaction appending one version,
 * the routes passing the user, the counter refreshed at once, „Fă curentă" relinking.
 */
import { readFileSync } from "fs";
import { join } from "path";

import { deedOfVersion } from "@/lib/documents/parent-deed-versions";
import type { DocumentSnapshot } from "@/lib/documents/validation";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const snap = (parentDeed?: DocumentSnapshot["parentDeed"]) => ({ ...(parentDeed !== undefined ? { parentDeed } : {}) }) as DocumentSnapshot;
const v = (n: number, parentDeed?: DocumentSnapshot["parentDeed"]) => ({ versionNumber: n, snapshot: snap(parentDeed) });

describe("deedOfVersion — which deed a version amended (Ask first 3)", () => {
  it("Adrian's case: v0 from before 41.54, „Dezleagă” writes v1 { id: null, before: contract } — v0 reads the contract", () => {
    const history = [v(0), v(1, { id: null, before: "contract" })];
    expect(deedOfVersion(history, 0, null)).toBe("contract");
    expect(deedOfVersion(history, 1, null)).toBeNull();
  });

  it("a snapshot with the block says it; without one, the earliest later block's id when it has no `before`", () => {
    const history = [v(0), v(1), v(2, { id: "contract" }), v(3, { id: null })];
    expect(deedOfVersion(history, 0, null)).toBe("contract");
    expect(deedOfVersion(history, 1, null)).toBe("contract");
    expect(deedOfVersion(history, 2, null)).toBe("contract");
    expect(deedOfVersion(history, 3, null)).toBeNull();
  });

  it("no block anywhere: the link the act has now; an unknown version: the same", () => {
    expect(deedOfVersion([v(0), v(1)], 0, "now")).toBe("now");
    expect(deedOfVersion([v(0)], 7, "now")).toBe("now");
  });

  it("the order the versions come in does not matter", () => {
    expect(deedOfVersion([v(1, { id: null, before: "contract" }), v(0)], 0, null)).toBe("contract");
  });
});

describe("the wiring (Ask firsts 1, 2, 4 and 5)", () => {
  const Q = read("src", "lib", "documents", "queries.ts");
  const fn = (name: string) => Q.slice(Q.indexOf(`export async function ${name}`), Q.indexOf("\n}\n", Q.indexOf(`export async function ${name}`)));

  it("the snapshot carries the deed, read through tx, in buildSnapshots, create and update", () => {
    expect(read("src", "lib", "versioning", "snapshot-registry.ts")).toMatch(/"parentDeed",\n\] as const/);
    expect(Q).toContain("const deeds = await parentDeedIdsFor(tx, idList);");
    expect(Q).toContain("snapshotFromFull(row, identity, null)");
    expect(Q).toContain("(await parentDeedIdsFor(tx, [id])).get(id) ?? null");
  });

  it("an old snapshot without the block compares equal — a plain save over it appends none", () => {
    expect(Q).toMatch(/if \(k === "parentDeed"\) \{\s*if \(a\.parentDeed !== undefined && b\.parentDeed !== undefined && \(a\.parentDeed\.id \?\? null\) !== \(b\.parentDeed\.id \?\? null\)\) return false;/);
  });

  it("„Leagă” and „Dezleagă” run in one transaction and each appends one version, with `before` over an old history", () => {
    const assoc = fn("associateDocumentToDocument");
    const dis = fn("dissociateDocumentFromDocument");
    for (const f of [assoc, dis]) {
      expect(f).toContain("return await db.transaction(async (tx) => {");
      expect(f).toContain("await recordParentDeedChange(tx, ");
    }
    const rec = Q.slice(Q.indexOf("async function recordParentDeedChange"), Q.indexOf("\n}\n", Q.indexOf("async function recordParentDeedChange")));
    expect(rec).toContain('.limit(1).for("update")');
    expect(rec).toContain("await tx.update(document).set({ updatedBy })");
    expect(rec).toContain("snapshot.parentDeed = { id: deed, before }");
    expect(rec).toContain("versionNumber: (latest?.versionNumber ?? -1) + 1");
  });

  it("the routes pass the user; the panel refreshes the counter; „Fă curentă” relinks", () => {
    expect(read("src", "app", "api", "documents", "[id]", "references", "[refId]", "route.ts")).toContain("dissociateDocumentFromDocument(id, refId, await getCurrentUserEmail())");
    expect(read("src", "app", "api", "documents", "[id]", "references", "route.ts")).toContain("await getCurrentUserEmail(),");
    const panel = read("src", "app", "documents", "_components", "amended-deed-panel.tsx");
    expect(panel).toContain('queryClient.invalidateQueries({ queryKey: ["document-versions", documentId] })');
    const form = read("src", "app", "documents", "_components", "document-form.tsx");
    expect(form).toContain("await relinkParentDeed(documentId, relink.from, relink.to)");
    expect(form).toContain("deedOfVersion(versions, effectiveVersion, parentDeed?.id ?? null)");
  });
});
