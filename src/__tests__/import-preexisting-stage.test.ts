/**
 * The Pre-existing stage's own copy, in both locales.   (Slice #26.08)
 *
 * The notes and the outcome blocks are pinned in
 * `import-preexisting-rules.test.ts`; the decisions are pinned in
 * `import-preexisting-check.test.ts`. What is left is the chrome the stage puts
 * around them — the tick's label, four button labels, the two sentences that
 * make a failed lookup honest, and the strings the saved page is built from.
 * None of it is reachable from a note ID, so nothing else here would notice it
 * missing.
 *
 * It matters more than chrome usually does for one reason: `DEFAULT_LOCALE` is
 * `ro-RO`, so a missing key does not fall back to English — it renders the raw
 * key path into the shipping UI.
 *
 * The component itself is not rendered here. Nothing in this suite renders
 * React, and a test that did would prove the JSX compiles rather than that the
 * copy exists — which is the half that goes wrong silently.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

/** The `adminImport.preexisting` block. */
function loadCopy(file: string): Record<string, unknown> {
  const json = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { preexisting: Record<string, unknown> } };
  return json.adminImport.preexisting;
}

function at(node: Record<string, unknown>, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (n, part) =>
        n !== null && typeof n === "object" ? (n as Record<string, unknown>)[part] : undefined,
      node,
    );
}

/**
 * Every string the panel and the exporter ask for, by the exact path they use.
 *
 * Written out rather than derived from the JSON, which would only prove the
 * file agrees with itself. This list is the component's demand; the file is the
 * supply, and the last test in this suite reads the component's source to prove
 * the two have not drifted.
 */
const REQUIRED_KEYS = [
  "title",
  "intro",
  // ⚠️ Slice #32.04. The sentence that REPLACES `intro` once the archive has
  // answered clean AND the folder report under this panel has nothing to say —
  // a screen that by then has no listing, no tick and no re-check for `intro`
  // to be talking about. A missing key prints the dotted path where the
  // screen's only explanatory line should be. The two sibling panels each
  // gained theirs in #32.01 and #32.03; this is the third of the family.
  "introDone",
  // Slice #29.02 — the all-clear. This panel had none until step-through gave
  // a clean archive lookup somewhere to rest; the module header says why it
  // could not exist before.
  "clean",
  "notesTitle",
  "showNotes",
  "hideNotes",
  "acknowledge",
  "acknowledgeHint",
  "check",
  "recheck",
  "continue",
  "continueWithout",
  "reportTitle",
  // ⚠️ Slice #29.08 — the only warning in the whole flow that the NEXT click is
  // the one that costs money. It stood on the Evaluation screen until the
  // classification moved in front of it; this panel's Continuă is the press
  // that spends now, so the sentence lives beside that button.
  // The pointer to the folder report, which #29.08 moved under this panel —
  // it is the last screen before the classification is billed, so the loud
  // findings that end "Nu porniți importul" have to be readable from here.
  "readReportFirst",
  "nothingSpentYet",
  // …and the same sentence for a run that is about to pay for classification a
  // SECOND time, which is what a re-check pressed on the Evaluation screen
  // produces now that the classification happens before it.
  "spendAgain",
  "nothingToFix",
  "morePaths",
  "row.existing",
  "row.folders",
  "row.line",
  "unchecked.title",
  "unchecked.intro",
  "failed.title",
  "failed.intro",
  "failed.continueHint",
  "save.button",
  "save.hint",
  "save.filePrefix",
  "save.documentTitle",
  "save.generatedAt",
  "save.folderLabel",
  "save.rulesTitle",
  "save.violationsTitle",
  "save.allClear",
  "save.blocked",
  "save.notCheckedYet",
  "save.warningsTitle",
  "save.lookupFailed",
  "save.lookupFailedTitle",
  "save.rulesOnlyName",
] as const;

