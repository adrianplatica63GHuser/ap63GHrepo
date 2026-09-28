/**
 * How long the values in the local archive really are.   (Slice #37.12)
 *
 *   npx tsx scripts/testing/measure-field-lengths.ts
 *
 * Normally run by the test runner's `measure-fields` sequence
 * (`bash scripts/test-runner/claude.sh request measure-fields`). Prints, for
 * every free-text column a field on the person, property or document screens
 * shows: how many rows hold a value, the longest, the 95th percentile, how many
 * rows are longer than each step of the scale holds, and the longest value
 * MASKED; for every dropdown, its longest option; for every document type's
 * template field, the same. The SQL and the masking are
 * `src/lib/ui/field-measure.ts`, which says why no real value leaves Postgres.
 *
 * ⚠️ **READ-ONLY.** Three SELECTs through `docker exec … psql` against
 * `ga40prj-postgres` / `ga40db`, in a session started with
 * `PGOPTIONS=-c default_transaction_read_only=on` — the same way
 * `scripts/testing/reconcile-import.ts` reaches it. No connection string is
 * read; Supabase and UAT are never reached.
 *
 * Exit: 0 measured · 2 could not run. The last line is `MEASURE: …`.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  buildColumnSql,
  buildLookupSql,
  buildTemplateSql,
  formatReport,
  type ColumnStats,
  type LookupStats,
  type LookupTarget,
  type MeasureTarget,
  type TemplateStats,
} from "@/lib/ui/field-measure";

const CONTAINER = "ga40prj-postgres";
const REPO = path.resolve(__dirname, "..", "..");

const NATURAL = "person_id IN (SELECT id FROM person WHERE type = 'NATURAL')";
const JUDICIAL = "person_id IN (SELECT id FROM person WHERE type = 'JUDICIAL')";

/** Every free-text column a field on the three detail screens shows. */
const COLUMNS: MeasureTarget[] = [
  // Natural person
  { screen: "NP", field: "lastName", table: "natural_person", column: "last_name" },
  { screen: "NP", field: "firstName", table: "natural_person", column: "first_name" },
  { screen: "NP", field: "nickname", table: "natural_person", column: "nickname" },
  { screen: "NP", field: "cnp", table: "natural_person", column: "cnp" },
  { screen: "NP", field: "placeOfBirth", table: "natural_person", column: "place_of_birth" },
  { screen: "NP", field: "idDocumentNumber", table: "natural_person", column: "id_document_number" },
  { screen: "NP", field: "idCardNumber", table: "natural_person", column: "id_card_number" },
  { screen: "NP", field: "idIssuingAuthority", table: "natural_person", column: "id_issuing_authority" },
  { screen: "NP", field: "idMrzRaw", table: "natural_person", column: "id_mrz_raw" },
  { screen: "NP", field: "personalPhone1", table: "natural_person", column: "personal_phone_1" },
  { screen: "NP", field: "personalPhone2", table: "natural_person", column: "personal_phone_2" },
  { screen: "NP", field: "workPhone", table: "natural_person", column: "work_phone" },
  { screen: "NP", field: "personalEmail1", table: "natural_person", column: "personal_email_1" },
  { screen: "NP", field: "personalEmail2", table: "natural_person", column: "personal_email_2" },
  { screen: "NP", field: "workEmail", table: "natural_person", column: "work_email" },
  { screen: "NP", field: "notes", table: "person", column: "notes", where: "type = 'NATURAL'" },
  // The address block, persons (both kinds) and properties together
  { screen: "ADDR", field: "streetLine", table: "address", column: "street_line" },
  { screen: "ADDR", field: "postalCode", table: "address", column: "postal_code" },
  { screen: "ADDR", field: "locality", table: "address", column: "locality" },
  { screen: "ADDR", field: "county", table: "address", column: "county" },
  { screen: "ADDR", field: "country", table: "address", column: "country" },
  { screen: "ADDR", field: "notes", table: "address", column: "notes" },
  { screen: "ADDR", field: "streetLine.NP", table: "address", column: "street_line", where: NATURAL },
  { screen: "ADDR", field: "streetLine.JP", table: "address", column: "street_line", where: JUDICIAL },
  { screen: "ADDR", field: "propertyStreetLine", table: "property_address", column: "street_line" },
  { screen: "ADDR", field: "propertyPostalCode", table: "property_address", column: "postal_code" },
  { screen: "ADDR", field: "propertyLocality", table: "property_address", column: "locality" },
  { screen: "ADDR", field: "propertyCounty", table: "property_address", column: "county" },
  { screen: "ADDR", field: "propertyCountry", table: "property_address", column: "country" },
  { screen: "ADDR", field: "propertyNotes", table: "property_address", column: "notes" },
  // Judicial person
  { screen: "JP", field: "name", table: "judicial_person", column: "name" },
  { screen: "JP", field: "nickname", table: "judicial_person", column: "nickname" },
  { screen: "JP", field: "cuiNumber", table: "judicial_person", column: "cui_number" },
  { screen: "JP", field: "tradeRegisterNumber", table: "judicial_person", column: "trade_register_number" },
  { screen: "JP", field: "notes", table: "person", column: "notes", where: "type = 'JUDICIAL'" },
  // What a chosen contact person shows: a natural person's display name (#37.13)
  { screen: "JP", field: "contactPersonName", table: "person", column: "display_name", where: "type = 'NATURAL'" },
  // Property
  { screen: "PROP", field: "nickname", table: "property", column: "nickname" },
  { screen: "PROP", field: "parcela", table: "property", column: "parcela" },
  { screen: "PROP", field: "cadastralNumber", table: "property", column: "cadastral_number" },
  { screen: "PROP", field: "carteFunciara", table: "property", column: "carte_funciara" },
  { screen: "PROP", field: "surfaceAreaMp", table: "property", column: "surface_area_mp" },
  { screen: "PROP", field: "calculatedAreaMp", table: "property", column: "calculated_area_mp" },
  { screen: "PROP", field: "notes", table: "property", column: "notes" },
  // A corner's point label, „Nr. orig." (#37.14). X and Y are worked out from
  // lat/lon by the convert API, not stored — the e2e check measures those cells.
  { screen: "PROP", field: "cornerOriginalIndex", table: "property_corner", column: "original_index" },
  // Document — the general fields
  { screen: "DOC", field: "title", table: "document", column: "title" },
  { screen: "DOC", field: "nrDocument", table: "document", column: "nr_document" },
  { screen: "DOC", field: "emitent", table: "document", column: "emitent" },
  { screen: "DOC", field: "subject", table: "document", column: "subject" },
  { screen: "DOC", field: "notes", table: "document", column: "notes" },
  { screen: "DOC", field: "bazaLegala", table: "document", column: "baza_legala" },
  { screen: "DOC", field: "suprafata", table: "document", column: "suprafata" },
];

