/**
 * Slice #23.09.UX — `animate-pulse` is not how this codebase shows that
 * something is running.
 *
 * Same shape of guard as `button-styles-single-source.test.ts`, and it exists
 * for the same reason: eight separate cues had independently reached for
 * `animate-pulse` before anyone noticed none of them were visible. A convention
 * nobody enforces is a convention that decays, and the next dialog would have
 * reintroduced the weak cue with nothing to catch it.
 *
 * THE RULE
 * --------
 * An in-progress cue blinks with `.ga-cue-blink` (globals.css) — usually via
 * the `ActivityCue` component, which pairs the blink with `role="status"` and
 * the CTA colour. Do not hand-write `animate-pulse` on a status cue.
 *
 * WHY animate-pulse IS THE WRONG TOOL FOR A CUE
 * ---------------------------------------------
 * It only dips opacity to 50%, over a 2s cubic-bezier. Adrian's report was that
 * the text "seemed to fade just a little bit and come back" — which is a
 * precise description of what that animation does, not a misreading of it. On
 * `text-fade` grey it is close to invisible from normal viewing distance.
 *
 * THE ALLOWLIST
 * -------------
 * Skeleton placeholders only. A grey shimmer box standing in for content that
 * has not loaded is exactly what `animate-pulse` was designed for: there is no
 * text to read, nothing to announce, and a 50% dip is the right amount of
 * movement for something that is meant to recede. That is a different thing
 * from a cue that has to be NOTICED, which is what this rule is about.
 */

import fs from "fs";
import path from "path";

const SRC = path.join(process.cwd(), "src");

/** Files permitted to contain `animate-pulse`, and why. */
const ALLOWLIST: Record<string, string> = {
  // <Skeleton> — a grey placeholder block on the dashboard while its cards
  // load. No text, no live region, nothing to notice: a shimmer, not a cue.
  "app/_components/dashboard-client.tsx": "skeleton placeholder blocks",

  // This file names the pattern it retired.
  "__tests__/activity-cue-single-source.test.ts": "this file",
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const FILES = walk(SRC);

function rel(file: string): string {
  return path.relative(SRC, file).split(path.sep).join("/");
}

describe("ga-cue-blink is the single source of truth for in-progress cues", () => {
  it("finds no hand-written animate-pulse outside the allowlist", () => {
    const offenders: string[] = [];

    for (const file of FILES) {
      if (rel(file) in ALLOWLIST) continue;

      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/animate-pulse/.test(line)) {
          offenders.push(`${rel(file)}:${i + 1}  ${line.trim().slice(0, 100)}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still contains one", () => {
    // A stale exemption outlives its reason and quietly re-opens the hole it
    // was carved for. Same failure mode the button allowlist guards against.
    const stale = Object.keys(ALLOWLIST).filter((entry) => {
      const full = path.join(SRC, entry);
      if (!fs.existsSync(full)) return true;
      return !/animate-pulse/.test(fs.readFileSync(full, "utf8"));
    });

    expect(stale).toEqual([]);
  });

  it("keeps the blink and its reduced-motion fallback together", () => {
    // The fallback is not optional and it is not "no animation". For a STATUS
    // cue it has to stay clearly legible, so it freezes at full opacity rather
    // than at some average — the precedent is ga-version-pulse-* (#18.15.bugs).
    const css = fs.readFileSync(path.join(SRC, "app/globals.css"), "utf8");

    expect(css).toMatch(/@keyframes\s+ga-cue-blink/);
    expect(css).toMatch(/@keyframes\s+ga-progress-indeterminate/);

    const reduced = css.slice(css.indexOf("ga-cue-blink"));
    expect(reduced).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.ga-cue-blink\s*\{[^}]*animation:\s*none[^}]*opacity:\s*1/,
    );
    expect(reduced).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.ga-progress-indeterminate\s*\{[^}]*animation:\s*none/,
    );
  });

  it("never lets the indeterminate bar state a percentage", () => {
    // The whole point of the indeterminate mode: one opaque call reports no
    // intermediate progress, so aria-valuenow would be a claim nothing
    // measured. ARIA reads its ABSENCE as "indeterminate".
    const bar = fs.readFileSync(path.join(SRC, "components/progress-bar.tsx"), "utf8");

    const branch = bar.slice(
      bar.indexOf("if (props.indeterminate)"),
      bar.indexOf("const pct ="),
    );

    expect(branch.length).toBeGreaterThan(0);

    // Comments are stripped first, and that is a DELIBERATE difference from the
    // animate-pulse scan above. There, naming the retired utility at all is the
    // thing being prevented, so two component comments were rephrased. Here the
    // assertion is about a rendered ATTRIBUTE, and the comment reading "No
    // aria-valuenow, deliberately" is precisely what a reader should find at
    // that spot — a guard that punished it would push the explanation out of the
    // one place it belongs. This assertion failed on its own author's first run
    // for exactly that reason; the fix is to match code, not prose.
    const code = branch
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

    // The bare token, so a stray attribute is caught whatever it is set to.
    expect(code).not.toMatch(/aria-valuenow/);
  });
});
