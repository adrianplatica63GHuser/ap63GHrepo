/**
 * The Duplication stage's own copy, in both locales.   (Slice #26.06)
 *
 * The rules and their three sentences are pinned in
 * `import-duplication-rules.test.ts`; the verdict is pinned in
 * `import-duplication-check.test.ts`. What is left is the chrome the stage puts
 * around them - the tick's label, the button labels, the instruction to go to
 * File Explorer, the group headings, the unmeasurable-files block and the
 * strings the saved page is built from. None of it is reachable from a rule ID,
 * so nothing else here would notice it missing.
 *
 * It matters more than chrome usually does for one reason: `DEFAULT_LOCALE` is
 * `ro-RO`, so a missing key does not fall back to English - it renders the raw
 * key path into the shipping UI.
 *
 * The component itself is not rendered here. Nothing in this suite renders
 * React, and a test that did would prove the JSX compiles rather than that the
 * copy exists - which is the half that goes wrong silently.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

/** The `adminImport.duplication` block, minus the rule catalogue. */
function loadCopy(file: string): Record<string, unknown> {
  const json = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { duplication: Record<string, unknown> } };
  return json.adminImport.duplication;
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
  "rulesTitle",
  "showRules",
  "hideRules",
  "acknowledge",
  "acknowledgeHint",
  "check",
  "recheck",
  "chooseAnotherFolder",
  "clean",
  "violationsTitle",
  "fixInstructions",
  "morePaths",
  "group.name",
  "group.pages",
  "unsized.title",
  "unsized.intro",
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

describe("the Duplication stage's copy", () => {
  it.each(LOCALES)("%s carries every string the panel asks for", (file) => {
    const copy = loadCopy(file);
    const missing = REQUIRED_KEYS.filter((key) => {
      const value = at(copy, key);
      return typeof value !== "string" || value.trim().length === 0;
    });
    expect(missing).toEqual([]);
  });

  it("counts things with a plural, in both locales", () => {
    // Romanian needs `few` as well as `one` and `other` - the language has a
    // third form for 2-19 - and #26.02 already shipped this exact bug once.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      for (const key of ["violationsTitle", "morePaths", "unsized.intro"] as const) {
        expect(String(at(copy, key))).toContain("{count");
      }
      for (const key of ["violationsTitle", "unsized.intro"] as const) {
        const [block] = scanIcu(String(at(copy, key))).plurals;
        expect({ key, arg: block?.arg }).toEqual({ key, arg: "count" });
        const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];
        expect(block.categories).toEqual(expect.arrayContaining(wanted));
      }
    }
  });

  it("⚠️ counts BOTH numbers in a group heading, and pluralises both", () => {
    // A group heading is the culprit line - the sentence a user reads directly
    // above the paths they are about to act on. `group.pages` carries two
    // numbers, how many folders and how many pages each holds, and Romanian
    // cannot agree with either from outside its block.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];

      const byName = scanIcu(String(at(copy, "group.name")));
      expect([...byName.args].sort()).toEqual(["count", "name"]);
      expect(byName.plurals.map((p) => p.arg)).toEqual(["count"]);

      const byPages = scanIcu(String(at(copy, "group.pages")));
      expect([...byPages.args].sort()).toEqual(["count", "pages"]);
      expect(byPages.plurals.map((p) => p.arg)).toEqual(["count", "pages"]);
      for (const block of [...byName.plurals, ...byPages.plurals]) {
        expect(block.categories).toEqual(expect.arrayContaining(wanted));
      }
    }
  });

  it("tells the user where to go, by name", () => {
    // The instruction under the fix list is the whole hinge of the loop: the
    // work happens in File Explorer, not here.
    for (const file of LOCALES) {
      expect(String(at(loadCopy(file), "fixInstructions"))).toContain("File Explorer");
    }
  });

  it("⚠️ tells the user NOT to delete before looking", () => {
    // The catalogue's own guard forbids the word "delete" in a rule sentence.
    // This is its positive half, and it lives in the chrome because that is
    // where the general instruction belongs: the match is a resemblance, and
    // the user is the one who decides. A slice that reworded this into "delete
    // the copies" would undo the whole argument in one sentence.
    const ro = String(at(loadCopy("ro-RO.json"), "fixInstructions"));
    expect(ro).toMatch(/nu ștergeți/i);
    const en = String(at(loadCopy("en-GB.json"), "fixInstructions"));
    expect(en).toMatch(/do not delete/i);
  });

  it("⚠️ says the system will not touch the user's files", () => {
    // The sentence that makes the loop safe to enter. Both sibling stages carry
    // it and it matters most here, because this is the stage that asks for a
    // removal.
    expect(String(at(loadCopy("ro-RO.json"), "fixInstructions"))).toContain("nu vă atinge");
    expect(String(at(loadCopy("en-GB.json"), "fixInstructions"))).toContain("does not touch");
  });

  it("says the folder does not have to be chosen again", () => {
    // #26.04's constraint, still in force two stages later and easy to lose in
    // a reword: the check runs against the SAME folder.
    expect(String(at(loadCopy("ro-RO.json"), "intro"))).toContain("același folder");
    expect(String(at(loadCopy("en-GB.json"), "intro"))).toContain("same folder");
  });

  it("⚠️ says the comparison is not against what is already in the system", () => {
    // The slice's constraint, in the one sentence every user of this stage
    // reads. Pre-existing (26.08) is a different question with a different
    // remedy - the document is LINKED, not removed - and a user who mixes the
    // two takes a document out of their folder for the wrong reason.
    expect(String(at(loadCopy("ro-RO.json"), "intro"))).toContain("deja în sistem");
    expect(String(at(loadCopy("en-GB.json"), "intro"))).toContain("already in the system");
  });

  it("distinguishes the first check from a re-check", () => {
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      expect(at(copy, "check")).not.toBe(at(copy, "recheck"));
    }
  });
});

