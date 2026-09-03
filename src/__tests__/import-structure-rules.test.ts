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
  MAX_PROPERTY_FOLDERS,
  RULE_MESSAGE_PARTS,
  RULE_SCOPES,
  LEGACY_SHARED_FOLDER_SPELLINGS,
  SHARED_FOLDER_DISPLAY_NAMES,
  SHARED_FOLDER_NAMES,
  STRUCTURE_RULES,
  STRUCTURE_RULE_BY_ID,
  STRUCTURE_RULE_IDS,
  acceptedSharedFolderSpellings,
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
  needsPropertyConfirmation,
  sharedFolderName,
  sharedFolderNearMiss,
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

describe("parsePropertyFolderName — a POSITION, not a grammar   (Slice #28.02)", () => {
  it.each([
    // Everything the old cadastral grammar accepted still parses the same way.
    ["47per2-225per3per24", "47per2", "225per3per24", null],
    ["48-50D", "48", "50D", null],
    ["225per3-24bis", "225per3", "24bis", null],
    ["47-2", "47", "2", null],

    // The slice's own example, and the reason the grammar had to go: the old
    // parser refused this outright and told the user, in Romanian, to rename a
    // folder that was already right.
    ["40-212per40IE55821-Busuioc Ion", "40", "212per40IE55821", "Busuioc Ion"],

    // Two dashes: the description is what follows the second.
    ["48-50D-Livada de sus", "48", "50D", "Livada de sus"],

    // THREE AND MORE. The third dash belongs to the description, not to a
    // fourth field — the one thing about the positional rule that a reader is
    // most likely to implement as `split("-")` and get wrong.
    ["48-50D-Livada-de-sus", "48", "50D", "Livada-de-sus"],
    ["1-2-3-4-5", "1", "2", "3-4-5"],

    // Every one of these was a `cadastral` refusal before this slice, and the
    // block below them is the whole of what replaces that refusal: STR-15 asks.
    ["2024-Arhiva", "2024", "Arhiva", null],
    ["48-50Ana-Maria", "48", "50Ana", "Maria"],
    ["48-50Arhiva", "48", "50Arhiva", null],
    ["10-20Sud-Est", "10", "20Sud", "Est"],
    ["48-50 bis", "48", "50 bis", null],
    ["47per-2", "47per", "2", null],

    // ⚠️ `||` IS FOUR ORDINARY CHARACTERS. Not a separator, not a legacy
    // spelling, not special in any way — they fall wherever the dash rule puts
    // them, which for a name with one dash means inside the parcela.
    ["48-50D||Livada", "48", "50D||Livada", null],
    ["47per2-225per3per24||2716 Prisecaru", "47per2", "225per3per24||2716 Prisecaru", null],
    ["47-2||a||b", "47", "2||a||b", null],
    ["47-2||", "47", "2||", null],
    // …and with two dashes it lands in the description, still meaning nothing.
    ["48-50D-a||b", "48", "50D", "a||b"],
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
    expect(parsePropertyFolderName("48 - 50D")).toEqual({
      ok: true,
      tarla: "48",
      parcela: "50D",
      description: null,
    });
  });

  it("does not decode per — that happens at the database boundary", () => {
    // The slice's constraint, stated as a test: `212per40IE55821` stays as
    // written here and reaches the database as `212/40IE55821`, once.
    const parsed = parsePropertyFolderName("40-212per40IE55821-Busuioc Ion");
    expect(parsed.ok && parsed.parcela).toBe("212per40IE55821");
  });

  it("gives an all-whitespace description as null, not as an empty string", () => {
    expect(parsePropertyFolderName("48-50D-   ")).toEqual({
      ok: true,
      tarla: "48",
      parcela: "50D",
      description: null,
    });
  });
});

