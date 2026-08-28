/**
 * The Constraints stage's own copy, in both locales.   (Slice #26.05)
 *
 * The rules and their three sentences are pinned in
 * `import-constraint-rules.test.ts`; the verdict is pinned in
 * `import-constraint-check.test.ts`. What is left is the chrome the stage puts
 * around them — the tick's label, the button labels, the instruction to go to
 * File Explorer, the unreadable-files block and the strings the saved page is
 * built from. None of it is reachable from a rule ID, so nothing else here
 * would notice it missing.
 *
 * It matters more than chrome usually does for one reason: `DEFAULT_LOCALE` is
 * `ro-RO`, so a missing key does not fall back to English — it renders the raw
 * key path into the shipping UI. The gate would read
 * `adminImport.constraints.acknowledge` beside a checkbox, and the user would
 * be asked to agree to a dotted path.
 *
 * The component itself is not rendered here. Nothing in this suite renders
 * React, and a test that did would prove the JSX compiles rather than that the
 * copy exists — which is the half that goes wrong silently.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

/** The `adminImport.constraints` block, minus the rule catalogue. */
function loadConstraintsCopy(file: string): Record<string, unknown> {
  const json = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { constraints: Record<string, unknown> } };
  return json.adminImport.constraints;
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
  // ⚠️ Slice #32.01. The sentence that REPLACES `intro` once the check has come
  // back clean, on a screen that by then has no rules listing, no tick and no
  // buttons for `intro` to be talking about. A missing key prints the dotted
  // path where the screen's only explanatory line should be.
  "introDone",
  "rulesTitle",
  "showRules",
  "hideRules",
  "acknowledge",
  "acknowledgeHint",
  "check",
  "recheck",
  "clean",
  "violationsTitle",
  "fixInstructions",
  "morePaths",
  "unreadable.title",
  "unreadable.intro",
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

