/**
 * @jest-environment node
 *
 * Slice 41.45 — where „Vezi și" and a record's group or stamp open (src/lib/metadata/peer-href.ts).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { groupFromRecordHref, peerHref, stampFromRecordHref } from "@/lib/metadata/peer-href";

const back = (href: string) => `${href}?from=%2Fnatural-persons%2Fp1&fromLabel=%C3%8Enapoi`;

describe("peerHref (41.45)", () => {
  it("a natural person to /natural-persons, a juridical one to /judicial-persons — never /persons", () => {
    expect(peerHref("PERSON", "p2", "NATURAL")).toBe("/natural-persons/p2");
    expect(peerHref("PERSON", "c1", "JUDICIAL")).toBe("/judicial-persons/c1");
    expect(peerHref("PERSON", "p3", null)).toBe("/natural-persons/p3");
    expect(peerHref("PROPERTY", "x")).toBe("/properties/x");
    expect(peerHref("DOCUMENT", "d")).toBe("/documents/d");
  });

  it("the cross-reference list carries the person's kind, and the tile passes it", () => {
    const list = readFileSync(join(process.cwd(), "src", "lib", "metadata", "cross-ref.ts"), "utf8");
    expect(list.match(/peerPersonKind:\s+peerPer2?\.type,/g)).toHaveLength(2);
    const tab = readFileSync(join(process.cwd(), "src", "components", "entity-metadata-tab.tsx"), "utf8");
    expect(tab).toContain("peerHref(ref.peerType, ref.peerEntityId, ref.peerPersonKind)");
    expect(tab).not.toMatch(/`\/persons\//);
  });
});

describe("a record's group and stamp (41.45)", () => {
  it("open with only their identity tile, the back link kept", () => {
    expect(groupFromRecordHref("g1", back)).toBe("/admin/groups/g1?from=%2Fnatural-persons%2Fp1&fromLabel=%C3%8Enapoi&tiles=identity");
    expect(stampFromRecordHref("s1", back)).toBe("/admin/stamps/s1?from=%2Fnatural-persons%2Fp1&fromLabel=%C3%8Enapoi&tiles=description");
    const tab = readFileSync(join(process.cwd(), "src", "components", "entity-metadata-tab.tsx"), "utf8");
    expect(tab).toContain("href={groupFromRecordHref(g.id, withBack)}");
    expect(tab).toContain("href={stampFromRecordHref(s.id, withBack)}");
  });
});
