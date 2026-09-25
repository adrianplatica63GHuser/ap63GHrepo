/**
 * @jest-environment node
 */

/**
 * Slice #36.22 — the import reconciliation check (`src/lib/import/reconcile.ts`).
 *
 * Pinned here: that the expectations come from the wizard's own walk and
 * grouping (a dropped `desktop.ini` is "set aside" with the walk's reason, a
 * page folder's files are pages 1..n in the walk's numeric order, `comune` and
 * `flotante` are their own buckets, the coordinate file is the group's), that
 * a file is found by name and size and then kept apart from the archive's
 * older copies by the title and the tags, that two qualifying pages are called
 * ambiguous instead of guessed, and that the query can only read.
 */

import {
  folderNameToTitleHint,
  type FSDirectoryHandle,
  type FSFileHandle,
} from "@/lib/import/folder-utils";
import {
  buildArchiveQuery,
  normaliseTag,
  planSourceFolder,
  reconcile,
  summaryLine,
  type ArchivePage,
  type PageExpectation,
  type SourcePlan,
} from "@/lib/import/reconcile";

type Tree = { [name: string]: number | Tree };

function dir(name: string, tree: Tree): FSDirectoryHandle {
  return {
    kind: "directory",
    name,
    values: async function* () {
      for (const [n, v] of Object.entries(tree)) {
        if (typeof v === "number") {
          const f: FSFileHandle = { kind: "file", name: n, getFile: async () => ({ name: n, size: v }) as unknown as File };
          yield f;
        } else {
          yield dir(n, v);
        }
      }
    },
  };
}

const ROOT = "10.big.tc.marker";
const PROP = "40-212per40IE55818-Sud Test TC-X";
const GROUP = "CVC Test TC-X";

const tree: Tree = {
  [PROP]: {
    "Act TC-X.jpg": 100,
    "coord 40-212 lot TC-X.txt": 50,
    "desktop.ini": 10,
    [GROUP]: { "3.jpg": 30, "1.jpg": 10, "2.jpg": 20 },
  },
  comune: { "Plan TC-X.jpg": 200 },
  flotante: { "Harta TC-X.jpg": 300 },
};

async function plan(): Promise<SourcePlan> {
  return planSourceFolder(dir(ROOT, tree));
}

function pageOf(p: SourcePlan, path: string): PageExpectation {
  const e = p.expectations.find((x) => x.kind === "page" && x.file.path === path);
  if (!e || e.kind !== "page") throw new Error(`no page expectation for ${path}`);
  return e;
}

/** The page the import would have written for an expectation. */
function landedPage(e: PageExpectation, over: Partial<ArchivePage> = {}): ArchivePage {
  return {
    documentId: `doc-${e.entryPath}`,
    code: `DOC-${e.entryPath}`,
    importTitle: e.title,
    title: "whatever the AI read",
    pageNumber: e.pageNumber,
    fileName: e.file.name,
    fileSize: e.file.size,
    tags: [...e.tags],
    properties: e.bucket === "flotante" ? [] : [{ code: "PROP00001", nickname: PROP }],
    cornerProperty: e.coordinateFor !== null ? "PROP00001" : null,
    ...over,
  };
}

function allLanded(p: SourcePlan): ArchivePage[] {
  return p.expectations.flatMap((e) => (e.kind === "page" ? [landedPage(e)] : []));
}

