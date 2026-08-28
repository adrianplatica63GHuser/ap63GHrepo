/**
 * The Scanning and Import stages' copy, and the copy the deleted button left
 * behind.   (Slice #26.09)
 *
 * Two things go silently wrong when three screens are re-homed:
 *
 *  1. **A key that does not exist.** `DEFAULT_LOCALE` is `ro-RO`, so a missing
 *     key does not fall back to English — the panel renders the raw key path
 *     into the shipping UI.
 *  2. **A key that no longer exists anywhere it is used, left behind in the
 *     file.** Harmless to render and corrosive to read: the next person to
 *     reword "Interpretează AI" finds it in `messages/` and cannot tell that
 *     nothing draws it. #26.02's constraint is the standing rule — delete a
 *     thing and its message keys in BOTH locales, in the same commit.
 *
 * The components are not rendered here. Nothing in this suite renders React,
 * and a test that did would prove the JSX compiles rather than that the copy
 * exists — which is the half that goes wrong silently.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

function loadMessages(file: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as Record<string, unknown>;
}

function at(node: unknown, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (n, part) =>
        n !== null && typeof n === "object" ? (n as Record<string, unknown>)[part] : undefined,
      node,
    );
}

function source(file: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src", "app", "admin", "import", "_components", file),
    "utf8",
  );
}

/**
 * Every `t("…")` a component asks for.
 *
 * ⚠️ **Comments are stripped first, and the first version of this suite failed
 * because they were not.** `import-scanning-stage.tsx` documents its
 * `progressLabel` prop as "already translated, e.g. `t("scanningProgress", …)`"
 * — a sentence about a call the CALLER makes — and a scraper that reads prose
 * as code reported a key the component does not use, so the drift test failed
 * on a correct component. A detector that fires on documentation trains a
 * reader to stop writing it.
 *
 * What it still cannot see: `t.rich(…)`, template-literal keys, an aliased
 * translator, and anything dynamic. None of the two panels uses any of them,
 * and the day one does this test goes quiet rather than wrong — so the day a
 * panel needs `t.rich`, extend this.
 */
