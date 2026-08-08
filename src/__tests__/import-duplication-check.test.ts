/**
 * Unit tests for src/lib/import/duplication-check.ts   (Slice #26.06)
 *
 * This is the module that tells a business user, in Romanian, that two of their
 * documents are the same document. It can be wrong in two directions and they
 * are not symmetrical:
 *
 *  - **A false negative** costs a duplicate Document in the archive, which is
 *    annoying and correctable at any later date.
 *  - **A false positive** is a sentence asking someone to take a real document
 *    out of the folder it belongs in, on the system's word. That is the
 *    direction the tests below lean on, and it is why the grouping key, the
 *    page-group precedence and the unsized case each get their own case.
 *
 * The other thing pinned here is STABILITY. The user reads the list once before
 * going to File Explorer and once after coming back, and a list that reshuffles
 * between the two is unusable - so every group, and every path inside it, comes
 * back in a defined order.
 */

import {
  checkDuplication,
  checkDuplicationStage,
  type DuplicateGroup,
} from "@/lib/import/duplication-check";
import type { FileMeta } from "@/lib/import/checks";
import type { FSEntry, FSFileHandle } from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function handle(name: string): FSFileHandle {
  return { kind: "file", name, getFile: async () => new File([], name) };
}

function file(path: string): FSEntry {
  const name = path.split("/").pop()!;
  return {
    kind: "file",
    name,
    path,
    pathParts: path.split("/").slice(0, -1),
    handle: handle(name),
  };
}

function pages(path: string, pageNames: string[]): FSEntry {
  const name = path.split("/").pop()!;
  return {
    kind: "page-group",
    name,
    path,
    pathParts: path.split("/"),
    handles: pageNames.map(handle),
    titleHint: name,
  };
}

/** `{ "A/x.jpg": 10 }` - a size per upload key, which is all this module reads. */
function meta(sizes: Record<string, number>): ReadonlyMap<string, FileMeta> {
  return new Map(
    Object.entries(sizes).map(([key, size]) => [key, { size, type: "image/jpeg" }]),
  );
}

function groupsOf(entries: FSEntry[], sizes: Record<string, number>, ruleId: string) {
  const v = checkDuplication({ entries, metadata: meta(sizes) }).find((x) => x.ruleId === ruleId);
  return v?.groups ?? [];
}

function pathsOf(groups: readonly DuplicateGroup[]) {
  return groups.map((g) => g.paths);
}

// ---------------------------------------------------------------------------
// DUP-01 - the same file
// ---------------------------------------------------------------------------

