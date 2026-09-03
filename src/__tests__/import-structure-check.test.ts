/**
 * Unit tests for src/lib/import/structure-check.ts   (Slice #26.02)
 *
 * This module is the first thing in the import that BLOCKS. Everything before
 * it advised and let the user proceed; a violation here sends a business user
 * to File Explorer and refuses to continue until they come back. That changes
 * which failures matter:
 *
 *  1. **A false positive is now expensive.** An advisory rule that fires on a
 *     good folder costs a line nobody acts on. A blocking rule that fires on a
 *     good folder costs an import the user cannot start, and the instruction
 *     tells them to change something that was already right. So the first test
 *     below is a fully compliant folder producing exactly zero violations, and
 *     several others are folders that must stay silent.
 *
 *  2. **A sentence with a hole in it is a bug.** #26.01 declared, per rule,
 *     which placeholders its sentence interpolates. If this module emits a
 *     violation missing one of them, `IntlMessageFormat` renders the
 *     placeholder verbatim — or throws — inside the very screen that exists to
 *     tell the user what is wrong. Every violation any fixture here produces is
 *     checked against the catalogue's declaration, so a new rule cannot ship
 *     with a mismatched payload.
 *
 *  3. **The list must not move between two checks.** The stage is a loop: read
 *     the list, fix one thing, check again. Where a rule could name several
 *     culprits the choice is fixed rather than incidental, and that is pinned
 *     rather than assumed.
 *
 *  4. **A rule may not disagree with the walk.** The observations here are
 *     hand-built, which makes it easy to write a fixture the walk would never
 *     produce and prove something untrue about it. Two shapes are easy to get
 *     wrong and are covered on purpose: a folder whose files were all DROPPED
 *     (`keptNames: []`, `dropped` full), and a folder of numbered scans that
 *     the walk does NOT merge because it has a subfolder. Where a rule
 *     delegates — STR-12 to `isPageGroupMember` — the test says so.
 *
 * WHAT IS NOT TESTED HERE
 * ──────────────────────
 *
 * The parse itself (`parsePropertyFolderName`, `needsPropertyConfirmation`,
 * `propertyIdentityOf`, the shared-folder vocabulary) belongs to
 * `structure-rules.ts` and is pinned in `import-structure-rules.test.ts`.
 * Repeating it here would be a second copy of the same claim, which is the
 * drift this slice exists to remove. What is tested here is the WIRING: that
 * this module asks the right question of the right folder and hands the answer
 * the right payload.
 *
 * ⚠️ STR-15 AND THE DEFAULT ANSWERS   (Slice #28.02)
 * ─────────────────────────────────────────────────
 *
 * STR-15 fires on any property folder whose identifiers carry no `per` until the
 * user says it is a property — which is most of the short fixture names in this
 * file (`10-20`, `1-1`, `2-2`). The wrappers below therefore answer it for every
 * depth-1 folder by default, so that a test about STR-08 is about STR-08.
 *
 * The STR-15 tests do the opposite and call the module's own functions, imported
 * under their `…Raw` names, with no answers at all. **Anything asserting that
 * STR-15 does or does not fire must use those**, or it is asserting against the
 * fixture rather than against the rule.
 */

import {
  MAX_TRUNCATION_PATHS,
  checkStructure as checkStructureRaw,
  checkStructureStage as checkStructureStageRaw,
  emitStructureViolations as emitStructureViolationsRaw,
} from "@/lib/import/structure-check";
// `displayPathOf` moved to `folder-utils.ts` in #26.05, when the Constraints
// stage became its third and fourth renderer. Its tests stay here, where the
// stage that needed it first is covered.
import { displayPathOf } from "@/lib/import/folder-utils";
import {
  STRUCTURE_RULE_BY_ID,
  STRUCTURE_RULE_IDS,
  needsPropertyConfirmation,
  type PropertyConfirmations,
  type StructureRuleId,
  type StructureViolation,
} from "@/lib/import/structure-rules";
import type { DirectoryObservation, FSFileHandle } from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * One directory as the walk would have observed it.
 *
 * `depth` and `pathParts` are DERIVED from the path rather than accepted,
 * because depth is what this module dispatches on and a fixture that sets them
 * inconsistently would test a folder that cannot exist.
 */
function obs(path: string, over: Partial<DirectoryObservation> = {}): DirectoryObservation {
  const pathParts = path === "" ? [] : path.split("/");
  return {
    path,
    pathParts,
    depth: pathParts.length,
    keptNames: [],
    dirNames: [],
    dropped: [],
    becamePageGroup: false,
    ...over,
  };
}

/**
 * Every top-level property folder in the fixture, answered "yes, it is a
 * property".   (Slice #28.02)
 *
 * ⚠️ Derived from `needsPropertyConfirmation` rather than from a list, so it
 * only ever answers a question that was actually asked. A hand-written map
 * would keep passing after a rule change that stopped asking — and would then
 * be silently answering nothing.
 *
 * ⚠️ **BOTH SOURCES OF A TOP-LEVEL NAME, and the second is not belt-and-braces.**
 * STR-15 is emitted from a depth-1 OBSERVATION, but STR-02 and STR-03 read the
 * chosen folder's `dirNames` — and most fixtures in the depth-0 block list
 * folders without observing them. Answering only the observed ones left every
 * duplicate pair in that block unconfirmed, which since this slice suppresses
 * STR-03 entirely: three tests went red for a reason that had nothing to do with
 * what they were testing.
 */
function answeredYes(
  observations: readonly DirectoryObservation[],
): PropertyConfirmations {
  const names = new Set<string>();
  for (const o of observations) {
    if (o.depth === 1) names.add(o.path);
    if (o.depth === 0) for (const d of o.dirNames) names.add(d);
  }
  return new Map(
    [...names]
      .filter((name) => needsPropertyConfirmation(name))
      .map((name) => [name, "property" as const]),
  );
}

/** The three entry points, with STR-15 answered. See the module header. */
const checkStructure = (
  observations: readonly DirectoryObservation[],
  confirmations: PropertyConfirmations = answeredYes(observations),
) => checkStructureRaw(observations, confirmations);
const emitStructureViolations = (
  observations: readonly DirectoryObservation[],
  confirmations: PropertyConfirmations = answeredYes(observations),
) => emitStructureViolationsRaw(observations, confirmations);
const checkStructureStage = (
  observations: readonly DirectoryObservation[],
  confirmations: PropertyConfirmations = answeredYes(observations),
) => checkStructureStageRaw(observations, confirmations);

/** A `DroppedFile` carries the handle so the metadata pass can size it; nothing here reads it. */
const HANDLE: FSFileHandle = {
  kind: "file",
  name: "dropped",
  getFile: async () => new File([], "dropped"),
};

const ids = (violations: readonly StructureViolation[]) => violations.map((v) => v.ruleId);

function only(violations: readonly StructureViolation[], id: StructureRuleId): StructureViolation {
  const hit = violations.find((v) => v.ruleId === id);
  if (!hit) throw new Error(`expected a ${id}, got: ${ids(violations).join(", ") || "nothing"}`);
  return hit;
}

/**
 * A folder that satisfies every rule — two properties, both shared folders, a
 * coordinate file, a page folder, and a property carrying a free description.
 *
 * ⚠️ The description used to be attached with `||` and is now attached with a
 * second dash (Slice #28.02). Spelled the old way, `48-50D||Prisecaru` is no
 * longer a description at all: it is the parcela `50D||Prisecaru`, which is a
 * different property and a fixture that no longer means what its name says.
 *
 * Reused as the base for the "stays silent" cases, so a rule that starts
 * firing on good data fails several tests at once rather than none.
 */
