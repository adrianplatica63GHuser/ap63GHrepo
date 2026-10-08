/**
 * The role clean-up's list: which person roles fold into which. (Slice #38.37)
 *
 * The person-role list grew near-duplicates — „Proprietar / Titular" in five
 * spellings, „Moștenitor / Succesor" in four, „Notar" and „Notar public". Which
 * of them mean the same thing is Adrian's and Ciprian's call, so the list is
 * DATA: src/db/role-merges.json, drafted by Claude as Role.Merge.List.docx,
 * struck through by them, and converted back into that file. This module reads
 * and checks it; ./role-merge.ts runs it.
 *
 * Pure — no database, no `pg` — so a test can hold every rule here without a
 * server, and so verify-rebuild and the dry-run route read the SAME parser.
 *
 * `approved` is the gate. The draft is committed `false`: the dry run reads it
 * (that is how the marked list is checked before anyone applies it), but
 * `npm run roles:merge:apply` refuses a list nobody has approved — so a draft
 * can never be applied to the real archive by running the wrong command.
 */

import { z } from "zod/v4";

/** Where the list lives, from the repository root. */
export const ROLE_MERGES_FILE_REL = "src/db/role-merges.json";

const name = z.string().trim().min(1);

const mergeSchema = z
  .object({
    /** The name the merged role keeps. An existing row, or the first folded one renamed. */
    survivor: name,
    /** The survivor's description afterwards — the detail that told the variants apart. */
    description: name.nullable(),
    /** The roles folded into it: their links move, their pairs join it, their rows go. */
    fold: z.array(name).min(1),
  })
  .strict();

const listSchema = z
  .object({
    $comment: z.array(z.string()).optional(),
    version: z.literal(1),
    approved: z.boolean(),
    /** Who struck the list and when, in their words. `null` while it is a draft. */
    approvedBy: z.string().trim().min(1).nullable(),
    merges: z.array(mergeSchema),
  })
  .strict();

export type RoleMerge = z.infer<typeof mergeSchema>;
export type RoleMergeList = z.infer<typeof listSchema>;

/**
 * Every problem with a list, as sentences — empty when it can run.
 *
 * The structural ones are zod's. The rest are the ways a hand-converted list
 * goes wrong and would otherwise go wrong SILENTLY at run time: a name in two
 * merges (the second merge would find it already gone and report nothing to
 * do), a survivor folded into itself (reassign refuses SAME_VALUE, halfway
 * through a merge), and an approval without a name or a name without one.
 */
export function roleMergeListProblems(raw: unknown): string[] {
  const parsed = listSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (i) => `${i.path.length > 0 ? i.path.join(".") : "(list)"}: ${i.message}`,
    );
  }
  const list = parsed.data;
  const problems: string[] = [];
  const seen = new Map<string, number>();
  list.merges.forEach((m, index) => {
    const row = index + 1;
    if (m.fold.includes(m.survivor)) {
      problems.push(`merge ${row}: „${m.survivor}" is both the survivor and folded into it`);
    }
    for (const n of [m.survivor, ...m.fold]) {
      const earlier = seen.get(n);
      if (earlier !== undefined && earlier !== row) {
        problems.push(`merge ${row}: „${n}" is already in merge ${earlier}`);
      } else if (earlier === row && n !== m.survivor) {
        problems.push(`merge ${row}: „${n}" is folded twice`);
      }
      seen.set(n, row);
    }
  });
  if (list.approved && list.approvedBy === null) {
    problems.push("approved is true but approvedBy is empty: say who struck the list, and when");
  }
  if (!list.approved && list.approvedBy !== null) {
    problems.push("approvedBy is set but approved is false");
  }
  return problems;
}

/** The list, or an Error naming every problem with it. */
export function parseRoleMergeList(raw: unknown): RoleMergeList {
  const problems = roleMergeListProblems(raw);
  if (problems.length > 0) {
    throw new Error(`${ROLE_MERGES_FILE_REL} cannot run:\n  - ${problems.join("\n  - ")}`);
  }
  return listSchema.parse(raw);
}

/** Every name the list deletes — what a rebuilt database must no longer hold. */
export function foldedNames(list: RoleMergeList): string[] {
  return list.merges.flatMap((m) => m.fold);
}

// ── What a run reports ──────────────────────────────────────────────────────

/** One folded role's part in a merge. */
export type FoldOutcome =
  | {
      role: string;
      status: "moved";
      /** Links re-pointed at the survivor: person–document, property–person, person–person. */
      links: number;
      /** Document-type pairs the survivor gained from it. */
      pairsAdded: number;
    }
  /** Not in the database: already folded by an earlier run, or never there. */
  | { role: string; status: "absent" };

export type MergeOutcome =
  | {
      survivor: string;
      /** `merged` when applied, `would-merge` on a dry run. */
      status: "merged" | "would-merge";
      /** The survivor did not exist and the first folded role was renamed to it. */
      renamedFrom: string | null;
      folds: FoldOutcome[];
    }
  /** Every folded name is absent and the survivor exists: an earlier run did it. */
  | { survivor: string; status: "nothing-to-do" }
  /** Neither the survivor nor any folded name is a row — almost always a typo in the list. */
  | { survivor: string; status: "not-found" }
  /** Two rows carry one of the merge's names, so „which one" has no answer. */
  | { survivor: string; status: "ambiguous"; role: string; rows: number }
  /**
   * Moving `role`'s links would duplicate links the survivor already has: one
   * person holding both variants on one document. Nothing in this merge was
   * written; the duplicates are the user's to resolve, then the run repeats.
   */
  | { survivor: string; status: "collides"; role: string; collisions: number }
  | { survivor: string; status: "failed"; error: string };

/** How many links a merge moves, or would. */
export function linksMoved(outcome: MergeOutcome): number {
  if (outcome.status !== "merged" && outcome.status !== "would-merge") return 0;
  return outcome.folds.reduce((sum, f) => sum + (f.status === "moved" ? f.links : 0), 0);
}

/** One line per merge, for the script's console and the handover's quote. */
export function describeOutcome(outcome: MergeOutcome): string {
  const head = `„${outcome.survivor}"`;
  switch (outcome.status) {
    case "merged":
    case "would-merge": {
      const verb = outcome.status === "merged" ? "merged" : "would merge";
      const parts = outcome.folds.map((f) =>
        f.status === "moved"
          ? `„${f.role}" (${f.links} link(s), ${f.pairsAdded} new pair(s))`
          : `„${f.role}" (absent)`,
      );
      const renamed = outcome.renamedFrom ? ` [renamed from „${outcome.renamedFrom}"]` : "";
      return `${head}${renamed} ${verb}: ${parts.join(", ")} — ${linksMoved(outcome)} link(s) move`;
    }
    case "nothing-to-do":
      return `${head}: nothing to do (every folded role is already gone)`;
    case "not-found":
      return `${head}: NOT FOUND — neither it nor any role folded into it is in the database`;
    case "ambiguous":
      return `${head}: AMBIGUOUS — ${outcome.rows} rows are named „${outcome.role}"; nothing written`;
    case "collides":
      return `${head}: COLLIDES — moving „${outcome.role}" would duplicate ${outcome.collisions} link(s) the survivor already has; nothing written`;
    case "failed":
      return `${head}: FAILED — ${outcome.error}; nothing written`;
  }
}
