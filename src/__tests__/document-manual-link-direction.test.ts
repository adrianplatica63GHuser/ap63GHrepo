/**
 * A reference made by hand reads the way the user chose it, from both
 * documents, whichever way their uuids sort.                    (Slice #36.19)
 *
 * ⚠️ **BOTH SORT ORDERS, ALWAYS.** The defect this pins (FU-001, TC-ASSOC-07's
 * red first run in #36.08) was invisible on half the pairs: the manual path
 * stored the column default, `role_reads_a_to_b = true`, so the role read from
 * whichever uuid sorted first, and a pair whose viewed document happened to
 * sort first came out right. A test with one pair proves nothing; every
 * assertion below runs once with the viewed document on side A and once on B.
 */

import {
  linkDirection,
  manualLinkDirection,
  roleReadsFromDocument,
} from "@/lib/documents/referenced-instruments";
import { readFileSync } from "fs";
import { join } from "path";

const LOW  = "10000000-0000-4000-8000-000000000000";
const HIGH = "f0000000-0000-4000-8000-000000000000";

// [label, the document whose screen the link is made on, the one ticked]
const ORDERS: [string, string, string][] = [
  ["the viewed document sorts first", LOW, HIGH],
  ["the viewed document sorts second", HIGH, LOW],
];

describe("manualLinkDirection — the role reads from the screen it was chosen on", () => {
  it.each(ORDERS)("%s: the pair is canonical, a < b", (_label, viewed, other) => {
    const row = manualLinkDirection(viewed, other);
    expect(row.documentIdA < row.documentIdB).toBe(true);
    expect([row.documentIdA, row.documentIdB].sort()).toEqual([viewed, other].sort());
  });

  it.each(ORDERS)("%s: read from the viewed document, the role reads forward", (_label, viewed, other) => {
    const row = manualLinkDirection(viewed, other);
    expect(roleReadsFromDocument(viewed, row.documentIdA, row.roleReadsAToB)).toBe(true);
  });

  it.each(ORDERS)("%s: read from the other document, it reads as the converse", (_label, viewed, other) => {
    const row = manualLinkDirection(viewed, other);
    expect(roleReadsFromDocument(other, row.documentIdA, row.roleReadsAToB)).toBe(false);
  });

  it("stores true only where the viewed document is side A — the column default was right on half the pairs", () => {
    expect(manualLinkDirection(LOW, HIGH).roleReadsAToB).toBe(true);
    expect(manualLinkDirection(HIGH, LOW).roleReadsAToB).toBe(false);
  });

  it("is per pair: one screen, several ticked documents on both sides of it, each reads from the screen", () => {
    const viewed = "80000000-0000-4000-8000-000000000000";
    for (const other of [LOW, HIGH, "20000000-0000-4000-8000-000000000000", "e0000000-0000-4000-8000-000000000000"]) {
      const row = manualLinkDirection(viewed, other);
      expect(roleReadsFromDocument(viewed, row.documentIdA, row.roleReadsAToB)).toBe(true);
      expect(roleReadsFromDocument(other, row.documentIdA, row.roleReadsAToB)).toBe(false);
    }
  });
});

describe("the linker's own direction still reads from the instrument's purpose", () => {
  it.each(ORDERS)("%s: „Titlu anterior al\" reads from the cited instrument", (_label, citing, cited) => {
    const row = linkDirection(citing, cited, "TITLE_CHAIN");
    expect(roleReadsFromDocument(cited, row.documentIdA, row.roleReadsAToB)).toBe(true);
    expect(roleReadsFromDocument(citing, row.documentIdA, row.roleReadsAToB)).toBe(false);
  });
});

describe("the write path uses it", () => {
  // Reads CODE, not comments: the function's header describes the old default
  // in the words a lazy guard would match.
  const queries = readFileSync(join(__dirname, "..", "lib", "documents", "queries.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("stores a direction on every manual row instead of the column default", () => {
    expect(queries).toMatch(/manualLinkDirection\(documentId, otherId\)/);
    expect(queries).toMatch(/roleReadsAToB:\s*roleReadsAToB \?\? manual\.roleReadsAToB/);
    expect(queries).not.toMatch(/roleReadsAToB === undefined \? \{\} :/);
  });

  it("reads through the same XNOR", () => {
    expect(queries).toMatch(/roleReadsFromDocument\(documentId, r\.documentIdA, r\.roleReadsAToB\)/);
  });
});
