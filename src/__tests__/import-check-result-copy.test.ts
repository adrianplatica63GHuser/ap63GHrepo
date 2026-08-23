/**
 * The clean-check account's copy, in both locales.              (Slice #29.11)
 *
 * This card is the only place a stage that finds nothing wrong says what it
 * looked at. Everything on it is a label over a number the user is expected to
 * compare against their own folder, plus one paragraph that explains how the
 * import reads a folder NAME — which is the sentence #29.01's F9 exists for,
 * and the one a user acts on in File Explorer.
 *
 * It matters more than chrome usually does for the reason this whole folder
 * shares: `DEFAULT_LOCALE` is `ro-RO`, so a missing key does not fall back to
 * English — it renders the raw key path into the shipping UI.
 *
 * No React is rendered here. Nothing in this suite does, and a test that did
 * would prove the JSX compiles rather than that the copy exists, which is the
 * half that goes wrong silently. The last two tests read the wizard's and the
 * card's own source instead, so the lists below cannot drift from them.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

const WIZARD = path.join(
  "src",
  "app",
  "admin",
  "import",
  "_components",
  "import-wizard.tsx",
);

function messages(file: string): Record<string, unknown> {
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

function checkResultCopy(file: string): unknown {
  return at(messages(file), "adminImport.checkResult");
}

/**
 * Every string the card asks for, by the exact path the wizard uses.
 *
 * Written out rather than derived from the JSON, which would only prove the
 * file agrees with itself. This is the demand; the file is the supply, and the
 * last test reads the wizard to prove the two agree.
 */
const REQUIRED_KEYS = [
  "title",
  "structure.rules",
  "structure.violations",
  "structure.directories",
  "structure.propertyFolders",
  "structure.sharedFolders",
  "structure.noSharedFolders",
  "structure.files",
  "structure.documents",
  "structure.pageGroups",
  "structure.ignored",
  "structure.readingsTitle",
  "structure.readingsRule",
  "structure.tarla",
  "structure.parcela",
  "structure.description",
  "structure.noDescription",
  "structure.moreFolders",
  "constraints.rules",
  "constraints.violations",
  "constraints.files",
  "constraints.documents",
  "constraints.unreadable",
  "duplication.rules",
  "duplication.found",
  "duplication.files",
  "duplication.documents",
] as const;

