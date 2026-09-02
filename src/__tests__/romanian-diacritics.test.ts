/**
 * Romanian is spelled Romanian — in the message files and in the seeded rows.
 *                                                                (Slice #32.17)
 *
 * Two different failures are guarded here because they have the same symptom on
 * screen — a Romanian word missing a diacritic — and completely different
 * causes.
 *
 * 1. THE MESSAGE FILES USE COMMA-BELOW, NEVER CEDILLA. Romanian `ș`/`ț` are
 *    U+0219/U+021B (comma below). The Turkish-derived `ş`/`ţ` (U+015F/U+0163,
 *    cedilla) render close enough to pass a glance and are what a Windows
 *    keyboard layout or an older font stack produces. The whole `docTypeEngine`
 *    namespace shipped that way — 45 lines, 130 characters — and nothing said
 *    so until a UAT round read the screen.
 *
 *    ⚠️ **THIS TEST IS ABOUT `messages/**` AND NOTHING ELSE**, and the reason is
 *    that SOME of the cedillas in `src/` are load-bearing: `keys.ts` folds BOTH
 *    spellings to `s`/`t` and its table needs both as distinct object keys,
 *    `discover-to-template.ts` and `folder-utils.ts` carry both in character
 *    classes, `migration_020` has one in a SQL `translate()` source, and a
 *    dozen suites assert the two spellings against each other — a sweep over
 *    `src/` would turn those into tautologies that still pass while testing
 *    nothing. The rest of the `src/` cedillas are prose in comments, some of
 *    which quote copy this slice changed and are now a spelling behind it; they
 *    are stale rather than wrong, and correcting them is a separate job. Either
 *    way, widening this test to the repository is not an improvement.
 *
 * 2. THE SEEDED ROMANIAN EXISTS TWICE AND THE TWO COPIES MUST AGREE. The ten
 *    `time_frame_setting` rows are seeded by `migration_063` and seeded AGAIN
 *    by `supabase_repair_missing_tables.sql`, the repair path for a database
 *    that is missing tables. `migration_076` corrects the ten rows on a database
 *    that already exists; the repair script had to be corrected in the same
 *    commit, or a database rebuilt from empty through it would have been born
 *    with the spelling this slice removed.
 *
 *    (What that script is NOT, despite the slice description saying so: the
 *    full-reset cloud sync. `scripts/supabase-sync.ts` runs `supabase_reset.sql`
 *    and the DDL-only `supabase_schema_full.sql`, and `src/db/seed.ts` never
 *    mentions this table — so a full reset leaves `time_frame_setting` empty
 *    rather than stale. That gap is older than this slice and is not closed
 *    here.)
 *
 *    So this suite replays the migrations the way a database does — 063's seed,
 *    then every Romanian-column `UPDATE time_frame_setting` in filename order —
 *    and compares the whole result against the repair script's seed. A future
 *    migration that corrects one and not the other fails here rather than on
 *    somebody's screen. A migration that INSERTs or DELETEs a row is a shape
 *    this replay does not model, so it fails here too, deliberately and with a
 *    message saying which file did it.
 */

import fs from "node:fs";
import path from "node:path";

const CEDILLAS = ["ş", "Ş", "ţ", "Ţ"]; // ş Ş ţ Ţ
const DIACRITIC = /[ăâîșțĂÂÎȘȚ]/; // ă â î ș ț + capitals

const MESSAGES_DIR = path.join(process.cwd(), "messages");
const DB_DIR = path.join(process.cwd(), "src", "db");

// ---------------------------------------------------------------------------
// 1. Message files
// ---------------------------------------------------------------------------

/**
 * Read from disk rather than a written-out list, so a locale added later is
 * guarded the day it lands instead of the day somebody remembers this file.
 */
const MESSAGE_FILES: string[] = fs
  .readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

function loadMessages(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, file), "utf8")) as Record<
    string,
    unknown
  >;
}

