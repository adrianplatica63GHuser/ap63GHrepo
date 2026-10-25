/**
 * Slice 40.63 — nothing smaller than 12 px.
 *
 * Adrian, 2026-10-24 (GA40-Design-Improvements.docx, chapter 7b): „I fully accept your recommendations". No text in the
 * app is set below 12 px. 33 places set `text-[10px]` or `text-[11px]` — mostly chips and small headings — and three
 * map labels and two badges set an inline size under it. This guard reads every .ts and .tsx under src/ (tests aside)
 * and fails on:
 *   - a Tailwind size under 12 px: `text-[Npx]` with N < 12, `text-[Nrem]` with N < 0.75;
 *   - an inline `fontSize` under 12: a number, `"Npx"`, or `"Nem"` / `"Nrem"` under 0.75 — unless it is floored,
 *     `max(12px, …)`, as the two badges' `0.75em` is.
 * `text-xs` (12 px) is the floor. Where 12 px does not fit, the word is shortened and the full word stays in the
 * tooltip and the accessible name (Ask first 2) — the type is never shrunk.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function walk(dir: string, out: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
}

const FILES: string[] = [];
walk(path.join(ROOT, "src"), FILES);

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join("/");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function tooSmall(text: string): string[] {
  const src = code(text);
  const found: string[] = [];
  for (const m of src.matchAll(/\btext-\[(\d+(?:\.\d+)?)(px|rem)\]/g)) {
    const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16;
    if (px < 12) found.push(m[0]);
  }
  for (const m of src.matchAll(/fontSize:\s*(?:(\d+(?:\.\d+)?)\b(?!\s*[a-z%])|["'`]([^"'`]+)["'`])/g)) {
    if (m[1] !== undefined) {
      if (Number(m[1]) < 12) found.push(m[0]);
      continue;
    }
    const v = m[2].trim();
    if (/^max\(\s*12px\b/.test(v)) continue;
    const u = /^(\d+(?:\.\d+)?)(px|rem|em)$/.exec(v);
    if (!u) continue;
    const px = u[2] === "px" ? Number(u[1]) : Number(u[1]) * 16;
    if (px < 12) found.push(m[0]);
  }
  return found;
}

describe("nothing smaller than 12 px (40.63)", () => {
  it("no file under src/ sets text below 12 px", () => {
    const offenders = FILES.flatMap((f) => tooSmall(fs.readFileSync(f, "utf8")).map((hit) => `${rel(f)}: ${hit}`));
    expect(offenders).toEqual([]);
  });

  it("the guard sees what it guards against", () => {
    const probe = 'const a = "text-[10px] text-[11.5px] text-[0.65rem] text-[0.9375rem]"; const s = { fontSize: 11 }; const e = { fontSize: "0.7em" }; const ok = { fontSize: "max(12px, 0.75em)", g: { fontSize: 12 } };';
    expect(tooSmall(probe)).toEqual(["text-[10px]", "text-[11.5px]", "text-[0.65rem]", "fontSize: 11", 'fontSize: "0.7em"']);
  });

  it("the two badges are floored at 12 px", () => {
    for (const f of ["recency-badge.tsx", "bow-tie-badge.tsx"]) {
      expect(fs.readFileSync(path.join(ROOT, "src", "components", f), "utf8")).toContain('fontSize: "max(12px, 0.75em)"');
    }
  });
});
