/**
 * Moving a box's quiz progress onto an account — the plan, pure.                             (Slice #39.51)
 *
 * Quiz attempts are stored against the id the application keys a caller on (src/lib/auth/current-user.ts): the
 * Supabase user id on a box with accounts, and UAT_USER_ID, „uat-no-auth”, on a box without — Ciprian's. So
 * skill_attempt.user_id has no foreign key to app_users, deliberately: on a box without accounts there is no
 * app_users row to point at, and a key would refuse every attempt there.
 *
 * That is no defect. The one way it could cost somebody progress is a box that gains accounts one day: the
 * attempts made before stay under „uat-no-auth”, where no account sees them. This plan decides what
 * scripts/skills/adopt-progress.ts does about it; the script only reads the counts and writes what it says.
 *
 *   - Nothing to move → nothing to do.
 *   - The box still runs without accounts (UAT_NO_AUTH=true) → refused: its progress already is the box's,
 *     and moving it would hide it from the only person who uses the box.
 *   - The account named is not an account of this box → refused: the attempts would go to an id nobody signs in as.
 *   - The account already has attempts of its own → refused, unless --merge: two histories become one only
 *     when somebody says so.
 *
 * PURE MODULE — no database.
 */

export type AdoptionFacts = {
  /** Attempts stored under „uat-no-auth”. */
  boxAttempts: number;
  /** True when the box runs without accounts (UAT_NO_AUTH=true). */
  boxWithoutAccounts: boolean;
  /** The account to receive them: its user id and its own attempts, or null when no account matches. */
  target: { userId: string; attempts: number } | null;
  merge: boolean;
};

export type AdoptionPlan =
  | { action: "move"; rows: number; to: string; merged: boolean }
  | { action: "nothing"; reason: "no-box-attempts" }
  | { action: "refuse"; reason: "box-without-accounts" | "no-such-account" | "target-has-attempts" | "target-is-the-box" };

export function planAdoption(f: AdoptionFacts, boxUserId: string): AdoptionPlan {
  if (f.boxWithoutAccounts) return { action: "refuse", reason: "box-without-accounts" };
  if (!f.target) return { action: "refuse", reason: "no-such-account" };
  if (f.target.userId === boxUserId) return { action: "refuse", reason: "target-is-the-box" };
  if (f.boxAttempts === 0) return { action: "nothing", reason: "no-box-attempts" };
  if (f.target.attempts > 0 && !f.merge) return { action: "refuse", reason: "target-has-attempts" };
  return { action: "move", rows: f.boxAttempts, to: f.target.userId, merged: f.target.attempts > 0 };
}

/** What the script says for each plan, in one line. */
export function describePlan(plan: AdoptionPlan, who: string, apply: boolean): string {
  switch (plan.action) {
    case "move":
      return apply
        ? `Moved ${plan.rows} attempt(s) from the box („uat-no-auth”) to ${who}${plan.merged ? ", merged with the account's own" : ""}.`
        : `DRY RUN — would move ${plan.rows} attempt(s) from the box („uat-no-auth”) to ${who}${plan.merged ? ", merged with the account's own" : ""}. Run skills:adopt-progress:apply to move them.`;
    case "nothing":
      return "The box has no attempts under „uat-no-auth”. Nothing to do.";
    case "refuse":
      switch (plan.reason) {
        case "box-without-accounts":
          return "This box runs without accounts (UAT_NO_AUTH=true): its progress already belongs to the box, and to the one person who uses it. Nothing was changed.";
        case "no-such-account":
          return `No account ${who} on this box. Nothing was changed.`;
        case "target-is-the-box":
          return "The box's own id is not an account. Name the account to receive the progress. Nothing was changed.";
        case "target-has-attempts":
          return `${who} already has attempts of its own. Run again with --merge to join the two histories. Nothing was changed.`;
      }
  }
}
