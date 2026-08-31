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
  titleForEntry,
  type ArchivePageRow,
  type PreexistingCandidate,
} from "@/lib/import/preexisting-check";
import type { FSEntry } from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Timestamps are passed in rather than generated — a test may not read a clock. */
const OLD = new Date("2024-01-01T00:00:00Z");
const NEW = new Date("2025-06-01T00:00:00Z");

/**
 * `importTitle` defaults to null on purpose: that is every document in the
 * archive before Slice #32.06, and every test below that does not pass one is
 * asserting the fallback still holds for them.
 */
function doc(
  id: string,
  code: string,
  title: string | null,
  files: { name: string; size: number | null }[],
  createdAt: Date = OLD,
  importTitle: string | null = null,
): ArchivePageRow[] {
  return files.map((f) => ({
    documentId: id,
    fileName: f.name,
    fileSize: f.size,
    code,
    title,
    importTitle,
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
    //
    // ⚠️ Since #32.06 the archive's key title is `import_title ?? title`, so
    // this asserts over BOTH shapes. Reading `rows[0].title` alone — as it did
    // before that slice — passed only because the fixture's `importTitle` was
    // null, and would have gone on passing while the column it now keys on was
    // ignored entirely.
    // ⚠️ **THE VALUE COMES FROM `titleForEntry`, THE REAL FOLDER-SIDE
    // FUNCTION, and the third review round is why.** The version before this
    // one asserted `preexistingKeyOf(x, F) === preexistingKeyOf(rows[0].title, F)`
    // where `rows[0].title` WAS `x` — the same function compared to itself with
    // identical arguments, true for every possible implementation of both
    // functions. Feeding the folder side's own answer in is what makes the two
    // sides actually meet here.
    const files = [{ name: "1.jpg", size: 10 }];

    // A plain file: the folder side's title is the file's own name.
    const fileEntry = { kind: "file", name: "Contract.pdf" } as unknown as FSEntry;
    const supplied = titleForEntry(fileEntry);
    expect(supplied).toBe("Contract.pdf");

    // The import writes that to BOTH columns; the AI then rewrites `title`.
    // The archive must still key on what the folder produces.
    //
    // ⚠️ **AND THE ASSERTION IS THROUGH `matchArchiveDocuments`, not through
    // `preexistingKeyOf` twice.** A fourth review round caught a third attempt
    // at this test still comparing `preexistingKeyOf(supplied, F)` to
    // `preexistingKeyOf(imported[0].importTitle!, F)` — and `doc()` writes
    // `importTitle` verbatim, so those are the same pure function called with
    // identical arguments, true for every implementation of everything. Only
    // going through the matcher makes the two sides meet.
    const imported = doc("id-2", "DOC2", "PRINTED HEADING", files, OLD, supplied);
    expect(
      matchArchiveDocuments(imported, [candidate("f/1.jpg", supplied, files)])
        .map((m) => m.documentCode),
    ).toEqual(["DOC2"]);

    // A page group: the folder side's title is the FOLDER's hint, not a file
    // name, and `titleForEntry` is the only thing that knows that.
    const group = {
      kind: "page-group", name: "CVC_Hascu_2005",
      titleHint: "Contract de Vânzare-Cumpărare Hascu 2005",
    } as unknown as FSEntry;
    const groupTitle = titleForEntry(group);
    expect(groupTitle).toBe("Contract de Vânzare-Cumpărare Hascu 2005");
    expect(
      matchArchiveDocuments(
        doc("id-3", "DOC3", "CONTRACT DE VANZARE - CUMPARARE", files, OLD, groupTitle),
        [candidate("f/CVC_Hascu_2005", groupTitle, files)],
      ).map((m) => m.documentCode),
    ).toEqual(["DOC3"]);
  });
});

// ---------------------------------------------------------------------------
// Slice #32.06 — the key survives the AI rewriting the title
// ---------------------------------------------------------------------------
//
// Every case below is taken from the 32.05 UAT run of 2026-08-30 rather than
// invented: `03.types.noform` was imported twice and produced three duplicate
// pairs out of eight documents. The names, codes and titles are the real ones.