describe("the Pre-existing stage's copy", () => {
  it.each(LOCALES)("%s carries every string the panel asks for", (file) => {
    const copy = loadCopy(file);
    const missing = REQUIRED_KEYS.filter((key) => {
      const value = at(copy, key);
      return typeof value !== "string" || value.trim().length === 0;
    });
    expect(missing).toEqual([]);
  });

  it("counts things with a plural, in both locales", () => {
    // Romanian needs `few` as well as `one` and `other` — the language has a
    // third form for 2-19 — and #26.02 already shipped this exact bug once.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      // ⚠️ `nothingSpentYet` and `spendAgain` joined the list in #29.08, and
      // they are the two most money-sensitive counted strings in the whole
      // flow: they name how many images the next press sends. A reword that
      // dropped `few` would ship "se trimit 5 de imagini" — the bug #26.02
      // shipped once — with every other test here green.
      for (const key of [
        "reportTitle",
        "morePaths",
        "unchecked.intro",
        "row.folders",
        "nothingSpentYet",
        "spendAgain",
      ] as const) {
        expect(String(at(copy, key))).toContain("{count");
      }
      // ⚠️ `row.folders` interpolates the folder NAMES as well as counting
      // them, and nothing else pins that: dropping `{folders}` in a reword
      // would silently strip the property names off every linked row, on
      // screen and on the saved page both.
      expect([...scanIcu(String(at(copy, "row.folders"))).args].sort()).toEqual([
        "count",
        "folders",
      ]);
      for (const key of [
        "reportTitle",
        "unchecked.intro",
        "row.folders",
        "nothingSpentYet",
        "spendAgain",
      ] as const) {
        const [block] = scanIcu(String(at(copy, key))).plurals;
        expect({ key, arg: block?.arg }).toEqual({ key, arg: "count" });
        const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];
        expect(block.categories).toEqual(expect.arrayContaining(wanted));
      }
    }
  });

  it("⚠️ names the button the money sentence is about, by interpolation", () => {
    // Slice #32.04. `nothingSpentYet` and `spendAgain` quoted „Continuă” as a
    // literal, and the slice gave the pruned screen a primary reading
    // „Continuă la pasul «Scanare»” — so the one sentence in the flow whose job
    // is to say WHICH click costs money named a button that screen does not
    // have. Naming it by position instead was worse on every screen that is not
    // pruned, where two free buttons sit below the sentence and one of them is
    // the only re-walk of the folder there is.
    //
    // So it is `{button}`, interpolated with the same value the button renders
    // — the shape `stepGate.nextAction` uses for the same reason. This pins
    // both halves: the placeholder in the copy, and the panel passing it.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      for (const key of ["nothingSpentYet", "spendAgain"] as const) {
        const text = String(at(copy, key));
        expect({ file, key, args: [...scanIcu(text).args].sort() }).toEqual({
          file,
          key,
          args: ["button", "count"],
        });
        // ⚠️ **INSIDE EVERY PLURAL BRANCH, not once outside the block.**
        // Romanian cannot agree from outside it, and the wholeness test above
        // already refuses anything sitting outside — so a `{button}` written
        // there would take that test red rather than this one. Counted here so
        // a branch that quietly loses it cannot pass either.
        const branches = file === "ro-RO.json" ? 3 : 2;
        expect({ file, key, n: text.split("{button}").length - 1 }).toEqual({
          file,
          key,
          n: branches,
        });
        // …and the literal it replaced is not still standing beside it.
        expect({ file, key, literal: /„Continuă”|“Continue”/.test(text) }).toEqual({
          file,
          key,
          literal: false,
        });
        // ⚠️ **AND `{button}` IS NOT WRAPPED IN QUOTES, because the label it
        // receives already carries its own.** `stepGate.advance` renders
        // „Continuă la pasul «Scanare»”, so quoting the placeholder as well
        // prints a quote inside a quote inside the money sentence. The same
        // reason `stepGate.nextAction.preconditions` ends with a bare
        // `{button}`.
        expect({
          file,
          key,
          quoted: /[„“]\s*\{button\}|\{button\}\s*[”"]/.test(text),
        }).toEqual({ file, key, quoted: false });
      }
    }

    const panel = fs.readFileSync(
      path.join(process.cwd(), "src/app/admin/import/_components/import-preexisting-stage.tsx"),
      "utf8",
    );
    for (const key of ["spendAgain", "nothingSpentYet"] as const) {
      expect(panel).toContain(
        `t("${key}", { count: classificationCalls, button: pressLabel })`,
      );
    }

    // ⚠️ **AND THE THIRD SENTENCE ON THIS PANEL THAT NAMES THE PRIMARY.**
    // `readReportFirst` quoted „Continuă” as a literal and renders on the
    // FAILED screen too, where the button has said "Continuă fără această
    // verificare" since #29.02 — so it pointed a user at a control that screen
    // does not have. Fixed in passing by #32.04; no plural, so only the args
    // and the call site are pinned. (`nothingToFix` is deliberately NOT here:
    // its guard is `matchedCount > 0`, which implies a settled, non-failed,
    // non-pruned screen, so „Continuă” is exactly what the button says.)
    for (const file of LOCALES) {
      const text = String(at(loadCopy(file), "readReportFirst"));
      expect({ file, args: [...scanIcu(text).args].sort() }).toEqual({
        file,
        args: ["button"],
      });
      expect({ file, literal: /„Continuă”|“Continue”/.test(text) }).toEqual({
        file,
        literal: false,
      });
    }
    expect(panel).toContain('t("readReportFirst", { button: pressLabel })');
  });

  it("⚠️ keeps every counted chrome sentence whole, inside its plural block", () => {
    // Romanian cannot agree from outside the block, and the catalogue's version
    // of this guard walks the note sentences and never sees the chrome — which
    // is where #26.05's bug actually was.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      for (const key of [
        "reportTitle",
        "unchecked.intro",
        "nothingSpentYet",
        "spendAgain",
      ] as const) {
        const text = String(at(copy, key));
        const before = text.slice(0, text.indexOf("{"));
        const after = text.slice(text.lastIndexOf("}") + 1);
        expect({ file, key, before: before.trim(), after: after.trim() }).toEqual({
          file,
          key,
          before: "",
          after: "",
        });
      }
    }
  });

  it("names the archived document in the row, in both places it is drawn", () => {
    // `row.existing` is the screen and `row.line` is the saved page, and both
    // have to carry the CODE — it is the only handle the user has on a document
    // they cannot go and look at in File Explorer.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      expect([...scanIcu(String(at(copy, "row.existing"))).args]).toEqual(["code"]);
      expect([...scanIcu(String(at(copy, "row.line"))).args].sort()).toEqual(["code", "path"]);
    }
  });

  it("⚠️ tells the user there is nothing to PUT RIGHT, and does not cancel the blocks above it", () => {
    // The one sentence that distinguishes this stage from the three before it.
    // Each of those ends in a trip to File Explorer; this one must say the
    // opposite, or a user who has been through three fix-and-re-check loops
    // will go looking for the files to move.
    //
    // ⚠️ **But it must NOT say "the system handles it", and this slice's
    // adversarial review is why.** It is the last thing on screen before the
    // tick, so it reads as the summary of everything above it — including the
    // identity-card block, which has just asked the user to note the files and
    // check the people afterwards, and the unchecked block, which has asked
    // them to check for duplicates. A closing "there is nothing to do" cancels
    // both, and the first of them is the slice's own named constraint.
    for (const file of LOCALES) {
      // The claim is SCOPED to File Explorer in both locales — that scope is
      // the whole of what makes it true.
      const text = String(at(loadCopy(file), "nothingToFix"));
      expect({ file, scoped: text.includes("File Explorer") }).toEqual({ file, scoped: true });
    }
    expect(String(at(loadCopy("ro-RO.json"), "nothingToFix"))).toMatch(/nimic de îndreptat/i);
    expect(String(at(loadCopy("ro-RO.json"), "nothingToFix"))).not.toMatch(/se ocupă singur/i);
    expect(String(at(loadCopy("en-GB.json"), "nothingToFix"))).toMatch(/nothing for you to put right/i);
    expect(String(at(loadCopy("en-GB.json"), "nothingToFix"))).not.toMatch(/the system handles it/i);
  });

  it("⚠️ offers a way out for a match the user does not agree with", () => {
    // The match is a title and a byte count — evidence, not proof — and on a
    // `link` row a wrong match is the expensive direction: the file is not
    // imported and somebody else's document is attached to the property. See
    // `preexisting-check.ts`. Nothing on this screen can rule that out, so the
    // copy has to tell the user the one thing that clears it, and renaming the
    // file is that thing: a different title is a different key, so the system
    // imports it as new. If this sentence is ever reworded, this is the clause
    // to keep.
    expect(String(at(loadCopy("ro-RO.json"), "nothingToFix"))).toMatch(/redenumiți/i);
    expect(String(at(loadCopy("en-GB.json"), "nothingToFix"))).toMatch(/rename/i);
  });

  it("⚠️ says what carrying on without the check will cost", () => {
    // The sentence that makes "Continuă fără această verificare" honest. Without
    // it the button is an invitation to import an archive's worth of duplicates
    // with no warning — and it sits beside the button as well as inside the red
    // block, because a user scrolled to the buttons must not have to scroll
    // back up for it.
    expect(String(at(loadCopy("ro-RO.json"), "failed.continueHint"))).toMatch(/a doua oară/i);
    expect(String(at(loadCopy("en-GB.json"), "failed.continueHint"))).toMatch(/second time/i);
  });

  it("⚠️ never says the archive is empty when it was never asked, or when it did not answer", () => {
    // The worst artefact this stage can make is a dated page, carried away from
    // the screen, claiming nothing is in the archive when nobody looked.
    //
    // ⚠️ `!== save.allClear` is NOT enough on its own, and a round of review
    // said so: any reword differs from the all-clear while still reading like
    // one. Each string has to make its own positive claim — "not asked" and
    // "no answer came back" — and the two are different pages, which is the
    // distinction `PreexistingResult` exists to keep.
    const marks = {
      "ro-RO.json": { notCheckedYet: /nu s-a verificat/i, lookupFailed: /nu s-a primit/i },
      "en-GB.json": { notCheckedYet: /has not been asked/i, lookupFailed: /no answer/i },
    } as const;
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      for (const key of ["notCheckedYet", "lookupFailed"] as const) {
        const text = String(at(copy, `save.${key}`));
        expect({ file, key, marked: marks[file][key].test(text) }).toEqual({
          file,
          key,
          marked: true,
        });
        expect(`${file} ${key}`).not.toBe(`${file} ${at(copy, "save.allClear")}`);
        expect(text).not.toBe(String(at(copy, "save.allClear")));
      }
    }
  });

  it("distinguishes the first check from a re-check, and both from carrying on", () => {
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      const labels = ["check", "recheck", "continue", "continueWithout"].map((k) =>
        String(at(copy, k)),
      );
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("uses no technology language anywhere in the block, not only in the notes", () => {
    // The catalogue's guard scans the note sentences only, and #26.05's first
    // draft of `save.hint` said "o pagină HTML" — jargon, in the chrome, where
    // nothing was looking.
    const banned =
      /\b(image|application|text|video|audio)\/[a-z0-9.+-]+|\bMIME\b|\bHTML\b|\b(octeți|bytes|hash|checksum|server|endpoint)\b/i;
    for (const file of LOCALES) {
      const offenders: string[] = [];
      const walk = (node: unknown, at_: string) => {
        if (typeof node === "string") {
          if (banned.test(node)) offenders.push(at_);
          return;
        }
        if (node === null || typeof node !== "object") return;
        for (const [k, v] of Object.entries(node)) walk(v, at_ === "" ? k : `${at_}.${k}`);
      };
      walk(loadCopy(file), "");
      expect({ file, offenders }).toEqual({ file, offenders: [] });
    }
  });

  it("⚠️ asks for nothing the panel does not ask for, and vice versa", () => {
    // `REQUIRED_KEYS` claims to be "the component's demand", and it was hand
    // transcribed — so a component that started calling `t("back")` would ship
    // a dotted key path into the shipping locale with every test here still
    // green. This reads the component's own source.
    //
    // Only `t("literal")` calls are readable this way. The note and block keys
    // go through `tk(preexisting…KeyFor(...))` and are covered by the
    // catalogue's own tests, which is why they are absent here rather than
    // missing.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/admin/import/_components/import-preexisting-stage.tsx"),
      "utf8",
    );
    const asked = new Set(
      [...source.matchAll(/(?<![A-Za-z0-9_])t\(\s*"([^"]+)"/g)].map((m) => m[1]),
    );
    expect(asked.size).toBeGreaterThan(10);
    const undeclared = [...asked].filter((k) => !REQUIRED_KEYS.includes(k as never)).sort();
    expect(undeclared).toEqual([]);
    const unused = REQUIRED_KEYS.filter((k) => !asked.has(k));
    expect(unused).toEqual([]);
  });

  it("says something different in Romanian than in English", () => {
    // Romanian is the shipping locale and English is the development
    // convenience; identical strings mean the Romanian was never written.
    // Three are exempt and all three are format strings with no words in them:
    // "Folder" is the word in both languages, and `row.existing` / `row.line`
    // are an arrow between two values.
    const ro = loadCopy("ro-RO.json");
    const en = loadCopy("en-GB.json");
    const shared = ["save.folderLabel", "row.existing", "row.line"];
    for (const key of REQUIRED_KEYS) {
      if (shared.includes(key)) continue;
      expect(`${key}: ${at(ro, key)}`).not.toBe(`${key}: ${at(en, key)}`);
    }
  });
});

