/**
 * Every table and column of the archive, and whether `npm run seed:dev` writes it.                (Slice #39.81)
 *
 *   List:  node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-dev-data-big/columns.ts
 *
 * PURE — the map, its reading and the SQL that checks it; the list above prints it. Each column is one of:
 *   - "seed"          the big seed writes it, and the run proves it: at least one of the seed's own rows holds a value
 *                     (seed.ts runs `columnChecks` over the rows the manifest names, after the run);
 *   - "seed-true"     a yes/no the seed sets — proved by one of its rows saying yes (a false is the default);
 *   - "seed-nonzero"  a number the seed sets — proved by one of its rows not holding the default 0;
 *   - "app"           written by the app's own function as the seed calls it — a code, a version, a calculated area;
 *   - "interactions"  written by the interactions seed, which proves its own (scripts/seed-dev-data-interactions);
 *   - "reference"     Reference Data the seed reads, and adds to only where a row it needs is missing;
 *   - { not }         left empty, and why.
 * A table that is not archive data at all — accounts, settings, money, quiz history — is `{ never }`: the seed must
 * not write it, and the runner's rehearsal would see it if it did.
 *
 * `src/__tests__/seed-dev-columns.test.ts` holds this map to the schema: a table or column added to
 * src/db/schema/index.ts and not named here fails it, so the next field the archive gains is a decision for the seed
 * to make, not a gap found a year later. `id`, `created_at` and `updated_at` are the app's on every table and are
 * not listed.
 */

export type Fill = "seed" | "seed-true" | "seed-nonzero" | "app" | "interactions" | "reference" | { not: string };

/** Which of the seed's rows a table's check reads: the rows whose `column` is one of the seed's ids of that set. */
export type ScopeSet = "persons" | "natural" | "judicial" | "properties" | "documents" | "pos" | "tarlas" | "runs" | "groups" | "stamps" | "metadata";

export type TableFill =
  | { never: string }
  | { scope: { column: string; set: ScopeSet } | null; columns: Record<string, Fill> };

const APP = "app" as const;
const S = "seed" as const;
const REF = "reference" as const;
const I = "interactions" as const;

/** The side-road runs the seed does not make. */
const NR: Fill = { not: "No side-road run (Adrian, 2026-10-18): the commit names each slice after its owner, and a property named like a person confused." };

const ACCOUNT = "Adrian's own operational state, not archive data — the seed never writes it.";

