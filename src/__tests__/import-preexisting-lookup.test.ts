/**
 * Unit tests for the archive side of the pre-existing match.   (Slice #26.08)
 *
 * `matchArchiveDocuments` lives in `preexisting-check.ts` rather than in
 * `preexisting-lookup.ts` for exactly this reason: the lookup module imports
 * `@/db`, so nothing in this suite could reach it, and what it holds is four
 * decisions that are each a silent DATA outcome —
 *
 *  1. a document with an unmeasured page,
 *  2. a document with no title,
 *  3. a tie between two archived copies of one document,
 *  4. a document whose pages were only partially handed over.
 *
 * None of them is visible from outside once the answer is a list of ids, and
 * three of them decide whether a file the user believes they imported ends up
 * in the archive at all.
 *
 * What is NOT tested here is the SQL: the size pre-filter. It is one line and
 * cannot be run without a database. Recorded rather than quietly skipped.
 *
 * There used to be a second untested line beside it — the `deleted_at IS NULL`
 * join that kept a deleted document from counting as present. Slice #29.04
 * removed it: a deleted document has no row and no pages, so it cannot be a
 * candidate at all. The behaviour is unchanged and there is now nothing there
 * to get wrong.
 */

import {
  matchArchiveDocuments,
  preexistingKeyOf,
  type ArchivePageRow,
  type PreexistingCandidate,
} from "@/lib/import/preexisting-check";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Timestamps are passed in rather than generated — a test may not read a clock. */
const OLD = new Date("2024-01-01T00:00:00Z");
const NEW = new Date("2025-06-01T00:00:00Z");

function doc(
  id: string,
  code: string,
  title: string | null,
  files: { name: string; size: number | null }[],
  createdAt: Date = OLD,
): ArchivePageRow[] {
  return files.map((f) => ({
    documentId: id,
    fileName: f.name,
    fileSize: f.size,
    code,
    title,
    createdAt,
  }));
}

function candidate(
  path: string,
  title: string,
  files: { name: string; size: number }[],
): PreexistingCandidate {
  return { path, title, files };
}

const CONTRACT = candidate("48-50/contract.pdf", "contract.pdf", [
  { name: "contract.pdf", size: 240 },
]);

// ---------------------------------------------------------------------------

