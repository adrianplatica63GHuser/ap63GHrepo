/**
 * @jest-environment node
 */

/**
 * Slice #29.04 — delete means gone, and it stays gone.
 *
 * Source-level invariants, in the style this repo already uses for
 * auth-single-source and help-coverage. They exist because every one of them
 * is a property that a later slice could quietly undo while every unit test
 * still passed:
 *
 *   1. No table carries `deleted_at` and no query filters on it. A single
 *      reintroduced column would put invisible rows back in the database, and
 *      invisible rows are what made Adrian's own experiments in #29.01
 *      unreadable.
 *   2. Every entity delete is a real DELETE that also removes the row's
 *      `principal_object`. Without the second half the code stays taken and
 *      the tags, metadata and cross-references of a deleted thing survive it.
 *   3. Deleting a document deletes its stored page files, reading the paths
 *      BEFORE the rows go, because `document_page` cascades and `file_path`
 *      is the only record of where the bytes are.
 *   4. Entity codes come from a sequence and nothing resets it. This is the
 *      rule that is the OPPOSITE of key reuse (see
 *      hard-delete-key-reuse.test.ts) and the one most likely to be "helpfully"
 *      undone by someone who reads only the other one.
 *   5. property_corner_source still cascades from property. Once
 *      `releaseCornerSourceForProperty` was deleted, that constraint became
 *      the ONLY thing freeing a source document — so it is now load-bearing
 *      in a way it was not before.
 */

import fs   from "fs";
import path from "path";

const SRC = path.join(process.cwd(), "src");

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf8");
}

/**
 * The file with every comment and string body blanked out.
 *
 * The checks below are about what the CODE does, and several of them would
 * otherwise be tripped by the comments this slice deliberately added —
 * corner-source.ts explains at length why `releaseCornerSourceForProperty`
 * was removed, and preexisting-lookup.ts says which `deleted_at IS NULL` it
 * no longer needs. A guard that forbids naming the thing it removed would
 * push the reasoning out of the codebase, which is the opposite of what this
 * repo wants.
 */
function sqlCode(source: string): string {
  return source.replace(/--[^\n]*/g, " ");
}

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

/** Every .ts/.tsx under src/, excluding this test and its sibling. */
function allSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry.name)) out.push(p);
    }
  };
  walk(SRC);
  return out.filter((p) => !p.includes("hard-delete-"));
}

// ---------------------------------------------------------------------------
// 1. The column is gone and nothing looks for it
// ---------------------------------------------------------------------------

