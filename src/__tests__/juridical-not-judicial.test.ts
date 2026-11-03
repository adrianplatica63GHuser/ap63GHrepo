/**
 * Slice 41.48 — no English text a user reads calls a juridical person „judicial".
 *
 * Adrian, 2026-11-02: „Wherever judicial Person is used still in the application it should be replaced with Juridical
 * Person". The code's names (`judicial`, `/judicial-persons`, `typeJudicial`, help keys, quiz ids) stay — internal,
 * 2,249 lines in 338 files; this guard reads only what a user reads in English: the en-GB messages' VALUES, the en-GB
 * manual and its outline, and the quizzes' strings. „Judicial stamp" (timbru judiciar) is the right term and stays.
 *
 * ASCII text, so `\b` is safe here (the Romanian rule in CLAUDE.md is about non-ASCII letters).
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

/** Every hit of „judicial" that is not „Judicial stamp" and not a route (`/judicial-persons`). */
function hits(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\bjudicial\b/gi)) {
    const at = m.index ?? 0;
    if (text[at - 1] === "/") continue;
    if (/^judicial stamp/i.test(text.slice(at))) continue;
    out.push(text.slice(Math.max(0, at - 30), at + 30));
  }
  return out;
}

/** The string values of a JSON tree — keys are names, never read by a user; a slug value (an id) is a name too. */
function values(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") {
    if (!/^[a-z0-9-]+$/.test(node)) out.push(node);
  } else if (Array.isArray(node)) {
    for (const v of node) values(v, out);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) values(v, out);
  }
  return out;
}

describe("„Juridical person”, never „judicial”, in English (41.48)", () => {
  it("en-GB.json: no value says judicial, except „Judicial stamp”; „Legal entity” is gone", () => {
    const all = values(JSON.parse(read("messages", "en-GB.json")));
    expect(all.flatMap(hits)).toEqual([]);
    expect(all.filter((v) => /legal entity/i.test(v))).toEqual([]);
    expect(JSON.parse(read("messages", "en-GB.json")).shared.tileWidth.forms["judicial-person"]).toBe("Juridical person");
  });

  it("the en-GB manual and its outline", () => {
    const dir = join("src", "lib", "manual", "content", "en-GB");
    const found = readdirSync(join(ROOT, dir))
      .filter((f) => f.endsWith(".ts"))
      .flatMap((f) => hits(read(dir, f)).map((h) => `${f}: ${h}`));
    found.push(...hits(read("src", "lib", "manual", "outline", "en-GB.ts")).map((h) => `outline: ${h}`));
    expect(found).toEqual([]);
  });

  it("the quizzes' strings", () => {
    const dir = join("src", "lib", "skills", "quizzes");
    const found = readdirSync(join(ROOT, dir))
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => values(JSON.parse(read(dir, f))).flatMap(hits).map((h) => `${f}: ${h}`));
    expect(found).toEqual([]);
  });

  it("the guard sees what it is for", () => {
    expect(hits("„Natural” or „Judicial”")).toHaveLength(1);
    expect(hits("on the judicial-person types")).toHaveLength(1);
    expect(hits("Judicial stamp — note")).toEqual([]);
    expect(hits("open /judicial-persons/new")).toEqual([]);
    expect(values({ skill: "persons-add-judicial-person" })).toEqual([]);
  });
});
