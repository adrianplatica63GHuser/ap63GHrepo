/**
 * scripts/seed-dev-data-big/columns.ts — every table and column of the archive, and whether `npm run seed:dev`
 * writes it (Slice #39.81). Held to the schema both ways: a table or column added to src/db/schema/index.ts and not
 * named in the map fails here, so the next field the archive gains is a decision about the seed, not a gap found
 * later; and a name in the map the schema no longer has fails too.
 */
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { checkSql, columnChecks, emptyColumns, formatColumns, IMPLICIT_COLUMNS, SEED_COLUMNS, type ColumnCheck } from "../../scripts/seed-dev-data-big/columns";

const tables = new Map<string, string[]>();
for (const value of Object.values(schema)) {
  if (!(value instanceof PgTable)) continue;
  const c = getTableConfig(value);
  tables.set(c.name, c.columns.map((x) => x.name).filter((n) => !(IMPLICIT_COLUMNS as readonly string[]).includes(n)));
}

describe("the seed's column map", () => {
  it("names every table of the schema, and no table the schema does not have", () => {
    expect(tables.size).toBeGreaterThan(50);
    expect(Object.keys(SEED_COLUMNS).sort()).toEqual([...tables.keys()].sort());
  });

  it("names every column of each table, and no column it does not have", () => {
    for (const [name, cols] of tables) {
      const t = SEED_COLUMNS[name];
      if ("never" in t) continue;
      expect({ table: name, columns: Object.keys(t.columns).sort() }).toEqual({ table: name, columns: [...cols].sort() });
    }
  });

  it("each check reads its rows by a column the table has", () => {
    for (const [name, t] of Object.entries(SEED_COLUMNS)) {
      if ("never" in t || !t.scope) continue;
      expect([...(tables.get(name) ?? []), "id"]).toContain(t.scope.column);
    }
  });

  it("a column the seed writes is in a table it can check; a table it never writes holds accounts, settings, money or quizzes", () => {
    for (const [name, t] of Object.entries(SEED_COLUMNS)) {
      if ("never" in t) continue;
      const seeds = Object.values(t.columns).some((f) => typeof f === "string" && f.startsWith("seed"));
      if (seeds) expect({ table: name, scoped: t.scope !== null }).toEqual({ table: name, scoped: true });
    }
    const never = Object.entries(SEED_COLUMNS).filter(([, t]) => "never" in t).map(([k]) => k).sort();
    expect(never).toEqual(["ai_paid_read", "app_users", "cost_record", "help_content", "help_hint", "skill_attempt", "time_frame_setting", "user_requests", "user_tile_default"]);
  });

  it("the fields 39.60–39.79 added are the seed's to write", () => {
    const fill = (t: string, c: string) => {
      const x = SEED_COLUMNS[t];
      return "never" in x ? null : x.columns[c];
    };
    for (const [t, c] of [
      ["lookup_tarla", "locality"], ["lookup_tarla", "notes"], ["tarla_corner", "lat"], ["tarla_parcel", "parcela"], ["tarla_parcel", "use_printed"],
      ["document_tarla", "document_id"], ["natural_person_relationship", "relationship_id"], ["document", "issuer_person_id"], ["document", "issuer_read"],
      ["natural_person", "physical_person_type_id"],
    ] as const) expect([t, c, fill(t, c)]).toEqual([t, c, "seed"]);
  });

  it("a check per scoped table, one SELECT counting each column, its ids the one parameter", () => {
    const checks = columnChecks();
    expect(checks.find((c) => c.table === "natural_person")!.columns).toContainEqual({ name: "correspondence_same_as_home", fill: "seed-true" });
    const c: ColumnCheck = { table: "document_page", scope: { column: "document_id", set: "documents" }, columns: [{ name: "page_notes", fill: "seed" }, { name: "rotation", fill: "seed-nonzero" }] };
    expect(checkSql(c)).toBe('SELECT count(*) AS n, count("page_notes") AS c0, count(*) FILTER (WHERE "rotation" <> 0) AS c1 FROM "document_page" WHERE "document_id" = ANY($1::uuid[])');
    expect(() => checkSql({ ...c, table: 'document"; DROP' })).toThrow(/plain column name/);
    expect(emptyColumns(c, { n: "12", c0: "3", c1: "0" })).toEqual({ table: "document_page", rows: 12, empty: ["rotation"] });
    expect(emptyColumns(c, {})).toEqual({ table: "document_page", rows: 0, empty: ["page_notes", "rotation"] });
  });

  it("prints a line per column and the count", () => {
    const out = formatColumns();
    expect(out).toContain("lookup_tarla");
    expect(out).toMatch(/\d+ coloane: \d+ scrise de seed/);
    expect(out).toContain("app_users  —  nu se scrie:");
  });
});
