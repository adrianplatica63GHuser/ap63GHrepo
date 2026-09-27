/**
 * The document-type forms file, and the database it comes from.   (Slice #37.05, FU-019)
 *
 *   npx tsx scripts/document-type-forms.ts export   write src/db/document-type-forms.json
 *                                                   from the local database
 *   npx tsx scripts/document-type-forms.ts check    one line: does the database still
 *                                                   match the file? (the runner's
 *                                                   `forms-drift` step in `full`)
 *   npx tsx scripts/document-type-forms.ts sql [out] print the file as SQL (or write it to out), for a rebuild:
 *                                                   ... sql | docker exec -i ga40prj-postgres psql -U postgres -d ga40db -v ON_ERROR_STOP=1
 *
 * `export` and `check` are normally run by the test runner
 * (`claude.sh request forms-export`, and every `full`). The format, the SQL and
 * the drift rules are in `src/lib/documents/document-type-forms-file.ts`; this
 * file does the I/O.
 *
 * ⚠️ **THE DATABASE IS READ, NEVER WRITTEN.** One SELECT, in a psql session
 * started with `PGOPTIONS=-c default_transaction_read_only=on`, so even a
 * writing statement would be refused by Postgres — the same way
 * `scripts/testing/reconcile-import.ts` reaches it: `docker exec … psql`
 * against `ga40prj-postgres` / `ga40db` as `postgres`, with `POSTGRES_DB` and
 * `POSTGRES_USER` from `.env` overriding the last two and nothing else read
 * from it. No connection string, no password, no secret is read or printed, and
 * Supabase and UAT are never reached. `sql` touches no database at all.
 *
 * Output: the last line of `export` and `check` starts `FORMS:` and carries
 * counts and type keys only — never a form's content.
 * Exit: 0 it ran (for `check`, drift or not — drift is a line, not a red) ·
 * 2 it could not run.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  FORMS_FILE_REL,
  formsDrift,
  formsDriftLine,
  formsFileToSql,
  parseFormsFile,
  serializeFormsFile,
  type StoredForm,
} from "../src/lib/documents/document-type-forms-file";

const CONTAINER = "ga40prj-postgres";
const REPO = path.resolve(__dirname, "..");
const FILE = path.join(REPO, ...FORMS_FILE_REL.split("/"));

function fail(message: string): never {
  console.error(`document-type-forms: ${message}`);
  console.log(`FORMS: could not run — ${message}`);
  process.exit(2);
}

/** `POSTGRES_DB` / `POSTGRES_USER` from `.env` — those two keys and nothing else. */
function databaseNames(): { database: string; user: string } {
  const out = { database: "ga40db", user: "postgres" };
  const envFile = path.join(REPO, ".env");
  if (!fs.existsSync(envFile)) return out;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*(POSTGRES_DB|POSTGRES_USER)\s*=\s*"?([^"#\s]+)"?/.exec(line);
    if (!m) continue;
    if (m[1] === "POSTGRES_DB") out.database = m[2];
    else out.user = m[2];
  }
  return out;
}

/** SELECT only. `json_build_object` keeps jsonb's own key order, which is what makes the export faithful. */
const FORMS_QUERY =
  "SELECT coalesce(json_agg(json_build_object('key', key, 'fields', template_fields) ORDER BY key), '[]'::json) " +
  "FROM lookup_document_type WHERE template_fields IS NOT NULL";

function databaseForms(): { forms: StoredForm[]; notArrays: string[] } {
  const { database, user } = databaseNames();
  const r = spawnSync(
    "docker",
    [
      "exec", "-i",
      "-e", "PGOPTIONS=-c default_transaction_read_only=on",
      "-e", "PGCLIENTENCODING=UTF8",
      CONTAINER,
      "psql", "-U", user, "-d", database, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1",
    ],
    { input: FORMS_QUERY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true },
  );
  if (r.error) fail(`could not start docker: ${r.error.message}`);
  if (r.status !== 0) fail(`psql exited ${r.status}: ${(r.stderr || "").trim().split(/\r?\n/).slice(-3).join(" | ")}`);
  let rows: { key: unknown; fields: unknown }[];
  try {
    rows = JSON.parse((r.stdout || "").trim() || "[]");
  } catch (e) {
    fail(`the query's answer was not JSON: ${(e as Error).message}`);
  }
  const forms: StoredForm[] = [];
  const notArrays: string[] = [];
  for (const row of rows) {
    if (typeof row.key !== "string" || row.key === "") fail("a document type with a form has no key");
    // A jsonb `null` (not SQL NULL) is no form, and so is anything that is not
    // an array: parseTemplateFields reads both as []. Named, not carried.
    if (!Array.isArray(row.fields)) notArrays.push(row.key);
    else forms.push({ key: row.key, fields: row.fields });
  }
  return { forms, notArrays };
}

function readFile(): StoredForm[] {
  if (!fs.existsSync(FILE)) return [];
  try {
    return parseFormsFile(fs.readFileSync(FILE, "utf8")).forms;
  } catch (e) {
    fail((e as Error).message);
  }
}

function main(): void {
  const mode = process.argv[2];
  if (mode === "sql") {
    if (!fs.existsSync(FILE)) fail(`${FORMS_FILE_REL} does not exist`);
    const sql = formsFileToSql(parseFormsFile(fs.readFileSync(FILE, "utf8")));
    // An output path, for a caller that cannot read UTF-8 off a pipe
    // (build-ciprian-image.ps1: Windows PowerShell decodes native output in the
    // console code page). Otherwise stdout, for `| docker exec -i … psql`.
    const out = process.argv[3];
    if (out) fs.writeFileSync(out, sql, "utf8");
    else process.stdout.write(sql);
    return;
  }
  if (mode === "export") {
    const before = readFile();
    const { forms, notArrays } = databaseForms();
    const text = serializeFormsFile(forms);
    const old = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : null;
    const drift = formsDrift(before, forms);
    const fields = forms.reduce((n, f) => n + f.fields.length, 0);
    if (old !== text) fs.writeFileSync(FILE, text, "utf8");
    const changed = drift.changed.length + drift.onlyInDatabase.length + drift.onlyInFile.length;
    console.log(
      `FORMS: exported ${forms.length} form(s), ${fields} field(s), to ${FORMS_FILE_REL}` +
        (old === null ? " (new file)" : old === text ? " (unchanged)" : ` (${changed} type(s) differ from the previous file)`) +
        (notArrays.length ? `; not a form, skipped: ${notArrays.join(", ")}` : ""),
    );
    return;
  }
  if (mode === "check") {
    if (!fs.existsSync(FILE)) {
      console.log(`FORMS: ${FORMS_FILE_REL} does not exist yet — request forms-export`);
      return;
    }
    const file = readFile();
    const { forms } = databaseForms();
    console.log(`FORMS: ${formsDriftLine(formsDrift(file, forms), file.length)}`);
    return;
  }
  fail("usage: npx tsx scripts/document-type-forms.ts export|check|sql");
}

main();