describe("the Pre-existing stage's copy, against its siblings", () => {
  /**
   * The strings that must NOT be a copy of an earlier stage's.
   *
   * ⚠️ An explicit list, not "everything except a few". The four panels are
   * siblings by design and several of their strings are deliberately identical
   * — "Verifică din nou" — because the whole value of the fourth loop is that
   * it costs the user nothing to learn. Asserting difference by default would
   * fail on the copy that is RIGHT. ("Alege alt folder…" was the second example
   * here until #32.04 removed the button from all six panels that carried the
   * key.)
   *
   * What is listed below is the copy that names the stage. A Pre-existing
   * screen saying "Am citit ce se consideră duplicat" over its tick is one
   * copy-paste away, and it would ask the user to confirm something they were
   * never shown.
   */
  const MUST_DIFFER = [
    "title",
    "intro",
    // ⚠️ Slice #32.04, and the two sibling suites each added theirs for the
    // same reason (#32.01, #32.03). `introDone` is the sentence a pruned screen
    // shows INSTEAD of `intro`, so it is stage-naming copy by construction —
    // and "Mai jos vedeți ce a arătat compararea fișierelor" over a screen
    // about the archive is one copy-paste away.
    "introDone",
    // ⚠️ `notesTitle` against the siblings' `rulesTitle`, because this stage
    // renamed the heading rather than reusing it: the three before it list
    // RULES the folder must satisfy and this one lists NOTES about what the
    // import will do. The comparison is still worth making — the danger is a
    // copy-paste that puts "Regulile privind duplicatele" over four sentences
    // that are not rules — so the pair is spelled out rather than dropped.
    ["notesTitle", "rulesTitle"],
    "acknowledge",
    "acknowledgeHint",
    "save.button",
    "save.filePrefix",
    "save.documentTitle",
    "save.rulesTitle",
    "save.allClear",
    "save.blocked",
    "save.notCheckedYet",
    "save.warningsTitle",
    "save.rulesOnlyName",
  ] as const satisfies readonly (string | readonly [string, string])[];

  it("names its own stage rather than repeating a sibling's", () => {
    for (const file of LOCALES) {
      const json = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
      ) as {
        adminImport: {
          structure: Record<string, unknown>;
          constraints: Record<string, unknown>;
          duplication: Record<string, unknown>;
          preexisting: Record<string, unknown>;
        };
      };
      for (const entry of MUST_DIFFER) {
        const [key, siblingKey] = typeof entry === "string" ? [entry, entry] : entry;
        const mine = at(json.adminImport.preexisting, key);
        expect({ key, mine: typeof mine }).toEqual({ key, mine: "string" });
        for (const sibling of ["structure", "constraints", "duplication"] as const) {
          const theirs = at(json.adminImport[sibling], siblingKey);
          expect({ sibling, siblingKey, theirs: typeof theirs }).toEqual({
            sibling,
            siblingKey,
            theirs: "string",
          });
          expect(`${file} ${sibling} ${key}: ${mine}`).not.toBe(
            `${file} ${sibling} ${key}: ${theirs}`,
          );
        }
      }
    }
  });

  it("keeps the loop's own words identical to its siblings', deliberately", () => {
    // The other direction, and the reason `MUST_DIFFER` is a list. These two
    // are the loop itself — the re-check and the way out — and a slice that
    // "tidied" one of them into a synonym would make the fourth stage read as a
    // different mechanism.
    //
    // `check` is NOT among them: the three stages before this one look for
    // faults in the user's folder, and this one asks the archive a question.
    // "Caută duplicate" and "Vezi ce se află deja în sistem" are different
    // actions and must not be the same words.
    for (const file of LOCALES) {
      const json = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
      ) as {
        adminImport: {
          structure: Record<string, unknown>;
          preexisting: Record<string, unknown>;
        };
      };
      // ⚠️ `chooseAnotherFolder` LEFT THIS LIST IN #32.04, with the button —
      // mid-run, a folder change is either a cancel or a restart, and the
      // wizard has both. Structure's went too, so the key exists on neither
      // side now and an identity test left here would compare two `undefined`s
      // and pass for ever.
      for (const key of ["recheck"] as const) {
        // The `typeof` first — see the Constraints suite: two `undefined`s
        // compare equal, so without it a key deleted from both sides leaves
        // this loop green for ever. (#32.04.)
        const theirs = at(json.adminImport.structure, key);
        expect({ key, theirs: typeof theirs }).toEqual({ key, theirs: "string" });
        expect(at(json.adminImport.preexisting, key)).toBe(theirs);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The wizard chrome this stage changed
// ---------------------------------------------------------------------------

/**
 * These keys live under `adminImport.wizard`, not under this stage's own block,
 * and they are pinned here because #26.08 is what made them wrong.
 *
 * Three screens outside the Pre-existing panel quote numbers that used to be
 * "every file in the folder" and now are not: the Evaluation forecast, the scan
 * summary, and the import dialog's heading. Each was reported by an adversarial
 * round as a sentence that contradicted the stage one click earlier.
 */
describe("the counts this stage changed elsewhere in the wizard", () => {
  function wizardCopy(file: string): Record<string, unknown> {
    const json = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
    ) as { adminImport: { wizard: Record<string, unknown> } };
    return json.adminImport.wizard;
  }

  it("carries every new string, in both locales", () => {
    for (const file of LOCALES) {
      const copy = wizardCopy(file);
      for (const key of [
        "forecast.alreadyInSystem",
        "statusPreexisting",
        "resumedPreexisting",
        "importDialog.donePreexisting",
        "importDialog.doneWithErrors",
      ]) {
        const value = at(copy, key);
        expect({ file, key, ok: typeof value === "string" && value.trim() !== "" }).toEqual({
          file,
          key,
          ok: true,
        });
      }
    }
  });

  it("⚠️ makes the scan summary account for all three groups", () => {
    // It read "{total} fișiere ({scannable} scanabile)" over a table whose
    // unscanned rows were not unscannable — they were already in the archive.
    // A user reconciling the header against the table found files unaccounted
    // for whichever of the two numbers was narrowed.
    for (const file of LOCALES) {
      expect([...scanIcu(String(at(wizardCopy(file), "scanComplete"))).args].sort()).toEqual([
        "preexisting",
        "scannable",
        "total",
      ]);
    }
  });

  it("⚠️ pluralises the import dialog's heading, which now reaches 0 and 1", () => {
    // `doneTitle` was a bare `{count} documente importate.` — safe while it
    // counted every settled row, and wrong the moment #26.08 split the count:
    // four of five files already in the archive renders "1 documente
    // importate", and a folder the archive holds entirely renders "0".
    for (const { file, plurals } of LOCALES.map((f) => ({
      file: f,
      plurals: f === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"],
    }))) {
      for (const key of [
        "importDialog.doneTitle",
        "importDialog.donePreexisting",
        "resumedPreexisting",
      ]) {
        const [block] = scanIcu(String(at(wizardCopy(file), key))).plurals;
        expect({ file, key, arg: block?.arg }).toEqual({ file, key, arg: "count" });
        expect(block.categories).toEqual(expect.arrayContaining(plurals));
      }
    }
  });

  it("takes both numbers in the error summary, which was hardcoded Romanian", () => {
    for (const file of LOCALES) {
      expect(
        [...scanIcu(String(at(wizardCopy(file), "importDialog.doneWithErrors"))).args].sort(),
      ).toEqual(["created", "errors"]);
    }
  });
});

// ---------------------------------------------------------------------------
// The screen with nothing left to ask for   (Slice #32.04)
// ---------------------------------------------------------------------------

/**
 * ⚠️ **THE ONLY GUARD THE BEHAVIOURAL HALF OF #32.04 HAS.** Nothing in
 * `src/__tests__/` renders React, so a source scan is the instrument available
 * — the same trade `import-duplication-stage.test.ts` makes for #32.03 and
 * `import-workflow-stages.test.ts` makes for the wizard.
 *
 * ⚠️ **AND THE TWO-PART CONDITION IS WHAT MATTERS MOST HERE.** A suite that
 * only checked "a clean verdict hides the tick" would go green over the defect
 * this slice is written to avoid: the folder report drawn under this panel is a
 * to-do list acted on in File Explorer, one of whose findings says every number
 * on the screen is inflated and ends "Nu porniți importul", and this panel's
 * "Verifică din nou" is the ONLY control anywhere that re-walks the folder
 * afterwards. Prune on the archive's answer alone and the user is told to go
 * and fix something with no way to have the fix looked at, while the one live
 * button spends money on a folder the report has already condemned. That is
 * #26.02's unfixable message, on the screen where it costs most.
 */
describe("the Pre-existing screen's prune", () => {
  const PANEL = "src/app/admin/import/_components/import-preexisting-stage.tsx";
  const WIZARD = "src/app/admin/import/_components/import-wizard.tsx";
  const SECTIONS = "src/app/admin/import/_components/report-sections.tsx";

  function read(rel: string): string {
    return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  }

  it("⚠️ keys the prune on the archive's answer AND on the folder report", () => {
    const wizard = read(WIZARD);
    const start = wizard.indexOf("const preexistingResultOnly =");
    expect(start).toBeGreaterThan(0);
    const expr = wizard.slice(start, wizard.indexOf(";", start));

    // The terms are asserted by NAME, so a rename or a Prettier wrap is an
    // innocent edit. Dropping one of them is not.
    for (const term of [
      // A lookup that is settled…
      'phase !== "preexisting-checking"',
      "preexisting !== null",
      // …and came back clean…
      "preexisting.ok",
      "preexisting.verdict.clean",
      // …AND a folder report with nothing to say. This is the term the whole
      // guard exists for.
      "reportHasNothingToSay(report)",
    ]) {
      expect({ term, present: expr.includes(term) }).toEqual({ term, present: true });
    }

    // ⚠️ NOT the tick, for the reason #32.03 pinned at the Duplication panel:
    // keyed on `acknowledged` this would take "Verifică din nou" away at the
    // moment it is the only way out. And NOT `gated`: there is no pause on this
    // stage and there cannot be one — #29.08 removed the transition it would
    // gate — so a `gated` term would be a guard that can never fire.
    for (const term of ["acknowledged", "gated"]) {
      expect({ term, keyedOnIt: expr.includes(term) }).toEqual({ term, keyedOnIt: false });
    }
  });

  it("⚠️ decides the panel and the report below it with ONE expression", () => {
    // Two independently written copies of "the report has nothing to say" would
    // agree today and diverge the day either gains a term — and the screen
    // would then show a report saying nothing, under a panel that has already
    // said it. So: one exported predicate, read by the section itself and by
    // the wizard, and the raw comparison written down exactly once.
    const sections = read(SECTIONS);
    expect(sections).toContain("export function reportHasNothingToSay(report: ImportReport): boolean");
    expect(sections).toContain("const nothingToSay = reportHasNothingToSay(report);");
    // The raw comparison is written down exactly once in the whole repo's
    // components, and it is inside that predicate. A second copy anywhere is
    // the rule living twice, which is the failure this test is about.
    const RAW = "findings.length === 0 && report.skipped.length === 0";
    expect(sections.split(RAW).length - 1).toBe(1);
    // …and nowhere else. Reading only `report-sections.tsx` would pass on the
    // exact failure this test names: a second copy in the wizard, computed
    // beside the predicate rather than through it.
    expect(read(WIZARD)).not.toContain(RAW);
    const body = sections.slice(
      sections.indexOf("export function reportHasNothingToSay"),
    );
    expect(body.slice(0, body.indexOf("}"))).toContain(RAW);

    const wizard = read(WIZARD);
    expect(wizard).toContain('from "./report-sections"');
    expect(wizard).toContain("reportHasNothingToSay");
    // The mount, gated on the same const the panel is handed.
    expect(wizard).toContain(
      "{inPreexisting && preexisting !== null && !preexistingResultOnly && (",
    );
    expect(wizard).toContain("resultOnly={preexistingResultOnly}");
  });

  it("⚠️ takes every block that asks the user for something off the pruned screen", () => {
    const panel = read(PANEL);

    // The intro is part of the same defect: it ends "citiți ce urmează să se
    // întâmple, bifați și mergeți mai departe", and on a pruned screen there is
    // nothing to read and no tick to give.
    expect(panel).toContain('{resultOnly ? t("introDone") : t("intro")}');
    // Three wrappers, and they are — in document order — the tick with its
    // hint, "Verifică din nou", and the take-away page. If a later slice adds a
    // fourth legitimately, this number is the thing to update; the assertions
    // below name each of the three so a drop is not mistaken for an addition.
    expect(panel.split("{!resultOnly && (").length - 1).toBe(3);
    // The explanations, both the listing and the disclosure that reopens it.
    expect(panel).toContain("!resultOnly && (!asked || notesOpen || failed");
    expect(panel).toContain("asked && !failed && !resultOnly && !(busy && nothingToShow)");
    // The pointer to a report the wizard has not mounted.
    expect(panel).toContain("{asked && !resultOnly && (");
    // And "Verifică din nou" — the one that is safe to drop ONLY because the
    // report has nothing to send the user back for. Located by its own label
    // rather than by an indentation the formatter owns.
    const recheckAt = panel.indexOf('{t("recheck")}');
    expect(recheckAt).toBeGreaterThan(0);
    const guardAt = panel.slice(0, recheckAt).lastIndexOf("{!resultOnly && (");
    expect(guardAt).toBeGreaterThan(0);
    // …and the guard is still OPEN at the label, which is what says the button
    // is inside it rather than merely after it. Counted rather than matched on
    // a closing `)}`: `className={buttonClass({ … })}` carries one of those,
    // and the indentation that would distinguish them belongs to the formatter.
    const between = panel.slice(guardAt, recheckAt);
    expect(between.split("(").length - between.split(")").length).toBe(1);
  });

  it("⚠️ makes the Continue pressable without a tick that is not drawn", () => {
    // The whole defect this slice exists to remove: a permanently disabled
    // primary button on the one screen whose only way forward it is. `busy`
    // stays — a check in flight still makes the press wrong.
    const panel = read(PANEL);
    expect(panel).toContain("disabled={resultOnly ? busy : !acknowledged || busy}");
    // The label is a hoisted const, because the cost sentence beside the button
    // interpolates the SAME value — see the next test. Asserted by its terms so
    // a reformat of the ternary is an innocent edit.
    expect(panel).toContain("{pressLabel}");
    const declAt = panel.indexOf("const pressLabel =");
    expect(declAt).toBeGreaterThan(0);
    const decl = panel.slice(declAt, panel.indexOf(";", declAt));
    for (const term of ["resultOnly", "advanceLabel", 't("continueWithout")', 't("continue")']) {
      expect({ term, present: decl.includes(term) }).toEqual({ term, present: true });
    }
  });

  it("⚠️ changes nothing on the failed-lookup screen", () => {
    // `failed` is not a clean verdict, so `preexistingResultOnly` is false
    // there. The one screen on this stage where the user is being asked to
    // accept a risk keeps its tick, its red block and both its sentences.
    const panel = read(PANEL);
    // The failed arm of `pressLabel`, because the label has never stood alone
    // in this file — an assertion on `{t("continueWithout")}` would be red on
    // correct code. Read out of the declaration, which is Prettier-wrapped.
    const declAt = panel.indexOf("const pressLabel =");
    const decl = panel.slice(declAt, panel.indexOf(";", declAt));
    expect(decl).toContain("failed");
    expect(decl).toContain('t("continueWithout")');
    expect(panel).toContain('{t("failed.continueHint")}');
    const wizard = read(WIZARD);
    const start = wizard.indexOf("const preexistingResultOnly =");
    const expr = wizard.slice(start, wizard.indexOf(";", start));
    expect(expr).toContain("preexisting.ok");
  });

  it("⚠️ hands the keyboard to the heading when the tick is not drawn", () => {
    // `checkboxRef.current` is null on a pruned screen — the block holding the
    // tick is not rendered — so a busy → idle edge that landed there would
    // `focus()` nothing and leave a keyboard user on `<body>`. #32.03's fix at
    // the Duplication panel, in the same shape.
    expect(read(PANEL)).toContain("justMounted || resultOnly ? headingRef : checkboxRef");
  });

  it("⚠️ hides the take-away page rather than deleting it", () => {
    // What changed is whether the panel OFFERS the Save button on a screen with
    // nothing left to report, not what the page says when it is asked for — a
    // diff in `report-html.ts` would be a mistake rather than a bonus. So the
    // exporter and everything it reaches stay in use on the two paths that
    // still draw the button, and the button itself is INSIDE a `!resultOnly`
    // wrapper rather than gone: located by its own label and measured by paren
    // balance, the way the re-check above is.
    const panel = read(PANEL);
    expect(panel).toContain("const handleSave = useCallback(");
    expect(panel).toContain("buildRulesPageHtml({");
    const saveAt = panel.indexOf('{t("save.button")}');
    expect(saveAt).toBeGreaterThan(0);
    const guardAt = panel.slice(0, saveAt).lastIndexOf("{!resultOnly && (");
    expect(guardAt).toBeGreaterThan(0);
    const between = panel.slice(guardAt, saveAt);
    expect(between.split("(").length - between.split(")").length).toBe(1);
  });
});
