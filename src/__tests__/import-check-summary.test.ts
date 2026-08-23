/**
 * What a clean check says it looked at.   (Slice #29.11)
 *
 * `src/lib/import/check-summary.ts` turns a walk into the numbers the three
 * clean-check cards print. Nothing here decides anything — the verdicts do that
 * — so the only way these functions can fail is by counting the wrong thing,
 * quietly, under a label a business user believes.
 *
 * Four claims are pinned, and every one of them is a bug that shipped once
 * somewhere in this folder:
 *
 *  1. a page group is MANY files and ONE document, in both directions;
 *  2. a property folder that holds nothing importable is still a property
 *     folder — `groupByPropertyFolder` records that exact defect, and the
 *     shared-folder row had it a second time until an adversarial round;
 *  3. the rule counts are read from the frozen ID lists, so no sentence
 *     anywhere has to be edited when a rule is added or retired;
 *  4. the folder-name reading matches `parsePropertyFolderName` — positional,
 *     with the description discarded — because the whole point of showing it is
 *     that the user can see the import disagreeing with what they meant.
 */

import {
  summariseConstraints,
  summariseDuplication,
  summariseStructure,
} from "@/lib/import/check-summary";
import {
  CONSTRAINT_RULE_IDS,
  CONSTRAINT_SCOPES,
  constraintRulesInScope,
} from "@/lib/import/constraint-rules";
import { DUPLICATION_RULES, DUPLICATION_RULE_IDS } from "@/lib/import/duplication-rules";
import {
  RULE_SCOPES,
  STRUCTURE_RULE_IDS,
  rulesInScope,
} from "@/lib/import/structure-rules";
import type {
  DirectoryObservation,
  DroppedFile,
  FSEntry,
  FSFileEntry,
  FSPageGroupEntry,
} from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function file(path: string): FSFileEntry {
  const parts = path.split("/");
  const name = parts[parts.length - 1];
  return {
    kind: "file",
    name,
    path,
    pathParts: parts.slice(0, -1),
    handle: { name } as FSFileEntry["handle"],
  };
}

function pageGroup(path: string, pageNames: string[]): FSPageGroupEntry {
  const parts = path.split("/");
  return {
    kind: "page-group",
    name: parts[parts.length - 1],
    path,
    pathParts: parts,
    handles: pageNames.map((n) => ({ name: n }) as FSPageGroupEntry["handles"][number]),
    titleHint: parts[parts.length - 1],
  };
}

function obs(over: Partial<DirectoryObservation> = {}): DirectoryObservation {
  const pathParts = over.pathParts ?? [];
  return {
    path: over.path ?? pathParts.join("/"),
    pathParts,
    depth: over.depth ?? pathParts.length,
    keptNames: over.keptNames ?? [],
    dirNames: over.dirNames ?? [],
    dropped: over.dropped ?? [],
    becamePageGroup: over.becamePageGroup ?? false,
  };
}

function dropped(path: string): DroppedFile {
  const name = path.split("/").pop()!;
  return {
    name,
    path,
    reason: "ignored-extension",
    handle: { name } as DroppedFile["handle"],
  };
}

/** The folder from #29.01's observed run, which is what this slice is about. */
const OBSERVED = "47per2-225per3per24-2000 Hascu";

// ---------------------------------------------------------------------------
// summariseStructure
// ---------------------------------------------------------------------------

