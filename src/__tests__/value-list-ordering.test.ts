/**
 * @jest-environment node
 */

/**
 * Slice #34.01 — a value list reads back in the same order every time.
 * Slice #34.14 — …and "every time" stopped meaning "unless two rows tie on
 * everything", on nine of the eleven. See §2's second assertion, §3, §4's last
 * test and §5.
 *
 * THE DEFECT THIS FILE IS ABOUT
 *   Seven of the eleven branches of `listValues`
 *   (src/lib/admin/value-lists/queries.ts) ordered by `sort_order` ALONE.
 *   Nothing in the admin UI can set that column — `LIST_META` exposes no such
 *   field, so the add form never sends one and `validation.ts` defaults it to
 *   `0` — so every row created after the seed ties at zero with every other
 *   row created after the seed, and `ORDER BY sort_order` is then a PARTIAL
 *   order that Postgres may break differently on every read.
 *
 *   On „Indicative Tarla" that was not a corner case but the normal state:
 *   `createPropertyIn` auto-seeds a code for every folder name it imports, all
 *   of them at zero, so at fifty codes the list was fifty rows that rearranged
 *   themselves between page loads.
 *
 * WHAT THIS FILE CAN AND CANNOT ASSERT
 *   It has no database — no test in this repo has one — and the ordering is
 *   done by Postgres, not by TypeScript. So it splits the claim and asserts
 *   each half for what it is, in the style of value-list-move-history:
 *
 *     • **The SORT KEY the code really passes** (§1–§4), read out of the
 *       source of `listValues` itself. §2 is the generic guard — since Slice
 *       #34.14 every branch must END on the PRIMARY KEY, with the list's own
 *       required, user-entered field immediately before it, the two named
 *       exceptions apart — and §3/§4 pin the exact term LIST per branch, which
 *       is what catches a key written in the wrong order or a "harmonisation"
 *       of the two branches that must not become `sort_order, name`.
 *
 *     • **Tie-breaking, exercised for real** (§5), over a fixture in which
 *       several rows share `sort_order = 0` — the case that had no answer
 *       before this slice — from three arrival orders, which is what "the same
 *       rows, read twice" means when the server is free to hand tied rows over
 *       in any order. §5 also runs the negative control (the OLD key,
 *       `sort_order` alone, does NOT survive a different arrival order), the
 *       total-key case Slice #34.14 added (rows tied on BOTH `sort_order` and
 *       the required field come back the same way from every arrival order),
 *       and what is left of the residual (`person-roles`, which #34.14 did not
 *       touch, still can swap).
 *
 *     • **The second reader of the two relationship lists** (§7, Slice
 *       #34.14). Those two tables are read by `listValues` for Reference
 *       Data's modal and by `listPropertyPropertyRoles` /
 *       `listDocumentDocumentRoles` for the association screens' dropdowns.
 *       Slice #29.13 shaped the branches to match the pickers; §7 pins that
 *       #34.14's third sort term reached both, so the two cannot disagree
 *       about a tied pair.
 *
 *     • **The write side of the one column this slice retired** (§6):
 *       `personRoleSchema` no longer carries `sortOrder`, and the two
 *       relationship-role lists — the same table, column for column — still
 *       do, because theirs is read.
 *
 *   ⚠️ **WHAT §5 IS NOT.** It is not `ORDER BY`. It compares with JavaScript's
 *   code-unit `<` where Postgres compares under the column's collation, and it
 *   has no NULLs and so no `NULLS LAST`. Neither is reachable without a
 *   database, and neither bears on the claim: determinism follows from the key
 *   being TOTAL, which is a property of the key and not of the order it is
 *   read in. §5 models tie-breaking, and only tie-breaking.
 *
 *   ⚠️ **`(sort_order, name)` WAS NOT TOTAL IN THE DATABASE, AND SLICE #34.14
 *   IS WHERE THAT STOPPED BEING TRUE ON NINE LISTS — TEN SINCE #34.32.** No lookup table has a
 *   UNIQUE constraint over its display field, so two rows sharing BOTH keys
 *   could swap between reads — which is why #34.01 shipped with a residual and
 *   named `asc(id)` as the one-line fix. #34.14 applied it: nine branches now
 *   close on the primary key, so their sort key is total by construction rather
 *   than by observation, and §5 asserts the tied pair holds still instead of
 *   asserting that it swaps. §2 pins the required field as the term BEFORE
 *   `id`, so no branch can end up sorted by a uuid.
 *
 *   ⚠️ **THERE IS ONE EXCEPTION LEFT, AND SLICE #34.32 IS WHERE THE OTHER ONE
 *   STOPPED BEING ONE.**
 *     • `document-types` — **WAS an exception until Slice #34.32, on a reason
 *       that was half true.** What stood here, kept verbatim because it is the
 *       claim that was wrong and the next reader should see it: "nothing left
 *       to break. Since Slice #34.09, migration_080 puts a partial unique index
 *       over the normalised name on `lookup_document_type`, so two rows can no
 *       longer hold one name." The word doing the damage is **partial**.
 *       migration_080's index is `WHERE <normalised> <> ''` — deliberately, so
 *       that one punctuation-only type cannot absorb every other one — so a
 *       name of „—" is outside it and TWO ROWS MAY BOTH BE NAMED „—".
 *       ⚠️ It has to be the SAME string, which is narrower than "both
 *       punctuation-only": `asc(name)` compares the RAW text, so „—" and „·"
 *       are separated perfectly well. What `(pin, name)` cannot separate is
 *       two rows holding ONE string. #34.32 appends `asc(id)` to this branch
 *       and to `readTypes`, which restates it. The caveat about
 *       a database the migration has not been applied to still stands and is
 *       now moot for ordering: the third term is in the code, not in the
 *       schema. (The sentence #34.09 kept is still worth keeping for the reason
 *       the index exists: duplicate names were documented and EXPECTED here,
 *       and `matchDocumentType` takes the first name match, so a tie decided
 *       which of two same-named types an import ADOPTED, not merely where a row
 *       sat. That is no longer reachable — `sameDocumentTypeName` refuses to
 *       equate two empty normalised forms, so the surviving tie is cosmetic.)
 *       §5 still cannot reach this branch — its first term is raw `sql` — so
 *       §8 models it with a fixture that carries a `key`.
 *     • `person-roles` — the residual SURVIVES, deliberately. Its branch is
 *       `ORDER BY name` alone and #34.14's out-of-scope keeps it that way, so
 *       two roles sharing one name can still swap. §5 measures that rather than
 *       assuming it, and it is in the #34.14 handover.
 *   On the four lists whose name is the only column (`use-categories`,
 *   `person-types`, `citizenships`, `judicial-person-types`) a swap could never
 *   be SEEN in any case. On the others it could: the modal renders every
 *   `LIST_META` field as a column, so tied rows visibly exchange places —
 *   `tarla` most of all, where ties at `sort_order = 0` are the normal state
 *   rather than an edge case, because `createPropertyIn` auto-seeds every code.
 *
 *   The half none of this can reach — that a live list against live rows
 *   really holds still — is Adrian's, through the UI, and is in the handover.
 */

