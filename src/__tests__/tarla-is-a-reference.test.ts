/**
 * @jest-environment node
 */

/**
 * Slice #34.03 — a tarla code became an identity, and this is what that means.
 *
 * WHAT THE SLICE PROMISED, AND WHICH HALF OF IT LIVES HERE
 *   "Renaming a tarla code fixes every property that carries it, in one write."
 *   The end of that sentence — a person renaming a row in Reference Data and a
 *   property screen showing the new code — is a browser fact, and it belongs to
 *   `npm run e2e` and to Adrian. It is named in the handover rather than
 *   pretended at here.
 *
 *   What this file can prove, with no database and no browser, is the MECHANISM
 *   that makes it true, and the mechanism is a chain of four links. A rename
 *   reaches every property iff:
 *
 *     1. the property stores the row's ID and not its text        (the schema)
 *     2. every read of a tarla goes through that id to
 *        `lookup_tarla.indicativ`                                 (the queries)
 *     3. a rename writes `lookup_tarla` and touches no property    (updateValue)
 *     4. nothing anywhere invents a tarla the table does not hold  (the form)
 *
 *   Break any one and the promise is false in a way no type check would catch:
 *   #1 and #4 are the ones that were broken before this slice, and #2 is the
 *   one a future "just read the code off the property, it is faster" would
 *   break next.
 *
 * ⚠️ **WHY SOURCE SCANNING RATHER THAN BEHAVIOUR, AND WHERE THAT STOPS BEING
 * ACCEPTABLE.** These assertions read code, which is the weaker kind of test:
 * they pin a spelling, not an outcome, and a refactor can make them red while
 * the behaviour is fine. They are here because the alternative — a live
 * database — is not available to `npx jest` in this repo, and because the
 * failure they guard against is a SILENT one: a property that keeps reading a
 * stale code looks exactly like a property whose code was never renamed. Where
 * a pure function could answer instead, it does (see `resolveTarlaForCreate`'s
 * fold, asserted through `cadastralKey` below).
 */

import { readFileSync } from "fs";
import { join } from "path";
import { getTableConfig } from "drizzle-orm/pg-core";

import { property, lookupTarla } from "@/db/schema";
import { LIST_DEPENDENCIES } from "@/lib/admin/value-lists/dependents";
import { PROPERTY_SNAPSHOT_PROPERTY_KEYS } from "@/lib/versioning/snapshot-registry";
import { cadastralKey } from "@/lib/properties/cadastral-identity";

const SRC = join(process.cwd(), "src");
const read = (...p: string[]) => readFileSync(join(SRC, ...p), "utf8");

