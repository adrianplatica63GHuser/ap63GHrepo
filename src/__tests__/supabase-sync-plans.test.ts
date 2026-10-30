/**
 * Slice 41.14: `npm run supabase:sync` plans each table's columns BEFORE it truncates
 * (`planAll(SIMPLE_TABLES)`), and `syncSimple` refuses a table it has no plan for. Slice #39.70
 * added `syncSimple("lookup_person_relationship", ...)` without the matching SIMPLE_TABLES entry,
 * so the first sync after it failed half-way, with Supabase already dropped and rebuilt. This
 * holds the two lists equal — same tables, same order column, same order — from the script's text.
 */
import fs from "node:fs";
import path from "node:path";

const SOURCE = fs.readFileSync(path.join(process.cwd(), "scripts/supabase-sync.ts"), "utf8");

const listBlock = SOURCE.slice(
  SOURCE.indexOf("const SIMPLE_TABLES"),
  SOURCE.indexOf("];", SOURCE.indexOf("const SIMPLE_TABLES")),
);
const planned = [...listBlock.matchAll(/\["(\w+)",\s*"(\w+)"\]/g)].map((m) => `${m[1]}:${m[2]}`);

const mainBlock = SOURCE.slice(SOURCE.indexOf("async function main()"));
const called = [...mainBlock.matchAll(/await syncSimple\("(\w+)",\s*"(\w+)"\)/g)].map((m) => `${m[1]}:${m[2]}`);

describe("supabase-sync: every syncSimple call has a column plan", () => {
  it("finds both lists", () => {
    expect(planned.length).toBeGreaterThan(0);
    expect(called.length).toBeGreaterThan(0);
  });

  it("plans exactly the tables it copies, with the same order column, in copy order", () => {
    expect(planned).toEqual(called);
  });

  it("plans lookup_person_relationship (the 41.14 failure)", () => {
    expect(planned).toContain("lookup_person_relationship:sort_order");
  });
});