import fs from "fs";
import path from "path";
import { LIST_META, VALID_LIST_KEYS, type ListKey } from "@/lib/admin/value-lists/config";
import { LIST_SCHEMAS, LIST_UPDATE_SCHEMAS } from "@/lib/admin/value-lists/validation";
import {
  lookupPropertyType,
  lookupTarla,
  lookupUseCategory,
  lookupPersonType,
  lookupPersonRole,
  lookupCitizenship,
  lookupJudicialPersonType,
  lookupDocumentType,
  lookupInstitution,
  lookupPropertyPropertyRole,
  lookupDocumentDocumentRole,
} from "@/db/schema";

const SRC = path.join(process.cwd(), "src");

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf8");
}

/** The Drizzle table each `from(...)` identifier in `listValues` names. */
const TABLES = {
  lookupPropertyType,
  lookupTarla,
  lookupUseCategory,
  lookupPersonType,
  lookupPersonRole,
  lookupCitizenship,
  lookupJudicialPersonType,
  lookupDocumentType,
  lookupInstitution,
  lookupPropertyPropertyRole,
  lookupDocumentDocumentRole,
} as unknown as Record<string, Record<string, unknown>>;

// ── Reading the sort key out of the source ───────────────────────────────────

type SortTerm =
  | { kind: "column"; raw: string; dir: "asc" | "desc"; table: string; column: string }
  | { kind: "sql"; raw: string };

/**
 * `problem` rather than a throw, deliberately: parsing happens once at module
 * load, so a `listValues` this file cannot read must arrive as a FAILING
 * ASSERTION in §1 and not as a suite that never loads. A suite-load error
 * names a stack frame; §1 names the branch.
 */
type Branch = { from: string | null; terms: SortTerm[]; problem: string | null };

/**
 * The body of `listValues`, with comments removed.
 *
 * ⚠️ **Block comments are stripped FIRST, and that is not tidiness.** A
 * `/* … *\/`-commented `.orderBy(...)` sitting above the real one would be
 * found by `indexOf(".orderBy(")` and parsed as the branch's sort key, and
 * every assertion below would then be green against a comment.
 */
function listValuesSource(): string {
  // The read is guarded for the same reason nothing below throws: a missing or
  // unreadable file must arrive as a failing assertion in §1, not as a suite
  // that never loads.
  let source: string;
  try {
    source = read("lib", "admin", "value-lists", "queries.ts");
  } catch {
    return "";
  }
  const start = source.indexOf("export async function listValues(");
  if (start < 0) return "";
  // The function's own closing brace is the only `}` at column 0 after it.
  const end = source.indexOf("\n}\n", start);
  if (end < 0) return "";
  return source
    .slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, "")  // block comments
    .replace(/^[ \t]*\/\/.*$/gm, "")   // whole-line comments
    .replace(/\/\/[^\n]*$/gm, "");     // trailing comments
}

/**
 * The substring inside the parentheses that open at `openIdx`.
 *
 * ⚠️ Brace-counting, not lexing: `balanced` and `splitArgs` below are unaware
 * of strings and template literals, so a sort term carrying an unbalanced `)`
 * or a top-level `,` INSIDE a quoted string would mis-parse. Today's only
 * non-column term, the `sql` CASE that pins UNCLASSIFIED first, contains
 * neither. This is a stated limit of the parser, not a live hole: a
 * mis-parse shows up as a failing §2/§3/§4, never as a false green, because
 * every one of those pins a whole term list rather than searching for a
 * substring.
 */
function balanced(s: string, openIdx: number): string | null {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "(") depth += 1;
    else if (s[i] === ")") {
      depth -= 1;
      if (depth === 0) return s.slice(openIdx + 1, i);
    }
  }
  return null;
}

/** Split an argument list on its TOP-LEVEL commas only. */
function splitArgs(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of args) {
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((t) => t.trim().replace(/\s+/g, " ")).filter(Boolean);
}

