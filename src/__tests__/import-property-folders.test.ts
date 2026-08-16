/**
 * The chosen folder, split into the properties it holds.   (Slice #26.07)
 *
 * Two claims are pinned here, and the second is the one that would fail
 * silently:
 *
 *  1. every entry lands in exactly one bucket, including the ones the
 *     structure rules forbid — a grouping that dropped an entry would make a
 *     file vanish between the count on the Evaluation screen and the rows in
 *     the result, with nothing on either screen to explain it;
 *  2. `common` links to every property and `floating` to none. Those are two
 *     sentences from the source document, and both are the kind of rule that
 *     looks obviously right in a diff and is obviously wrong in the database.
 */

import {
  assignEntryProperties,
  groupByPropertyFolder,
} from "@/lib/import/property-folders";
import type { FSEntry, FSFileEntry, FSPageGroupEntry } from "@/lib/import/folder-utils";
import { propertyIdentityOf } from "@/lib/import/structure-rules";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A plain file at `path`. The handle is never touched by anything here. */
function file(path: string): FSFileEntry {
  const parts = path.split("/");
  return {
    kind: "file",
    name: parts[parts.length - 1],
    path,
    pathParts: parts.slice(0, -1),
    handle: { name: parts[parts.length - 1] } as FSFileEntry["handle"],
  };
}

/** A page group AT `path` — its own folder is the last segment of pathParts. */
function pageGroup(path: string): FSPageGroupEntry {
  const parts = path.split("/");
  return {
    kind: "page-group",
    name: parts[parts.length - 1],
    path,
    pathParts: parts,
    handles: [],
    titleHint: parts[parts.length - 1],
  };
}

// ⚠️ The description is attached with a second dash since Slice #28.02.
// Spelled `…||Prisecaru`, this folder is no longer a property with a
// description — it is the parcela `225per3per24||Prisecaru`, and the fixture
// would quietly stop meaning what its name says.
const PROP_A = "47per2-225per3per24-Prisecaru";
const PROP_B = "48-50D";

// ---------------------------------------------------------------------------
// groupByPropertyFolder
// ---------------------------------------------------------------------------