/** Every leaf string in a message file, by its full key path. */
function leaves(node: unknown, prefix = ""): [string, string][] {
  if (typeof node === "string") return [[prefix, node]];
  if (node === null || typeof node !== "object") return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

function at(file: Record<string, unknown>, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (n, part) =>
        n !== null && typeof n === "object" ? (n as Record<string, unknown>)[part] : undefined,
      file,
    );
}

describe("message files spell Romanian with comma-below, not cedilla", () => {
  it("finds the locale files at all", () => {
    // MESSAGE_FILES drives every it.each below, and an it.each over an empty
    // array registers no tests and reports success. This is the one assertion
    // that cannot be vacuous.
    expect(MESSAGE_FILES).toEqual(expect.arrayContaining(["ro-RO.json", "en-GB.json"]));
  });

  it.each(MESSAGE_FILES)("%s has no ş/Ş/ţ/Ţ in any value", (file) => {
    const offenders = leaves(loadMessages(file))
      .filter(([, value]) => CEDILLAS.some((c) => value.includes(c)))
      .map(([key]) => key);
    expect({ file, offenders }).toEqual({ file, offenders: [] });
  });

  it.each(MESSAGE_FILES)("%s has no ş/Ş/ţ/Ţ in any KEY either", (file) => {
    // Keys are code, not copy — a cedilla in one is a lookup that silently
    // misses. There has never been one; this is what keeps it that way.
    const offenders = leaves(loadMessages(file))
      .map(([key]) => key)
      .filter((key) => CEDILLAS.some((c) => key.includes(c)));
    expect({ file, offenders }).toEqual({ file, offenders: [] });
  });
});

/**
 * The four group-filter strings, by exact key path and exact value.
 *
 * ⚠️ **NAMED INDIVIDUALLY ON PURPOSE, AND AN EARLIER DRAFT DID NOT.** That
 * draft matched the keys by pattern and asserted a count of at least four — and
 * six keys match the pattern, because `naturalPerson` and `judicialPerson` have
 * a pair each. So all four of the keys below could have been DELETED and the
 * count would still have read four, with both filters empty and the suite
 * green. Nothing else in `src/__tests__/` reads these keys at all.
 *
 * Two of the eight are on screen today — `property.map.groupsAll` and
 * `property.map.groupsNotInGroup`, at property-map.tsx:1880 and :1893 — and
 * with `DEFAULT_LOCALE` = `ro-RO` a missing key does not fall back to English,
 * it renders its own key path into the UI. The other six have no mount site at
 * present (the only `GroupsFilterDropdown` in the tree uses the
 * `judicialPerson` pair, which is deliberately not listed here). They are
 * pinned anyway: they are shipped copy, the slice was asked to correct all four
 * copies of each string, and a guard that covered only the two currently
 * rendered would go quiet the moment one of the other lists grows its filter
 * back.
 *
 * `naturalPerson.groupsFilter*` and `judicialPerson.groupsFilter*` are pinned
 * separately, below, because their English differs ("All groups" / "Ungrouped")
 * and their Romanian is deliberately different copy rather than a fifth and
 * sixth copy of this one.
 */
const GROUP_FILTER_RO: Record<string, string> = {
  "property.map.groupsAll": "Toate (în grup sau nu)",
  "property.map.groupsNotInGroup": "Fără grup",
  "property.groupsFilterAll": "Toate (în grup sau nu)",
  "property.groupsFilterUngrouped": "Fără grup",
  "person.groupsFilterAll": "Toate (în grup sau nu)",
  "person.groupsFilterUngrouped": "Fără grup",
  "document.groupsFilterAll": "Toate (în grup sau nu)",
  "document.groupsFilterUngrouped": "Fără grup",
};