describe("the Constraints stage's copy", () => {
  it.each(LOCALES)("%s carries every string the panel asks for", (file) => {
    const copy = loadConstraintsCopy(file);
    const missing = REQUIRED_KEYS.filter((key) => {
      const value = at(copy, key);
      return typeof value !== "string" || value.trim().length === 0;
    });
    expect(missing).toEqual([]);
  });

  it("names all three sections of the listing", () => {
    // The scope headings the panel groups the rules under. Their IDs are pinned
    // against the catalogue in `import-constraint-rules.test.ts`; what this
    // adds is that each one has copy in both locales.
    for (const file of LOCALES) {
      const scope = at(loadConstraintsCopy(file), "scope") as Record<string, unknown>;
      expect(Object.keys(scope).sort()).toEqual(["fileName", "fileSize", "fileType"]);
    }
  });

  it("counts things with a plural, in both locales", () => {
    // Three sentences carry a number. Romanian needs `few` as well as `one` and
    // `other` — the language has a third form for 2–19 — and #26.02 already
    // shipped this exact bug once in a rule sentence.
    for (const file of LOCALES) {
      const copy = loadConstraintsCopy(file);
      for (const key of ["violationsTitle", "morePaths", "unreadable.intro"] as const) {
        expect(String(at(copy, key))).toContain("{count");
      }
      for (const key of ["violationsTitle", "unreadable.intro"] as const) {
        const [block] = scanIcu(String(at(copy, key))).plurals;
        expect({ key, arg: block?.arg }).toEqual({ key, arg: "count" });
        const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];
        expect(block.categories).toEqual(expect.arrayContaining(wanted));
      }
    }
  });

  it("tells the user where to go, by name", () => {
    // The instruction under the fix list is the whole hinge of the loop: the
    // work happens in File Explorer, not here. A version that said "correct the
    // problems and try again" would leave a business user looking for a button.
    for (const file of LOCALES) {
      expect(String(at(loadConstraintsCopy(file), "fixInstructions"))).toContain(
        "File Explorer",
      );
    }
  });

  it("says the folder does not have to be chosen again", () => {
    // #26.04's constraint, still in force one stage later and easy to lose in a
    // reword: the check runs against the SAME folder, and a user who thinks
    // they must re-pick it will go looking for a picker that is not there.
    const ro = String(at(loadConstraintsCopy("ro-RO.json"), "intro"));
    expect(ro).toContain("același folder");
    const en = String(at(loadConstraintsCopy("en-GB.json"), "intro"));
    expect(en).toContain("same folder");
  });

  it("distinguishes the first check from a re-check", () => {
    // Two labels, because the first press is not a repeat of anything. The
    // Structure panel makes the same distinction between "Alege folderul…" and
    // "Verifică din nou".
    for (const file of LOCALES) {
      const copy = loadConstraintsCopy(file);
      expect(at(copy, "check")).not.toBe(at(copy, "recheck"));
    }
  });

  /**
   * The strings that must NOT be a copy of the Structure stage's.
   *
   * ⚠️ An explicit list, not "everything except a few". The two panels are
   * siblings by design and several of their strings are deliberately identical
   * — "Verifică din nou", the count of things to put right, the instruction to
   * go to File Explorer ("Alege alt folder…" was among them until #32.04 took
   * the button off this panel) — because the whole value of
   * the second loop is that it costs the user nothing to learn. Asserting
   * difference by default would therefore fail on the copy that is RIGHT, and
   * the natural fix would be to reword a button for no reason.
   *
   * What is listed below is the copy that names the stage. A Constraints screen
   * that says "Respect regulile de structură" over its tick is one copy-paste
   * away, and it would ask the user to confirm something they were never shown.
   */
  const MUST_DIFFER = [
    "title",
    "intro",
    // ⚠️ Slice #32.01, and it belongs here for the same reason `intro` does:
    // `introDone` names what THIS stage looked at — the files, one by one —
    // where Structure's names the folder and its rules. A Constraints screen
    // that came back clean saying "the folder has been read and checked against
    // every structure rule" would credit this stage with a check it never ran.
    "introDone",
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

  it("names its own stage rather than repeating the Structure stage's", () => {
    for (const file of LOCALES) {
      const json = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
      ) as { adminImport: { structure: Record<string, unknown>; constraints: Record<string, unknown> } };
      for (const key of MUST_DIFFER) {
        const structureValue = at(json.adminImport.structure, key);
        expect(typeof structureValue).toBe("string");
        expect(`${file} ${key}: ${at(json.adminImport.constraints, key)}`)
          .not.toBe(`${file} ${key}: ${structureValue}`);
      }
    }
  });

  it("keeps the loop's own words identical to Structure's, deliberately", () => {
    // The other direction, and the reason `MUST_DIFFER` is a list. These three
    // are the loop itself — the button, the way out and the count — and a slice
    // that "tidied" one of them into a synonym would make the second stage read
    // as a different mechanism.
    //
    // ⚠️ `fixInstructions` is NOT among them any more. It was, and the slice's
    // adversarial review pointed out that the sentence it shares with Structure
    // is false here: three of the six constraints are fixed with a scanner or a
    // phone, not in File Explorer, and one of the remedies leaves a page group
    // with a numbering gap that Structure will then refuse. The identity test
    // was making the correct copy fail, which is worse than no test.
    for (const file of LOCALES) {
      const json = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
      ) as { adminImport: { structure: Record<string, unknown>; constraints: Record<string, unknown> } };
      // ⚠️ `chooseAnotherFolder` LEFT THIS LIST IN #32.04, with the button. It
      // is gone from this panel and from every other screen that stands in the
      // middle of a run; the Structure panel still has one, so the key is still
      // there to compare against and an identity test would keep passing over a
      // key nothing renders.
      for (const key of ["recheck", "violationsTitle"] as const) {
        expect(at(json.adminImport.constraints, key)).toBe(at(json.adminImport.structure, key));
      }
    }
  });

  it("⚠️ offers a way out of the loop for the files no RULE covers", () => {
    // THE hole the slice's adversarial review found, and the reason this guard
    // lives here rather than beside the catalogue's. Every constraint sentence
    // ends with "take it out of the chosen folder", and a test in
    // `import-constraint-rules.test.ts` walks `CONSTRAINT_RULE_IDS` to prove
    // it. Files the metadata pass could not open block the stage too — and they
    // carry no rule ID, so that test cannot see them. Their first draft offered
    // three conditional remedies (close the program, put the folder back,
    // reconnect the drive) and no unconditional one, which is a loop a user
    // whose file is on a dead drive could never leave.
    const escapes = { "ro-RO.json": "din folderul ales", "en-GB.json": "out of the chosen folder" };
    for (const file of LOCALES) {
      const intro = String(at(loadConstraintsCopy(file), "unreadable.intro"));
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
    // The catalogue's version of this guard walks `rules[id].violation` and
    // therefore never sees the chrome — which is where the bug actually was.
    // `unreadable.intro`'s first draft put the count in a plural block and then
    // carried on outside it, so at n=1 it read "Un fișier nu a putut fi
    // deschis… Închideți programele care LE folosesc" and at n=3 "De obicei
    // FIȘIERUL este deschis". Romanian cannot agree from outside the block.
    for (const file of LOCALES) {
      const copy = loadConstraintsCopy(file);
      for (const key of ["violationsTitle", "unreadable.intro"] as const) {
        const text = String(at(copy, key));
        const before = text.slice(0, text.indexOf("{"));
        const after = text.slice(text.lastIndexOf("}") + 1);
        expect({ file, key, before: before.trim(), after: after.trim() })
          .toEqual({ file, key, before: "", after: "" });
      }
    }
  });

  it("uses no technology language anywhere in the block, not only in the rules", () => {
    // The catalogue's guard scans `rule[id][part]` only, and the first draft of
    // `save.hint` said "o pagină HTML" — jargon, in the chrome, where nothing
    // was looking. A business user knows "a page you can print".
    const banned = /\b(image|application|text|video|audio)\/[a-z0-9.+-]+|\bMIME\b|\bHTML\b|\b(octeți|bytes)\b/i;
    for (const file of LOCALES) {
      const offenders: string[] = [];
      const walk = (node: unknown, path: string) => {
        if (typeof node === "string") {
          if (banned.test(node)) offenders.push(path);
          return;
        }
        if (node === null || typeof node !== "object") return;
        for (const [k, v] of Object.entries(node)) walk(v, path === "" ? k : `${path}.${k}`);
      };
      walk(loadConstraintsCopy(file), "");
      expect({ file, offenders }).toEqual({ file, offenders: [] });
    }
  });

  it("⚠️ asks for nothing the panel does not ask for, and vice versa", () => {
    // `REQUIRED_KEYS` claims to be "the component's demand", and it was hand
    // transcribed — so a component that started calling `t("back")` would ship a
    // dotted key path into the shipping locale with every test here still
    // green. This reads the component's own source, the same shape as the
    // upload-limit guard in `import-constraint-rules.test.ts`.
    //
    // Only `t("literal")` calls are readable this way. The rule and scope keys
    // go through `tk(constraintMessageKeyFor(...))` and are covered by the
    // catalogue's own tests, which is why they are absent here rather than
    // missing.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/admin/import/_components/import-constraints-stage.tsx"),
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
    const ro = loadConstraintsCopy("ro-RO.json");
    const en = loadConstraintsCopy("en-GB.json");
    const shared = ["save.folderLabel"];
    for (const key of REQUIRED_KEYS) {
      if (shared.includes(key)) continue;
      expect(`${key}: ${at(ro, key)}`).not.toBe(`${key}: ${at(en, key)}`);
    }
  });
});