describe("groupByPropertyFolder", () => {
  it("reads the property folder off the FIRST path segment and nothing else", () => {
    const grouping = groupByPropertyFolder([
      file(`${PROP_A}/contract.pdf`),
      pageGroup(`${PROP_A}/CVC`),
      file(`${PROP_B}/act.pdf`),
    ]);

    expect(grouping.properties.map((p) => p.folderName)).toEqual([PROP_A, PROP_B]);
    expect(grouping.properties[0].entries.map((e) => e.path)).toEqual([
      `${PROP_A}/contract.pdf`,
      `${PROP_A}/CVC`,
    ]);
  });

  it("carries the identifiers AS WRITTEN, leaving perToSlash to the DB boundary", () => {
    const [group] = groupByPropertyFolder([file(`${PROP_A}/x.pdf`)]).properties;
    expect(group.tarlaSola).toBe("47per2");
    expect(group.parcela).toBe("225per3per24");
    expect(group.description).toBe("Prisecaru");
  });

  it("gives two spellings of one parcel the same identity", () => {
    const a = groupByPropertyFolder([file("47per2-225per3/x.pdf")]).properties[0];
    const b = groupByPropertyFolder([file("47PER2-225PER3/x.pdf")]).properties[0];
    expect(a.identity).toBe(b.identity);
    expect(a.identity).not.toBe("");
  });

  it("takes the coordinate file by the DECLARED convention, not by extension", () => {
    // STR-08's definition. A `.txt` of business notes is not a candidate here,
    // which is the whole difference from the old extension shortlist.
    const grouping = groupByPropertyFolder([
      file(`${PROP_B}/coord 48-50D.txt`),
      file(`${PROP_B}/note despre vecini.txt`),
    ]);
    expect(grouping.properties[0].coordinateFile?.name).toBe("coord 48-50D.txt");
    expect(grouping.properties[0].declaredCoordinateFiles).toHaveLength(1);
  });

  it("has no coordinate file when the folder declares none", () => {
    const grouping = groupByPropertyFolder([file(`${PROP_B}/note.txt`)]);
    expect(grouping.properties[0].coordinateFile).toBeNull();
    expect(grouping.properties[0].declaredCoordinateFiles).toEqual([]);
  });

  it("reports a second declared coordinate file rather than quietly taking the first", () => {
    // STR-08 blocks this folder, so no import reaches here holding it — but a
    // grouping that silently took one of the two would make the rule's failure
    // invisible if the ordering of the two stages ever changed.
    const grouping = groupByPropertyFolder([
      file(`${PROP_B}/coord a.txt`),
      file(`${PROP_B}/coord b.txt`),
    ]);
    expect(grouping.properties[0].declaredCoordinateFiles.map((f) => f.name)).toEqual([
      "coord a.txt",
      "coord b.txt",
    ]);
    expect(grouping.properties[0].coordinateFile?.name).toBe("coord a.txt");
  });

  it("never treats a page group as a coordinate file", () => {
    // ⚠️ The folder name carries `.txt`, which is legal on Windows and is what
    // makes this reach the guard. An earlier fixture used `coord scans`, whose
    // name fails `isDeclaredCoordinateFile` on the extension alone — so the
    // test passed with the `entry.kind === "file"` guard deleted, which is the
    // definition of a test that pins nothing.
    const grouping = groupByPropertyFolder([pageGroup(`${PROP_B}/coord scans.txt`)]);
    expect(grouping.properties[0].coordinateFile).toBeNull();
    expect(grouping.properties[0].declaredCoordinateFiles).toEqual([]);
  });

  it("splits common and floating out, exactly spelled", () => {
    const grouping = groupByPropertyFolder([
      file("common/imputernicire.pdf"),
      file("floating/ci vecin.jpg"),
    ]);
    expect(grouping.common.map((e) => e.path)).toEqual(["common/imputernicire.pdf"]);
    expect(grouping.floating.map((e) => e.path)).toEqual(["floating/ci vecin.jpg"]);
    expect(grouping.properties).toEqual([]);
  });

  it("does not accept a misspelled shared folder as a shared folder", () => {
    // STR-05 catches `Common` and says what to rename it to. Accepting it here
    // would silently link a folder of documents to every property in the run.
    const grouping = groupByPropertyFolder([file("Common/x.pdf")]);
    expect(grouping.common).toEqual([]);
    expect(grouping.unassigned.map((e) => e.path)).toEqual(["Common/x.pdf"]);
  });

  it("keeps a loose file, and keeps it linked to nothing", () => {
    // STR-01's case. It is carried rather than dropped so the file cannot
    // vanish between two screens that both claim to count it.
    const grouping = groupByPropertyFolder([file("scan.jpg")]);
    expect(grouping.unassigned.map((e) => e.path)).toEqual(["scan.jpg"]);
  });

  it("keeps a folder whose name does not parse at all", () => {
    // ⚠️ Slice #28.02 changed this test's example, and the change is the whole
    // slice. `2024-Arhiva` used to land here — the grammar refused it — and now
    // parses as tarla 2024 / parcela Arhiva, so it is grouped as a property like
    // any other. What stops it becoming a Property is STR-15, a question the
    // Structure stage asks and BLOCKS on, several stages upstream of this
    // module; see this file's own note on `2024-Arhiva` below.
    //
    // `Documente vechi` has no dash and so still does not parse, which is now
    // the only ordinary way to reach `unassigned` from a named folder.
    const grouping = groupByPropertyFolder([file("Documente vechi/x.pdf")]);
    expect(grouping.properties).toEqual([]);
    expect(grouping.unassigned.map((e) => e.path)).toEqual(["Documente vechi/x.pdf"]);
  });

  it("⚠️ groups `2024-Arhiva` as a property, because STR-15 is what refuses it", () => {
    // Recorded as its own test rather than left implicit, because it looks like
    // a regression of Slice #23.00's whole point. It is not: the refusal moved
    // from the parser to a question the user answers, and a folder that reaches
    // here has already been through the Structure stage's block. This module
    // stays deliberately ignorant of the answer — see its header.
    const grouping = groupByPropertyFolder([file("2024-Arhiva/x.pdf")]);
    expect(grouping.properties.map((p) => p.folderName)).toEqual(["2024-Arhiva"]);
    expect(grouping.properties[0].tarlaSola).toBe("2024");
    expect(grouping.properties[0].parcela).toBe("Arhiva");
    expect(grouping.unassigned).toEqual([]);
  });

  it("loses nothing: every entry is in exactly one bucket", () => {
    const entries: FSEntry[] = [
      file(`${PROP_A}/a.pdf`),
      pageGroup(`${PROP_A}/CVC`),
      file(`${PROP_B}/coord 48-50D.txt`),
      file("common/c.pdf"),
      file("floating/f.pdf"),
      file("loose.pdf"),
      file("Documente vechi/weird.pdf"),
    ];
    const g = groupByPropertyFolder(entries);
    const seen = [
      ...g.properties.flatMap((p) => p.entries),
      ...g.common,
      ...g.floating,
      ...g.unassigned,
    ].map((e) => e.path);

    expect(seen.sort()).toEqual(entries.map((e) => e.path).sort());
    expect(new Set(seen).size).toBe(entries.length);
  });

  it("⚠️ gives a property subfolder with no importable file its own group", () => {
    // Entries alone cannot see it — a folder holding only `Thumbs.db`, or
    // nothing at all, produces none. STR-02 counts it from the directory
    // listing, so without this the Structure stage says two properties and the
    // property step shows one, with no mention of the other anywhere.
    const grouping = groupByPropertyFolder([file(`${PROP_A}/a.pdf`)], [PROP_A, PROP_B, "common"]);
    expect(grouping.properties.map((p) => p.folderName)).toEqual([PROP_A, PROP_B]);
    expect(grouping.properties[1].entries).toEqual([]);
    expect(grouping.properties[1].tarlaSola).toBe("48");
    expect(grouping.properties[1].coordinateFile).toBeNull();
  });

  it("⚠️ gives every group a real identity — never the empty-string narrowing", () => {
    // `emptyGroup` writes `propertyIdentityOf(folderName) ?? ""` and its
    // comment claims the fallback is "pinned by a test". It was not: nothing
    // read `identity` on a seeded group, so `?? "x"` — or `?? ""` firing for
    // real — left the suite green while every unparseable folder collapsed
    // into one group.
    const grouping = groupByPropertyFolder([], [PROP_A, PROP_B]);
    for (const group of grouping.properties) {
      expect(group.identity).not.toBe("");
      expect(group.identity).toBe(propertyIdentityOf(group.folderName));
    }
    expect(grouping.properties[0].identity).not.toBe(grouping.properties[1].identity);
  });

  it("does not seed a group twice when the listing and the entries agree", () => {
    const grouping = groupByPropertyFolder([file(`${PROP_B}/b.pdf`)], [PROP_B]);
    expect(grouping.properties).toHaveLength(1);
    expect(grouping.properties[0].entries.map((e) => e.path)).toEqual([`${PROP_B}/b.pdf`]);
  });

  it("⚠️ sorts the property folders, whatever order the filesystem enumerated in", () => {
    // `dirNames` is built BEFORE walkFolder sorts its children, so seeding from
    // it verbatim made the whole property order — the cards, the write order,
    // the wizard's chips — filesystem-enumeration order. On a FAT-formatted
    // USB stick that is directory-creation order, which matches neither File
    // Explorer nor the sorted list the Structure stage showed a moment earlier.
    const grouping = groupByPropertyFolder(
      [file("9-3/x.pdf")],
      ["9-3", "common", "48-50D", "10-2"],
    );
    // `sortedForDisplay` — "the order every stage lists names and paths in" —
    // which is numeric-aware, so tarla 9 comes before tarla 10 rather than
    // after it. That is the order the Structure stage listed these folders in a
    // moment earlier, and matching it is the whole point of using that helper
    // rather than a bare `localeCompare` here.
    expect(grouping.properties.map((p) => p.folderName)).toEqual(["9-3", "10-2", "48-50D"]);
  });

  it("does not seed a group for a listed folder that does not parse", () => {
    // `Common` is a near miss (STR-05) and `Documente vechi` has no dash
    // (STR-04); neither is a property. `2024-Arhiva` is deliberately NOT in this
    // list any more — since #28.02 it parses, and seeding it is correct.
    const grouping = groupByPropertyFolder(
      [],
      ["Documente vechi", "common", "floating", "Common"],
    );
    expect(grouping.properties).toEqual([]);
  });

  it("answers an empty grouping for an empty folder rather than throwing", () => {
    const g = groupByPropertyFolder([]);
    expect(g).toEqual({ properties: [], common: [], floating: [], unassigned: [] });
  });
});

