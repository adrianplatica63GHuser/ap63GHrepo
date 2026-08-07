/**
 * Unit tests for src/lib/import/structure-rules.ts   (Slice #26.01)
 *
 * This module ships no behaviour, so the usual "does it work" tests would be
 * vacuous. What it ships is a CONTRACT, and a contract fails in four ways:
 *
 *  1. **The grammar accepts a name it should refuse, or refuses one it should
 *     accept.** Every case below is a real folder name from Adrian's archive,
 *     one of the two false positives that retired the old `parseFolderName`
 *     heuristic in Slice #23.00, or a counterexample the adversarial review of
 *     this slice produced. "The rules must not be derived from what the
 *     archive happens to contain" cuts both ways: the archive is still the
 *     best available list of shapes that actually occur.
 *
 *  2. **A rule disagrees with the walk.** The module's central claim is that
 *     it delegates rather than restates, in both directions — never bless a
 *     folder `walkFolder` will treat differently, and never block on a file
 *     `walkFolder` was going to drop anyway.
 *
 *  3. **A rule has no Romanian sentence, or has one that does not fit its
 *     placeholders.** `DEFAULT_LOCALE` is `ro-RO`, so a missing key renders as
 *     a raw key path *in the shipping locale*, and a placeholder the emitter
 *     never supplies makes `IntlMessageFormat` throw at render time — inside
 *     the stage that exists to tell the user what is wrong. Both are checked
 *     by formatting every sentence with exactly the arguments the catalogue
 *     declares: a declared argument missing from the sentence fails the
 *     substring check, and a sentence argument missing from the catalogue
 *     makes the format throw.
 *
 *  4. **The Romanian does not agree.** Romanian plural categories are
 *     one / few (2–19) / other (0, 20+), and a sentence written with only
 *     one/other renders "20 proprietăți" where it must read
 *     "20 de proprietăți". Every Romanian plural block must declare all three.
 *
 * WHY THIS FILE PARSES ICU RATHER THAN FORMATTING IT
 * ──────────────────────────────────────────────────
 *
 * The obvious test formats each sentence with `intl-messageformat`, which is
 * what next-intl uses at runtime. It cannot run here: `intl-messageformat`,
 * `@formatjs/*` and next-intl itself are all ESM-only with no CommonJS build,
 * and `next/jest` does not transform `node_modules`, so the import fails with
 * "Cannot use import statement outside a module". Making it work means adding
 * `transformIgnorePatterns` to `jest.config.ts` — a change to how all 46 suites
 * are transformed, in a slice whose scope is a rules module.
 *
 * So `scanIcu` reads the structure instead. It covers exactly the ICU subset
 * these messages use — simple placeholders and `plural` — and THROWS on
 * anything else, which is what keeps it honest: the day a message needs
 * `select` or a date skeleton, this file fails rather than quietly under-
 * checking it, and that is the moment to reconsider the jest config.
 *
 * It moved to `src/test-support/icu.ts` in #26.05, when the Constraints
 * catalogue became the second rule set that needs it — a hand-written ICU
 * parser existing twice is exactly what this repo keeps single-source tests to
 * prevent. Its own tests stayed here, where they were written.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";
import { isPageGroup, isIgnoredFileName } from "@/lib/import/folder-utils";
import {
  DESCRIPTION_SEPARATOR,
  MAX_PROPERTY_FOLDERS,
  RULE_MESSAGE_PARTS,
  RULE_SCOPES,
  STRUCTURE_RULES,
  STRUCTURE_RULE_BY_ID,
  STRUCTURE_RULE_IDS,
  firstPerPlace,
  isDeclaredCoordinateFile,
  isPageFileName,
  isWalkedFileName,
  messageKeyFor,
  pageNumberOf,
  parsePropertyFolderName,
  propertyIdentityOf,
  ruleListingValues,
  rulesInScope,
  scopeKeyFor,
  sharedFolderName,
  sharedFolderNearMiss,
  suggestedPropertyFolderName,
  type RuleMessagePart,
  type StructureRuleId,
  type StructureViolation,
} from "@/lib/import/structure-rules";

// ---------------------------------------------------------------------------
// The catalogue itself
// ---------------------------------------------------------------------------

describe("the catalogue", () => {
  it("lists every rule exactly once, in the declared order", () => {
    expect(STRUCTURE_RULES.map((r) => r.id)).toEqual([...STRUCTURE_RULE_IDS]);
    expect(new Set(STRUCTURE_RULE_IDS).size).toBe(STRUCTURE_RULE_IDS.length);
  });

  it("is reachable by ID", () => {
    for (const id of STRUCTURE_RULE_IDS) {
      expect(STRUCTURE_RULE_BY_ID.get(id)?.id).toBe(id);
    }
    expect(STRUCTURE_RULE_BY_ID.size).toBe(STRUCTURE_RULE_IDS.length);
  });

  it("declares no placeholder twice on one rule", () => {
    for (const rule of STRUCTURE_RULES) {
      const all = [...rule.counts, ...rule.values];
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("orders scopes outside in, so the printed listing reads as three sections", () => {
    const order = ["chosenFolder", "topLevelFolder", "pageFolder"];
    const seen = STRUCTURE_RULES.map((r) => order.indexOf(r.scope));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});

describe("firstPerPlace — one instruction per folder", () => {
  const at = (culprit: string, ruleId: StructureRuleId): StructureViolation => ({
    ruleId,
    culprit,
    related: [],
    counts: {},
    values: {},
  });

  it("keeps the earliest rule in catalogue order for a place", () => {
    // The page folder that breaks three rules at once: 1.jpg, 01.jpg, plan.dwg.
    const kept = firstPerPlace([at("48-50D/Contract", "STR-13"), at("48-50D/Contract", "STR-12")]);
    expect(kept.map((v) => v.ruleId)).toEqual(["STR-12"]);
  });

  it("keeps one violation per distinct place", () => {
    const kept = firstPerPlace([
      at("48-50D/Contract", "STR-13"),
      at("48-50D/Plan", "STR-11"),
      at("48-50D/Contract", "STR-12"),
    ]);
    expect(kept.map((v) => [v.culprit, v.ruleId])).toEqual([
      ["48-50D/Plan", "STR-11"],
      ["48-50D/Contract", "STR-12"],
    ]);
  });

  it("returns catalogue order, stably", () => {
    const input = [at("b", "STR-12"), at("a", "STR-04"), at("c", "STR-12")];
    expect(firstPerPlace(input).map((v) => v.culprit)).toEqual(["a", "b", "c"]);
    expect(firstPerPlace(input)).toEqual(firstPerPlace(input));
  });
});

// ---------------------------------------------------------------------------
// The property-folder name grammar
// ---------------------------------------------------------------------------

describe("parsePropertyFolderName — names that are correct", () => {
  it.each([
    ["47per2-225per3per24", "47per2", "225per3per24", null],
    ["48-50D", "48", "50D", null],
    ["225per3-24bis", "225per3", "24bis", null],
    ["47-2", "47", "2", null],
    ["47per2-225per3per24||2716 Prisecaru", "47per2", "225per3per24", "2716 Prisecaru"],
    ["48-50D||Livada de sus", "48", "50D", "Livada de sus"],
  ])("%s", (name, tarla, parcela, description) => {
    expect(parsePropertyFolderName(name)).toEqual({ ok: true, tarla, parcela, description });
  });

  it("tolerates surrounding whitespace and either case of per", () => {
    expect(parsePropertyFolderName("  47PER2-225per3  ")).toEqual({
      ok: true,
      tarla: "47PER2",
      parcela: "225per3",
      description: null,
    });
  });

  it("does not decode per — that happens at the database boundary", () => {
    const parsed = parsePropertyFolderName("47per2-225per3per24");
    expect(parsed.ok && parsed.tarla).toBe("47per2");
  });
});

describe("parsePropertyFolderName — the identifiers are right, the separator is not", () => {
  it.each([
    ["47per2-225per3per24-2716 Prisecaru", "47per2-225per3per24"],
    ["48-50D 2716", "48-50D"],
    ["47-2||", "47-2"],
    ["47-2||a||b", "47-2"],
    ["48-50 bis", "48-50"],
  ])("%s → separator", (name, prefix) => {
    expect(parsePropertyFolderName(name)).toEqual({ ok: false, reason: "separator", prefix });
  });
});

describe("parsePropertyFolderName — nothing cadastral to recover", () => {
  it.each([
    "2024-Arhiva",           // #23.00's false positive: tarla 2024 / parcela "Arhiva"
    "3 Calea Victoriei",     // #23.00's other one: tarla "3"
    "Documente generale",
    "common",
    "47",                    // a tarla with no parcela is not a property folder name
    "47per",                 // a dangling per — perToSlash would make it "47/"
    "47per-2",               // the same, as a tarla
    "-2",
    "",
  ])("%s → cadastral", (name) => {
    expect(parsePropertyFolderName(name)).toEqual({
      ok: false,
      reason: "cadastral",
      prefix: null,
    });
  });

  it.each([
    "48-50Arhiva",           // a letter run longer than any suffix
    "48-50Ana-Maria",        // "Ana" is three letters and is not a suffix
    "10-20Sud-Est",
    "48-50Lot 3",
    "48-50Ion-Popescu",
  ])("%s → cadastral, not a mid-word cut", (name) => {
    // Every one of these was diagnosed as a missing separator by the first
    // draft, which allowed ANY run of up to three letters as a suffix. The
    // user was told to rename "48-50Ana-Maria" to "48-50Ana||Maria", creating
    // a Property whose parcela is "50Ana". A length limit cannot tell a suffix
    // from the first syllable of a word; the allowlist can.
    expect(parsePropertyFolderName(name)).toEqual({
      ok: false,
      reason: "cadastral",
      prefix: null,
    });
    expect(suggestedPropertyFolderName(name)).toBeNull();
  });
});

describe("suggestedPropertyFolderName", () => {
  it("inserts the separator, dropping whatever the user used instead", () => {
    expect(suggestedPropertyFolderName("47per2-225per3per24-2716 Prisecaru")).toBe(
      `47per2-225per3per24${DESCRIPTION_SEPARATOR}2716 Prisecaru`,
    );
    expect(suggestedPropertyFolderName("48-50D 2716")).toBe(`48-50D${DESCRIPTION_SEPARATOR}2716`);
  });

  it("joins a suffix the user spaced out, rather than demoting it to description", () => {
    // Romanian writes "parcela 50 bis". Suggesting "48-50||bis" would rename
    // the folder to a DIFFERENT parcel — 50 rather than 50bis — and the user
    // would accept it because the instruction said so.
    expect(suggestedPropertyFolderName("48-50 bis")).toBe("48-50bis");
    expect(suggestedPropertyFolderName("47-2 A")).toBe("47-2A");
  });

  it("does not join when the parcela already carries a suffix", () => {
    expect(suggestedPropertyFolderName("48-50D bis")).toBe(`48-50D${DESCRIPTION_SEPARATOR}bis`);
  });

  it("drops a separator the user started and did not finish", () => {
    expect(suggestedPropertyFolderName("47-2||")).toBe("47-2");
  });

  it("flattens a second separator rather than suggesting a name that fails the same rule", () => {
    expect(suggestedPropertyFolderName("47-2||a||b")).toBe("47-2||a b");
  });

  it("suggests nothing for a name that is already correct", () => {
    expect(suggestedPropertyFolderName("47per2-225per3per24")).toBeNull();
    expect(suggestedPropertyFolderName("48-50D||Livada")).toBeNull();
  });

  it("suggests nothing when there are no identifiers to keep", () => {
    expect(suggestedPropertyFolderName("2024-Arhiva")).toBeNull();
    expect(suggestedPropertyFolderName("Documente generale")).toBeNull();
  });

  it("always produces a name that parses", () => {
    for (const wrong of [
      "47per2-225per3per24-2716 Prisecaru",
      "48-50D 2716",
      "47-2||",
      "47-2||a||b",
      "48-50 bis",
      "48-50D bis",
    ]) {
      const suggestion = suggestedPropertyFolderName(wrong);
      expect(suggestion).not.toBeNull();
      expect(parsePropertyFolderName(suggestion!).ok).toBe(true);
    }
  });
});

describe("propertyIdentityOf — what makes two folders the same property (STR-03)", () => {
  it("folds the encodings that reach the database identically", () => {
    expect(propertyIdentityOf("47per2-225per3")).toBe(propertyIdentityOf("47PER2-225per3"));
    expect(propertyIdentityOf("48-50D")).toBe(propertyIdentityOf("48 - 50D"));
    expect(propertyIdentityOf("48-50D")).toBe(propertyIdentityOf("48-50D||acte vechi"));
  });

  it("keeps different properties different", () => {
    expect(propertyIdentityOf("48-50D")).not.toBe(propertyIdentityOf("48-50"));
    expect(propertyIdentityOf("47per2-225")).not.toBe(propertyIdentityOf("47-2per225"));
  });

  it("treats leading zeros as significant, because the database does", () => {
    expect(propertyIdentityOf("48-50")).not.toBe(propertyIdentityOf("048-050"));
  });

  it("refuses to compare names that are not property folders", () => {
    expect(propertyIdentityOf("Documente generale")).toBeNull();
    expect(propertyIdentityOf("common")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The shared folders
// ---------------------------------------------------------------------------

describe("common and floating", () => {
  it("recognises them only when spelled exactly", () => {
    expect(sharedFolderName("common")).toBe("common");
    expect(sharedFolderName("floating")).toBe("floating");
    expect(sharedFolderName("Common")).toBeNull();
    expect(sharedFolderName("COMMON")).toBeNull();
  });

  it("names the near miss so the user gets a rename, not a lecture", () => {
    expect(sharedFolderNearMiss("Common")).toBe("common");
    expect(sharedFolderNearMiss("COMMON")).toBe("common");
    expect(sharedFolderNearMiss(" Floating ")).toBe("floating");
  });

  it("STR-04 and STR-05 cannot both fire — an exact name is never a near miss", () => {
    expect(sharedFolderNearMiss("common")).toBeNull();
    expect(sharedFolderNearMiss("floating")).toBeNull();
  });

  it("is not a general Romanian synonym matcher", () => {
    // "comun" is a different word, not a misspelling of "common". It falls to
    // STR-04, which tells the user to rename it or move it — the honest answer.
    expect(sharedFolderNearMiss("comun")).toBeNull();
    expect(sharedFolderNearMiss("47per2-225per3")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The delegated rules — where this module must agree with the walk
// ---------------------------------------------------------------------------

describe("page files agree with the walk, not with the source document", () => {
  it("accepts a numbered image", () => {
    expect(isPageFileName("1.jpg")).toBe(true);
    expect(isPageFileName("001.jpg")).toBe(true);
    expect(isPageFileName("12.PNG")).toBe(true);
  });

  it("refuses a numbered PDF, because isPageGroup would refuse it too", () => {
    // The failure this guards: the source document says "pages are always
    // numbered", `isPageGroup` also requires the IMAGE kind, and a rule that
    // only read the source document would bless 1.pdf/2.pdf/3.pdf — which the
    // walk then imports as three separate documents while Structure said the
    // folder was fine.
    expect(isPageFileName("1.pdf")).toBe(false);
    expect(isPageGroup(["1.pdf", "2.pdf"])).toBe(false);
  });

  it("refuses anything that is not a bare number", () => {
    expect(isPageFileName("CVC 1 pg 1.jpg")).toBe(false);
    expect(isPageFileName("scan final.jpg")).toBe(false);
    expect(isPageFileName("1a.jpg")).toBe(false);
  });

  it("reads the page number the way the walk sorts it", () => {
    expect(pageNumberOf("1.jpg")).toBe(1);
    expect(pageNumberOf("001.jpg")).toBe(1);   // the STR-13 collision, by design
    expect(pageNumberOf("31316.jpg")).toBe(31316);
    expect(pageNumberOf("scan.jpg")).toBeNull();
  });

  it("has no page number for a name too long to be an exact integer", () => {
    // Inherited from `sortNumericFilenames`, which computes Infinity - Infinity
    // on the same input. Harmless because STR-14 requires 1…n, which no such
    // file can satisfy — but pinned so it stays a known answer.
    const huge = `${"9".repeat(400)}.jpg`;
    expect(isPageFileName(huge)).toBe(true);
    expect(pageNumberOf(huge)).toBeNull();
  });

  it("counts only the files the walk keeps", () => {
    // Without this, a page folder of 1.jpg / 2.jpg / Thumbs.db breaks STR-12
    // and the import stops — instructing a Romanian user to rename an
    // invisible Windows metadata file to "1". The walk drops it BEFORE
    // page-group detection, so that folder is already a clean 2-page document.
    for (const dropped of ["Thumbs.db", "desktop.ini", "folder.jpg", ".DS_Store", "plan.dwg", "x.bak"]) {
      expect(isWalkedFileName(dropped)).toBe(false);
      expect(isIgnoredFileName(dropped)).toBe(true);
    }
    expect(isWalkedFileName("1.jpg")).toBe(true);
    expect(isWalkedFileName("contract.pdf")).toBe(true);
  });

  it("agrees with isPageGroup once the dropped files are removed", () => {
    const names = ["1.jpg", "2.jpg", "Thumbs.db", "plan.dwg"];
    const walked = names.filter(isWalkedFileName);
    expect(walked.every(isPageFileName)).toBe(true);
    expect(isPageGroup(walked)).toBe(true);
  });
});

describe("coordinate files are recognised by the convention, not by the parse", () => {
  it("accepts the convention", () => {
    expect(isDeclaredCoordinateFile("coord 47per2-225per3per24.txt")).toBe(true);
    expect(isDeclaredCoordinateFile("COORD vechi.txt")).toBe(true);
    expect(isDeclaredCoordinateFile("coordonate teren.txt")).toBe(true);
  });

  it("leaves ordinary text files alone — they are business content", () => {
    expect(isDeclaredCoordinateFile("note.txt")).toBe(false);
    expect(isDeclaredCoordinateFile("date vanzator.txt")).toBe(false);
  });

  it("does not claim a non-txt file", () => {
    expect(isDeclaredCoordinateFile("coord 47per2.csv")).toBe(false);
    expect(isDeclaredCoordinateFile("coord.jpg")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Every rule has its sentences, in BOTH locales
// ---------------------------------------------------------------------------

type RuleMessages = Record<StructureRuleId, Record<RuleMessagePart, string>>;

function readMessages(file: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as Record<string, unknown>;
}

function loadRuleMessages(file: string): RuleMessages {
  const json = readMessages(file) as {
    adminImport?: { structure?: { rule?: RuleMessages } };
  };
  const rules = json.adminImport?.structure?.rule;
  if (!rules) throw new Error(`${file} has no adminImport.structure.rule block`);
  return rules;
}

/** Read the value at a dotted path, so `messageKeyFor` is exercised rather than trusted. */
function atKeyPath(file: string, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      readMessages(file),
    );
}

