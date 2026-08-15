/**
 * The property step's copy, in both locales.   (Slice #26.07)
 *
 * The logic is pinned elsewhere — `import-property-plan.test.ts` for what the
 * step decides, `import-property-folders.test.ts` for which document goes
 * where. What is left is the sentences, and they matter more than chrome
 * usually does for two reasons.
 *
 * The first is mechanical: `DEFAULT_LOCALE` is `ro-RO`, so a missing key does
 * not fall back to English — it renders the raw key path into the shipping UI.
 *
 * The second is that this screen is the ONLY place a user is told that
 * documents are about to be attached to a Property that already exists, and
 * asked to agree. A tick beside a sentence that does not say what it does is
 * not a confirmation, and nothing else in the suite would notice.
 *
 * The component is not rendered here. Nothing in this project's suite renders
 * React, and a test that did would prove the JSX compiles rather than that the
 * copy exists — which is the half that goes wrong silently. The last test
 * closes that gap the way the other stage suites do: by reading the component's
 * source for the keys it actually asks for.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";
import { SHARED_FOLDER_DISPLAY_NAMES } from "@/lib/import/structure-rules";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

const COMPONENT = "src/app/admin/import/_components/property-step-dialog.tsx";

function loadCopy(file: string): Record<string, unknown> {
  const json = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { wizard: { propertyStep: Record<string, unknown> } } };
  return json.adminImport.wizard.propertyStep;
}

/**
 * Every key the dialog (and the wizard's chip) asks for, written out rather
 * than derived from the JSON — which would only prove the file agrees with
 * itself.
 */
const REQUIRED_KEYS = [
  "title",
  "intro",
  "introNoProperties",
  "loading",
  "planFailed",
  "retry",
  "documentCount",
  "cadastral",
  "coordinateNone",
  "cornersNone",
  "coordinateUnreadable",
  "coordinateFound",
  "willCreate",
  "alreadyExists",
  "confirmLink",
  "confirmCorners",
  "cornersKept",
  "cornersKeptNoFile",
  "cornersAlreadyApplied",
  "ambiguous",
  "ambiguousBlocks",
  "commonNote",
  "commonNoteUnlinked",
  "floatingNote",
  "unassignedNote",
  "progress",
  "cancelButton",
  "confirmButton",
  "confirmBusy",
  "errorSession",
  "errorStale",
  "errorPartial",
  "errorFolderMissing",
  "noNickname",
  "chipCorners",
] as const;

/**
 * The body of one plural branch, braces balanced.
 *
 * `message.split` cannot do this: a branch legitimately contains `{code}`, and
 * a naive split on `}` ends the branch at the placeholder.
 */
function pluralBranch(message: string, category: string): string {
  const marker = `${category} {`;
  const start = message.indexOf(marker);
  if (start === -1) return "";
  let depth = 1;
  let i = start + marker.length;
  for (; i < message.length && depth > 0; i++) {
    if (message[i] === "{") depth += 1;
    else if (message[i] === "}") depth -= 1;
  }
  return message.slice(start + marker.length, i - 1);
}

/**
 * Romanian verb forms that can only belong to a plural subject.
 *
 * Deliberately a short list of the ones these sentences actually use, not an
 * attempt at a conjugator: what it has to catch is a plural verb left behind in
 * a singular branch by a copy edit, and the sentences here are written by hand
 * from a small vocabulary.
 *
 * ⚠️ **`fost` is not on it and must not be**, though it looks like it belongs:
 * the participle is identical in both numbers, so `a fost creată` (singular)
 * and `au fost create` (plural) differ only in the auxiliary. `au` is the
 * plural-only half and is what this catches. The word boundaries are Unicode
 * lookarounds, not `\b` — `\b` is ASCII-only and does not see ă â î ș ț as
 * word characters at all, which is the trap `C:\dev\CLAUDE.md` records.
 */
const RO_PLURAL_VERBS = /(?<![\p{L}\p{N}])(vor|au|sunt|rămân|celor|cele|acestea)(?![\p{L}\p{N}])/u;

/** The English half of the same list. `en-GB` is not the shipping locale — this is hygiene. */
const EN_PLURAL_WORDS = /(?<![\p{L}\p{N}])(have|are|were|they|them|these)(?![\p{L}\p{N}])/u;