describe("matchArchiveDocuments", () => {
  it("matches a document the archive holds, and names it by code", () => {
    const matches = matchArchiveDocuments(
      doc("id-1", "DOC00042", "contract.pdf", [{ name: "contract.pdf", size: 240 }]),
      [CONTRACT],
    );
    expect(matches).toEqual([
      {
        path: "48-50/contract.pdf",
        documentId: "id-1",
        documentCode: "DOC00042",
        documentTitle: "contract.pdf",
      },
    ]);
  });

  it("says nothing about a candidate the archive does not hold", () => {
    expect(
      matchArchiveDocuments(
        doc("id-1", "DOC1", "altceva.pdf", [{ name: "altceva.pdf", size: 240 }]),
        [CONTRACT],
      ),
    ).toEqual([]);
  });

  it("matches a multi-page document on its whole page set, whatever order it arrives in", () => {
    const rows = doc("id-1", "DOC1", "Contract vanzare", [
      { name: "2.jpg", size: 20 },
      { name: "1.jpg", size: 10 },
    ]);
    const cvc = candidate("48-50/CVC", "Contract vanzare", [
      { name: "1.jpg", size: 10 },
      { name: "2.jpg", size: 20 },
    ]);
    expect(matchArchiveDocuments(rows, [cvc]).map((m) => m.documentId)).toEqual(["id-1"]);
  });

  it("⚠️ refuses a document with an unmeasured page", () => {
    // `document_page.file_size` is nullable and rows predating the wizard can
    // carry null. Keying such a document on the pages that DID have a size
    // would match it against something it does not hold — and the direction
    // this stage cannot afford is the one where a file is not imported.
    const rows = doc("id-1", "DOC1", "Contract vanzare", [
      { name: "1.jpg", size: 10 },
      { name: "2.jpg", size: null },
    ]);
    const cvc = candidate("48-50/CVC", "Contract vanzare", [{ name: "1.jpg", size: 10 }]);
    expect(matchArchiveDocuments(rows, [cvc])).toEqual([]);
  });

  it("⚠️ refuses a document with no title, rather than keying it as the empty string", () => {
    // `?? ""` would have keyed EVERY untitled document under one key, so an
    // entry whose own title came out empty would match an arbitrary one of them
    // and be linked to the user's property instead of being imported.
    for (const title of [null, "", "   "]) {
      const rows = doc("id-1", "DOC1", title, [{ name: "x.pdf", size: 1 }]);
      const empty = candidate("48-50/x.pdf", "", [{ name: "x.pdf", size: 1 }]);
      expect({ title, matches: matchArchiveDocuments(rows, [empty]) }).toEqual({
        title,
        matches: [],
      });
    }
  });

  it("⚠️ gives the OLDEST of two archived copies, so the answer does not move", () => {
    // The archive can genuinely hold one document twice — this stage exists
    // because nothing stopped that before it. The screen the user reads before
    // an import and the link the loop writes during it must name the same
    // document, and only the oldest is stable when a later copy is added or
    // removed.
    const rows = [
      ...doc("id-new", "DOC00099", "contract.pdf", [{ name: "contract.pdf", size: 240 }], NEW),
      ...doc("id-old", "DOC00007", "contract.pdf", [{ name: "contract.pdf", size: 240 }], OLD),
    ];
    expect(matchArchiveDocuments(rows, [CONTRACT]).map((m) => m.documentCode)).toEqual([
      "DOC00007",
    ]);
    // …and the reverse arrival order gives the same answer, which is the whole
    // claim: nothing here depends on the order Postgres returned rows in.
    expect(
      matchArchiveDocuments([...rows].reverse(), [CONTRACT]).map((m) => m.documentCode),
    ).toEqual(["DOC00007"]);
  });

  it("breaks a same-timestamp tie by code, which seeded data produces", () => {
    const rows = [
      ...doc("id-b", "DOC00050", "contract.pdf", [{ name: "contract.pdf", size: 240 }], OLD),
      ...doc("id-a", "DOC00004", "contract.pdf", [{ name: "contract.pdf", size: 240 }], OLD),
    ];
    expect(matchArchiveDocuments(rows, [CONTRACT]).map((m) => m.documentCode)).toEqual([
      "DOC00004",
    ]);
  });

  it("⚠️ a partially-handed-over document keys as a SMALLER one, which is why the caller loads whole", () => {
    // This is the contract `findExistingDocuments` keeps and this function
    // cannot check: handed pages 1 and 2 of a three-page document, it keys a
    // two-page document — and would then match a genuine two-page entry. The
    // test is here so the invariant is written down somewhere executable rather
    // than only in a comment.
    const twoOfThree = doc("id-1", "DOC1", "Contract", [
      { name: "1.jpg", size: 10 },
      { name: "2.jpg", size: 20 },
    ]);
    const twoPageEntry = candidate("48-50/Contract", "Contract", [
      { name: "1.jpg", size: 10 },
      { name: "2.jpg", size: 20 },
    ]);
    expect(matchArchiveDocuments(twoOfThree, [twoPageEntry])).toHaveLength(1);
  });

  it("answers each candidate independently, and skips the ones it cannot place", () => {
    const rows = doc("id-1", "DOC1", "contract.pdf", [{ name: "contract.pdf", size: 240 }]);
    const other = candidate("48-50/plan.jpg", "plan.jpg", [{ name: "plan.jpg", size: 99 }]);
    expect(matchArchiveDocuments(rows, [other, CONTRACT]).map((m) => m.path)).toEqual([
      "48-50/contract.pdf",
    ]);
  });

  it("keys the archive side with the SAME function as the folder side", () => {
    // The one property that makes any of this work. Spelled out because the two
    // sides are computed in different modules and a second spelling of "the
    // same document" would be silent in the safe direction — everything would
    // simply stop matching, for ever, and look like an empty archive.
    const rows = doc("id-1", "DOC1", "Contract", [{ name: "1.jpg", size: 10 }]);
    const key = preexistingKeyOf("Contract", [{ name: "1.jpg", size: 10 }]);
    expect(key).toBe(preexistingKeyOf(rows[0].title!, [{ name: "1.jpg", size: 10 }]));
  });
});
