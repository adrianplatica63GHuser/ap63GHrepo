/**
 * Unit tests for src/lib/import/rule-example-split.ts   (Slice #26.11)
 *
 * `RuleExample` renders; the rule inside it is a parser, and a parser over
 * human prose is where "it looked fine on the one example I checked" lives.
 * Every case below is either a real `example` string from `messages/*.json` or
 * a failure mode the shape of the parser invites.
 *
 * WHY THE REAL COPY IS READ FROM DISK
 * -----------------------------------
 * The labels are copy (`adminImport.exampleLabels`) and so are the examples,
 * and the only thing worth pinning is that the two agree. Fixtures would pass
 * happily for years after someone rewrote a Romanian sentence.
 *
 * (The component itself is not imported here and cannot be: it is `"use
 * client"` and pulls in next-intl, which is ESM-only and unloadable under
 * `next/jest`. That is exactly why the parser is a separate module.)
 */

import fs from "node:fs";
import path from "node:path";

import { splitExample } from "@/lib/import/rule-example-split";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

function messages(file: string): Record<string, unknown> {
  const full = path.join(process.cwd(), "messages", file);
  return JSON.parse(fs.readFileSync(full, "utf8")) as Record<string, unknown>;
}

function adminImport(file: string): Record<string, unknown> {
  return messages(file).adminImport as Record<string, unknown>;
}

/**
 * The four labels a locale ships, in the shape the component builds them.
 *
 * ⚠️ **`wrongAlt` is `alternative`, not `wrong` — mirror `LABEL_KEYS` in
 * `rule-example.tsx` exactly.** A copy of the mapping that drifts from the
 * component's would make every case below pass against a pairing the user never
 * sees.
 */
function labelsOf(file: string) {
  const raw = adminImport(file).exampleLabels as Record<string, string>;
  return [
    { word: raw.correct!, tone: "correct" as const },
    { word: raw.correctAlt!, tone: "correct" as const },
    { word: raw.wrong!, tone: "wrong" as const },
    { word: raw.wrongAlt!, tone: "alternative" as const },
  ];
}

/** Every `example` string in one locale's import copy, with its dotted path. */
function everyExample(file: string): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  const walk = (node: unknown, trail: string[]) => {
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, [...trail, key]);
      }
    } else if (typeof node === "string" && trail.at(-1) === "example") {
      out.push({ key: trail.join("."), text: node });
    }
  };
  walk(adminImport(file), []);
  return out;
}

describe("splitExample — the boundary rule", () => {
  const labels = labelsOf("ro-RO.json");

  it("splits a two-half example and keeps the colon with the label", () => {
    // Adrian, explicitly: "these colours apply to the colon, too".
    const segments = splitExample("Corect: comune, flotante. Greșit: „Comune”.", labels);
    expect(segments.map((s) => s.label)).toEqual(["Corect:", "Greșit:"]);
    expect(segments[0]!.tone).toBe("correct");
    expect(segments[1]!.tone).toBe("wrong");
  });

  it("⚠️ loses no character of the original", () => {
    // The whole safety property. A parser that drops a fragment is worse than
    // one that fails to colour anything, because the instruction goes missing
    // rather than going grey.
    for (const file of LOCALES) {
      for (const { key, text } of everyExample(file)) {
        const rebuilt = splitExample(text, labelsOf(file))
          .map((s) => (s.label ?? "") + s.body)
          .join("");
        expect([key, rebuilt]).toEqual([key, text]);
      }
    }
  });

  it("⚠️ treats a label as a label only at a word boundary", () => {
    // `Corect` and `Right` are ordinary words. One appearing mid-sentence must
    // not open a coloured span halfway through a clause.
    const segments = splitExample("Numele Corect: nu se împarte aici", labels);
    expect(segments.map((s) => s.label)).toEqual([null, "Corect:"]);
    // ...and the prose before it survives intact.
    expect(segments[0]!.body).toBe("Numele ");
  });

  it("⚠️ requires the colon", () => {
    // "Corect" without one is prose, not a label.
    const segments = splitExample("Corect este numele de mai sus", labels);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.label).toBeNull();
  });

  it("leaves an example with no labels exactly as it was", () => {
    // PEX-02 and PEX-04 are written as plain sentences, and they must render
    // the way they did before this component existed.
    const text = "„coord 48-50.txt” a mai fost importat o dată.";
    expect(splitExample(text, labels)).toEqual([
      { label: null, tone: null, body: text },
    ]);
  });

  it("handles the wrong-first order the duplication rules use", () => {
    // DUP-01 and DUP-02 lead with the failure, because the failure is the
    // thing the user is looking at.
    const segments = splitExample("Greșit: două copii. Corect: una singură.", labels);
    expect(segments.map((s) => [s.label, s.tone])).toEqual([
      ["Greșit:", "wrong"],
      ["Corect:", "correct"],
    ]);
  });

  it("⚠️ does not paint the pre-existing notes' second half as a failure", () => {
    // A document the archive already holds is not a fault, and PEX-01's
    // "Altfel" half describes ordinary correct importer behaviour: the archive
    // turns out not to hold it, so it is imported. Giving that the app's
    // established failure red would put the only colour on the panel on the one
    // half that is not a problem, and send a business user hunting for it.
    const segments = splitExample("Bine: e același. Altfel: e nou.", labels);
    expect(segments.map((s) => [s.label, s.tone])).toEqual([
      ["Bine:", "correct"],
      ["Altfel:", "alternative"],
    ]);
  });

  it("ignores an empty label rather than matching at every position", () => {
    // A locale with a blank string in `exampleLabels` would otherwise match the
    // empty prefix at every index and split the sentence into characters.
    const segments = splitExample("Corect: ceva", [
      { word: "", tone: "correct" },
      { word: "Corect", tone: "correct" },
    ]);
    expect(segments.map((s) => s.label)).toEqual(["Corect:"]);
  });
});

describe("the copy and the labels agree", () => {
  it.each(LOCALES)("%s ships all four labels, non-empty and distinct", (file) => {
    const words = labelsOf(file).map((l) => l.word);
    for (const word of words) expect(word.trim().length).toBeGreaterThan(0);
    expect(new Set(words).size).toBe(words.length);
  });

  it.each(LOCALES)("%s — every rule example actually splits", (file) => {
    // An example that fails to split still renders in full, just without the
    // colour. That is a safe failure and therefore a silent one, which is why
    // it is checked here: the rule catalogues are written as two halves and a
    // sentence that stopped being one is a copy bug.
    const labels = labelsOf(file);
    const unsplit = everyExample(file)
      .filter(({ key }) => key.includes(".rule."))
      .filter(({ text }) => splitExample(text, labels).every((s) => s.label === null))
      .map(({ key }) => key);
    expect(unsplit).toEqual([]);
  });

  it.each(LOCALES)("%s — every path example uses the arrow the component draws", (file) => {
    // en-GB used a bare ">" until #26.11, so the Romanian side would have grown
    // a drawn arrow while the English side kept a text character.
    const withPaths = everyExample(file).filter(({ text }) => / > /.test(text));
    expect(withPaths.map((e) => e.key)).toEqual([]);
  });
});