const LOCALES = [{ file: "ro-RO.json" }, { file: "en-GB.json" }] as const;

describe("rule text", () => {
  it.each(LOCALES)("$file carries all three sentences for every rule", ({ file }) => {
    const rules = loadRuleMessages(file);
    for (const id of STRUCTURE_RULE_IDS) {
      for (const part of RULE_MESSAGE_PARTS) {
        const value = rules[id]?.[part];
        expect(typeof value).toBe("string");
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it.each(LOCALES)("$file holds no rule the catalogue does not list", ({ file }) => {
    // The other half of the drift #26.02 warns about: deleting a rule must
    // delete its keys, and an orphan key is invisible until someone reads the
    // file. Failing here is the cheapest place to find out.
    expect(Object.keys(loadRuleMessages(file)).sort()).toEqual([...STRUCTURE_RULE_IDS].sort());
  });

  it("is reachable through messageKeyFor, not by a hand-written path", () => {
    for (const { file } of LOCALES) {
      expect(typeof atKeyPath(file, messageKeyFor("STR-01", "violation"))).toBe("string");
    }
  });

  it("says something different in Romanian than in English", () => {
    // Romanian is the shipping locale and English is the development
    // convenience; identical strings mean the Romanian was never written.
    const ro = loadRuleMessages("ro-RO.json");
    const en = loadRuleMessages("en-GB.json");
    for (const id of STRUCTURE_RULE_IDS) {
      for (const part of RULE_MESSAGE_PARTS) {
        expect(ro[id][part]).not.toBe(en[id][part]);
      }
    }
  });
});

describe("scanIcu — the reader the message tests depend on", () => {
  it("finds simple placeholders", () => {
    expect([...scanIcu("plain {folder} here").args]).toEqual(["folder"]);
    expect([...scanIcu("no placeholders").args]).toEqual([]);
  });

  it("does not mistake a plural branch for a placeholder", () => {
    const scan = scanIcu("{n, plural, one {gol} few {# goale} other {# de goale}}");
    expect([...scan.args]).toEqual(["n"]);
    expect(scan.plurals).toEqual([{ arg: "n", categories: ["one", "few", "other"] }]);
  });

  it("finds placeholders nested inside a branch", () => {
    const scan = scanIcu("{a, plural, one {x {b} y} other {# {b} {c}}}");
    expect([...scan.args].sort()).toEqual(["a", "b", "c"]);
  });

  it("refuses what it does not understand", () => {
    for (const bad of ["{folder", "{}", "{n, select, a{x} other{y}}", "unbalanced }"]) {
      expect(() => scanIcu(bad)).toThrow();
    }
  });
});

describe("every sentence uses exactly the placeholders the catalogue declares", () => {
  it.each(LOCALES)("$file", ({ file }) => {
    const rules = loadRuleMessages(file);
    for (const id of STRUCTURE_RULE_IDS) {
      const rule = STRUCTURE_RULE_BY_ID.get(id)!;
      const declared = new Set([...rule.counts, ...rule.values]);

      // Both directions, on the violation: a placeholder the sentence uses and
      // the catalogue does not declare would render as a raw "{found}" to a
      // Romanian user; a placeholder the catalogue declares and the sentence
      // never uses is a value #26.02 computes for nothing.
      expect([...scanIcu(rules[id].violation).args].sort()).toEqual([...declared].sort());

      // The other two sentences may use fewer, never more.
      for (const part of ["requirement", "example"] as const) {
        for (const arg of scanIcu(rules[id][part]).args) {
          expect(declared).toContain(arg);
        }
      }

      // ⚠️ A PLURAL ARGUMENT MUST BE A COUNT, not a value (added #26.02).
      //
      // The check above compares against the UNION of `counts` and `values`,
      // so it cannot see the difference — which became a live risk the moment
      // #26.02 moved `number`, `lowest` and `highest` out of `counts` for
      // Romanian's thousands separator. Move one more, and `{pages, plural, …}`
      // is handed a string: `IntlMessageFormat` throws inside the screen that
      // exists to explain what is wrong, and every other test still passes.
      for (const part of RULE_MESSAGE_PARTS) {
        for (const block of scanIcu(rules[id][part]).plurals) {
          expect([...rule.counts]).toContain(block.arg);
        }
      }
    }
  });
});

describe("Romanian plural agreement", () => {
  it("declares all three categories in every Romanian plural", () => {
    // Romanian is one / few (2–19) / other (0, 20+). A message written with
    // only one/other renders "20 proprietăți" where it must read
    // "20 de proprietăți" — and English, which has no `few`, looks fine.
    const rules = loadRuleMessages("ro-RO.json");
    for (const id of STRUCTURE_RULE_IDS) {
      for (const part of RULE_MESSAGE_PARTS) {
        for (const block of scanIcu(rules[id][part]).plurals) {
          expect(block.categories).toEqual(expect.arrayContaining(["one", "few", "other"]));
        }
      }
    }
  });

  it("declares one and other in every English plural", () => {
    const rules = loadRuleMessages("en-GB.json");
    for (const id of STRUCTURE_RULE_IDS) {
      for (const part of RULE_MESSAGE_PARTS) {
        for (const block of scanIcu(rules[id][part]).plurals) {
          expect(block.categories).toEqual(expect.arrayContaining(["one", "other"]));
        }
      }
    }
  });

  it("keeps a word that must agree with a count inside its plural block", () => {
    // STR-14's first draft read "are o pagină, numerotate de la 5 la 5". The
    // participle sat OUTSIDE the plural block, hard-coded feminine plural, so
    // it could never agree at `one`. English was correct at the same input,
    // which is exactly how it survived: the only locale that ships was the
    // broken one.
    const violation = loadRuleMessages("ro-RO.json")["STR-14"].violation;
    const outsideThePlural = violation.replace(/\{pages, plural,[\s\S]*?\}\}/, "");
    expect(outsideThePlural).not.toMatch(/numerotat/i);
  });

  it("puts the property count inside a plural, since STR-02 fires above the limit", () => {
    const violation = loadRuleMessages("ro-RO.json")["STR-02"].violation;
    const [block] = scanIcu(violation).plurals;
    expect(block?.arg).toBe("found");
    // `max` is a bare number and must stay one — it is never pluralised.
    expect(violation).toContain(`{max}`);
    expect(MAX_PROPERTY_FOLDERS).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// The listing — the page #26.04 shows and saves
// ---------------------------------------------------------------------------

describe("the rules listing", () => {
  it("covers the catalogue exactly once across the three scopes", () => {
    // A rule in no scope never appears on the page; a rule in two appears
    // twice. Neither is visible by reading the catalogue, because `scope` is a
    // per-rule field and nothing cross-checks the partition.
    const listed = RULE_SCOPES.flatMap((scope) => rulesInScope(scope).map((r) => r.id));
    expect(listed).toEqual([...STRUCTURE_RULE_IDS]);
  });

  it("keeps each scope's rules in catalogue order, which is fixing order", () => {
    for (const scope of RULE_SCOPES) {
      const positions = rulesInScope(scope).map((r) => STRUCTURE_RULE_IDS.indexOf(r.id));
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it.each(LOCALES)("$file names every scope", ({ file }) => {
    for (const scope of RULE_SCOPES) {
      const heading = atKeyPath(file, scopeKeyFor(scope));
      expect(typeof heading).toBe("string");
      expect(String(heading).trim().length).toBeGreaterThan(0);
    }
  });

  it.each(LOCALES)("$file's requirement and example sentences get every value they ask for", ({ file }) => {
    // THE guard on `ruleListingValues`. These two sentences are rendered with
    // no violation in sight — the listing is read before a folder is picked —
    // so anything they interpolate has to be supplied from that one function.
    // A rewording that introduces `{max}` into STR-04's example, or renames
    // STR-02's, would otherwise print the placeholder verbatim on the one page
    // the user is meant to print and carry to File Explorer.
    const rules = loadRuleMessages(file);
    // Collected rather than asserted one at a time, so a failure names every
    // hole at once instead of the first.
    const missing: string[] = [];
    for (const id of STRUCTURE_RULE_IDS) {
      const supplied = new Set(Object.keys(ruleListingValues(id)));
      for (const part of ["requirement", "example"] as const) {
        for (const arg of scanIcu(rules[id][part]).args) {
          if (!supplied.has(arg)) missing.push(`${id}.${part} wants {${arg}}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("supplies nothing for a rule whose listing sentences interpolate nothing", () => {
    // The other direction: a stray value is harmless to render but it is a
    // claim about a sentence that does not exist, and the next reader believes
    // it. STR-01 is the case — its VIOLATION interpolates two things and its
    // requirement and example interpolate none.
    expect(ruleListingValues("STR-01")).toEqual({});
    expect(ruleListingValues("STR-02")).toEqual({ max: MAX_PROPERTY_FOLDERS });
  });
});
