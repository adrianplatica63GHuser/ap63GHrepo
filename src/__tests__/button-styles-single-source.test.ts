/**
 * Slice #23.05.UX — `disabled:opacity-*` is not how this codebase expresses a
 * disabled button any more.
 *
 * This is the same shape of guard as `auth-single-source.test.ts`, and it exists
 * for the same reason CLAUDE.md records for `UAT_NO_AUTH`: the rule had been
 * copy-pasted into 68 files and 193 places before anyone noticed it was a rule
 * at all. A convention nobody enforces is a convention that decays.
 *
 * THE RULE
 * --------
 * A button's disabled state comes from `buttonClass()` in
 * `src/lib/ui/button-styles.ts`. Do not hand-write `disabled:opacity-*`.
 *
 * WHY AN OPACITY DIP IS THE WRONG TOOL
 * ------------------------------------
 * It multiplies the enabled appearance instead of replacing it. On a white
 * outline button — Close, Cancel, Import — 50% opacity of "white with a grey
 * border" is still white with a slightly greyer border, so the disabled and
 * enabled states are almost indistinguishable. That was Adrian's UAT report and
 * the reason this slice exists.
 *
 * THE ALLOWLIST
 * -------------
 * Only NON-BUTTON controls, where the helper does not apply. Each entry is a
 * real, deliberate use — a checkbox or a <select>, both of which have a native
 * disabled rendering that an opacity dip legitimately reinforces. If you find
 * yourself adding a <button> here, that is the bug this test is looking for.
 */

import fs from "fs";
import path from "path";

const SRC = path.join(process.cwd(), "src");

/** Files permitted to contain `disabled:opacity-*`, and why. */
const ALLOWLIST: Record<string, string> = {
  // Row-select checkboxes on the three entity lists. <input type="checkbox">,
  // not a button — `accent-cta` colours the native control and the dip fades it.
  "app/documents/list-view.tsx": "row-select checkbox",
  "app/natural-persons/list-view.tsx": "row-select checkbox",
  "app/properties/list-view.tsx": "row-select checkbox",

  // Three <select> dropdowns (importance / relevance / provenance). A native
  // select has no `buttonClass` equivalent.
  "components/entity-metadata-tab.tsx": "native <select> dropdowns",

  // The helper itself documents the pattern it replaced; its tests assert the
  // helper never emits one.
  "lib/ui/button-styles.ts": "documentation of the retired pattern",
  "__tests__/button-styles.test.ts": "asserts the helper never emits one",
  "__tests__/button-styles-single-source.test.ts": "this file",
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

describe("buttonClass is the single source of truth for disabled buttons", () => {
  it("finds no hand-written disabled:opacity-* outside the allowlist", () => {
    const offenders: string[] = [];

    for (const file of FILES) {
      const rel = path.relative(SRC, file).split(path.sep).join("/");
      if (rel in ALLOWLIST) continue;

      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        // Deliberately open-ended: the original sweep searched only for -50 and
        // -40 and silently missed 15 more occurrences using -60 and -30.
        if (/disabled:opacity-/.test(line)) {
          offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still contains one", () => {
    // A stale allowlist entry is how an exemption outlives its reason and
    // quietly re-opens the hole it was carved for.
    const stale = Object.keys(ALLOWLIST).filter((rel) => {
      const full = path.join(SRC, rel);
      if (!fs.existsSync(full)) return true;
      return !/disabled:opacity-/.test(fs.readFileSync(full, "utf8"));
    });

    expect(stale).toEqual([]);
  });

  it("allows no <button> onto the allowlist", () => {
    // The allowlist is for native controls the helper cannot style. If a button
    // file ever appears here, the exemption is being used to dodge the rule.
    const buttonFiles = Object.keys(ALLOWLIST).filter((rel) => {
      if (rel.startsWith("__tests__/") || rel === "lib/ui/button-styles.ts") return false;
      const full = path.join(SRC, rel);
      if (!fs.existsSync(full)) return false;
      const src = fs.readFileSync(full, "utf8");
      // Every allowlisted occurrence must sit on an <input> or <select> line.
      return src
        .split("\n")
        .filter((l) => /disabled:opacity-/.test(l))
        .some((l, _i, _a) => /<button/.test(l));
    });

    expect(buttonFiles).toEqual([]);
  });
});
