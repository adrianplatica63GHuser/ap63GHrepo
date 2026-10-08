/**
 * The role clean-up, run: each merge folds roles into a survivor. (Slice #38.37)
 *
 * ONE TRANSACTION PER MERGE. Inside it, for every folded role:
 *   1. its links move to the survivor through `reassignDependentsIn` — the same
 *      body the „Unește" button runs, so the collision check (#36.02), the
 *      whitelist grant (#29.13) and the move history (#29.14) are the ones the
 *      screen already trusts, not a copy of them;
 *   2. its document-type pairs join the survivor's, „Deține cotă" OR-ed where
 *      both had the type — a merge must not take a type off the survivor, nor
 *      quietly untick a share;
 *   3. its „Proprietate" / „Persoană" ticks are OR-ed onto the survivor, and a
 *      converse the survivor lacks is taken from it;
 *   4. its row is deleted.
 * Then the survivor gets the merge's description. A merge that cannot finish —
 * a collision, two rows of one name, anything thrown — rolls back WHOLE, is
 * reported, and the run goes on to the next merge.
 *
 * A DRY RUN IS THE SAME CODE, ROLLED BACK. Each merge runs for real inside its
 * transaction and is then thrown away, so what the dry run prints — links,
 * pairs, collisions — is what the apply would do, not an estimate of it.
 *
 * The database handle is a parameter so the script (its own pool, from .env),
 * verify-rebuild (a throwaway server) and the dry-run route (the app's `db`)
 * all run the one function.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { db as appDb, DbTransaction } from "@/db";
import { lookupDocTypePersonRole, lookupPersonRole } from "@/db/schema";
import { reassignDependentsIn } from "@/lib/admin/value-lists/queries";
import type { FoldOutcome, MergeOutcome, RoleMerge, RoleMergeList } from "./role-merge-list";

/** Anything with `db.transaction`: the app's handle, or one a script built over its own pool. */
export type MergeDatabase = Pick<typeof appDb, "transaction">;

/** Thrown to end a merge's transaction: a dry run, or a refusal that must write nothing. */
class Rollback extends Error {
  constructor(readonly outcome: MergeOutcome) {
    super("rollback");
  }
}

type RoleRow = typeof lookupPersonRole.$inferSelect;

async function pairCount(tx: DbTransaction, roleId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(lookupDocTypePersonRole)
    .where(eq(lookupDocTypePersonRole.personRoleId, roleId));
  return row?.n ?? 0;
}

