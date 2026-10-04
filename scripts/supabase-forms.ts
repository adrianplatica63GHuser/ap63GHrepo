/**
 * Supabase's document-type forms against the forms file.        (Slice #37.74)
 *
 *   npm run supabase:forms -- check [TYPE_KEY]
 *       READ ONLY. One FORMS line comparing Supabase's forms with
 *       src/db/document-type-forms.json — the same line `full` prints for the
 *       local database — and, with a type key, that type's documents and, per
 *       key of its form on Supabase, how many hold a value. Counts only.
 *
 *   npm run supabase:forms -- clear TYPE_KEY
 *       Sets that type's form to NULL on Supabase, in one transaction, and
 *       prints the FORMS line after. Refused unless the forms file holds no
 *       form for the type (local is the source of truth). Nothing in
 *       `document` is read for values or written: a document's custom_fields
 *       stay exactly as they are.
 *
 * Connects with SUPABASE_SYNC_URL from .env (the npm script loads it), as
 * `supabase:migrate` does. Prints the host and database only — never the
 * connection string, which carries the password.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

import { FORMS_FILE_REL, formsDrift, formsDriftLine, parseFormsFile, type StoredForm } from "../src/lib/documents/document-type-forms-file";
import {
  CLEAR_FORM_SQL,
  FORMS_SQL,
  KEY_COUNTS_SQL,
  TYPE_COUNTS_SQL,
  TYPE_KEY_PATTERN,
  clearRefusal,
  formKeys,
} from "../src/lib/documents/forms-on-supabase";

const [command, typeKey] = process.argv.slice(2);
const URL_ENV = process.env.SUPABASE_SYNC_URL;

function stop(message: string): never {
  console.error(`\n❌  ${message}`);
  process.exit(1);
}

if (command !== "check" && command !== "clear") stop("Say `check [TYPE_KEY]` or `clear TYPE_KEY`.");
if (command === "clear" && !typeKey) stop("`clear` needs a type key, e.g. clear ANTECONTRACT.");
if (typeKey && !TYPE_KEY_PATTERN.test(typeKey)) stop(`„${typeKey}" is not a document-type key.`);
if (!URL_ENV) stop("SUPABASE_SYNC_URL is not set in .env.");

const file = parseFormsFile(fs.readFileSync(path.resolve(process.cwd(), ...FORMS_FILE_REL.split("/")), "utf8"));

function target(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(unparseable SUPABASE_SYNC_URL)";
  }
}

async function formsLine(client: Client): Promise<string> {
  const rows = (await client.query<{ key: string; fields: unknown }>(FORMS_SQL)).rows;
  const database: StoredForm[] = rows.map((r) => ({ key: r.key, fields: Array.isArray(r.fields) ? r.fields : [] })) as StoredForm[];
  return `FORMS (Supabase): ${formsDriftLine(formsDrift(file.forms, database), file.forms.length)}`;
}

async function counts(client: Client, key: string): Promise<void> {
  const form = (await client.query<{ fields: unknown }>("SELECT template_fields AS fields FROM lookup_document_type WHERE key = $1", [key])).rows;
  if (form.length === 0) {
    console.log(`${key}: no such document type on Supabase`);
    return;
  }
  const keys = formKeys(form[0].fields);
  const documents = (await client.query<{ documents: number }>(TYPE_COUNTS_SQL, [key])).rows[0]?.documents ?? 0;
  console.log(`${key}: ${documents} document(s); its form on Supabase has ${keys.length} field(s)`);
  if (keys.length > 0) {
    for (const r of (await client.query<{ key: string; filled: number }>(KEY_COUNTS_SQL, [key, keys])).rows) {
      console.log(`  ${r.key}: ${r.filled} document(s) hold a value`);
    }
  }
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: URL_ENV, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Supabase: ${target(URL_ENV!)}`);
  try {
    if (command === "check") {
      await client.query("BEGIN READ ONLY");
      if (typeKey) await counts(client, typeKey);
      console.log(await formsLine(client));
      await client.query("ROLLBACK");
      return;
    }
    const refusal = clearRefusal(typeKey!, file.forms);
    if (refusal) stop(`Not cleared: ${refusal}.`);
    await client.query("BEGIN");
    await counts(client, typeKey!);
    const cleared = await client.query(CLEAR_FORM_SQL, [typeKey]);
    await client.query("COMMIT");
    console.log(cleared.rowCount === 1 ? `${typeKey}: form cleared (template_fields = NULL); no document was touched` : `${typeKey}: had no form; nothing changed`);
    console.log(await formsLine(client));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    stop(err instanceof Error ? err.message : String(err));
  } finally {
    await client.end();
  }
}

void main();