describe("deleted_at does not exist", () => {
  it("is declared on no table in the schema", () => {
    const schema = read("db", "schema", "index.ts");
    expect(schema).not.toMatch(/deletedAt\s*:\s*timestamp\(/);
  });

  it("is not read or written anywhere in src/", () => {
    const offenders = allSourceFiles().filter((p) => {
      const body = code(fs.readFileSync(p, "utf8"));
      return (
        /isNull\(\s*\w+\.deletedAt\s*\)/.test(body) ||
        /\.set\(\{\s*deletedAt/.test(body) ||
        /deletedAt\s*:/.test(body) ||
        /deleted_at\s+IS\s+NULL/i.test(body)
      );
    });
    expect(offenders.map((p) => path.relative(SRC, p))).toEqual([]);
  });

  it("has no surviving trigger that reads it", () => {
    // migration_025's two trigger functions had `p.deleted_at IS NULL` in
    // their bodies; with the column gone they would raise on every insert
    // into natural_person / judicial_person. migration_070 drops them and
    // restores the plain partial unique indexes they had replaced.
    const migration = fs.readFileSync(
      path.join(SRC, "db", "migration_070_drop_soft_delete.sql"),
      "utf8",
    );
    expect(migration).toContain("DROP FUNCTION IF EXISTS natural_person_check_cnp_unique()");
    expect(migration).toContain("DROP FUNCTION IF EXISTS judicial_person_check_cui_unique()");
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS natural_person_cnp_unique/);
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS judicial_person_cui_unique/);
  });

  it("the 409 for a duplicate CNP/CUI still keys off the restored index names", () => {
    // dbErrorToResponse matches `e.constraint` containing "cnp"/"cui". The
    // restored indexes are natural_person_cnp_unique / judicial_person_cui_
    // unique, so the 409 survives the swap from triggers back to indexes —
    // rename either index and this stops being true silently.
    const errors = read("lib", "api", "errors.ts");
    expect(errors).toContain('e.constraint?.includes("cnp")');
    expect(errors).toContain('e.constraint?.includes("cui")');
  });
});

// ---------------------------------------------------------------------------
// 2. Every entity delete takes its principal_object with it
// ---------------------------------------------------------------------------

describe("an entity delete removes its principal_object row", () => {
  const cases: Array<[string, string[], string]> = [
    ["person",   ["lib", "persons", "queries.ts"],    "deletePersons"],
    ["property", ["lib", "properties", "queries.ts"], "deleteProperties"],
    ["document", ["lib", "documents", "queries.ts"],  "deleteDocuments"],
  ];

  it.each(cases)("%s", (_entity, file, fn) => {
    const body = functionBody(read(...file), fn);
    // A real delete, not an update. `.set(` in ANY form — a soft delete
    // written `.set( { … } )`, `.set(patch)` or `tx.update(x).set(v)` — is
    // the thing being forbidden, so match the call, not one spelling of it.
    expect(body).toMatch(/\.delete\(/);
    expect(body).not.toMatch(/\.update\s*\(/);
    expect(body).not.toMatch(/\.set\s*\(/);
    // …and the principal_object row goes too, in the same transaction.
    expect(body).toContain("db.transaction");
    // The COLUMN matters as much as the call: passing `r.id` here deletes
    // nothing (principal_object.id is a different uuid), leaving every code
    // taken and every tag, metadata row and cross-reference of the deleted
    // entity alive. That mistake passes a bare toContain("deletePrincipal…").
    expect(body).toMatch(
      /deletePrincipalObjects\(\s*tx\s*,\s*rows\.map\(\s*\(\s*r\s*\)\s*=>\s*r\.principalObjectId\s*\)/,
    );
  });

  it("the single-entity delete is the batch delete, not a second copy", () => {
    // Two implementations is how the Property pair drifted: the batch route
    // wrote deleted_at inline and so skipped the corner-source release the
    // single delete performed.
    expect(functionBody(read("lib", "persons", "queries.ts"), "deletePerson")).toContain("deletePersons([id])");
    expect(functionBody(read("lib", "properties", "queries.ts"), "deleteProperty")).toContain("deleteProperties([id])");
    expect(functionBody(read("lib", "documents", "queries.ts"), "deleteDocument")).toContain("deleteDocuments([id])");
  });

  it("the batch routes delegate rather than writing their own delete", () => {
    for (const [seg, fn] of [
      ["people", "deletePersons"],
      ["properties", "deleteProperties"],
      ["documents", "deleteDocuments"],
    ] as const) {
      const route = code(read("app", "api", seg, "batch-delete", "route.ts"));
      expect(route).toContain(`await ${fn}(ids)`);
      // Whitespace-insensitive: the first version hard-coded six spaces of
      // indentation, so a 2-space or tab-indented `db\n  .update(...)` walked
      // straight past it.
      expect(route).not.toMatch(/\.update\s*\(/);
      expect(route).not.toMatch(/\.set\s*\(/);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. A deleted document takes its files
// ---------------------------------------------------------------------------

describe("a deleted document takes its page files with it", () => {
  const body = () => functionBody(read("lib", "documents", "queries.ts"), "deleteDocuments");

  it("reads the file paths inside the transaction, before the rows go", () => {
    const b = body();
    const txAt     = b.indexOf("db.transaction");
    const readAt   = b.indexOf("listDocumentPageFilePaths");
    const deleteAt = b.indexOf(".delete(document)");
    expect(txAt).toBeGreaterThan(-1);
    expect(readAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(-1);
    // document_page cascades from document, so after the delete nothing knows
    // where the bytes are. Order is half the guarantee…
    expect(readAt).toBeLessThan(deleteAt);
    // …and being inside the transaction is the other half: read outside it and
    // a page uploaded in the gap is orphaned with its key recorded nowhere.
    expect(txAt).toBeLessThan(readAt);
    expect(b).toMatch(/listDocumentPageFilePaths\(\s*ids\s*,\s*tx\s*\)/);
  });

  it("deletes them, and does not turn a storage failure into a failed delete", () => {
    const b = body();
    expect(b).toMatch(/await\s+deleteFiles\(\s*filePaths\s*\)/);
    // The rows are already gone by then, so a `throw` here would answer 500
    // for a delete that succeeded and send the user back to retry it — into a
    // 404. The log line is the only artefact a sweep could use.
    expect(b).toContain("console.error");
    expect(b).not.toMatch(/throw\b/);
  });

  it("both storage-delete paths have the SAME policy", () => {
    // The single-page DELETE route and deleteDocuments remove the same kind of
    // bytes. An intermediate version of this slice had them disagree — one
    // aborting its delete on a storage failure, the other completing it — and
    // that is precisely the drift this slice removed everywhere else.
    const pageRoute = code(
      read("app", "api", "documents", "[id]", "pages", "[pageId]", "route.ts"),
    );
    // Row first, then the bytes, then log. Not the other way round.
    expect(pageRoute.indexOf("deleteDocumentPage(")).toBeGreaterThan(-1);
    expect(pageRoute.indexOf("deleteDocumentPage(")).toBeLessThan(
      pageRoute.indexOf("deleteFile("),
    );
    expect(pageRoute).toContain("console.error");

    // …and deleteFile itself must not throw, or the order above cannot help.
    const storage = functionBody(read("lib", "storage", "index.ts"), "deleteFile");
    expect(storage).not.toMatch(/throw\b/);
  });
});

describe("deleting a lookup value really removes the row", () => {
  it("every branch of deleteValue is a db.delete", () => {
    // This is the half of the create → delete → create round trip that
    // hard-delete-key-reuse.test.ts cannot assert: that Set it deletes from
    // only models the table if the delete really empties it. Without this,
    // restoring `.set({ deletedAt: NOW })` in deleteValue leaves every test in
    // both files green — which is exactly what an adversarial round found,
    // because the sibling's header CLAIMED this assertion existed and it did
    // not.
    const body = functionBody(read("lib", "admin", "value-lists", "queries.ts"), "deleteValue");
    // `code()` empties string BODIES, so the nine ListKey labels read as
    // `case "":` here. Counting them is still the point — one branch per list,
    // and one delete per branch, so a tenth list added without a delete fails.
    const branches = body.match(/case\s+""\s*:/g) ?? [];
    expect(branches.length).toBe(9);
    expect((body.match(/db\.delete\(/g) ?? []).length).toBe(9);
    expect(body).not.toMatch(/\.update\s*\(/);
    expect(body).not.toMatch(/\.set\s*\(/);
  });

  it("so does every other reference-data delete", () => {
    // Scoped to the delete function, not the file: both modules also have a
    // rename, and a rename is an `update().set()` that must stay.
    for (const [file, fn] of [
      [["lib", "admin", "document-document-roles", "queries.ts"], "deleteDocumentDocumentRole"],
      [["lib", "admin", "property-property-roles", "queries.ts"], "deletePropertyPropertyRole"],
    ] as const) {
      const body = functionBody(read(...file), fn);
      expect(body).toMatch(/\.delete\(/);
      expect(body).not.toMatch(/\.set\s*\(/);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Codes are never reissued
// ---------------------------------------------------------------------------

describe("a deleted entity code is never handed out again", () => {
  const allocationSites: Array<[string, string[]]> = [
    ["natural person",  ["lib", "persons", "queries.ts"]],
    ["judicial person", ["lib", "judicial-persons", "queries.ts"]],
    ["property",        ["lib", "properties", "queries.ts"]],
    ["document",        ["lib", "documents", "queries.ts"]],
  ];

  it.each(allocationSites)("%s draws its code from the shared sequence", (_label, file) => {
    // nextval() does not roll back — not on DELETE, not on ROLLBACK — so a
    // deleted code is simply skipped. That is the whole mechanism, and it
    // works by this code doing nothing special.
    expect(read(...file)).toContain("nextval('principal_object_code_seq')");
  });

  it("nothing computes a code from the rows that exist", () => {
    // A max()+1 or count()+1 counter WOULD reuse a deleted code, silently,
    // the first time anyone deleted the highest-numbered row.
    // Stripped, so a comment WARNING against `max(code) + 1` does not fail the
    // build — the first version ran on raw source and would have. Widened to
    // the shapes an adversarial round found it missing: a subquery, a
    // SUBSTRING cast, a count-based code, and the JavaScript equivalent.
    const offenders = allSourceFiles().filter((p) => {
      const body = code(fs.readFileSync(p, "utf8"));
      return /(max|count)\s*\([^;]{0,120}code/i.test(body)
          && /(\+\s*1|\+\s*1\s*\))/.test(body);
    });
    expect(offenders.map((p) => path.relative(SRC, p))).toEqual([]);
  });

  it("no migration rewinds a code sequence", () => {
    // The one exception is seed_dev_data.sql, and it is not an exception to
    // the rule so much as outside it: that script DROPs and re-creates the
    // whole dataset, so there are no issued codes left to collide with. A
    // MIGRATION runs against a database that is still in use, and rewinding
    // the sequence there would hand PPERS00112 to a second person.
    // The pattern allows for `IF EXISTS` and for schema qualification, both
    // of which defeated the first version: src/db/migration_020's
    // `ALTER SEQUENCE IF EXISTS principal_object_code_seq RESTART WITH 1` sat
    // in the tree unseen, and pg_dump always writes `public.<name>`. All three
    // code sequences count — groups and stamps carry entity codes too, and
    // this slice is what made them hard-deletable.
    const SEQS = "(principal_object|group|stamp)_code_seq";
    const RESTART = new RegExp(
      `ALTER\\s+SEQUENCE\\s+(IF\\s+EXISTS\\s+)?("?[\\w]+"?\\.)?"?${SEQS}"?\\s+RESTART`, "i");
    const SETVAL = new RegExp(`setval\\s*\\(\\s*'([\\w]+\\.)?${SEQS}`, "i");

    const dbDir = path.join(SRC, "db");
    const offenders = fs
      .readdirSync(dbDir)
      .filter((f) => f.startsWith("migration_") && f.endsWith(".sql"))
      // Migrations numbered below 070 are history: they have already run on
      // every database, and migration_020 and migration_061 both legitimately
      // reset a sequence at a point where the rows had just been wiped. The
      // rule this test enforces is forward-looking — no migration from here on
      // may rewind a code sequence — so it is scoped to exactly that.
      .filter((f) => {
        const num = Number(f.slice("migration_".length, "migration_".length + 3));
        return Number.isFinite(num) && num >= 70;
      })
      .filter((f) => {
        const body = sqlCode(fs.readFileSync(path.join(dbDir, f), "utf8"));
        return RESTART.test(body) || SETVAL.test(body);
      });
    expect(offenders).toEqual([]);
  });

  it("migration_070 touches no sequence at all", () => {
    // Belt and braces on the sentence the slice is most likely to be
    // "helpfully" contradicted on: preserving the numbering needs no
    // machinery, so adding any would be the bug.
    // Comments stripped: the migration's own header says at length that it
    // must never contain an ALTER SEQUENCE, and a guard that forbade saying
    // so would delete the explanation to satisfy itself.
    const migration = sqlCode(fs.readFileSync(
      path.join(SRC, "db", "migration_070_drop_soft_delete.sql"),
      "utf8",
    ));
    expect(migration).not.toMatch(/ALTER\s+SEQUENCE/i);
    expect(migration).not.toMatch(/setval\s*\(/i);
  });
});

// ---------------------------------------------------------------------------
// 5. The cascade that replaced releaseCornerSourceForProperty
// ---------------------------------------------------------------------------

describe("the corner-source claim is freed by the database now", () => {
  it("property_corner_source cascades from property IN THE DATABASE", () => {
    // This became load-bearing the moment the explicit release was deleted:
    // it is what frees a source document when its Property goes. Drop it and
    // a coordinate file is spent forever.
    //
    // Asserted against supabase_schema_full.sql, not only the Drizzle
    // annotation. Drizzle's `onDelete` is a TypeScript literal with no runtime
    // effect on an existing database: a migration_071 doing
    // `DROP CONSTRAINT … ADD … ON DELETE SET NULL` would leave schema/index.ts
    // untouched and this guard green while the thing it protects was dead.
    const dump = fs.readFileSync(
      path.join(SRC, "db", "supabase_schema_full.sql"),
      "utf8",
    );
    expect(dump).toMatch(
      /property_corner_source[\s\S]{0,400}?FOREIGN KEY \(property_id\)[\s\S]{0,200}?ON DELETE CASCADE/,
    );
    // …and the declaration agrees, so the two cannot silently diverge.
    const schema = read("db", "schema", "index.ts");
    const start  = schema.indexOf("export const propertyCornerSource");
    expect(start).toBeGreaterThan(-1);
    expect(schema.slice(start, start + 2000)).toMatch(
      /propertyId[\s\S]*?references\(\(\)\s*=>\s*property\.id,\s*\{\s*onDelete:\s*"cascade"\s*\}\)/,
    );
  });

  it("the explicit release helper is gone, and nothing calls it", () => {
    const offenders = allSourceFiles().filter((p) =>
      /releaseCornerSourceForProperty\s*\(/.test(code(fs.readFileSync(p, "utf8"))),
    );
    expect(offenders.map((p) => path.relative(SRC, p))).toEqual([]);
  });

  it("releaseCornerSourceLink survives — it is a different thing", () => {
    // The Process route's compensating rollback for a pair it created itself,
    // on a path where no Property is being deleted at all.
    expect(read("lib", "properties", "corner-source.ts"))
      .toContain("export async function releaseCornerSourceLink");
  });
});

// ---------------------------------------------------------------------------
// helper
// ---------------------------------------------------------------------------

/**
 * The CODE of one top-level `export async function <name>`, comments and
 * string bodies removed.
 *
 * The stripping is not cosmetic — it is what stops every assertion below from
 * being satisfiable by a comment. An adversarial round built a deliberately
 * wrong `deleteDocuments` (file paths read AFTER the transaction, so always
 * empty; `r.id` passed where `r.principalObjectId` was meant) that passed all
 * nine assertions in sections 2 and 3, purely because a comment inside the
 * body mentioned the right identifiers in the right order.
 *
 * Anchored on a line start, so `export async function` inside a string or a
 * doc comment cannot be the match.
 */
function functionBody(source: string, name: string): string {
  const stripped = code(source);
  const re = new RegExp(`^export async function ${name}\\(`, "m");
  const m = re.exec(stripped);
  if (!m) throw new Error(`${name} not found as a top-level export`);
  const rest = stripped.slice(m.index + 1);
  const end  = rest.search(/^export /m);
  return end === -1 ? rest : rest.slice(0, end);
}
