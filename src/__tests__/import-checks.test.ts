/**
 * Unit tests for src/lib/import/checks.ts   (Slice #24.02b, trimmed by #26.02 and #26.05)
 *
 * The report's whole value is that a user believes it, so the tests that
 * matter are the ones pinning what a finding CLAIMS: that its counts and its
 * path list agree, and that a rule stays silent on a folder behaving as
 * intended. A checker that shouts at everything is the same as no checker.
 *
 * ⚠️ **What #26.02 removed from this file, and why nothing replaced it here.**
 * Two describe blocks are gone — the near-miss classification (S-03, S-04,
 * S-05, S-07) and the page-order hazards (S-09, S-10) — along with the S-16
 * duplicate-archive block. Those rules now live as STR-01 and STR-10 … STR-14
 * in `structure-rules.ts`, and their tests as
 * `src/__tests__/import-structure-check.test.ts`. They did not merely move:
 * each was an ADVISORY guess about a folder shape nobody had agreed on, and
 * each is now a rule that blocks until the folder complies. A test asserting
 * "this is loud" would be testing the wrong contract.
 *
 * ⚠️ **And what #26.05 removed, for the same reason one stage later.** F-08,
 * F-09 and F-02 from the T1 block, and two of the file rules (F-05, F-07), are
 * now CON-01 … CON-06 in `constraint-rules.ts`, tested in
 * `import-constraint-check.test.ts`.
 *
 * ⚠️ **And what #34.12 removed, which is the third kind of removal in this
 * file.** F-11 came back from #26.05's list and was tested below as the one T1
 * rule that stayed. #34.06 then took the type from the file NAME at upload, at
 * serve and at AI-interpret, so an empty `File.type` costs nothing — and a
 * finding that reports a fact with no consequence is worse than no finding,
 * because the user reads it and can do nothing. So the rule is gone, and the
 * test that replaces it is the NEGATIVE: the exact input that used to produce
 * F-11 must now produce no finding at all.
 *
 * That test also pins the half of the argument that survives, in the same case
 * rather than in a second one: `metadata` is still read — by `uploadBytes`, and
 * by nothing else in this module — so the input that used to produce F-11 must
 * now produce no finding AND still produce a total. Splitting those across two
 * cases is what would let a later reader delete the "no finding" half as
 * redundant; together they say what the argument is for.
 *
 * That is also why the loud/quiet cases went when #26.02's rules did. The split
 * was measured on the three near-miss rules; with them gone only F-17 is quiet,
 * so the one surviving loudness test asserts the ORDER (loud before quiet)
 * rather than where the line sits — it had to be rewritten in #26.05, because
 * the loud finding it used to sort against was F-08, and again in #26.06, which
 * deleted F-15.
 *
 * Cross-checked against the real archive by running this module over
 * C:\dev\TEST.DATA. One aggregate count reproduces the spec's independent
 * measurement in PRE-IMPORT-RULES.md §6 exactly — 67 Office files (F-17). The
 * other, 8 irregular page groups, measured S-10 and went with it.
 *
 * The spec's third number, "15 gate files", never reproduced — it counted 0
 * from #24.04 onwards, once `.dwg/.bak/.zip/.lnk/.dwl/.dwl2` became the
 * `"ignored"` kind and the walk started removing those exact 15 files before
 * `entries` existed. They appear in the Skipped section instead. The rule that
 * counted them is CON-03 now, and it fires only for extensions the registry has
 * never heard of.
 */

import fs from "node:fs";
import path from "node:path";

import { checkFolder, FINDING_KINDS, type FileMeta } from "@/lib/import/checks";
import type { DirectoryObservation, DroppedFile, FSEntry } from "@/lib/import/folder-utils";
import { scanIcu } from "@/test-support/icu";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function obs(over: Partial<DirectoryObservation> = {}): DirectoryObservation {
  const pathParts = over.pathParts ?? ["Acte"];
  return {
    path: over.path ?? pathParts.join("/"),
    pathParts,
    depth: over.depth ?? pathParts.length,
    keptNames: over.keptNames ?? [],
    dirNames: over.dirNames ?? [],
    dropped: over.dropped ?? [],
    becamePageGroup: over.becamePageGroup ?? false,
    // Spread rather than defaulted: `truncated` is ABSENT on a normal
    // observation, and a fixture setting it to `undefined` explicitly would
    // still satisfy `"truncated" in obs`.
    ...(over.truncated === undefined ? {} : { truncated: over.truncated }),
  };
}