const COLUMN_TERM = /^(asc|desc)\(\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*\)$/;

function parseTerm(raw: string): SortTerm {
  const m = COLUMN_TERM.exec(raw);
  if (m) {
    return { kind: "column", raw, dir: m[1] as "asc" | "desc", table: m[2], column: m[3] };
  }
  return { kind: "sql", raw };
}

const EMPTY: Branch = { from: null, terms: [], problem: "no case branch in listValues" };

function parseBranches(): { keys: string[]; branches: Record<ListKey, Branch> } {
  const body = listValuesSource();
  const branches = Object.fromEntries(
    VALID_LIST_KEYS.map((k) => [k, { ...EMPTY }]),
  ) as Record<ListKey, Branch>;
  if (!body) {
    for (const k of VALID_LIST_KEYS) branches[k] = { ...EMPTY, problem: "listValues not found" };
    return { keys: [], branches };
  }
  // split() with one capture group yields [prologue, key, body, key, body, …].
  // A `case "a": case "b":` fall-through would leave the first label with an
  // empty block and report `no .from(...)` against it — a real failure with a
  // confusing message. `listValues` has never used one.
  const parts = body.split(/^[ \t]*case\s+"([a-z-]+)":/m);
  const keys: string[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as ListKey;
    keys.push(key);
    const block = parts[i + 1] ?? "";
    const from = /\.from\(\s*([A-Za-z0-9_]+)\s*\)/.exec(block);
    const at = block.indexOf(".orderBy(");
    const args = at < 0 ? null : balanced(block, at + ".orderBy".length);
    branches[key] = {
      from: from ? from[1] : null,
      terms: args === null ? [] : splitArgs(args).map(parseTerm),
      problem:
        !from ? "no .from(...)"
        : at < 0 ? "no .orderBy(...)"
        : args === null ? "unbalanced .orderBy(...)"
        : null,
    };
  }
  return { keys, branches };
}

const { keys: PARSED_KEYS, branches: BRANCHES } = parseBranches();

/** The one required, user-entered field each list is edited through. */
function requiredField(key: ListKey): string {
  const required = LIST_META[key].fields.filter((f) => f.required);
  expect(`${key}: ${required.length} required field(s)`).toBe(`${key}: 1 required field(s)`);
  return required[0].key;
}

// ── §1 Every list has a readable branch ──────────────────────────────────────

describe("§1 listValues covers every list, with an ORDER BY this file can read", () => {
  it("has one branch per key in VALID_LIST_KEYS, and no others", () => {
    expect([...PARSED_KEYS].sort()).toEqual([...VALID_LIST_KEYS].sort());
  });

  it.each(VALID_LIST_KEYS.map((k) => [k]))("%s parses, and orders by something", (key) => {
    expect(`${key}: ${BRANCHES[key].problem ?? "ok"}`).toBe(`${key}: ok`);
    expect(`${key}: ${BRANCHES[key].terms.length} term(s)`).not.toBe(`${key}: 0 term(s)`);
  });
});

// ── §2 The last sort term separates rows the earlier terms cannot ────────────
//
// This is the whole of Slice #34.01 in one assertion, and it is written
// generically on purpose: a TWELFTH list added to VALID_LIST_KEYS with
// `ORDER BY sort_order` alone fails here, which is the failure mode this slice
// removed from seven lists at once.

/**
 * The branches that close on the primary key — nine after Slice #34.14, ten
 * since #34.32.
 *
 * The exception is named rather than filtered so that a TWELFTH list cannot
 * join it by accident: a new key is in `TOTAL_KEY` unless somebody writes it
 * into this list and says why.
 *
 * ⚠️ **`document-types` WAS IN THIS LIST AND SLICE #34.32 TOOK IT OUT.** The
 * reason given was "`document-types` cannot tie at all since migration_080",
 * which is false of a PARTIAL index: two names that normalise to the empty
 * string are outside it and both insert. See the file header.
 *
 * `person-roles` orders by name alone and keeps its residual (§5).
 */
const NO_ID_KEY: ListKey[] = ["person-roles"];
const TOTAL_KEY: ListKey[] = VALID_LIST_KEYS.filter((k) => !NO_ID_KEY.includes(k));

describe("§2 every list's ORDER BY ends on a column that distinguishes rows", () => {
  it.each(VALID_LIST_KEYS.map((k) => [k]))(
    "%s ends on the primary key where it takes one, and never on sortOrder",
    (key) => {
      const { terms } = BRANCHES[key];
      const last = terms[terms.length - 1];
      expect(`${key}: ${last?.kind}`).toBe(`${key}: column`);
      if (!last || last.kind !== "column") return;
      const closesOnId = TOTAL_KEY.includes(key);
      expect(`${key}: ${last.column}`).toBe(
        `${key}: ${closesOnId ? "id" : requiredField(key)}`,
      );
      expect(`${key}: ${last.dir}`).toBe(`${key}: asc`);
    },
  );

  // ⚠️ **`id` MAY ONLY BREAK TIES, NEVER DECIDE THE ORDER.** (Slice #34.14.)
  // A branch that closed on `asc(id)` with the required field MISSING would
  // pass the assertion above and sort the list by a random uuid — every row in
  // an order no reader can predict, which is a worse version of the defect
  // #34.01 fixed. So the term before `id` is pinned too.
  it.each(TOTAL_KEY.map((k) => [k]))(
    "%s still decides its visible order on its required field, before id",
    (key) => {
      const { terms } = BRANCHES[key];
      const beforeLast = terms[terms.length - 2];
      expect(`${key}: ${beforeLast?.kind}`).toBe(`${key}: column`);
      if (!beforeLast || beforeLast.kind !== "column") return;
      expect(`${key}: ${beforeLast.column}`).toBe(`${key}: ${requiredField(key)}`);
      expect(`${key}: ${beforeLast.dir}`).toBe(`${key}: asc`);
    },
  );

  it.each(VALID_LIST_KEYS.map((k) => [k]))(
    "%s only sorts by columns of the table it selects from",
    (key) => {
      const { from, terms } = BRANCHES[key];
      expect(`${key}: from ${from}`).toBe(
        `${key}: from ${from !== null && from in TABLES ? from : "UNKNOWN TABLE"}`,
      );
      if (from === null || !(from in TABLES)) return;
      for (const term of terms) {
        if (term.kind !== "column") continue;
        expect(`${key}: ${term.table}`).toBe(`${key}: ${from}`);
        const exists = TABLES[from][term.column] !== undefined;
        expect(`${key}: ${from}.${term.column} exists=${exists}`).toBe(
          `${key}: ${from}.${term.column} exists=true`,
        );
      }
    },
  );
});

