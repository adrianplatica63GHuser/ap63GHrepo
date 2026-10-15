/**
 * Giving a box's quiz progress to an account — what moves, and what is refused.               (Slice #39.51)
 *
 * The plan is pure (src/lib/skills/adopt.ts); scripts/skills/adopt-progress.ts reads the counts, asks it, and
 * writes only what it says. The last block reads the script's source for the one write it makes, because the
 * write itself needs a database this suite does not have.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describePlan, planAdoption, type AdoptionFacts } from "@/lib/skills/adopt";

const BOX = "uat-no-auth";
const ACCOUNT = "4f1c2d3e-0000-4000-8000-000000000001";
const facts = (over: Partial<AdoptionFacts> = {}): AdoptionFacts => ({
  boxAttempts: 7,
  boxWithoutAccounts: false,
  target: { userId: ACCOUNT, attempts: 0 },
  merge: false,
  ...over,
});

describe("planAdoption", () => {
  it("moves every box attempt to an account that has none", () => {
    expect(planAdoption(facts(), BOX)).toEqual({ action: "move", rows: 7, to: ACCOUNT, merged: false });
  });

  it("changes nothing on a box that still runs without accounts — whatever else holds", () => {
    expect(planAdoption(facts({ boxWithoutAccounts: true }), BOX)).toEqual({ action: "refuse", reason: "box-without-accounts" });
    expect(planAdoption(facts({ boxWithoutAccounts: true, target: null, boxAttempts: 0 }), BOX)).toEqual({ action: "refuse", reason: "box-without-accounts" });
    expect(planAdoption(facts({ boxWithoutAccounts: true, merge: true }), BOX)).toEqual({ action: "refuse", reason: "box-without-accounts" });
  });

  it("refuses an account this box does not have", () => {
    expect(planAdoption(facts({ target: null }), BOX)).toEqual({ action: "refuse", reason: "no-such-account" });
  });

  it("refuses the box's own id as the account", () => {
    expect(planAdoption(facts({ target: { userId: BOX, attempts: 7 } }), BOX)).toEqual({ action: "refuse", reason: "target-is-the-box" });
  });

  it("refuses an account with attempts of its own, unless --merge", () => {
    expect(planAdoption(facts({ target: { userId: ACCOUNT, attempts: 3 } }), BOX)).toEqual({ action: "refuse", reason: "target-has-attempts" });
    expect(planAdoption(facts({ target: { userId: ACCOUNT, attempts: 3 }, merge: true }), BOX)).toEqual({ action: "move", rows: 7, to: ACCOUNT, merged: true });
  });

  it("has nothing to do when the box has no attempts", () => {
    expect(planAdoption(facts({ boxAttempts: 0 }), BOX)).toEqual({ action: "nothing", reason: "no-box-attempts" });
    expect(planAdoption(facts({ boxAttempts: 0, target: { userId: ACCOUNT, attempts: 3 } }), BOX)).toEqual({ action: "nothing", reason: "no-box-attempts" });
  });

  it("--merge on an account with none is a plain move", () => {
    expect(planAdoption(facts({ merge: true }), BOX)).toEqual({ action: "move", rows: 7, to: ACCOUNT, merged: false });
  });
});

describe("describePlan — one line, and a refusal says nothing was changed", () => {
  const who = "ciprian@example.com";
  it("a dry run says what would move and how to apply it; an apply says what moved", () => {
    const plan = planAdoption(facts(), BOX);
    expect(describePlan(plan, who, false)).toMatch(/^DRY RUN — would move 7 attempt\(s\) .* ciprian@example\.com\. Run skills:adopt-progress:apply/);
    expect(describePlan(plan, who, true)).toBe("Moved 7 attempt(s) from the box („uat-no-auth”) to ciprian@example.com.");
  });

  it.each([
    [facts({ boxWithoutAccounts: true })],
    [facts({ target: null })],
    [facts({ target: { userId: ACCOUNT, attempts: 2 } })],
    [facts({ target: { userId: BOX, attempts: 0 } })],
  ])("refusal %#: „Nothing was changed.”", (f) => {
    const plan = planAdoption(f, BOX);
    expect(plan.action).toBe("refuse");
    expect(describePlan(plan, who, true)).toMatch(/Nothing was changed\.$/);
  });

  it("the merge is named", () => {
    expect(describePlan(planAdoption(facts({ target: { userId: ACCOUNT, attempts: 2 }, merge: true }), BOX), who, true)).toContain("merged with the account's own");
  });
});

describe("scripts/skills/adopt-progress.ts — the one write", () => {
  const src = readFileSync(join(process.cwd(), "scripts", "skills", "adopt-progress.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("updates skill_attempt's user id, only where it is the box's, and only when the plan says move and --apply is given", () => {
    expect(src).toMatch(/plan\.action === "move" && APPLY/);
    expect(src).toMatch(/db\.update\(skillAttempt\)\.set\(\{ userId: plan\.to \}\)\.where\(eq\(skillAttempt\.userId, UAT_USER_ID\)\)/);
    expect(src.match(/db\.update\(/g)).toHaveLength(1);
  });

  it("deletes nothing and inserts nothing", () => {
    expect(src).not.toMatch(/\.delete\(|\.insert\(/);
  });

  it("is two npm scripts, the apply one carrying --apply", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["skills:adopt-progress"]).toMatch(/scripts\/skills\/adopt-progress\.ts$/);
    expect(pkg.scripts["skills:adopt-progress:apply"]).toMatch(/scripts\/skills\/adopt-progress\.ts --apply$/);
  });
});
