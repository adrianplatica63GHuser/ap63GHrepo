/**
 * Start one account's skills over: delete its quiz attempts.                                 (Slice #39.41)
 *
 * There is no button for this (Ask first 4): progress is earned, and a reset is for tests and for Adrian. It
 * deletes skill_attempt rows of ONE user and nothing else — every state is computed from those rows
 * (src/lib/skills/progress.ts), so with them gone the account is back at the start: every Basic skill Open,
 * every other skill Closed.
 *
 * Usage (from the repo, with .env pointing at the database to change):
 *   npm run skills:reset-progress -- --email someone@example.com           # DRY RUN: says what would go
 *   npm run skills:reset-progress:apply -- --email someone@example.com     # deletes
 *   npm run skills:reset-progress -- --user uat-no-auth                    # by id: a box without accounts
 *   npm run skills:reset-progress -- --email someone@example.com --skill persons-person-from-id-card
 *
 * `--email` looks the account up in app_users; `--user` takes the id attempts are stored against (the
 * Supabase user id, or `uat-no-auth`). `--skill` limits the reset to one skill's attempts.
 *
 * Two scripts rather than `-- --apply`, for the reason scripts/mark-bow-tie-properties.ts gives: `npm run x
 * --apply` is swallowed by npm, and the run is then a dry run that looks like an apply.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { appUsers, skillAttempt } from "@/db/schema";
import { countAttempts } from "@/lib/skills/attempts";
import { skillByKey } from "@/lib/skills/catalogue";

const APPLY = process.argv.includes("--apply");

/** The value after `--<name>`, or undefined. */
function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

async function main(): Promise<number> {
  const email = arg("email");
  const skill = arg("skill");
  let userId = arg("user");
  if (!email === !userId) {
    console.error("Name one account: --email <address> or --user <id>.");
    return 2;
  }
  if (skill && !skillByKey(skill)) {
    console.error(`„${skill}” is not a skill key in src/lib/skills/catalogue.ts.`);
    return 2;
  }
  if (email) {
    const [row] = await db
      .select({ uid: appUsers.supabaseUid })
      .from(appUsers)
      .where(sql`lower(${appUsers.email}) = ${email.trim().toLowerCase()}`)
      .limit(1);
    if (!row?.uid) {
      console.error(`No account with the e-mail ${email} (or it has no sign-in yet).`);
      return 1;
    }
    userId = row.uid;
  }

  const who = email ? `${email} (${userId})` : userId!;
  const what = skill ? `the attempts at „${skill}”` : "every attempt";
  const n = await countAttempts(userId!, skill);
  if (n === 0) {
    console.log(`${who} has no attempts${skill ? ` at „${skill}”` : ""}. Nothing to do.`);
    return 0;
  }
  if (!APPLY) {
    console.log(`DRY RUN — would delete ${what} of ${who}: ${n} row(s). Run skills:reset-progress:apply to delete.`);
    return 0;
  }
  await db
    .delete(skillAttempt)
    .where(skill ? and(eq(skillAttempt.userId, userId!), eq(skillAttempt.skillKey, skill)) : eq(skillAttempt.userId, userId!));
  console.log(`Deleted ${what} of ${who}: ${n} row(s).`);
  return 0;
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