describe("the expectations come from the wizard's own walk", () => {
  it("sets aside what the walk drops, with the walk's reason and the file's size", async () => {
    const p = await plan();
    const ini = p.expectations.find((e) => e.kind === "set-aside");
    expect(ini).toEqual({
      kind: "set-aside",
      file: { path: `${PROP}/desktop.ini`, name: "desktop.ini", size: 10 },
      reason: "system-file",
    });
  });

  it("makes a page folder's files pages 1..n in the walk's numeric order, under one title", async () => {
    const p = await plan();
    const pages = ["1.jpg", "2.jpg", "3.jpg"].map((n) => pageOf(p, `${PROP}/${GROUP}/${n}`));
    expect(pages.map((e) => [e.pageNumber, e.pageCount, e.file.size])).toEqual([
      [1, 3, 10],
      [2, 3, 20],
      [3, 3, 30],
    ]);
    expect(new Set(pages.map((e) => e.title))).toEqual(new Set([folderNameToTitleHint(GROUP)]));
    expect(pages[0].entryKind).toBe("page-group");
  });

  it("writes the tags the wizard writes, lower-cased as addEntityTag stores them", async () => {
    const p = await plan();
    expect(pageOf(p, `${PROP}/${GROUP}/1.jpg`).tags).toEqual([ROOT, normaliseTag(PROP), normaliseTag(GROUP)]);
    expect(pageOf(p, `${PROP}/Act TC-X.jpg`).tags).toEqual([ROOT, normaliseTag(PROP)]);
  });

  it("files each entry in the wizard's bucket, and names the coordinate file's property", async () => {
    const p = await plan();
    expect(pageOf(p, `${PROP}/Act TC-X.jpg`)).toMatchObject({ bucket: "property", propertyFolder: PROP, coordinateFor: null });
    expect(pageOf(p, `${PROP}/coord 40-212 lot TC-X.txt`)).toMatchObject({ bucket: "property", coordinateFor: PROP });
    expect(pageOf(p, "comune/Plan TC-X.jpg")).toMatchObject({ bucket: "comune", propertyFolder: null });
    expect(pageOf(p, "flotante/Harta TC-X.jpg")).toMatchObject({ bucket: "flotante", propertyFolder: null });
  });

  it("uses the file name as a single file's title", async () => {
    const p = await plan();
    expect(pageOf(p, "comune/Plan TC-X.jpg").title).toBe("Plan TC-X.jpg");
  });
});

