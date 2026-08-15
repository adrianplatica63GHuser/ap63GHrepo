/**
 * The Structure stage's own copy, in both locales.   (Slice #26.04)
 *
 * The rules and their three sentences are pinned in
 * `import-structure-rules.test.ts`; the verdict is pinned in
 * `import-structure-check.test.ts`. What is left is the chrome the stage puts
 * around them — the tick's label, the two button labels, the instruction to go
 * to File Explorer, the truncation sentences and the strings the saved page is
 * built from. None of it is reachable from a rule ID, so nothing else here
 * would notice it missing.
 *
 * It matters more than chrome usually does for one reason: `DEFAULT_LOCALE` is
 * `ro-RO`, so a missing key does not fall back to English — it renders the raw
 * key path into the shipping UI. The gate would read
 * `adminImport.structure.acknowledge` beside a checkbox, and the user would be
 * asked to agree to a dotted path.
 *
 * The component itself is not rendered here. Nothing in this suite renders
 * React, and a test that did would prove the JSX compiles rather than that the
 * copy exists — which is the half that goes wrong silently.
 */

import fs from "node:fs";
import path from "node:path";

import { STRUCTURE_TRUNCATION_LIMITS } from "@/lib/import/structure-check";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

/** The `adminImport.structure` block, minus the rule catalogue. */
function loadStructureCopy(file: string): Record<string, unknown> {
  const json = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { structure: Record<string, unknown> } };
  return json.adminImport.structure;
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
 * supply.
 */
const REQUIRED_KEYS = [
  "title",
  "intro",
  "rulesTitle",
  // ⚠️ Slice #26.11. Four strings, asked for by BOTH the panel and the saved
  // page, and rendered UNCONDITIONALLY above the rules on the first screen of
  // the import. A missing one prints `adminImport.structure.sharedFolders.title`
  // as a heading in the shipping locale — precisely the failure this file's
  // header exists to describe.
  "sharedFolders.title",
  "sharedFolders.common",
  "sharedFolders.floating",
  "sharedFolders.optional",
  "showRules",
  "hideRules",
  "acknowledge",
  "acknowledgeHint",
  "chooseFolder",
  "chooseAnotherFolder",
  "recheck",
  "clean",
  "violationsTitle",
  "fixInstructions",
  "morePaths",
  "truncated.title",
  "truncated.intro",
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
  "save.rulesOnlyName",
  "save.notCheckedYet",
  "save.warningsTitle",
] as const;

describe("the Structure stage's copy", () => {
  it.each(LOCALES)("%s carries every string the panel asks for", (file) => {
    const copy = loadStructureCopy(file);
    const missing = REQUIRED_KEYS.filter((key) => {
      const value = at(copy, key);
      return typeof value !== "string" || value.trim().length === 0;
    });
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("%s has a sentence for every limit the walk can report", (file) => {
    // The truncation block is drawn from `checkStructureStage`'s groups, and
    // the heading is looked up as `truncated.<limit>`. A limit added to
    // `WalkLimit` without a sentence here would print a key path inside a red
    // panel that is already telling the user something went wrong.
    const copy = loadStructureCopy(file);
    for (const limit of STRUCTURE_TRUNCATION_LIMITS) {
      const value = at(copy, `truncated.${limit}`);
      expect(typeof value).toBe("string");
      expect(String(value).trim().length).toBeGreaterThan(0);
      // Each one quotes how many directories the limit stopped, and that count
      // is NOT the length of the sample beside it — the budgets are global, so
      // a group names ten folders out of thousands. A sentence without the
      // placeholder would under-report a 15,000-folder refusal as ten.
      expect(String(value)).toContain("{count");
      if (file === "ro-RO.json") expect(String(value)).toContain("few {");
    }
  });

  it("counts things with a plural, in both locales", () => {
    // Two sentences carry a number. Romanian needs `few` as well as `one` and
    // `other` — the language has a third form for 2–19 — and #26.02 already
    // shipped this exact bug once in a rule sentence.
    for (const file of LOCALES) {
      const copy = loadStructureCopy(file);
      for (const key of ["violationsTitle", "morePaths"] as const) {
        expect(String(at(copy, key))).toContain("{count");
      }
      const title = String(at(copy, "violationsTitle"));
      expect(title).toContain("plural");
      if (file === "ro-RO.json") expect(title).toContain("few {");
    }
  });

  it("tells the user where to go, by name", () => {
    // The instruction under the fix list is the whole hinge of the loop: the
    // work happens in File Explorer, not here. A version that said "correct the
    // problems and try again" would leave a business user looking for a button.
    for (const file of LOCALES) {
      expect(String(at(loadStructureCopy(file), "fixInstructions"))).toContain(
        "File Explorer",
      );
    }
  });

  it("says something different in Romanian than in English", () => {
    // Romanian is the shipping locale and English is the development
    // convenience; identical strings mean the Romanian was never written.
    // `save.folderLabel` is exempt: "Folder" is the word in both.
    const ro = loadStructureCopy("ro-RO.json");
    const en = loadStructureCopy("en-GB.json");
    const shared = ["save.folderLabel"];
    for (const key of REQUIRED_KEYS) {
      if (shared.includes(key)) continue;
      expect(`${key}: ${at(ro, key)}`).not.toBe(`${key}: ${at(en, key)}`);
    }
  });
});