describe("matchArchiveDocuments — a document the AI retitled (#32.06)", () => {
  // `Fisa corp proprietate 4432.jpg` on its first import. The import stored the
  // file's own name; `resolveImportedTitle` then let the model's reading of the
  // printed heading win, so `title` is the heading and `import_title` is not.
  const FISA_FILE = "Fisa corp proprietate 4432.jpg";
  const FISA_SIZE = 331_204;
  const fisaCandidate = candidate(
    `46-222per13-9001 Tipuri neobisnuite/${FISA_FILE}`,
    FISA_FILE,
    [{ name: FISA_FILE, size: FISA_SIZE }],
  );

  it("recognises it — the miss that imported three documents twice", () => {
    const matches = matchArchiveDocuments(
      doc(
        "id-fisa", "DOC01511",
        "FISA CORPULUI DE PROPRIETATE",              // what the AI left behind
        [{ name: FISA_FILE, size: FISA_SIZE }],
        OLD,
        FISA_FILE,                                    // what the import stored
      ),
      [fisaCandidate],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ documentId: "id-fisa", documentCode: "DOC01511" });
  });

  it("names the document by its STORED title, not by the key", () => {
    // The user is being sent to look at DOC01511, and DOC01511 appears in the
    // archive as "FISA CORPULUI DE PROPRIETATE". Naming it by the key would
    // name something they cannot find.
    const matches = matchArchiveDocuments(
      doc("id-fisa", "DOC01511", "FISA CORPULUI DE PROPRIETATE",
          [{ name: FISA_FILE, size: FISA_SIZE }], OLD, FISA_FILE),
      [fisaCandidate],
    );
    expect(matches[0].documentTitle).toBe("FISA CORPULUI DE PROPRIETATE");
  });

  it("is not fooled by the model reading the SAME file differently twice", () => {
    // DOC01511 and DOC01519 are one file imported twice, and the model gave the
    // second copy a longer title. This is the case that rules out ever fixing
    // #32.06 by normalising `title`: there is no normalisation under which
    // these two strings are equal, and both must key to the same value.
    const first  = doc("id-a", "DOC01511", "FISA CORPULUI DE PROPRIETATE",
                       [{ name: FISA_FILE, size: FISA_SIZE }], OLD, FISA_FILE);
    const second = doc("id-b", "DOC01519", "FISA CORPULUI DE PROPRIETATE TARLA 46, PARCELA 222/13/1",
                       [{ name: FISA_FILE, size: FISA_SIZE }], NEW, FISA_FILE);
    const matches = matchArchiveDocuments([...first, ...second], [fisaCandidate]);
    expect(matches).toHaveLength(1);
    // The oldest wins the tie, as it always has.
    expect(matches[0].documentCode).toBe("DOC01511");
  });

  it("still recognises a document whose title the AI left alone", () => {
    // `TP 31316 Toma Veturia.jpg` kept its name on the real run — the #29.12
    // rule protected it — so title and import_title agree and nothing changes.
    const name = "TP 31316 Toma Veturia.jpg";
    const matches = matchArchiveDocuments(
      doc("id-tp", "DOC01512", name, [{ name, size: 812_004 }], OLD, name),
      [candidate(`46-222per13-9001 Tipuri neobisnuite/${name}`, name, [{ name, size: 812_004 }])],
    );
    expect(matches).toHaveLength(1);
  });
});

