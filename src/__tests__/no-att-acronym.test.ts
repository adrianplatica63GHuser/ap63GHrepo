/**
 * „ATT" appears in no text the application shows or teaches.                                        (Slice #39.95)
 *
 * Adrian, 2026-10-19: „delete all the occurrences of the acronym ATT from all the help texts and any other text;
 * It's a nonexistent acronym". It stood in one place — `stamp.infoPanel.body3`, „nivelul de încredere ATT" — and this
 * guard keeps it from coming back: in every message file, the manual's content and outline, the quizzes and the
 * skills map, the „?" help registry, and the database's seed and migration files that write help content.
 *
 * Matched as a word with Unicode lookarounds, never `\b`, which is ASCII-only (`C:\dev\CLAUDE.md` → Design habits):
 * „ATTENTION" or „BATT" is not the acronym, and a Romanian letter beside it is a letter.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ACRONYM = /(?<![\p{L}\p{N}])ATT(?![\p{L}\p{N}])/u;

/** Every file under `dir` (relative to the repo) whose name matches `ext`. */
function files(dir: string, ext: RegExp): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { recursive: true, encoding: "utf8" })
    .map((rel) => path.join(dir, rel))
    .filter((rel) => ext.test(rel) && fs.statSync(path.join(ROOT, rel)).isFile());
}

const SOURCES: Record<string, string[]> = {
  "the message files":                 files("messages", /\.json$/),
  "the manual (content and outline)":  files("src/lib/manual", /\.(ts|tsx|json|md)$/),
  "the quizzes and the skills map":    files("src/lib/skills", /\.(ts|tsx|json|md)$/),
  "the „?\" help registry":            files("src/lib/help", /\.(ts|tsx|json|md)$/),
  "the database's seeds and migrations": files("src/db", /\.(sql|json)$/),
};

/** Each line of `rel` that holds the acronym, as `file:line: text`. */
function hits(rel: string): string[] {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
    .split("\n")
    .flatMap((line, i) => (ACRONYM.test(line) ? [`${rel}:${i + 1}: ${line.trim().slice(0, 160)}`] : []));
}

describe("the acronym „ATT\" (#39.95)", () => {
  it("the pattern is a word match, Unicode-aware", () => {
    expect(ACRONYM.test("nivelul de încredere ATT, potențialul")).toBe(true);
    expect(ACRONYM.test("(ATT)")).toBe(true);
    expect(ACRONYM.test("ATTENTION")).toBe(false);
    expect(ACRONYM.test("BATT")).toBe(false);
    expect(ACRONYM.test("ȘATT")).toBe(false);
    expect(ACRONYM.test("ATTă")).toBe(false);
    expect(ACRONYM.test("ATT2")).toBe(false);
  });

  it.each(Object.entries(SOURCES))("is in none of %s", (_name, list) => {
    expect(list.length).toBeGreaterThan(0);
    expect(list.flatMap(hits)).toEqual([]);
  });

  it("the stamp panel's sentence lost the word and nothing took its place, in both languages", () => {
    const ro = JSON.parse(fs.readFileSync(path.join(ROOT, "messages/ro-RO.json"), "utf8")) as { stamp: { infoPanel: Record<string, string> } };
    const en = JSON.parse(fs.readFileSync(path.join(ROOT, "messages/en-GB.json"), "utf8")) as { stamp: { infoPanel: Record<string, string> } };
    expect(ro.stamp.infoPanel.body3).toContain("calificatori subiectivi: nivelul de încredere, potențialul unui obiect");
    expect(en.stamp.infoPanel.body3).toContain("subjective qualifiers: the level of trust, an object's potential");
    // en-GB's panel was the Romanian text, word for word (#39.95, Ask first 2): no Romanian letter left in it.
    for (const [key, text] of Object.entries(en.stamp.infoPanel)) {
      expect([key, /[ăâîșțĂÂÎȘȚ]/.test(text)]).toEqual([key, false]);
    }
  });
});