/** Every dropdown whose options live in a lookup table. */
const LOOKUPS: LookupTarget[] = [
  { screen: "NP", field: "physicalPersonTypeId", table: "lookup_person_type", column: "name" },
  { screen: "NP", field: "citizenshipId", table: "lookup_citizenship", column: "name" },
  { screen: "JP", field: "judicialPersonTypeId", table: "lookup_judicial_person_type", column: "name" },
  { screen: "PROP", field: "propertyTypeId", table: "lookup_property_type", column: "name" },
  { screen: "PROP", field: "useCategoryId", table: "lookup_use_category", column: "name" },
  { screen: "PROP", field: "tarlaId", table: "lookup_tarla", column: "indicativ" },
  { screen: "PROP", field: "tarlaId.descriere", table: "lookup_tarla", column: "descriere" },
  { screen: "DOC", field: "documentTypeId", table: "lookup_document_type", column: "name" },
  { screen: "DOC", field: "institutionId", table: "lookup_institution", column: "name" },
];

function fail(message: string): never {
  console.error(`measure-field-lengths: ${message}`);
  console.log(`MEASURE: could not run — ${message}`);
  process.exit(2);
}

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

function query<T>(sql: string): T {
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
    { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true },
  );
  if (r.error) fail(`could not start docker: ${r.error.message}`);
  if (r.status !== 0) fail(`psql exited ${r.status}: ${(r.stderr || "").trim().split(/\r?\n/).slice(-3).join(" | ")}`);
  try {
    return JSON.parse((r.stdout || "").trim()) as T;
  } catch (e) {
    fail(`the answer was not JSON: ${(e as Error).message}`);
  }
}

const columns = query<Record<string, ColumnStats>>(buildColumnSql(COLUMNS));
const lookups = query<Record<string, LookupStats>>(buildLookupSql(LOOKUPS));
const templates = query<TemplateStats[]>(buildTemplateSql());
for (const line of formatReport(columns, lookups, templates)) console.log(line);
console.log(
  `MEASURE: ${Object.keys(columns).length} columns, ${Object.keys(lookups).length} dropdowns, ${templates.length} template fields measured, read-only; the table is this step's log`,
);
