/**
 * Dev-tools single-source guard  (Slice #23.10.dev)
 *
 * Ciprian's UAT image is built with NEXT_PUBLIC_DEV_TOOLS unset, so whatever is
 * gated by this flag disappears from it.
 *
 * ⚠️ **Since Slice #32.19 that is two controls — the EN/RO locale toggle and
 * the developer-notes panel on /admin/settings** — and this guard matters MORE
 * rather than less for them. The list used to read
 * "AI Discover, the entity Metadata tab and the list filters/columns fed from
 * it, the Help-content and Settings admin screens, the locale flags"; #26.11
 * took the first off, #32.19 revealed the rest at Adrian's request, and the
 * two stayed for reasons argued in dev-tools.ts: the toggle can put a Romanian
 * user's whole interface into English from the sign-in page, and the panel is
 * an English engineering note under a Romanian heading. A second reader of the
 * env var getting one of those sites wrong ships to Ciprian baked into the
 * bundle.
 *
 * The shape of this test is copied from auth-single-source.test.ts, and so is
 * its reason for existing. UAT_NO_AUTH was honoured in four places while 25
 * files resolved the user themselves; the rule was duplicated and unenforced,
 * and the fourth site is the one that got missed. This flag is enforced from
 * the first site: the definition of "is this a developer build?" lives in
 * src/lib/features/dev-tools.ts and nowhere else.
 *
 * Note the guard bans reading the ENV VAR, not calling the predicate. An array
 * entry — a nav item, a tab descriptor, a column-picker row — cannot be wrapped
 * in <DevOnly>, so such a site calls isDevToolsEnabled() directly; that is the
 * intended second mechanism, not an evasion, because both end at one module.
 * There is no such site left today, and the mechanism is described here anyway
 * so the next one is written the intended way rather than reinvented.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const SRC = join(process.cwd(), "src");

/** The helper is the one legitimate reader. */
const ALLOWED = [join("lib", "features", "dev-tools.ts")];

/**
 * The banned name, never spelled in one piece anywhere in this file.
 *
 * auth-single-source.test.ts learned this the hard way: its failure message
 * quotes the very patterns it bans, inside template literals that
 * stripComments() cannot remove, so on its first run it reported itself as an
 * offender. It solved that by excluding test files from the scan, which this
 * file also does — but building the needle from two halves means the guard
 * stays self-clean even if someone later narrows or deletes that exclusion.
 */
const FLAG = "NEXT_PUBLIC_DEV" + "_TOOLS";

/**
 * Test files are excluded from the scan.
 *
 * Not a convenience exemption: a test is not a request path, so a mock or a
 * quoted pattern in one is never the defect this guard is looking for.
 */
function isTestFile(relPath: string): boolean {
  return (
    relPath.includes("__tests__") ||
    relPath.endsWith(".test.ts") ||
    relPath.endsWith(".test.tsx")
  );
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walk(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strips block and line comments so a mention in prose is not a match.
 *
 * This is a guard about a NAME, so it may read comments — and must not punish
 * them. See the rule recorded for activity-cue-single-source.test.ts: a guard
 * about a name may strip comments, a guard about rendered behaviour must read
 * only code. Files that explain this flag properly would otherwise be the ones
 * it accuses.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("dev-tools is resolved in exactly one place", () => {
  const files = walk(SRC);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no module outside the helper reads the dev-tools env var", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(SRC, file);
      if (ALLOWED.some((a) => rel === a || rel === a.split("/").join(sep))) continue;
      if (isTestFile(rel)) continue;

      const code = stripComments(readFileSync(file, "utf8"));
      if (code.includes(FLAG)) {
        offenders.push(rel.split(sep).join("/"));
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `These modules read the dev-tools env var directly:\n\n` +
          offenders.map((o) => `  - ${o}`).join("\n") +
          `\n\nImport isDevToolsEnabled() from "@/lib/features/dev-tools", or\n` +
          `wrap the JSX in <DevOnly> from "@/components/dev-only", so the\n` +
          `definition of "is this a developer build?" stays in one module.\n\n` +
          `This is the UAT_NO_AUTH failure in miniature: that rule lived in\n` +
          `four places and was enforced in none, and the site nobody updated\n` +
          `is the one that broke on Ciprian's box. A second read here is worse\n` +
          `than a second auth check was, because the value is baked at BUILD\n` +
          `time — a site that gets it wrong cannot be corrected by changing\n` +
          `anything on the machine the container runs on.\n`,
      );
    }

    expect(offenders).toEqual([]);
  });

  it("the helper still exists and still reads the flag", () => {
    // An exemption must not outlive its reason: if the helper is renamed or
    // deleted, the allowlist entry above silently starts exempting nothing
    // while every call site keeps compiling. Same assertion the button-styles
    // and activity-cue guards make about their own allowlists.
    const helper = join(SRC, "lib", "features", "dev-tools.ts");
    expect(existsSync(helper)).toBe(true);

    const code = stripComments(readFileSync(helper, "utf8"));
    expect(code).toContain(FLAG);
    expect(code).toContain("isDevToolsEnabled");
  });

  it("<DevOnly> routes through the helper rather than deciding for itself", () => {
    const wrapper = join(SRC, "components", "dev-only.tsx");
    expect(existsSync(wrapper)).toBe(true);

    const code = stripComments(readFileSync(wrapper, "utf8"));
    expect(code).toContain("isDevToolsEnabled");
    expect(code).toContain("@/lib/features/dev-tools");
  });
});
