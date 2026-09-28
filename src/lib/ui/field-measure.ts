/**
 * How long the values in the local archive really are — the SQL, and the table
 * it becomes.                                            (Slice #37.12)
 *
 * `scripts/testing/measure-field-lengths.ts` runs this through the test
 * runner's `measure-fields` sequence, read-only, and prints the table that
 * `src/lib/ui/field-widths.ts` quotes beside every width. #37.13–#37.15 read the
 * same table for their screens.
 *
 * ⚠️ **NO REAL VALUE LEAVES THE DATABASE.** The longest value of a free-text
 * column is useful for one thing — drawing something just as wide in its box —
 * so the query returns it MASKED, inside Postgres: every upper-case letter
 * becomes `H`, every lower-case letter `n`, every digit `0`, and spaces and
 * punctuation stay. „SPCLEP Sector 3 București" comes out as
 * „HHHHHH Hnnnnn 0 Hnnnnnnnn": the same shape and nearly the same width in
 * Arial, and nobody's data. Lookup option labels are reference data, not
 * people's, and are returned as they are. Every statement is a SELECT, run in a
 * read-only session (`src/__tests__/field-widths.test.ts` pins both).
 */

/** A column whose values a field on some screen shows. */
export interface MeasureTarget {
  /** Where the field is: `NP` natural person, `JP` judicial, `PROP`, `DOC`, `ADDR` the shared address block. */
  screen: "NP" | "JP" | "PROP" | "DOC" | "ADDR" | "LIST";
  /** The field's key in `field-widths.ts`. */
  field: string;
  table: string;
  column: string;
  /** Extra condition, e.g. restricting `person.notes` to natural persons. */
  where?: string;
}

/** A dropdown whose options live in a lookup table. */
export interface LookupTarget {
  screen: MeasureTarget["screen"];
  field: string;
  table: string;
  column: string;
}

/** The character counts the table reports overflows at — about what each step of the scale holds. */
export const OVER_AT = [4, 8, 17, 27, 37, 52] as const;

const IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(s: string): string {
  if (!IDENT.test(s)) throw new Error(`not a plain SQL identifier: ${s}`);
  return s;
}

/** Postgres expression: `v` with its letters and digits masked (see the header). */
export function maskSql(v: string): string {
  return `regexp_replace(regexp_replace(regexp_replace(${v}, '[[:upper:]]', 'H', 'g'), '[[:lower:]]', 'n', 'g'), '[[:digit:]]', '0', 'g')`;
}

function statsFrom(sourceSql: string): string {
  const over = OVER_AT.map((n) => `'${n}', count(*) FILTER (WHERE len > ${n})`).join(", ");
  return `(SELECT json_build_object(
      'n', count(*),
      'max', coalesce(max(len), 0),
      'p95', coalesce(percentile_disc(0.95) WITHIN GROUP (ORDER BY len), 0),
      'over', json_build_object(${over}),
      'longestMasked', (SELECT ${maskSql("v")} FROM (${sourceSql}) y ORDER BY len DESC, v LIMIT 1)
    ) FROM (${sourceSql}) x)`;
}

function columnSource(t: MeasureTarget): string {
  const col = `btrim(${ident(t.column)}::text)`;
  return `SELECT ${col} AS v, char_length(${col}) AS len FROM ${ident(t.table)} WHERE ${ident(t.column)} IS NOT NULL AND ${col} <> ''${t.where ? ` AND (${t.where})` : ""}`;
}

/** One SELECT returning `{"<screen>.<field>": stats, …}` for every target. */
export function buildColumnSql(targets: readonly MeasureTarget[]): string {
  const parts = targets.map((t) => `'${t.screen}.${t.field}', ${statsFrom(columnSource(t))}`);
  return `SELECT json_build_object(${parts.join(",\n  ")});`;
}

/** One SELECT returning `{"<screen>.<field>": {"n": options, "max": longest, "longest": label}, …}`. */
export function buildLookupSql(targets: readonly LookupTarget[]): string {
  const parts = targets.map((t) => {
    const col = `btrim(${ident(t.column)}::text)`;
    return `'${t.screen}.${t.field}', (SELECT json_build_object('n', count(*), 'max', coalesce(max(char_length(${col})), 0), 'longest', (SELECT ${col} FROM ${ident(t.table)} ORDER BY char_length(${col}) DESC LIMIT 1)) FROM ${ident(t.table)})`;
  });
  return `SELECT json_build_object(${parts.join(",\n  ")});`;
}

