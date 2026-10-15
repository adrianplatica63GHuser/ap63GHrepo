/**
 * @jest-environment node
 *
 * Two manuals, one language each: every label a manual quotes is its own language's screen string.  (Slice #39.46)
 *
 * The English manual quotes messages/en-GB.json and the Romanian one messages/ro-RO.json; a Romanian data value
 * (reference data, a document form's labels) is quoted as both screens show it; anything else quoted is on the
 * language's named list in src/lib/manual/label-allowances.ts. And the English manual's own words are English:
 * no Romanian letter and no Romanian screen string outside quotes. The rules are src/lib/manual/labels.ts — the
 * first block tests them on small inputs, the second runs them over the real manuals.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { MANUAL_DOCUMENT_LABELS, MANUAL_SOURCES } from "@/lib/manual/content";
import { MANUAL_LOCALES, type ManualLocale } from "@/lib/manual/format";
import { MANUAL_QUOTES_NOT_LABELS } from "@/lib/manual/label-allowances";
import {
  icuBranches,
  icuPattern,
  isScreenString,
  labelBook,
  outsideQuotes,
  quotedLabels,
  romanianOutsideQuotes,
  unknownLabels,
} from "@/lib/manual/labels";
import { SKILLS, SKILL_LEVELS, SKILL_PATHS } from "@/lib/skills/catalogue";

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

type Tree = { [k: string]: string | Tree };
function strings(t: Tree, out: string[] = []): string[] {
  for (const v of Object.values(t)) {
    if (typeof v === "string") out.push(v);
    else strings(v, out);
  }
  return out;
}
const MESSAGES: Record<ManualLocale, string[]> = {
  "ro-RO": strings(JSON.parse(read("messages", "ro-RO.json")) as Tree),
  "en-GB": strings(JSON.parse(read("messages", "en-GB.json")) as Tree),
};
const manualMessages = (l: ManualLocale) => (JSON.parse(read("messages", `${l}.json`)) as { manual: Record<string, string> }).manual;

/** The skills map's names are data in the catalogue, one per language (the map draws the screen's). */
const SKILL_NAMES: Record<ManualLocale, string[]> = {
  "ro-RO": [...SKILL_LEVELS, ...SKILL_PATHS, ...SKILLS].map((x) => x.name.ro),
  "en-GB": [...SKILL_LEVELS, ...SKILL_PATHS, ...SKILLS].map((x) => x.name.en),
};

/**
 * The data values both screens show in Romanian: every literal of the reference data's INSERTs, and every
 * Romanian label of the document forms (the form draws `labelRo` in either language).
 */