describe("DUP-01", () => {
  it("reports two files with the same name and the same size, as one group", () => {
    const groups = groupsOf(
      [file("A/fisa.jpg"), file("B/fisa.jpg"), file("C/alt.jpg")],
      { "A/fisa.jpg": 100, "B/fisa.jpg": 100, "C/alt.jpg": 100 },
      "DUP-01",
    );
    expect(pathsOf(groups)).toEqual([["A/fisa.jpg", "B/fisa.jpg"]]);
    expect(groups[0].by).toBe("name");
  });

  it("⚠️ says NOTHING about two files that share a name but not a size", () => {
    // The whole reason F-15 could not simply be moved. Under #26.01's structure
    // rules every page folder holds a `1.jpg`, so a name-only rule is broken by
    // every compliant archive - and this stage BLOCKS, so it would be a rule
    // nobody could satisfy.
    const groups = groupsOf(
      [file("A/1.jpg"), file("B/1.jpg")],
      { "A/1.jpg": 100, "B/1.jpg": 101 },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("says nothing about two files of the same size with different names", () => {
    const groups = groupsOf(
      [file("A/unu.jpg"), file("A/doi.jpg")],
      { "A/unu.jpg": 100, "A/doi.jpg": 100 },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("matches names case-insensitively, and shows the shortest spelling", () => {
    // Windows would not let both sit in one folder; it happily lets them sit
    // in two, and they are still one file copied.
    const groups = groupsOf(
      [file("B/Contract.pdf"), file("A/contract.pdf")],
      { "B/Contract.pdf": 9, "A/contract.pdf": 9 },
      "DUP-01",
    );
    expect(pathsOf(groups)).toEqual([["A/contract.pdf", "B/Contract.pdf"]]);
    expect(groups[0].by === "name" && groups[0].name).toBe("contract.pdf");
  });

  it("⚠️ matches a Windows copy suffix, which is the commonest duplicate there is", () => {
    // The finding that would have made this stage decorative. Ctrl+C Ctrl+V in
    // the folder the user was just told to tidy produces exactly this pair, and
    // a rule matching names literally sees two different files.
    const groups = groupsOf(
      [file("P/contract.pdf"), file("P/contract - Copie.pdf")],
      { "P/contract.pdf": 900, "P/contract - Copie.pdf": 900 },
      "DUP-01",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].paths.slice().sort()).toEqual([
      "P/contract - Copie.pdf",
      "P/contract.pdf",
    ]);
    // The heading shows the ORIGINAL, not the copy: a heading naming the copy
    // invites the user to keep the copy.
    expect(groups[0].by === "name" && groups[0].name).toBe("contract.pdf");
  });

  it("matches the English and the Romanian suffix, with or without a paste number", () => {
    for (const copyName of ["x - Copy.pdf", "x - Copie.pdf", "x - Copy (3).pdf", "x - Copie (2).pdf"]) {
      const groups = groupsOf(
        [file("P/x.pdf"), file(`P/${copyName}`)],
        { "P/x.pdf": 12, [`P/${copyName}`]: 12 },
        "DUP-01",
      );
      expect({ copyName, sets: groups.length }).toEqual({ copyName, sets: 1 });
    }
  });

  it("⚠️ does not strip a marker off a file whose whole name is one", () => {
    // `- Copie.pdf` strips to nothing, and an empty stem would group with every
    // other empty stem of the same size - i.e. with `- Copy.pdf`, which may be
    // a copy of something else entirely.
    const groups = groupsOf(
      [file("P/- Copie.pdf"), file("P/- Copy.pdf")],
      { "P/- Copie.pdf": 12, "P/- Copy.pdf": 12 },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("⚠️ leaves numbered SHEETS alone when there is nothing for them to be a copy of", () => {
    // THE finding of the third adversarial round, and it is the DUP-02 uniform-
    // size argument reappearing in DUP-01. `Plan (1).tif` and `Plan (2).tif`
    // are sheets one and two of one plan; scanned uncompressed on one machine
    // they are the same number of bytes, because an uncompressed image's size
    // is fixed by its dimensions and bit depth alone. An unconditional strip of
    // the trailing `(n)` reports two real, different sheets as copies and asks
    // the user to remove one.
    //
    // A bare `(n)` is a NUMBER, and this archive numbers things. The copy word
    // is not - nobody names a cadastral document "Copie" by accident - so that
    // is where the line is drawn, unconditionally.
    const groups = groupsOf(
      [file("P/Plan (1).tif"), file("P/Plan (2).tif")],
      { "P/Plan (1).tif": 3868808, "P/Plan (2).tif": 3868808 },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("leaves a parenthesised year alone, for the same reason", () => {
    const groups = groupsOf(
      [file("P/Extras CF (2019).pdf"), file("P/Extras CF (2020).pdf")],
      { "P/Extras CF (2019).pdf": 44000, "P/Extras CF (2020).pdf": 44000 },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("⚠️ matches a copy OF a copy, which is what Windows actually produces", () => {
    // `Contract - Copie - Copie.pdf` is Windows' real name for the second
    // paste. A single non-global strip left it in its own set, so the stage
    // reported the pair it could see, the user removed the one it named, and
    // the next round printed a green all-clear over a byte-identical triple -
    // the "evidence that disappears when the user acts on it" failure this
    // module rejected the `(n)` anchor for.
    const groups = groupsOf(
      [
        file("P/Contract.pdf"),
        file("P/Contract - Copie.pdf"),
        file("P/Contract - Copie - Copie.pdf"),
      ],
      {
        "P/Contract.pdf": 9,
        "P/Contract - Copie.pdf": 9,
        "P/Contract - Copie - Copie.pdf": 9,
      },
      "DUP-01",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].paths).toHaveLength(3);
    expect(groups[0].by === "name" && groups[0].name).toBe("Contract.pdf");
  });

  it("⚠️ strips the copy marker BEFORE asking whether a name is a page number", () => {
    // The hole that survived six rounds. `1 - Copie.tif` did not look numeric,
    // so it escaped the page skip - and then the grouping key stripped the
    // marker and keyed it as `1`, so two properties' pasted first pages matched
    // each other and the user was told to remove one. The skip and the key have
    // to read the same string.
    const groups = groupsOf(
      [file("48-50D/1 - Copie.tif"), file("51A/1 - Copie.tif")],
      { "48-50D/1 - Copie.tif": 3868808, "51A/1 - Copie.tif": 3868808 },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("⚠️ says nothing about a file named only by a NUMBER, however big", () => {
    // The cost of the page skip, pinned so it stays a decision. A `MAX_PAGE_NUMBER`
    // of 999 was tried, to let `2019.pdf` - a receipt named by its year, pasted
    // in place - be compared. It was removed because the premise is false for
    // this archive: `structure-rules.ts` records `5449.jpg` and `31316.jpg` as
    // real page names off a scanner's own counter, so no threshold separates a
    // year from a page, and the bound merely moved the failure into the
    // expensive direction - DUP-01 naming a real page and telling the user to
    // remove it.
    //
    // Both halves of the trade are here: the year is silent, and so is the
    // five-digit page that the bound would have reported.
    expect(
      groupsOf(
        [file("48-50D/2019.pdf"), file("48-50D/2019 - Copie.pdf")],
        { "48-50D/2019.pdf": 412336, "48-50D/2019 - Copie.pdf": 412336 },
        "DUP-01",
      ),
    ).toEqual([]);
    expect(
      groupsOf(
        [file("48-50D/5449.jpg"), file("51A/5449.jpg")],
        { "48-50D/5449.jpg": 3868808, "51A/5449.jpg": 3868808 },
        "DUP-01",
      ),
    ).toEqual([]);
  });

  it("⚠️ leaves a numbered scan alone whatever it was SAVED as", () => {
    // The image-only version of this skip covered `.tif` and `.jpg` and stopped
    // there, and a scanner emitting `1.pdf … n.pdf` into a plain folder is
    // ordinary. The question is whether the name is a page number; the answer
    // does not depend on the format, and neither does the remedy being wrong.
    const groups = groupsOf(
      [file("48-50D/1.pdf"), file("51A/1.pdf")],
      { "48-50D/1.pdf": 412336, "51A/1.pdf": 412336 },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("⚠️ leaves a bare number alone even when the unsuffixed file IS there", () => {
    // The deliberate silence, pinned so it stays a decision rather than
    // becoming a gap. A browser's second download - `Extras CF (1).pdf` beside
    // `Extras CF.pdf` - goes unreported. Three alternatives were tried and each
    // moved the failure rather than removing it; the worst had this stage name
    // three files as copies and then, one round of its own loop later, certify
    // two of them as unique because the user had removed the third. The module
    // header records all three.
    const groups = groupsOf(
      [file("P/Extras CF.pdf"), file("P/Extras CF (1).pdf")],
      { "P/Extras CF.pdf": 44000, "P/Extras CF (1).pdf": 44000 },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("⚠️ is not swayed by a same-named file in another property's folder", () => {
    // The mechanism this replaced looked for an "anchor" anywhere in the picked
    // folder, so `48-50D/Plan.tif` merged `51A/Plan (1).tif` and
    // `51A/Plan (2).tif` into one set and told the user to keep another
    // property's plan. Nothing is neighbour-dependent now: the key is the
    // file's own name and its own size.
    const groups = groupsOf(
      [file("48-50D/Plan.tif"), file("51A/Plan (1).tif"), file("51A/Plan (2).tif")],
      {
        "48-50D/Plan.tif": 3868808,
        "51A/Plan (1).tif": 3868808,
        "51A/Plan (2).tif": 3868808,
      },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("keeps the extension out of the stripping, so two kinds never match", () => {
    const groups = groupsOf(
      [file("P/plan.pdf"), file("P/plan.jpg")],
      { "P/plan.pdf": 12, "P/plan.jpg": 12 },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("puts three copies in ONE group rather than three pairs", () => {
    // The count the sentence quotes is `sets`, i.e. decisions. Three copies is
    // one decision, and splitting them would treble it.
    const groups = groupsOf(
      [file("A/x.pdf"), file("B/x.pdf"), file("C/x.pdf")],
      { "A/x.pdf": 5, "B/x.pdf": 5, "C/x.pdf": 5 },
      "DUP-01",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].paths).toHaveLength(3);
  });

  it("counts sets and files separately", () => {
    const [violation] = checkDuplication({
      entries: [file("A/x.pdf"), file("B/x.pdf"), file("A/y.pdf"), file("B/y.pdf")],
      metadata: meta({ "A/x.pdf": 5, "B/x.pdf": 5, "A/y.pdf": 7, "B/y.pdf": 7 }),
    });
    expect(violation.counts).toEqual({ sets: 2, files: 4 });
  });

  it("⚠️ never names a NUMBERED SCAN, even when the walk delivered it as a plain file", () => {
    // The safety argument is about what the file IS, not about which entry kind
    // it arrived as - and a folder becomes a page group only when ALL its files
    // are numbered. One `contract.pdf` beside the scans and the folder stays a
    // plain folder, so `48-50D/1.tif` was matched against `51A/1.tif` on a byte
    // count two uncompressed scans share by construction. Worse than the
    // page-folder version: no numbering rule is left to bounce the user back,
    // so the page is simply gone.
    const groups = groupsOf(
      [
        file("48-50D/1.tif"), file("48-50D/2.tif"), file("48-50D/contract.pdf"),
        file("51A/1.tif"), file("51A/2.tif"), file("51A/nota.txt"),
      ],
      {
        "48-50D/1.tif": 3868808, "48-50D/2.tif": 3868808, "48-50D/contract.pdf": 900,
        "51A/1.tif": 3868808, "51A/2.tif": 3868808, "51A/nota.txt": 40,
      },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("⚠️ folds Romanian diacritics, so one document typed two ways is one document", () => {
    // Comma-below `ș` (U+0219) against cedilla `ş` (U+015F) is the same word on
    // two Romanian keyboard layouts, and `toLowerCase` folds neither into the
    // other - so two copies of one file were compared as two different files.
    // Every other name comparator in the import path already folds.
    const groups = groupsOf(
      [file("A/Adeverin\u021b\u0103.pdf"), file("B/Adeverin\u0163\u0103.pdf")],
      { "A/Adeverin\u021b\u0103.pdf": 700, "B/Adeverin\u0163\u0103.pdf": 700 },
      "DUP-01",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].paths).toHaveLength(2);
  });

  it("never names a page inside a page folder either", () => {
    // THE finding of this slice's second adversarial round, and it is about the
    // REMEDY rather than the match. Every compliant page folder holds a
    // `1.jpg`, so across a real archive two unrelated first pages eventually
    // share a byte count - and DUP-01's sentence says "keep the one in the
    // right place and take the others out". For a page there is no other place:
    // a user who followed it would delete page 1 of a real document, be bounced
    // back to the Structure stage by the numbering rule on the next check, and
    // have no way to undo it. Pages are answered by DUP-02, at the level the
    // user can act on.
    const groups = groupsOf(
      [pages("A/Contract", ["1.jpg"]), file("A/1.jpg")],
      { "A/Contract/1.jpg": 42, "A/1.jpg": 42 },
      "DUP-01",
    );
    expect(groups).toEqual([]);
  });

  it("returns groups and paths in a stable order, whatever order the walk gave", () => {
    const entries = [file("Z/b.pdf"), file("A/a.pdf"), file("A/b.pdf"), file("Z/a.pdf")];
    const sizes = { "Z/b.pdf": 2, "A/a.pdf": 1, "A/b.pdf": 2, "Z/a.pdf": 1 };
    const first = pathsOf(groupsOf(entries, sizes, "DUP-01"));
    const second = pathsOf(groupsOf([...entries].reverse(), sizes, "DUP-01"));
    expect(first).toEqual([
      ["A/a.pdf", "Z/a.pdf"],
      ["A/b.pdf", "Z/b.pdf"],
    ]);
    expect(second).toEqual(first);
  });
});

// ---------------------------------------------------------------------------
// DUP-02 - the same document
// ---------------------------------------------------------------------------

describe("DUP-02", () => {
  it("reports two page folders holding the same pages", () => {
    const groups = groupsOf(
      [pages("P/Contract", ["1.jpg", "2.jpg"]), pages("P/Contract - Copy", ["1.jpg", "2.jpg"])],
      {
        "P/Contract/1.jpg": 10,
        "P/Contract/2.jpg": 20,
        "P/Contract - Copy/1.jpg": 10,
        "P/Contract - Copy/2.jpg": 20,
      },
      "DUP-02",
    );
    expect(pathsOf(groups)).toEqual([["P/Contract", "P/Contract - Copy"]]);
    expect(groups[0].by === "pages" && groups[0].pages).toBe(2);
  });

  it("⚠️ matches a copy that was renumbered, because the names are not the signature", () => {
    // A folder copied in File Explorer is very often renumbered by whoever
    // copied it, and #26.01 guarantees only that page names are numbers.
    const groups = groupsOf(
      [pages("P/Contract", ["1.jpg", "2.jpg"]), pages("P/Vechi", ["01.jpg", "02.jpg"])],
      {
        "P/Contract/1.jpg": 10,
        "P/Contract/2.jpg": 20,
        "P/Vechi/01.jpg": 10,
        "P/Vechi/02.jpg": 20,
      },
      "DUP-02",
    );
    expect(pathsOf(groups)).toEqual([["P/Contract", "P/Vechi"]]);
  });

  it("says nothing about two folders whose pages differ by one", () => {
    const groups = groupsOf(
      [pages("P/A", ["1.jpg", "2.jpg"]), pages("P/B", ["1.jpg", "2.jpg"])],
      { "P/A/1.jpg": 10, "P/A/2.jpg": 20, "P/B/1.jpg": 10, "P/B/2.jpg": 21 },
      "DUP-02",
    );
    expect(groups).toEqual([]);
  });

  it("says nothing about two folders with different page counts", () => {
    const groups = groupsOf(
      [pages("P/A", ["1.jpg", "2.jpg", "3.jpg"]), pages("P/B", ["1.jpg", "2.jpg"])],
      { "P/A/1.jpg": 10, "P/A/2.jpg": 20, "P/A/3.jpg": 30, "P/B/1.jpg": 10, "P/B/2.jpg": 20 },
      "DUP-02",
    );
    expect(groups).toEqual([]);
  });

  it("⚠️ says nothing about two ONE-page folders that merely happen to be the same size", () => {
    // A one-page folder carries exactly DUP-01's evidence - one name, one size
    // - and DUP-02 attaches to it the much stronger claim "this is the same
    // DOCUMENT" and the much heavier remedy "take the whole folder out". Two
    // ID-card scans of the same byte count are two different people.
    const groups = groupsOf(
      [pages("P/Buletin Ionescu", ["1.jpg"]), pages("P/Buletin Popescu", ["1.jpg"])],
      { "P/Buletin Ionescu/1.jpg": 412336, "P/Buletin Popescu/1.jpg": 412336 },
      "DUP-02",
    );
    expect(groups).toEqual([]);
  });

  it("⚠️ does not drag a third property's folder in behind one real paste", () => {
    // The failure `.some(isMarkedCopy)` had on its own: the marker was present,
    // just not on the folder being accused. One paste under 48-50D pulled
    // `51A/Contract` - another property's real contract - into the same set of
    // three. The parent is part of the key now, because Windows produces this
    // suffix by pasting INTO a directory and the copy is always beside the
    // original.
    const s = 3868808;
    const sizes: Record<string, number> = {};
    for (const f of ["48-50D/Contract", "48-50D/Contract - Copie", "51A/Contract"]) {
      for (const n of ["1.tif", "2.tif", "3.tif"]) sizes[`${f}/${n}`] = s;
    }
    const groups = groupsOf(
      [
        pages("48-50D/Contract", ["1.tif", "2.tif", "3.tif"]),
        pages("48-50D/Contract - Copie", ["1.tif", "2.tif", "3.tif"]),
        pages("51A/Contract", ["1.tif", "2.tif", "3.tif"]),
      ],
      sizes,
      "DUP-02",
    );
    expect(pathsOf(groups)).toEqual([["48-50D/Contract", "48-50D/Contract - Copie"]]);
  });

  it("⚠️ says nothing about two properties' identically-named one-page folders", () => {
    // The false positive the weak sub-split introduced before it required a
    // marker. Nothing constrains the two folders to sit under one property, so
    // `48-50D/Buletin` and `51A/Buletin` - two different people's ID cards, one
    // page each, the same byte count because they came off one scanner at one
    // setting - matched, and the user was told to remove a whole real document.
    // Two identically named folders with no marker anywhere are a naming
    // convention, not a paste.
    const groups = groupsOf(
      [pages("48-50D/Buletin", ["1.tif"]), pages("51A/Buletin", ["1.tif"])],
      { "48-50D/Buletin/1.tif": 412336, "51A/Buletin/1.tif": 412336 },
      "DUP-02",
    );
    expect(groups).toEqual([]);
  });

  it("⚠️ and nothing about two properties' identically-named uniform-size folders", () => {
    const s = 3868808;
    const sizes: Record<string, number> = {};
    for (const f of ["48-50D/Contract", "51A/Contract"]) {
      for (const n of ["1.tif", "2.tif", "3.tif"]) sizes[`${f}/${n}`] = s;
    }
    const groups = groupsOf(
      [
        pages("48-50D/Contract", ["1.tif", "2.tif", "3.tif"]),
        pages("51A/Contract", ["1.tif", "2.tif", "3.tif"]),
      ],
      sizes,
      "DUP-02",
    );
    expect(groups).toEqual([]);
  });

  it("⚠️ but DOES catch a copied one-page folder, on its marker", () => {
    // The hole the third adversarial round found under the guard above: with
    // the weak signature merely dropped, `Buletin Ionescu` and `Buletin Ionescu
    // - Copie` were invisible to BOTH rules and the stage printed a green
    // all-clear over a document that would be imported twice. The folder name
    // is the second piece of evidence, and it is the same evidence DUP-01 uses
    // on files.
    const groups = groupsOf(
      [pages("P/Buletin Ionescu", ["1.jpg"]), pages("P/Buletin Ionescu - Copie", ["1.jpg"])],
      { "P/Buletin Ionescu/1.jpg": 412336, "P/Buletin Ionescu - Copie/1.jpg": 412336 },
      "DUP-02",
    );
    expect(pathsOf(groups)).toEqual([["P/Buletin Ionescu", "P/Buletin Ionescu - Copie"]]);
    expect(groups[0].by === "pages" && groups[0].pages).toBe(1);
  });

  it("⚠️ and catches a copied UNIFORM-size folder on its marker, without merging the others", () => {
    // Both halves in one archive: the three unrelated uniform-TIFF documents
    // stay apart, and the one that really was copied is reported.
    const s = 3868808;
    const sizes: Record<string, number> = {};
    for (const f of ["P/Contract", "P/Contract - Copie", "P/Carte funciara"]) {
      for (const n of ["1.tif", "2.tif", "3.tif"]) sizes[`${f}/${n}`] = s;
    }
    const groups = groupsOf(
      [
        pages("P/Contract", ["1.tif", "2.tif", "3.tif"]),
        pages("P/Contract - Copie", ["1.tif", "2.tif", "3.tif"]),
        pages("P/Carte funciara", ["1.tif", "2.tif", "3.tif"]),
      ],
      sizes,
      "DUP-02",
    );
    expect(pathsOf(groups)).toEqual([["P/Contract", "P/Contract - Copie"]]);
  });

  it("⚠️ says nothing about folders whose pages are ALL the same size", () => {
    // The finding that most nearly shipped as a rule telling a user to throw
    // away three unrelated documents. An uncompressed scan - TIFF or BMP, both
    // legal page formats and both an ordinary office-scanner setting - has a
    // byte size fixed by its dimensions and bit depth alone, so every page the
    // machine produces at one setting is byte-identical in SIZE and unrelated
    // in content. Three different three-page documents then sign identically.
    //
    // When every page is the same size the multiset says nothing beyond the
    // page count, and a page count is not evidence.
    const s = 3868808;
    const groups = groupsOf(
      [
        pages("P/Contract", ["1.tif", "2.tif", "3.tif"]),
        pages("P/Carte funciara", ["1.tif", "2.tif", "3.tif"]),
        pages("P/Proces verbal", ["1.tif", "2.tif", "3.tif"]),
      ],
      {
        "P/Contract/1.tif": s, "P/Contract/2.tif": s, "P/Contract/3.tif": s,
        "P/Carte funciara/1.tif": s, "P/Carte funciara/2.tif": s, "P/Carte funciara/3.tif": s,
        "P/Proces verbal/1.tif": s, "P/Proces verbal/2.tif": s, "P/Proces verbal/3.tif": s,
      },
      "DUP-02",
    );
    expect(groups).toEqual([]);
  });

  it("puts three copies of one document in ONE group", () => {
    const sizes: Record<string, number> = {};
    for (const folder of ["P/A", "P/B", "P/C"]) {
      sizes[`${folder}/1.jpg`] = 10;
      sizes[`${folder}/2.jpg`] = 20;
    }
    const groups = groupsOf(
      [pages("P/A", ["1.jpg", "2.jpg"]), pages("P/B", ["1.jpg", "2.jpg"]), pages("P/C", ["1.jpg", "2.jpg"])],
      sizes,
      "DUP-02",
    );
    expect(pathsOf(groups)).toEqual([["P/A", "P/B", "P/C"]]);
  });

  it("⚠️ reports a duplicated folder ONCE, as a folder, never as its pages", () => {
    // Without this a 40-page folder copied once is reported as 40 duplicated
    // files under one sentence, with nothing saying they are two folders - and
    // the obvious fix is to delete pages one at a time. The rules read disjoint
    // halves of `entries`, so this holds by construction rather than by a set
    // of claimed keys kept in step between them.
    const entries = [
      pages("P/Contract", ["1.jpg", "2.jpg"]),
      pages("P/Contract - Copy", ["1.jpg", "2.jpg"]),
    ];
    const sizes = {
      "P/Contract/1.jpg": 10,
      "P/Contract/2.jpg": 20,
      "P/Contract - Copy/1.jpg": 10,
      "P/Contract - Copy/2.jpg": 20,
    };
    const violations = checkDuplication({ entries, metadata: meta(sizes) });
    expect(violations.map((v) => v.ruleId)).toEqual(["DUP-02"]);
    expect(violations[0].counts).toEqual({ sets: 1, folders: 2 });
  });

  it("⚠️ says nothing about two folders that share a page but are not the same document", () => {
    // Two folders differing by one page are two documents, and the pages they
    // share are pages of each. Reporting the shared page would be an
    // instruction to delete a page the other document needs. The honest answer
    // is silence, and the user still sees both folders in Explorer.
    const entries = [pages("P/A", ["1.jpg", "2.jpg"]), pages("P/B", ["1.jpg", "2.jpg"])];
    const sizes = { "P/A/1.jpg": 10, "P/A/2.jpg": 20, "P/B/1.jpg": 10, "P/B/2.jpg": 21 };
    expect(checkDuplication({ entries, metadata: meta(sizes) })).toEqual([]);
  });

  it("⚠️ does not sign a folder whose pages could not all be measured", () => {
    // A folder matched on the pages that happened to be readable is a folder
    // matched on less than it holds. Nothing is reported - and the unmeasured
    // page still lands in `unsized`, which blocks the stage, so silence here is
    // not a pass. That pairing is what makes this safe rather than lax.
    const entries = [pages("P/A", ["1.jpg", "2.jpg"]), pages("P/B", ["1.jpg", "2.jpg"])];
    const sizes = {
      "P/A/1.jpg": 10,
      "P/A/2.jpg": 20,
      "P/B/1.jpg": 10,
      // P/B/2.jpg was not readable
    };
    expect(checkDuplication({ entries, metadata: meta(sizes) })).toEqual([]);
    const verdict = checkDuplicationStage({ entries, metadata: meta(sizes) });
    expect(verdict.unsized).toEqual(["P/B/2.jpg"]);
    expect(verdict.clean).toBe(false);
  });

  it("emits DUP-01 before DUP-02, which is catalogue order", () => {
    const entries = [
      file("A/x.pdf"),
      file("B/x.pdf"),
      pages("P/A", ["1.jpg", "2.jpg"]),
      pages("P/B", ["1.jpg", "2.jpg"]),
    ];
    const sizes = {
      "A/x.pdf": 5,
      "B/x.pdf": 5,
      "P/A/1.jpg": 7,
      "P/A/2.jpg": 8,
      "P/B/1.jpg": 7,
      "P/B/2.jpg": 8,
    };
    expect(checkDuplication({ entries, metadata: meta(sizes) }).map((v) => v.ruleId)).toEqual([
      "DUP-01",
      "DUP-02",
    ]);
  });
});

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

describe("checkDuplicationStage", () => {
  it("passes a folder that holds nothing twice", () => {
    const verdict = checkDuplicationStage({
      entries: [file("A/x.pdf"), file("B/y.pdf")],
      metadata: meta({ "A/x.pdf": 1, "B/y.pdf": 2 }),
    });
    expect(verdict).toEqual({ violations: [], unsized: [], clean: true });
  });

  it("⚠️ refuses a folder holding a file it could not measure, breaking no rule", () => {
    // "We could not look" must never render as "it is fine". A file with no
    // size is silently unique, which is the failure this field exists for.
    const verdict = checkDuplicationStage({
      entries: [file("A/x.pdf"), file("B/y.pdf")],
      metadata: meta({ "A/x.pdf": 1 }),
    });
    expect(verdict.violations).toEqual([]);
    expect(verdict.unsized).toEqual(["B/y.pdf"]);
    expect(verdict.clean).toBe(false);
  });

  it("⚠️ refuses everything when the metadata pass read nothing at all", () => {
    // An EMPTY map is a legitimate input and means the pass ran and got
    // nothing - which is what `runWalk` supplies when the pass throws.
    const verdict = checkDuplicationStage({
      entries: [file("A/x.pdf"), file("A/y.pdf")],
      metadata: meta({}),
    });
    expect(verdict.unsized).toEqual(["A/x.pdf", "A/y.pdf"]);
    expect(verdict.clean).toBe(false);
  });

  it("lists every page of an unmeasurable page group, not the group", () => {
    // `unsized` is about what would be UPLOADED, and a page group uploads one
    // file per page. Naming the folder would send the user looking for a file
    // that is not one.
    const verdict = checkDuplicationStage({
      entries: [pages("P/A", ["1.jpg", "2.jpg"])],
      metadata: meta({ "P/A/1.jpg": 10 }),
    });
    expect(verdict.unsized).toEqual(["P/A/2.jpg"]);
  });

  it("refuses a folder that holds copies", () => {
    const verdict = checkDuplicationStage({
      entries: [file("A/x.pdf"), file("B/x.pdf")],
      metadata: meta({ "A/x.pdf": 5, "B/x.pdf": 5 }),
    });
    expect(verdict.clean).toBe(false);
    expect(verdict.unsized).toEqual([]);
    expect(verdict.violations.map((v) => v.ruleId)).toEqual(["DUP-01"]);
  });

  it("passes an empty folder", () => {
    // Structure refuses one long before this, but the module must be sound on
    // its own inputs rather than sound because another stage runs first.
    expect(checkDuplicationStage({ entries: [], metadata: meta({}) })).toEqual({
      violations: [],
      unsized: [],
      clean: true,
    });
  });

  it("passes a folder holding one file twice over - which it cannot", () => {
    // A single entry can never be a duplicate of itself: `uploadKeysOf` yields
    // one key per file, and a group needs two. Pinned because an off-by-one in
    // the `< 2` test would report every single file in the archive as a copy of
    // itself, which is the most expensive possible false positive.
    const verdict = checkDuplicationStage({
      entries: [file("A/x.pdf")],
      metadata: meta({ "A/x.pdf": 5 }),
    });
    expect(verdict).toEqual({ violations: [], unsized: [], clean: true });
  });
});
