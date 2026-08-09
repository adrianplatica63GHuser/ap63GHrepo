/**
 * Discovery output → a document type's custom form.   (Slice #26.11)
 *
 * WHAT THIS CLOSES
 * ----------------
 * `POST /api/documents/[id]/ai-interpret` with `{ mode: "discover" }` reads a
 * document the system does not understand yet and reports label -> value pairs
 * it could find (src/lib/documents/discover-log.ts). Until this slice that
 * report went to the dev-server terminal and nowhere else, so a human had to
 * read it, invent field keys, and hand-write a `template_fields` JSON array
 * into `lookup_document_type` for the type to gain a form.
 *
 * This module is the missing translation: DiscoverPair[] in, proposed
 * DocumentTemplateField[] out. Once those are saved onto the type, everything
 * downstream already works — `buildExtractSystemPrompt` builds its prompt from
 * `template_fields` and `runAiInterpret` writes the answers into
 * `document.custom_fields` on every subsequent import, and the document form
 * renders the fields dynamically. The form is data, not code, which is why
 * this slice is a wire and not a feature.
 *
 * ⚠️ A STORED `key` IS PERMANENT AND IS NOT THIS MODULE'S TO CHANGE.
 * `.claude/skills/onboard-document-type/SKILL.md` states the rule this module
 * has to live under: a field's `key` is the JSON key in `document.custom_fields`
 * on every document already captured under it, so "renaming means a migration
 * to move data, not just a label edit". Hand-written templates use camelCase
 * (`pretTotal`, `nrCadastral`); the keys this module invents are snake_case
 * slugs of a Romanian label. Both are legal and they must coexist:
 *   - an EXISTING key is passed through byte-for-byte (see sanitizeTemplateField);
 *   - matching a discovered label against an existing field, and keeping new
 *     keys unique, both compare on normaliseKeyForComparison — so `pretTotal`
 *     and `pret_total` are recognised as the same field rather than becoming
 *     two fields that split one document's data between them.
 *
 * PURE — no React, no DB, no next/*, no I/O. Same contract as
 * template-fields.ts and discover-log.ts: it is imported from a route (server)
 * and from the review dialog (client), and it NEVER throws on odd model
 * output. A proposal step that crashes on strange data fails exactly when the
 * data is strange, which is the situation discover mode exists for.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not decide anything on the user's behalf. Everything here is a
 * PROPOSAL: the review dialog shows each row beside the value that produced it
 * and the user ticks, renames and re-types before a single field is saved. The
 * inference rules below are therefore tuned to be *correctable*, not clever —
 * see inferFieldType for why a bare run of digits stays `text`.
 */

import { GENERIC_EXTRACT_FIELD_DESCRIPTIONS } from "@/lib/import/classify-prompts";
import type { DiscoverConfidence, DiscoverPair } from "@/lib/documents/discover-log";
import type {
  DocumentTemplateField,
  DocumentTemplateFieldType,
} from "@/lib/documents/template-fields";

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Keys this module INVENTS are clipped to this. Existing keys are untouched. */
const MAX_KEY_LENGTH = 40;
/** A label is a form caption. Anything longer is a sentence that got mislabelled. */
const MAX_LABEL_LENGTH = 120;
/** At or above this length a value is prose, not a caption's worth of data. */
const TEXTAREA_MIN_LENGTH = 120;
/** Fallback key when a label slugs down to nothing (e.g. a label of only "§ —"). */
const FALLBACK_KEY = "camp";

/**
 * Hard ceiling on how many fields one type may carry.
 *
 * Every field becomes a line in the extraction prompt sent for every document
 * of this type from now on, and a row in the form. A discovery on a dense
 * notarial contract can propose a lot of pairs; accepting all of them by
 * reflex should not be able to produce a type whose prompt is mostly field
 * list. Exported so the review dialog can stop the user BEFORE the click
 * rather than the route rejecting them after it.
 */
