/**
 * @jest-environment node
 */

/**
 * Slice #34.31 — the migration-state comparison has one home.
 *
 * Two scripts ask "does this database hold the migrations this repository has,
 * and are they the same files?":
 *
 *   scripts/Apply-Migration.ps1   before it applies anything.
 *   build-ciprian-image.ps1       before it dumps dev's schema into Ciprian's
 *                                 image.
 *
 * ⚠️ **THEY ANSWERED IT DIFFERENTLY, AND THE WEAKER ANSWER WAS THE ONE THAT
 * SHIPPED.** Slice #34.18 taught the runner to compare the recorded MD5
 * against the file on disk; the image build went on comparing FILENAMES ALONE,
 * so a migration corrected after it was applied passed its pre-flight and that
 * schema was dumped into the image. #34.18 found this and NAMED it rather than
 * fixing it, which is the state this test exists to make impossible to reach
 * again — not because a second correction would have been hard, but because a
 * second correction leaves a third site free to diverge.
 *
 * ⚠️ **WHAT IS PINNED IS THE ABSENCE, NOT THE PRESENCE.** Asserting that both
 * scripts dot-source the shared file would go green the day someone
 * dot-sources it and then walks the folder again anyway — which is exactly how
 * a single source rots. So the assertions that matter are that neither caller
 * HASHES or ENUMERATES migrations itself. There is one home for that, and a
 * third caller is meant to cost a dot-source.
 *
 * ⚠️ **THE PATTERNS MATCH CALLS, NOT WORDS, AND THAT IS LOAD-BEARING.**
 * `Apply-Migration.ps1` still contains the string "Get-FileHash" — inside the
 * here-string of repair advice it prints on a checksum mismatch ("Get-FileHash
 * hashes bytes, so this is a false alarm by construction"). That is prose, in a
 * message, and it is correct there. Stripping `#` comment lines does not remove
 * it, because a here-string is not a comment. So the pattern requires the
 * parameter that only a real call carries — `Get-FileHash -Algorithm` — rather
 * than the cmdlet name on its own. A test that went red over that sentence
 * would be pressure to delete a good message.
 */

import fs from "fs";
import path from "path";

const REPO = process.cwd();
const SHARED = path.join(REPO, "scripts", "MigrationState.ps1");
const CALLERS = [
  path.join(REPO, "scripts", "Apply-Migration.ps1"),
  path.join(REPO, "build-ciprian-image.ps1"),
];

const read = (p: string): string => fs.readFileSync(p, "utf8");

