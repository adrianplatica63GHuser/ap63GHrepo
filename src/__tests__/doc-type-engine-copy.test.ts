/**
 * DocTypeEngine's own copy, in both locales.                    (Slice #29.09)
 *
 * This screen spends more money in one press than anything else in the product
 * — ten to twenty full documents read by Sonnet — and then writes a form onto a
 * document type that every future document of that type will be read against.
 * Almost every sentence on it is therefore a claim about money, a claim about
 * what will happen to information that does not become a field, or an
 * instruction. It is read once, by somebody deciding whether to press.
 *
 * It matters more than chrome usually does for the reason this whole folder
 * shares: `DEFAULT_LOCALE` is `ro-RO`, so a missing key does not fall back to
 * English — it renders the raw key path into the shipping UI.
 *
 * Nothing here renders React. A test that did would prove the JSX compiles
 * rather than that the copy exists, which is the half that goes wrong silently.
 * The source scan at the end reads the two files instead, so the list below
 * cannot drift from them.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

const SOURCES = [
  path.join("src", "app", "admin", "doc-type-engine", "_components", "doc-type-engine.tsx"),
  path.join("src", "app", "admin", "doc-type-engine", "page.tsx"),
];

function loadJson(file: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as Record<string, unknown>;
}

function loadCopy(file: string): Record<string, unknown> {
  return loadJson(file).docTypeEngine as Record<string, unknown>;
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
 * Every string the screen asks for, by the exact path it uses.
 *
 * Written out rather than derived from the JSON, which would only prove the
 * file agrees with itself. This is the screen's demand; the file is the supply,
 * and the last test reads the screen to prove the two agree.
 */
const REQUIRED_KEYS = [
  "pageTitle",
  "pick.title",
  "pick.intro",
  "types.label",
  "types.placeholder",
  "types.refusedIdCard",
  "types.refusedFallback",
  "types.alreadyHasForm",
  "types.additiveNote",
  "types.loadFailed",
  "types.sessionLost",
  "folder.pick",
  "folder.picked",
  "folder.noSamples",
  "folder.unsupported",
  "folder.walkFailed",
  "folder.overflow",
  "matching.label",
  "matching.hint",
  "matching.freeToChange",
  "cost.note",
  "cost.pace",
  "run.start",
  "run.starting",
  "run.progress",
  "run.current",
  "run.waiting",
  "run.nothingRead",
  "run.sessionLost",
  "run.noPairs",
  "run.clusterFailed",
  "run.clusterRateLimited",
  "run.cancel",
  "run.cancelling",
  "run.cancelNote",
  "run.cancelled",
  "run.cancelledNothing",
  "run.comparing",
  "run.comparingAfterCancel",
  "review.title",
  "review.denominator",
  "review.unread",
  "review.overCapacity",
  "review.aboveTitle",
  "review.aboveEmpty",
  "review.includeAria",
  "review.label",
  "review.type",
  "review.typeText",
  "review.typeTextarea",
  "review.typeDate",
  "review.typeNumber",
  "review.foundIn",
  "review.hint",
  "review.hintNote",
  "review.evidence",
  "review.belowTitle",
  "review.belowNote",
  "review.forType",
  "review.startOver",
  "review.labelRequired",
  "review.labelDuplicate",
  "review.keyNow",
  "review.nothingFound",
  "review.keyPending",
  "review.variants",
  "review.exampleValue",
  "review.labelAria",
  "review.typeAria",
  "review.hintAria",
  "review.alreadyTitle",
  "review.alreadyNote",
  "review.skippedPages",
  "review.truncatedReads",
  "review.partialComparison",
  "save.button",
  "save.saving",
  "save.note",
  "save.conflict",
  "save.tooMany",
  "save.failed",
  "save.sessionLost",
  "save.typeGone",
  "saved.title",
  "saved.body",
  "saved.whatNext",
  "saved.toImport",
] as const;

/** Every sentence that carries a number, and the argument it counts on. */
const COUNTED: readonly (readonly [key: string, arg: string])[] = [
  ["types.additiveNote", "count"],
  ["folder.picked", "count"],
  ["cost.note", "count"],
  ["cost.pace", "minutes"],
  ["folder.overflow", "count"],
  ["review.denominator", "picked"],
  ["review.unread", "count"],
  ["review.aboveTitle", "count"],
  ["review.foundIn", "count"],
  ["review.evidence", "count"],
  ["review.belowTitle", "count"],
  ["review.alreadyTitle", "count"],
  ["review.skippedPages", "count"],
  ["review.truncatedReads", "count"],
  ["review.partialComparison", "count"],
  ["save.button", "count"],
  ["saved.body", "count"],
];