export const SEED_COLUMNS: Record<string, TableFill> = {
  principal_object: { scope: { column: "id", set: "pos" }, columns: { code: APP, object_type: APP } },
  person: { scope: { column: "id", set: "persons" }, columns: { principal_object_id: APP, code: APP, type: APP, display_name: APP, notes: S, updated_by: APP } },
  natural_person: {
    scope: { column: "person_id", set: "natural" },
    columns: {
      person_id: APP, first_name: S, last_name: S, nickname: S, cnp: S, gender: S,
      date_of_birth: S, is_deceased: "seed-true", date_of_death: S, personal_phone_1: S, personal_phone_2: S, work_phone: S,
      personal_email_1: S, personal_email_2: S, work_email: S, place_of_birth: S,
      citizenship_id: S, physical_person_type_id: S,
      correspondence_same_as_home: "seed-true",
    },
  },
  judicial_person: {
    scope: { column: "person_id", set: "judicial" },
    columns: {
      person_id: APP, name: S, nickname: S, judicial_person_type_id: S, cui_number: S, trade_register_number: S, phone: S, email: S,
      contact_person_1_id: S, contact_person_2_id: S, correspondence_same_as_hq: "seed-true",
    },
  },
  address: { scope: { column: "person_id", set: "persons" }, columns: { person_id: APP, kind: S, street_line: S, postal_code: S, locality: S, county: S, country: S, notes: S } },
  person_version: { scope: null, columns: { person_id: APP, version_number: APP, snapshot: APP, updated_by: APP } },
  property: {
    scope: { column: "id", set: "properties" },
    columns: {
      principal_object_id: APP, code: APP, property_type_id: S, nickname: S, tarla_id: S, parcela: S, cadastral_number: S, carte_funciara: S,
      use_category_id: S, surface_area_mp: S, calculated_area_mp: APP, corner_order_self_intersects: APP, notes: S, updated_by: APP,
    },
  },
  property_address: {
    scope: { column: "property_id", set: "properties" },
    columns: { property_id: APP, street_line: S, postal_code: S, locality: S, county: S, country: S, notes: S, street_view_street_line: S },
  },
  property_corner: { scope: { column: "property_id", set: "properties" }, columns: { property_id: APP, sequence_no: APP, lat: S, lon: S, original_index: S } },
  property_version: { scope: null, columns: { property_id: APP, version_number: APP, snapshot: APP, updated_by: APP } },
  lookup_property_type: { scope: null, columns: { name: REF, key: REF, show_tarla_parcela: REF, show_address: REF, show_street_view: REF, sort_order: REF } },
  lookup_tarla: { scope: { column: "id", set: "tarlas" }, columns: { indicativ: S, descriere: S, locality: S, county: S, notes: S, sort_order: APP, origin: APP } },
  tarla_corner: { scope: { column: "tarla_id", set: "tarlas" }, columns: { tarla_id: APP, sequence_no: APP, lat: S, lon: S, original_index: S } },
  tarla_parcel: { scope: { column: "tarla_id", set: "tarlas" }, columns: { tarla_id: APP, parcela: S, area_sqm: S, use_category_id: S, use_printed: S, source_document_id: S } },
  document_tarla: { scope: { column: "tarla_id", set: "tarlas" }, columns: { document_id: S, tarla_id: S } },
  lookup_use_category: { scope: null, columns: { name: REF, sort_order: REF } },
  lookup_property_type_use: { scope: null, columns: { property_type_id: REF, use_category_id: REF } },
  lookup_person_type: { scope: null, columns: { name: REF, sort_order: REF } },
  lookup_person_relationship: { scope: null, columns: { name: REF, sort_order: REF } },
  natural_person_relationship: { scope: { column: "natural_person_id", set: "natural" }, columns: { natural_person_id: S, relationship_id: S } },
  lookup_person_role: {
    scope: null,
    columns: {
      name: REF, description: REF, sort_order: REF, valid_for_property: REF, valid_for_person: REF, converse_name: REF,
      converse_name_male: REF, converse_name_female: REF, parent_kind: REF, kinship: REF,
    },
  },
  lookup_judicial_person_type: { scope: null, columns: { name: REF, sort_order: REF, public_body: REF } },
  lookup_citizenship: { scope: null, columns: { name: REF, sort_order: REF } },
  lookup_document_type: { scope: null, columns: { key: REF, name: REF, short_name: REF, sort_order: REF, template_fields: REF, origin: REF, identity_kind: REF } },
  lookup_doc_type_person_role: { scope: null, columns: { document_type_id: REF, person_role_id: REF, holds_share: REF } },
  lookup_property_property_role: { scope: null, columns: { name: REF, description: REF, sort_order: REF } },
  lookup_document_document_role: { scope: null, columns: { name: REF, description: REF, sort_order: REF } },
  document: {
    scope: { column: "id", set: "documents" },
    columns: {
      principal_object_id: APP, code: APP, document_type_id: S, title: S, import_title: S, nr_document: S, date_document: S,
      issuer_person_id: S, issuer_read: S, emitent: S, baza_legala: S, uat_proprietate: S, uat_proprietar: S, suprafata: S,
      nr_dosar_succesoral: S, data_decesului: S, ultimul_domiciliu: S, nr_certificat_deces: S, date_start: S, date_end: S,
      subject: S, date_valid_until: S, surveyor_id: S, notes: S, updated_by: APP, custom_fields: S, referenced_instruments: S,
      ai_interpreted_at: S,
    },
  },
  document_version: { scope: null, columns: { document_id: APP, version_number: APP, snapshot: APP, updated_by: APP } },
  // Slice 40.82: what an identity document printed — every field held by one of the seed's four kinds
  identity_document: {
    scope: { column: "document_id", set: "documents" },
    columns: {
      document_id: APP, last_name: S, first_name: S, cnp: S, sex: S, date_of_birth: S, place_of_birth: S, nationality: S,
      father_first_name: S, mother_first_name: S, civil_status: S, domicile_address: S, domicile_county: S,
      domicile_country: S, issuer_officer: S, passport_type: S, country_code: S, mrz: S, card_number: S,
    },
  },
  property_person: { scope: { column: "property_id", set: "properties" }, columns: { property_id: S, person_id: S, person_role_id: S } },
  property_document: { scope: { column: "property_id", set: "properties" }, columns: { property_id: S, document_id: S } },
  property_property: { scope: { column: "property_id_a", set: "properties" }, columns: { property_id_a: S, property_id_b: S, relationship_role_id: S, role_reads_a_to_b: APP } },
  person_document: {
    scope: { column: "document_id", set: "documents" },
    columns: { person_id: S, document_id: S, person_role_id: S, cota_parte: S, cota_suprafata_mp: S, cota_mod: S },
  },
  person_person: { scope: { column: "person_id_a", set: "persons" }, columns: { person_id_a: S, person_id_b: S, relationship_role_id: S, role_reads_a_to_b: APP } },
  document_page: {
    scope: { column: "document_id", set: "documents" },
    columns: { document_id: APP, page_number: S, page_name: S, page_notes: S, file_name: S, file_path: S, file_size: S, mime_type: S, rotation: "seed-nonzero" },
  },
  document_document: { scope: { column: "document_id_a", set: "documents" }, columns: { document_id_a: S, document_id_b: S, relationship_role_id: S, role_reads_a_to_b: APP } },
  groups: { scope: { column: "id", set: "groups" }, columns: { code: APP, target_type: S, description: S, last_position: APP } },
  group_member: { scope: { column: "group_id", set: "groups" }, columns: { group_id: S, principal_object_id: S, position: APP } },
  stamps: { scope: { column: "id", set: "stamps" }, columns: { code: APP, short_description: S, notes: S } },
  stamp_member: { scope: { column: "stamp_id", set: "stamps" }, columns: { stamp_id: S, target_type: APP, principal_object_id: S } },
  entity_metadata: {
    scope: { column: "principal_object_id", set: "pos" },
    columns: {
      principal_object_id: APP, importance: S, relevance: S, provenance: S, importance_updated_at: APP, relevance_updated_at: APP,
      provenance_updated_at: APP, updated_by: APP,
    },
  },
  entity_provenance_log: { scope: { column: "entity_metadata_id", set: "metadata" }, columns: { entity_metadata_id: APP, method: S, logged_at: S } },
  entity_metadata_version: { scope: null, columns: { entity_metadata_id: APP, version_number: APP, snapshot: APP } },
  entity_cross_reference: {
    scope: { column: "source_principal_object_id", set: "pos" },
    columns: { source_principal_object_id: S, target_principal_object_id: S, relationship_note: S },
  },
  entity_tag: { scope: { column: "principal_object_id", set: "pos" }, columns: { principal_object_id: S, tag: S } },
  user_requests: { never: ACCOUNT },
  app_users: { never: ACCOUNT },
  help_content: { never: "The help texts are Adrian's to accept (proposals-data.ts); nothing writes a row of them unasked." },
  help_hint: { never: "The help texts are Adrian's to accept (proposals-data.ts); nothing writes a row of them unasked." },
  calculation_run: {
    scope: null,
    columns: { code: NR, algorithm_type: NR, input_params: NR, steps_log: NR, result_group_id: NR, status: NR, notes: NR, created_by: NR },
  },
  calculation_run_output: { scope: null, columns: { calculation_run_id: NR, principal_object_id: NR, output_role: NR } },
  time_frame_setting: { never: "Settings — Adrian's, not archive data." },
  property_corner_source: { scope: { column: "document_id", set: "documents" }, columns: { document_id: S, property_id: S, created_by: S } },
  ai_paid_read: { never: "The log of paid AI reads — money, not archive data; a seeded row would be a read nobody paid for." },
  user_tile_default: { never: "Each account's own tile layout." },
  interaction: {
    scope: null,
    columns: {
      channel: I, direction: I, occurred_at: I, person_id: I, subject: I, description: I, internal_note: I, status: I,
      follow_up_on: I, related_property_id: I, created_by: I, updated_by: I,
    },
  },
  interaction_document: { scope: null, columns: { interaction_id: I, document_id: I } },
  interaction_tag: { scope: null, columns: { interaction_id: I, tag: I } },
  cost_record: { never: "Money — the costs Adrian enters, not archive data." },
  skill_attempt: { never: "Each account's quiz history." },
};