/** Comments and string bodies blanked — a claim must not be met by a comment. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

// ---------------------------------------------------------------------------
// Link 1 — the property stores the row, not the text
// ---------------------------------------------------------------------------

describe("the column", () => {
  const config = getTableConfig(property);

  it("is a nullable uuid foreign key at lookup_tarla, ON DELETE SET NULL", () => {
    const col = config.columns.find((c) => c.name === "tarla_id");
    expect(col).toBeDefined();
    // Nullable, and not a concession: three of the fourteen properties carry no
    // tarla, the Add-Property form lets a user leave it blank on purpose, and
    // ON DELETE SET NULL needs the column to accept NULL by definition.
    expect(col!.notNull).toBe(false);

    // `onDelete` lives on the ForeignKey object; the columns it covers live on
    // `reference()`. Both are needed, so the pair is kept together.
    const fk = config.foreignKeys.find((f) =>
      f.reference().columns.some((c) => c.name === "tarla_id"),
    );
    expect(fk).toBeDefined();
    const ref = fk!.reference();
    expect(getTableConfig(ref.foreignTable).name).toBe("lookup_tarla");
    expect(ref.foreignColumns.map((c) => c.name)).toEqual(["id"]);
    // The whole reason for copying migration_028's shape: removing a code from
    // Reference Data clears the tag rather than refusing the delete (NO ACTION)
    // or deleting the property (CASCADE).
    expect(fk!.onDelete).toBe("set null");
  });

  it("has no `tarla_sola` left to fall back to", () => {
    // The failure this guards is a REVERT that adds the text column back
    // "temporarily": both would then exist, the app would keep working, and
    // renames would silently stop reaching half the reads.
    expect(config.columns.map((c) => c.name)).not.toContain("tarla_sola");
  });

  it("is what the version snapshot carries", () => {
    expect(PROPERTY_SNAPSHOT_PROPERTY_KEYS).toContain("tarlaId");
    expect(PROPERTY_SNAPSHOT_PROPERTY_KEYS).not.toContain("tarlaSola");
  });
});

// ---------------------------------------------------------------------------
// Link 2 — every read goes through the id
// ---------------------------------------------------------------------------

describe("every read of a tarla code goes through the foreign key", () => {
  // The three places a tarla code reaches a screen or a decision. Each one used
  // to read `property.tarlaSola`; each one now joins `lookup_tarla`, which is
  // the only reason a rename is visible without touching a property row.
  const READERS: [string, string[]][] = [
    ["the property list and its search", ["lib", "properties", "queries.ts"]],
    ["global search", ["app", "api", "admin", "global-search", "route.ts"]],
  ];

  it.each(READERS)("%s joins lookup_tarla and selects indicativ", (_label, path) => {
    const src = code(read(...path));
    expect(src).toContain("leftJoin(lookupTarla, eq(lookupTarla.id, property.tarlaId))");
    expect(src).toContain("lookupTarla.indicativ");
  });

  it("no reader names a tarla column on `property` any more", () => {
    for (const [, path] of READERS) {
      expect(code(read(...path))).not.toContain("property.tarlaSola");
    }
  });

  /**
   * ⚠️ **The count query needs the join even though it selects nothing from
   * it**, because both halves of `listProperties` share one `where` and that
   * `where` names `lookupTarla.indicativ`. Without it the COUNT is a 42P01 on a
   * table the query never mentioned — and only when the user types something,
   * which is the worst shape of bug to find in production.
   */
  it("joins it in BOTH halves of the property list query", () => {
    const src = code(read("lib", "properties", "queries.ts"));
    const joins = src.match(
      /leftJoin\(lookupTarla, eq\(lookupTarla\.id, property\.tarlaId\)\)/g,
    );
    // list + count + findPropertiesByCadastralIdentity
    expect(joins).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Link 3 — a rename writes one row, and a move re-points properties
// ---------------------------------------------------------------------------

describe("Reference Data writes the list, not the properties", () => {
  it("nothing in the value-lists module writes the property table", () => {
    // A rename that had to reach properties would have to write them, and
    // before #34.03 the MOVE did exactly that for this one list — with a raw
    // `UPDATE property SET tarla_sola = …`, through `moveRef`. That is still
    // how a move works and it is still correct; what changed is that a RENAME
    // now reaches every property without writing one, because the properties
    // hold the row rather than its text.
    expect(code(read("lib", "admin", "value-lists", "queries.ts")))
      .not.toContain("update(property)");
  });

  /**
   * A MOVE still rewrites properties — that is what a move IS — and it still
   * owes them a version row. `versioned` on the ref is what `reassignDependents`
   * reads to write one, and this is the pair `value-list-move-history.test.ts`
   * asserts for all eight versioned refs; it is repeated here because for tarla
   * it is a NEW fact: before #34.03 the move rewrote TEXT, and the thing being
   * pinned is that turning it into a foreign key did not quietly drop the
   * history it owes.
   */
  it("a tarla move still writes the properties' version rows", () => {
    const def = LIST_DEPENDENCIES.tarla;
    expect(def.refs).toHaveLength(1);
    const ref = def.refs[0];
    expect(ref.column.name).toBe("tarla_id");
    expect(ref.versioned).toEqual({
      entity: "property",
      idColumn: property.id,
    });
    expect(ref.configuration).toBeUndefined();
    expect(def.snapshot).toEqual({
      keys: PROPERTY_SNAPSHOT_PROPERTY_KEYS,
      field: "tarlaId",
    });
  });

  it("keeps none of the three mechanisms the text column needed", () => {
    const q = code(read("lib", "admin", "value-lists", "queries.ts"));
    const d = code(read("lib", "admin", "value-lists", "dependents.ts"));
    expect(q).not.toContain("siblingsSharingValue");
    expect(q).not.toContain("matchesByValue");
    expect(d).not.toContain("matchesByValue");
    // The refusal, and the wire code the route answered with.
    expect(q).not.toContain("ambiguous-value");
    expect(
      code(read("app", "api", "admin", "value-lists", "[list]", "[id]", "reassign", "route.ts")),
    ).not.toContain("AMBIGUOUS_VALUE");
    // And `source`, the field that existed only so one list could differ.
    expect(d).not.toMatch(/^\s*source:/m);
  });
});

// ---------------------------------------------------------------------------
// Link 4 — nothing invents a code the table does not hold
// ---------------------------------------------------------------------------

describe("the dropdown offers exactly the rows the table holds", () => {
  const form = code(read("app", "properties", "_components", "property-form.tsx"));

  it("builds its options from the row id", () => {
    // `value: o.id`. One character away from `value: o.indicativ`, which is
    // what it was, and which is what makes a selection a string that happens to
    // match a label today rather than a reference that survives a rename.
    expect(form).toMatch(/tarlaOptions\s*=\s*\[\s*noneOption,[\s\S]{0,240}?value:\s*o\.id,/);
    expect(form).not.toContain("value: o.indicativ");
  });

  it("has nothing left to synthesise with", () => {
    expect(form).not.toContain("allowUnlistedValue");
    expect(code(read("components", "forms", "async-select.tsx")))
      .not.toContain("optionsWithUnlistedValues");
  });
});

// ---------------------------------------------------------------------------
// The one door that can still mint a code, and the fold it uses
// ---------------------------------------------------------------------------

describe("only an import can still create a tarla code", () => {
  const q = read("lib", "properties", "queries.ts");

  it("resolves by cadastralKey rather than by an exact string match", () => {
    /**
     * ⚠️ **This is the assertion the migration's header asks for by name.**
     * The auto-seed used to look its code up with
     * `eq(lookupTarla.indicativ, propFields.tarlaSola)` — an EXACT match —
     * while migration_078 resolves by a fold. An import carrying `t3` finds no
     * exact `T3`, inserts a second row, and the list then holds two codes that
     * mean one tarla with properties pointing at both: the pair problem
     * migration_078 REFUSES to resolve, manufactured by the application the day
     * after the migration ran.
     */
    const stripped = code(q);
    expect(stripped).not.toContain("eq(lookupTarla.indicativ,");
    expect(stripped).toContain("cadastralKey(r.indicativ) === wanted");

    // And the fold really does close the case above — a pure check, not a
    // spelling one.
    expect(cadastralKey("t3")).toBe(cadastralKey("T3"));
    expect(cadastralKey("47per2")).toBe(cadastralKey("47/2"));
    expect(cadastralKey("50 D")).toBe(cadastralKey("50D"));
  });

  it("writes the decoded value, so a folder's `47per2` never becomes a row", () => {
    expect(code(q)).toContain("const value = cadastralValue(raw)");
  });

  it("cannot be reached by a payload that names a row", () => {
    // `tarlaId` returns before the lookup, so the only path to the INSERT is
    // `tarlaCode` — a field the Property form does not send. That is what makes
    // "only an import mints a code" a fact about the type rather than an
    // argument about five call sites.
    const body = code(q);
    const at = body.indexOf("async function resolveTarlaForCreate");
    expect(at).toBeGreaterThan(-1);
    const fn = body.slice(at, at + 1400);
    expect(fn.indexOf("if (input.tarlaId) return input.tarlaId;"))
      .toBeLessThan(fn.indexOf("insert(lookupTarla)"));
  });
});

// ---------------------------------------------------------------------------
// The lookup table itself
// ---------------------------------------------------------------------------

describe("lookup_tarla", () => {
  it("still has no unique constraint on its code, deliberately", () => {
    /**
     * migration_078 argues this at length: the FK removes the AMBIGUITY without
     * needing uniqueness, because a property points at one ROW. A unique index
     * over the folded `indicativ` would need the fold as a permanent IMMUTABLE
     * function in three hand-maintained files and would turn the admin form's
     * second "T1" into a 23505 needing a friendly error — a different slice.
     *
     * Pinned so that adding one is a deliberate act with a test to update,
     * rather than a tidy-up that changes what an administrator can do.
     */
    const col = getTableConfig(lookupTarla).columns.find((c) => c.name === "indicativ");
    expect(col!.isUnique).toBe(false);
    expect(col!.notNull).toBe(true);
  });
});