/**
 * A counted sentence must agree with its own count — which means two things,
 * and the first version of this helper only checked the second.
 *
 *  1. **The `one` branch is written in the singular.** An adversarial round
 *     rewrote `errorPartial`'s `one` branch to "O proprietate au fost deja
 *     create" — the exact defect this is named for, entirely inside the branch
 *     — and the placement check stayed green, which made the test a description
 *     rather than a guard.
 *  2. **Nothing but the closing punctuation follows the plural block.** A verb
 *     or an article after it cannot agree with it at all; that is how
 *     `errorPartial` shipped "O proprietate … și rămân în sistem" and how
 *     `confirmLink` shipped the genitive plural "celor 1 document".
 */
function expectVerbInsidePlural(file: string, key: string, arg = "count"): void {
  const message = String(loadCopy(file)[key]);
  const [block] = scanIcu(message).plurals;
  expect({ file, key, arg: block?.arg }).toEqual({ file, key, arg });

  const tail = message.slice(message.lastIndexOf("}}") + 2).trim();
  expect({ file, key, tail }).toEqual({ file, key, tail: "." });

  const singular = pluralBranch(message, "one");
  const pattern = file === "ro-RO.json" ? RO_PLURAL_VERBS : EN_PLURAL_WORDS;
  expect({ file, key, singular, plural: pattern.test(singular) }).toEqual({
    file,
    key,
    singular,
    plural: false,
  });

  // ⚠️ …and no literal count either. `celor` is on the Romanian list because
  // `confirmLink` shipped "legarea celor 1 document" — a genitive PLURAL
  // article in the singular branch — and `#` in a `one` branch is the same
  // mistake spelled with a placeholder: "1 document" reads as a machine
  // counting rather than a sentence.
  expect({ file, key, singular, counted: /#|(?<![\p{L}\p{N}])1(?![\p{L}\p{N}])/u.test(singular) })
    .toEqual({ file, key, singular, counted: false });
}

describe("the property step's copy", () => {
  it.each(LOCALES)("%s carries every key the screen asks for", (file) => {
    const copy = loadCopy(file);
    const missing = REQUIRED_KEYS.filter(
      (key) => typeof copy[key] !== "string" || String(copy[key]).trim() === "",
    );
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("%s interpolates exactly the values each sentence is handed", (file) => {
    const copy = loadCopy(file);
    const expected: Record<string, string[]> = {
      intro: ["folder"],
      introNoProperties: ["folder"],
      planFailed: ["error"],
      cadastral: ["parcela", "tarla"],
      coordinateUnreadable: ["name"],
      coordinateFound: ["count", "name"],
      willCreate: ["corners"],
      alreadyExists: ["code", "nickname"],
      confirmLink: ["code", "count"],
      confirmCorners: ["code", "count"],
      cornersKept: ["existing", "offered"],
      cornersAlreadyApplied: ["count"],
      cornersKeptNoFile: ["existing"],
      ambiguous: ["count"],
      errorStale: ["folder"],
      errorFolderMissing: ["folder"],
      errorPartial: ["count"],
      progress: ["done", "total"],
    };
    for (const [key, args] of Object.entries(expected)) {
      expect({ key, args: [...scanIcu(String(copy[key])).args].sort() }).toEqual({
        key,
        args: [...args].sort(),
      });
    }
  });

  it.each(LOCALES)("⚠️ %s puts each value where the sentence means it", (file) => {
    // A SET comparison cannot see a transposition, and several of these carry
    // two interchangeable values: measured, swapping `{tarla}` and `{parcela}`,
    // or `{done}` and `{total}`, or `{code}` and `{nickname}`, left the whole
    // suite green — so a user could read "Tarla/sola 50D · parcela 48" and
    // "Se pregătesc proprietățile… 5 din 2" with nothing red anywhere.
    const copy = loadCopy(file);
    const order: Record<string, string[]> = {
      cadastral: ["tarla", "parcela"],
      progress: ["done", "total"],
      alreadyExists: ["code", "nickname"],
      cornersKept: ["existing", "offered"],
    };
    for (const [key, args] of Object.entries(order)) {
      const message = String(copy[key]);
      const positions = args.map((arg) => message.indexOf(`{${arg}`));
      const ordered = positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]));
      expect({ file, key, positions, ordered }).toEqual({ file, key, positions, ordered: true });
    }
  });

  it.each(LOCALES)("%s pluralises every count, with Romanian's third form", (file) => {
    // Romanian has a `few` form for 2–19 that English does not, and #26.02
    // already shipped this exact bug once.
    const copy = loadCopy(file);
    const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];
    const pluralised: [string, string][] = [
      ["documentCount", "count"],
      ["coordinateFound", "count"],
      ["willCreate", "corners"],
      ["confirmCorners", "count"],
      ["ambiguous", "count"],
      ["confirmLink", "count"],
      ["cornersAlreadyApplied", "count"],
      // ⚠️ Added late: this was the one counted Romanian sentence on neither
      // list, and deleting its `few` branch left the whole suite green. A
      // corner count on an existing parcel is normally 2–19, which is exactly
      // the range `few` covers.
      ["cornersKeptNoFile", "existing"],
      ["errorPartial", "count"],
      ["commonNote", "count"],
      ["commonNoteUnlinked", "count"],
      ["floatingNote", "count"],
      ["unassignedNote", "count"],
      ["chipCorners", "count"],
    ];
    for (const [key, arg] of pluralised) {
      const [block] = scanIcu(String(copy[key])).plurals;
      expect({ key, arg: block?.arg }).toEqual({ key, arg });
      expect(block.categories).toEqual(expect.arrayContaining(wanted));
    }
    // `cornersKept` names two counts and Romanian cannot agree with either
    // from outside its own block, so both are pluralised independently — and
    // both need the `few` form, which an `arg`-only assertion did not ask for.
    const kept = scanIcu(String(copy.cornersKept)).plurals;
    expect(kept.map((p) => p.arg)).toEqual(["existing", "offered"]);
    for (const block of kept) {
      expect({ arg: block.arg, categories: block.categories }).toEqual({
        arg: block.arg,
        categories: expect.arrayContaining(wanted),
      });
    }
  });

  it("⚠️ keeps a =0 branch wherever zero is reachable", () => {
    // Romanian sends 0 to `few`, so a message without `=0` reads "0 colțuri"
    // and "legarea celor 0 documente". Both are reachable: a Property with no
    // corners is the whole subject of the second confirmation, and an empty
    // property subfolder is something the `topLevelDirNames` seeding
    // deliberately creates.
    for (const file of LOCALES) {
      for (const key of ["chipCorners", "documentCount", "confirmLink", "coordinateFound"] as const) {
        const branch = pluralBranch(String(loadCopy(file)[key]), "=0");
        expect({ file, key, empty: branch === "" }).toEqual({ file, key, empty: false });
      }
    }
  });

  it("⚠️ each corner sentence says the thing it is on the card to say", () => {
    // The four sentences the card picks between have no other assertion on
    // their CONTENT, and a mutation round turned `cornersNone` into
    // "Proprietatea va primi colțuri" and `cornersAlreadyApplied` from
    // "adăugate" to "șterse din" with nothing red. These are the words the
    // whole split of the coordinate paragraph was made to get right.
    const ro = loadCopy("ro-RO.json");
    const en = loadCopy("en-GB.json");
    expect(String(ro.cornersNone)).toContain("fără colțuri");
    expect(String(en.cornersNone)).toContain("no corners");
    expect(String(ro.coordinateNone)).toContain("Fără fișier de coordonate");
    expect(String(en.coordinateNone)).toContain("No coordinate file");
    expect(String(ro.cornersAlreadyApplied)).toContain("adăugat");
    expect(String(en.cornersAlreadyApplied)).toContain("added");
    // …and `willCreate` keeps its `=0` branch, or Romanian renders "cu 0
    // colțuri" on the commonest create card there is.
    for (const file of LOCALES) {
      const branch = pluralBranch(String(loadCopy(file).willCreate), "=0");
      expect({ file, branch, empty: branch === "" }).toEqual({ file, branch, empty: false });
    }
  });

  it("⚠️ says WHY the corner tick is being offered", () => {
    // "Proprietatea nu are colțuri în acest moment" is the fact the server
    // re-checks under the lock before writing — `confirm.addCorners &&
    // chosen.cornerCount !== 0` answers `stale` — so the sentence and the guard
    // have to stay one statement.
    expect(String(loadCopy("ro-RO.json").confirmCorners)).toContain("nu are colțuri");
    expect(String(loadCopy("en-GB.json").confirmCorners)).toContain("no corners");
  });

  it("⚠️ says what the tick actually agrees to, and names the property", () => {
    // The whole hinge of the slice. A confirmation that reads "OK" agrees to
    // nothing a user could later be held to.
    expect(String(loadCopy("ro-RO.json").confirmLink)).toContain("legarea");
    expect(String(loadCopy("en-GB.json").confirmLink)).toContain("linking");

    // ⚠️ Asserted PER BRANCH, because the message-level version was vacuous:
    // `confirmLink` opens with `{count, plural, …`, so `toContain("{count")`
    // matched the plural header itself and was true of every counted message
    // ever written. Measured — every `#` could be deleted from the counted
    // branches and the suite stayed green, which is the defect the test is
    // named for, re-shippable.
    for (const file of LOCALES) {
      const message = String(loadCopy(file).confirmLink);
      const counted = file === "ro-RO.json" ? ["few", "other"] : ["other"];
      for (const category of counted) {
        const branch = pluralBranch(message, category);
        expect({ file, category, branch, counted: branch.includes("#") }).toEqual({
          file,
          category,
          branch,
          counted: true,
        });
      }
      // …and the property is named in EVERY branch, including `=0` and `one`.
      // Stripping `{code}` from `few` alone also stayed green, and `few` is
      // counts 2–19: the commonest property subfolder there is.
      for (const category of ["=0", "one", ...counted]) {
        const branch = pluralBranch(message, category);
        expect({ file, category, branch, named: branch.includes("{code}") }).toEqual({
          file,
          category,
          branch,
          named: true,
        });
      }
    }
  });

  it("⚠️ says that existing corners are NOT replaced, and where replacing lives", () => {
    // The one thing a user could reasonably fear when they see a coordinate
    // file listed beside a property that already has a shape.
    expect(String(loadCopy("ro-RO.json").cornersKept)).toContain("rămân neschimbate");
    expect(String(loadCopy("en-GB.json").cornersKept)).toContain("left unchanged");
    // ⚠️ …and points at a control that EXISTS. It used to say "de pe
    // documentul cu coordonate", which is the row action inside the import
    // dialog — the one place that is gone by the time "after the import" is
    // true. The property's own page has a corners editor and is always there.
    expect(String(loadCopy("ro-RO.json").cornersKept)).toContain("fișa proprietății");
    expect(String(loadCopy("en-GB.json").cornersKept)).toContain("property's own page");
  });

  it("⚠️ tells the user what to DO about two properties for one parcel", () => {
    // An `ambiguous` folder blocks the import outright. A message that only
    // states the problem leaves a business user with a screen they cannot
    // leave — the #26.02 unfixable-message failure, rebuilt.
    expect(String(loadCopy("ro-RO.json").ambiguousBlocks)).toContain("lista de proprietăți");
    expect(String(loadCopy("en-GB.json").ambiguousBlocks)).toContain("properties list");
  });

  it("⚠️ agrees in the singular — every verb inside its own plural branch", () => {
    // The same defect `cornersKept` was split in two to avoid, and that
    // `errorPartial` shipped once: a clause bolted on AFTER the plural block
    // cannot agree with it. At count = 1 these read "Un fișier … nu vor fi
    // legate" and "un document — vor fi legate" — a singular subject with a
    // plural verb, to the only users who matter.
    for (const file of LOCALES) {
      for (const key of [
        "errorPartial",
        "commonNote",
        "commonNoteUnlinked",
        "floatingNote",
        "unassignedNote",
        // ⚠️ The slice's hinge sentence, and the one this list first omitted.
        // Outside its plural block sat the genitive plural article `celor`,
        // so at count 1 a business user was asked to agree to "legarea celor
        // 1 document" — the whole sentence the confirmation rests on,
        // ungrammatical, in the only language that ships.
        "confirmLink",
        "cornersAlreadyApplied",
      ] as const) {
        expectVerbInsidePlural(file, key);
      }
      // …and the one whose count is not called `count`, which is why the
      // helper takes the arg: it was the single counted sentence the guard
      // could not reach, so a plural verb in its singular branch was green.
      expectVerbInsidePlural(file, "cornersKeptNoFile", "existing");
    }
  });

  it("says what happens to each shared folder, distinctly and by its real name", () => {
    // ⚠️ **The expected strings come from the CODE, not from a literal here.**
    // These sentences name a folder the user has to have made on a disk, and
    // `SHARED_FOLDER_DISPLAY_NAMES` is what the structure checker tells them to
    // call it. A literal here would let the two drift, which is exactly the
    // failure #26.11 closed: the copy still said `common` after the product had
    // moved on, and nothing failed.
    //
    // ⚠️ **Both locales, deliberately.** A folder name is a string on a disk,
    // not copy. If en-GB told an English reader to make a differently-named
    // folder, the two locales would be issuing contradictory orders about one
    // filesystem — and only one of them would pass the structure check.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      expect(String(copy.commonNote)).not.toBe(String(copy.floatingNote));
      expect(String(copy.commonNote)).toContain(SHARED_FOLDER_DISPLAY_NAMES.common);
      expect(String(copy.floatingNote)).toContain(SHARED_FOLDER_DISPLAY_NAMES.floating);
      expect(String(copy.commonNoteUnlinked)).toContain(SHARED_FOLDER_DISPLAY_NAMES.common);
    }
  });

  it("⚠️ does not promise property subfolders to a folder that has none", () => {
    // The header sentence asserted that the chosen folder "holds one subfolder
    // per property" and sat forty pixels above the body saying it holds none —
    // the same lie the note below was split in two to remove, reintroduced one
    // element higher by the fix for it.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      expect(String(copy.introNoProperties)).not.toBe(String(copy.intro));
    }
    expect(String(loadCopy("ro-RO.json").introNoProperties)).toContain("niciun subfolder");
    expect(String(loadCopy("en-GB.json").introNoProperties)).toContain("no property subfolders");
  });

  it("⚠️ points at the list that is actually on screen", () => {
    // `errorStale` renders at the BOTTOM of the scrolling body, under the
    // cards it is telling the user to re-read. "mai jos" sent them further down
    // an empty column.
    expect(String(loadCopy("ro-RO.json").errorStale)).toContain("mai sus");
    expect(String(loadCopy("ro-RO.json").errorStale)).not.toContain("mai jos");
    expect(String(loadCopy("en-GB.json").errorStale)).toContain("above");
  });

  it("⚠️ does not promise common documents to a list of properties that is empty", () => {
    // `commonNote` was printed unconditionally, including under the sentence
    // saying the folder holds no property subfolders — so a folder of nothing
    // but `common` told the user sixty documents would be linked to every
    // property above, three lines under "there are none". The second sentence
    // exists for that case and must not repeat the promise.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      expect(String(copy.commonNoteUnlinked)).not.toBe(String(copy.commonNote));
    }
    expect(String(loadCopy("ro-RO.json").commonNoteUnlinked)).toContain("fără legătură");
    expect(String(loadCopy("en-GB.json").commonNoteUnlinked)).toContain("unlinked");
  });

  it("⚠️ tells the user that a half-finished run left properties behind", () => {
    // The step writes one folder at a time. A user who is not told that three
    // Properties already exist goes looking for duplicates to delete the next
    // time the same archive is imported — which is the §1 disaster, entered
    // from the other end.
    expect(String(loadCopy("ro-RO.json").errorPartial)).toContain("rămân în sistem");
    expect(String(loadCopy("en-GB.json").errorPartial)).toContain("stay in the system");
    // ⚠️ …and the VERB is inside each plural branch. Outside it, Romanian read
    // "O proprietate … și rămân în sistem" — a singular subject with a plural
    // verb — and English read "One property … and they stay". `cornersKept`
    // was split in two for exactly this; a sentence with a tail bolted on
    // after the plural block is the same mistake with the plural moved.
    for (const file of LOCALES) {
      expectVerbInsidePlural(file, "errorPartial");
    }
  });

  it("has no key the dialog does not ask for, and asks for none it lacks", () => {
    // The supply-and-demand check the other stage suites run: the list above
    // is the component's demand, and this proves the component has not grown a
    // key since — or kept one after the code that used it was deleted.
    const source = fs.readFileSync(path.join(process.cwd(), COMPONENT), "utf8");
    const asked = new Set(
      [...source.matchAll(/\bt\(\s*"([A-Za-z0-9_.]+)"/g)].map((m) => m[1]),
    );
    // No exemptions any more: `noNickname` and `chipCorners` were the wizard's
    // toolbar chip alone until #26.07's ambiguous-match list started naming
    // both, so the carve-out that used to sit here is now a lie that would hide
    // a genuinely dead key.
    const declaredButUnused = REQUIRED_KEYS.filter((key) => !asked.has(key));
    expect(declaredButUnused).toEqual([]);

    const askedButUndeclared = [...asked].filter(
      (key) => !(REQUIRED_KEYS as readonly string[]).includes(key),
    );
    expect(askedButUndeclared).toEqual([]);
  });
});