function file(path: string): FSEntry {
  const name = path.split("/").pop()!;
  return {
    kind: "file",
    name,
    path,
    pathParts: path.split("/").slice(0, -1),
    handle: { kind: "file", name, getFile: async () => new File([], name) },
  };
}

/** T1 metadata, keyed the way `metadataKeyFor` keys it. */
const meta = (entries: [string, number, string][]) =>
  new Map<string, FileMeta>(entries.map(([p, size, type]) => [p, { size, type }]));

function dropped(path: string, reason: DroppedFile["reason"]): DroppedFile {
  const name = path.split("/").pop()!;
  return {
    name,
    path,
    reason,
    handle: { kind: "file", name, getFile: async () => new File([], name) },
  };
}

function run(input: {
  entries?: FSEntry[];
  observations?: DirectoryObservation[];
  metadata?: Map<string, FileMeta>;
}) {
  return checkFolder({
    entries: input.entries ?? [],
    observations: input.observations ?? [],
    metadata: input.metadata,
  });
}

const kinds = (r: ReturnType<typeof run>) => r.findings.map((f) => f.kind);
const find = (r: ReturnType<typeof run>, kind: string) =>
  r.findings.find((f) => f.kind === kind);

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("multi-property root (S-01, retired)", () => {
  // S-01 warned that every document in the picked folder would be merged into
  // one Property. #26.07 made that false — one Property per property
  // subfolder — and it was finally retired rather than reworded, because the
  // shape it detected is now the intended one. These two tests are the guard
  // against it coming back: STR-02 permits five property folders, and five
  // must be silent here.
  it("stays silent for a root full of property-shaped folders", () => {
    const r = run({
      observations: [
        obs({ pathParts: [], path: "", depth: 0, dirNames: ["10-38per3", "47per2-225", "58-253per1", "46-222", "48-50"] }),
      ],
    });
    expect(kinds(r)).not.toContain("multipleProperties");
  });

  it("stays silent for ordinary named subfolders", () => {
    const r = run({
      observations: [obs({ pathParts: [], path: "", depth: 0, dirNames: ["Acte", "Planuri"] })],
    });
    expect(kinds(r)).not.toContain("multipleProperties");
  });
});

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

