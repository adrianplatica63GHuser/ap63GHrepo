/**
 * Institutions become juridical persons — the migration, the rebuild and the readers agree. (Slice #39.71)
 *
 * migration_115 gives every lookup_institution row a juridical person of a public-body type and every document an
 * issuer_person_id filled from its institution_id; three triggers keep the pair in step until 39.72 retires the list.
 * A rebuilt database gets the same rows another way — sync-reference-data.sql inserts the types, then the
 * institutions, and the AFTER INSERT trigger makes the persons — so the files are held together here, and
 * verify-rebuild compares the rows.
 *
 * Also pinned: the three places a juridical person made by an institution would otherwise be mistaken for something
 * else — the Supabase sync (which must not copy a local person id), the seed's judicial-persons gate (which must not
 * count them), and the Documents list (which reads the issuer's name from the person, not from the value list).
 */
import fs from "fs";
import path from "path";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const migration = read("src", "db", "migration_115_institutions_as_juridical_persons.sql");
const sync = read("src", "db", "sync-reference-data.sql");
const schema = read("src", "db", "schema", "index.ts");
const repair = read("src", "db", "supabase_repair_missing_tables.sql");
const supabaseSync = read("scripts", "supabase-sync.ts");
const seed = read("src", "db", "seed.ts");
const documents = read("src", "lib", "documents", "queries.ts");

const PUBLIC_BODY_TYPES = [
  "Autoritate publică centrală",
  "Instituție publică teritorială",
  "Autoritate locală",
  "Instanță",
  "Birou notarial",
  "Birou de executor judecătoresc",
  "Cabinet sau societate de avocatură",
];

describe("the seven public-body types", () => {
  it("are added by the migration, in this order, after the company forms", () => {
    const list = migration.match(/names text\[\] := ARRAY\[([\s\S]*?)\];/);
    expect(list).not.toBeNull();
    const names = [...list![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(names).toEqual(PUBLIC_BODY_TYPES);
    expect(migration).toContain("VALUES (names[i], 20 + i)");
    expect(migration).toMatch(/SET sort_order = 100[^;]*'altele'/);
  });

  it.each(PUBLIC_BODY_TYPES.map((t, i) => [t, 21 + i] as const))(
    "are seeded by the rebuild: „%s” at %i",
    (name, sort) => {
      expect(sync).toMatch(new RegExp(`\\('${name}',\\s*${sort}\\)`));
    },
  );

  it("„Altele” stays last, at 100, in the rebuild too", () => {
    expect(sync).toMatch(/\('Altele', 100\)/);
    expect(sync).not.toMatch(/\('Altele', 8\)/);
  });

  it("are seeded before the institutions, whose trigger reads them", () => {
    expect(sync.indexOf("INSERT INTO lookup_judicial_person_type")).toBeGreaterThan(-1);
    expect(sync.indexOf("INSERT INTO lookup_judicial_person_type")).toBeLessThan(
      sync.indexOf("INSERT INTO lookup_institution"),
    );
  });
});

describe("an institution's juridical person", () => {
  it("is made by one function, with a JPERS code from the shared sequence and version 0", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION ga40_institution_juridical_person(inst_id uuid)");
    expect(migration).toContain("'JPERS' || lpad(nextval('principal_object_code_seq')::text, 5, '0')");
    expect(migration).toMatch(/INSERT INTO person_version \(person_id, version_number, snapshot\)\s*VALUES \(p_id, 0,/);
    // the generic rows keep their names and say so
    expect(migration).toContain("'generic — de înlocuit cu instituția exactă'");
    for (const g of ["notariat", "judecatorie", "tribunal"]) expect(migration).toContain(`'${g}'`);
    // origin IMPORT → the provenance an import gives
    expect(migration).toContain("WHEN inst.origin = 'IMPORT' THEN 'AI_INTERPRETED' ELSE 'MANUAL'");
  });

  it("is kept in step by three triggers until 39.72", () => {
    expect(migration).toMatch(/CREATE TRIGGER lookup_institution_juridical_person_added AFTER INSERT ON lookup_institution/);
    expect(migration).toMatch(/CREATE TRIGGER lookup_institution_juridical_person_renamed AFTER UPDATE OF name ON lookup_institution/);
    expect(migration).toMatch(
      /CREATE TRIGGER document_issuer_from_institution BEFORE INSERT OR UPDATE OF institution_id ON document/,
    );
  });

  it("fills every document's issuer without moving its updated_at", () => {
    expect(migration).toMatch(/UPDATE document d SET issuer_person_id = li\.juridical_person_id/);
    expect(migration).toContain("tgfoid = 'touch_updated_at'::regproc");
    expect(migration).toContain("DISABLE TRIGGER");
    expect(migration).toContain("ENABLE TRIGGER");
  });
});

describe("the two links", () => {
  it("are declared by the schema, both SET NULL when the person goes", () => {
    expect(schema).toMatch(
      /juridicalPersonId: uuid\("juridical_person_id"\)\.references\(\(\) => person\.id, \{ onDelete: "set null" \}\)/,
    );
    expect(schema).toMatch(
      /issuerPersonId: uuid\("issuer_person_id"\)\.references\(\(\) => person\.id, \{ onDelete: "set null" \}\)/,
    );
    expect(schema).toContain('uniqueIndex("lookup_institution_juridical_person_unique")');
    expect(schema).toContain('index("document_issuer_person_idx")');
  });

  it("are made the same way by the migration and the repair file", () => {
    for (const sql of [migration, repair]) {
      expect(sql).toMatch(
        /ALTER TABLE lookup_institution\s+ADD COLUMN IF NOT EXISTS juridical_person_id uuid REFERENCES person\(id\) ON DELETE SET NULL/,
      );
      expect(sql).toMatch(
        /ALTER TABLE document\s+ADD COLUMN IF NOT EXISTS issuer_person_id uuid REFERENCES person\(id\) ON DELETE SET NULL/,
      );
      expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS lookup_institution_juridical_person_unique\s+ON lookup_institution \(juridical_person_id\)/);
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS document_issuer_person_idx ON document \(issuer_person_id\)/);
    }
  });

  it("the repair file does not carry a second copy of the function", () => {
    expect(repair).not.toContain("ga40_institution_juridical_person(");
  });
});

describe("the places an institution's person must not be mistaken for something else", () => {
  it("the Supabase sync leaves juridical_person_id to the target's own trigger", () => {
    expect(supabaseSync).toMatch(/TARGET_FILLED_COLUMNS[^=]*=\s*\{\s*lookup_institution: new Set\(\["juridical_person_id"\]\)/);
    // and the filter runs before the foreign-key refusal
    const filter = supabaseSync.indexOf("TARGET_FILLED_COLUMNS[table]");
    const fkCheck = supabaseSync.indexOf("constraint_type = 'FOREIGN KEY'");
    expect(filter).toBeGreaterThan(-1);
    expect(filter).toBeLessThan(fkCheck);
  });

  it("the seed counts only the juridical persons no institution made", () => {
    expect(seed).toMatch(
      /from judicial_person jp\s+where not exists \(\s*select 1 from lookup_institution li where li\.juridical_person_id = jp\.person_id/,
    );
  });

  it("the Documents list reads the issuer's name from the person", () => {
    expect(documents).toContain('const issuerPerson = alias(person, "issuer_person");');
    expect(documents).toMatch(/institutionName:\s*issuerPerson\.displayName/);
    expect(documents).toMatch(/leftJoin\(issuerPerson, eq\(document\.issuerPersonId, issuerPerson\.id\)\)/);
    expect(documents).not.toMatch(/institutionName:\s*lookupInstitution\.name/);
  });
});
