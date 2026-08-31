/**
 * Unit tests for src/lib/import/preexisting-check.ts   (Slice #26.08)
 *
 * This is the module that tells a business user which of their documents the
 * archive already holds, and then tells the import loop not to create them. It
 * can be wrong in two directions and they are the MIRROR IMAGE of the
 * duplication stage's:
 *
 *  - **A false negative** — the archive holds it and we say it does not —
 *    costs a duplicate Document, which is visible and correctable at any later
 *    date.
 *  - **A false positive** — we say the archive holds it and it does not — is a
 *    file that is silently never imported, on a screen that promised it would
 *    be linked instead. Nothing in the archive afterwards records that the file
 *    existed.
 *
 * So the key is deliberately STRICT and most of the cases below lean on that,
 * which is the opposite of `import-duplication-check.test.ts`, where the
 * pressure is all on not over-claiming. Both are right; the difference is which
 * failure costs data.
 *
 * The other thing pinned here is the pair of EXCEPTIONS. An identity card and a
 * coordinate file are imported again even when the archive holds them, and each
 * for its own reason — one because a wrong match costs a person, one because a
 * property's corners must point at a document this run created. Both are easy
 * to lose in a refactor and neither would fail anything else.
 */

import fs from "node:fs";
import path from "node:path";

import { looksLikeIdCardName } from "@/lib/import/id-card";
import { assignEntryProperties, groupByPropertyFolder } from "@/lib/import/property-folders";
import {
  checkPreexistingStage,
  preexistingCandidatesOf,
  preexistingDecisionsByPath,
  preexistingKeyOf,
  titleForEntry,
  type PreexistingMatch,
} from "@/lib/import/preexisting-check";
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

function pages(path: string, pageNames: string[], titleHint?: string): FSEntry {
  const name = path.split("/").pop()!;
  return {
    kind: "page-group",
    name,
    path,
    pathParts: path.split("/"),
    handles: pageNames.map(handle),
    titleHint: titleHint ?? name,
  };
}

/** `{ "A/x.jpg": 10 }` — a size per upload key, which is all this module reads. */
function meta(sizes: Record<string, number>): ReadonlyMap<string, FileMeta> {
  return new Map(
    Object.entries(sizes).map(([key, size]) => [key, { size, type: "image/jpeg" }]),
  );
}

/** A match for `path`, as the archive would answer it. */
function match(path: string, code = "DOC00001"): PreexistingMatch {
  return { path, documentId: `id-${code}`, documentCode: code, documentTitle: "orice" };
}

/**
 * A match whose ARCHIVED TITLE is deliberately different from anything the
 * folder produces. Slice #32.06 — `documentTitle` is what the screen and the
 * saved page print beside the code, and since that slice it is routinely NOT
 * the folder's name, because the AI rewrites `document.title` after import.
 */
function matchTitled(
  path: string,
  documentTitle: string | null,
  code = "DOC00001",
): PreexistingMatch {
  return { path, documentId: `id-${code}`, documentCode: code, documentTitle };
}

function verdictFor(
  entries: FSEntry[],
  matched: PreexistingMatch[],
  options: { unchecked?: string[]; topLevelDirNames?: string[] } = {},
) {
  return checkPreexistingStage({
    entries,
    matches: new Map(matched.map((m) => [m.path, m])),
    unchecked: options.unchecked ?? [],
    topLevelDirNames: options.topLevelDirNames,
  });
}

/** Every row, flattened, with only what the assertions care about. */
function rowsOf(verdict: ReturnType<typeof verdictFor>) {
  return verdict.sections.flatMap((s) =>
    s.rows.map((r) => ({
      path: r.path,
      section: s.id,
      outcome: r.outcome,
      reason: r.reimportReason,
      folders: r.propertyFolders,
    })),
  );
}

// ---------------------------------------------------------------------------
// The key
// ---------------------------------------------------------------------------

