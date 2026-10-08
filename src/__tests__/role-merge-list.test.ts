/**
 * The role clean-up's list and its runner.                        (Slice #38.37)
 *
 * What a database cannot be needed for is held here: the committed list parses
 * and agrees with the seed and the dev-data seeder, every malformed list is
 * named rather than half-run, and the runner keeps the three promises its
 * header makes — the links move through `reassignDependentsIn` (not a copy of
 * it), a dry run rolls back, and an unapproved list is never applied.
 *
 * What only a database can show — links moved and none lost, a collision
 * reported and nothing written, the migrated role list equal to the seeded one
 * — is scripts/verify-rebuild.ts → verifyRoleMerges, run by the runner's
 * `full-db` and `verify-rebuild` sequences and by CI's db-rebuild workflow.
 */

import fs from "fs";
import path from "path";
import {
  ROLE_MERGES_FILE_REL,
  describeOutcome,
  foldedNames,
  linksMoved,
  parseRoleMergeList,
  roleMergeListProblems,
  type MergeOutcome,
} from "@/lib/admin/person-roles/role-merge-list";

const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Code without comments or string bodies — for a BEHAVIOUR guard. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
}

const committed = () => JSON.parse(read(ROLE_MERGES_FILE_REL)) as unknown;

const draft = (merges: unknown[], extra: Record<string, unknown> = {}) => ({
  version: 1,
  approved: false,
  approvedBy: null,
  merges,
  ...extra,
});

describe("the committed list", () => {
  it("parses with no problems", () => {
    expect(roleMergeListProblems(committed())).toEqual([]);
    expect(parseRoleMergeList(committed()).merges.length).toBeGreaterThan(0);
  });

  /**
   * sync-reference-data.sql seeds the list AFTER the merges. verify-rebuild
   * proves the whole name set; this catches the commonest drift without a
   * server: a merge struck from the list while its folded row stays deleted
   * from the seed, or the reverse.
   */
  it("agrees with sync-reference-data.sql: no folded role seeded, every survivor seeded", () => {
    const list = parseRoleMergeList(committed());
    const seed = read("src/db/sync-reference-data.sql");
    const block = seed.slice(
      seed.indexOf("INSERT INTO lookup_person_role (id, name"),
      seed.indexOf("ON CONFLICT DO NOTHING;", seed.indexOf("INSERT INTO lookup_person_role (id, name")),
    );
    const seeded = [...block.matchAll(/^\s*\(gen_random_uuid\(\), '((?:[^']|'')*)'/gm)].map((m) =>
      m[1].replace(/''/g, "'"),
    );
    expect(seeded.length).toBeGreaterThan(30);
    expect(foldedNames(list).filter((n) => seeded.includes(n))).toEqual([]);
    expect(list.merges.map((m) => m.survivor).filter((n) => !seeded.includes(n))).toEqual([]);
    // …and the survivor's seeded description is the list's.
    for (const m of list.merges) {
      if (m.description === null) continue;
      expect([m.survivor, block.includes(`'${m.survivor}', '${m.description.replace(/'/g, "''")}'`)]).toEqual([
        m.survivor,
        true,
      ]);
    }
  });

  it("no pair or tick in the seed names a folded role", () => {
    const seed = read("src/db/sync-reference-data.sql");
    const after = seed.slice(seed.indexOf("-- ── lookup_doc_type_person_role"));
    const quoted = new Set([...after.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]));
    expect(foldedNames(parseRoleMergeList(committed())).filter((n) => quoted.has(n))).toEqual([]);
  });

  /** The dev-data seeder resolves roles BY NAME and creates the ones it lacks. */
  it("the dev-data seeder names no folded role, or it would bring one back", () => {
    const seeder = read("scripts/seed-dev-data/seed.ts");
    expect(foldedNames(parseRoleMergeList(committed())).filter((n) => seeder.includes(`"${n}"`))).toEqual([]);
  });
});