describe("DocTypeEngine's copy", () => {
  it.each(LOCALES)("%s carries every string the screen asks for", (file) => {
    const copy = loadCopy(file);
    const missing = REQUIRED_KEYS.filter((key) => {
      const value = at(copy, key);
      return typeof value !== "string" || value.trim().length === 0;
    });
    expect(missing).toEqual([]);
  });

  it("counts things with a plural, in both locales", () => {
    // Romanian needs `few` as well as `one` and `other` — the language has a
    // third form for 2-19, which is most of the range this screen counts in,
    // since a run is ten to twenty samples.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      for (const [key, arg] of COUNTED) {
        const text = String(at(copy, key));
        expect({ key, hasArg: text.includes(`{${arg}`) }).toEqual({ key, hasArg: true });
        const block = scanIcu(text).plurals.find((p) => p.arg === arg);
        expect({ key, found: block !== undefined }).toEqual({ key, found: true });
        const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];
        expect(block!.categories).toEqual(expect.arrayContaining(wanted));
      }
    }
  });

  it("⚠️ keeps every counted sentence whole, inside its plural block", () => {
    // Romanian cannot agree from outside the block — „o mostră … a fost citită"
    // against „# mostre … au fost citite" — so a sentence with its verb outside
    // is wrong in one form or the other, and only in one, which is how it
    // survives a manual pass.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      for (const [key] of COUNTED) {
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

  it("⚠️ says what the next press costs, and how long it will take", () => {
    // The one convention #29.08 MOVED rather than deleted: a sentence that says
    // what is about to be spent sits beside the button that spends it. This
    // screen is the most expensive single action in the product, and its run
    // also has a floor — ten reads a minute — that a user should be told rather
    // than discover while watching a progress bar.
    for (const file of LOCALES) {
      // ⚠️ The pacing floor is a SEPARATE sentence, drawn only when there is a
      // floor to state. As one clause inside the plural it printed „so it takes
      // at least 0 minutes" for every folder of ten or fewer.
      const pace = String(at(loadCopy(file), "cost.pace"));
      expect(pace).toContain("{perMinute}");
      expect(pace).toContain("{minutes, plural");
      expect(String(at(loadCopy(file), "cost.note"))).not.toContain("minutes");
    }
    expect(String(at(loadCopy("ro-RO.json"), "cost.note"))).toMatch(/plăteşte|plătește/i);
    expect(String(at(loadCopy("en-GB.json"), "cost.note"))).toMatch(/costs money/i);
  });

  it("⚠️ names where a below-the-line candidate will actually land", () => {
    // Nothing is built for those candidates: a value matching no template field
    // already goes to `document.fields.notes`. What this slice owes is the
    // SAYING of it, on the screen, while the percentage is still changeable —
    // so the sentence has to name „Note extinse" by the name the document form
    // uses, not describe it.
    const notesRo = String(at(loadJson("ro-RO.json").document as Record<string, unknown>, "fields.notes"));
    const notesEn = String(at(loadJson("en-GB.json").document as Record<string, unknown>, "fields.notes"));
    expect(String(at(loadCopy("ro-RO.json"), "review.belowNote"))).toContain(notesRo);
    expect(String(at(loadCopy("en-GB.json"), "review.belowNote"))).toContain(notesEn);
    expect(String(at(loadCopy("ro-RO.json"), "matching.hint"))).toContain(notesRo);
    expect(String(at(loadCopy("en-GB.json"), "matching.hint"))).toContain(notesEn);
  });

  it("⚠️ says the percentages are over the samples READ", () => {
    // The most load-bearing sentence on the screen. A bare percentage over an
    // unknown N is not an honest reading of a run in which some samples were
    // refused by the rate limiter.
    const ro = String(at(loadCopy("ro-RO.json"), "review.unread"));
    expect(ro).toMatch(/citite/);
    expect(ro).toMatch(/alese/);
    const en = String(at(loadCopy("en-GB.json"), "review.unread"));
    expect(en).toMatch(/read/);
    expect(en).toMatch(/chosen/);
  });

  it("⚠️ promises in Romanian that renaming a label does not cost the read", () => {
    // Adrian's own worry, answered on the screen rather than in a chat message:
    // the stored Romanian label is what the model is shown, so replacing
    // „pretul_vanzarii_este_de" with „Preț vânzare" would be replacing evidence
    // with a caption — except that the hint box beneath now carries the
    // observed wordings. The user has to be able to READ that, or renaming
    // looks like erasing.
    expect(String(at(loadCopy("ro-RO.json"), "review.hintNote"))).toMatch(/etichet/i);
    expect(String(at(loadCopy("en-GB.json"), "review.hintNote"))).toMatch(/label/i);
  });

  it("⚠️ keeps the code name out of the Romanian, and the nav label in both", () => {
    // The English name is DocTypeEngine; the Romanian is „Distilare Tipizate".
    // ⚠️ #29.08 shipped the code name INTO ro-RO.json — its
    // `adminImport.typesBlocked.whatNext` told a Romanian-speaking user to go
    // and use "DocTypeEngine" — because there was no Romanian name yet to point
    // at. This slice gives it one, so this assertion is over the whole file
    // rather than over this namespace: the rule is about the locale, not about
    // the screen.
    expect(JSON.stringify(loadJson("ro-RO.json"))).not.toContain("DocTypeEngine");

    const nav = (locale: string) =>
      (loadJson(locale).nav as Record<string, Record<string, string>>).items.docTypeEngine;
    expect(nav("ro-RO.json")).toBe("Distilare Tipizate");
    expect(nav("en-GB.json")).toBe("DocTypeEngine");
    expect(String(at(loadCopy("ro-RO.json"), "pageTitle"))).toBe("Distilare Tipizate");
  });

  it("⚠️ sends the import's stop screen to the Romanian name", () => {
    // The other half of the line above. #29.08's stop screen is the one place
    // that tells a user this screen exists, and it must name it the way the
    // sidebar does or the instruction points at nothing.
    const blocked = (locale: string) =>
      String(
        at(
          (loadJson(locale).adminImport as Record<string, unknown>).typesBlocked as Record<
            string,
            unknown
          >,
          "whatNext",
        ),
      );
    expect(blocked("ro-RO.json")).toContain("Distilare Tipizate");
    expect(blocked("en-GB.json")).toContain("DocTypeEngine");
  });

  it("⚠️ asks for nothing the screen does not ask for, and vice versa", () => {
    // REQUIRED_KEYS claims to be "the screen's demand", and it was hand
    // transcribed — so a screen that started calling t("back") would ship a
    // dotted key path into the shipping locale with every test above green.
    const source = SOURCES.map((f) =>
      fs.readFileSync(path.join(process.cwd(), f), "utf8"),
    ).join("\n");
    const asked = new Set(
      [...source.matchAll(/(?<![A-Za-z0-9_])t\(\s*"([^"]+)"/g)].map((m) => m[1]),
    );
    expect(asked.size).toBeGreaterThan(50);
    const undeclared = [...asked].filter((k) => !REQUIRED_KEYS.includes(k as never)).sort();
    expect(undeclared).toEqual([]);
    const unused = REQUIRED_KEYS.filter((k) => !asked.has(k));
    expect(unused).toEqual([]);
  });

  it("⚠️ says plainly that a save lost to an expired session did NOT happen", () => {
    // ⚠️ **THE WORST DEFECT AN ADVERSARIAL ROUND FOUND IN THIS SLICE WAS THE
    // MISSING HALF OF THIS SENTENCE.** Middleware answers an unauthenticated
    // PUT with a redirect to /login, `fetch` follows it, and the login page
    // returns 200 HTML — so without a session check the screen announced a
    // saved form over a type that had never been written to. The copy has to
    // say the opposite in as many words, and say that the run is not lost.
    const ro = String(at(loadCopy("ro-RO.json"), "save.sessionLost"));
    expect(ro).toMatch(/NU a fost salvat/);
    const en = String(at(loadCopy("en-GB.json"), "save.sessionLost"));
    expect(en).toMatch(/NOT saved/);
  });

  it("⚠️ tells the user what a cancel did and did not cost", () => {
    for (const file of LOCALES) {
      const note = String(at(loadCopy(file), "run.cancelNote"));
      expect(note.length).toBeGreaterThan(20);
    }
    expect(String(at(loadCopy("ro-RO.json"), "run.cancelled"))).toMatch(/nu s-au plătit|nu s-au platit/);
    expect(String(at(loadCopy("en-GB.json"), "run.cancelled"))).toMatch(/not paid for/);
  });

  it("⚠️ reuses the key sentence rather than writing a second one", () => {
    // `valueList.templateFields.keyNote` already says, in Romanian, that the
    // key is the name every document of this type keeps its value under and
    // that renaming a label does not touch it. A second sentence saying the
    // same thing is a second sentence to keep true.
    const keyNote = (locale: string) =>
      String(
        at(
          (loadJson(locale).valueList as Record<string, unknown>).templateFields as Record<
            string,
            unknown
          >,
          "keyNote",
        ),
      );
    for (const file of LOCALES) expect(keyNote(file).length).toBeGreaterThan(40);
    // …and this namespace does not carry a rival copy of it.
    const own = JSON.stringify(loadCopy("ro-RO.json"));
    expect(own).not.toContain("Cheia de sub fiecare etichetă");
  });
});