/** The columns every table has and the map does not list. */
export const IMPLICIT_COLUMNS = ["id", "created_at", "updated_at"] as const;

/** The checks a run makes: per scoped table, the columns that must hold a value on at least one of the seed's rows. */
export type ColumnCheck = { table: string; scope: { column: string; set: ScopeSet }; columns: { name: string; fill: "seed" | "seed-true" | "seed-nonzero" }[] };

export function columnChecks(map: Record<string, TableFill> = SEED_COLUMNS): ColumnCheck[] {
  const out: ColumnCheck[] = [];
  for (const [table, t] of Object.entries(map)) {
    if ("never" in t || !t.scope) continue;
    const columns = Object.entries(t.columns)
      .filter((e): e is [string, "seed" | "seed-true" | "seed-nonzero"] => e[1] === "seed" || e[1] === "seed-true" || e[1] === "seed-nonzero")
      .map(([name, fill]) => ({ name, fill }));
    if (columns.length) out.push({ table, scope: t.scope, columns });
  }
  return out;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;

/**
 * One SELECT per check: the rows in scope, and per column how many hold a value — a yes for "seed-true", a number
 * other than 0 for "seed-nonzero". Identifiers come from the map above, never from input, and are refused if they
 * are not plain lower-case names; the ids are the one parameter, `$1`, a uuid array.
 */
export function checkSql(c: ColumnCheck): string {
  for (const x of [c.table, c.scope.column, ...c.columns.map((k) => k.name)]) if (!IDENT.test(x)) throw new Error(`columns: „${x}" is not a plain column name`);
  const counts = c.columns.map((k, i) =>
    k.fill === "seed-true" ? `count(*) FILTER (WHERE "${k.name}") AS c${i}` : k.fill === "seed-nonzero" ? `count(*) FILTER (WHERE "${k.name}" <> 0) AS c${i}` : `count("${k.name}") AS c${i}`,
  );
  return `SELECT count(*) AS n, ${counts.join(", ")} FROM "${c.table}" WHERE "${c.scope.column}" = ANY($1::uuid[])`;
}

export type CheckResult = { table: string; rows: number; empty: string[] };

/** The columns a check found empty on every seed row — or every column, when the table held none of its rows. */
export function emptyColumns(c: ColumnCheck, row: Record<string, unknown>): CheckResult {
  const rows = Number(row.n ?? 0);
  return { table: c.table, rows, empty: c.columns.filter((_, i) => Number(row[`c${i}`] ?? 0) === 0).map((k) => k.name) };
}

const LABEL: Record<string, string> = {
  seed: "scris de seed",
  "seed-true": "scris de seed (da)",
  "seed-nonzero": "scris de seed (≠ 0)",
  app: "scris de aplicație",
  interactions: "scris de seed-ul interacțiunilor",
  reference: "Date de referință",
};

/** The map as a list a person reads: one line per column, and how many columns the seed writes. */
export function formatColumns(map: Record<string, TableFill> = SEED_COLUMNS): string {
  const lines: string[] = [];
  let seed = 0;
  let total = 0;
  let not = 0;
  for (const [table, t] of Object.entries(map)) {
    if ("never" in t) {
      lines.push(`${table}  —  nu se scrie: ${t.never}`);
      continue;
    }
    lines.push(table);
    for (const [col, fill] of Object.entries(t.columns)) {
      total++;
      if (typeof fill === "object") not++;
      else if (fill.startsWith("seed")) seed++;
      lines.push(`  ${col.padEnd(30)} ${typeof fill === "object" ? `gol: ${fill.not}` : LABEL[fill]}`);
    }
  }
  lines.push("", `${total} coloane: ${seed} scrise de seed, ${not} lăsate goale cu motiv, restul de aplicație sau Date de referință.`);
  return lines.join("\n");
}

// The list, when this file is run on its own.
if (typeof require !== "undefined" && require.main === module) console.log(formatColumns());