/**
 * The other two pairs — pinned to the copy they deliberately do NOT share.
 *
 * ⚠️ **`groupsFilterUngrouped` IS THE SAME STRING IN ALL SIX PLACES, AND ONLY
 * THESE TWO ARE ON A SCREEN TODAY.** `GroupsFilterDropdown` has exactly one
 * mount site in the tree — judicial-persons/list-view.tsx — so a de-accented
 * „Fara grup" here is the one that a user would actually read, while the six
 * above have no live dropdown between them. An earlier draft left this pair out
 * on the grounds that its Romanian is "deliberately different", which is true
 * of `groupsFilterAll` („Toate grupurile" against „Toate (în grup sau nu)") and
 * not true of the Ungrouped half at all.
 *
 * Pinned, not consolidated: the point of writing both values out is that the
 * difference in `groupsFilterAll` is a decision, so a later slice that
 * "harmonises" the two namespaces has to change this file and say why.
 */
const GROUP_FILTER_RO_OTHER: Record<string, string> = {
  "naturalPerson.groupsFilterAll": "Toate grupurile",
  "naturalPerson.groupsFilterUngrouped": "Fără grup",
  "judicialPerson.groupsFilterAll": "Toate grupurile",
  "judicialPerson.groupsFilterUngrouped": "Fără grup",
};

describe("the group filter says „în grup” and „Fără grup”, in every copy", () => {
  const ro = loadMessages("ro-RO.json");

  it.each(Object.entries(GROUP_FILTER_RO))("%s", (keyPath, expected) => {
    expect({ keyPath, value: at(ro, keyPath) }).toEqual({ keyPath, value: expected });
  });

  it.each(Object.entries(GROUP_FILTER_RO_OTHER))("%s (its own copy, kept)", (keyPath, expected) => {
    expect({ keyPath, value: at(ro, keyPath) }).toEqual({ keyPath, value: expected });
  });
});

// ---------------------------------------------------------------------------
// 2. The seeded time-frame rows
// ---------------------------------------------------------------------------

interface SeedRow {
  value: string;
  unit: string;
  labelEn: string;
  labelRo: string;
  descriptionEn: string;
  descriptionRo: string;
}

/**
 * ONE SQL scanner, index-for-index with its input.
 *
 * ⚠️ **THERE WERE THREE OF THESE AND THAT WAS THE BUG.** A comment stripper, a
 * literal masker and a statement splitter each walked the text with their own
 * copy of "am I inside a string", and an adversarial round found the copies had
 * already drifted: one `E'it\'s'` anywhere in a migration flipped the quote
 * parity for the rest of the file, and everything after it was read as string
 * content — which silently disarmed the row-shape guard below on a measured
 * `DELETE FROM time_frame_setting` two lines later.
 *
 * So there is one scanner now, and everything that looks for SQL structure
 * looks at its output. It returns a string of the SAME LENGTH as the input,
 * with:
 *
 *   - `--` and non-nested block comments blanked (newlines kept, so line
 *     structure survives),
 *   - the CONTENT of every string literal blanked, its quotes kept — so a
 *     `WHERE`, a `;` or a `('` inside somebody's Romanian sentence is not read
 *     as syntax, while `\(\s*'` can still find the start of a VALUES tuple,
 *   - dollar-quoted bodies blanked whole, delimiters included.
 *
 * Pass `"comments"` to blank ONLY the comments and leave literals and bodies as
 * they are — still walking them properly, so a `--` inside a string is not
 * mistaken for one. That second reading is what tells a name hidden inside a
 * `$$` body apart from a name written in a comment, which is a distinction the
 * row-shape guard needs and nothing else does.
 *
 * Same length matters: callers slice the ORIGINAL text at indices found in this
 * one, so the parser still reads real literals.
 *
 * Escape strings (`E'…\'…'`) are handled; standard `''` doubling is handled in
 * both. What is NOT modelled is SQL built inside a dollar-quoted body and run
 * through `EXECUTE`, and the row-shape guard names that case explicitly rather
 * than letting it pass quietly.
 */
