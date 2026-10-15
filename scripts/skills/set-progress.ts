/**
 * Put test attempts on one account, through the rules — for the skills-map spec.             (Slice #39.42)
 *
 * e2e/help/skills-map.spec.ts needs every state on screen at once: Open, Mastered, Closed and Obsolete. Those
 * come only from attempts, and until the quizzes exist (#39.43) nothing writes one — so this script does, by
 * recordAttempt(), the same function the quiz page will call: an attempt the rules refuse is refused here too,
 * so the order of --pass matters (a skill's predecessors first).
 *
 * EVERY ROW IT WRITES IS MARKED: quiz_variant 'tc-e2e'. --clear deletes those rows of the account and nothing
 * else, so a real attempt is never touched; and --require-empty refuses (exit 3) an account that has any
 * attempt of its own, so the spec skips rather than drawing someone's real progress over with test data.
 *
 * Usage (from the repo, .env pointing at the database):
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/skills/set-progress.ts --email <a> --pass k1,k2 --fail k3 [--apply]
 *   … --email <a> --clear --apply
 *   … --email <a> --require-empty            # exit 0 when the account holds only tc-e2e rows (or none)
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { appUsers, skillAttempt } from "@/db/schema";
import { recordAttempt } from "@/lib/skills/attempts";

export const SEED_VARIANT = "tc-e2e";

const APPLY = process.argv.includes("--apply");

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}
const list = (name: string) => (arg(name) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

async function main(): Promise<number> {
  const email = arg("email");
  let userId = arg("user");
  if (!email === !userId) {
    console.error("Name one account: --email <address> or --user <id>.");
    return 2;
  }
  if (email) {
    const [row] = await db
      .select({ uid: appUsers.supabaseUid })
      .from(appUsers)
      .where(sql`lower(${appUsers.email}) = ${email.trim().toLowerCase()}`)
      .limit(1);
    if (!row?.uid) {
      console.error(`No account with the e-mail ${email}.`);
      return 1;
    }
    userId = row.uid;
  }
  const uid = userId!;

  if (process.argv.includes("--require-empty")) {
    const own = await db
      .select({ id: skillAttempt.id })
      .from(skillAttempt)
      .where(and(eq(skillAttempt.userId, uid), ne(skillAttempt.quizVariant, SEED_VARIANT)))
      .limit(1);
    if (own.length > 0) {
      console.log("The account has attempts of its own; nothing is seeded over them.");
      return 3;
    }
    console.log("The account holds no attempts of its own.");
    return 0;
  }

  if (process.argv.includes("--clear")) {
    if (!APPLY) {
      console.log(`DRY RUN — would delete the ${SEED_VARIANT} attempts of ${uid}.`);
      return 0;
    }
    await db.delete(skillAttempt).where(and(eq(skillAttempt.userId, uid), eq(skillAttempt.quizVariant, SEED_VARIANT)));
    console.log(`Deleted the ${SEED_VARIANT} attempts of ${uid}.`);
    return 0;
  }

  const plan = [...list("pass").map((k) => ({ k, right: 10 })), ...list("fail").map((k) => ({ k, right: 0 }))];
  if (plan.length === 0) {
    console.error("Nothing to do: give --pass and/or --fail, or --clear, or --require-empty.");
    return 2;
  }
  if (!APPLY) {
    console.log(`DRY RUN — would record, in order: ${plan.map((p) => `${p.k} ${p.right ? "passed" : "failed"}`).join(", ")}.`);
    return 0;
  }
  for (const p of plan) {
    const items = Array.from({ length: 10 }, (_, i) => ({ question: `q${i + 1}`, answer: "a", correct: i < p.right }));
    const r = await recordAttempt(uid, { skillKey: p.k, quizVariant: SEED_VARIANT, items, startedAt: new Date(Date.now() - 60_000) });
    if (!r.ok) {
      console.error(`${p.k}: refused — ${r.code}`);
      return 1;
    }
    console.log(`${p.k}: ${r.passed ? "passed" : "failed"}`);
  }
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