describe("file findings", () => {
  it("⚠️ says NOTHING about two files sharing a name, since #26.06", () => {
    // F-15 lived here from #24.02b until #26.06 moved the question to the
    // Duplication stage, which blocks and matches on name AND size. This is
    // the negative half of that move, and it is worth a test because the
    // failure it guards is silent: a report that quietly grew the finding back
    // would put an advisory sentence about copies on the Evaluation screen,
    // one stage AFTER a blocking stage has already refused every folder that
    // holds any — advice about a state the user cannot be in.
    //
    // The paths below share a name and would have been F-15; nothing here may
    // mention them.
    const r = run({ entries: [file("A/fisa.jpg"), file("B/fisa.jpg"), file("C/alt.jpg")] });
    expect(kinds(r)).toEqual([]);
  });

  it("keeps the Office note ADVISORY, and says nothing about a plain text file", () => {
    // ⚠️ THE decision #26.05 made about this file. Every other file rule became
    // a blocking constraint; this one did not, because an Office file imports
    // faithfully — it is stored and downloadable, and only its TEXT is
    // unreadable. A blocking version would tell a business user to delete every
    // Word document in their archive before importing anything.
    const r = run({ entries: [file("nota.docx"), file("contacte.txt"), file("acte.pdf")] });
    const f = find(r, "officeFiles")!;
    expect(f.loudness).toBe("quiet");
    expect(f.paths).toEqual(["nota.docx"]);
  });

  it("no longer speaks for the rules that became constraints", () => {
    // The other half of #26.02's warning about drift, applied to #26.05: a rule
    // that moved must STOP answering here, or the user meets the same file
    // twice — once as a blocking constraint at the Constraints stage and once
    // as advice on the Evaluation screen it has already passed.
    //
    // ⚠️ `toEqual([])` and not `expect.not.arrayContaining([...])`, which is
    // what stood here until #34.12. Jest's `not.arrayContaining` fails only
    // when the whole list is a SUBSET of what came back, so four of those five
    // rules could have come back and this case would still have been green —
    // and it named exactly the five it knew about, so a sixth returning rule
    // was invisible by construction. The fixture below is chosen to produce no
    // finding at all, so the strict form is available and says more.
    const r = run({
      entries: [file("a.xyz"), file("IMG_1.heic"), file("big.jpg"), file("gol.jpg")],
      metadata: meta([
        ["a.xyz", 100, "application/octet-stream"],
        ["IMG_1.heic", 100, "application/octet-stream"],
        ["big.jpg", 40 * 1024 * 1024, "image/jpeg"],
        ["gol.jpg", 0, "image/jpeg"],
      ]),
      observations: [obs({ dropped: [dropped("Acte/folder.jpg", "system-file")] })],
    });
    expect(kinds(r)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T1 — the negative, since #34.12 deleted the last rule that read it
// ---------------------------------------------------------------------------

describe("T1 — no rule reads File metadata any more (F-11, deleted by #34.12)", () => {
  it("⚠️ says NOTHING about a file whose type Windows did not report", () => {
    // This is F-11's own input, kept as the negative half of its deletion.
    //
    // ⚠️ `.tif` and not `.jpg`, and the difference is why the fixture is worth
    // preserving even though the rule is gone. `File.type` comes from the
    // extension by way of the OS registry — Chromium hard-codes `.jpg` and
    // falls through to the registry for `.tif`/`.bmp` — so a `.jpg` with an
    // empty type is a state the browser does not produce and a test built on
    // one would prove nothing. A `.tif` on a machine with no registry entry is
    // the case that actually happens, and it is a perfectly good archival scan.
    //
    // Since #34.06 the recorded type is derived from the file NAME at upload,
    // at serve and at AI-interpret, so this file loses nothing: there is no
    // consequence left to report, and a sentence naming it would be a sentence
    // the user can do nothing with. `toEqual([])` and not `not.toContain`,
    // because the failure worth catching is a REPLACEMENT finding under some
    // other kind, and a negative assertion would sail straight past it.
    const r = run({
      entries: [file("Plan.tif")],
      metadata: meta([["Plan.tif", 400_000, ""]]),
    });
    expect(kinds(r)).toEqual([]);
    // …and the argument that used to feed F-11 is still read — by `sumBytes`,
    // which is now the only thing in this module that touches `metadata`.
    // `describe("uploadBytes")` below owns that contract; the point of asserting
    // it HERE, on this input, is that the two halves are one statement, on one
    // folder: no finding, and still a total.
    //
    // ⚠️ Not "still read by the forecast", which would be false. Both panels
    // show `uploadBytesToImport`, which `import-wizard.tsx` computes itself
    // over the entries it will actually import; `report.uploadBytes` is the
    // whole-folder sum and its header says deliberately so. As of #34.12 it has
    // no on-screen consumer at all — see the #34.12 handover.
    expect(r.uploadBytes).toBe(400_000);
  });

  // ⚠️ **Two more cases stood here and are gone rather than reworked**, and
  // both were load-bearing only while F-11 was:
  //
  //  - "ignores an empty type on a file nothing would have read anyway"
  //    (`nota.docx`) pinned the rule's POPULATION — `isReadableByAi`, i.e.
  //    image-or-pdf. With no rule and no helper there is no population to
  //    restrict, and a case asserting that a `.docx` produces no finding
  //    asserts nothing this file does not already say twice.
  //  - "says nothing about a dropped file" pinned that the rule walked
  //    `uploadKeysOf(entries)` rather than the metadata map — a real
  //    distinction, because the map deliberately covers dropped files for
  //    CON-06. Nothing reads the map for findings now, so the empty type in
  //    that fixture was inert and only the drop mattered; the drop is still
  //    pinned, on a different fixture and for the sum rather than the
  //    findings, by `describe("uploadBytes")`'s "ignores a dropped file".
  //
  // One case that can fail beats three that cannot.
});

// ---------------------------------------------------------------------------
// The kinds and their copy
// ---------------------------------------------------------------------------

/**
 * ⚠️ **NEW IN #34.12, AND IT IS THE ONLY THING GUARDING THE HALF OF THAT SLICE
 * THAT LIVES IN JSON.** Deleting F-11 meant deleting one `FindingKind` member
 * and one message key in each of two locales, and until this block nothing
 * anywhere connected the three. `report-sections.tsx` resolves the sentence
 * with ``t(`finding.${finding.kind}`)`` — the key is built at run time, so
 * `tsc` never sees it and no suite counted it.
 *
 * What that costs when it goes wrong is not a crash. `DEFAULT_LOCALE` is
 * `ro-RO`, which does NOT fall back to English, so a kind whose copy is missing
 * renders the literal text `adminImport.wizard.report.finding.<kind>` into the
 * Evaluation screen — and the reverse, an orphaned key, is silent for ever.
 * Both directions, and both locales, for that one question.
 *
 * ⚠️ **WHAT IT DELIBERATELY DOES NOT CHECK, AND WHY.** It does not compare each
 * message's ICU arguments against the `counts` the rule actually supplies, the
 * way `import-structure-rules.test.ts` does for its catalogue. That check is
 * the stronger one and it belongs here — but it goes red today on a finding
 * this slice is not allowed to touch: `truncationFindings` supplies
 * `{ places, limit }` for all three S-17 kinds and no locale's copy names
 * `places`. Adding the guard means either changing S-17's copy or dropping a
 * count from a surviving rule, which is a decision about another finding. It is
 * in the #34.12 handover as noticed-not-fixed; do not read its absence as a
 * judgement that argument drift does not matter.
 *
 * ⚠️ And it covers ONE key surface. `report-sections.tsx` builds a second one
 * the same way — ``t(`skippedReason.${reason}`)`` — and nothing ties
 * `IgnoredReason` to its three keys in either locale. Closing that is smaller
 * than it was here: `groupSkipped` already holds all three members in display
 * order, typed `IgnoredReason[]`, so it wants `as const` + a freeze + an
 * export rather than a new list. Not this slice's to do; do not read "the
 * finding keys are guarded" as "the component's keys are guarded".
 */
const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

function findingCopy(localeFile: string): Record<string, string> {
  const raw = fs.readFileSync(path.join(process.cwd(), "messages", localeFile), "utf8");
  const messages = JSON.parse(raw) as Record<string, unknown>;
  const block = ["adminImport", "wizard", "report", "finding"].reduce<unknown>(
    (node, part) =>
      node !== null && typeof node === "object"
        ? (node as Record<string, unknown>)[part]
        : undefined,
    messages,
  );
  if (block === null || typeof block !== "object") {
    throw new Error(`${localeFile} has no adminImport.wizard.report.finding block`);
  }
  return block as Record<string, string>;
}

/**
 * The copy for one kind, or a failure that says which kind and which file.
 *
 * ⚠️ Jest does not stop at the first failing case, so when the parity case
 * above goes red the three below run anyway — and `scanIcu(undefined)` dies
 * inside the parser with "Cannot read properties of undefined", naming neither
 * the kind nor the locale. The one thing worse than a red suite is three reds
 * that do not say what is missing.
 */
function copyFor(localeFile: string, kind: string): string {
  const message = findingCopy(localeFile)[kind];
  if (typeof message !== "string") {
    throw new Error(`${localeFile} has no copy for finding kind "${kind}"`);
  }
  return message;
}

describe("every finding kind has copy, and every copy has a kind", () => {
  it("keeps the catalogue frozen, because `as const` does not survive to runtime", () => {
    // ⚠️ Convention, not a live hazard, and `checks.ts` says so too: this suite
    // is the array's only runtime reader — the engine never touches it — so an
    // unfrozen one could only be re-ordered under this file's own feet. Frozen
    // because every other catalogue in `src/lib/import/` is, and because that
    // stops being true the day the engine does read it.
    expect(Object.isFrozen(FINDING_KINDS)).toBe(true);
  });

  it.each(LOCALES)("%s carries exactly the kinds the catalogue declares", (localeFile) => {
    // Sorted and compared whole rather than membership-tested one way: a
    // one-way check passes an orphan, and an orphan is what a half-done
    // deletion leaves behind. F-11's key was removed from BOTH files in
    // #34.12; putting it back in either one must fail here.
    expect(Object.keys(findingCopy(localeFile)).sort()).toEqual([...FINDING_KINDS].sort());
  });

  it("interpolates the same arguments in both locales", () => {
    // A key present in both files is not the same as a key that says the same
    // thing. `counts` is built per-kind in `checks.ts` and handed to
    // `t(\`finding.${kind}\`, counts)`; a locale that names an argument the
    // other does not is a locale whose sentence has a hole in it.
    for (const kind of FINDING_KINDS) {
      expect([...scanIcu(copyFor("ro-RO.json", kind)).args].sort()).toEqual(
        [...scanIcu(copyFor("en-GB.json", kind)).args].sort(),
      );
    }
  });

  it("declares one, few and other in every Romanian plural", () => {
    // Romanian declares one (1), few (0, and anything ending 1–19 in its last
    // hundred except 1 itself — so 101 and 118 are `few`, 120 is not) and other
    // (everything else). A message written with only one/other renders
    // "20 fișiere" where it must read "20 de
    // fișiere" — and `few`, not `other`, is the ZERO case. Under
    // `DEFAULT_LOCALE = ro-RO` there is no English to fall back to, so a
    // missing arm is what the user reads.
    for (const kind of FINDING_KINDS) {
      for (const block of scanIcu(copyFor("ro-RO.json", kind)).plurals) {
        expect(block.categories).toEqual(expect.arrayContaining(["one", "few", "other"]));
      }
    }
  });

  it("declares one and other in every English plural", () => {
    // ⚠️ **This one is EMPTY today and that is worth saying rather than
    // hiding**, because a case that cannot fail is the shape this file has
    // twice removed. No en-GB finding message uses `plural` at all — the two
    // that interpolate a count do it bare, so "{folders} Windows system
    // folders" reads "1 Windows system folders" for one. en-GB is the
    // development locale and `ro-RO` is what ships, so that is a copy defect
    // rather than a bug, and rewording another finding's English is not
    // #34.12's to do. The case stays because it goes live the moment anyone
    // fixes it — and its Romanian sibling above is live now, on two kinds.
    for (const kind of FINDING_KINDS) {
      for (const block of scanIcu(copyFor("en-GB.json", kind)).plurals) {
        expect(block.categories).toEqual(expect.arrayContaining(["one", "other"]));
      }
    }
  });
});

describe("uploadBytes", () => {
  it("sums every file the run will upload", () => {
    const r = run({
      entries: [file("a.jpg"), file("b.jpg")],
      metadata: meta([["a.jpg", 1000, "image/jpeg"], ["b.jpg", 2500, "image/jpeg"]]),
    });
    expect(r.uploadBytes).toBe(3500);
  });

  it("ignores a dropped file, which nothing is going to upload", () => {
    // The metadata map deliberately covers dropped files — CON-06 needs a
    // `folder.jpg`'s size — so the sum has to restrict itself to the upload
    // set or it overstates the total. Measured on Adrian's archive: 27 of 759
    // sized files are drops, worth 11.3 MB.
    const r = run({
      entries: [file("a.jpg")],
      observations: [obs({ dropped: [dropped("Acte/plan.dwg", "ignored-extension")] })],
      metadata: meta([["a.jpg", 1000, "image/jpeg"], ["Acte/plan.dwg", 999_000, ""]]),
    });
    expect(r.uploadBytes).toBe(1000);
  });

  it("is null when the metadata pass has not run", () => {
    // Since #26.05 that is the normal state of this report until the
    // Constraints stage has been through: nothing else here reads a size.
    expect(run({ entries: [file("big.jpg")] }).uploadBytes).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Skipped
// ---------------------------------------------------------------------------

describe("skipped files", () => {
  it("groups by reason, most surprising first", () => {
    // A file the user deliberately put there outranks one they never see.
    const r = run({
      observations: [
        obs({
          dropped: [
            dropped("a/.DS_Store", "hidden"),
            dropped("a/Thumbs.db", "system-file"),
            dropped("a/plan.dwg", "ignored-extension"),
          ],
        }),
      ],
    });
    expect(r.skipped.map((g) => g.reason)).toEqual(["ignored-extension", "system-file", "hidden"]);
    expect(r.droppedCount).toBe(3);
  });

  it("reports nothing skipped for a clean folder", () => {
    expect(run({ observations: [obs()] }).skipped).toEqual([]);
  });
});

describe("paths are complete, not a sample", () => {
  it("keeps EVERY path on the finding, however many there are", () => {
    // Each rule used to cap itself with a `.slice(0, 5)`, which made the
    // downloadable report a truncated copy advertising itself as exhaustive:
    // the since-deleted F-15 rendered "86 names appear more than once" above
    // exactly five of them. Truncation is a rendering decision — the panel shows four and
    // says how many it hid; the document shows all of them.
    const entries = Array.from({ length: 40 }, (_, i) => file(`F${i}/nota.docx`));
    const f = find(run({ entries }), "officeFiles")!;
    expect(f.paths).toHaveLength(40);
    expect(f.counts.files).toBe(40);
    // The count in the sentence and the list under it must agree — that
    // mismatch is exactly what made the document misleading.
    expect(f.paths).toHaveLength(f.counts.files);
  });
});

describe("ordering", () => {
  it("puts every loud finding before every quiet one", () => {
    // #26.05 rewrote this case for the second time: it used to pair the quiet
    // F-17 against the loud F-08, and F-08 is now a constraint. The pair below
    // is chosen so the sort still has something to do — F-17 is quiet and is
    // pushed by `fileFindings`, S-17 is loud and is pushed by
    // `truncationFindings`, after it. A no-op sort would leave the quiet one
    // first.
    const r = run({
      entries: [file("nota.docx")],
      observations: [obs({ truncated: "breadth" })],
    });
    expect(r.findings.map((f) => f.kind)).toEqual(["walkTooManyFiles", "officeFiles"]);
  });
});