describe("matchArchiveDocuments — the import_title fallback (#32.06)", () => {
  // ⚠️ This block is the compatibility guarantee the slice was sold on. Every
  // document in the archive before #32.06 carries a null `import_title`, and
  // if any of these break, the column made recognition WORSE for the whole
  // existing archive rather than better for part of it.

  it("keys a null import_title on the stored title, exactly as before", () => {
    const matches = matchArchiveDocuments(
      doc("id-1", "DOC00042", "contract.pdf", [{ name: "contract.pdf", size: 240 }]),
      [CONTRACT],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].documentCode).toBe("DOC00042");
  });

  // ⚠️ **THIS TEST REPLACES ONE THAT WAS TAUTOLOGICAL, and the review that
  // caught it is worth recording.** The first version gave both documents real
  // titles and asserted the right one was picked — which passes whether or not
  // the untitled guard exists, so it tested nothing it claimed to test. The
  // guard only fires when a key title folds to empty on BOTH sides, so the
  // candidate has to be blank too. `titleForEntry` cannot produce a blank one,
  // which is exactly why this is defence in depth and exactly why it needs a
  // test of its own: nothing in production reaches it, so nothing in production
  // would notice it being deleted.
  it("never matches an untitled document to a blank-titled candidate", () => {
    const a = doc("id-a", "DOC00001", null, [{ name: "alpha.pdf", size: 100 }], OLD, null);
    const b = doc("id-b", "DOC00002", null, [{ name: "alpha.pdf", size: 100 }], NEW, "   ");
    for (const blankTitle of ["", "   "]) {
      const matches = matchArchiveDocuments(
        [...a, ...b],
        [candidate("f/alpha.pdf", blankTitle, [{ name: "alpha.pdf", size: 100 }])],
      );
      expect(matches).toEqual([]);
    }
  });

  it("picks the right document when several carry a null import_title", () => {
    const a = doc("id-a", "DOC00001", "alpha.pdf", [{ name: "alpha.pdf", size: 100 }]);
    const b = doc("id-b", "DOC00002", "beta.pdf",  [{ name: "beta.pdf",  size: 200 }]);
    const matches = matchArchiveDocuments(
      [...a, ...b],
      [candidate("f/alpha.pdf", "alpha.pdf", [{ name: "alpha.pdf", size: 100 }])],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].documentCode).toBe("DOC00001");
  });

  it("keeps two documents apart when only their import_title differs", () => {
    // The discriminating half of the key must still discriminate: same title,
    // same page name, same size, different import_title — the candidate may
    // match exactly one of them, and it must be the one whose import_title it
    // shares rather than whichever is older.
    const a = doc("id-a", "DOC00001", "shared title",
                  [{ name: "scan.pdf", size: 100 }], OLD, "other.pdf");
    const b = doc("id-b", "DOC00002", "shared title",
                  [{ name: "scan.pdf", size: 100 }], NEW, "scan.pdf");
    const matches = matchArchiveDocuments(
      [...a, ...b],
      [candidate("f/scan.pdf", "scan.pdf", [{ name: "scan.pdf", size: 100 }])],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].documentCode).toBe("DOC00002");
  });

  it("falls through to the title when import_title is blank", () => {
    // `titleForEntry` cannot produce a blank — it falls back to the folder name
    // precisely so it never does — but this reads a column, and a column holds
    // whatever a future writer puts in it. Blank must behave as absent, not as
    // a key of its own.
    for (const blank of ["", "   "]) {
      const matches = matchArchiveDocuments(
        doc("id-1", "DOC00042", "contract.pdf",
            [{ name: "contract.pdf", size: 240 }], OLD, blank),
        [CONTRACT],
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].documentCode).toBe("DOC00042");
    }
  });

  it("never matches a document with neither a title nor an import_title", () => {
    // ⚠️ The candidate title is BLANK on purpose, and the second review round
    // is why. Against `CONTRACT` (title "contract.pdf") this assertion passes
    // whatever the implementation does — the archive row keys as "" or is
    // skipped, and either way the keys differ — so it tested nothing. Both
    // sides have to fold to empty before the guard is the thing deciding.
    for (const blankTitle of ["", "   "]) {
      const matches = matchArchiveDocuments(
        doc("id-1", "DOC00042", null, [{ name: "contract.pdf", size: 240 }], OLD, null),
        [candidate("48-50/contract.pdf", blankTitle, [{ name: "contract.pdf", size: 240 }])],
      );
      expect(matches).toEqual([]);
    }
  });

  it("keys an EXISTING multi-page document on its title", () => {
    // ⚠️ **"a page group can never have an import_title" is what the first
    // draft of this test said, and it is false from #32.06 on** — the third
    // review round caught it. `titleForEntry` returns the folder's title hint
    // for a page group and the import writes THAT, so every page group imported
    // after this release carries a non-null `import_title`. What is true is
    // narrower and is what this asserts: every page group ALREADY in the
    // archive has a null one, because the folder name it was titled from is
    // stored nowhere and there is no backfill. Those must keep matching on
    // `title` exactly as they always did, over the whole page set. The shape
    // that ships from now on is the test below this one.
    const pages = [
      { name: "530.jpg", size: 101 },
      { name: "531.jpg", size: 102 },
      { name: "532.jpg", size: 103 },
    ];
    const hit = matchArchiveDocuments(
      doc("id-cvc", "DOC01505", "Contract de Vânzare-Cumpărare Costache S 2008", pages, OLD, null),
      [candidate("40-212per40IE55818-Sud/CVC Costache S 2008",
                 "Contract de Vânzare-Cumpărare Costache S 2008", pages)],
    );
    expect(hit.map((r) => r.documentCode)).toEqual(["DOC01505"]);

    // And one page short is a different document, as it always was.
    const short = matchArchiveDocuments(
      doc("id-cvc", "DOC01505", "Contract de Vânzare-Cumpărare Costache S 2008",
          pages.slice(0, 2), OLD, null),
      [candidate("40-212per40IE55818-Sud/CVC Costache S 2008",
                 "Contract de Vânzare-Cumpărare Costache S 2008", pages)],
    );
    expect(short).toEqual([]);
  });

  it("keys a NEWLY imported page group on its folder hint, over an AI rewrite", () => {
    // The shape that ships from #32.06 on.
    //
    // ⚠️ **THE FOLDER NAMES HERE ARE DELIBERATELY NOT `CVC …`, and a fourth
    // review round is why.** An earlier version of this comment claimed the 39
    // CVC-named page groups in the archive were what this buys, and that is
    // backwards: `CVC Costache S 2008` both names the kind and distinguishes
    // which one, so #29.12's `namesThisDocument` PROTECTS it — the model's
    // reading is rejected and `title` stays the hint. Those are unaffected by
    // this slice in either direction. The population that gains is the page
    // groups whose folder name fails that test, measured at 30 of 58 over
    // CLINCENI.3, and `Anexa 2` / `Acte vechi` below is that shape: a name the
    // rule does not protect, so the printed heading wins and two different
    // folders end up sharing one stored title.
    const pages = [
      { name: "530.jpg", size: 101 },
      { name: "531.jpg", size: 102 },
    ];
    const hint = "Anexa 2";
    const other = "Acte vechi";
    const rows = [
      ...doc("id-a", "DOC01505", "CONTRACT DE VANZARE - CUMPARARE", pages, OLD, hint),
      ...doc("id-b", "DOC01600", "CONTRACT DE VANZARE - CUMPARARE", pages, NEW, other),
    ];
    // Two documents the AI titled identically are told apart by their hints.
    expect(
      matchArchiveDocuments(rows, [candidate("46-222per13/Anexa 2", hint, pages)])
        .map((m) => m.documentCode),
    ).toEqual(["DOC01505"]);
    expect(
      matchArchiveDocuments(rows, [candidate("47per2-225per3/Acte vechi", other, pages)])
        .map((m) => m.documentCode),
    ).toEqual(["DOC01600"]);
  });

  it("matches on import_title alone when the stored title is null", () => {
    // Reachable: the AI writes `title` on a document whose own was null, and a
    // failed write leaves the pair the other way round. The document is still
    // the one the folder is offering, and it is still keyable.
    const matches = matchArchiveDocuments(
      doc("id-1", "DOC00042", null, [{ name: "contract.pdf", size: 240 }], OLD, "contract.pdf"),
      [CONTRACT],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].documentCode).toBe("DOC00042");
  });

  it("prefers import_title over title when they disagree, both ways round", () => {
    // The direction that matters: a document whose import_title matches the
    // folder is a match even though its title does not, and one whose TITLE
    // matches the folder is NOT a match when its import_title says otherwise.
    // The second half is the one worth having — it is what stops the column
    // being a widening of the key rather than a correction of it.
    const hit = matchArchiveDocuments(
      doc("id-1", "DOC00042", "SOMETHING THE MODEL READ",
          [{ name: "contract.pdf", size: 240 }], OLD, "contract.pdf"),
      [CONTRACT],
    );
    expect(hit).toHaveLength(1);

    const miss = matchArchiveDocuments(
      doc("id-2", "DOC00043", "contract.pdf",
          [{ name: "contract.pdf", size: 240 }], OLD, "a-different-file.pdf"),
      [CONTRACT],
    );
    expect(miss).toEqual([]);
  });
});