// ---------------------------------------------------------------------------
// assignEntryProperties
// ---------------------------------------------------------------------------

describe("assignEntryProperties", () => {
  const entries: FSEntry[] = [
    file(`${PROP_A}/a.pdf`),
    file(`${PROP_B}/b.pdf`),
    file("common/c.pdf"),
    file("floating/f.pdf"),
    file("loose.pdf"),
  ];
  const grouping = groupByPropertyFolder(entries);
  const resolved = new Map([
    [PROP_A, "id-a"],
    [PROP_B, "id-b"],
  ]);

  it("links a property folder's entry to its own Property and no other", () => {
    const map = assignEntryProperties(grouping, resolved);
    expect(map.get(`${PROP_A}/a.pdf`)).toEqual({ bucket: "property", propertyIds: ["id-a"] });
    expect(map.get(`${PROP_B}/b.pdf`)).toEqual({ bucket: "property", propertyIds: ["id-b"] });
  });

  it("links a common document to every property in the run", () => {
    expect(assignEntryProperties(grouping, resolved).get("common/c.pdf")).toEqual({
      bucket: "common",
      propertyIds: ["id-a", "id-b"],
    });
  });

  it("links a floating document to nothing", () => {
    expect(assignEntryProperties(grouping, resolved).get("floating/f.pdf")).toEqual({
      bucket: "floating",
      propertyIds: [],
    });
  });

  it("links a forbidden entry to nothing", () => {
    expect(assignEntryProperties(grouping, resolved).get("loose.pdf")).toEqual({
      bucket: "unassigned",
      propertyIds: [],
    });
  });

  it("⚠️ marks a common document as common even when the run has ONE property", () => {
    // The commonest shape of all: one property subfolder plus `common`. The
    // list length is 1 there, which is exactly why the import loop must not
    // read the length — a `common` document offered the coordinate row action
    // can have its single property's corners REPLACED from a file the property
    // step refused to treat as a corner source.
    const single = new Map([[PROP_A, "id-a"]]);
    const map = assignEntryProperties(grouping, single);
    expect(map.get("common/c.pdf")).toEqual({ bucket: "common", propertyIds: ["id-a"] });
    expect(map.get(`${PROP_A}/a.pdf`)).toEqual({ bucket: "property", propertyIds: ["id-a"] });
  });

  it("⚠️ never names one Property twice for a common document", () => {
    // Two subfolders naming one parcel resolve to one id. STR-03 refuses that
    // folder, but a duplicated id here would associate one document to one
    // Property twice, on a rule that should be right on its own terms.
    const twoFolders = groupByPropertyFolder([
      file("48-50D/a.pdf"),
      file("48-50D-Livada/b.pdf"),
      file("common/c.pdf"),
    ]);
    const oneProperty = new Map([
      ["48-50D", "id-x"],
      ["48-50D-Livada", "id-x"],
    ]);
    expect(assignEntryProperties(twoFolders, oneProperty).get("common/c.pdf")).toEqual({
      bucket: "common",
      propertyIds: ["id-x"],
    });
  });

  it("gives every entry a key, so `undefined` can only mean a mismatched map", () => {
    const map = assignEntryProperties(grouping, resolved);
    for (const entry of entries) {
      expect(map.has(entry.path)).toBe(true);
    }
    expect(map.size).toBe(entries.length);
  });

  it("links nothing for a folder whose Property was never resolved", () => {
    // The property step can be cancelled halfway. A document linked to nothing
    // is the honest outcome; a crash inside a loop that has written rows is not.
    const partial = new Map([[PROP_A, "id-a"]]);
    const map = assignEntryProperties(grouping, partial);
    expect(map.get(`${PROP_B}/b.pdf`)).toEqual({ bucket: "property", propertyIds: [] });
    // …and `common` follows the properties that DID resolve, not the folders.
    expect(map.get("common/c.pdf")).toEqual({ bucket: "common", propertyIds: ["id-a"] });
  });

  it("links a common document to nothing when the run resolved no properties", () => {
    const map = assignEntryProperties(grouping, new Map());
    expect(map.get("common/c.pdf")).toEqual({ bucket: "common", propertyIds: [] });
  });
});