describe("the verdict", () => {
  it("everything landed: exit 0, every file accounted for", async () => {
    const p = await plan();
    const r = reconcile(p, allLanded(p));
    expect(r.counts).toMatchObject({ landed: 7, "set-aside": 1, missing: 0, ambiguous: 0, "in-archive": 0 });
    expect(r.exitCode).toBe(0);
    expect(r.extras).toEqual([]);
    const coord = r.verdicts.find((v) => v.status === "landed" && v.expectation.coordinateFor !== null);
    expect(coord && coord.status === "landed" && coord.notes).toEqual(["the coordinate file: corners read into PROP00001"]);
  });

  it("a page that is not there is MISSING, and with the rest landed that is exit 1", async () => {
    const p = await plan();
    const pages = allLanded(p).filter((x) => x.fileName !== "2.jpg");
    const r = reconcile(p, pages);
    expect(r.counts.missing).toBe(1);
    expect(r.exitCode).toBe(1);
    expect(summaryLine(r)).toContain("1 missing");
  });

  it("after cleanup nothing is there: all missing, exit 0, and the summary says so", async () => {
    const p = await plan();
    const r = reconcile(p, []);
    expect(r.counts.landed).toBe(0);
    expect(r.exitCode).toBe(0);
    expect(summaryLine(r)).toContain("nothing from this folder is in the database");
  });

  it("the same file in an older document with another title is IN ARCHIVE, not landed", async () => {
    const p = await plan();
    const e = pageOf(p, `${PROP}/Act TC-X.jpg`);
    const older = landedPage(e, { documentId: "old", code: "DOC-OLD", importTitle: "Act.jpg", tags: [] });
    const r = reconcile(p, [older]);
    const v = r.verdicts.find((x) => x.status !== "set-aside" && x.expectation.kind === "page" && x.expectation.file.path === e.file.path);
    expect(v?.status).toBe("in-archive");
  });

  it("the title and the tags keep an import apart from an earlier run of the same folder", async () => {
    const p = await plan();
    const e = pageOf(p, `${PROP}/Act TC-X.jpg`);
    const earlierUntagged = landedPage(e, { documentId: "earlier", code: "DOC-EARLIER", tags: [] });
    const r = reconcile(p, [...allLanded(p), earlierUntagged]);
    const v = r.verdicts.find((x) => x.status === "landed" && x.expectation.file.path === e.file.path);
    expect(v && v.status === "landed" && v.page.code).toBe(`DOC-${e.entryPath}`);
  });

  it("two pages that both qualify are AMBIGUOUS — the check does not guess", async () => {
    const p = await plan();
    const e = pageOf(p, `${PROP}/Act TC-X.jpg`);
    const twin = landedPage(e, { documentId: "twin", code: "DOC-TWIN" });
    const r = reconcile(p, [...allLanded(p), twin]);
    expect(r.counts.ambiguous).toBe(1);
  });

  it("a declined tag dialog still lands the one titled document, with a note", async () => {
    const p = await plan();
    const pages = allLanded(p).map((x) => ({ ...x, tags: [] }));
    const r = reconcile(p, pages);
    expect(r.counts.landed).toBe(7);
    const v = r.verdicts.find((x) => x.status === "landed");
    expect(v && v.status === "landed" && v.notes[0]).toMatch(/none of this folder's tags/);
  });

  it("a document from before import_title existed lands on its tags, with a note", async () => {
    const p = await plan();
    const pages = allLanded(p).map((x) => ({ ...x, importTitle: null }));
    const r = reconcile(p, pages);
    expect(r.counts.landed).toBe(7);
    const v = r.verdicts.find((x) => x.status === "landed");
    expect(v && v.status === "landed" && v.notes[0]).toMatch(/no recorded import title/);
  });

  it("one document with the title and another with the tags are AMBIGUOUS, not a pick", async () => {
    const p = await plan();
    const e = pageOf(p, "comune/Plan TC-X.jpg");
    const titledOnly = landedPage(e, { documentId: "t", code: "DOC-T", tags: [] });
    const taggedOnly = landedPage(e, { documentId: "g", code: "DOC-G", importTitle: null });
    const r = reconcile(p, [titledOnly, taggedOnly]);
    const v = r.verdicts.find((x) => x.status !== "set-aside" && x.status !== "not-read" && x.expectation.file.path === e.file.path);
    expect(v?.status).toBe("ambiguous");
  });

  it("a page stored out of order, and a page folder split over two documents, are noted", async () => {
    const p = await plan();
    const pages = allLanded(p).map((x) =>
      x.fileName === "3.jpg" ? { ...x, documentId: "split", code: "DOC-SPLIT", pageNumber: 1 } : x,
    );
    const r = reconcile(p, pages);
    const three = r.verdicts.find((x) => x.status === "landed" && x.expectation.file.name === "3.jpg");
    expect(three && three.status === "landed" && three.notes.join(" | ")).toMatch(/stored as page 1, expected page 3.*2 documents/);
  });

  it("a page of a document tagged with this folder that no file accounts for is EXTRA", async () => {
    const p = await plan();
    const stray: ArchivePage = {
      ...allLanded(p)[0],
      documentId: "stray",
      code: "DOC-STRAY",
      fileName: "gone.jpg",
      fileSize: 999,
      importTitle: "gone.jpg",
    };
    const r = reconcile(p, [...allLanded(p), stray]);
    expect(r.extras.map((x) => x.code)).toEqual(["DOC-STRAY"]);
  });

  it("a floating document linked to a property is noted", async () => {
    const p = await plan();
    const pages = allLanded(p).map((x) =>
      x.fileName === "Harta TC-X.jpg" ? { ...x, properties: [{ code: "PROP00009", nickname: "x" }] } : x,
    );
    const r = reconcile(p, pages);
    const v = r.verdicts.find((x) => x.status === "landed" && x.expectation.bucket === "flotante");
    expect(v && v.status === "landed" && v.notes).toEqual(["a floating document linked to PROP00009"]);
  });
});

describe("the query can only read", () => {
  const sql = buildArchiveQuery([30, 10, 10, 20], "O'Brien Folder");

  it("is one SELECT with no writing keyword anywhere", () => {
    expect(sql).toMatch(/^WITH candidate AS \(/);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO|SET|LOCK|VACUUM)\b/i);
    expect(sql.split(";").filter((s) => s.trim() !== "").length).toBe(1);
  });

  it("escapes the folder tag and dedupes the sizes", () => {
    expect(sql).toContain("'o''brien folder'");
    expect(sql).toContain("p.file_size IN (10, 20, 30)");
  });

  it("asks for no sizes when there are none, rather than writing an empty IN ()", () => {
    expect(buildArchiveQuery([], "x")).toContain("WHERE false");
  });
});
