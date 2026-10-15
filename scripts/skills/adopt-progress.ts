/**
 * Give a box's quiz progress to an account: move every „uat-no-auth” attempt to it.            (Slice #39.51)
 *
 * For one day only, and it may never come: a box that ran without accounts (UAT_NO_AUTH=true — Ciprian's) and
 * then gains them. Its attempts were stored under „uat-no-auth”, and once its user signs in with an account
 * nobody sees them. This moves them to the account named, in one statement. The rules
 * (src/lib/skills/adopt.ts) refuse on a box still without accounts, for an account the box does not have, and
 * for an account that has attempts of its own unless --merge is given.
 *
 * Usage (from the repo, with .env pointing at the database to change). Adrian runs it, by name; never the test
 * runner, and never against a box that still runs without accounts:
 *   npm run skills:adopt-progress -- --to someone@example.com            # DRY RUN: says what would move
 *   npm run skills:adopt-progress:apply -- --to someone@example.com      # moves
 *   npm run skills:adopt-progress:apply -- --to someone@example.com --merge
 *   npm run skills:adopt-progress -- --to <supabase user id>             # by id
 *
 * Two scripts rather than `-- --apply`, as skills:reset-progress: `npm run x --apply` is swallowed by npm, and
 * the run is then a dry run that looks like an apply.
 */
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { appUsers, skillAttempt } from "@/db/schema";
import { isUatNoAuth, UAT_USER_ID } from "@/lib/auth/current-user";
import { countAttempts } from "@/lib/skills/attempts";
import { describePlan, planAdoption } from "@/lib/skills/adopt";

const APPLY = process.argv.includes("--apply");
const MERGE = process.argv.includes("--merge");

/** The value after `--<name>`, or undefined. */
function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

/** The account named by an e-mail or a user id: its user id, or null when this box has no such account. */
async function findAccount(to: string): Promise<string | null> {
  const byEmail = to.includes("@");
  const [row] = await db
    .select({ uid: appUsers.supabaseUid })
    .from(appUsers)
    .where(byEmail ? sql`lower(${appUsers.email}) = ${to.trim().toLowerCase()}` : eq(appUsers.supabaseUid, to.trim()))
    .limit(1);
  return row?.uid ?? null;
}

async function main(): Promise<number> {
  const to = arg("to");
  if (!to || to.startsWith("--")) {
    console.error("Name the account to receive the box's progress: --to <e-mail or user id>.");
    return 2;
  }
  const boxWithoutAccounts = isUatNoAuth();
  const userId = boxWithoutAccounts ? null : await findAccount(to);
  const plan = planAdoption(
    {
      boxAttempts: await countAttempts(UAT_USER_ID),
      boxWithoutAccounts,
      target: userId ? { userId, attempts: await countAttempts(userId) } : null,
      merge: MERGE,
    },
    UAT_USER_ID,
  );
  const who = userId && userId !== to ? `${to} (${userId})` : to;

  if (plan.action === "move" && APPLY) {
    const moved = await db.update(skillAttempt).set({ userId: plan.to }).where(eq(skillAttempt.userId, UAT_USER_ID)).returning({ id: skillAttempt.id });
    console.log(describePlan({ ...plan, rows: moved.length }, who, true));
    return 0;
  }
  console.log(describePlan(plan, who, APPLY));
  return plan.action === "refuse" ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
