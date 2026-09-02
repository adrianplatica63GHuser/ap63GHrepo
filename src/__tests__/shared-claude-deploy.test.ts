/**
 * @jest-environment node
 */

/**
 * Slice #32.14 — the deployed Claude rules match the versioned ones.
 *
 * `C:\dev\CLAUDE.md` and `C:\dev\.claude\rules\` are loaded automatically for
 * every repo under `C:\dev`, which is exactly why they sit ABOVE this repo and
 * outside git's reach. The versioned originals are in `docs/claude/shared/`,
 * and `scripts/Sync-SharedClaude.ps1` deploys them. Committing the source is
 * therefore only half of a change; deploying it is the other half — and since
 * #32.14 that half is Claude's to do in the same turn rather than a handover
 * line, under a standing exception on the go-ahead list in CLAUDE.md covering
 * exactly these six files.
 *
 * ⚠️ WHAT THIS TEST EXISTS FOR, MEASURED RATHER THAN IMAGINED. When Slice
 * #32.14 started, the deployed `sandbox-and-toolchain.md` was 33 lines behind
 * its source: commits 705e087 and aa9586a — #32.13's bullets on deleting
 * `.next` under a live dev server, and on `os error 1450` — were committed and
 * never deployed. So that session began by reading a rules file with neither in
 * it, and both describe failures it could plausibly have walked into.
 *
 * The gap is invisible from inside a session by construction: Claude reads the
 * DEPLOYED copy and has no reason to suspect a repo copy it never opens. So the
 * detection has to live somewhere Claude and Adrian both already look, and
 * `npx jest` is the last step of every verification run.
 *
 * ⚠️ AND IT CANNOT BE A CI CHECK, WHICH WAS THE FIRST SUGGESTION AND IS WRONG.
 * The deployed copy exists only on Adrian's machine; a CI runner has the repo
 * and nothing above it, so there is nothing there to compare against. Jest is
 * different precisely because it runs where the deployment lives: `C:\dev` is
 * this repo's own parent directory. Hence the skip below rather than a failure
 * when the deploy root is absent — on CI this suite is inert by design, and
 * that is the honest behaviour, not a hole.
 */

import fs from "fs";
import path from "path";

/** Repo root, and the directory the shared tier is deployed into (its parent). */
const REPO = process.cwd();
const SOURCE_ROOT = path.join(REPO, "docs", "claude", "shared");
const DEPLOY_ROOT = path.dirname(REPO);

/** Mirrors the $Pairs table in scripts/Sync-SharedClaude.ps1. */
const PAIRS: { src: string; dst: string }[] = [
  { src: "CLAUDE.md", dst: "CLAUDE.md" },
  { src: "rules/sandbox-and-toolchain.md", dst: ".claude/rules/sandbox-and-toolchain.md" },
  { src: "rules/powershell-and-windows.md", dst: ".claude/rules/powershell-and-windows.md" },
  { src: "rules/git-and-commits.md", dst: ".claude/rules/git-and-commits.md" },
  { src: "rules/shared-database.md", dst: ".claude/rules/shared-database.md" },
  { src: "rules/capture-and-personal-data.md", dst: ".claude/rules/capture-and-personal-data.md" },
];

/**
 * The sync script hashes NORMALISED text, not raw bytes, because its writer
 * strips any BOM — a raw compare would report permanent drift on a BOM'd
 * source. Same normalisation here, plus line endings, since one side may have
 * been written by a Windows tool.
 */
function normalise(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function readOrNull(file: string): string | null {
  try {
    return normalise(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/**
 * True when this machine has a deployment to check at all. Keyed on the
 * deployed CLAUDE.md rather than on the platform, so it is a statement about
 * what is present rather than a guess about where we are running.
 */
const deploymentPresent = fs.existsSync(path.join(DEPLOY_ROOT, "CLAUDE.md"));

const FIX =
  "Deploy it: .\\scripts\\Sync-SharedClaude.ps1 from the repo root on Windows " +
  "(add -Check to see the drift without writing), or a UTF-8-no-BOM copy of each " +
  "source file over its deployed path from the device bridge.";

describe("the shared Claude tier deployed above the repo matches this repo's copy", () => {
  it("every source file listed in the sync script exists", () => {
    // This half runs everywhere, CI included: a $Pairs entry naming a file that
    // is not in the repo means the sync would report MISSING and deploy
    // nothing, which is the failure mode that hides all the others.
    const absent = PAIRS.filter((p) => !fs.existsSync(path.join(SOURCE_ROOT, p.src)));
    expect(absent.map((p) => p.src)).toEqual([]);
  });

  if (!deploymentPresent) {
    it.skip(`no deployment above ${DEPLOY_ROOT} — nothing to compare (expected on CI)`, () => {});
    return;
  }

  it.each(PAIRS)("$dst is deployed and current", ({ src, dst }) => {
    const source = readOrNull(path.join(SOURCE_ROOT, src));
    const deployed = readOrNull(path.join(DEPLOY_ROOT, dst));

    expect(source).not.toBeNull();

    if (deployed === null) {
      throw new Error(
        `${dst} has never been deployed to ${DEPLOY_ROOT}. ` +
          `Claude loads the deployed copy, so this rule is committed and not in effect.\n${FIX}`,
      );
    }

    if (deployed !== source) {
      const sourceLines = source!.split("\n").length;
      const deployedLines = deployed.split("\n").length;
      throw new Error(
        `${dst} differs from docs/claude/shared/${src} ` +
          `(source ${sourceLines} lines, deployed ${deployedLines}). ` +
          `Claude loads the DEPLOYED copy, so whatever is only in the source is not in effect — ` +
          `and whatever is only in the deployed copy is an edit to the wrong side, which the ` +
          `next deploy will discard.\n${FIX}`,
      );
    }
  });
});