export const MAX_TEMPLATE_FIELDS = 60;

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * One-line, single-spaced version of a string.
 *
 * Load-bearing, not tidiness. `buildExtractSystemPrompt` renders every template
 * field as ONE `//` comment line inside the JSON shape it sends the model:
 *
 *     "pretTotal": string | null,  // free text — <aiHint> (<labelRo>)
 *
 * A newline inside `labelRo` or `aiHint` therefore breaks that line in half and
 * corrupts the shape the model is being shown. Everything this module emits
 * into those two positions goes through here first, and the save route applies
 * it again to whatever the dialog sends back (sanitizeTemplateField), so a
 * label typed with a line break in the review step cannot reach the prompt.
 */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Turn a Romanian label printed on a document into a stable field key.
 *
 * NFD + combining-mark strip is what handles the diacritics: ă â î ș ț all
 * decompose to an ASCII letter plus a combining mark, and so do the legacy
 * cedilla forms (ş U+015F, ţ U+0163) that older scans and older fonts produce.
 * Those two pairs are visually near-identical and routinely mixed within one
 * document, so folding both to the same ASCII letter is also what stops
 * "Preţ" and "Preț" becoming two fields.
 *
 * Deliberately NOT using `\b` anywhere in this module: it is ASCII-only, so on
 * Romanian text it fires in the middle of words. (Recorded in CLAUDE.md as a
 * lesson that cost a slice.)
 */
export function slugifyFieldKey(label: string): string {
  const ascii = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // ș/ț sometimes arrive as precomposed characters that NFD leaves alone in
    // some engines; map the survivors explicitly rather than trusting the table.
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t");

  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!slug) return FALLBACK_KEY;
  // Trim to the limit, then re-trim a trailing "_" the cut may have exposed.
  const clipped = slug.slice(0, MAX_KEY_LENGTH).replace(/_+$/g, "");
  return clipped || FALLBACK_KEY;
}

/**
 * A key that is safe to store and to put in a prompt exactly as written.
 *
 * The invariant is narrow on purpose: no whitespace (it would break the
 * one-line prompt rendering), no double quote or backslash (the key is emitted
 * as `"<key>"` inside a JSON-shaped block), non-empty, and not absurdly long.
 * EVERYTHING else passes — camelCase, digits, dots, hyphens — because a key
 * that already has data under it must survive untouched, and the codebase's
 * own hand-written templates are camelCase.
 */