describe("the Duplication stage's copy, against its siblings", () => {
  /**
   * The strings that must NOT be a copy of the Structure or Constraints
   * stage's.
   *
   * ⚠️ An explicit list, not "everything except a few". The three panels are
   * siblings by design and several of their strings are deliberately identical
   * - "Verifică din nou", "Alege alt folder…", the count of things to put right
   * - because the whole value of the third loop is that it costs the user
   * nothing to learn. Asserting difference by default would fail on the copy
   * that is RIGHT.
   *
   * What is listed below is the copy that names the stage. A Duplication screen
   * saying "Respect regulile de structură" over its tick is one copy-paste
   * away, and it would ask the user to confirm something they were never shown.
   */
  const MUST_DIFFER = [
    "title",
    "intro",
    "rulesTitle",
    "showRules",
    "hideRules",
    "acknowledge",
    "acknowledgeHint",
    "fixInstructions",
    "clean",
    "save.button",
    "save.hint",
    "save.filePrefix",
    "save.documentTitle",
    "save.rulesTitle",
    "save.allClear",
    "save.blocked",
    "save.notCheckedYet",
    "save.warningsTitle",
    "save.rulesOnlyName",
  ] as const;

  it("names its own stage rather than repeating either sibling's", () => {
    for (const file of LOCALES) {
      const json = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
      ) as {
        adminImport: {
          structure: Record<string, unknown>;
          constraints: Record<string, unknown>;
          duplication: Record<string, unknown>;
        };
      };
      for (const key of MUST_DIFFER) {
        const mine = at(json.adminImport.duplication, key);
        for (const sibling of ["structure", "constraints"] as const) {
          const theirs = at(json.adminImport[sibling], key);
          expect(typeof theirs).toBe("string");
          expect(`${file} ${sibling} ${key}: ${mine}`).not.toBe(
            `${file} ${sibling} ${key}: ${theirs}`,
          );
        }
      }
    }
  });

  it("keeps the loop's own words identical to its siblings', deliberately", () => {
    // The other direction, and the reason `MUST_DIFFER` is a list. These three
    // are the loop itself - the button, the way out and the count - and a slice
    // that "tidied" one of them into a synonym would make the third stage read
    // as a different mechanism.
    //
    // `fixInstructions` is NOT among them, for the reason #26.05 found: the
    // sentence Structure shares with Constraints is false here too. This
    // stage's remedy is to take a file out, and its instruction has to say not
    // to delete before looking - which neither sibling needs to say.
    for (const file of LOCALES) {
      const json = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
      ) as {
        adminImport: {
          structure: Record<string, unknown>;
          duplication: Record<string, unknown>;
        };
      };
      for (const key of ["recheck", "chooseAnotherFolder", "violationsTitle"] as const) {
        expect(at(json.adminImport.duplication, key)).toBe(at(json.adminImport.structure, key));
      }
    }
  });

  it("⚠️ offers a way out of the loop for the files no RULE covers", () => {
    // The hole #26.05's adversarial review found, guarded one stage later.
    // Every rule sentence ends with "take it out of the chosen folder" and the
    // catalogue's own test walks the rule IDs to prove it. Files that could not
    // be measured block the stage too - and they carry no rule ID, so that test
    // cannot see them.
    const escapes = {
      "ro-RO.json": "din folderul ales",
      "en-GB.json": "out of the chosen folder",
    } as const;
    for (const file of LOCALES) {
      const intro = String(at(loadCopy(file), "unsized.intro"));
      const categories = scanIcu(intro).plurals[0]?.categories ?? [];
      expect(categories.length).toBeGreaterThan(0);
      // In EVERY branch: a remedy present only in the singular is absent for
      // exactly the user with the most files to deal with.
      for (const category of categories) {
        const start = intro.indexOf(`${category} {`);
        const next = categories[categories.indexOf(category) + 1];
        const end = next === undefined ? intro.length : intro.indexOf(`${next} {`, start);
        expect({ file, category, hasEscape: intro.slice(start, end).includes(escapes[file]) })
          .toEqual({ file, category, hasEscape: true });
      }
    }
  });

  it("⚠️ keeps every counted chrome sentence whole, inside its plural block", () => {
    // Romanian cannot agree from outside the block, and the catalogue's version
    // of this guard walks the rule sentences and never sees the chrome - which
    // is where #26.05's bug actually was.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      for (const key of ["violationsTitle", "unsized.intro"] as const) {
        const text = String(at(copy, key));
        const before = text.slice(0, text.indexOf("{"));
        const after = text.slice(text.lastIndexOf("}") + 1);
        expect({ file, key, before: before.trim(), after: after.trim() })
          .toEqual({ file, key, before: "", after: "" });
      }
    }
  });

  it("uses no technology language anywhere in the block, not only in the rules", () => {
    // The catalogue's guard scans the rule sentences only, and #26.05's first
    // draft of `save.hint` said "o pagină HTML" - jargon, in the chrome, where
    // nothing was looking.
    const banned = /\b(image|application|text|video|audio)\/[a-z0-9.+-]+|\bMIME\b|\bHTML\b|\b(octeți|bytes|hash|checksum)\b/i;
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
    // transcribed - so a component that started calling `t("back")` would ship
    // a dotted key path into the shipping locale with every test here still
    // green. This reads the component's own source.
    //
    // Only `t("literal")` calls are readable this way. The rule keys go through
    // `tk(duplicationMessageKeyFor(...))` and are covered by the catalogue's
    // own tests, which is why they are absent here rather than missing.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/admin/import/_components/import-duplication-stage.tsx"),
      "utf8",
    );
    const asked = new Set([...source.matchAll(/(?<![A-Za-z0-9_])t\(\s*"([^"]+)"/g)].map((m) => m[1]));
    expect(asked.size).toBeGreaterThan(10);
    const undeclared = [...asked].filter((k) => !REQUIRED_KEYS.includes(k as never)).sort();
    expect(undeclared).toEqual([]);
    const unused = REQUIRED_KEYS.filter((k) => !asked.has(k));
    expect(unused).toEqual([]);
  });

  it("says something different in Romanian than in English", () => {
    // Romanian is the shipping locale and English is the development
    // convenience; identical strings mean the Romanian was never written.
    // `save.folderLabel` is exempt: "Folder" is the word in both.
    const ro = loadCopy("ro-RO.json");
    const en = loadCopy("en-GB.json");
    const shared = ["save.folderLabel"];
    for (const key of REQUIRED_KEYS) {
      if (shared.includes(key)) continue;
      expect(`${key}: ${at(ro, key)}`).not.toBe(`${key}: ${at(en, key)}`);
    }
  });
});