describe("a list that cannot run is named, not half-run", () => {
  it("a role in two merges", () => {
    expect(
      roleMergeListProblems(
        draft([
          { survivor: "A", description: null, fold: ["B"] },
          { survivor: "C", description: null, fold: ["B"] },
        ]),
      ),
    ).toEqual(["merge 2: „B\" is already in merge 1"]);
  });

  it("a survivor folded into itself", () => {
    expect(roleMergeListProblems(draft([{ survivor: "A", description: null, fold: ["A"] }]))).toEqual([
      "merge 1: „A\" is both the survivor and folded into it",
    ]);
  });

  it("a role folded twice", () => {
    expect(roleMergeListProblems(draft([{ survivor: "A", description: null, fold: ["B", "B"] }]))).toEqual([
      "merge 1: „B\" is folded twice",
    ]);
  });

  it("an approval with no name, and a name with no approval", () => {
    expect(roleMergeListProblems(draft([], { approved: true }))).toEqual([
      "approved is true but approvedBy is empty: say who struck the list, and when",
    ]);
    expect(roleMergeListProblems(draft([], { approvedBy: "Adrian" }))).toEqual([
      "approvedBy is set but approved is false",
    ]);
  });

  it("an unknown field, an empty fold and a wrong version", () => {
    expect(roleMergeListProblems(draft([], { extra: 1 })).length).toBeGreaterThan(0);
    expect(roleMergeListProblems(draft([{ survivor: "A", description: null, fold: [] }])).length).toBeGreaterThan(0);
    expect(roleMergeListProblems({ ...draft([]), version: 2 }).length).toBeGreaterThan(0);
  });

  it("parseRoleMergeList throws with every problem in the message", () => {
    expect(() =>
      parseRoleMergeList(draft([{ survivor: "A", description: null, fold: ["A"] }], { approved: true })),
    ).toThrow(/both the survivor[\s\S]*approvedBy is empty/);
  });
});

describe("what a run reports", () => {
  const merged: MergeOutcome = {
    survivor: "Notar",
    status: "would-merge",
    renamedFrom: null,
    folds: [
      { role: "Notar public", status: "moved", links: 7, pairsAdded: 9 },
      { role: "Martor / Notar", status: "absent" },
    ],
  };

  it("counts the links a merge moves, and none for a refusal", () => {
    expect(linksMoved(merged)).toBe(7);
    expect(linksMoved({ survivor: "Creditor", status: "collides", role: "Creditor / Ipotecar", collisions: 1 })).toBe(0);
  });

  it("says each outcome in one line", () => {
    expect(describeOutcome(merged)).toBe(
      "„Notar\" would merge: „Notar public\" (7 link(s), 9 new pair(s)), „Martor / Notar\" (absent) — 7 link(s) move",
    );
    expect(describeOutcome({ survivor: "Creditor", status: "collides", role: "Creditor / Ipotecar", collisions: 1 })).toBe(
      "„Creditor\": COLLIDES — moving „Creditor / Ipotecar\" would duplicate 1 link(s) the survivor already has; nothing written",
    );
    expect(describeOutcome({ survivor: "X", status: "not-found" })).toMatch(/NOT FOUND/);
  });
});

describe("the runner keeps its header's promises", () => {
  const runner = () => code(read("src/lib/admin/person-roles/role-merge.ts"));

  it("moves links through reassignDependentsIn, the body the „Unește\" button runs", () => {
    const src = runner();
    expect(src).toMatch(/reassignDependentsIn\(tx, "person-roles", role\.id, target\.id, actor\)/);
    // …and never re-points a link table itself.
    expect(src).not.toMatch(/UPDATE\s+(person_document|property_person|person_person)\b/i);
  });

  it("refuses to apply an unapproved list before any transaction opens", () => {
    const src = runner();
    const refuse = src.indexOf("if (options.apply && !list.approved)");
    const open = src.indexOf("database.transaction(");
    expect(refuse).toBeGreaterThan(-1);
    expect(open).toBeGreaterThan(refuse);
  });

  it("rolls a dry run back by throwing out of its transaction", () => {
    expect(runner()).toMatch(/if \(!apply\) throw new Rollback\(outcome\);/);
  });

  it("the dry-run route never applies", () => {
    const route = code(read("src/app/api/admin/role-merges/dry-run/route.ts"));
    expect(route).toContain("requireFullAccess()");
    expect(route).toMatch(/runRoleMerges\(db, list, \{ apply: false, actor: null \}\)/);
    expect(route).not.toMatch(/apply: true/);
  });

  it("the apply is its own npm script, so a swallowed flag cannot turn it into a dry run that looks like one", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["roles:merge"]).toMatch(/scripts\/merge-person-roles\.ts$/);
    expect(pkg.scripts["roles:merge:apply"]).toMatch(/scripts\/merge-person-roles\.ts --apply$/);
  });
});