// ── §3 The seven that Slice #34.01 fixed ─────────────────────────────────────

const FIXED_BY_34_01: ListKey[] = [
  "property-types",
  "tarla",
  "use-categories",
  "person-types",
  "citizenships",
  "judicial-person-types",
  "institutions",
];

describe("§3 the seven sort_order-only lists gained a second key, in that order", () => {
  // Slice #34.14 added a THIRD, `asc(id)`, which is what turns "unique in
  // practice" into "unique by construction" — see §5's residual.
  it.each(FIXED_BY_34_01.map((k) => [k]))(
    "%s is sortOrder, then the required field, then id",
    (key) => {
      expect(BRANCHES[key].terms.map((t) => t.raw)).toEqual([
        `asc(${BRANCHES[key].from}.sortOrder)`,
        `asc(${BRANCHES[key].from}.${requiredField(key)})`,
        `asc(${BRANCHES[key].from}.id)`,
      ]);
    },
  );
});

// ── §4 The four that already had a tiebreaker, pinned ────────────────────────
//
// ⚠️ **"UNTOUCHED" IS WHAT THIS SECTION SAID AFTER #34.01 AND IT IS NOW TRUE OF
// ONE OF THE FOUR.** The two relationship lists took `asc(id)` with the seven
// in #34.14; `document-types` took it in #34.32 (see the file header for the
// claim that had to be retracted first); `person-roles` alone still has not,
// and the last test here pins that it has not. What has never changed is the
// reason the first two must not be harmonised into `sort_order, name`, below.
//
// ⚠️ Two of these must NOT become `sortOrder, name`, and the reasons are not
// visible from this file:
//
//   • `person-roles` sorts by NAME ALONE. Its `sort_order` reaches no screen,
//     and its seeded 1..N is a numbering of the seed list rather than a curated
//     order — reading it would pin every role added through the admin form (all
//     of them at 0, because `LIST_META` exposes no field that could set one)
//     above the 56 seeded ones. Slice #34.01 resolved the column the other way:
//     `personRoleSchema` no longer writes it (§6). The full argument is in the
//     header above `personRoleSchema` in ../lib/admin/value-lists/validation.ts.
//   • `document-types` pins UNCLASSIFIED first, and the pin must stay FIRST:
//     `matchDocumentType` takes the first name match, and
//     src/lib/documents/resolve-document-type.ts restates the same clause
//     deliberately rather than importing it. #34.32's `asc(id)` is APPENDED
//     after the name for that reason; §9 pins that the restatement took it too.

describe("§4 the four lists that already had a tiebreaker", () => {
  it("person-roles sorts by name alone — NOT by sortOrder", () => {
    expect(BRANCHES["person-roles"].terms.map((t) => t.raw)).toEqual([
      "asc(lookupPersonRole.name)",
    ]);
  });

  // ⚠️ **THIS ASSERTION READ `toBe(2)` AND SLICE #34.32 INVERTED IT IN PLACE.**
  // The pin and the name are unchanged and still decide the visible order; what
  // is new is the third term, and it is APPENDED rather than substituted for
  // exactly that reason. The pin must stay first — `matchDocumentType` takes
  // the first row that matches and the catch-all has to be seen first — so the
  // first two terms are still pinned here term for term.
  it("document-types keeps the UNCLASSIFIED pin, then name, and now closes on id", () => {
    const terms = BRANCHES["document-types"].terms;
    expect(terms.length).toBe(3);
    expect(terms[0].kind).toBe("sql");
    expect(terms[0].raw).toContain("UNCLASSIFIED");
    expect(terms[1].raw).toBe("asc(lookupDocumentType.name)");
    expect(terms[2].raw).toBe("asc(lookupDocumentType.id)");
  });

  it.each([
    ["property-property-roles", "lookupPropertyPropertyRole"],
    ["document-document-roles", "lookupDocumentDocumentRole"],
  ] as const)("%s is still sortOrder then name, now closing on id", (key, table) => {
    expect(BRANCHES[key].terms.map((t) => t.raw)).toEqual([
      `asc(${table}.sortOrder)`,
      `asc(${table}.name)`,
      `asc(${table}.id)`,
    ]);
  });

  /**
   * ⚠️ **AND THE ONE THAT STILL HAS NO `id` IS PINNED AS NOT HAVING IT.**
   * (Slice #34.14; narrowed by #34.32.) The exclusion is a decision, not an
   * oversight — #34.14's out-of-scope names it — and a decision nothing asserts
   * is one the next tidy-up reverses. `person-roles` keeps its residual, which
   * §5 measures.
   *
   * ⚠️ **`document-types` WAS THE SECOND MEMBER HERE, ON THE STATED GROUND
   * THAT IT "has no tie left to break (migration_080)".** #34.32 measured that
   * and it is wrong for the empty normalised form, which the partial index
   * excludes on purpose. The branch closes on `id` now and the test above pins
   * it.
   */
  it.each(NO_ID_KEY.map((k) => [k]))("%s deliberately does NOT sort by id", (key) => {
    expect(
      `${key}: ${BRANCHES[key].terms.filter((t) => t.kind === "column" && t.column === "id").length} id term(s)`,
    ).toBe(`${key}: 0 id term(s)`);
  });
});

