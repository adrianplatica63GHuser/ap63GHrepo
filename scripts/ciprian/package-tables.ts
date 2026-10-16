/**
 * Which tables travel to Ciprian's box, and which stay on Adrian's.                       (Slice #39.58)
 *
 * build-ciprian-image.ps1 ships the schema and the REFERENCE data every time (Step 5). With `-WithData` it also
 * ships the OPERATIONAL data — the archive Adrian sees on dev — and keeps back what belongs to Adrian's accounts.
 * Every table of src/db/schema is in exactly one list here, each with its reason, and
 * src/__tests__/ciprian-package-tables.test.ts fails on a table in none: a new table is a question, answered here,
 * before the package can carry it or leave it behind by accident.
 *
 * The script reads these lists from `node … scripts/ciprian/package-tables.ts json <file>`; its own
 * `$refTablePatterns` and `$knownOperationalTables` are pinned to them by the same test, so there is one answer.
 *
 * PURE apart from the CLI at the bottom, which only writes the lists to a file.
 */
import fs from "node:fs";

/** Reference data: shipped on every build (Step 5's `-t` patterns). `*` is pg_dump's wildcard. */
export const REFERENCE_TABLE_PATTERNS = ["lookup_*", "time_frame_setting", "help_content", "help_hint"] as const;

/** The archive itself — shipped with `-WithData`, exactly as dev holds it. */
export const SHIPPED_WITH_DATA: Readonly<Record<string, string>> = {
  principal_object: "every object's code and kind",
  person: "the persons",
  natural_person: "the persons",
  judicial_person: "the persons",
  address: "the persons' and the properties' addresses",
  person_version: "the persons' versions",
  property: "the properties",
  property_address: "the properties",
  property_corner: "the properties' corners",
  property_corner_source: "where a property's corners came from",
  property_version: "the properties' versions",
  document: "the documents",
  document_page: "the documents' pages (their files travel in ciprian-uploads.zip)",
  document_version: "the documents' versions",
  person_person: "the links",
  person_document: "the links",
  property_person: "the links",
  property_document: "the links",
  property_property: "the links",
  document_document: "the links",
  groups: "the groups",
  group_member: "the groups",
  stamps: "the stamps",
  stamp_member: "the stamps",
  entity_metadata: "„Clasificare”",
  entity_metadata_version: "„Clasificare”'s versions",
  entity_provenance_log: "„Proveniență”'s history",
  entity_cross_reference: "„Vezi și”",
  entity_tag: "the tags",
  calculation_run: "„Calcul drum lateral”'s runs",
  calculation_run_output: "„Calcul drum lateral”'s runs",
  interaction: "„Interacțiuni”",
  interaction_document: "„Interacțiuni”",
  interaction_tag: "„Interacțiuni”",
};

/** Adrian's, not the archive's — never shipped. Adrian: „I don't want my progress from the Skills Map to show up in Ciprian database”. */
export const HELD_BACK: Readonly<Record<string, string>> = {
  skill_attempt: "Adrian's skills-map progress — his quizzes, not Ciprian's (39.58's request)",
  app_users: "Adrian's accounts; Ciprian's box has none (UAT_NO_AUTH)",
  user_requests: "requests for an account on Adrian's install",
  user_tile_default: "each account's own default tiles, keyed on the account",
  ai_paid_read: "dev's log of paid AI reads; on Ciprian's box the rate limiter would count Adrian's",
  cost_record: "what Adrian's providers billed him („Setări → Costuri”)",
};

/** Not data of the application at all. */
export const NOT_DATA: Readonly<Record<string, string>> = {
  spatial_ref_sys: "PostGIS's own table",
  schema_migrations: "the migration ledger — Ciprian's database is built from the schema dump, not the chain",
};

/**
 * The sequences whose values travel with the data: without their setval, Ciprian's next new person, group, stamp or
 * calculation would be given a code dev has already used.
 */
export const SHIPPED_SEQUENCES = ["principal_object_code_seq", "group_code_seq", "stamp_code_seq", "calculation_run_code_seq"] as const;

export type TableClass = "reference" | "shipped" | "held-back" | "not-data" | "unclassified";

/** pg_dump's pattern: `*` matches anything, everything else literally. */
export function matchesPattern(table: string, pattern: string): boolean {
  const re = new RegExp(`^${pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
  return re.test(table);
}

export function classifyTable(table: string): TableClass {
  if (REFERENCE_TABLE_PATTERNS.some((p) => matchesPattern(table, p))) return "reference";
  if (table in SHIPPED_WITH_DATA) return "shipped";
  if (table in HELD_BACK) return "held-back";
  if (table in NOT_DATA) return "not-data";
  return "unclassified";
}

/** What the script reads. */
export function packageLists(): {
  reference: string[];
  shipped: string[];
  heldBack: string[];
  notData: string[];
  sequences: string[];
} {
  return {
    reference: [...REFERENCE_TABLE_PATTERNS],
    shipped: Object.keys(SHIPPED_WITH_DATA),
    heldBack: Object.keys(HELD_BACK),
    notData: Object.keys(NOT_DATA),
    sequences: [...SHIPPED_SEQUENCES],
  };
}

// ---- CLI: `json <file>` writes the lists, UTF-8, for build-ciprian-image.ps1 -------------------
if (process.argv[1] && /package-tables\.ts$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const [cmd, out] = process.argv.slice(2);
  if (cmd !== "json" || !out) {
    console.error("Usage: node node_modules/tsx/dist/cli.mjs scripts/ciprian/package-tables.ts json <file>");
    process.exitCode = 2;
  } else {
    fs.writeFileSync(out, JSON.stringify(packageLists(), null, 1), "utf8");
  }
}