describe("preexistingKeyOf", () => {
  it("does not depend on the order the pages arrive in", () => {
    // The walk sorts its children and Postgres does not promise an order at
    // all, so a key that depended on it would make one document look like two.
    const a = preexistingKeyOf("Contract", [
      { name: "1.jpg", size: 10 },
      { name: "2.jpg", size: 20 },
    ]);
    const b = preexistingKeyOf("Contract", [
      { name: "2.jpg", size: 20 },
      { name: "1.jpg", size: 10 },
    ]);
    expect(a).toBe(b);
  });

  it("folds case and Romanian diacritics on both the title and the names", () => {
    // `Adeverință` and `Adeverinţă` are one word typed on two Romanian keyboard
    // layouts — comma-below against cedilla — and `toLowerCase` folds neither
    // into the other. Same argument `duplication-check.ts` makes at length.
    expect(preexistingKeyOf("Adeverință", [{ name: "Scan Ș.jpg", size: 1 }])).toBe(
      preexistingKeyOf("ADEVERINŢĂ", [{ name: "scan ş.jpg", size: 1 }]),
    );
  });

  it("⚠️ separates two documents that differ only in title", () => {
    // The half `duplication-check.ts` deliberately leaves out of DUP-02 and
    // this deliberately puts in. Under-claiming here costs a duplicate;
    // over-claiming loses a file.
    expect(preexistingKeyOf("Contract", [{ name: "1.jpg", size: 10 }])).not.toBe(
      preexistingKeyOf("Contract vechi", [{ name: "1.jpg", size: 10 }]),
    );
  });

  it("⚠️ separates two documents that differ only in a page NAME", () => {
    // A folder renumbered from `1.jpg` to `01.jpg` between two imports is not
    // recognised, so it is imported again — the cheap failure, chosen on
    // purpose. DUP-02 makes the opposite choice for the opposite reason.
    expect(preexistingKeyOf("Contract", [{ name: "1.jpg", size: 10 }])).not.toBe(
      preexistingKeyOf("Contract", [{ name: "01.jpg", size: 10 }]),
    );
  });

  it("separates two documents that differ only in a page SIZE", () => {
    expect(preexistingKeyOf("Contract", [{ name: "1.jpg", size: 10 }])).not.toBe(
      preexistingKeyOf("Contract", [{ name: "1.jpg", size: 11 }]),
    );
  });

  it("separates a one-page document from a two-page one", () => {
    expect(preexistingKeyOf("C", [{ name: "1.jpg", size: 10 }])).not.toBe(
      preexistingKeyOf("C", [
        { name: "1.jpg", size: 10 },
        { name: "2.jpg", size: 10 },
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Building the question
// ---------------------------------------------------------------------------

describe("preexistingCandidatesOf", () => {
  it("⚠️ falls back to the folder name when the title hint comes out empty", () => {
    // `folderNameToTitleHint` replaces underscores with spaces, expands
    // abbreviations and trims, so a folder named `___` yields `""`. The route's
    // schema requires a non-empty title, so ONE such folder made the whole
    // request 400 — which the client reports as a failed lookup, which puts the
    // stage on a retry that can never succeed and never says why. Found by this
    // slice's adversarial review.
    expect(titleForEntry(pages("48-50/___", ["1.jpg"], ""))).toBe("___");
    expect(titleForEntry(pages("48-50/CVC", ["1.jpg"], "   "))).toBe("CVC");
  });

  it("titles a plain file by its name and a page group by its title hint", () => {
    expect(titleForEntry(file("48-50/contract.pdf"))).toBe("contract.pdf");
    expect(titleForEntry(pages("48-50/CVC", ["1.jpg"], "Contract vânzare"))).toBe(
      "Contract vânzare",
    );
  });

  it("⚠️ is the SAME expression the import loop writes into `document.title`", () => {
    // The claim this suite used to make in a comment and never check — and the
    // two had already diverged: the loop wrote `entry.titleHint` verbatim,
    // without the empty-hint fallback above, so such a document was stored
    // untitled, the archive side refuses untitled documents, and that folder
    // was re-imported on every future run for ever.
    //
    // Reading the source is the only way to pin it from here — nothing in this
    // suite renders React — and it is the same technique the stage suites use
    // to keep a component's `t("…")` calls honest.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/admin/import/_components/bulk-import-dialog.tsx"),
      "utf8",
    );
    // Every `const title = …` in that file, and there must be exactly one:
    // a second spelling would be a second definition of what the archive is
    // keyed on. Written as an exhaustive list rather than as a "does not
    // contain the old expression" regex, which a first draft of this test used
    // and which matched three innocent DISPLAY-name expressions elsewhere in
    // the same file.
    const titleAssignments = [...source.matchAll(/const title\s*=\s*([^;]+);/g)].map((m) =>
      m[1].trim(),
    );
    expect(titleAssignments).toEqual(["titleForEntry(entry)"]);
  });

  it("builds one candidate per entry, with every page", () => {
    // ⚠️ **THE PAGE GROUP CARRIES A HINT THAT DIFFERS FROM ITS FOLDER NAME, and
    // a sixth review round is why.** `pages()` defaults `titleHint` to the
    // folder's own name, so with the default `titleForEntry(entry)` and
    // `entry.name` return the same string and this test could not tell them
    // apart — `title: entry.name` passed the whole test suite. That mutant re-imports
    // every page group for ever, silently, because the candidate would key on a
    // value the archive never stored. Since #32.06 the same expression is also
    // what is WRITTEN to `document.import_title`, so the folder side is the
    // third leg of a binding `import-title-write-binding.test.ts` pins the
    // other two of.
    const { candidates, unchecked } = preexistingCandidatesOf({
      entries: [
        file("48-50/contract.pdf"),
        pages("48-50/CVC", ["1.jpg", "2.jpg"], "Contract de Vânzare-Cumpărare"),
      ],
      metadata: meta({
        "48-50/contract.pdf": 100,
        "48-50/CVC/1.jpg": 10,
        "48-50/CVC/2.jpg": 20,
      }),
    });
    expect(unchecked).toEqual([]);
    expect(candidates).toEqual([
      { path: "48-50/contract.pdf", title: "contract.pdf", files: [{ name: "contract.pdf", size: 100 }] },
      {
        path: "48-50/CVC",
        // The HINT, not "CVC" — `titleForEntry`, which is what the import
        // stores and what the archive is keyed on.
        title: "Contract de Vânzare-Cumpărare",
        files: [
          { name: "1.jpg", size: 10 },
          { name: "2.jpg", size: 20 },
        ],
      },
    ]);
  });

  it("⚠️ ONE unmeasured page sinks the whole entry, not just that page", () => {
    // A page group matched on the pages that happened to be readable is a page
    // group matched on less than it holds, and the answer would be a confident
    // "already in the system" over a document whose second page nobody saw.
    const { candidates, unchecked } = preexistingCandidatesOf({
      entries: [pages("48-50/CVC", ["1.jpg", "2.jpg"])],
      metadata: meta({ "48-50/CVC/1.jpg": 10 }),
    });
    expect(candidates).toEqual([]);
    expect(unchecked).toEqual(["48-50/CVC"]);
  });

  it("carries an entry it cannot fingerprint rather than dropping it", () => {
    // A file that vanishes between the count on one screen and the rows on the
    // next is the failure `property-folders.ts` records. Everything the walk
    // produced ends up in exactly one bucket.
    const { candidates, unchecked } = preexistingCandidatesOf({
      entries: [file("48-50/b.pdf"), file("48-50/a.pdf")],
      metadata: new Map(),
    });
    expect(candidates).toEqual([]);
    expect(unchecked).toEqual(["48-50/a.pdf", "48-50/b.pdf"]);
  });

  it("treats an empty page group as unmeasurable rather than as a match", () => {
    const { candidates, unchecked } = preexistingCandidatesOf({
      entries: [pages("48-50/Gol", [])],
      metadata: new Map(),
    });
    expect(candidates).toEqual([]);
    expect(unchecked).toEqual(["48-50/Gol"]);
  });
});

// ---------------------------------------------------------------------------
// The decisions
// ---------------------------------------------------------------------------

describe("checkPreexistingStage", () => {
  it("says nothing about a folder the archive does not hold", () => {
    const verdict = verdictFor([file("48-50/contract.pdf")], []);
    expect(verdict.sections).toEqual([]);
    expect(verdict.matchedCount).toBe(0);
    expect(verdict.clean).toBe(true);
  });

  it("links a matched document to its own property folder", () => {
    const verdict = verdictFor([file("48-50/contract.pdf")], [match("48-50/contract.pdf")]);
    expect(rowsOf(verdict)).toEqual([
      {
        path: "48-50/contract.pdf",
        section: "link",
        outcome: "link",
        reason: null,
        folders: ["48-50"],
      },
    ]);
    expect(verdict.clean).toBe(false);
  });

  it("links a matched `common` document to every property in the run", () => {
    const verdict = verdictFor(
      [file("common/hotarare.pdf"), file("48-50/a.pdf"), file("51-3/b.pdf")],
      [match("common/hotarare.pdf")],
    );
    expect(rowsOf(verdict)).toEqual([
      {
        path: "common/hotarare.pdf",
        section: "link",
        outcome: "link",
        reason: null,
        folders: ["48-50", "51-3"],
      },
    ]);
  });

  it("⚠️ does NOT promise a link for a `common` document when the run has no property", () => {
    // A chosen folder of `common` and `floating` only resolves no Property at
    // all, so "va fi legat de proprietate" would be a sentence the import
    // cannot honour. The screen says nothing happens, and nothing does.
    const verdict = verdictFor(
      [file("common/hotarare.pdf"), file("floating/altceva.pdf")],
      [match("common/hotarare.pdf")],
    );
    expect(rowsOf(verdict)).toEqual([
      { path: "common/hotarare.pdf", section: "skip", outcome: "skip", reason: null, folders: [] },
    ]);
  });

  it("⚠️ counts a property folder the walk found EMPTY, from the directory listing", () => {
    // Same argument `property-step-dialog.tsx` passes `topLevelDirNames` for: a
    // property subfolder holding no importable file produces no entries, so a
    // grouping built from entries alone cannot see it — and a `common`
    // document would then be told nothing happens to it while the property
    // step is about to create a Property for that very folder.
    const verdict = verdictFor([file("common/hotarare.pdf")], [match("common/hotarare.pdf")], {
      topLevelDirNames: ["48-50", "common"],
    });
    expect(rowsOf(verdict)).toEqual([
      {
        path: "common/hotarare.pdf",
        section: "link",
        outcome: "link",
        reason: null,
        folders: ["48-50"],
      },
    ]);
  });

  it("does nothing at all with a matched `floating` document", () => {
    const verdict = verdictFor([file("floating/altceva.pdf")], [match("floating/altceva.pdf")]);
    expect(rowsOf(verdict)).toEqual([
      {
        path: "floating/altceva.pdf",
        section: "skip",
        outcome: "skip",
        reason: null,
        folders: [],
      },
    ]);
  });

  // -- the identity-card exception -----------------------------------------

  it("⚠️ imports an identity card again even though the archive holds it", () => {
    // Adrian's constraint. The one in the system may be expired, and a wrong
    // name-and-size match on a card costs a PERSON rather than a document.
    const verdict = verdictFor([file("48-50/Buletin Ionescu.jpg")], [match("48-50/Buletin Ionescu.jpg")]);
    expect(rowsOf(verdict)).toEqual([
      {
        path: "48-50/Buletin Ionescu.jpg",
        section: "id-card",
        outcome: "reimport",
        reason: "id-card",
        folders: [],
      },
    ]);
  });

  it("⚠️ recognises an identity card whose name uses UNDERSCORES", () => {
    // `_` is an ASCII WORD character, so the `\b` anchors in `id-card.ts` do
    // not fire beside it: `Buletin.jpg` matched and `Buletin_Popescu.jpg`,
    // `Buletin_2.jpg` and `Carte_de_identitate.jpg` all did not. Underscore is
    // this archive's own separator — `folderNameToTitleHint` exists to turn
    // `CVC_2021-04-12` into a title — so the misses were the ordinary
    // spellings, and each one was a person's card taking the "already in the
    // system" path in silence. Found by this slice's adversarial review.
    for (const name of [
      "Buletin.jpg",
      "Buletin_Popescu.jpg",
      "Buletin_2.jpg",
      "Carte_de_identitate.jpg",
      "act_de_identitate.png",
      "CI_Popescu.jpg",
      "carte de identitate Ionescu.tif",
    ]) {
      expect({ name, idCard: looksLikeIdCardName(name) }).toEqual({ name, idCard: true });
    }
    // …and the veto and the word boundaries still hold once underscores are
    // spaces, which is the half that keeps the carve-out from swallowing the
    // whole stage.
    for (const name of [
      "Contract_vanzare.pdf",
      "Buletinul_Oficial.pdf",
      "carte_de_identitate_a_vehiculului.jpg",
      "coord 48-50.txt",
    ]) {
      expect({ name, idCard: looksLikeIdCardName(name) }).toEqual({ name, idCard: false });
    }

    const verdict = verdictFor(
      [file("48-50/Buletin_Popescu.jpg")],
      [match("48-50/Buletin_Popescu.jpg")],
    );
    expect(rowsOf(verdict).map((r) => r.reason)).toEqual(["id-card"]);
  });

  it("recognises an identity card scanned into a page folder, by either name", () => {
    // The folder name AND the title derived from it — the test is meant to
    // over-claim, because a false positive costs a duplicate and a false
    // negative costs a person.
    const byFolder = verdictFor(
      [pages("48-50/CI Popescu", ["1.jpg", "2.jpg"])],
      [match("48-50/CI Popescu")],
    );
    expect(rowsOf(byFolder).map((r) => r.reason)).toEqual(["id-card"]);

    const byHint = verdictFor(
      [pages("48-50/xyz", ["1.jpg"], "Carte de identitate Popescu")],
      [match("48-50/xyz")],
    );
    expect(rowsOf(byHint).map((r) => r.reason)).toEqual(["id-card"]);
  });

  it("does not mistake an ordinary document for an identity card", () => {
    // The veto list and the word boundaries in `id-card.ts` earn their keep
    // here: over-claiming is cheap, but claiming EVERYTHING would empty the
    // stage of value.
    const verdict = verdictFor(
      [file("48-50/Contract vanzare.pdf"), file("48-50/Buletinul Oficial.pdf")],
      [match("48-50/Contract vanzare.pdf"), match("48-50/Buletinul Oficial.pdf", "DOC00002")],
    );
    expect(rowsOf(verdict).map((r) => r.outcome)).toEqual(["link", "link"]);
  });

  // -- the coordinate exception --------------------------------------------

  it("⚠️ imports a property folder's coordinate file again", () => {
    // Not in the brief, and a correctness fix rather than caution:
    // `property_corner_source.document_id` is NOT NULL and is claimed in the
    // import loop the moment the Document exists. Skip the file and the new
    // Property keeps its corners with no recorded source — the hole #23.06
    // closed, reopened silently.
    const verdict = verdictFor([file("48-50/coord 48-50.txt")], [match("48-50/coord 48-50.txt")]);
    expect(rowsOf(verdict)).toEqual([
      {
        path: "48-50/coord 48-50.txt",
        section: "coordinates",
        outcome: "reimport",
        reason: "coordinates",
        folders: [],
      },
    ]);
  });

  it("does not carve out a coordinate-named file that belongs to no property", () => {
    // The hazard is `property_corner_source`, and only a property folder's
    // coordinate file can become one. STR-09 refuses this folder anyway; the
    // narrower test is what makes the carve-out say what it means.
    const verdict = verdictFor(
      [file("floating/coord 48-50.txt")],
      [match("floating/coord 48-50.txt")],
    );
    expect(rowsOf(verdict).map((r) => r.outcome)).toEqual(["skip"]);
  });

  it("does not carve out a plain notes file that merely ends in .txt", () => {
    // `coordinate-file.ts`'s standing promise: the name ranks and warns and
    // never filters. STR-08's `coord…` rule is what decides here, and a user's
    // `observatii.txt` is business content.
    const verdict = verdictFor([file("48-50/observatii.txt")], [match("48-50/observatii.txt")]);
    expect(rowsOf(verdict).map((r) => r.outcome)).toEqual(["link"]);
  });

  // -- shape ----------------------------------------------------------------

  it("emits all four blocks in the published order when a run produces all four", () => {
    // The `coordinates` block's position was unpinned: no case produced one
    // alongside the other three, so a catalogue reordered to put an exception
    // first would have passed.
    const verdict = verdictFor(
      [
        file("48-50/contract.pdf"),
        file("floating/a.pdf"),
        file("48-50/Buletin Ionescu.jpg"),
        file("48-50/coord 48-50.txt"),
      ],
      [
        match("48-50/contract.pdf"),
        match("floating/a.pdf", "DOC2"),
        match("48-50/Buletin Ionescu.jpg", "DOC3"),
        match("48-50/coord 48-50.txt", "DOC4"),
      ],
    );
    expect(verdict.sections.map((s) => s.id)).toEqual([
      "link",
      "skip",
      "id-card",
      "coordinates",
    ]);
  });

  it("emits blocks in the published order and rows in path order", () => {
    // The user reads this screen, presses Continuă, and may come back to it
    // after a re-check. A list that reshuffles between the two is unusable —
    // the promise every checker in this folder makes about its lists.
    const verdict = verdictFor(
      [
        file("48-50/z.pdf"),
        file("48-50/Buletin Ionescu.jpg"),
        file("floating/a.pdf"),
        file("48-50/a.pdf"),
      ],
      [
        match("48-50/z.pdf"),
        match("48-50/Buletin Ionescu.jpg", "DOC2"),
        match("floating/a.pdf", "DOC3"),
        match("48-50/a.pdf", "DOC4"),
      ],
    );
    expect(verdict.sections.map((s) => s.id)).toEqual(["link", "skip", "id-card"]);
    expect(verdict.sections[0].rows.map((r) => r.path)).toEqual(["48-50/a.pdf", "48-50/z.pdf"]);
    expect(verdict.matchedCount).toBe(4);
  });

  it("⚠️ is not clean when nothing matched but something could not be checked", () => {
    // "We looked and found nothing" and "we could not look at all" are
    // different screens, and only the second is worth a click of the user's
    // time. `clean` is the conjunction, so the flow stops here rather than
    // carrying them past an unanswered question.
    const verdict = verdictFor([file("48-50/a.pdf")], [], { unchecked: ["48-50/a.pdf"] });
    expect(verdict.matchedCount).toBe(0);
    expect(verdict.unchecked).toEqual(["48-50/a.pdf"]);
    expect(verdict.clean).toBe(false);
  });

  it("ignores a match for a path this walk never produced", () => {
    // The lookup answers about the candidates it was given, but the verdict is
    // built by walking the ENTRIES — so a stale or invented path cannot add a
    // row for a file that is not being imported.
    const verdict = verdictFor([file("48-50/a.pdf")], [match("48-50/ghost.pdf")]);
    expect(verdict.sections).toEqual([]);
    expect(verdict.clean).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The screen and the loop must name the same properties
// ---------------------------------------------------------------------------

describe("propertyFolders, against what the import loop actually links", () => {
  it("⚠️ names exactly the properties `assignEntryProperties` will link the document to", () => {
    // Two independent derivations of "which property does this attach to": the
    // Pre-existing screen promises from `PreexistingRow.propertyFolders`, and
    // the import loop writes from `assignEntryProperties`. A comment in
    // `bulk-import-dialog.tsx` asserts they agree and nothing checked it — and
    // if they ever stop agreeing, the user is told a document will appear on
    // one property's page and it appears on another's, or on none.
    const entries = [
      file("48-50/contract.pdf"),
      file("51-3/plan.pdf"),
      file("common/hotarare.pdf"),
      file("floating/altceva.pdf"),
    ];
    const matched = entries.map((e, i) => match(e.path, `DOC${i}`));
    const verdict = verdictFor(entries, matched);

    const grouping = groupByPropertyFolder(entries, []);
    // The property step resolves one Property per folder; the ids are
    // arbitrary here because what is compared is WHICH folders, not their ids.
    const resolved = new Map(grouping.properties.map((g) => [g.folderName, `id:${g.folderName}`]));
    const assignment = assignEntryProperties(grouping, resolved);

    for (const section of verdict.sections) {
      for (const row of section.rows) {
        const willLinkTo = assignment.get(row.path)?.propertyIds ?? [];
        const promised = row.propertyFolders.map((folderName) => `id:${folderName}`);
        // A `reimport` row promises nothing and is imported normally, so its
        // own links are written by the ordinary path; only `link` and `skip`
        // rows are a promise about the existing document.
        if (row.outcome === "reimport") continue;
        expect({ path: row.path, promised }).toEqual({ path: row.path, promised: willLinkTo });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// What the import loop is handed
// ---------------------------------------------------------------------------

describe("preexistingDecisionsByPath", () => {
  it("⚠️ leaves the re-imported rows OUT, rather than carrying them with a flag", () => {
    // The loop's question is "is there anything to do instead of importing
    // this file". A row that is imported again is answered by the ordinary
    // path, and carrying it here would mean every reader having to remember
    // the exception — the first one to forget imports nothing for a file the
    // report promised would be imported.
    const verdict = verdictFor(
      [
        file("48-50/contract.pdf"),
        file("48-50/Buletin Ionescu.jpg"),
        file("48-50/coord 48-50.txt"),
        file("floating/a.pdf"),
      ],
      [
        match("48-50/contract.pdf"),
        match("48-50/Buletin Ionescu.jpg", "DOC2"),
        match("48-50/coord 48-50.txt", "DOC3"),
        match("floating/a.pdf", "DOC4"),
      ],
    );
    const decisions = preexistingDecisionsByPath(verdict);
    expect([...decisions.keys()].sort()).toEqual(["48-50/contract.pdf", "floating/a.pdf"]);
    expect(decisions.get("48-50/contract.pdf")?.outcome).toBe("link");
    expect(decisions.get("floating/a.pdf")?.outcome).toBe("skip");
  });

  it("hands the loop the archive's own document id", () => {
    const verdict = verdictFor([file("48-50/contract.pdf")], [match("48-50/contract.pdf", "DOC00042")]);
    const row = preexistingDecisionsByPath(verdict).get("48-50/contract.pdf");
    expect({ id: row?.documentId, code: row?.documentCode }).toEqual({
      id: "id-DOC00042",
      code: "DOC00042",
    });
  });
});

// ---------------------------------------------------------------------------
// Slice #32.06 — the archived title reaches the row
// ---------------------------------------------------------------------------
//
// ⚠️ **THIS IS THE HOP A NINTH REVIEW ROUND FOUND UNGUARDED, and it is the one
// that produces the value the two downstream guards assume exists.**
// `import-preexisting-stage.test.ts` pins that the component reads
// `row.documentTitle` and draws it in both places. Nothing pinned that
// `documentTitle` is put ON the row, or that it is the ARCHIVE's title rather
// than the folder's. Two mutants of one line — `documentTitle: null` and
// `documentTitle: titleForEntry(entry)` — each passed the entire test suite and
// `tsc`:
//
//   - `null` makes the component's `row.title !== null` guard false for every
//     row, so the title vanishes from the screen AND the saved page, and the
//     copy's promise that it is "scris pe rândul lui" becomes false for 100% of
//     rows, inside the note the user is required to tick.
//   - `titleForEntry(entry)` prints the name of the user's own folder entry —
//     a string that agrees with their folder by construction, so "check the
//     matched document is the one you meant" can never fail. Verbatim the
//     defect class the sixth round pinned one hop downstream, reached at the
//     hop above it.
//
// The whole compensating control #32.06 is sold on runs through this line.

describe("the archived title on the row (#32.06)", () => {
  const AI_TITLE = "FISA CORPULUI DE PROPRIETATE";
  const FILE = "Fisa corp proprietate 4432.jpg";

  it("carries the ARCHIVE's title, not the folder's", () => {
    const verdict = verdictFor(
      [file(`46-222per13/${FILE}`)],
      [matchTitled(`46-222per13/${FILE}`, AI_TITLE, "DOC01511")],
    );
    const rows = verdict.sections.flatMap((s) => s.rows);
    expect(rows).toHaveLength(1);
    expect(rows[0].documentTitle).toBe(AI_TITLE);
    // The folder's own name for the same entry — what the row must NOT carry,
    // and what `row.title` is for.
    expect(rows[0].title).toBe(FILE);
    expect(rows[0].documentTitle).not.toBe(rows[0].title);
  });

  it("carries a null archived title through unchanged", () => {
    // `document.title` is nullable, and `matchArchiveDocuments` deliberately
    // hands `found.title` over unfolded. The row must say null rather than
    // inventing a string, because the component prints nothing for null and the
    // copy promises a title only "when the archived document has one".
    const verdict = verdictFor(
      [file(`46-222per13/${FILE}`)],
      [matchTitled(`46-222per13/${FILE}`, null, "DOC01511")],
    );
    const rows = verdict.sections.flatMap((s) => s.rows);
    expect(rows[0].documentTitle).toBeNull();
  });
});