// ── §5 Tie-breaking, over rows that share sort_order = 0 ─────────────────────

type FixtureRow = { id: string; sortOrder: number; [field: string]: string | number };

function compare(x: string | number, y: string | number): number {
  if (typeof x === "number" && typeof y === "number") return x < y ? -1 : x > y ? 1 : 0;
  const a = String(x);
  const b = String(y);
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A STABLE sort of the rows in the order they happened to arrive — which is
 * exactly the freedom Postgres has with rows the key cannot separate. Two
 * reads are two arrival orders. See the file header for what this deliberately
 * does NOT model (collation, NULL placement).
 *
 * A non-column term has no fixture representation, so it is refused rather
 * than skipped: a silent skip would have run `document-types` as
 * `ORDER BY name` and reported a green for a key it never evaluated.
 */
function orderBy(rows: FixtureRow[], terms: SortTerm[]): FixtureRow[] {
  const columns = terms.map((t) => {
    if (t.kind !== "column") throw new Error(`not modellable without a database: ${t.raw}`);
    return t;
  });
  return [...rows].sort((a, b) => {
    for (const t of columns) {
      const c = compare(a[t.column], b[t.column]);
      if (c === 0) continue;
      return t.dir === "asc" ? c : -c;
    }
    return 0;
  });
}

/**
 * Three rows tied at `sort_order = 0` — every row any list has gained since it
 * was seeded — plus two that carry a seeded order, so the first key still has
 * something to do.
 */
function fixture(field: string): FixtureRow[] {
  return [
    { id: "seeded-2", sortOrder: 2, [field]: "Beta" },
    { id: "added-c", sortOrder: 0, [field]: "Gamma" },
    { id: "seeded-1", sortOrder: 1, [field]: "Alpha" },
    { id: "added-a", sortOrder: 0, [field]: "Delta" },
    { id: "added-b", sortOrder: 0, [field]: "Epsilon" },
  ];
}

/**
 * Three arrival orders standing in for three reads of the same rows.
 *
 * Generic since Slice #34.32, so §8 can hand it `document-types` rows — which
 * carry a `key` and no `sortOrder` — without a cast. The body is unchanged.
 */
function arrivals<T>(rows: T[]): T[][] {
  return [rows, [...rows].reverse(), [...rows.slice(2), ...rows.slice(0, 2)]];
}

/** Every list whose whole sort key is columns — i.e. all but `document-types`. */
const MODELLABLE = VALID_LIST_KEYS.filter(
  (k) => BRANCHES[k].terms.length > 0 && BRANCHES[k].terms.every((t) => t.kind === "column"),
);

describe("§5 the same rows, read three times, come back in the same order", () => {
  it("covers every list but document-types, whose CASE pin has no fixture", () => {
    expect(VALID_LIST_KEYS.filter((k) => !MODELLABLE.includes(k))).toEqual(["document-types"]);
  });

  it.each(MODELLABLE.map((k) => [k]))("%s", (key) => {
    const rows = fixture(requiredField(key));
    expect(rows.filter((r) => r.sortOrder === 0).length).toBe(3);
    const results = arrivals(rows).map((arrival) =>
      orderBy(arrival, BRANCHES[key].terms).map((r) => r.id),
    );
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  /**
   * The negative control. This is what the seven lists did before Slice
   * #34.01, on the same rows: the three rows tied at zero come back in
   * whatever order they arrived, so two reads disagree. If this test ever goes
   * green, the model above has stopped modelling anything.
   */
  it("NEGATIVE CONTROL: sortOrder alone does NOT survive a different arrival order", () => {
    const rows = fixture("name");
    const sortOrderOnly: SortTerm[] = [
      { kind: "column", raw: "asc(t.sortOrder)", dir: "asc", table: "t", column: "sortOrder" },
    ];
    const [first, reversed] = arrivals(rows).map((arrival) =>
      orderBy(arrival, sortOrderOnly).map((r) => r.id),
    );
    expect(reversed).not.toEqual(first);
  });

  /**
   * THE RESIDUAL, CLOSED ON NINE LISTS AND MEASURED ON THE TENTH.
   *                                                          (Slice #34.14)
   *
   * What stood here ran over every modellable list and asserted that two rows
   * sharing EVERY sort key still swap — the honest limit of `(sort_order,
   * name)` on tables with no UNIQUE constraint over their display field. It
   * ended: "the day a third key (`id`) is added, it goes red and is deleted
   * with the caveat." That day is this slice, so the test is SPLIT rather than
   * deleted: the nine that took `asc(id)` are asserted to hold still, and
   * `person-roles` — which the slice deliberately did not touch — keeps the
   * original assertion, because a residual nothing measures is a residual
   * nobody knows is still there.
   *
   * ⚠️ **`id` IS A uuid IN THE DATABASE AND A LABEL IN THIS FIXTURE**, so what
   * the first half models is that the key SEPARATES the rows, not the order it
   * puts them in. That is the whole claim: a total key means two reads agree,
   * whatever the collation says about which comes first.
   */
  it.each(
    MODELLABLE.filter((k) => TOTAL_KEY.includes(k)).map((k) => [k]),
  )(
    "%s — two rows tied on BOTH sort_order and name come back the same way twice",
    (key) => {
      const field = requiredField(key);
      const twins: FixtureRow[] = [
        { id: "twin-a", sortOrder: 0, [field]: "Același" },
        { id: "twin-b", sortOrder: 0, [field]: "Același" },
      ];
      // ⚠️ **NOT `arrivals()`, and the reason is arithmetic.** That helper's
      // third order is `[...rows.slice(2), ...rows.slice(0, 2)]`, which for a
      // TWO-row fixture is the first order again — so a third `toEqual` here
      // would be a line that cannot fail. Two rows have exactly two arrival
      // orders and both are asserted.
      const forwards = orderBy(twins, BRANCHES[key].terms).map((r) => r.id);
      const backwards = orderBy([...twins].reverse(), BRANCHES[key].terms).map((r) => r.id);
      expect(backwards).toEqual(forwards);
    },
  );

  it("person-roles — RESIDUAL: two roles sharing one name can still swap", () => {
    const twins: FixtureRow[] = [
      { id: "twin-a", sortOrder: 0, name: "Același" },
      { id: "twin-b", sortOrder: 0, name: "Același" },
    ];
    const terms = BRANCHES["person-roles"].terms;
    const forwards = orderBy(twins, terms).map((r) => r.id);
    const backwards = orderBy([...twins].reverse(), terms).map((r) => r.id);
    expect(backwards).not.toEqual(forwards);
  });
});

// ── §6 person-roles: the column is no longer written either ──────────────────
//
// Slice #34.01 had to resolve `lookup_person_role.sort_order` one way rather
// than leave it written-on-every-save and read-by-nothing. §4 pins the read
// side (the list still sorts by name alone); this pins the write side, and it
// does so BEHAVIOURALLY — through the schemas the routes actually parse with,
// not by reading their source, so a `sortOrder` reintroduced by any spelling
// fails here. The full create/update matrix for the ten lists that DO have the
// field is in document-type-template-editor.test.ts.

describe("§6 person-roles does not write sort_order", () => {
  it("neither schema yields one, whether or not the payload sends it", () => {
    // ⚠️ **The assertion is `not.toContain("sortOrder")`, not an exact key
    // list, and Slice #34.04 is why.** The exact list was `["name"]` and this
    // test went red when that slice added `validForProperty` /
    // `validForPerson` — the two whitelist tables that became columns
    // (migration_079). It was right to go red: the key set had genuinely
    // changed. But what §6 is FOR is the one key that must never come back, and
    // pinning the whole set makes every future column on this list stop here
    // for a reason that has nothing to do with `sort_order`. The exact-set
    // assertion moved to person-role-flags.test.ts §2, where growing it is the
    // point — an adversarial round caught this comment claiming that while the
    // assertion was still sitting three lines below it.
    for (const schemas of [LIST_SCHEMAS, LIST_UPDATE_SCHEMAS]) {
      const schema = schemas["person-roles"];
      expect(Object.keys(schema.parse({ name: "Cumpărător" }))).not.toContain("sortOrder");
      expect(Object.keys(schema.parse({ name: "Cumpărător", sortOrder: 7 }))).not.toContain("sortOrder");
    }
  });

  it("the identical relationship-role lists DO still write one — their lists read it", () => {
    for (const key of ["property-property-roles", "document-document-roles"] as const) {
      expect(LIST_SCHEMAS[key].parse({ name: "Anexă" }).sortOrder).toBe(0);
      expect(LIST_SCHEMAS[key].parse({ name: "Anexă", sortOrder: 7 }).sortOrder).toBe(7);
    }
  });
});

// ── §7 The two lists that are read TWICE, and must agree with themselves ─────
//
// ⚠️ **A SORT KEY IS A PROPERTY OF THE SCREEN, NOT OF THE FUNCTION, AND TWO OF
// THESE LISTS HAVE TWO READERS.** (Slice #34.14.) The relationship-role lists
// are served to Reference Data's modal by `listValues` and to the association
// screens' dropdowns by `listPropertyPropertyRoles` /
// `listDocumentDocumentRoles` — two functions, two files, one table. Slice
// #29.13 shaped the `listValues` branches to match the pickers precisely so
// the two would agree; closing one on `asc(id)` and not the other would have
// undone that from the other side, with tied rows sitting one way in the modal
// and the other way in the dropdown.
//
// Asserted as the sibling's own ORDER BY rather than by comparing the two term
// lists, because the two files spell their terms differently — `asc(x.name)`
// in `listValues`, a bare `x.name` in the pickers (Drizzle treats a bare column
// as ascending). Normalising one into the other would be a third opinion about
// what the two mean.

describe("§7 the relationship lists' second reader sorts the same way", () => {
  it.each([
    ["property-property-roles", "lookupPropertyPropertyRole"],
    ["document-document-roles", "lookupDocumentDocumentRole"],
  ] as const)("%s's dropdown reader ends on id too", (dir, table) => {
    const src = read("lib", "admin", dir, "queries.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    const at = src.indexOf(".orderBy(");
    expect(`${dir}: ${at > -1 ? "has an orderBy" : "NO orderBy"}`).toBe(
      `${dir}: has an orderBy`,
    );
    const args = at < 0 ? null : balanced(src, at + ".orderBy".length);
    expect(args === null ? [] : splitArgs(args)).toEqual([
      `${table}.sortOrder`,
      `${table}.name`,
      `${table}.id`,
    ]);
  });
});

// ── §8 document-types: the tie migration_080 leaves open ─────────────────────
//
// ⚠️ **THE BRANCH §5 CANNOT MODEL, MODELLED — BECAUSE THE CASE IT WAS EXCUSED
// FROM IS THE ONE SLICE #34.32 IS ABOUT.** §5 refuses a non-column term rather
// than skipping it, deliberately (see `orderBy`'s docblock), so
// `document-types` has never been exercised here at all — it was excused on the
// claim that migration_080 left it nothing to tie on. That claim is false for
// the EMPTY normalised form, which the index excludes on purpose so that one
// punctuation-only type cannot absorb every other one.
//
// So this section carries its own two-line model of the one `sql` term — the
// UNCLASSIFIED pin — rather than widening §5's, which would put a fixture
// `key` column into nine lists that have no such thing.
//
// ⚠️ **THE MODEL IS DRIVEN BY THE PARSED TERMS, NOT BY A HAND-WRITTEN KEY.**
// The first test below re-derives the shape from `BRANCHES["document-types"]`
// and fails if it is not (pin, name, id), so the comparator cannot go on
// asserting determinism about an ORDER BY the branch no longer has.

type DocTypeRow = { id: string; key: string; name: string };

/** `CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`, in TypeScript. */
function catchAllRank(row: DocTypeRow): number {
  return row.key === "UNCLASSIFIED" ? 0 : 1;
}

/** The branch's key as three comparisons, in the order the branch states it. */
function orderDocumentTypes(rows: DocTypeRow[], terms: SortTerm[]): string[] {
  const columns = terms.slice(1).map((t) => {
    if (t.kind !== "column") throw new Error(`§8 expected a column term: ${t.raw}`);
    return t.column as keyof DocTypeRow;
  });
  return [...rows]
    .sort((a, b) => {
      const pin = catchAllRank(a) - catchAllRank(b);
      if (pin !== 0) return pin;
      for (const column of columns) {
        const c = compare(a[column], b[column]);
        if (c !== 0) return c;
      }
      return 0;
    })
    .map((r) => r.id);
}

/**
 * ⚠️ **TWO ROWS WITH THE SAME NAME STRING, AND AN ADVERSARIAL ROUND IS WHY
 * THEY ARE THE SAME STRING.** The first version of this fixture used „—" and
 * „·" — two DIFFERENT punctuation-only names — on the reasoning that both
 * normalise to nothing. They do, and it proves nothing: `asc(name)` compares
 * the RAW text, so the second term separates them and the whole section stayed
 * green with the third term deleted.
 *
 * The tie migration_080's PARTIAL index really lets through is two rows whose
 * `name` is ONE string: `normaliseDocumentTypeName("—")` is `""`, the index is
 * `WHERE <normalised> <> ''`, so a second row named „—" is not refused. Those
 * two tie on the pin and on the name together, and `asc(id)` is the only thing
 * that separates them.
 *
 * The catch-all and an ordinary type are here so the pin and the name both
 * still have something to do — a fixture of two identical rows alone would
 * pass under `ORDER BY id` by itself.
 */
function punctuationOnlyFixture(): DocTypeRow[] {
  return [
    { id: "type-b", key: "PUNCT_B", name: "—" },
    { id: "type-ordinary", key: "CONTRACT", name: "Contract de Vânzare" },
    { id: "type-a", key: "PUNCT_A", name: "—" },
    { id: "type-catchall", key: "UNCLASSIFIED", name: "NECLASIFICAT" },
  ];
}

describe("§8 document-types resolves a same-name tie the same way every read", () => {
  it("the branch is the pin, then name, then id — which is what §8 models", () => {
    const terms = BRANCHES["document-types"].terms;
    expect(terms.map((t) => (t.kind === "sql" ? "sql" : t.raw))).toEqual([
      "sql",
      "asc(lookupDocumentType.name)",
      "asc(lookupDocumentType.id)",
    ]);
  });

  it("three arrival orders of the same rows come back identically", () => {
    const rows = punctuationOnlyFixture();
    const terms = BRANCHES["document-types"].terms;
    const results = arrivals(rows).map((arrival) => orderDocumentTypes(arrival, terms));
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  /**
   * ⚠️ **THE TEST ABOVE WOULD PASS WITHOUT THE THIRD TERM UNLESS THIS IS
   * ASSERTED — AND ON THE FIRST FIXTURE IT DID.** Three stable reads prove the
   * key is total; they do not prove which term made it total. Deleting
   * `asc(id)` has to break the fixture, or the section is measuring the first
   * two terms and reporting the third.
   */
  it("⚠️ and it is asc(id) that does it — without the third term they swap", () => {
    const rows      = punctuationOnlyFixture();
    const withoutId = BRANCHES["document-types"].terms.slice(0, 2);
    const forwards  = orderDocumentTypes(rows, withoutId);
    const backwards = orderDocumentTypes([...rows].reverse(), withoutId);
    expect(backwards).not.toEqual(forwards);
  });

  /**
   * ⚠️ **`id` MAY ONLY BREAK A TIE, NEVER DECIDE THE ORDER** — §2 pins that
   * from the term list, and this pins it behaviourally.
   *
   * ⚠️ **AND THE FIRST VERSION OF THIS TEST MEASURED NOTHING, WHICH AN
   * ADVERSARIAL ROUND PROVED BY MUTATION.** It compared the branch's terms
   * against `terms.slice(0, 2)` — the branch's OWN first two terms — on a
   * fixture with distinct names. Under a branch reordered to `(pin, id, name)`
   * that slice is `(pin, id)`, already total, so the two agreed and the test
   * was GREEN; its docblock claimed the opposite ("would pass §2's 'ends on id'
   * test and fail here"), and both halves of that sentence were inverted:
   * measured, §2 goes red on that reorder and this went green.
   *
   * The reference order is therefore WRITTEN OUT — pin, then name — rather than
   * sliced off the thing under test. Now a branch that put `id` ahead of `name`
   * sorts four distinctly-named rows by uuid and disagrees with it.
   */
  it("the UNCLASSIFIED pin wins, and id changes nothing when no two names tie", () => {
    const distinct = punctuationOnlyFixture().map((r) =>
      r.id === "type-b" ? { ...r, name: "·" } : r,
    );
    const PIN_THEN_NAME: SortTerm[] = [
      { kind: "sql", raw: "sql`CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`" },
      { kind: "column", raw: "asc(lookupDocumentType.name)", dir: "asc",
        table: "lookupDocumentType", column: "name" },
    ];
    const asBranched = orderDocumentTypes(distinct, BRANCHES["document-types"].terms);
    const byNameOnly = orderDocumentTypes(distinct, PIN_THEN_NAME);
    expect(asBranched[0]).toBe("type-catchall");
    expect(asBranched).toEqual(byNameOnly);
  });

  /**
   * The same negative control reduced to the pair itself: two rows, one name,
   * nothing else. This is what `document-types` did until Slice #34.32 — and,
   * unlike §5's negative control, it is reachable with a name a person can
   * really type, because migration_080's index does not cover the empty
   * normalised form.
   */
  it("NEGATIVE CONTROL: without id, two identically-named types swap", () => {
    const twins: DocTypeRow[] = [
      { id: "twin-a", key: "PUNCT_A", name: "—" },
      { id: "twin-b", key: "PUNCT_B", name: "—" },
    ];
    const withoutId = BRANCHES["document-types"].terms.slice(0, 2);
    const forwards = orderDocumentTypes(twins, withoutId);
    const backwards = orderDocumentTypes([...twins].reverse(), withoutId);
    expect(backwards).not.toEqual(forwards);

    // And with the term the branch really carries, they do not.
    const terms = BRANCHES["document-types"].terms;
    expect(orderDocumentTypes([...twins].reverse(), terms)).toEqual(
      orderDocumentTypes(twins, terms),
    );
  });
});

// ── §9 The second reader of document-types must agree, term for term ─────────
//
// ⚠️ **`readTypes` IS A RESTATEMENT OF `listValues`' BRANCH, NOT AN IMPORT OF
// IT, AND THAT IS WHAT MAKES THIS TEST NECESSARY RATHER THAN PEDANTIC.**
// `src/lib/documents/resolve-document-type.ts` says so in its own ⚠️: the
// import wizard matches against the list as
// `GET /api/admin/value-lists/document-types` served it, and `matchDocumentType`
// takes the FIRST row that matches — so if the two orders disagree, the wizard
// shows one row and the resolver adopts another.
//
// Same shape as §7, which pins the relationship lists' second reader for the
// same reason. The difference is that these two spell their terms identically,
// so the two term lists are compared directly.

describe("§9 readTypes restates listValues' document-types branch exactly", () => {
  it("has the same three sort terms, in the same order", () => {
    const src = read("lib", "documents", "resolve-document-type.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    const at = src.indexOf(".orderBy(");
    expect(`readTypes: ${at > -1 ? "has an orderBy" : "NO orderBy"}`).toBe(
      "readTypes: has an orderBy",
    );
    const args = at < 0 ? null : balanced(src, at + ".orderBy".length);
    const terms = (args === null ? [] : splitArgs(args)).map(parseTerm);

    // ⚠️ **THE PIN IS COMPARED EXACTLY, AND AN ADVERSARIAL ROUND CORRECTED THE
    // COMMENT THAT SAID OTHERWISE.** What stood here: "the `sql` CASE is
    // compared by its content rather than by its exact whitespace: the two
    // files format the template literal differently and always have." They do
    // not — both are byte-identical today, and the `replace(/\s+/g, " ")` below
    // is a normalisation that currently changes nothing. It is kept because a
    // reformat of one file is not a change of meaning, but nobody should
    // reformat the pin on the strength of a claim that it has already
    // diverged. What must match is the pin itself and the two column terms.
    expect(terms.map((t) => (t.kind === "sql" ? "sql" : t.raw))).toEqual(
      BRANCHES["document-types"].terms.map((t) => (t.kind === "sql" ? "sql" : t.raw)),
    );
    expect(terms[0].kind).toBe("sql");
    expect(terms[0].raw).toContain("UNCLASSIFIED");
    expect(terms[0].raw.replace(/\s+/g, " ")).toBe(
      BRANCHES["document-types"].terms[0].raw.replace(/\s+/g, " "),
    );
  });
});