describe("the clean-check account's copy", () => {
  it.each(LOCALES)("%s carries every string the card asks for", (file) => {
    const copy = checkResultCopy(file);
    const missing = REQUIRED_KEYS.filter((key) => {
      const value = at(copy, key);
      return typeof value !== "string" || value.trim().length === 0;
    });
    expect(missing).toEqual([]);
  });

  it("names the stage the account belongs to", () => {
    // The card is drawn above a DIFFERENT stage's panel on the common path, so
    // a title that did not name its own stage would attribute the Structure
    // walk's numbers to whichever screen the user happens to be standing on.
    for (const file of LOCALES) {
      const title = String(at(checkResultCopy(file), "title"));
      expect(scanIcu(title).args.has("stage")).toBe(true);
    }
  });

  it("counts folders with a plural, `few` included in Romanian", () => {
    // Romanian has a third form for 2–19, and this repo has shipped that bug
    // once already (#26.02).
    for (const file of LOCALES) {
      const text = String(at(checkResultCopy(file), "structure.moreFolders"));
      const [block] = scanIcu(text).plurals;
      expect({ file, arg: block?.arg }).toEqual({ file, arg: "count" });
      const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];
      for (const category of wanted) {
        expect({ file, category, present: block.categories.includes(category) }).toEqual({
          file,
          category,
          present: true,
        });
      }
    }
  });

  it("⚠️ explains the split that discards the rest of the folder name", () => {
    // The whole of F9 in one sentence. `47per2-225per3per24-2000 Hascu` becomes
    // tarla 47/2 and parcela 225/3/24, and "2000 Hascu" — which the user meant
    // as an area and a locality — is thrown away. A reword that dropped the
    // "everything after the second hyphen is free text" half would leave the
    // card showing a discarded value with no statement that it was discarded.
    const ro = String(at(checkResultCopy("ro-RO.json"), "structure.readingsRule"));
    expect(ro).toContain("liniuțe");
    expect(ro).toContain("text liber");
    expect(ro).toContain("per");
    expect(ro).toContain("File Explorer");

    const en = String(at(checkResultCopy("en-GB.json"), "structure.readingsRule"));
    expect(en).toContain("hyphens");
    expect(en).toContain("free text");
    expect(en).toContain("per");
    expect(en).toContain("File Explorer");
  });

  it("⚠️ does not claim the discarded half of the name is never read", () => {
    // An adversarial round: the sentence said the free text "nu este citit de
    // sistem", and it is — `tagsForEntry` takes the RAW folder name, so the
    // whole thing including the free text becomes the tag every document from
    // that folder carries for the rest of the archive's life. A user who
    // believed the tail was ignored would rename it freely and rename their
    // filing with it, on a screen whose very next clause tells them to go and
    // rename in File Explorer. The claim is now the narrow one the card
    // actually established — not read AS a tarla or a parcela — and the tag is
    // named out loud.
    const ro = String(at(checkResultCopy("ro-RO.json"), "structure.readingsRule"));
    expect(ro).toContain("nu este citit ca tarla sau parcelă");
    expect(ro).not.toContain("nu este citit de sistem");
    expect(ro).toContain("etichet");

    const en = String(at(checkResultCopy("en-GB.json"), "structure.readingsRule"));
    expect(en).toContain("not read as a tarla or a parcela");
    expect(en).not.toContain("the system never reads it");
    expect(en).toContain("tag");
  });

  it("⚠️ never states how many rules there are", () => {
    // `STRUCTURE_RULE_IDS` holds fourteen and #29.01's report says fifteen,
    // because STR-06 was retired and STR-15 added. The card counts the list; a
    // number written into a label is a number that goes stale while the list
    // stays right.
    for (const file of LOCALES) {
      for (const key of ["structure.rules", "constraints.rules", "duplication.rules"]) {
        const label = String(at(checkResultCopy(file), key));
        expect({ file, key, hasDigit: /\d/.test(label) }).toEqual({
          file,
          key,
          hasDigit: false,
        });
      }
    }
  });

  it("⚠️ keeps each stage's all-clear as the stage's own string", () => {
    // #29.02 wrote one clean sentence per stage and this slice must not write a
    // second set. The card's headline IS `adminImport.<stage>.clean`, so the
    // three must exist and must differ from each other — a card that reused one
    // of them for another stage would claim a check that did not run.
    for (const file of LOCALES) {
      const m = messages(file);
      const sentences = ["structure", "constraints", "duplication"].map((stage) =>
        String(at(m, `adminImport.${stage}.clean`)),
      );
      for (const s of sentences) expect(s.trim().length > 0).toBe(true);
      expect(new Set(sentences).size).toBe(3);
    }
  });

  it("⚠️ asks for nothing the wizard does not ask for, and vice versa", () => {
    // `REQUIRED_KEYS` claims to be the card's demand, and it was hand
    // transcribed — so a wizard that started calling `tCheck("structure.total")`
    // would ship a dotted key path into the shipping locale with every test
    // above still green.
    const source = fs.readFileSync(path.join(process.cwd(), WIZARD), "utf8");
    const asked = new Set(
      [...source.matchAll(/tCheck\(\s*"([^"]+)"/g)].map((m) => m[1]),
    );
    const undeclared = [...asked].filter((k) => !REQUIRED_KEYS.includes(k as never)).sort();
    expect(undeclared).toEqual([]);
    const unused = REQUIRED_KEYS.filter((k) => !asked.has(k));
    expect(unused).toEqual([]);
  });

  it("⚠️ draws the account below the stage panels and below the folder report", () => {
    // Behaviour, not copy, and it is here because it cannot be seen in a
    // rendered test either: every stage panel focuses its own heading when it
    // mounts, and `focus()` scrolls. Drawn above, the account that had just
    // appeared was scrolled off the top of the screen by the panel arriving
    // under it — and a screen-reader user reading forward from that heading
    // never reached it at all. Found by an adversarial round.
    const source = fs.readFileSync(path.join(process.cwd(), WIZARD), "utf8");
    const trail = source.indexOf("{checkTrailVisible && (");
    expect(trail > 0).toBe(true);
    for (const after of [
      "<ImportStructureStage",
      "<ImportPreexistingStage",
      // The folder's own advisory findings, some of which end "Nu porniți
      // importul", on the one screen whose button spends money. Three emerald
      // all-clear cards must not sit between the panel and those.
      "<ReportSections",
    ]) {
      expect({ after, below: trail > source.indexOf(after) }).toEqual({ after, below: true });
    }
  });

  it("⚠️ hides the account while a check runs and after one that failed", () => {
    // The `walkError` half was found by an adversarial round: a re-check pressed
    // after the user renamed or unplugged the folder — which these stages send
    // them away to do — fails without clearing `entries`, so the cards came back
    // describing a folder the wizard had just failed to open.
    const source = fs.readFileSync(path.join(process.cwd(), WIZARD), "utf8");
    const start = source.indexOf("const checkAccountsSettled =");
    expect(start > 0).toBe(true);
    const expr = source.slice(start, source.indexOf(";", start));
    for (const term of [
      '"walking"',
      '"constraints-checking"',
      '"duplication-checking"',
      '"preexisting-checking"',
      "walkError === null",
    ]) {
      expect({ term, present: expr.includes(term) }).toEqual({ term, present: true });
    }
  });

  it("⚠️ gates BOTH mount points on the same expression", () => {
    // A second adversarial round: the first fix gated only the trail, and the
    // inline card — handed to the panel as `resultDetail`, behind a `!busy`
    // guard that cannot see a failed walk — stayed on screen at a Structure
    // rest whose re-check had just been unable to open the folder.
    const source = fs.readFileSync(path.join(process.cwd(), WIZARD), "utf8");
    const gated = [...source.matchAll(/resultDetail=\{([^}]*)\}/g)].map((m) => m[1]);
    expect(gated.length).toBe(3);
    for (const expr of gated) {
      // The NAME, not the ternary: a rename long enough to make Prettier wrap
      // the expression onto three lines, or a lift into a named const, is an
      // innocent edit and must not turn this red.
      expect({ expr, gated: expr.includes("checkAccountsSettled") }).toEqual({
        expr,
        gated: true,
      });
    }
  });

  it("⚠️ draws no attributed card while a step-through pause is on screen", () => {
    // The pause's emerald card carries the screen's one primary action, and
    // `import-step-gate.tsx` depends on it landing directly under the stage it
    // is talking about. Nothing is lost: with step-through on, every clean check
    // rests on its own stage and shows its account inline.
    // Matched loosely, for the reason the test above gives: the assertion is
    // that the trail's own flag is `checkAccountsSettled` narrowed by
    // `activeGate`, not that the two sit on one line.
    const source = fs.readFileSync(path.join(process.cwd(), WIZARD), "utf8");
    const start = source.indexOf("const checkTrailVisible =");
    expect(start > 0).toBe(true);
    const expr = source.slice(start, source.indexOf(";", start));
    expect({ expr, settled: expr.includes("checkAccountsSettled") }).toEqual({
      expr,
      settled: true,
    });
    expect({ expr, gate: expr.includes("activeGate === null") }).toEqual({
      expr,
      gate: true,
    });
    // The OPERATOR too, loosely: `settled || activeGate === null` would satisfy
    // both tests above and would draw the trail over every pause.
    expect({ expr, conjunction: expr.includes("&&") }).toEqual({
      expr,
      conjunction: true,
    });
  });
});