describe("summariseStructure", () => {
  it("⚠️ counts the same rules the screen listed, not a number in prose", () => {
    // The claim on the card is "these are the rules that ran", and the rules the
    // user read are the ones the panel renders — `RULE_SCOPES` × `rulesInScope`.
    // Comparing against `STRUCTURE_RULE_IDS.length` alone would be comparing the
    // implementation with itself; this is the other side of the catalogue, and
    // it is what would catch a rule that exists but is listed under no scope.
    const listed = RULE_SCOPES.flatMap((scope) => rulesInScope(scope)).length;
    const summary = summariseStructure({ entries: [], observations: [obs()] });
    expect({ counted: summary.rulesChecked, listed }).toEqual({
      counted: STRUCTURE_RULE_IDS.length,
      listed: STRUCTURE_RULE_IDS.length,
    });
  });

  it("counts a page group as many files and one document", () => {
    const entries: FSEntry[] = [
      file(`${OBSERVED}/contract.pdf`),
      pageGroup(`${OBSERVED}/CVC`, ["001.jpg", "002.jpg", "003.jpg"]),
    ];
    const summary = summariseStructure({
      entries,
      observations: [obs({ dirNames: [OBSERVED] })],
    });
    expect({
      files: summary.filesKept,
      documents: summary.documents,
      pageGroups: summary.pageGroups,
    }).toEqual({ files: 4, documents: 2, pageGroups: 1 });
  });

  it("counts the files the walk dropped, across every directory", () => {
    const summary = summariseStructure({
      entries: [],
      observations: [
        obs({ dropped: [dropped("desen.dwg")] }),
        obs({ pathParts: ["48-50D"], dropped: [dropped("48-50D/Thumbs.db")] }),
      ],
    });
    expect(summary.filesIgnored).toBe(2);
  });

  it("⚠️ counts a property folder that holds nothing importable", () => {
    // `groupByPropertyFolder` seeds from the directory listing precisely so this
    // works — its note records the shipped bug where the Structure stage said
    // five properties and the grouping said four. This is the card's copy of
    // that test, because the card is a second reader of the same answer.
    const summary = summariseStructure({
      entries: [file("48-50D/act.pdf")],
      observations: [obs({ dirNames: ["48-50D", "40-212"] })],
    });
    expect(summary.propertyFolders).toBe(2);
  });

  it("⚠️ names a shared folder that exists but holds nothing", () => {
    // The same bug, one row down, and it was live until an adversarial round:
    // the first version tested whether any ENTRY survived under `comune`, so a
    // folder holding only a `.dwg` — or nothing at all — was reported as
    // "niciunul" while the user could see it in File Explorer.
    const summary = summariseStructure({
      entries: [file("48-50D/act.pdf")],
      observations: [obs({ dirNames: ["48-50D", "comune"] })],
    });
    expect(summary.sharedFolders).toEqual(["common"]);
  });

  it("lists shared folders in the canonical order, not the disk's", () => {
    // `dirNames` is enumeration order; on a FAT-formatted stick that is
    // creation order. A label that reads "flotante, comune" on one machine and
    // the other way round on the next is unusable as a thing to check twice.
    const summary = summariseStructure({
      entries: [],
      observations: [obs({ dirNames: ["flotante", "comune"] })],
    });
    expect(summary.sharedFolders).toEqual(["common", "floating"]);
  });

  it("accepts the legacy spellings, because the disk still carries them", () => {
    const summary = summariseStructure({
      entries: [],
      observations: [obs({ dirNames: ["common", "floating"] })],
    });
    expect(summary.sharedFolders).toEqual(["common", "floating"]);
  });

  it("reads the top-level listing, not a nested one", () => {
    // A `comune` folder INSIDE a property folder is not a shared folder, and
    // reading `dirNames` off the wrong observation would say it is.
    const summary = summariseStructure({
      entries: [],
      observations: [
        obs({ dirNames: ["48-50D"] }),
        obs({ pathParts: ["48-50D"], dirNames: ["comune"] }),
      ],
    });
    expect(summary.sharedFolders).toEqual([]);
    expect(summary.propertyFolders).toBe(1);
  });

  // -------------------------------------------------------------------------
  // The folder-name reading — the reason the card exists
  // -------------------------------------------------------------------------

  it("⚠️ splits the observed folder positionally and discards the rest", () => {
    // #29.01's folder, and the whole complaint in one assertion: a human reading
    // `2000 Hascu` sees an area and a locality; the import sees free text and
    // throws it away. Until this slice the first place that was visible was the
    // property dialog, five stages and one paid classification later.
    const [reading] = summariseStructure({
      entries: [file(`${OBSERVED}/act.pdf`)],
      observations: [obs({ dirNames: [OBSERVED] })],
    }).readings;

    expect(reading).toEqual({
      folderName: OBSERVED,
      tarlaWritten: "47per2",
      tarlaStored: "47/2",
      parcelaWritten: "225per3per24",
      parcelaStored: "225/3/24",
      description: "2000 Hascu",
    });
  });

  it("leaves an identifier alone when `per` is not between two digits", () => {
    // `perToSlash` has been digit-bounded since #28.02, and the renderer draws
    // its arrow only when the two forms differ — so a name that came through
    // untouched must come out equal, not merely similar.
    const [reading] = summariseStructure({
      entries: [],
      observations: [obs({ dirNames: ["12-superficie teren"] })],
    }).readings;
    expect(reading.parcelaWritten).toBe("superficie teren");
    expect(reading.parcelaStored).toBe("superficie teren");
  });

  it("reports no description when the name carries no second hyphen", () => {
    const [reading] = summariseStructure({
      entries: [],
      observations: [obs({ dirNames: ["48-50D"] })],
    }).readings;
    expect(reading.description).toBeNull();
  });

  it("has nothing to read for a folder that is not a property folder", () => {
    const summary = summariseStructure({
      entries: [],
      observations: [obs({ dirNames: ["Documente generale", "comune"] })],
    });
    expect(summary.readings).toEqual([]);
    expect(summary.propertyFolders).toBe(0);
  });

  it("counts the chosen folder itself among the directories walked", () => {
    // `walkFolder` observes every directory it opens including the root, so one
    // observation is the minimum a completed walk produces — an empty folder
    // still yields its own. A count that started at the children would report
    // zero for a folder that was read.
    const summary = summariseStructure({ entries: [], observations: [obs()] });
    expect(summary.directoriesWalked).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// summariseConstraints / summariseDuplication
// ---------------------------------------------------------------------------

describe("summariseConstraints", () => {
  it("⚠️ counts the same constraints the screen listed", () => {
    // Same argument as the structure one above: the other side of the
    // catalogue, so a constraint that exists under no scope is caught.
    const listed = CONSTRAINT_SCOPES.flatMap((scope) => constraintRulesInScope(scope)).length;
    expect({ counted: summariseConstraints([]).rulesChecked, listed }).toEqual({
      counted: CONSTRAINT_RULE_IDS.length,
      listed: CONSTRAINT_RULE_IDS.length,
    });
  });

  it("measures files, not documents", () => {
    const entries: FSEntry[] = [
      file("48-50D/a.pdf"),
      pageGroup("48-50D/G", ["1.jpg", "2.jpg", "3.jpg"]),
    ];
    expect(summariseConstraints(entries)).toEqual({
      rulesChecked: CONSTRAINT_RULE_IDS.length,
      filesMeasured: 4,
      documents: 2,
    });
  });
});

describe("summariseDuplication", () => {
  it("⚠️ counts the same copy rules the screen listed", () => {
    // `DUPLICATION_RULES` is what the panel renders; `DUPLICATION_RULE_IDS` is
    // what the summary counts. Two exports, and this is where they are made to
    // agree.
    expect({
      counted: summariseDuplication([]).rulesChecked,
      listed: DUPLICATION_RULES.length,
    }).toEqual({ counted: DUPLICATION_RULE_IDS.length, listed: DUPLICATION_RULE_IDS.length });
  });

  it("compares files and documents, which are the two things DUP-01 and DUP-02 compare", () => {
    const entries: FSEntry[] = [
      file("48-50D/a.pdf"),
      pageGroup("48-50D/G", ["1.jpg", "2.jpg"]),
    ];
    expect(summariseDuplication(entries)).toEqual({
      rulesChecked: DUPLICATION_RULE_IDS.length,
      filesCompared: 3,
      documents: 2,
    });
  });
});