/**
 * Every document type's template field, with the lengths of the values
 * documents hold under its key and, for a select, its longest option.
 * One row per field: `{type, key, fieldType, label, stats, longestOption}`.
 */
export function buildTemplateSql(): string {
  const src = `SELECT btrim(d.custom_fields ->> f.key) AS v, char_length(btrim(d.custom_fields ->> f.key)) AS len
      FROM document d WHERE d.document_type_id = f.type_id AND coalesce(btrim(d.custom_fields ->> f.key), '') <> ''`;
  return `SELECT coalesce(json_agg(json_build_object(
    'type', f.type_key, 'key', f.key, 'fieldType', f.field_type, 'label', f.label,
    'stats', ${statsFrom(src)},
    'longestOption', (SELECT max(char_length(CASE WHEN jsonb_typeof(o) = 'string' THEN o #>> '{}' ELSE coalesce(o ->> 'labelRo', o ->> 'label', o ->> 'value') END))
                      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(f.options) = 'array' THEN f.options ELSE '[]'::jsonb END) o)
  ) ORDER BY f.type_key, f.ord), '[]'::json)
  FROM (
    SELECT t.id AS type_id, t.key AS type_key, e ->> 'key' AS key, e ->> 'type' AS field_type,
           coalesce(e ->> 'labelRo', e ->> 'key') AS label, e -> 'options' AS options, (e ->> 'order')::int AS ord
    FROM lookup_document_type t, jsonb_array_elements(t.template_fields) e
    WHERE jsonb_typeof(t.template_fields) = 'array'
  ) f;`;
}

// ---- the report ----------------------------------------------------------------------

export interface ColumnStats {
  n: number;
  max: number;
  p95: number;
  over: Record<string, number>;
  longestMasked: string | null;
}

export interface LookupStats {
  n: number;
  max: number;
  longest: string | null;
}

export interface TemplateStats {
  type: string;
  key: string;
  fieldType: string;
  label: string;
  stats: ColumnStats;
  longestOption: number | null;
}

/** A masked value as one table cell: line breaks shown as ⏎, pipes escaped, at most 80 characters. */
export function cell(v: string | null): string {
  if (v === null || v === "") return "—";
  const one = v.replace(/\r?\n/g, " ⏎ ").replace(/\|/g, "\\|");
  return one.length > 80 ? `${one.slice(0, 80)}… (${v.length})` : one;
}

/** The measured table, one line per field, as the handover and the comments quote it. */
export function formatReport(
  columns: Readonly<Record<string, ColumnStats>>,
  lookups: Readonly<Record<string, LookupStats>>,
  templates: readonly TemplateStats[],
): string[] {
  const out: string[] = [];
  out.push(`| field | rows | longest | p95 | > ${OVER_AT.join(" | > ")} | longest, masked |`);
  out.push(`|---|---:|---:|---:|${OVER_AT.map(() => "---:").join("|")}|---|`);
  for (const [k, s] of Object.entries(columns)) {
    out.push(`| ${k} | ${s.n} | ${s.max} | ${s.p95} | ${OVER_AT.map((n) => s.over[String(n)] ?? 0).join(" | ")} | ${cell(s.longestMasked)} |`);
  }
  out.push("");
  out.push("| dropdown | options | longest option | the option |");
  out.push("|---|---:|---:|---|");
  for (const [k, s] of Object.entries(lookups)) out.push(`| ${k} | ${s.n} | ${s.max} | ${cell(s.longest)} |`);
  out.push("");
  out.push(`| type · key | kind | label | rows | longest | p95 | longest option |`);
  out.push("|---|---|---|---:|---:|---:|---:|");
  for (const t of templates) {
    out.push(`| ${t.type} · ${t.key} | ${t.fieldType} | ${t.label} | ${t.stats.n} | ${t.stats.max} | ${t.stats.p95} | ${t.longestOption ?? "—"} |`);
  }
  return out;
}