describe("parsePropertyFolderName — the names that are still not properties", () => {
  it.each([
    // No dash at all. This is now the ONLY ordinary way to fail.
    "3 Calea Victoriei",
    "Documente generale",
    "comune",
    "47",
    "47per",
    "",
    // …and the one condition beyond it, which is an absence rather than a
    // shape: an empty half cannot identify a property, and a name blessed here
    // would pass the whole Structure stage and then fail the property step with
    // a 400 in the middle of a run that has already written rows.
    "-2",
    " - 2",
    "48-",
    "48-   ",
    "-",
  ])("%s", (name) => {
    expect(parsePropertyFolderName(name)).toEqual({ ok: false });
  });
});

describe("needsPropertyConfirmation — the question that replaced the grammar", () => {
  it("asks about a property folder whose identifiers carry no per", () => {
    // Both of these are asked about, and the second is the point: nothing in a
    // name distinguishes a real `48-50D` from `2024-Arhiva`, so no exception is
    // carved for the real one. The slice says so outright.
    expect(needsPropertyConfirmation("2024-Arhiva")).toBe(true);
    expect(needsPropertyConfirmation("48-50D")).toBe(true);
    expect(needsPropertyConfirmation("1-2-3-4-5")).toBe(true);
  });

  it("does not ask when either identifier carries per, in any case", () => {
    expect(needsPropertyConfirmation("47per2-225per3per24")).toBe(false);
    expect(needsPropertyConfirmation("225PER3-24")).toBe(false);
    expect(needsPropertyConfirmation("40-212per40IE55821-Busuioc Ion")).toBe(false);
  });

  it("⚠️ reads the IDENTIFIERS, never the description", () => {
    // `per` is a fragment of ordinary words. A test against the raw name would
    // wave through exactly the folders the question exists to catch — and would
    // do it silently, which is the worst available failure for a protection.
    expect(needsPropertyConfirmation("40-212-Perdea")).toBe(true);
    expect(needsPropertyConfirmation("2024-Arhiva-Persoane")).toBe(true);
    expect(needsPropertyConfirmation("10-20-Superficie teren")).toBe(true);
  });

  it("⚠️ asks when `per` is a fragment of a WORD inside an identifier", () => {
    // The first adversarial round of this slice. `/per/i.test(segment)` read
    // these as cadastral fractions, so the question was never asked and
    // `12-superficie teren` reached a clean Structure stage and became a
    // Property — with `perToSlash` writing `parcela = "su/ficie teren"`.
    //
    // The test is `perToSlash` itself, so this can only ever agree with the
    // value the database receives. Every name here is ordinary Romanian
    // vocabulary in a land archive.
    expect(needsPropertyConfirmation("12-superficie teren")).toBe(true);
    expect(needsPropertyConfirmation("40-Perdea")).toBe(true);
    expect(needsPropertyConfirmation("Perimetru-40")).toBe(true);
    expect(needsPropertyConfirmation("2019-Persoane fizice")).toBe(true);
    expect(needsPropertyConfirmation("33-Supermarket")).toBe(true);
    // …and a dangling `per`, which decodes to nothing and identifies nothing.
    expect(needsPropertyConfirmation("47per-2")).toBe(true);
  });

  it("says nothing about a folder that is not a property at all", () => {
    // STR-04 has that one. Asking "is this a property?" about a folder already
    // being reported as not one is two instructions for one place.
    expect(needsPropertyConfirmation("Documente generale")).toBe(false);
    expect(needsPropertyConfirmation("comune")).toBe(false);
    expect(needsPropertyConfirmation("48-")).toBe(false);
  });

  it("is stable across repeated calls", () => {
    // `perToSlash` IS a `/g` regex, and a global regex keeps `lastIndex` between
    // calls when it is `.test`ed. It is used through `.replace` here, which
    // resets it — but the day someone "optimises" this into a shared `.test`,
    // this is where it goes red rather than in production on alternate folders.
    for (let i = 0; i < 4; i++) {
      expect(needsPropertyConfirmation("47per2-225per3")).toBe(false);
      expect(needsPropertyConfirmation("48-50D")).toBe(true);
      expect(needsPropertyConfirmation("12-superficie teren")).toBe(true);
    }
  });
});

