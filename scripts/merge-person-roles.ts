/**
 * merge-person-roles.ts   (Slice #38.37)
 *
 * Folds near-duplicate person roles into one survivor each, as
 * src/db/role-merges.json lists them. What one merge does, and why one
 * transaction holds it, is in src/lib/admin/person-roles/role-merge.ts.
 *
 * Usage:
 *   npm run roles:merge          # DRY RUN: every merge runs and is rolled back
 *   npm run roles:merge:apply    # write — refused while the list is not approved
 *
 * Two scripts rather than one with `-- --apply`, for the reason
 * scripts/mark-bow-tie-properties.ts gives: `npm run x --apply` is swallowed by
 * npm, and the run is then a dry run that looks like an apply.
 *
 * Two flags for scripts/verify-rebuild.ts, which runs this against a throwaway
 * database (Slice #38.37's test): `--list <file>` reads another list file —
 * it writes an approved copy of the draft there, because a throwaway database
 * is the one place a draft may be applied — and `--json <file>` writes the
 * outcomes there, so it can check them rather than parse the console.
 *
 * Reads DATABASE_URL from .env, like every npm script here. Against ga40db the
 * apply is a destructive database operation, so it is Adrian's to run; the dry
 * run is safe anywhere — it writes, inside a transaction that never commits.
 *
 * Exit codes: 0 every merge ran (or would), or had nothing to do; 1 at least
 * one merge was refused (collision, typo, two rows of one name) or failed;
 * 2 the list itself cannot run.
 */

import fs from "fs";
import path from "path";
import { db, pool } from "@/db";
import {
  ROLE_MERGES_FILE_REL,
  describeOutcome,
  linksMoved,
  parseRoleMergeList,
} from "@/lib/admin/person-roles/role-merge-list";
import { runRoleMerges } from "@/lib/admin/person-roles/role-merge";

const APPLY = process.argv.includes("--apply");

/** The value after `--<name>`, or undefined. */
function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

/** What `updated_by` says on every object whose link moved. */
const ACTOR = "roles:merge (#38.37)";

async function main(): Promise<number> {
  const file = path.resolve(process.cwd(), arg("list") ?? ROLE_MERGES_FILE_REL);
  let list;
  try {
    list = parseRoleMergeList(JSON.parse(fs.readFileSync(file, "utf-8")));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 2;
  }

  console.log(
    `${list.merges.length} merge(s) in ${path.relative(process.cwd(), file)}` +
      (list.approved ? `, approved by ${list.approvedBy}` : ", NOT approved (a draft)") +
      (APPLY ? "" : "  — DRY RUN, nothing is written (npm run roles:merge:apply writes)"),
  );

  let outcomes;
  try {
    outcomes = await runRoleMerges(db, list, { apply: APPLY, actor: ACTOR });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 2;
  }

  for (const o of outcomes) console.log(`  ${describeOutcome(o)}`);
  const jsonOut = arg("json");
  if (jsonOut !== undefined) fs.writeFileSync(jsonOut, JSON.stringify(outcomes, null, 2));
  const refused = outcomes.filter(
    (o) => !["merged", "would-merge", "nothing-to-do"].includes(o.status),
  );
  const moved = outcomes.reduce((sum, o) => sum + linksMoved(o), 0);
  console.log(
    `${APPLY ? "Moved" : "Would move"} ${moved} link(s); ` +
      `${refused.length} merge(s) refused or failed${refused.length > 0 ? " — nothing of those was written" : ""}.`,
  );
  return refused.length > 0 ? 1 : 0;
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