const SAFE_KEY = /^[^\s"\\]{1,64}$/;

/**
 * The form two keys are compared in when asking "are these the same field?".
 *
 * `pretTotal` (hand-written, camelCase) and `pret_total` (this module's slug of
 * "Preț total") are the same field wearing two conventions, and every place
 * that asks whether a discovered label is already on the type — or whether a
 * new key is free — has to say so. Comparing the raw strings would let a
 * discovery run silently duplicate a hand-curated form, field for field.
 *
 * NOT used for storage or lookup: `document.custom_fields` is keyed by the real
 * key, and nothing here ever writes the normalised form anywhere.
 */
export function normaliseKeyForComparison(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Make `key` unique against everything in `takenNormalised`, and record it.
 *
 * `takenNormalised` holds NORMALISED keys (see above), so a proposed
 * `pret_total` collides with a stored `pretTotal` and gets suffixed rather than
 * becoming a second field for the same thing.
 *
 * Suffixes are `_2`, `_3`, … and the base is shortened as needed so the result
 * still fits MAX_KEY_LENGTH — a suffix that pushed the key over the limit and
 * then got clipped back off would collide with the very key it was avoiding.
 */
export function uniqueFieldKey(key: string, takenNormalised: Set<string>): string {
  const norm = normaliseKeyForComparison(key);
  if (!takenNormalised.has(norm)) {
    takenNormalised.add(norm);
    return key;
  }
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `_${n}`;
    const base = key.slice(0, MAX_KEY_LENGTH - suffix.length).replace(/_+$/g, "") || FALLBACK_KEY;
    const candidate = `${base}${suffix}`;
    const candidateNorm = normaliseKeyForComparison(candidate);
    if (!takenNormalised.has(candidateNorm)) {
      takenNormalised.add(candidateNorm);
      return candidate;
    }
  }
  // 998 fields sharing one label is not a document, but returning a duplicate
  // key would silently overwrite a field, so fall back to something unique.
  const last = `${FALLBACK_KEY}_${takenNormalised.size + 1}`;
  takenNormalised.add(normaliseKeyForComparison(last));
  return last;
}

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const RO_DATE = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/;
/**
 * A decimal number and nothing else: digits, ONE separator, and a fraction of
 * ONE OR TWO digits. No currency, no units, no thousands grouping.
 *
 * The two-digit ceiling is what keeps "125.000" out. In Romanian that is a
 * hundred and twenty-five thousand written with a thousands separator, and in
 * an `<input type="number">` it is one hundred and twenty-five — a silent
 * factor of a thousand, on a price. A genuine three-decimal value is rare
 * enough (and correctable in the review step) to be worth that trade.
 *
 * The separator must be a DOT, and that is the more important half. A value
 * printed the Romanian way ("1234,56") extracts as "1234,56" — the discover
 * prompt explicitly tells the model to keep Romanian separators, and nothing
 * between the model and the column converts it — and `<input type="number">`
 * renders a comma decimal as EMPTY. The value would be stored, invisible in
 * the form and un-editable, on every document of the type. As `text` it is
 * shown exactly as it was read, which is the correctable failure.
 */
const DECIMAL = /^-?\d{1,12}\.\d{1,2}$/;

/**
 * A real calendar date, not merely digits in the right ranges.
 *
 * The bounds alone let through 31.06.2023, 30.02.2024 and 29.02.2023, and
 * `<input type="date">` blanks an impossible date string exactly the way it
 * blanks a Romanian-formatted one — so a value this let through would reach
 * the form, show as empty, and still be stored by the save. The round trip
 * through UTC is the cheapest way to ask the calendar rather than the regex.
 * (`+` is likewise gone from DECIMAL above: HTML's valid-floating-point
 * grammar allows a leading `-` and not a `+`, so "+12.50" blanks a number
 * input for the same reason.)
 */
function plausibleDate(year: number, month: number, day: number): boolean {
  if (year < 1800 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Guess a field type from the ONE value discover happened to read.
 *
 * The two non-obvious calls, both made towards the correctable direction —
 * a wrong `text` is a cosmetic annoyance the user retypes in the review step,
 * a wrong `date`/`number` silently mangles the value the form later shows:
 *
 *  - **A bare run of digits stays `text`.** In this archive, digit-only values
 *    are overwhelmingly IDENTIFIERS — CNP, CUI, nr. cadastral, nr. carte
 *    funciară, tarla/parcela — not quantities, and `<input type="number">`
 *    drops leading zeros and accepts exponent notation. Only a value with an
 *    actual decimal fraction is proposed as `number`.
 *  - **A grouped number ("125.000", "1.234,56 lei") stays `text` too**, because
 *    "125.000" is 125 thousand in Romanian and 125 in the input element, and
 *    guessing which one a scan meant is not this module's business.
 *
 * One sample is thin evidence, which is exactly why this is a proposal.
 */
export function inferFieldType(value: string): DocumentTemplateFieldType {
  if (value.includes("\n") || value.length >= TEXTAREA_MIN_LENGTH) return "textarea";

  const v = value.trim();
  if (!v) return "text";

  const iso = ISO_DATE.exec(v);
  if (iso && plausibleDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) return "date";

  const ro = RO_DATE.exec(v);
  if (ro && plausibleDate(Number(ro[3]), Number(ro[2]), Number(ro[1]))) return "date";

  if (DECIMAL.test(v)) return "number";

  return "text";
}

// ---------------------------------------------------------------------------
// AI hint
// ---------------------------------------------------------------------------

/** Runs of 4+ digits — CNP, CUI, IBAN blocks, account, cadastral and CF numbers. */
const LONG_DIGIT_RUN = /\d{4,}/g;

/**
 * Two capitalised words in a row — "POPESCU ION", "Ion Popescu", "Cluj Napoca".
 *
 * Masking digits is not enough on its own: the value most worth NOT copying
 * onto a document type is a person's name, and it carries no digits at all.
 *
 * Applied to the sample VALUE only. It cannot be used on a label, because
 * Romanian documents print their captions in Title Case and ALL CAPS as a
 * matter of course — "Nr. Cadastral", "CARTE FUNCIARĂ", "COTĂ PARTE" all match
 * this, and none of them is a name.
 */
const LOOKS_LIKE_A_NAME = /\p{Lu}[\p{L}.'-]*\s+\p{Lu}[\p{L}.'-]*/u;

/** Beyond this an example stops describing a shape and starts quoting content. */
const MAX_EXAMPLE_LENGTH = 40;

/**
 * Build the hint appended to this field's line in the extraction prompt.
 *
 * `.claude/skills/onboard-document-type/SKILL.md` calls aiHint "the single
 * highest-leverage field for extraction accuracy" and says a concrete example
 * beats an abstract description. That is what this produces, and nothing else.
 *
 * **It deliberately does NOT record the label as printed.** An earlier version
 * added "printed on the document as '…'" whenever the user renamed a row, on
 * the reasoning that the model has to match the wording on the page. Two
 * things killed it. The wording is nearly free anyway — the prompt already
 * carries the stored `labelRo`, and a model reading a scan is not troubled by
 * case or a shortened caption. And it could not be filtered safely: the case
 * it had to exclude is a caption with a person glued onto it ("Notar Public
 * MARIA IONESCU", renamed to "Notar"), and every test for that also matches
 * ordinary Romanian captions, which are routinely Title Case or ALL CAPS —
 * "Nr. Cadastral", "CARTE FUNCIARĂ", "COTĂ PARTE". A guard that fires on most
 * of the cases the feature exists for is not a guard, it is the feature
 * switched off with extra steps.
 *
 * The example itself is given ONLY for `text` and `textarea`. For `date` and
 * `number`, `templateFieldFormatHint` has already told the model to answer in
 * ISO / bare-decimal form, and a Romanian example ("17.03.2024", "1.234,56")
 * contradicts that instruction on the same line. A model that follows the
 * example writes a value the route stores verbatim and `<input type="date">`
 * then renders as BLANK — stored, invisible and uneditable, on every future
 * document of the type.
 *
 * Three tests on the sample, all of them the same idea: an example may show
 * the SHAPE of a value ("120 mp", "parter", "RON") and must never carry a real
 * one. The hint is stored on the document TYPE and sent to the model for every
 * future document of that type, so a CNP, an IBAN or a person read out of the
 * one discovered document would otherwise describe a stranger in every prompt
 * from then on — and would be offered to the model as the answer on any later
 * document where it cannot read that field.
 *
 * Returns null when the sample earns nothing — an empty hint is better than a
 * line of noise in a prompt that is charged for by the token.
 */
export function buildFieldHint(input: {
  sampleValue: string;
  type: DocumentTemplateFieldType;
}): string | null {
  if (input.type !== "text" && input.type !== "textarea") return null;

  const sample = collapseWhitespace(input.sampleValue).replace(LONG_DIGIT_RUN, "…");
  const usable =
    sample.length > 0 &&
    sample.length <= MAX_EXAMPLE_LENGTH &&
    /[a-zA-Z0-9]/.test(sample) &&
    !LOOKS_LIKE_A_NAME.test(sample);
  if (!usable) return null;

  // Single quotes rather than double: this lands inside a `//` comment in a
  // JSON-shaped prompt, and unbalanced double quotes there read as structure.
  return `e.g. '${sample.replace(/"/g, "'")}'`;
}

/**
 * The value to prefill into THIS document's form for an accepted field, or
 * null when the sample cannot be represented in that field's input.
 *
 * ⚠️ **NOT the same thing as the sample, and the difference is the whole
 * point.** Discover's prompt tells the model to leave a printed value exactly
 * as it found it — "leave dates as 12.04.2021 if that is what is printed" —
 * while a `date` field is an `<input type="date">`, which accepts nothing but
 * `yyyy-mm-dd`. Handing it "12.04.2021" makes the browser show an EMPTY box
 * while react-hook-form still holds the Romanian string, so a user told to
 * "check the values and press Save" saves a value they cannot see, into a
 * column every later import writes in ISO. Two formats in one key, one of them
 * invisible.
 *
 * So: a date is converted, a number is accepted only in the form the input
 * takes, and anything that cannot be represented is left BLANK rather than
 * stored where it cannot be read. Blank is honest — the field is there, the
 * user can type it, and the next import fills it properly.
 */
export function formValueForField(
  sampleValue: string,
  type: DocumentTemplateFieldType,
): string | null {
  const v = sampleValue.trim();
  if (!v) return null;

  if (type === "date") {
    const pad = (n: string) => n.padStart(2, "0");
    const iso = ISO_DATE.exec(v);
    if (iso && plausibleDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) {
      return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
    }
    const ro = RO_DATE.exec(v);
    if (ro && plausibleDate(Number(ro[3]), Number(ro[2]), Number(ro[1]))) {
      return `${ro[3]}-${pad(ro[2])}-${pad(ro[1])}`;
    }
    return null;
  }

  // `inferFieldType` only ever proposes `number` for a dot-decimal, but the
  // user can set the type by hand on any row, so this is checked and not
  // assumed. `<input type="number">` renders a comma decimal as empty exactly
  // the way a date input renders a Romanian date as empty.
  if (type === "number") return DECIMAL.test(v) ? v : null;

  return sampleValue;
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export type DiscoveredFieldProposal = {
  /**
   * The key this field would be stored under. For a row that matches a field
   * the type already has, it is that field's EXISTING key, whatever convention
   * it was written in. For a new row it is a fresh slug, unique against the
   * existing keys and against every other proposal.
   */
  key: string;
  /** The label exactly as discovery read it — the dialog's starting value. */
  labelRo: string;
  labelEn: string;
  type: DocumentTemplateFieldType;
  /**
   * What discover read for this label — verbatim and NOT truncated. It is the
   * evidence the review step shows beside the row; the clipped, masked copy
   * that buildFieldHint produces is the only one that is ever stored.
   */
  sampleValue: string;
  confidence: DiscoverConfidence;
  /**
   * True when the type's template already carries this field. Such a row is
   * shown as already-in-the-form rather than offered: re-running discovery on
   * a type that already has a form is normal (it is how you see what is still
   * unrecognised) and must not offer to add every field a second time.
   */
  alreadyInForm: boolean;
};

/**
 * Turn discover's label -> value pairs into reviewable field proposals.
 *
 * Order is the model's own reading order, which is roughly the order the
 * labels appear on the page — the most useful order for someone checking the
 * list against the document in front of them.
 *
 * Never throws: a pair whose name collapses to nothing is dropped (it can
 * carry no label and no key), everything else survives in some form.
 */
export function proposeTemplateFields(
  pairs: readonly DiscoverPair[],
  existing: readonly DocumentTemplateField[],
  /**
   * Labels the system already captures by some OTHER mechanism, so a row
   * matching one is shown as handled rather than offered as a new field.
   *
   * In practice this is the document type's configured person roles —
   * "Vânzător", "Cumpărător", "Notar". The extraction prompt already asks for
   * those as structured `parties` and the import links each to a real Person
   * record; accepting one here as well would put a second, freely-editable
   * copy of somebody's name and CNP on every document of the type, which
   * diverges from the Person the first time either is corrected. It is the
   * argument src/lib/import/id-card.ts makes about exactly this, applied one
   * layer earlier.
   */
  capturedElsewhere: readonly string[] = [],
): DiscoveredFieldProposal[] {
  // Normalised key -> the REAL key this row would be, so a match can hand back
  // the key the data is actually under rather than the slug that matched it.
  const existingByNorm = new Map<string, string>();
  const remember = (source: string, realKey: string) => {
    const norm = normaliseKeyForComparison(source);
    if (norm && !existingByNorm.has(norm)) existingByNorm.set(norm, realKey);
  };

  // (a) The type's own fields — by key, and by the SLUG OF THEIR LABEL. A
  //     curated field is often keyed as an abbreviation of its caption
  //     (`nrAct` for "Nr. act autentic"); without the label side, a discovery
  //     that reads that very caption offers it as new and the form ends up
  //     with two inputs carrying the same words.
  for (const f of existing) remember(f.key, f.key);
  for (const f of existing) {
    remember(slugifyFieldKey(f.labelRo), f.key);
    remember(slugifyFieldKey(f.labelEn), f.key);
  }

  // (b) The four generic fields every document already has as COLUMNS —
  //     title, nrDocument, dateDocument, subject. They are not template
  //     fields, so nothing above sees them, and discover's own prompt uses
  //     "Nr. 1234" and "Data: 12.04.2021" as its worked examples of what to
  //     report. Left unguarded, the first real run proposes `nr` and `data`
  //     as new custom fields with full confidence, and accepting them makes
  //     every later import write the same printed value twice — once to the
  //     column, once to `custom_fields` — after which the two copies diverge
  //     the first time anyone edits one.
  //
  //     The alias list is deliberately short and covers only the plain
  //     Romanian words for a closed set of four. It will miss an unusual
  //     wording, and that is the cheaper error: a miss costs one field the
  //     user can still add from Reference Data, where a false accept costs
  //     permanent double storage on every document of the type.
  for (const key of Object.keys(GENERIC_EXTRACT_FIELD_DESCRIPTIONS)) remember(key, key);
  const GENERIC_LABEL_ALIASES: Record<string, string> = {
    titlu:      "title",
    denumire:   "title",
    nr:         "nrDocument",
    numar:      "nrDocument",
    data:       "dateDocument",
    subiect:    "subject",
    obiect:     "subject",
  };
  for (const [alias, key] of Object.entries(GENERIC_LABEL_ALIASES)) remember(alias, key);

  // (c) Anything the caller says is already captured elsewhere — see the
  //     parameter's own comment. Keyed to itself: these rows are never saved,
  //     so the key only has to be stable enough to render.
  for (const label of capturedElsewhere) {
    const slug = slugifyFieldKey(label);
    remember(slug, slug);
  }

  // Seeded with the existing keys so a NEW proposal can never collide with a
  // field already on the type — it would overwrite it on save.
  const taken = new Set(existingByNorm.keys());
  // Which existing fields a pair has already been matched to. A document that
  // prints the same label twice must not produce the same key twice: the first
  // occurrence is the existing field, the second is a genuinely new one and
  // gets a suffixed key. Two rows sharing a key would be one React list key,
  // one `custom_fields` slot, and one of the two values silently lost.
  const matchedExisting = new Set<string>();
  const out: DiscoveredFieldProposal[] = [];

  for (const pair of pairs) {
    const label = collapseWhitespace(pair.name).slice(0, MAX_LABEL_LENGTH).trim();
    if (!label) continue;

    const base = slugifyFieldKey(label);
    const norm = normaliseKeyForComparison(base);
    const existingKey = existingByNorm.get(norm);
    const alreadyInForm = existingKey !== undefined && !matchedExisting.has(norm);
    if (alreadyInForm) matchedExisting.add(norm);

    out.push({
      // An already-present row keeps the EXISTING key — it is the same field,
      // and that key is what every document of this type already stores its
      // value under. Only a genuinely new one is uniquified.
      key: alreadyInForm ? (existingKey as string) : uniqueFieldKey(base, taken),
      labelRo: label,
      // No translator lives in a pure module, and a Romanian document yields
      // Romanian labels. Both sides carry the same text so the form reads
      // correctly in either locale; the English one is editable afterwards in
      // Reference Data → Document Types like any other template field.
      labelEn: label,
      type: inferFieldType(pair.value),
      sampleValue: pair.value,
      confidence: pair.confidence,
      alreadyInForm,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Merge + sanitise
// ---------------------------------------------------------------------------

/**
 * Force one field into the shape that is safe to store and to put in a prompt.
 *
 * Applied by the save route to every field it is asked to write, whatever the
 * caller sent — the review dialog lets the user retype labels, and this is the
 * single choke point between that keyboard and `template_fields`.
 *
 * ⚠️ **A key that is already safe is returned BYTE-FOR-BYTE.** Only a key that
 * could corrupt the prompt line or is unusably long is re-slugged. Rewriting a
 * usable key — lower-casing `pretTotal` to `prettotal`, say — would orphan the
 * value stored under it on every document of this type already imported: the
 * data would still be in `document.custom_fields` and unreachable from both the
 * form and the extraction prompt. See the header, and SKILL.md's "treat it as
 * permanent once real data exists under it".
 */
export function sanitizeTemplateField(field: DocumentTemplateField): DocumentTemplateField {
  const labelRo = collapseWhitespace(field.labelRo).slice(0, MAX_LABEL_LENGTH).trim();
  const labelEn = collapseWhitespace(field.labelEn).slice(0, MAX_LABEL_LENGTH).trim();
  const hint = field.aiHint ? collapseWhitespace(field.aiHint) : "";
  const key = SAFE_KEY.test(field.key) ? field.key : slugifyFieldKey(field.key);
  return {
    key,
    // A label emptied by sanitising falls back to the other locale, then to the
    // key — never to "", which would render a form field with no caption.
    labelRo: labelRo || labelEn || key,
    labelEn: labelEn || labelRo || key,
    type: field.type,
    order: field.order,
    aiHint: hint || null,
    groupRo: field.groupRo ? collapseWhitespace(field.groupRo) : null,
    groupEn: field.groupEn ? collapseWhitespace(field.groupEn) : null,
  };
}

/**
 * The list to store: everything the type already had, then the accepted rows.
 *
 * Three properties this function exists to guarantee:
 *
 *  - **Nothing existing is dropped, reordered or RENAMED.** Accepting a
 *    discovery is additive. A type that already has a hand-curated form gains
 *    fields at the end of it and loses none, and every key it already had comes
 *    out the other side identical — which is what makes the button safe to
 *    press on a type that already holds real data. Existing keys are NOT put
 *    through sanitizeTemplateField's SAFE_KEY test either: a stored key that
 *    would fail it is a key documents already hold data under, and repairing
 *    it here would strand that data on a save the user asked for something
 *    else entirely. Only the labels and hints of existing rows are cleaned,
 *    because those go into the prompt line.
 *  - **`order` is renumbered 0..n-1 from the final position**, so no caller
 *    has to compute it and two fields can never share an order. `existing`
 *    arrives from parseTemplateFields already sorted by order, so renumbering
 *    preserves the order the user sees.
 *  - **Two spellings of one key collapse to the first.** Compared on
 *    normaliseKeyForComparison, so an accepted `pret_total` is recognised as
 *    the stored `pretTotal` and dropped rather than added beside it. Two fields
 *    that normalise alike cannot both be filled usefully: the form would show
 *    two identical captions and the prompt would ask for the same thing twice.
 */
export function mergeAcceptedFields(
  existing: readonly DocumentTemplateField[],
  accepted: readonly DocumentTemplateField[],
): DocumentTemplateField[] {
  const out: DocumentTemplateField[] = [];
  /** Exact keys already emitted — the only test applied to existing rows. */
  const seenExact = new Set<string>();
  /** Normalised keys — what an ACCEPTED row is measured against. */
  const seenNorm = new Set<string>();

  for (const field of existing) {
    // Key verbatim; labels and hint cleaned. Only an exact duplicate is
    // dropped, and only because two rows with one key cannot both be filled:
    // `custom_fields` is keyed by it, so the second would shadow the first.
    if (!field.key || seenExact.has(field.key)) continue;
    seenExact.add(field.key);
    seenNorm.add(normaliseKeyForComparison(field.key));
    // Sanitised for its labels and hint, then the ORIGINAL key put back over
    // whatever sanitising would have made of it.
    const clean = sanitizeTemplateField(field);
    out.push({ ...clean, key: field.key, order: out.length });
  }

  for (const field of accepted) {
    const clean = sanitizeTemplateField(field);
    const norm = normaliseKeyForComparison(clean.key);
    // A key that normalises to nothing (all punctuation) is unusable as a
    // `custom_fields` key and cannot be told apart from the next one like it.
    if (!clean.key || !norm || seenExact.has(clean.key) || seenNorm.has(norm)) continue;
    seenExact.add(clean.key);
    seenNorm.add(norm);
    out.push({ ...clean, order: out.length });
  }

  return out;
}