describe("propertyIdentityOf — what makes two folders the same property (STR-03)", () => {
  it("folds the encodings that reach the database identically", () => {
    expect(propertyIdentityOf("47per2-225per3")).toBe(propertyIdentityOf("47PER2-225per3"));
    expect(propertyIdentityOf("48-50D")).toBe(propertyIdentityOf("48 - 50D"));
    // The description is not part of the identity — and since #28.02 the
    // description is what follows the SECOND dash, so this is the pair that
    // used to be spelled with `||`.
    expect(propertyIdentityOf("48-50D")).toBe(propertyIdentityOf("48-50D-acte vechi"));
    // …and `||` now being ordinary characters, it changes the parcela and
    // therefore the identity. A folder still named the old way is a different
    // property, which is the honest reading of a name nothing teaches any more.
    expect(propertyIdentityOf("48-50D")).not.toBe(propertyIdentityOf("48-50D||acte vechi"));
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

describe("the shared folders", () => {
  it("recognises the Romanian names the product teaches", () => {
    expect(sharedFolderName("comune")).toBe("common");
    expect(sharedFolderName("flotante")).toBe("floating");
  });

  it("⚠️ still accepts the English names every existing archive is built on", () => {
    // Slice #26.11 renamed what the user types, not what a disk already says.
    // Adrian was mid-import against a folder holding `common` and `floating`
    // when this landed, and every archive Ciprian has prepared is spelled the
    // same way. Dropping these turns a copy change into a rename chore across
    // every folder he owns.
    expect(sharedFolderName("common")).toBe("common");
    expect(sharedFolderName("floating")).toBe("floating");
  });

  it("⚠️ answers the IDENTITY, never the spelling it was handed", () => {
    // The return value is a bucket tag (`EntryAssignment.bucket`), not
    // something to show anyone. A caller that wants the name for a sentence
    // goes through SHARED_FOLDER_DISPLAY_NAMES — returning the matched
    // spelling here would put "common" back into a Romanian instruction for
    // any user whose disk still says it.
    expect(sharedFolderName("comune")).toBe(sharedFolderName("common"));
    expect(SHARED_FOLDER_DISPLAY_NAMES[sharedFolderName("common")!]).toBe("comune");
  });

  it("recognises them only when spelled exactly", () => {
    expect(sharedFolderName("Comune")).toBeNull();
    expect(sharedFolderName("COMUNE")).toBeNull();
    expect(sharedFolderName("Common")).toBeNull();
    expect(sharedFolderName("COMMON")).toBeNull();
  });

  it("names the near miss so the user gets a rename, not a lecture", () => {
    expect(sharedFolderNearMiss("Comune")).toBe("common");
    expect(sharedFolderNearMiss("COMUNE")).toBe("common");
    expect(sharedFolderNearMiss(" Flotante ")).toBe("floating");
  });

  it("⚠️ treats a miscased LEGACY name as a near miss too", () => {
    // Someone whose disk says `Common` is fixing a capital letter either way,
    // and the instruction they get names `comune` — so the one chore they are
    // asked to do also brings them onto the spelling the product teaches.
    expect(sharedFolderNearMiss("Common")).toBe("common");
    expect(sharedFolderNearMiss("COMMON")).toBe("common");
    expect(sharedFolderNearMiss(" Floating ")).toBe("floating");
  });

  it("STR-04 and STR-05 cannot both fire — an accepted name is never a near miss", () => {
    for (const name of ["comune", "flotante", "common", "floating"]) {
      expect(sharedFolderNearMiss(name)).toBeNull();
    }
  });

  it("is not a general Romanian synonym matcher", () => {
    // "comun" is a different word, not a misspelling of "comune" — it folds to
    // itself and matches nothing. It falls to STR-04, which tells the user to
    // rename it or move it, rather than accusing them of a typo they did not
    // make. Same for "flotant".
    expect(sharedFolderNearMiss("comun")).toBeNull();
    expect(sharedFolderNearMiss("flotant")).toBeNull();
    expect(sharedFolderNearMiss("47per2-225per3")).toBeNull();
  });

  it("⚠️ keeps every accepted spelling out of the property parse", () => {
    // A shared folder must never parse as a property, or it would be counted
    // toward MAX_PROPERTY_FOLDERS and given a cadastral identity.
    //
    // ⚠️ Since #28.02 this holds for a reason that is one character wide: none
    // of the four names contains a dash. A future shared spelling that did —
    // `acte-comune`, say — WOULD parse as a property, and the guards in
    // `classifyTopLevel` and `confirmablePropertyPath` are what stop it being
    // treated as one. This test is where that would first go red.
    for (const name of ["comune", "flotante", "common", "floating"]) {
      expect(propertyIdentityOf(name)).toBeNull();
      expect(parsePropertyFolderName(name).ok).toBe(false);
      expect(needsPropertyConfirmation(name)).toBe(false);
    }
  });

  it("⚠️ lists the canonical spelling first", () => {
    // `acceptedSharedFolderSpellings` is ordered so that a future caller
    // wanting "the name to show" gets the one the product teaches rather than
    // whichever alias it happened to match.
    expect(acceptedSharedFolderSpellings("common")[0]).toBe("comune");
    expect(acceptedSharedFolderSpellings("floating")[0]).toBe("flotante");
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

  it("⚠️ never offers `||` back to the user, in either locale   (Slice #28.02)", () => {
    // The slice's words: "Every string that suggests `||` to the user goes with
    // it." The separator is retired, so a sentence still teaching it would send
    // a business user to File Explorer to type a character the parser now reads
    // as part of the parcela — creating a property called `50D||Livada` on the
    // strength of an instruction the product printed itself.
    //
    // The WHOLE structure block, not only the rule sentences: the examples, the
    // scope headings and the saved page's strings are all copy a user reads.
    for (const { file } of LOCALES) {
      const json = readMessages(file) as { adminImport?: { structure?: unknown } };
      expect(JSON.stringify(json.adminImport?.structure)).not.toContain("||");
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

// ---------------------------------------------------------------------------
// S-08 — the tolerance the checker grants is the tolerance the copy states
// ---------------------------------------------------------------------------
//
// Slice #32.19. The finding, in its own words: "STR-05 teaches comune and
// flotante, lower case, and nothing in the interface says otherwise — but
// LEGACY_SHARED_FOLDER_SPELLINGS still accepts common and floating silently. So
// Comune is refused where common passes."
//
// ⚠️ **THE FIX WAS THE COPY, NOT THE CODE, so this is where the regression guard
// belongs.** Withdrawing the legacy spellings would make the message worse: with
// them gone `common` stops being an STR-05 near miss and falls to STR-04, which
// tells the user to rename the folder to `tarla-parcela` or move its files out —
// handed to every archive Ciprian has already prepared. The behaviour tests in
// import-structure-check.test.ts therefore assert exactly what they did before.
// What changed is that the rules screen no longer contradicts the checker.
//
// ⚠️ **DERIVED FROM THE CONSTANTS, NOT FROM A LIST TYPED HERE**, because
// LEGACY_SHARED_FOLDER_SPELLINGS' own header says it "only ever grows". The next
// spelling added to it fails this test until STR-05's two sentences name it,
// which is the whole of what S-08 was about.

describe("STR-05's copy states every spelling the checker accepts", () => {
  const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

  it.each(LOCALES)("%s names both canonical folders in the requirement", (file) => {
    const requirement = loadRuleMessages(file)["STR-05"].requirement;
    for (const id of SHARED_FOLDER_NAMES) {
      expect([file, id, requirement]).toEqual([
        file,
        id,
        expect.stringContaining(SHARED_FOLDER_DISPLAY_NAMES[id]),
      ]);
    }
  });

  it.each(LOCALES)("%s names every accepted LEGACY spelling in the requirement", (file) => {
    // The S-08 assertion. A spelling the checker accepts and the rule text does
    // not mention is a rule a user cannot reason from — which is how `Comune`
    // came to be refused where `common` passed with nothing said either way.
    //
    // ⚠️ **THE REQUIREMENT AND NOT THE EXAMPLE, and an adversarial round moved
    // it.** A draft put "common, floating" into the example under `correctAlt`
    // („Bine:"), which `rule-example.tsx` paints in exactly the same emerald as
    // „Corect:" — so the deprecated half read as approvingly as the taught one,
    // and it sat one initial capital away from „Common" in the „Greșit:" half of
    // the same 12px italic line. The tolerance is a paragraph, not a token.
    //
    // ⚠️ **AND THIS ASSERTS MENTION, NOT CLAIM.** A future example reading
    // "Wrong: common" would pass it. Prose cannot be checked by substring; what
    // this guards is the thing S-08 actually reported, which is SILENCE.
    const rules = loadRuleMessages(file)["STR-05"];
    const missing: string[] = [];
    for (const id of SHARED_FOLDER_NAMES) {
      for (const spelling of LEGACY_SHARED_FOLDER_SPELLINGS[id]) {
        if (!rules.requirement.includes(spelling)) {
          missing.push(`${file} STR-05.requirement omits "${spelling}"`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("%s says a legacy folder satisfies the OTHER rules too", (file) => {
    // STR-04 and STR-09 enumerate the accepted set as "comune / flotante" and
    // say nothing about `common`. Rather than reword three rules, STR-05 carries
    // the general statement — "wherever these rules say comune or flotante, a
    // folder named common or floating means the same folder" — which is where a
    // reader of the printed listing meets the two spellings in the first place.
    const requirement = loadRuleMessages(file)["STR-05"].requirement;
    const general = file === "ro-RO.json" ? "oriunde aceste reguli" : "wherever these rules";
    expect([file, requirement]).toEqual([file, expect.stringContaining(general)]);
  });

  // ⚠️ Pins a word stem rather than a sentence, so a REWORD of the retirement
  // clause fails here and a reader has to decide deliberately whether the claim
  // is still being made. If the wording changes to a synonym, change this line —
  // it is the assertion that is out of date, not the copy.
  it.each(LOCALES)("%s says the legacy spellings are on their way out", (file) => {
    // Not a nag in the import — there is deliberately none, and a warning nobody
    // can act on without a morning of renaming would be worse than the
    // inconsistency it reports. This is the rules LISTING, which the user reads
    // before picking a folder and which #26.04 exists for them to print and
    // carry to File Explorer. Saying "still accepted, being retired" there costs
    // them nothing and is the only place the two facts can sit together.
    const requirement = loadRuleMessages(file)["STR-05"].requirement;
    const retiring = file === "ro-RO.json" ? "retrase" : "retired";
    expect([file, requirement]).toEqual([file, expect.stringContaining(retiring)]);
  });

  it("⚠️ the canonical spelling is never itself a legacy one", () => {
    // A guard on the constants rather than on the copy: if a future rename left
    // the outgoing name in BOTH records, `acceptedSharedFolderSpellings` would
    // list it twice and the sentences above would read as though the product
    // taught and deprecated the same word.
    for (const id of SHARED_FOLDER_NAMES) {
      expect(LEGACY_SHARED_FOLDER_SPELLINGS[id]).not.toContain(
        SHARED_FOLDER_DISPLAY_NAMES[id],
      );
      const accepted = acceptedSharedFolderSpellings(id);
      expect(new Set(accepted).size).toBe(accepted.length);
    }
  });
});