function structure(sql: string, blankOnly: "everything" | "comments" = "everything"): string {
  const literals = blankOnly === "everything";
  const out = sql.split("");
  const blank = (from: number, to: number): void => {
    for (let k = Math.max(0, from); k < Math.min(to, out.length); k += 1) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };

  let i = 0;
  while (i < sql.length) {
    const c = sql[i];

    if (c === "-" && sql[i + 1] === "-") {
      let j = i;
      while (j < sql.length && sql[j] !== "\n") j += 1;
      blank(i, j);
      i = j;
      continue;
    }

    if (c === "/" && sql[i + 1] === "*") {
      let j = i + 2;
      while (j < sql.length && !(sql[j] === "*" && sql[j + 1] === "/")) j += 1;
      j = Math.min(j + 2, sql.length);
      blank(i, j);
      i = j;
      continue;
    }

    if (c === "$") {
      const tag = /^\$[A-Za-z_][A-Za-z_0-9]*\$|^\$\$/.exec(sql.slice(i));
      if (tag !== null) {
        const close = sql.indexOf(tag[0], i + tag[0].length);
        const end = close === -1 ? sql.length : close + tag[0].length;
        if (literals) blank(i, end);
        i = end;
        continue;
      }
    }

    if (c === "'") {
      // `E'…'` — and only that — treats a backslash as an escape.
      const escapes = (sql[i - 1] === "E" || sql[i - 1] === "e") && !/[A-Za-z0-9_]/.test(sql[i - 2] ?? " ");
      let j = i + 1;
      while (j < sql.length) {
        if (escapes && sql[j] === "\\") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      if (literals) blank(i + 1, j);
      i = Math.min(j + 1, sql.length);
      continue;
    }

    i += 1;
  }

  return out.join("");
}

const unquote = (literal: string): string => literal.slice(1, -1).replace(/''/g, "'");

const LITERAL = "'(?:[^']|'')*'";

/**
 * One SQL statement, in the two readings everything downstream needs — the same
 * span of the file, so they line up character for character.
 *
 * `code` has the comments blanked and the literals intact: it is what gets
 * PARSED, because the parser needs the real Romanian out of the quotes. `shape`
 * has the literals blanked too: it is what gets SEARCHED, because a `WHERE` or
 * a `('` inside somebody's sentence is not syntax.
 */
interface Statement {
  code: string;
  shape: string;
}

/** Split on `;`, ignoring one inside a literal, a comment or a `$$` body. */
function statements(sql: string): Statement[] {
  const code = structure(sql, "comments");
  const shape = structure(sql);
  const out: Statement[] = [];
  let start = 0;
  for (let i = 0; i <= shape.length; i += 1) {
    if (i === shape.length || shape[i] === ";") {
      if (shape.slice(start, i).trim() !== "") {
        out.push({ code: code.slice(start, i), shape: shape.slice(start, i) });
      }
      start = i + 1;
    }
  }
  return out;
}

/**
 * The ten seed rows of an `INSERT INTO time_frame_setting … VALUES` statement.
 *
 * Positional, because that is what the statement is: key, value, unit,
 * label_en, label_ro, description_en, description_ro. All seven are captured,
 * not just the Romanian two — the two copies have to agree about the numbers
 * and the English as well, and a drift there would be just as invisible.
 */
function seedRows(sql: string): Map<string, SeedRow> {
  const inserts = statements(sql).filter((s) =>
    /INSERT\s+INTO\s+(?:public\.)?time_frame_setting\b/i.test(s.shape),
  );

  // Exactly one per file — a second, contradictory block appended below the
  // first would otherwise sit there unread.
  expect(inserts.length).toBe(1);

  const { code, shape } = inserts[0];
  const from = shape.search(/\bVALUES\b/i);
  const to = shape.search(/\bON CONFLICT\b/i);
  expect({ hasValues: from !== -1, hasOnConflict: to !== -1 && to > from }).toEqual({
    hasValues: true,
    hasOnConflict: true,
  });

  const rows = new Map<string, SeedRow>();
  const rowRe = new RegExp(
    `\\(\\s*(${LITERAL})\\s*,\\s*(\\d+)\\s*,\\s*(${LITERAL})\\s*,\\s*(${LITERAL})` +
      `\\s*,\\s*(${LITERAL})\\s*,\\s*(${LITERAL})\\s*,\\s*(${LITERAL})\\s*\\)`,
    "g",
  );
  for (const m of code.slice(from, to).matchAll(rowRe)) {
    rows.set(unquote(m[1]), {
      value: m[2],
      unit: unquote(m[3]),
      labelEn: unquote(m[4]),
      labelRo: unquote(m[5]),
      descriptionEn: unquote(m[6]),
      descriptionRo: unquote(m[7]),
    });
  }

  // A row the positional regex cannot read — a NULL description, a cast, a
  // different column order — would otherwise vanish from this map and take its
  // Romanian out of every assertion below with it. Count the tuples on the
  // STRUCTURE, where a `('` inside somebody's description is already blanked,
  // and insist the two agree.
  const crude = (shape.slice(from, to).match(/\(\s*'/g) ?? []).length;
  expect(rows.size).toBe(crude);

  return rows;
}

interface RomanianUpdate {
  key: string;
  labelRo?: string;
  descriptionRo?: string;
}

/**
 * The part of a statement before its own `WHERE` — its assignments.
 *
 * Depth-aware, because `SET value = (SELECT … WHERE …), description_ro = '…'`
 * is legal and a naive "cut at the first WHERE" hides the assignment that
 * follows the subquery.
 */
function assignments(shape: string): string {
  let depth = 0;
  for (let i = 0; i < shape.length; i += 1) {
    const c = shape[i];
    if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    else if (depth === 0 && /^\bWHERE\b/i.test(shape.slice(i))) return shape.slice(0, i);
  }
  return shape;
}

/**
 * A statement that ASSIGNS a Romanian column on this table, in any shape.
 *
 * ⚠️ **THIS IS DELIBERATELY BROADER THAN THE PARSER BELOW, AND THAT IS THE
 * WHOLE MECHANISM.** Three rounds of review found the same defect three times,
 * each in a new shape — `UPDATE public.time_frame_setting`, `UPDATE ONLY …`,
 * an aliased `… AS t SET`, an `INSERT … ON CONFLICT DO UPDATE SET label_ro`,
 * and PostgreSQL's multi-column `SET (label_ro, description_ro) = (…)` — and
 * every one of them was invisible to the parser AND to the cross-check meant
 * to catch the parser, because the two shared a regex. They do not share one
 * now: this is a substring test over a whole statement's structure, the parser
 * reads only the one shape this repository writes, and `romanianUpdates`
 * fails when they disagree.
 *
 * Scoped to the assignments rather than the whole statement, because
 * `SET value = 45 WHERE label_ro = '…'` is a legitimate future migration about
 * a number and must not fail a suite about spelling. `[=,)]` rather than `=`
 * alone is what catches the multi-column form, where a `)` sits between the
 * column name and the equals sign.
 */
function writesRomanian(statement: Statement): boolean {
  const assigns = assignments(statement.shape);
  return (
    /\btime_frame_setting\b/i.test(statement.shape) &&
    /\bSET\b/i.test(assigns) &&
    /\b(?:label_ro|description_ro)\s*[=,)]/i.test(assigns)
  );
}

/** Every migration statement that sets `label_ro` / `description_ro`, parsed. */
function romanianUpdates(sql: string, file: string): RomanianUpdate[] {
  const out: RomanianUpdate[] = [];
  const unread: string[] = [];
  let written = 0;

  for (const statement of statements(sql)) {
    if (!writesRomanian(statement)) continue;
    written += 1;

    const shown = statement.code.trim().replace(/\s+/g, " ").slice(0, 120);
    const m = statement.code.match(
      new RegExp(
        `^\\s*UPDATE\\s+time_frame_setting\\s+SET\\s+([\\s\\S]*?)WHERE\\s+key\\s*=\\s*(${LITERAL})\\s*$`,
        "i",
      ),
    );
    if (!m) {
      unread.push(shown);
      continue;
    }

    const body = m[1];
    const label = body.match(new RegExp(`label_ro\\s*=\\s*(${LITERAL})`, "i"));
    const desc = body.match(new RegExp(`description_ro\\s*=\\s*(${LITERAL})`, "i"));
    // `writesRomanian` saw an assignment; if neither column resolves to a
    // literal here it was written some other way, and pushing an empty update
    // would make the statement look accounted for.
    if (!label && !desc) {
      unread.push(shown);
      continue;
    }
    out.push({
      key: unquote(m[2]),
      ...(label ? { labelRo: unquote(label[1]) } : {}),
      ...(desc ? { descriptionRo: unquote(desc[1]) } : {}),
    });
  }

  // Named, because this is the assertion most likely to fire years from now, on
  // somebody else's migration. `expect(0).toBe(1)` would send them looking in
  // the wrong file.
  expect({ file, read: out.length, romanianWrites: written, unread }).toEqual({
    file,
    read: written,
    romanianWrites: written,
    unread: [],
  });
  return out;
}

/** What a database that has run every migration in order actually holds. */
function effectiveRows(): Map<string, SeedRow> {
  // Zero-padded to three digits since 008, so a lexicographic sort is the
  // numeric one. Only `migration_*` files are replayed, because only those are
  // what `Apply-Migration.ps1` runs — a `hotfix_*.sql` pasted at a database by
  // hand is outside what any test here can know about.
  const files = fs
    .readdirSync(DB_DIR)
    .filter((f) => /^migration_\d+.*\.sql$/.test(f))
    .sort();

  const SEED = "migration_063_time_frame_settings.sql";
  const state = seedRows(fs.readFileSync(path.join(DB_DIR, SEED), "utf8"));

  for (const file of files) {
    if (file === SEED) continue;
    const sql = fs.readFileSync(path.join(DB_DIR, file), "utf8");
    const shape = structure(sql);

    // ⚠️ **THIS REPLAY APPLIES UPDATEs AND NOTHING ELSE.** A later migration
    // that INSERTs an eleventh setting, DELETEs one, TRUNCATEs the table, or
    // builds a write inside a `$$` body and EXECUTEs it, would change what a
    // database holds while leaving this reconstruction at 063's ten rows — and
    // the comparison against the repair script would then agree about a state
    // neither database is in. Rather than half-implement a replay, say so:
    // each of those fails here, named, and the fix is to teach this function
    // the shape rather than to delete the check.
    const rowShape =
      shape.match(
        /(?:INSERT\s+INTO|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+(?:ONLY\s+)?(?:public\.)?(?:ONLY\s+)?time_frame_setting\b/gi,
      ) ?? [];
    // A dollar-quoted body — or a string literal holding SQL for `EXECUTE` — is
    // blanked by `structure`, so anything it does to this table is invisible to
    // every check above. The tell is the name surviving a comments-only reading
    // and then vanishing from the full one. Comments are compared away by that
    // first reading, which matters: this file's own header names the table a
    // dozen times.
    const hiddenInBody =
      (structure(sql, "comments").match(/\btime_frame_setting\b/g) ?? []).length >
      (shape.match(/\btime_frame_setting\b/g) ?? []).length;

    expect({ file, addsOrRemovesRows: rowShape, hiddenInBody }).toEqual({
      file,
      addsOrRemovesRows: [],
      hiddenInBody: false,
    });

    for (const update of romanianUpdates(sql, file)) {
      const before = state.get(update.key);
      expect({ file, key: update.key, known: before !== undefined }).toEqual({
        file,
        key: update.key,
        known: true,
      });
      state.set(update.key, {
        ...before!,
        ...(update.labelRo !== undefined ? { labelRo: update.labelRo } : {}),
        ...(update.descriptionRo !== undefined ? { descriptionRo: update.descriptionRo } : {}),
      });
    }
  }
  return state;
}


describe("the seeded time-frame rows", () => {
  const REPAIR = "supabase_repair_missing_tables.sql";

  it("say the same thing in the migrations and in the repair script", () => {
    const migrated = effectiveRows();
    const repair = seedRows(fs.readFileSync(path.join(DB_DIR, REPAIR), "utf8"));

    expect([...repair.keys()].sort()).toEqual([...migrated.keys()].sort());
    expect(Object.fromEntries(repair)).toEqual(Object.fromEntries(migrated));
  });

  it("cover all ten settings, and none of the Romanian is left un-accented", () => {
    const migrated = effectiveRows();
    expect(migrated.size).toBe(10);

    const romanian = [...migrated.entries()].flatMap(([key, r]) => [
      [`${key}.label_ro`, r.labelRo] as const,
      [`${key}.description_ro`, r.descriptionRo] as const,
    ]);
    expect(romanian).toHaveLength(20);

    // Every one of the twenty strings carries at least one Romanian diacritic.
    // That is what a reversion to the 063 spelling would fail — those strings
    // are pure ASCII.
    expect(romanian.filter(([, v]) => !DIACRITIC.test(v)).map(([k]) => k)).toEqual([]);

    // And comma-below there too, for the same reason as the message files.
    expect(
      romanian.filter(([, v]) => CEDILLAS.some((c) => v.includes(c))).map(([k]) => k),
    ).toEqual([]);
  });

  it("say the same WORDS as the original seed — a diacritics fix rewords nothing", () => {
    // migration_063's seed is pure ASCII, so stripping the accents off the
    // current text must give it back exactly. That is what makes this a
    // spelling correction rather than a rewrite: a future migration that
    // quietly changes what a label SAYS, under cover of fixing its diacritics,
    // fails here. A deliberate rewording fails here too — correctly, and the
    // fix is to update this expectation in the same commit.
    //
    // ⚠️ WHAT THIS DOES NOT CATCH, said plainly rather than implied: a partial
    // de-accenting („Prag CI expira curând") applied to BOTH copies. Stripping
    // it still yields the 063 text, the two copies still agree, and the
    // at-least-one-diacritic check above still passes. Closing that would mean
    // writing the twenty strings out here — a THIRD copy of the seed text, and
    // one more place for the next correction to miss.
    const original = seedRows(
      fs.readFileSync(path.join(DB_DIR, "migration_063_time_frame_settings.sql"), "utf8"),
    );
    const migrated = effectiveRows();

    const strip = (s: string): string =>
      s
        .replace(/[ăâĂÂ]/g, (c) => (c === c.toLowerCase() ? "a" : "A"))
        .replace(/[îÎ]/g, (c) => (c === "î" ? "i" : "I"))
        .replace(/[șşȘŞ]/g, (c) => (c === c.toLowerCase() ? "s" : "S"))
        .replace(/[țţȚŢ]/g, (c) => (c === c.toLowerCase() ? "t" : "T"));

    const drift = [...migrated.entries()]
      .flatMap(([key, row]) => {
        const was = original.get(key)!;
        return [
          [`${key}.label_ro`, strip(row.labelRo), was.labelRo] as const,
          [`${key}.description_ro`, strip(row.descriptionRo), was.descriptionRo] as const,
        ];
      })
      .filter(([, now, was]) => now !== was)
      .map(([k, now, was]) => ({ key: k, stripped: now, seeded: was }));

    expect(drift).toEqual([]);
  });
});