/** Runs one merge on `tx`. Returns the outcome, or throws `Rollback` to write nothing. */
async function mergeIn(
  tx: DbTransaction,
  merge: RoleMerge,
  actor: string | null,
  apply: boolean,
): Promise<MergeOutcome> {
  const names = [merge.survivor, ...merge.fold];
  const rows = await tx
    .select()
    .from(lookupPersonRole)
    .where(inArray(lookupPersonRole.name, names));

  const byName = new Map<string, RoleRow[]>();
  for (const r of rows) byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  for (const [n, rs] of byName) {
    if (rs.length > 1) {
      throw new Rollback({ survivor: merge.survivor, status: "ambiguous", role: n, rows: rs.length });
    }
  }

  let survivor: RoleRow | undefined = byName.get(merge.survivor)?.[0];
  const present = merge.fold.flatMap((n) => byName.get(n) ?? []);
  if (survivor === undefined && present.length === 0) {
    return { survivor: merge.survivor, status: "not-found" };
  }
  if (present.length === 0) return { survivor: merge.survivor, status: "nothing-to-do" };

  // No survivor row: the first folded role that exists BECOMES it, keeping its
  // id, its links and its pairs — renaming one row moves nothing at all.
  let renamedFrom: string | null = null;
  if (survivor === undefined) {
    const first = present.shift() as RoleRow;
    renamedFrom = first.name;
    await tx
      .update(lookupPersonRole)
      .set({ name: merge.survivor })
      .where(eq(lookupPersonRole.id, first.id));
    survivor = { ...first, name: merge.survivor };
  }
  const target = survivor;

  // The renamed role is the survivor now, and `renamedFrom` already says so.
  const folds: FoldOutcome[] = merge.fold
    .filter((role) => role !== renamedFrom)
    .map((role) =>
      byName.has(role)
        ? { role, status: "moved", links: 0, pairsAdded: 0 }
        : { role, status: "absent" },
    );

  for (const role of present) {
    // Counted BEFORE the move: the whitelist grant inside it can add pairs too,
    // and those are pairs the survivor gained from this role all the same.
    const before = await pairCount(tx, target.id);
    const moved = await reassignDependentsIn(tx, "person-roles", role.id, target.id, actor);
    if (!moved.ok) {
      if (moved.reason === "would-collide") {
        throw new Rollback({
          survivor: merge.survivor,
          status: "collides",
          role: role.name,
          collisions: moved.collisions,
        });
      }
      throw new Rollback({
        survivor: merge.survivor,
        status: "failed",
        error: `„${role.name}": ${moved.reason}`,
      });
    }

    // The pairs: the survivor gains every type the folded role had; where it
    // had the type already, „Deține cotă" is kept if either side held it.
    await tx.execute(sql`
      INSERT INTO lookup_doc_type_person_role (document_type_id, person_role_id, holds_share)
      SELECT p.document_type_id, ${target.id}, p.holds_share
        FROM lookup_doc_type_person_role p
       WHERE p.person_role_id = ${role.id}
      ON CONFLICT (document_type_id, person_role_id)
      DO UPDATE SET holds_share = lookup_doc_type_person_role.holds_share OR EXCLUDED.holds_share
    `);
    const pairsAdded = (await pairCount(tx, target.id)) - before;

    // The ticks OR-ed, and a converse the survivor lacks taken whole — the
    // three converse columns travel together, so a neutral form from one role
    // is never paired with gendered forms from another.
    const [current] = await tx
      .select()
      .from(lookupPersonRole)
      .where(eq(lookupPersonRole.id, target.id));
    if (current === undefined) throw new Error(`the survivor „${target.name}" vanished mid-merge`);
    const takeConverse = current.converseName === null && role.converseName !== null;
    await tx
      .update(lookupPersonRole)
      .set({
        validForProperty: current.validForProperty || role.validForProperty,
        validForPerson: current.validForPerson || role.validForPerson,
        ...(takeConverse
          ? {
              converseName: role.converseName,
              converseNameMale: role.converseNameMale,
              converseNameFemale: role.converseNameFemale,
            }
          : {}),
      })
      .where(eq(lookupPersonRole.id, target.id));

    // Nothing points at it any more but its own pairs, which go with it.
    await tx
      .delete(lookupPersonRole)
      .where(and(eq(lookupPersonRole.id, role.id), eq(lookupPersonRole.name, role.name)));

    const fold = folds.find((f) => f.role === role.name);
    if (fold && fold.status === "moved") {
      fold.links = moved.total;
      fold.pairsAdded = pairsAdded;
    }
  }

  if (merge.description !== null) {
    await tx
      .update(lookupPersonRole)
      .set({ description: merge.description })
      .where(eq(lookupPersonRole.id, target.id));
  }

  const outcome: MergeOutcome = {
    survivor: merge.survivor,
    status: apply ? "merged" : "would-merge",
    renamedFrom,
    folds,
  };
  if (!apply) throw new Rollback(outcome);
  return outcome;
}

/**
 * Runs every merge in the list, each in its own transaction, in list order.
 *
 * `apply: false` is the dry run. `apply: true` refuses a list that is not
 * approved — the caller is told so by an Error, before anything opens.
 * `actor` is stamped as `updated_by` on every object whose link moved.
 */
export async function runRoleMerges(
  database: MergeDatabase,
  list: RoleMergeList,
  options: { apply: boolean; actor: string | null },
): Promise<MergeOutcome[]> {
  if (options.apply && !list.approved) {
    throw new Error(
      "the role merge list is not approved: strike it, set approved and approvedBy, then apply",
    );
  }
  const outcomes: MergeOutcome[] = [];
  for (const merge of list.merges) {
    try {
      outcomes.push(
        await database.transaction((tx) => mergeIn(tx, merge, options.actor, options.apply)),
      );
    } catch (err) {
      if (err instanceof Rollback) outcomes.push(err.outcome);
      else {
        outcomes.push({
          survivor: merge.survivor,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return outcomes;
}