const COMPLIANT: DirectoryObservation[] = [
  obs("", { dirNames: ["47per2-225per3per24", "48-50D-Prisecaru", "common", "floating"] }),
  obs("47per2-225per3per24", {
    keptNames: ["coord 47per2.txt", "Extras CF.pdf"],
    dirNames: ["CVC 2019"],
  }),
  obs("47per2-225per3per24/CVC 2019", {
    keptNames: ["1.jpg", "2.jpg", "3.jpg"],
    becamePageGroup: true,
  }),
  obs("48-50D-Prisecaru", { keptNames: ["PAD.jpg"] }),
  obs("common", { keptNames: ["Procura.pdf"] }),
  obs("floating", { keptNames: ["Nota.pdf"] }),
];

// ---------------------------------------------------------------------------
// The case that matters most
// ---------------------------------------------------------------------------

describe("a compliant folder", () => {
  it("produces no violations at all", () => {
    expect(checkStructure(COMPLIANT)).toEqual([]);
  });

  it("counts common and floating as neither properties nor duplicates", () => {
    // Both shared folders sit beside the properties in COMPLIANT and neither
    // reached STR-02's count, STR-03's identity map or STR-04.
    expect(ids(emitStructureViolations(COMPLIANT))).toEqual([]);
  });

  it("says nothing about an empty pick", () => {
    // No minimum is a rule (#26.01): a `floating`-only import is legitimate,
    // and an empty folder honestly forecasts zero documents.
    expect(checkStructure([obs("")])).toEqual([]);
    expect(checkStructure([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The walk refused to read a folder
// ---------------------------------------------------------------------------

describe("a partial listing", () => {
  it("never calls an unread folder empty", () => {
    // `keptNames` and `dirNames` are empty because NOTHING WAS ENUMERATED. Read
    // naively this is an empty page folder, and STR-11 would tell the user to
    // delete a folder that may hold hundreds of documents.
    const violations = checkStructure([
      obs("", { dirNames: ["10-20"] }),
      obs("10-20", { dirNames: ["Scan"] }),
      // `budget`, not `depth`: `walkInto` only refuses on depth ABOVE
      // MAX_WALK_DEPTH (12), so a depth stop at depth 2 is a shape the walk
      // cannot produce and a fixture that proves nothing.
      obs("10-20/Scan", { truncated: "budget" }),
    ]);
    expect(ids(violations)).toEqual([]);
  });

  it("suppresses every rule that argues from the ABSENCE of a counterexample", () => {
    // STR-07 ("every file here is a numbered scan"), STR-11 ("empty") and
    // STR-14 ("the numbers run consecutively") are all claims about what is NOT
    // there, and the counterexample may be in the part nobody read.
    const violations = emitStructureViolations([
      obs("", { dirNames: ["10-20"] }),
      obs("10-20", { keptNames: ["1.jpg", "2.jpg"], dirNames: ["Scan"], truncated: "breadth" }),
      obs("10-20/Scan", { keptNames: ["7.jpg", "9.jpg"], truncated: "breadth" }),
      obs("10-20/Goala", { truncated: "breadth" }),
    ]);
    expect(ids(violations)).toEqual([]);
  });

  it("⚠️ still reports what the partial listing already proves", () => {
    // The first draft skipped truncated observations outright, and this stage
    // BLOCKS — so a chosen folder holding fifty thousand loose files was waved
    // through as clean because the walk ran out of budget on the way. An
    // existential claim cannot be undone by the files nobody read.
    const violations = checkStructure([
      obs("", { keptNames: ["contract.pdf"], dirNames: ["Arhiva"], truncated: "breadth" }),
      obs("Arhiva", { keptNames: ["coord a.txt", "coord b.txt"], truncated: "breadth" }),
    ]);
    expect(ids(violations)).toEqual(["STR-01", "STR-04"]);
  });

  it("reads a folder's own name whether or not the walk got inside it", () => {
    expect(ids(checkStructure([obs(""), obs("Common", { truncated: "budget" })])))
      .toEqual(["STR-05"]);
  });
});

// ---------------------------------------------------------------------------
// Depth 0 — the chosen folder
// ---------------------------------------------------------------------------

describe("the chosen folder", () => {
  it("STR-01 — reports files sitting loose in it, with paths and a short list", () => {
    const violations = emitStructureViolations([
      obs("", { keptNames: ["contract.pdf", "plan.jpg", "nota.txt", "extra.pdf"] }),
    ]);
    const v = only(violations, "STR-01");
    expect(v.culprit).toBe("");
    expect(v.counts.files).toBe(4);
    // Complete in `related`, truncated in the sentence — the split #26.01
    // introduced after a report claimed 86 names above five of them.
    // Sorted, not in enumeration order — `walkFolder` observes BEFORE it sorts,
    // so `keptNames` arrives in whatever order the filesystem yielded.
    expect(v.related).toEqual(["contract.pdf", "extra.pdf", "nota.txt", "plan.jpg"]);
    expect(v.values.examples).toBe("contract.pdf, extra.pdf, nota.txt, …");
  });

  it("STR-01 — ignores a file the walk was going to drop anyway", () => {
    // The contract this module keeps: every rule about a folder's contents
    // counts only the files `isWalkedFileName` accepts. Blocking here would
    // send a user to rename a file Windows hides from them.
    expect(checkStructure([obs("", { keptNames: ["Thumbs.db", ".DS_Store"] })])).toEqual([]);
  });

  it("STR-02 — fires above five properties, and counts neither shared folder", () => {
    const six = ["1-1", "2-2", "3-3", "4-4", "5-5", "6-6"];
    const v = only(
      emitStructureViolations([obs("", { dirNames: [...six, "common", "floating"] })]),
      "STR-02",
    );
    expect(v.counts).toEqual({ found: 6, max: 5 });
    expect(v.related).toEqual(six);
  });

  it("STR-02 — stays silent at exactly five properties plus both shared folders", () => {
    // Seven subfolders, all legal. The obvious implementation counts
    // subfolders and rejects this.
    const violations = checkStructure([
      obs("", { dirNames: ["1-1", "2-2", "3-3", "4-4", "5-5", "common", "floating"] }),
    ]);
    expect(ids(violations)).not.toContain("STR-02");
  });

  it("STR-02 — counts a property the user has not answered STR-15 for yet", () => {
    // ⚠️ Slice #28.02 replaced this test's subject and kept its shape. It used
    // to prove that a folder whose only fault was the missing `||` still
    // counted toward the limit; the same argument now applies to a folder whose
    // STR-15 question is unanswered. It is a sixth property as far as the limit
    // is concerned, and withholding the count until the user confirms it costs
    // a whole round of the loop — the confirmation is pointless if the folder
    // has to be split out of this import anyway.
    const v = only(
      emitStructureViolationsRaw([
        obs("", { dirNames: ["1-1", "2-2", "3-3", "4-4", "5-5", "6-6"] }),
        obs("6-6"),
      ]),
      "STR-02",
    );
    expect(v.counts).toEqual({ found: 6, max: 5 });
  });

  it("STR-03 — a description no longer hides a duplicate", () => {
    // `10-20` and `10-20-copie` are the same property: since #28.02 the second
    // parses directly as tarla 10 / parcela 20 with the description `copie`,
    // and the description has never been part of the identity. This used to
    // need `identityOf` to compose the parse with a rename suggestion.
    const v = only(
      emitStructureViolations([obs("", { dirNames: ["10-20", "10-20-copie"] })]),
      "STR-03",
    );
    expect(v.culprit).toBe("10-20-copie");
    expect(v.values.other).toBe("10-20");
    expect(v.values.identity).toBe("10-20");
  });

  it("⚠️ STR-03 — and a different PARCELA is not a duplicate, however it reads", () => {
    // The mirror of the test above, and the reason the old `identityOf` had to
    // go rather than be widened. `10-20 copie` — a SPACE, not a second dash —
    // is parcela "20 copie", which is a different parcel from "20". Calling
    // those one property would tell the user to merge two folders that are not
    // the same thing.
    expect(ids(emitStructureViolations([obs("", { dirNames: ["10-20", "10-20 copie"] })])))
      .not.toContain("STR-03");
  });

  it("⚠️ STR-02 — stops counting a folder the user has said is NOT a property", () => {
    // First adversarial round of this slice. `isPropertyFolderName` is now just
    // "a dash with something on both sides", so a chosen folder holding one
    // property and five ordinary document folders was refused for holding six
    // properties — and answering "Nu este o proprietate" to all five changed
    // nothing, because the count never consulted the answers. The user was told
    // to split an archive that has one property in it, with no way out.
    const observations = [
      obs("", {
        dirNames: [
          "Acte-notariale", "Contracte-2019", "Harti-vechi",
          "Poze-teren", "Documente-scanate", "47per2-225per3",
        ],
      }),
      obs("Acte-notariale"), obs("Contracte-2019"), obs("Harti-vechi"),
      obs("Poze-teren"), obs("Documente-scanate"), obs("47per2-225per3"),
    ];
    expect(ids(emitStructureViolationsRaw(observations))).toContain("STR-02");

    const disowned = new Map(
      ["Acte-notariale", "Contracte-2019", "Harti-vechi", "Poze-teren", "Documente-scanate"]
        .map((n) => [n, "not-property" as const]),
    );
    expect(ids(emitStructureViolationsRaw(observations, disowned))).not.toContain("STR-02");
    // The five stay blocking, which is the point of a "no" — see STR-15 above.
    expect(ids(emitStructureViolationsRaw(observations, disowned)))
      .toEqual(["STR-15", "STR-15", "STR-15", "STR-15", "STR-15"]);
  });

  it("⚠️ STR-02 — still counts a property nobody has answered for", () => {
    // The other half, and the two are not the same argument. A count is a
    // FORECAST of what the import would create, so a folder the user has not
    // disowned belongs in it; withholding the limit until every question is
    // answered costs a whole round of the loop, after which the confirmations
    // may be pointless because the folder has to be split out anyway.
    const observations = [
      obs("", { dirNames: ["1-1", "2-2", "3-3", "4-4", "5-5", "6-6"] }),
      obs("1-1"), obs("2-2"), obs("3-3"), obs("4-4"), obs("5-5"), obs("6-6"),
    ];
    expect(ids(emitStructureViolationsRaw(observations))).toContain("STR-02");
  });

  it("STR-02 — does not count a folder whose name it could not read", () => {
    // Five properties and one typo is not six properties. Counting the typo
    // refuses the folder for a reason the user cannot see, and STR-04 is
    // already asking them to fix the name.
    const violations = checkStructure([
      obs("", { dirNames: ["1-1", "2-2", "3-3", "4-4", "5-5", "Documente vechi"] }),
      obs("Documente vechi"),
    ]);
    expect(ids(violations)).not.toContain("STR-02");
    expect(ids(violations)).toContain("STR-04");
  });

  it("STR-03 — names the later folder as the culprit and the first as the target", () => {
    const v = only(
      emitStructureViolations([obs("", { dirNames: ["47per2-2", "47PER2-2-copie"] })]),
      "STR-03",
    );
    // The instruction is always "move this one into that one", never the
    // reverse — otherwise two checks of an unchanged folder could disagree.
    expect(v.culprit).toBe("47PER2-2-copie");
    expect(v.values.folder).toBe("47PER2-2-copie");
    expect(v.values.other).toBe("47per2-2");
    expect(v.values.identity).toBe("47/2-2");
  });

  it("STR-03 — points three folders at the same first one, in two moves", () => {
    const violations = emitStructureViolations([
      obs("", { dirNames: ["10-20", "10-20-a", "10-20-b"] }),
    ]);
    const three = violations.filter((v) => v.ruleId === "STR-03");
    expect(three.map((v) => v.culprit)).toEqual(["10-20-a", "10-20-b"]);
    expect(three.map((v) => v.values.other)).toEqual(["10-20", "10-20"]);
    // Every member is `related`, including the one being kept.
    expect(three[0].related).toEqual(["10-20", "10-20-a", "10-20-b"]);
  });

  it("STR-03 — never compares two names it could not read", () => {
    // `propertyIdentityOf` answers null for those, and two nulls are not a
    // match. Otherwise "Arhiva" and "Documente" would be the same property.
    const violations = checkStructure([
      obs("", { dirNames: ["Arhiva", "Documente"] }),
      obs("Arhiva"),
      obs("Documente"),
    ]);
    expect(ids(violations).filter((id) => id === "STR-03")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Depth 1 — a property folder, common, floating
// ---------------------------------------------------------------------------

describe("a top-level folder", () => {
  const top = (name: string, over: Partial<DirectoryObservation> = {}) =>
    emitStructureViolations([obs("", { dirNames: [name] }), obs(name, over)]);

  it("STR-04 — a name with nothing cadastral in it is renamed or moved", () => {
    const v = only(top("Documente generale"), "STR-04");
    expect(v.culprit).toBe("Documente generale");
    expect(v.values).toEqual({ folder: "Documente generale" });
  });

  it("STR-05 — a misspelt shared folder gets the rename, not the lecture", () => {
    const v = only(top("Comune"), "STR-05");
    expect(v.values).toEqual({ folder: "Comune", expected: "comune" });
    // STR-04 and STR-05 are mutually exclusive by construction (#26.01).
    expect(ids(top("Comune"))).not.toContain("STR-04");
  });

  it("⚠️ STR-05 corrects a miscased LEGACY folder to the CANONICAL name", () => {
    // Slice #26.11. `sharedFolderNearMiss` answers the identity `"common"`,
    // which that slice stopped being a spelling — and `expected` is
    // interpolated straight into "redenumiți-l exact „{expected}”". Passing the
    // identity through would tell a Romanian user to type an English word the
    // rules screen never showed them, which is precisely what the slice
    // removed. So `Common` is corrected forward to `comune`, not back.
    const v = only(top("Common"), "STR-05");
    expect(v.values).toEqual({ folder: "Common", expected: "comune" });
  });

  it("⚠️ says nothing at all about a legacy `common` / `floating` folder", () => {
    // Every archive prepared before #26.11 is spelled this way — Adrian's
    // included, and it was mid-import when the rename landed. A legacy folder
    // IS a shared folder: no STR-04, no STR-05, no deprecation nag. A warning
    // nobody can act on without a morning of renaming is worse than the
    // inconsistency it reports.
    //
    // ⚠️ **Slice #32.19 (finding S-08) changed the COPY and deliberately left
    // this assertion exactly as it was.** The finding was that the tolerance was
    // silent — the rules screen taught `comune` and said nothing about `common`,
    // so `Comune` was refused where `common` passed and neither answer could be
    // predicted from the text. STR-05's requirement and example now name the
    // English spellings and say they are being retired; the RUN still says
    // nothing, which is this test. Withdrawing the tolerance instead would send
    // `common` to STR-04 — "rename it to tarla-parcela or move the files out" —
    // which is a worse instruction, on every archive Ciprian has prepared.
    for (const name of ["common", "floating"]) {
      expect(ids(top(name, { keptNames: ["Procura.pdf"] }))).toEqual([]);
    }
  });

  it("⚠️ says nothing about the canonical `comune` / `flotante` either", () => {
    for (const name of ["comune", "flotante"]) {
      expect(ids(top(name, { keptNames: ["Procura.pdf"] }))).toEqual([]);
    }
  });

  it("⚠️ a description attached with a dash is now simply correct", () => {
    // STR-06's whole subject. `47per2-225per3per24-2716 Prisecaru` was the
    // headline example of a folder needing a rename; since #28.02 it is what
    // the product asks for, and nothing at all is reported about it.
    expect(ids(top("47per2-225per3per24-2716 Prisecaru"))).toEqual([]);
    // …including the folder from the slice description, which the old cadastral
    // grammar refused outright as STR-04.
    expect(ids(top("40-212per40IE55821-Busuioc Ion"))).toEqual([]);
  });

  it("⚠️ `||` is read as ordinary characters and produces no finding of its own", () => {
    // It lands inside the parcela and is otherwise unremarkable: no STR-04, no
    // rename, no mention. What it changes is the IDENTITY, which is pinned in
    // `import-structure-rules.test.ts`; that no shipped SENTENCE offers `||`
    // back to the user is pinned in the copy tests of both suites.
    expect(ids(top("48-50D||Livada"))).toEqual([]);
    const asked = only(
      emitStructureViolationsRaw([
        obs("", { dirNames: ["48-50D||Livada"] }),
        obs("48-50D||Livada"),
      ]),
      "STR-15",
    );
    // Quoted back verbatim as the parcela it now is — the folder's own name,
    // not a suggestion to spell anything that way.
    expect(asked.values).toEqual({
      folder: "48-50D||Livada",
      tarla: "48",
      parcela: "50D||Livada",
    });
  });

  it("STR-15 — asks about a property folder whose identifiers carry no per", () => {
    const v = only(
      emitStructureViolationsRaw([obs("", { dirNames: ["2024-Arhiva"] }), obs("2024-Arhiva")]),
      "STR-15",
    );
    expect(v.culprit).toBe("2024-Arhiva");
    // The sentence names what WOULD be created, which is how a user who meant
    // an archive sees that the system did not read it as one.
    expect(v.values).toEqual({ folder: "2024-Arhiva", tarla: "2024", parcela: "Arhiva" });
    expect(v.related).toEqual([]);
    expect(v.counts).toEqual({});
  });

  it("STR-15 — and about a genuine 48-50D, with no exception carved for it", () => {
    // The slice says so outright: nothing in a name distinguishes the two, and
    // a rule that tried would be the grammar coming back.
    expect(ids(emitStructureViolationsRaw([obs("", { dirNames: ["48-50D"] }), obs("48-50D")])))
      .toContain("STR-15");
  });

  it("STR-15 — stays silent once the user has answered that it IS a property", () => {
    const observations = [obs("", { dirNames: ["2024-Arhiva"] }), obs("2024-Arhiva")];
    const answered = new Map([["2024-Arhiva", "property" as const]]);
    expect(ids(emitStructureViolationsRaw(observations, answered))).toEqual([]);
    expect(checkStructureStageRaw(observations, answered).clean).toBe(true);
  });

  it("⚠️ STR-15 — an answer of NOT a property does NOT clear it", () => {
    // Adrian, #28.02: the system never touches the user's files, so "no" cannot
    // remove the folder. It stays blocking, and the stage swaps the question for
    // the instruction to take it out in File Explorer. A "no" that let the
    // import proceed would import the folder the user has just disowned.
    const observations = [obs("", { dirNames: ["2024-Arhiva"] }), obs("2024-Arhiva")];
    const answered = new Map([["2024-Arhiva", "not-property" as const]]);
    expect(ids(emitStructureViolationsRaw(observations, answered))).toEqual(["STR-15"]);
    expect(checkStructureStageRaw(observations, answered).clean).toBe(false);
  });

  it("STR-15 — never asks about a folder that carries per, in either half", () => {
    for (const name of ["47per2-225per3per24", "225PER3-24", "40-212per40IE55821-Busuioc Ion"]) {
      expect(ids(emitStructureViolationsRaw([obs("", { dirNames: [name] }), obs(name)])))
        .not.toContain("STR-15");
    }
  });

  it("⚠️ STR-15 — never asks about a shared folder or an unreadable one", () => {
    // Two instructions for one place is the guessing game `firstPerPlace`
    // exists to prevent, and "is this a property?" is a question with no
    // meaning for a folder already being renamed.
    for (const name of ["comune", "flotante", "common", "Comune", "Documente vechi"]) {
      expect(ids(emitStructureViolationsRaw([obs("", { dirNames: [name] }), obs(name)])))
        .not.toContain("STR-15");
    }
  });

  it("⚠️ STR-15 — survives a partial listing, unlike STR-07 and STR-11", () => {
    // It reads the folder's OWN NAME, which the walk had before it enumerated
    // anything. Suppressing it would drop the one question standing between
    // `2024-Arhiva` and a Property called tarla 2024, in exactly the run where
    // the folder was too big to read.
    expect(ids(emitStructureViolationsRaw([
      obs("", { dirNames: ["2024-Arhiva"] }),
      obs("2024-Arhiva", { truncated: "budget" }),
    ]))).toEqual(["STR-15"]);
  });

  it("⚠️ STR-15 — and before STR-03 tells the user to merge two folders", () => {
    // First adversarial round of this slice. The positional parse reads
    // `2024-Acte-notariale` and `2024-Acte-vechi` as one parcel (tarla 2024,
    // parcela `Acte`, twice), and STR-03 outranks STR-15 — so the user was shown
    // ONLY "these two folders mean the same property; keep one and move the
    // documents from the other into it". That is an irreversible merge of two
    // unrelated archives in File Explorer, and the question that would have
    // stopped it appeared a loop round later, on the folder that now held both.
    const observations = [
      obs("", { dirNames: ["2024-Acte-notariale", "2024-Acte-vechi"] }),
      obs("2024-Acte-notariale"),
      obs("2024-Acte-vechi"),
    ];
    expect(ids(emitStructureViolationsRaw(observations)).sort()).toEqual(["STR-15", "STR-15"]);

    // …and once both are confirmed as properties, STR-03 has its say — because
    // then they really are two folders naming one parcel.
    const both = new Map([
      ["2024-Acte-notariale", "property" as const],
      ["2024-Acte-vechi", "property" as const],
    ]);
    expect(ids(emitStructureViolationsRaw(observations, both))).toEqual(["STR-03"]);
  });

  it("⚠️ STR-15 — is asked BEFORE the folder's contents are rearranged", () => {
    // Catalogue order is fixing order. A folder that is both unconfirmed and
    // holds only numbered scans emits both, and the user is shown STR-15 —
    // because STR-07's fix is work that STR-15's answer may throw away.
    const observations = [
      obs("", { dirNames: ["48-50D"] }),
      obs("48-50D", { keptNames: ["1.jpg", "2.jpg"], becamePageGroup: true }),
    ];
    expect(ids(emitStructureViolationsRaw(observations)).sort()).toEqual(["STR-07", "STR-15"]);
    expect(ids(checkStructureRaw(observations))).toEqual(["STR-15"]);
  });

  it("STR-07 — fires on the folder the walk MERGES", () => {
    const merged = top("10-20", { keptNames: ["1.jpg", "2.jpg"], becamePageGroup: true });
    const v = only(merged, "STR-07");
    expect(v.counts).toEqual({ files: 2 });
    expect(v.values).toEqual({ folder: "10-20" });
  });

  it("STR-07 — and on the folder the walk EXPLODES, which is the same loss", () => {
    // ⚠️ The case a `becamePageGroup` delegation misses entirely. The walk
    // refuses to merge a folder that has a subfolder, so it emits `1.jpg` and
    // `2.jpg` as two ordinary files — two Documents titled "1" and "2". Deleted
    // S-04 used to speak here, and #26.01's rule text ("cannot ALL be numbered
    // scans") covers it; only the implementation had to catch up.
    const exploded = top("10-20", { keptNames: ["1.jpg", "2.jpg"], dirNames: ["CVC"] });
    expect(only(exploded, "STR-07").counts).toEqual({ files: 2 });
  });

  it("STR-07 — says nothing when one file carries a real name", () => {
    // The rule is ALL, not any. A property folder holding `1.jpg` beside
    // `contract.pdf` is a user who chose two separate documents, and #26.02
    // deleted S-04 rather than keep arguing with them.
    expect(ids(top("10-20", { keptNames: ["1.jpg", "contract.pdf"] })))
      .not.toContain("STR-07");
  });

  it("STR-07 — fires for common and floating too", () => {
    // The walk merges those by the same rule, and a `common` folder that
    // quietly became one document called "common" is the same loss. This is
    // why #26.02 reworded the rule's sentence away from "the property".
    expect(ids(top("common", { keptNames: ["1.jpg", "2.jpg"], becamePageGroup: true })))
      .toContain("STR-07");
  });

  it("STR-07 — says nothing about a folder whose name is not readable yet", () => {
    // Until it is renamed there is no answer to what its document would be
    // called, and STR-04 is the one instruction that place needs.
    expect(ids(top("Arhiva", { keptNames: ["1.jpg"], becamePageGroup: true })))
      .toEqual(["STR-04"]);
  });

  it("STR-08 — two coordinate files in a property, complete in related", () => {
    const v = only(
      top("10-20", { keptNames: ["coord 10-20.txt", "COORD vechi.txt", "acte.pdf"] }),
      "STR-08",
    );
    expect(v.counts).toEqual({ found: 2 });
    expect(v.values.examples).toBe("coord 10-20.txt, COORD vechi.txt");
    expect(v.related).toEqual(["10-20/coord 10-20.txt", "10-20/COORD vechi.txt"]);
  });

  it("STR-08 — one coordinate file is correct, and none is legal too", () => {
    expect(ids(top("10-20", { keptNames: ["coord 10-20.txt"] }))).toEqual([]);
    expect(ids(top("10-20", { keptNames: ["acte.pdf"] }))).toEqual([]);
  });

  it("STR-08 — a plain text file is business content, not a coordinate file", () => {
    // `isDeclaredCoordinateFile` asks for the CONVENTION, not the parse. Two
    // ordinary .txt notes are not two coordinate files.
    expect(ids(top("10-20", { keptNames: ["note.txt", "contacte.txt"] }))).toEqual([]);
  });

  it("STR-09 — a single coordinate file in a shared folder is already wrong", () => {
    const v = only(top("floating", { keptNames: ["coord ceva.txt"] }), "STR-09");
    expect(v.counts).toEqual({ found: 1 });
    expect(v.values.folder).toBe("floating");
    // The property rule would have allowed exactly this one file. Two rules,
    // two instructions, and the shared folder gets the stricter one.
    expect(ids(top("10-20", { keptNames: ["coord ceva.txt"] }))).toEqual([]);
  });

  it("STR-09 — never fires on a folder that is not a shared folder", () => {
    expect(ids(top("Arhiva", { keptNames: ["coord ceva.txt"] }))).toEqual(["STR-04"]);
  });
});

// ---------------------------------------------------------------------------
// Depth 2 — the pages of one document
// ---------------------------------------------------------------------------

describe("a page folder", () => {
  const page = (over: Partial<DirectoryObservation> = {}) =>
    emitStructureViolations([
      obs("", { dirNames: ["10-20"] }),
      obs("10-20", { dirNames: ["CVC"] }),
      obs("10-20/CVC", over),
    ]);

  it("STR-10 — a subfolder is what stops the merge", () => {
    const v = only(page({ dirNames: ["Anexe", "Vechi"], keptNames: ["1.jpg"] }), "STR-10");
    expect(v.culprit).toBe("10-20/CVC");
    expect(v.counts).toEqual({ subfolders: 2 });
    expect(v.related).toEqual(["10-20/CVC/Anexe", "10-20/CVC/Vechi"]);
  });

  it("STR-11 — a folder with nothing in it at all", () => {
    expect(ids(page())).toEqual(["STR-11"]);
  });

  it("STR-11 — ⚠️ never says 'empty, delete it' about a folder that holds files", () => {
    // The shape `walkFolder` actually produces for a folder of Windows and
    // CAD leftovers: `keptNames` empty, `dropped` full. The first draft read
    // only `keptNames` and told a business user, in Romanian, to delete a
    // folder containing `folder.jpg` — which `checks.ts` carries an entire
    // rule about (F-02) precisely because it is so often a real scan.
    const leftovers = page({
      dropped: [
        { name: "folder.jpg", path: "10-20/CVC/folder.jpg", reason: "system-file", handle: HANDLE },
        { name: "plan.dwg", path: "10-20/CVC/plan.dwg", reason: "ignored-extension", handle: HANDLE },
      ],
    });
    expect(ids(leftovers)).toEqual([]);
  });

  it("STR-11 — a folder with subfolders is not called empty", () => {
    // It has a real problem and STR-10 states it. "Delete it, or put the pages
    // into it" would be false and destructive.
    expect(ids(page({ dirNames: ["Anexe"] }))).toEqual(["STR-10"]);
  });

  it("STR-12 — an unnumbered file, and a numbered PDF, are both offenders", () => {
    // The numbered PDF is the case that proves the delegation: it reads as a
    // perfect page by the source document's wording, and `isPageGroupMember`
    // refuses it because it is not an image — so the walk would explode the
    // folder while a looser rule here said everything was fine.
    const v = only(page({ keptNames: ["1.jpg", "2.jpg", "plan.jpg", "3.pdf"] }), "STR-12");
    expect(v.counts).toEqual({ offending: 2 });
    expect(v.related).toEqual(["10-20/CVC/3.pdf", "10-20/CVC/plan.jpg"]);
  });

  it("STR-13 — reports the LOWEST colliding number and only that one", () => {
    const v = only(
      page({ keptNames: ["1.jpg", "01.jpg", "2.jpg", "002.jpg", "3.jpg"] }),
      "STR-13",
    );
    // `number` is a STRING: as a count, ICU renders "1.024" in Romanian for a
    // file called `1024.jpg`, and the user is asked to find a number that is
    // not on their disk.
    expect(v.counts).toEqual({});
    expect(v.values.number).toBe("1");
    expect(v.values.examples).toBe("01.jpg, 1.jpg");
    expect(v.related).toEqual(["10-20/CVC/01.jpg", "10-20/CVC/1.jpg"]);
  });

  it("STR-14 — names the range rather than listing the missing numbers", () => {
    // Scanner counters. A sentence trying to list 25,867 missing pages is
    // unusable at exactly the moment it matters most.
    const v = only(page({ keptNames: ["5449.jpg", "31316.jpg"] }), "STR-14");
    expect(v.counts).toEqual({ pages: 2 });
    // Strings. "de la 5.449 la 31.316" above files named `5449.jpg` and
    // `31316.jpg` is the failure this rule exists to avoid, not to cause.
    expect(v.values.lowest).toBe("5449");
    expect(v.values.highest).toBe("31316");
  });

  it("STR-14 — a gap is still a gap", () => {
    expect(only(page({ keptNames: ["1.jpg", "2.jpg", "4.jpg"] }), "STR-14").values)
      .toEqual({ folder: "CVC", lowest: "1", highest: "4" });
    expect(only(page({ keptNames: ["25.jpg", "26.jpg", "28.jpg"] }), "STR-14").values)
      .toEqual({ folder: "CVC", lowest: "25", highest: "28" });
  });

  it("⚠️ STR-14 — a run that starts above 1 is now correct   (Slice #28.02)", () => {
    // Relaxation #2, and the example the slice names. `2.jpg, 3.jpg` used to be
    // reported with an instruction to renumber from 1; a folder of pages 25–28
    // of a larger document is a real thing, and renumbering it destroys the one
    // fact its filenames carried.
    expect(ids(page({ keptNames: ["25.jpg", "26.jpg", "27.jpg", "28.jpg"] }))).toEqual([]);
    expect(ids(page({ keptNames: ["2.jpg", "3.jpg"] }))).toEqual([]);
    expect(ids(page({ keptNames: ["7.jpg"] }))).toEqual([]);
  });

  it("STR-14 — leaves a clean run alone, leading zeros and all", () => {
    expect(ids(page({ keptNames: ["001.jpg", "002.jpg", "003.jpg"] }))).toEqual([]);
    expect(ids(page({ keptNames: ["1.jpg"] }))).toEqual([]);
    expect(ids(page({ keptNames: ["025.jpg", "026.jpg"] }))).toEqual([]);
  });

  it("⚠️ STR-14 — descending is not ascending, and a duplicate is not a run", () => {
    // ⚠️ The two tests the `max - min === n - 1` shortcut needs beside it.
    // `1, 1, 3` satisfies the arithmetic and is not a run — the `Set` test is
    // what refuses it, and dropping it as "STR-13 covers that anyway" would let
    // this folder through STR-14 silently. Order on disk is not the subject:
    // `3.jpg, 2.jpg, 1.jpg` IS a valid run, because the numbers are what is
    // numbered, not the enumeration.
    expect(ids(page({ keptNames: ["1.jpg", "01.jpg", "3.jpg"] }))).toContain("STR-14");
    expect(ids(page({ keptNames: ["3.jpg", "2.jpg", "1.jpg"] }))).toEqual([]);
  });

  it("STR-14 — catches a page number too large to be an exact integer", () => {
    // #26.01 promised this file could never reach an import. It is a page file
    // to `isPageGroupMember` and has no page number, so nothing else would
    // have stopped it.
    const huge = `${"9".repeat(20)}.jpg`;
    expect(ids(page({ keptNames: ["1.jpg", huge] }))).toContain("STR-14");
  });

  it("⚠️ STR-14 — a lone page with no page number at all", () => {
    // The `Set` test's own case, and it had none: a folder holding ONE file
    // whose basename is too long to be an exact integer. `pageNumberOf` answers
    // null, so `numbers` is empty and `Set(numbers).size` is 0 against a
    // `pages.length` of 1. Nothing else in the rule would stop it — the
    // arithmetic is never even reached — and `isPageGroupMember` accepts the
    // file, so the walk would merge the folder into a one-page document whose
    // page number exists nowhere.
    const huge = `${"9".repeat(20)}.jpg`;
    expect(ids(page({ keptNames: [huge] }))).toContain("STR-14");
  });

  it("STR-14 — never quotes ∞ as a page number", () => {
    // `parseInt` of a 400-digit basename is Infinity, and a page numbered ∞ is
    // not something a user can go and look for.
    const absurd = `${"9".repeat(400)}.jpg`;
    const v = only(page({ keptNames: ["1.jpg", absurd] }), "STR-14");
    expect(v.values.highest).toBe(String(Number.MAX_SAFE_INTEGER));
  });

  it("counts only the files the walk keeps, here too", () => {
    // `["1.jpg", "2.jpg", "Thumbs.db"]` is already a clean two-page document.
    expect(ids(page({ keptNames: ["1.jpg", "2.jpg", "Thumbs.db"] }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Below a page folder
// ---------------------------------------------------------------------------

describe("depth 3 and deeper", () => {
  it("is not examined — STR-10 already moves the whole subtree", () => {
    const violations = checkStructure([
      obs("", { dirNames: ["10-20"] }),
      obs("10-20", { dirNames: ["CVC"] }),
      obs("10-20/CVC", { dirNames: ["Anexe"], keptNames: ["1.jpg"] }),
      // Holds a stray file, and its pages are 7 and nothing else — violations
      // if anything looked. Nothing does.
      obs("10-20/CVC/Anexe", { keptNames: ["plan.dwgx", "7.jpg", "9.jpg"] }),
    ]);
    expect(violations.map((v) => v.culprit)).toEqual(["10-20/CVC"]);
    expect(ids(violations)).toEqual(["STR-10"]);
  });
});

// ---------------------------------------------------------------------------
// One instruction per place
// ---------------------------------------------------------------------------

describe("checkStructure against emitStructureViolations", () => {
  const messy: DirectoryObservation[] = [
    obs("", { dirNames: ["10-20"] }),
    obs("10-20", { dirNames: ["CVC"] }),
    obs("10-20/CVC", { keptNames: ["1.jpg", "01.jpg", "plan.jpg"] }),
  ];

  it("emits every rule the folder breaks", () => {
    // Three at once: a file that is not a scan, two files sharing page 1, and
    // numbers that do not run consecutively.
    expect(ids(emitStructureViolations(messy)).sort()).toEqual(["STR-12", "STR-13", "STR-14"]);
  });

  it("shows the user exactly one, the earliest in catalogue order", () => {
    expect(ids(checkStructure(messy))).toEqual(["STR-12"]);
  });

  it("keeps places separate — one instruction each, not one in total", () => {
    const violations = checkStructure([
      obs("", { keptNames: ["loose.pdf"], dirNames: ["Arhiva", "Documente"] }),
      obs("Arhiva"),
      obs("Documente"),
    ]);
    expect(violations.map((v) => v.culprit)).toEqual(["", "Arhiva", "Documente"]);
  });
});

// ---------------------------------------------------------------------------
// The guards — what a future rule cannot get wrong quietly
// ---------------------------------------------------------------------------

/**
 * Every fixture in this file, run through the emitter.
 *
 * The two tests below need violations of every rule from somewhere, and
 * collecting them here rather than re-listing the cases means a rule added to
 * the catalogue fails the coverage test until a case for it exists.
 *
 * ⚠️ **`emitStructureViolationsRaw`, with no answers.** The wrapper answers
 * STR-15 for every property folder, which would make the rule unreachable here
 * — and "is reachable" is precisely the test this array exists for, so it would
 * have failed for the right reason with a misleading message. A rule the user
 * has to ANSWER still has to be emitted before it can be answered.
 */
const EVERY_VIOLATION: StructureViolation[] = emitStructureViolationsRaw(
  [
    // depth 0 — a loose file, six properties, and a duplicate pair
    obs("", {
      keptNames: ["loose.pdf"],
      dirNames: [
        "1-1", "2-2", "3-3", "4-4", "5-5", "6-6", "1-1-copie",
        "Common", "Documente vechi", "48-50D 2716", "common", "floating",
      ],
    }),
    obs("Common"),
    obs("Documente vechi"),
    obs("48-50D 2716", { keptNames: ["coord a.txt", "coord b.txt"] }),
    obs("common", { keptNames: ["coord c.txt"] }),
    obs("1-1", { keptNames: ["1.jpg", "2.jpg"], becamePageGroup: true }),
    obs("2-2", { dirNames: ["Goala", "Amestec", "Coliziune", "Sarite", "Cuibar"] }),
    obs("2-2/Goala"),
    obs("2-2/Amestec", { keptNames: ["1.jpg", "plan.jpg"] }),
    obs("2-2/Coliziune", { keptNames: ["1.jpg", "01.jpg"] }),
    obs("2-2/Sarite", { keptNames: ["5449.jpg", "31316.jpg"] }),
    obs("2-2/Cuibar", { dirNames: ["Mai adanc"], keptNames: ["1.jpg"] }),
  ],
  // ⚠️ The duplicate pair is CONFIRMED and `6-6` is not, because this array has
  // to reach both rules at once: STR-03 no longer compares two folders the user
  // has not called properties (an instruction to merge is not something to give
  // on a guess), and STR-15 only exists while a folder is unanswered. Answering
  // everything makes STR-15 unreachable; answering nothing makes STR-03
  // unreachable. This is the one fixture that needs both.
  new Map([
    ["1-1", "property" as const],
    ["1-1-copie", "property" as const],
  ]),
);

describe("every rule in the catalogue", () => {
  it("is reachable — no rule was declared and then never emitted", () => {
    // The failure this catches: a rule added to #26.01's catalogue, given
    // Romanian text, and never wired up here. It would render on the printed
    // listing as a promise the checker does not keep.
    const emitted = new Set(EVERY_VIOLATION.map((v) => v.ruleId));
    expect([...emitted].sort()).toEqual([...STRUCTURE_RULE_IDS].sort());
  });

  it("carries exactly the placeholders its sentence declares", () => {
    // #26.01 declares, per rule, which `counts` and `values` its sentence
    // interpolates. A violation missing one renders the placeholder verbatim
    // to a Romanian user — or throws inside the screen that exists to explain
    // what is wrong — and nothing else type-checks this.
    for (const v of EVERY_VIOLATION) {
      const rule = STRUCTURE_RULE_BY_ID.get(v.ruleId)!;
      expect({ id: v.ruleId, counts: Object.keys(v.counts).sort() })
        .toEqual({ id: v.ruleId, counts: [...rule.counts].sort() });
      expect({ id: v.ruleId, values: Object.keys(v.values).sort() })
        .toEqual({ id: v.ruleId, values: [...rule.values].sort() });
    }
  });

  it("carries a culprit that is a real path, and complete related paths", () => {
    for (const v of EVERY_VIOLATION) {
      // `""` is the chosen folder and the only empty culprit there is.
      expect(typeof v.culprit).toBe("string");
      for (const path of v.related) {
        expect(path.length).toBeGreaterThan(0);
        expect(path.startsWith("/")).toBe(false);
        expect(path.endsWith("/")).toBe(false);
      }
      // `examples` never carries more names than `related` has paths.
      const examples = v.values.examples;
      if (examples !== undefined) {
        expect(examples.split(", ").filter((s) => s !== "…").length)
          .toBeLessThanOrEqual(Math.max(v.related.length, 1));
      }
    }
  });
});

describe("the same folder, checked twice", () => {
  // ⚠️ THE SAME FOLDER, ENUMERATED IN THE OPPOSITE ORDER.
  //
  // Feeding the same literal array twice proves only that the module is pure,
  // which any implementation is. The order that actually varies is the one
  // this module does not control: `walkFolder` calls its observer BEFORE it
  // sorts `childFiles` and `childDirs`, so `keptNames` and `dirNames` reach us
  // in raw `values()` order. Reversing them is the cheapest fixture that
  // reproduces a filesystem enumerating the same folder differently.
  const walk = (order: "asIs" | "reversed"): DirectoryObservation[] => {
    const put = (names: string[]) => (order === "asIs" ? names : [...names].reverse());
    return [
      obs("", { dirNames: put(["1-1", "1-1-a", "1-1-b", "2-2"]) }),
      obs("1-1"),
      obs("1-1-a"),
      obs("1-1-b"),
      obs("2-2", { dirNames: put(["A", "B"]) }),
      obs("2-2/A", { keptNames: put(["1.jpg", "01.jpg", "2.jpg", "002.jpg"]) }),
      obs("2-2/B", { keptNames: put(["3.jpg", "5.jpg", "plan.jpg", "harta.jpg"]) }),
    ];
  };

  it("produces an identical list whichever order the folder was enumerated in", () => {
    expect(checkStructure(walk("reversed"))).toEqual(checkStructure(walk("asIs")));
    expect(emitStructureViolations(walk("reversed")))
      .toEqual(emitStructureViolations(walk("asIs")));
  });

  it("keeps the same folder of a duplicate group, whichever came first", () => {
    // STR-03's instruction is "move this one into that one". If the survivor
    // depended on enumeration order, two checks of an unchanged folder could
    // tell the user to move A into B and then B into A.
    for (const order of ["asIs", "reversed"] as const) {
      const three = emitStructureViolations(walk(order)).filter((v) => v.ruleId === "STR-03");
      expect(three.map((v) => v.culprit)).toEqual(["1-1-a", "1-1-b"]);
      expect(three.map((v) => v.values.other)).toEqual(["1-1", "1-1"]);
    }
  });

  it("lists the same example names in the same order", () => {
    for (const order of ["asIs", "reversed"] as const) {
      const v = emitStructureViolations(walk(order))
        .find((x) => x.ruleId === "STR-12" && x.culprit === "2-2/B")!;
      expect(v.values.examples).toBe("harta.jpg, plan.jpg");
    }
  });

  it("orders the list by catalogue order, which is fixing order", () => {
    const violations = checkStructure([
      obs("", { keptNames: ["loose.pdf"], dirNames: ["Arhiva", "2-2"] }),
      obs("Arhiva"),
      obs("2-2", { dirNames: ["A"] }),
      obs("2-2/A", { keptNames: ["plan.jpg"] }),
    ]);
    expect(ids(violations)).toEqual(["STR-01", "STR-04", "STR-12"]);
  });
});

// ---------------------------------------------------------------------------
// The stage's verdict   (Slice #26.04)
// ---------------------------------------------------------------------------

describe("checkStructureStage", () => {
  it("passes a compliant folder", () => {
    const verdict = checkStructureStage(COMPLIANT);
    expect(verdict.violations).toEqual([]);
    expect(verdict.truncations).toEqual([]);
    expect(verdict.clean).toBe(true);
  });

  it("passes an empty chosen folder — #26.04 decided not to refuse one", () => {
    // Recorded because it is a decision rather than an oversight: an empty
    // folder breaks no structure rule, and the Evaluation screen that follows
    // already refuses to continue on a forecast of zero documents, in a
    // sentence about what will be imported. A second refusal here would need a
    // Romanian rule for a state the next screen states better.
    const verdict = checkStructureStage([obs("")]);
    expect(verdict.clean).toBe(true);
  });

  it("answers for a walk that never ran, rather than throwing", () => {
    expect(checkStructureStage([])).toEqual({
      violations: [],
      truncations: [],
      clean: true,
      confirmedProperties: [],
    });
  });

  it("lists back the STR-15 answers the user gave, so a stray click is visible", () => {
    // ⚠️ A "yes" removes the violation, so without this the folder vanishes from
    // the panel and the click cannot be taken back — and the consequence of THAT
    // accident is `2024-Arhiva` imported as a Property with tarla 2024.
    // ⚠️ FOUR folders, and the last two are the point. A version of this test
    // with only the two confirmed ones passes even if the `=== "property"`
    // filter is deleted altogether — measured — because the other two are
    // excluded by `confirmablePropertyPath`'s own guards rather than by the
    // answer. `10-30` is asked about and unanswered; `2019-Acte` is asked about
    // and DISOWNED. Neither may appear, and without them nothing pins the half
    // of this field that it exists for: a panel that asks "is this a property?"
    // while also stating that the same folder is confirmed.
    const observations = [
      obs("", { dirNames: ["2024-Arhiva", "48-50D", "47per2-2", "10-30", "2019-Acte"] }),
      obs("2024-Arhiva"),
      obs("48-50D"),
      obs("47per2-2"),
      obs("10-30"),
      obs("2019-Acte"),
    ];
    const verdict = checkStructureStageRaw(
      observations,
      new Map([
        ["2024-Arhiva", "property" as const],
        ["48-50D", "property" as const],
        ["2019-Acte", "not-property" as const],
      ]),
    );
    // ⚠️ Sorted with `sortedForDisplay`, like every other list this module
    // produces — which is NUMERIC-aware, so `48-50D` comes before `2024-Arhiva`
    // exactly as it does in the fix list above it and in File Explorer. An
    // alphabetical expectation here would have been the test disagreeing with
    // every other list on the same screen.
    expect(verdict.confirmedProperties).toEqual(["48-50D", "2024-Arhiva"]);
    // `47per2-2` was never asked about; `10-30` was asked and not answered;
    // `2019-Acte` was asked and disowned. None of the three is a confirmation.
    expect(verdict.confirmedProperties).not.toContain("47per2-2");
    expect(verdict.confirmedProperties).not.toContain("10-30");
    expect(verdict.confirmedProperties).not.toContain("2019-Acte");
    // …and both of those still block, which is what makes the pairing coherent:
    // no folder is ever both listed as confirmed and asked about.
    expect(ids(checkStructureRaw(observations, new Map([
      ["2024-Arhiva", "property" as const],
      ["48-50D", "property" as const],
      ["2019-Acte", "not-property" as const],
    ])))).toEqual(["STR-15", "STR-15"]);
    expect(verdict.clean).toBe(false);
  });

  it("⚠️ lists back only answers to questions that are still being asked", () => {
    // The answers outlive a re-check by design — that is what stops the loop
    // re-asking after every unrelated fix. So the map can still hold a folder
    // the user has since renamed or removed, and offering a control over a
    // folder that is no longer on their disk would be a screen describing a
    // world that has moved on.
    const verdict = checkStructureStageRaw(
      [obs(""), obs("47per2-2")],
      new Map([
        ["2024-Arhiva", "property" as const],   // renamed away between checks
        ["47per2-2", "property" as const],      // never needed answering
      ]),
    );
    expect(verdict.confirmedProperties).toEqual([]);
  });

  it("REFUSES a folder the walk could not finish reading, even with no violations", () => {
    // THE reason this function exists on top of `checkStructure`. Three rules
    // are suppressed on a partial listing (STR-07, STR-11, STR-14), so an empty
    // violation list from a truncated walk means "nothing was found in the part
    // that was read". A stage that blocks must not print that as "your folder
    // is correct" — the confident-output failure this repo keeps a rule about.
    const verdict = checkStructureStage([
      obs("", { dirNames: ["1-1"] }),
      obs("1-1", { truncated: "breadth" }),
    ]);
    expect(verdict.violations).toEqual([]);
    expect(verdict.clean).toBe(false);
    expect(verdict.truncations).toEqual([{ limit: "breadth", paths: ["1-1"], count: 1 }]);
  });

  it("groups the limits worst-first, and lists every folder under each", () => {
    // `depth` and `budget` are refusals to read a directory at all; `breadth`
    // is a directory read part-way. The order is fixing order, same principle
    // as the catalogue's.
    const verdict = checkStructureStage([
      obs("", { dirNames: ["1-1", "2-2", "3-3"] }),
      obs("3-3", { truncated: "breadth" }),
      obs("2-2", { truncated: "depth" }),
      obs("1-1", { truncated: "budget" }),
      obs("1-1/x", { truncated: "depth" }),
    ]);
    expect(verdict.truncations).toEqual([
      { limit: "depth", paths: ["1-1/x", "2-2"], count: 2 },
      { limit: "budget", paths: ["1-1"], count: 1 },
      { limit: "breadth", paths: ["3-3"], count: 1 },
    ]);
  });

  it("names a sample and reports the true count, because the budgets are GLOBAL", () => {
    // `MAX_WALK_DIRECTORIES` and `MAX_WALK_ENTRIES` are budgets for the whole
    // walk, not for one directory — so once either is spent EVERY directory the
    // walk reaches afterwards emits its own truncation. A 20,000-folder archive
    // produces thousands of them, none of which is the problem. Listing them
    // all would print hundreds of pages of folder names nobody can act on, so
    // the group names ten and says how many there really were.
    // Names are zero-padded WIDE ENOUGH that they sort the same as the numbers
    // do — and the expectation is computed from the same generator rather than
    // written out, so raising the cap re-derives it instead of failing against
    // correct code.
    const name = (i: number) => `p-${String(i).padStart(4, "0")}`;
    const many = Array.from({ length: 40 }, (_, i) =>
      obs(name(i), { truncated: "budget" as const }),
    );
    const [group] = checkStructureStage([obs(""), ...many]).truncations;
    expect(group.count).toBe(40);
    // The sample is the sorted head, so two checks of an unchanged folder name
    // the same ones — which is what makes the red panel readable across a loop.
    expect(group.paths).toEqual(
      Array.from({ length: MAX_TRUNCATION_PATHS }, (_, i) => name(i)),
    );
  });

  it("keeps a limit it has never heard of, rather than dropping it into `clean`", () => {
    // `TRUNCATION_RANK` is a `Record<WalkLimit, number>`, so a fourth guard
    // added to `folder-utils.ts` cannot compile without a rank here. This pins
    // the runtime half of the same guarantee: the groups are built from what
    // was OBSERVED, never filtered against the known list, so even an unranked
    // limit reaches the verdict and keeps `clean` false. Dropping it is the one
    // outcome that turns a half-read folder into a green tick.
    const verdict = checkStructureStage([
      obs("", { dirNames: ["1-1"] }),
      obs("1-1", { truncated: "something-new" as never }),
    ]);
    expect(verdict.clean).toBe(false);
    expect(verdict.truncations.map((g) => g.limit)).toEqual(["something-new"]);
  });

  it("reports the violations AND the truncation, never one instead of the other", () => {
    const verdict = checkStructureStage([
      obs("", { keptNames: ["loose.pdf"], dirNames: ["1-1"] }),
      obs("1-1", { truncated: "budget" }),
    ]);
    expect(ids(verdict.violations)).toEqual(["STR-01"]);
    expect(verdict.truncations.map((g) => g.limit)).toEqual(["budget"]);
    expect(verdict.truncations[0].count).toBe(1);
    expect(verdict.clean).toBe(false);
  });

  it("returns exactly what checkStructure returns, unreduced and unreordered", () => {
    // The verdict must not become a second opinion about the violations. If it
    // ever filtered or re-sorted them, the screen and the saved page would
    // disagree with every test in this file.
    const messy: DirectoryObservation[] = [
      obs("", { keptNames: ["loose.pdf"], dirNames: ["Arhiva", "2-2"] }),
      obs("Arhiva"),
      obs("2-2", { dirNames: ["A"] }),
      obs("2-2/A", { keptNames: ["plan.jpg"] }),
    ];
    expect(checkStructureStage(messy).violations).toEqual(checkStructure(messy));
  });
});

describe("displayPathOf", () => {
  it("names the chosen folder itself when the culprit is the root", () => {
    // `culprit: ""` is the only empty path the contract allows, and an empty
    // string on screen names nothing at all.
    expect(displayPathOf("01.Teren CLINCENI", "")).toBe("01.Teren CLINCENI");
  });

  it("prefixes the chosen folder, because that is what Explorer shows", () => {
    expect(displayPathOf("Arhiva", "48-50D/CVC 2019")).toBe("Arhiva/48-50D/CVC 2019");
  });

  it("degrades to the bare path when no folder name is known", () => {
    // Reachable from the saved page, which may be produced before a folder has
    // ever been picked. A leading "/" would read as an absolute path.
    expect(displayPathOf("", "48-50D")).toBe("48-50D");
    expect(displayPathOf("", "")).toBe("");
  });
});