function keysUsedBy(file: string): string[] {
  const code = source(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  return [...code.matchAll(/\bt\("([A-Za-z0-9_.]+)"/g)].map((m) => m[1]);
}

/**
 * Written out rather than derived from the JSON, which would only prove the
 * file agrees with itself. This list is the panels' demand; the file is the
 * supply, and the drift test below proves the two are the same list.
 */
const SCANNING_KEYS = ["title", "intro", "whatItReads", "whatItWrites", "waitHint"] as const;

const RUN_KEYS = [
  "title",
  "intro",
  "introWithProperties",
  "introRunning",
  "introDone",
  "doneNote",
  "stepsTitle",
  "stepProperty",
  "stepTags",
  "stepFiles",
  "stepInterpret",
  "costNote",
  "writesNote",
  "importButton",
  // ⚠️ Slice #32.04 — this was `chooseAnotherFolder`, and the key was renamed
  // rather than the control removed. On a finished run this button is the only
  // way out of the page, so what came off was the label: at that point in the
  // flow it does not mean "change the folder of this import", it means start
  // another one. Everywhere else in the run it is gone entirely.
  "startAnotherImport",
  "nothingToImport",
] as const;

/** What the result row says about a read nobody pressed a button for. */
const ROW_KEYS = [
  "interpretingShort",
  "interpretFailed",
  "interpretPartial",
  "interpretRetry",
  "interpretRetryHint",
  "interpretRetryFailed",
  "interpretRetryFailedUnknown",
  "interpretPartiesPending",
  "interpretDone",
  // #29.12 — the sentence the row draws when the folder's title was kept. In
  // this list for the reason the list exists: it is the newest key the row
  // asks for, so it is the one likeliest to reach ro-RO and never en-GB.
  "interpretTitleKept",
  "interpretPrintedHeadingNoted",
  "interpretParties",
  "doneUnread",
  "doneUnreadLocked",
  "doneUnreadWaiting",
  "donePendingPeople",
  "donePendingPeopleLocked",
  "confirmPendingButton",
] as const;

/**
 * The caveat the result row draws beside a green tick.
 *
 * ⚠️ It lives in `adminImport.wizard`, NOT in the row's own namespace, because
 * it is the copy `ScanConfidenceWarning` was written with and reusing it is the
 * whole point — an earlier version reached for `confidence_low`, the one-word
 * badge label from the scan table's Confidence column, and rendered "⚠ Încredere
 * scăzută" as an entire explanation. Nothing else in this suite looks at that
 * namespace, so without this list a typo there ships the raw key path.
 */
const CONFIDENCE_KEYS = [
  "scanConfidence.titleLow",
  "scanConfidence.bodyLow",
  "scanConfidence.titleMedium",
  "scanConfidence.bodyMedium",
] as const;

describe("the Scanning and Import stages' copy", () => {
  it.each(LOCALES)("%s carries every string the two panels ask for", (file) => {
    const m = loadMessages(file);
    const missing: string[] = [];
    for (const key of SCANNING_KEYS) {
      const v = at(m, `adminImport.scanning.${key}`);
      if (typeof v !== "string" || v.trim() === "") missing.push(`scanning.${key}`);
    }
    for (const key of RUN_KEYS) {
      const v = at(m, `adminImport.importRun.${key}`);
      if (typeof v !== "string" || v.trim() === "") missing.push(`importRun.${key}`);
    }
    for (const key of ROW_KEYS) {
      const v = at(m, `adminImport.wizard.importDialog.${key}`);
      if (typeof v !== "string" || v.trim() === "") missing.push(`importDialog.${key}`);
    }
    for (const key of CONFIDENCE_KEYS) {
      const v = at(m, `adminImport.wizard.${key}`);
      if (typeof v !== "string" || v.trim() === "") missing.push(`wizard.${key}`);
    }
    expect(missing).toEqual([]);
  });

  it("the panels ask for exactly the keys listed above, and no others", () => {
    // The half a missing-key test cannot catch: a key added to the component
    // and to ro-RO, and never to en-GB, passes the test above only because the
    // list here was not updated either.
    expect([...new Set(keysUsedBy("import-scanning-stage.tsx"))].sort()).toEqual(
      [...SCANNING_KEYS].sort(),
    );
    expect([...new Set(keysUsedBy("import-run-stage.tsx"))].sort()).toEqual([...RUN_KEYS].sort());
  });

  it("names the chosen folder in every state of both screens", () => {
    for (const file of LOCALES) {
      const m = loadMessages(file);
      for (const key of [
        "adminImport.scanning.intro",
        "adminImport.importRun.intro",
        "adminImport.importRun.introWithProperties",
        "adminImport.importRun.introRunning",
        "adminImport.importRun.introDone",
      ] as const) {
        expect([...scanIcu(String(at(m, key))).args]).toEqual(["folder"]);
      }
    }
  });

  it("⚠️ never says nothing has been saved once a run has finished", () => {
    // The three intros are the whole of the fix an adversarial round forced:
    // closing the import dialog returns the wizard to this panel's own screen,
    // and re-drawing "nothing has been saved yet" there sat above a button that
    // would have imported the folder a second time. Each state has to make a
    // DIFFERENT claim, and the finished one has to say the run is over.
    for (const file of LOCALES) {
      const m = loadMessages(file);
      const intros = (
        ["intro", "introWithProperties", "introRunning", "introDone"] as const
      ).map((k) => String(at(m, `adminImport.importRun.${k}`)));
      expect(new Set(intros).size).toBe(4);
    }
    expect(String(at(loadMessages("ro-RO.json"), "adminImport.importRun.introDone"))).toMatch(
      /s-a încheiat/i,
    );
    expect(String(at(loadMessages("ro-RO.json"), "adminImport.importRun.doneNote"))).toMatch(
      /a doua oară/i,
    );
    expect(String(at(loadMessages("en-GB.json"), "adminImport.importRun.doneNote"))).toMatch(
      /second time/i,
    );
  });

  it("counts with a plural, and lets Romanian agree from inside the block", () => {
    // Romanian needs `few` as well as `one` and `other` — the language has a
    // third form for 2-19 — and #26.02 shipped that bug once already.
    const COUNTED = [
      "adminImport.importRun.stepFiles",
      "adminImport.importRun.costNote",
      "adminImport.wizard.importDialog.interpretPartiesPending",
      "adminImport.wizard.importDialog.doneUnread",
      "adminImport.wizard.importDialog.doneUnreadLocked",
      "adminImport.wizard.importDialog.doneUnreadWaiting",
      "adminImport.wizard.importDialog.donePendingPeople",
      "adminImport.wizard.importDialog.donePendingPeopleLocked",
    ] as const;

    for (const file of LOCALES) {
      const m = loadMessages(file);
      for (const key of COUNTED) {
        const text = String(at(m, key));
        const [block] = scanIcu(text).plurals;
        expect({ key, arg: block?.arg }).toEqual({ key, arg: "count" });
        const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];
        expect({ file, key, categories: block.categories }).toEqual({
          file,
          key,
          categories: expect.arrayContaining(wanted),
        });

        // ⚠️ Nothing but punctuation may follow the block. A verb or a noun
        // left outside it cannot agree with the number — the failure #26.05
        // recorded — and these three sentences all end in one.
        const tail = text.slice(text.lastIndexOf("}") + 1);
        expect({ file, key, tail: tail.replace(/[^\p{L}]/gu, "") }).toEqual({ file, key, tail: "" });
      }
    }
  });

  it("⚠️ says out loud that the Import button spends money", () => {
    // The disclosure this slice owes the user: until now, interpreting a
    // document was a button they could decline to press. It is not any more, so
    // the count and the fact that it is billed have to be on the screen that
    // starts it. A reword that drops either turns the run's new spending
    // silent, which is the failure #24.02a exists to have fixed once.
    expect(String(at(loadMessages("ro-RO.json"), "adminImport.importRun.costNote"))).toMatch(
      /se plătește/i,
    );
    expect(String(at(loadMessages("en-GB.json"), "adminImport.importRun.costNote"))).toMatch(
      /costs money/i,
    );
  });

  it("⚠️ promises that no person is created without the user's confirmation", () => {
    // The one sentence on this screen that describes a WRITE the user is not
    // watching. `runAiInterpret` returns parties and links none of them, and
    // this is where that promise is made — see its module header.
    expect(String(at(loadMessages("ro-RO.json"), "adminImport.importRun.stepInterpret"))).toMatch(
      /confirm/i,
    );
    expect(String(at(loadMessages("en-GB.json"), "adminImport.importRun.stepInterpret"))).toMatch(
      /confirm/i,
    );
  });

  it("⚠️ leaves nothing of the deleted AI Interpret button behind, in either locale", () => {
    // Deleting a control means deleting its copy in BOTH locales in the same
    // commit. A stale key is not a rendering bug; it is a reader's trap.
    const GONE = [
      "adminImport.wizard.importDialog.interpretButton",
      "adminImport.wizard.importDialog.aiInterpret",
      // The toolbar's own controls, re-homed into the five stage panels.
      "adminImport.wizard.importButton",
      "adminImport.wizard.chooseFolderButton",
      "adminImport.wizard.changeFolderButton",
      // ── Slice #32.04 ──────────────────────────────────────────────────────
      // "Alege alt folder…" on every screen that stands in the middle of a run:
      // mid-flow a folder change is either a cancel or a restart, and the
      // wizard has both. ⚠️ **ALL SIX, INCLUDING STRUCTURE'S.** That panel kept
      // its own for one round, on the argument that its stage's work IS
      // choosing a folder; Adrian's answer to the Ask first was that it goes
      // there too, and the argument is served by the primary button, which
      // reads "Alege folderul…" until a folder has been checked. So there is no
      // `chooseAnotherFolder` key left anywhere, in either locale.
      "adminImport.structure.chooseAnotherFolder",
      "adminImport.constraints.chooseAnotherFolder",
      "adminImport.duplication.chooseAnotherFolder",
      "adminImport.preexisting.chooseAnotherFolder",
      "adminImport.typesBlocked.chooseAnotherFolder",
      "adminImport.importRun.chooseAnotherFolder",
      // The Evaluation screen's own copy of the same button…
      "adminImport.wizard.forecast.changeFolder",
      // …and the literal continue label beside it, which is now derived from
      // `adminImport.stepGate.advance` and the stage vocabulary. Left in the
      // file it would be a second, lower-case name for a button that no longer
      // renders it.
      "adminImport.wizard.forecast.continueButton",
      // The document page's copy for the same button.
      "document.buttons.aiInterpret",
      "document.buttons.aiInterpreted",
      "document.aiExtracting",
      "document.aiExtractSuccess",
      "document.aiExtractError",
      // …and the party stepper's summary strip, whose only reader was the
      // handler that ran after that button.
      "document.aiPartyLinker.summary",
      "document.aiPartyLinker.addedNote",
    ] as const;

    for (const file of LOCALES) {
      const m = loadMessages(file);
      const left = GONE.filter((key) => at(m, key) !== undefined);
      expect({ file, left }).toEqual({ file, left: [] });
    }
  });

  it("⚠️ no shipping sentence still sends the user to a button that is gone", () => {
    // A key can be deleted and its NAME still be quoted inside another
    // sentence. Two were: the party stepper told the user to "re-run AI
    // Interpret" after adding a role, and the resumed view offered it as the
    // reason to open documents individually. Both are copy a business user
    // reads and then goes looking for a control that does not exist.
    for (const file of LOCALES) {
      const raw = fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8");
      const lines = raw
        .split("\n")
        .filter((line) => /Interpretează AI|AI Interpret\b/.test(line))
        // The provenance code AI_INTERPRETED is a stored value's label, not a
        // control: "Interpretare AI" is what a document says about itself.
        .filter((line) => !/"(aiInterpreted|AI_INTERPRETED)"\s*:/.test(line));
      expect({ file, lines }).toEqual({ file, lines: [] });
    }
  });

  it("⚠️ offers the way to another import only once a run has finished", () => {
    // Slice #32.04. This control was live in every state but `running`, as the
    // four stage panels before this screen each carried the same one. Those
    // four have lost it — mid-run, "choose another folder" is a third route
    // beside Cancel and restart that says which of the two it is — and here it
    // survives for the opposite reason: after a finished run it is the only way
    // out of the page. So the guard is that it is drawn on that state and no
    // other, under the label that says what it actually does.
    const panel = source("import-run-stage.tsx");
    const labelAt = panel.indexOf('{t("startAnotherImport")}');
    expect(labelAt).toBeGreaterThan(0);
    const guardAt = panel.slice(0, labelAt).lastIndexOf("{finished && (");
    expect(guardAt).toBeGreaterThan(0);
    // The guard is still open at the label — counted rather than matched on a
    // closing `)}`, because `className={buttonClass({ … })}` carries one of
    // those and the indentation that would tell them apart is the formatter's.
    const between = panel.slice(guardAt, labelAt);
    expect(between.split("(").length - between.split(")").length).toBe(1);
    // …and the old label is not still in the file under another guard.
    expect(panel).not.toContain("chooseAnotherFolder");
  });

  it("⚠️ keeps the two keys AI Discover still needs", () => {
    // The other half of the same commit: AI Discover shares this feedback strip
    // and #26.11 is about to make it the visible action on a document page.
    // Deleting one button's copy must not take its neighbour's with it.
    for (const file of LOCALES) {
      const m = loadMessages(file);
      for (const key of [
        "document.buttons.aiDiscover",
        "document.hints.aiInterpretNoPages",
        "document.aiDiscoverError",
      ] as const) {
        expect({ file, key, present: typeof at(m, key) === "string" }).toEqual({
          file,
          key,
          present: true,
        });
      }
    }
  });
});