function dataValues(): string[] {
  const sql = read("src", "db", "sync-reference-data.sql").replace(/--[^\n]*/g, "");
  const out = [...sql.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
  type Field = { labelRo?: string; groupRo?: string | null; tabRo?: string | null; options?: { labelRo?: string }[] | null };
  const forms = (JSON.parse(read("src", "db", "document-type-forms.json")) as { forms: Record<string, Field[]> }).forms;
  for (const fields of Object.values(forms)) {
    for (const f of fields) {
      for (const v of [f.labelRo, f.groupRo, f.tabRo, ...(f.options ?? []).map((o) => o.labelRo)]) if (v) out.push(v);
    }
  }
  return out;
}
const DATA = dataValues();

describe("the rules, on small inputs", () => {
  it("finds every quote, nested ones too, with its line", () => {
    expect(quotedLabels("s", "a „Salvează” b\nDeschide în „Interacțiuni „X””.")).toEqual([
      { source: "s", line: 1, text: "Salvează" },
      { source: "s", line: 2, text: "X" },
      { source: "s", line: 2, text: "Interacțiuni „X”" },
    ]);
    // An English message's own “…” inside the manual's „…”.
    expect(quotedLabels("s", "„The shares for “Cumpărător” add up.”").map((q) => q.text)).toEqual([
      "Cumpărător",
      "The shares for “Cumpărător” add up.",
    ]);
    const book = labelBook(['The shares for “{role}” add up.'], ["Cumpărător"]);
    expect(isScreenString("The shares for “Cumpărător” add up.", book)).toBe(true);
  });

  it("reads an ICU message as a pattern, and refuses one that would match anything", () => {
    const p = icuPattern("{count, plural, one {# rezultat} other {# rezultate}}");
    expect(p?.test("3 rezultate")).toBe(true);
    expect(p?.test("1 rezultat")).toBe(true);
    expect(p?.test("3 persoane")).toBe(false);
    expect(icuPattern("Vezi în manual: §{number} {title}")?.test("Vezi în manual: §2.3 Bara laterală")).toBe(true);
    expect(icuPattern("{count}")).toBeNull();
    expect(icuPattern("{name} ({n})")).toBeNull();
    expect(icuPattern("Salvează")).toBeNull();
  });

  it("lists an ICU message's branch texts", () => {
    expect(icuBranches("{n, plural, =0 {Niciun câmp} one {Un câmp} other {# câmpuri}}")).toEqual(["Niciun câmp", "Un câmp", "# câmpuri"]);
    expect(icuBranches("Salvează")).toEqual([]);
  });

  it("accepts a screen string whole, filled in, or cut where a word ends — and nothing else", () => {
    const book = labelBook(["Adaugă persoană", "Adaugă în grup ({count})", "{n} versiuni", "Contract"], ["Cumpărător"]);
    expect(isScreenString("Adaugă persoană", book)).toBe(true);
    expect(isScreenString("2 versiuni", book)).toBe(true);
    expect(isScreenString("Adaugă în grup", book)).toBe(true);
    expect(isScreenString("Adaugă …", book)).toBe(true);
    expect(isScreenString("Cumpărător", book)).toBe(true);
    expect(isScreenString("Adaugă pers", book)).toBe(false); // not where a word ends
    expect(isScreenString("Cont", book)).toBe(false);
    expect(isScreenString("Șterge", book)).toBe(false);
    // A plural branch cut where a word ends, and words a message quotes itself.
    const more = labelBook(
      ["{count, plural, one {Aprobă formularul (un câmp)} other {Aprobă formularul (# câmpuri)}}", "Aici nu există „continuă oricum”."],
      [],
    );
    expect(isScreenString("Aprobă formularul", more)).toBe(true);
    expect(isScreenString("continuă oricum", more)).toBe(true);
    expect(isScreenString("Aici nu", more)).toBe(true);
    expect(isScreenString("formularul", more)).toBe(false);
    expect(unknownLabels([{ source: "s", text: "„Adaugă persoană”, „Șterge”, „?”" }], book, new Set(["?"]))).toEqual([
      { source: "s", line: 1, text: "Șterge" },
    ]);
  });

  it("finds Romanian in the English text outside quotes, and only there", () => {
    expect(outsideQuotes("Press „Salvează „x”” now")).toBe("Press  now");
    const src = [{ source: "s", text: "Press „Salvează”.\nOpen Persoane Fizice.\nThe list ă.\nA „Câmpuri afișate” here." }];
    expect(romanianOutsideQuotes(src, ["Persoane Fizice"]).map((x) => x.line)).toEqual([2, 3]);
  });
});

describe.each(MANUAL_LOCALES.map((l) => [l]))("the %s manual", (locale) => {
  const book = labelBook([...MESSAGES[locale], ...SKILL_NAMES[locale]], DATA);
  const allowed = MANUAL_QUOTES_NOT_LABELS[locale];

  it("quotes only its own language's screen strings, data values, and the quotes named with a reason", () => {
    const unknown = unknownLabels(MANUAL_SOURCES[locale], book, new Set(Object.keys(allowed)));
    expect(unknown.map((q) => `${q.source}:${q.line} „${q.text}”`)).toEqual([]);
  });

  it("names no quote it does not make, and no screen string, as a quote that is not a label", () => {
    const quoted = new Set(MANUAL_SOURCES[locale].flatMap((s) => quotedLabels(s.source, s.text).map((q) => q.text)));
    expect(Object.keys(allowed).filter((q) => !quoted.has(q))).toEqual([]);
    expect(Object.keys(allowed).filter((q) => isScreenString(q, book))).toEqual([]);
    expect(Object.entries(allowed).filter(([, why]) => why.trim().length < 8)).toEqual([]);
  });

  it("gives its Word download the screen's own words for the title, the contents and the figures", () => {
    const m = manualMessages(locale);
    const { fileName, ...words } = MANUAL_DOCUMENT_LABELS[locale];
    expect(words).toEqual({ title: m.title, contents: m.contents, figure: m.figure, missingFigure: m.missingFigure });
    expect(fileName).toMatch(/\.docx$/);
  });
});

describe("the English manual's own words", () => {
  it("are English: no Romanian letter and no Romanian screen string outside quotes", () => {
    const en = new Set(MESSAGES["en-GB"].map((s) => s.trim()));
    const data = new Set(DATA);
    const romanian = [...new Set(MESSAGES["ro-RO"].map((s) => s.trim()))].filter((s) => !en.has(s) && !data.has(s));
    expect(romanianOutsideQuotes(MANUAL_SOURCES["en-GB"], romanian).map((x) => `${x.source}:${x.line} ${x.found}`)).toEqual([]);
  });

  it("are not the Romanian file names", () => {
    expect(MANUAL_DOCUMENT_LABELS["ro-RO"].fileName).toBe("Manual de utilizare GA40.docx");
    expect(MANUAL_DOCUMENT_LABELS["en-GB"].fileName).toBe("GA40 User Manual.docx");
  });
});
