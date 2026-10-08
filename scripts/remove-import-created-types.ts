/**
 * remove-import-created-types.ts   (Slice #38.52)
 *
 * Deletes the document types whose status reads „Creat la import" and that
 * nothing uses. Which ones, and why a used one is held back rather than
 * deleted or merged, is in src/lib/admin/value-lists/import-created-types.ts.
 *
 * Usage:
 *   npm run doctypes:prune-import          # DRY RUN: lists, writes nothing
 *   npm run doctypes:prune-import:apply    # deletes the unused ones
 *
 * Two scripts rather than one with `-- --apply`, for the reason
 * scripts/merge-person-roles.ts gives: `npm run x --apply` is swallowed by npm,
 * and the run is then a dry run that looks like an apply.
 *
 * Each delete is `deleteValue("document-types", id)` — the list's own „Șterge":
 * one transaction, a row lock, and a re-count under it, so a type a document
 * started using after the plan is refused („in-use") rather than deleted, and
 * nothing is left half-deleted. Its configuration (role pairs, ticks) goes with
 * the row, exactly as with the button.
 *
 * Reads DATABASE_URL from .env, like every npm script here. Against ga40db the
 * apply is a destructive database operation; Supabase is synced by Adrian.
 *
 * Exit codes: 0 every unused type was deleted (or would be), or there were
 * none; 1 at least one delete was refused or failed.
 */

import { pool } from "@/db";
import { countUsage, deleteValue, listValues } from "@/lib/admin/value-lists/queries";
import {
  describeType,
  planImportCreatedRemoval,
  type DocumentTypeRow,
} from "@/lib/admin/value-lists/import-created-types";

const APPLY = process.argv.includes("--apply");

async function main(): Promise<number> {
  const rows = (await listValues("document-types")) as unknown as DocumentTypeRow[];
  const usage = await countUsage("document-types");
  const plan = planImportCreatedRemoval(rows, usage);

  console.log(
    `${plan.remove.length} unused and ${plan.hold.length} used document type(s) „Creat la import"` +
      (APPLY ? "" : "  — DRY RUN, nothing is written (npm run doctypes:prune-import:apply deletes)"),
  );
  for (const h of plan.hold) console.log(`  held:    ${describeType(h.row, h.usedBy)}`);

  let failed = 0;
  for (const row of plan.remove) {
    if (!APPLY) {
      console.log(`  would delete: ${describeType(row, 0)}`);
      continue;
    }
    try {
      const outcome = await deleteValue("document-types", row.id);
      if (outcome.ok) console.log(`  deleted: ${describeType(row, 0)}`);
      else {
        failed += 1;
        console.log(`  REFUSED (${outcome.reason}): ${describeType(row, 0)}`);
      }
    } catch (err) {
      failed += 1;
      console.log(`  FAILED: ${describeType(row, 0)} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return failed > 0 ? 1 : 0;
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