/** Whole-line `#` comments and `<# … #>` blocks. A here-string is NOT a comment. */
const stripPsComments = (src: string): string =>
  src
    .replace(/<#[\s\S]*?#>/g, " ")
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");

describe("the comparison lives in scripts/MigrationState.ps1", () => {
  it("is a file, and it defines the three functions the callers use", () => {
    expect(fs.existsSync(SHARED)).toBe(true);
    const src = stripPsComments(read(SHARED));
    for (const fn of [
      "Get-MigrationFilesOnDisk",
      "ConvertTo-AppliedMigrationMap",
      "Compare-MigrationState",
    ]) {
      expect([fn, new RegExp(`function\\s+${fn}\\b`).test(src)]).toEqual([fn, true]);
    }
  });

  /**
   * The property that lets two scripts share it. The runner prints a repair
   * block and exits 2; the image build discards staged files and exits 1. A
   * shared function that decided either for them would need a switch per
   * caller, and the first `exit` inside it would take the wrong one.
   */
  it("prints nothing and exits nothing, so both callers can own their own ending", () => {
    const src = stripPsComments(read(SHARED));
    expect(src).not.toMatch(/\bWrite-Host\b/);
    expect(src).not.toMatch(/\bWrite-Error\b/);
    expect(src).not.toMatch(/^\s*exit\b/m);
  });
});

describe("neither caller re-implements it", () => {
  /**
   * Deliberately loose about HOW. An earlier version required
   * `. (Join-Path … "…MigrationState.ps1")` with double quotes on one line;
   * the next required the filename on the dot-source line itself.
   *
   * ⚠️ **THE SECOND ONE SHIPPED RED, AND AGAINST A CHANGE ITS OWN COMMENT
   * SAID IT WOULD SURVIVE.** `Apply-Migration.ps1` hoists the path so its
   * missing-file guard can name it —
   *
   *     $migrationStateLib = Join-Path $PSScriptRoot "MigrationState.ps1"
   *     …
   *     . $migrationStateLib
   *
   * — and the dot-source line then carries no filename at all. So both
   * spellings are accepted: the filename inline, or a dot-source of the
   * variable that was assigned from it. What must be true is that the caller
   * NAMES the library and DOT-SOURCES it; which of the two ways is not the
   * test's business, and a test that dictates it is pressure to write the
   * worse guard.
   */
  it.each(CALLERS)("%s dot-sources the shared file", (caller) => {
    const src = stripPsComments(read(caller));
    const inline = /^\s*\.\s+[^\n]*MigrationState\.ps1/m.test(src);
    const assigned = /(\$\w+)\s*=[^\n]*MigrationState\.ps1/.exec(src);
    const viaVariable =
      assigned !== null &&
      new RegExp(`^\\s*\\.\\s+\\${assigned[1]}\\s*$`, "m").test(src);
    expect([caller, inline || viaVariable]).toEqual([caller, true]);
  });

  it.each(CALLERS)("%s hashes no migration itself", (caller) => {
    // See the header: the parameter, not the cmdlet name.
    expect(stripPsComments(read(caller))).not.toMatch(/Get-FileHash\s+-Algorithm/);
  });

  it.each(CALLERS)("%s walks src\\db for migrations no second time", (caller) => {
    expect(stripPsComments(read(caller))).not.toMatch(
      /Get-ChildItem[^\n]*migration_\*\.sql/,
    );
  });
});

describe("the image build asks the question the runner asks", () => {
  /**
   * The narrow regression. A pre-flight that selects `filename` alone cannot
   * tell a corrected migration from an untouched one, whatever it does with
   * the rows afterwards — so the column list is the honest thing to pin, not
   * the comparison it feeds.
   */
  it("reads the checksum column, not the filename alone", () => {
    const src = stripPsComments(read(CALLERS[1]));
    const select = /SELECT\s+filename[^"]*FROM\s+schema_migrations/i.exec(src);
    expect(select).not.toBeNull();
    expect(select![0]).toMatch(/checksum/);
  });

  /**
   * ⚠️ **`-A`, AND THIS ASSERTION IS HERE BECAUSE ITS ABSENCE WAS INVISIBLE TO
   * EVERY OTHER ONE IN THIS FILE.** psql's default ALIGNED output renders the
   * tab this query emits as a space, so the two values arrive fused: the whole
   * line becomes the filename key, every checksum reads "", `Changed` is
   * permanently empty, and the pre-flight aborts claiming applied migrations
   * are pending. The regression lives three tokens to the left of the SELECT
   * string the test above pins, and the first draft of this suite went 17/17
   * green while the script could not run at all. `Invoke-Psql` in
   * Apply-Migration.ps1 carries `-A` for the same reason.
   */
  it("passes -A to psql, so the tab survives", () => {
    const src = stripPsComments(read(CALLERS[1]));
    // ⚠️ Anchored to the ASSIGNMENT, not to a character window before the
    // SELECT. A lookback window pins whichever psql call happens to fall
    // inside it — today the right one, but the `$smExists` probe sits just
    // outside, and it would start pinning that one the day the `if` blocks
    // between them shrank. The statement is `$appliedRaw = docker exec …
    // psql … -c \`` followed by the query on the next line, so the flags and
    // the SELECT they apply to are one slice.
    const stmt = /\$appliedRaw\s*=\s*docker exec[\s\S]*?SELECT filename/.exec(src);
    expect(stmt).not.toBeNull();
    expect(stmt![0]).toMatch(/\s-A\b/);
  });

  /**
   * ⚠️ **AND THE SAME FLAG ON THE RUNNER, WHERE DROPPING IT IS WORSE.** The
   * assertion above pins `-A` on the image build; this pins it on
   * `Invoke-Psql`, which reads the identical two-value query. Lose it there
   * and aligned mode renders the tab as a space, `Invoke-Psql`'s own trim
   * hides nothing, every row parses as a filename with an empty checksum,
   * every real migration lands in Pending — and Step 6 RE-APPLIES the lot
   * against the live dev database, most of which is not idempotent. The
   * comment above claimed this symmetry while nothing tested it.
   */
  it("the runner's Invoke-Psql passes -A too", () => {
    const src = stripPsComments(read(CALLERS[0]));
    const fn = /function Invoke-Psql[\s\S]*?\n}/.exec(src);
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/docker exec[^\n]*psql[^\n]*\s-A\b/);
  });

  /**
   * ⚠️ Anchored to the ERROR path, because the buckets are what the filename
   * comparison could not produce. A script that computed `Changed` and then
   * printed nothing about it would satisfy every assertion above.
   */
  it("aborts on a changed, renamed or miscased row and not only on a pending one", () => {
    const src = stripPsComments(read(CALLERS[1]));
    expect(src).toMatch(/\$changed\.Count\s+-gt\s+0/);
    expect(src).toMatch(/\$renamed\.Count\s+-gt\s+0/);
    expect(src).toMatch(/\$miscased\.Count\s+-gt\s+0/);
  });

  /**
   * ⚠️ **ORDER, NOT MERE PRESENCE.** Every `Renamed` entry implies a `Pending`
   * entry — a twin is by construction an on-disk file with no row, which is
   * the pending predicate — so with the pending guard first the rename branch
   * is DEAD CODE and Adrian is told to apply a migration that has already run
   * under another name. The runner gets this right by settling Step 4 before
   * Step 5 computes pending; this pins the same ordering here.
   */
  it("settles changed/renamed/miscased before it reports pending", () => {
    const src = stripPsComments(read(CALLERS[1]));
    const disagree = src.indexOf("$changed.Count");
    const pending = src.indexOf("$unapplied.Count -gt 0");
    expect(disagree).toBeGreaterThan(-1);
    expect(pending).toBeGreaterThan(-1);
    expect(disagree).toBeLessThan(pending);
  });
});
