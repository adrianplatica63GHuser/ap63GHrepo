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

/**
 * Keys this module INVENTS are clipped to this. Existing keys are untouched.
 *
 * Exported since #29.10 so the review screen can say the number in the sentence
 * that warns a user their name is about to be cut — a warning that named no
 * limit would be a complaint without a remedy.
 */
export const MAX_KEY_LENGTH = 40;
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
 * The ASCII fold every key and every token comparison in this module starts
 * from.
 *
 * NFD + combining-mark strip is what handles the diacritics: ă â î ș ț all
 * decompose to an ASCII letter plus a combining mark, and so do the legacy
 * cedilla forms (ş U+015F, ţ U+0163) that older scans and older fonts produce.
 * Those two pairs are visually near-identical and routinely mixed within one
 * document, so folding both to the same ASCII letter is also what stops
 * "Preț" and "Preţ" becoming two fields.
 *
 * Hoisted out of `slugifyFieldKey` in #29.10 because `looksLikeSentenceFragment`
 * needs the SAME fold: a rule that reads „în" while the key reads „in" is two
 * spellings of one decision, which is the shape #29.06 spent a slice deleting.
 */
function foldToAscii(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // ș/ț sometimes arrive as precomposed characters that NFD leaves alone in
      // some engines; map the survivors explicitly rather than trusting the table.
      .replace(/[șş]/gi, "s")
      .replace(/[țţ]/gi, "t")
  );
}

/**
 * Turn a Romanian label printed on a document into a stable field key.
 *
 * Diacritics are handled by `foldToAscii` above — read its comment for why
 * both the comma-below and the cedilla spellings have to land on one letter.
 *
 * Deliberately NOT using `\b` anywhere in this module: it is ASCII-only, so on
 * Romanian text it fires in the middle of words. (Recorded in CLAUDE.md as a
 * lesson that cost a slice.)
 */
export function slugifyFieldKey(label: string): string {
  const slug = rawFieldSlug(label);
  if (!slug) return FALLBACK_KEY;
  // Trim to the limit, then re-trim a trailing "_" the cut may have exposed.
  const clipped = slug.slice(0, MAX_KEY_LENGTH).replace(/_+$/g, "");
  return clipped || FALLBACK_KEY;
}

/**
 * The slug BEFORE `MAX_KEY_LENGTH` is applied.
 *
 * Split out in #29.10 for `nameTooLongForKey`: F5's complaint was two keys
 * "truncated mid-word", and the only way to warn a user about that is to know
 * the length the slug wanted to be, which `slugifyFieldKey` has already thrown
 * away. It gained two more readers as the review rounds went on —
 * `rememberCaption` and `reviewRowIssue` — for a related reason: the clip
 * decides what a key is CALLED and has no business inside the relation that
 * decides what a field IS.
 */
function rawFieldSlug(label: string): string {
  return foldToAscii(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
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

/**
 * The hint stored on the type for a field proposed from ONE document: none.
 *
 * ⚠️ **THIS IS THE SENTENCE THE OTHER HINT PRODUCER POINTS AT.** Two functions
 * in this codebase write `template_fields.aiHint`, they land on the same line
 * of the same extraction prompt, and they obey OPPOSITE rules on purpose:
 *
 *   - `distilledHint` (src/lib/documents/field-distillation.ts) reads MANY
 *     documents and emits the CAPTIONS a field was actually printed under,
 *     refusing outright below three samples;
 *   - this one reads ONE document and emits NOTHING.
 *
 * That is not an inconsistency waiting to be tidied. It is one rule — *nothing
 * belonging to a single deed may be copied onto the type every deed of that
 * kind will share* — answered with the evidence each path actually has. A
 * wording printed in three of twenty documents is a property of the DOCUMENT
 * TYPE. Anything read once is a property of ONE DOCUMENT, and no test on the
 * string can tell the two apart.
 *
 * ⚠️ **IF THE TWO ARE EVER MERGED, THE SURVIVING RULE IS THE CAPTION RULE,
 * with the single-sample case refusing to emit — never this one
 * extended to the engine.** Unifying downwards would put a parcel's real
 * measurements back into a hint that twenty samples had just finished keeping
 * out.
 *
 * WHAT THIS REPLACED, AND WHY THE GUARDS WERE NOT THE PROBLEM      (#29.10)
 * ------------------------------------------------------------------------
 * Until this slice the function emitted a masked example VALUE for `text` and
 * `textarea`: runs of four or more digits replaced with "…", anything matching
 * two capitalised words in a row refused as a person, anything over forty
 * characters refused as a quotation. Each guard did exactly what it said. A
 * real run on a sale-purchase contract with a dezmembrare then wrote all of
 * this onto a type shared by every future deed of that kind:
 *
 *     parcela                  e.g. '225/3/24'
 *     tarla                    e.g. '47/2'
 *     suprafata_de             e.g. '2.000 mp'
 *     din_totalul_de           e.g. '4.716 mp (din masuratori 4.716,22 mp)'
 *     pretul_vanzarii_este_de  e.g. '2.000,00 RON (douamii RON)'
 *     eliberat_de_2            e.g. 'O.C.P.I. — Ilfov'
 *
 * Not one of those has a four-digit run, is two capitalised words, or is over
 * forty characters. The cadastral identity of one parcel and the price one
 * property sold for were sitting on the type, sent to the model for every later
 * document of that type — and offered to it as the answer wherever it could not
 * read the field. In the same run the two CNPs produced no hint at all. The
 * guards are right about what they guard and blind to this, because what
 * separates a SHAPE ("120 mp", "parter") from a piece of CONTENT ("2.000 mp")
 * is not in the string at all: it is in how many documents printed it, and one
 * document cannot answer that.
 *
 * The three other candidate answers are worse, and the reason each fails is
 * short:
 *
 *  - **Mask every digit rather than runs of four.** 'O.C.P.I. — Ilfov' and
 *    '… (douamii RON)' survive it untouched. The leak is not a digit leak.
 *  - **Derive the hint from the field's TYPE.** `templateFieldFormatHint`
 *    already says that, on the same prompt line — this would buy a second
 *    sentence whose only new power is to contradict the first.
 *  - **Derive it from the printed LABEL.** That is the caption rule, and both
 *    this module's history and `captionVariants`' own header record it as
 *    undecidable from one sample: the case it must exclude is a caption with a
 *    person glued onto it („Notar Public MARIA IONESCU"), and every textual
 *    test for that also matches ordinary Romanian captions, which are routinely
 *    Title Case or ALL CAPS.
 *
 * So a form proposed from one document carries labels and types and no hints —
 * which is what such a form carried before #26.11 gave it one, and is never
 * worse than a wrong one. The review screen says so, and says where a hint does
 * come from: the document-type engine, over several documents.
 *
 * The signature is kept, exported and called from the dialog rather than
 * inlined as `aiHint: null`, so the six leaked values above stay fixtures a
 * test pushes through the real code path instead of a list in a comment.
 */
export function buildFieldHint(_input: {
  sampleValue: string;
  type: DocumentTemplateFieldType;
}): string | null {
  return null;
}

// ---------------------------------------------------------------------------
// Names that are sentence fragments
// ---------------------------------------------------------------------------

/**
 * Romanian function words that a FIELD NAME cannot legitimately end on.
 *
 * Prepositions, conjunctions, relative pronouns, auxiliaries and articles — a
 * genuinely closed class, which is what makes this a list rather than a guess.
 * A caption ends on a content word („Nr. cadastral", „Data autentificării",
 * „Suprafață construită desfășurată"); a sentence cut off mid-flow ends on one
 * of these („suprafața **de**", „prețul vânzării este **de**").
 *
 * ⚠️ **`de` IS IN THIS LIST AND IT IS THE NOISY ENTRY. IT STAYS, AND THE PRICE
 * IS NAMED RATHER THAN HIDDEN.** Romanian prints a whole family of legitimate
 * captions in the shape `<participiu> de` — „Eliberat de", „Emis de",
 * „Semnat de", „Autentificat de", „Întocmit de", „Verificat de" — and this
 * flags every one of them. Nothing structural separates „Eliberat de" from
 * „Suprafața de": both are one word plus a preposition, and telling a participle
 * from a noun means reading morphology, which is precisely the move
 * `field-distillation.ts` measured at 47% misses / 39% wrong deletions and
 * removed. Dropping `de` instead would lose „Suprafața de" and „Din totalul de",
 * two of the four names F5 actually reported. So the entry stays, the family is
 * pinned as its own corpus in the tests, and the flag is ADVISORY — for
 * „Semnat de" the advice („rewrite it short") is not even wrong.
 *
 * ⚠️ **FIVE ENTRIES WERE REMOVED ACROSS THREE REVIEW ROUNDS, ALL FOR THE SAME
 * REASON: a short Romanian function word is also a Romanian ABBREVIATION.**
 * `cui` is the relative pronoun and also CUI, the company registration number.
 * A bare trailing `a` is the block/stair letter in „Scara A", „Bloc A",
 * „Corp A". `ce` is the relative pronoun and also the CE conformity mark
 * („Marcaj CE"). `ca` is the conjunction and also CA, Consiliul de
 * Administrație („Membru CA", „Decizie CA"). `se` at the END is the clitic and
 * also the cadastral orientation („Latura SE" — while „Latura NE" was not
 * flagged, which put the arbitrariness on one page). Each fired on real
 * captions; measured, none of them fired on a single pinned fragment, so all
 * five cost nothing to remove. `se` stays in the LEADING and MIDDLE sets, where
 * it does real work.
 *
 * Written folded and lower-cased — compared against `captionTokens`, never
 * against the raw label, so „în" and „in" are one entry and no `\b` is
 * involved. (CLAUDE.md: `\b` is ASCII-only and fires mid-word on Romanian.)
 */
const TRAILING_FUNCTION_WORDS = new Set([
  "de", "din", "in", "la", "pe", "cu", "prin", "pentru", "catre", "sub", "spre",
  "dintre", "intre", "dupa", "pana", "fara", "asupra", "despre", "conform",
  "potrivit", "care", "cat", "cum", "este", "sunt", "era", "erau",
  "fost", "fiind", "avand", "iar", "si", "sau", "ori", "dar", "precum",
  "respectiv", "adica", "anume", "al", "ai", "ale", "lui", "ei", "lor", "isi",
]);

/**
 * The same class again, restricted to the words a field name cannot legitimately
 * BEGIN on — a continuation of a sentence that started somewhere above it
 * („**din** totalul de", „**în** suprafață de", „**care** se învecinează cu").
 *
 * Shorter than the trailing set on purpose: the articles and clitics are out,
 * because a genitive caption can open on one and a false flag on the FIRST word
 * of a name is the more visible of the two errors.
 */
const LEADING_FUNCTION_WORDS = new Set([
  "de", "din", "in", "la", "pe", "cu", "prin", "pentru", "catre", "sub", "spre",
  "dintre", "intre", "dupa", "pana", "fara", "asupra", "despre", "conform",
  "potrivit", "care", "ce", "este", "sunt", "era", "erau", "fost", "fiind",
  "avand", "iar", "si", "sau", "ori", "dar", "precum", "respectiv", "adica",
  "anume", "declaram", "urmeaza",
  // ⚠️ Added after a second review round. The middle-verb test cannot see a
  // TWO-token clause — `tokens.slice(1, -1)` is empty — so „se aplică",
  // „am primit", „va cuprinde", „au semnat" all read as captions. No Romanian
  // caption opens on a clitic or a bare auxiliary, so these are safe at the
  // front where the articles were not.
  "se", "isi", "au", "am", "ati", "va", "vor", "fi", "ne", "le",
]);

/**
 * A finite verb in the MIDDLE of a name — the third and last test.
 *
 * A caption is a noun phrase and has no conjugated verb in it. „Prețul vânzării
 * **este** de", „**a fost** achitat integral" and „urmează **a se** plăti" are
 * clauses, and their edges alone do not always give them away. Kept to
 * copulas and auxiliaries, which is the same closed class as the two sets
 * above — no attempt is made to recognise a verb in general.
 */
const MIDDLE_VERB_WORDS = new Set([
  "este", "sunt", "era", "erau", "fost", "va", "vor", "se", "au", "am", "ati",
  "fi",
]);

/** The label's words, folded and lower-cased. Punctuation is a separator. */
function captionTokens(label: string): string[] {
  return foldToAscii(label)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Does this name read as a piece of a sentence rather than as a field name?
 *
 * ⚠️ **ADVISORY ONLY. IT MUST NEVER FILTER, RENAME OR BLOCK, AND THAT IS THE
 * DECISION AND NOT AN OVERSIGHT.** F5 reported field names cut out of the prose
 * around them — `suprafata_de`, `din_totalul_de`, `pretul_vanzarii_este_de`,
 * `eliberat_de_2`. Three answers were available: stop the discover prompt
 * offering fragments, filter them out of the proposal, or SHOW the user that a
 * name is one. This is the third, and the other two were rejected for reasons
 * this codebase has already paid for:
 *
 *  - A prompt change cannot be verified without a model call, so nothing here
 *    could pin it and every later edit to the prompt would silently retest it.
 *  - A filter deletes SILENTLY. `field-distillation.ts` records at length what
 *    happened the last time a rule in this family was asked to decide rather
 *    than to point: measured over realistic Romanian captions it missed 47% of
 *    what it hunted and deleted 39% of what it did not, and a wording it
 *    deleted appeared nowhere on the screen. A rule that is wrong two ways in
 *    five may inform a user; it may not act for one.
 *
 * ⚠️ **The many-sample path does not need this at all, and naming why is the
 * point.** `distilledLabel` picks the SHORTEST settled caption across the
 * samples, on the reasoning that a caption with a value or a person glued onto
 * it is longer than the bare caption — arithmetic that needs several readings
 * and is simply unavailable here. One document has one wording of one name, so
 * the only thing left to do with it is put it in front of the person who is
 * looking at the document.
 *
 * TWO TESTS, AND WHAT EACH IS FOR
 * -------------------------------
 *  1. Its first or last word is a function word — the fragment proper.
 *  2. It contains a conjugated verb — a clause whose edges happen to be nouns.
 *
 * ⚠️ **LENGTH IS NOT ONE OF THEM, AND A SECOND REVIEW ROUND IS WHY.** A version
 * of this also returned true for a name whose slug would be cut at
 * `MAX_KEY_LENGTH`, which is a real problem and a DIFFERENT one: „Certificat de
 * atestare fiscală pentru persoane fizice" is a perfectly good caption whose key
 * gets truncated mid-word, and telling its author it "reads like a piece of a
 * sentence" is simply false. That test now lives in `nameTooLongForKey`, with
 * its own message. Two complaints, two sentences, each true.
 *
 * MEASURED, not asserted (CLAUDE.md: run it over the shape that would embarrass
 * it). Against the three corpora pinned in `discover-to-template.test.ts`, and
 * **re-measure whenever the word lists change**:
 *
 *   - 95 real Romanian document captions → **0 flagged.** That includes the
 *     abbreviations three review rounds caught successive word lists getting
 *     wrong — „CUI", „Scara A", „Bloc A", „Corp A", „Marcaj CE", „Membru CA",
 *     „Latura SE" — and six long captions that a length test inside this
 *     function used to flag with a sentence that was untrue of all six.
 *   - 22 sentence fragments of the kind F5 reported → **22 flagged.**
 *   - 16 captions of the known-noisy `<participiu> de` family → **16 flagged,
 *     on purpose**, for the reason written against `de` above.
 *
 * ⚠️ **THE RESIDUAL, NAMED — seven, pinned as `KNOWN_MISSES`.** What it cannot
 * see is a fragment whose first and last words are both content words and which
 * carries no conjugated verb. Measured, four of that kind: „imobil situat administrativ", „vândut liber de
 * sarcini", „proprietatea exclusivă a subsemnatului", „denumit în continuare
 * vânzătorul" — plus the article-initial class („al cărui", „ai căror", „ale
 * căror"), which is missed because the leading set deliberately excludes bare
 * articles: „Al doilea proprietar" is a caption. Those are pinned as known
 * misses in the tests rather than chased with a third rule, because a rule that
 * READS is where the measured disaster above began. What makes them survivable is the same thing
 * that makes the whole approach defensible: the name is a text box the user is
 * looking at, the key is printed under it, and nothing is written until they
 * press a button.
 */
export function looksLikeSentenceFragment(label: string): boolean {
  const caption = collapseWhitespace(label);
  if (!caption) return false;

  const tokens = captionTokens(caption);
  if (tokens.length === 0) return false;
  if (LEADING_FUNCTION_WORDS.has(tokens[0])) return true;
  if (TRAILING_FUNCTION_WORDS.has(tokens[tokens.length - 1])) return true;
  return tokens.slice(1, -1).some((tok) => MIDDLE_VERB_WORDS.has(tok));
}

/**
 * Is this name too long to survive as a key?                          (#29.10)
 *
 * F5's other complaint about the names was two keys "truncated mid-word", and
 * this is the whole of it: `slugifyFieldKey` clips at `MAX_KEY_LENGTH`, so a
 * caption of more than about forty characters is stored under a key cut wherever
 * it happens to fall. The user is the only one who can shorten it, and until
 * #29.10 nothing told them.
 *
 * ⚠️ **SEPARATE FROM `looksLikeSentenceFragment`, AND A REVIEW ROUND IS WHY.**
 * Folded into that function, this flagged „Certificat de atestare fiscală pentru
 * persoane fizice", „Număr de înregistrare în registrul comerțului" and four
 * more ordinary captions — with a message saying they read like a piece of a
 * sentence, which is untrue of every one of them. Same evidence, different
 * complaint, different sentence on the screen.
 *
 * ⚠️ **ONE TEST, AND A THIRD ROUND TOOK THE SECOND ONE OUT.** There used to be
 * a caption-length limit beside it, on the reasoning that a very long name is a
 * sentence. It fired on strings whose KEY was short — a caption padded with
 * dotted leaders („Suprafața ........ mp") slugs to `suprafata_mp`, twelve
 * characters — while the message beside it said the key was being cut at forty
 * in the middle of a word. Two conditions behind one sentence is how a screen
 * comes to say something false; the message here is now true whenever it shows.
 */
export function nameTooLongForKey(label: string): boolean {
  return rawFieldSlug(collapseWhitespace(label)).length > MAX_KEY_LENGTH;
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
   * What discover read for this label — verbatim and NOT truncated.
   *
   * It is the evidence the review step shows beside the row, and since #29.10
   * that is ALL it is: `buildFieldHint` no longer derives a masked example from
   * it, so nothing from this string reaches the document type. Read that
   * function's header for the six values that used to, and why no test on one
   * reading could keep them out.
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
 * Every name that is ALREADY SPOKEN FOR on this type, as normalised name ->
 * the real key behind it.
 *
 * Hoisted out of `proposeTemplateFields` in #29.10 and exported, because the
 * review screen needs the same set for two more decisions — what a new row's
 * key may not collide with, and what a user may not RENAME a row onto — and a
 * second copy of this list would be a second answer to "is this the same
 * field?". ⚠️ **A review round found the dialog carrying such a copy:** it had
 * the stored keys and the captured rows' keys, and neither the generic
 * columns, nor the label aliases, nor the type's person roles. Renaming a row
 * to „Notar" or „Data" sailed through it and minted `notar` / `data` beside the
 * Person link and the `dateDocument` column.
 *
 * Three sources, and the comments inside say why each is there:
 *
 *  (a) the type's own fields, by key AND by the slug of each label;
 *  (b) the four generic columns every document has, plus the plain Romanian
 *      words for them;
 *  (c) whatever the caller says is captured by some other mechanism — in
 *      practice the type's person roles.
 */
export type CapturedName = {
  /** The real key behind this name — a stored field's, a column's, or a slug. */
  key: string;
  /**
   * ⚠️ **True only for the TYPE'S OWN template fields, and the distinction
   * decides whether a repeated caption may become a second field.**
   *
   * A type holding `cnp` and a deed printing „CNP" twice is two real fields:
   * the seller's and the buyer's. A document printing „Nr." twice is still ONE
   * document number, and a document printing „Notar" twice is still one Person
   * link — those are captured by a mechanism that has exactly one slot, so a
   * second copy is the permanent double storage that (b) and (c) below exist to
   * prevent. A round found the second „Notar" arriving as an offerable
   * `notar_2` because the repeat rule did not know the difference.
   */
  ownField: boolean;
};

export function capturedFieldNames(
  existing: readonly DocumentTemplateField[],
  capturedElsewhere: readonly string[] = [],
): Map<string, CapturedName> {
  // Normalised key -> the REAL key this row would be, so a match can hand back
  // the key the data is actually under rather than the slug that matched it.
  const existingByNorm = new Map<string, CapturedName>();
  const remember = (source: string, realKey: string, ownField: boolean) => {
    const norm = normaliseKeyForComparison(source);
    if (norm && !existingByNorm.has(norm)) existingByNorm.set(norm, { key: realKey, ownField });
  };
  /**
   * A caption is indexed BOTH clipped and unclipped — clipped first.
   *
   * ⚠️ **THE CLIP MUST NOT LIVE INSIDE "IS THIS THE SAME FIELD?", AND A FIFTH
   * REVIEW ROUND IS WHERE THAT FINALLY LANDED.** `slugifyFieldKey` cuts at
   * `MAX_KEY_LENGTH`, so two genuinely different long captions — „Certificat de
   * atestare fiscală pentru persoane fizice" and „…pentru persoane juridice" —
   * share their first forty slug characters and collapse to one comparison key.
   * Asking the question on the clipped form told a user renaming a row to the
   * second one that the name was already taken, which is false. Asking it on
   * the RAW name instead (the attempt before that) went wrong the other way:
   * the raw name is not the form this map is keyed on, so retyping a stored
   * field's 53-character caption matched nothing and saved a duplicate.
   *
   * Both forms in the map settles it. The clipped entry is what
   * `proposeTemplateFields` looks up — it slugs first, and it has to, because
   * the key it would mint is the clipped one. The unclipped entry is what
   * `reviewRowIssue` looks up. Clipping stays where it belongs: in
   * `uniqueFieldKey`, deciding what a key is CALLED, not what a field IS.
   *
   * ⚠️ **EVERY CLIPPED ENTRY IS WRITTEN BEFORE ANY UNCLIPPED ONE, and a sixth
   * round showed why the obvious interleaving was not safe.** This map is keyed
   * on `normaliseKeyForComparison`, which deletes the underscores — so an
   * unclipped form is NOT distinguished from a clipped one by length, and a
   * caption with more word breaks in the same letters can produce an unclipped
   * norm equal to a LATER field's clipped norm. `remember` is first-wins, so
   * interleaved that collision handed a matched row the wrong field's key.
   * Deferring the unclipped pass makes the clipped answer — the one
   * `proposeTemplateFields` needs — always win, and leaves the unclipped
   * entries reachable only where nothing clipped claimed the name.
   */
  const deferredUnclipped: Array<[string, string, boolean]> = [];
  const rememberCaption = (label: string, realKey: string, ownField: boolean) => {
    remember(slugifyFieldKey(label), realKey, ownField);
    deferredUnclipped.push([rawFieldSlug(label), realKey, ownField]);
  };

  // (a) The type's own fields — by key, and by the SLUG OF THEIR LABEL. A
  //     curated field is often keyed as an abbreviation of its caption
  //     (`nrAct` for "Nr. act autentic"); without the label side, a discovery
  //     that reads that very caption offers it as new and the form ends up
  //     with two inputs carrying the same words.
  for (const f of existing) remember(f.key, f.key, true);
  for (const f of existing) {
    rememberCaption(f.labelRo, f.key, true);
    rememberCaption(f.labelEn, f.key, true);
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
  for (const key of Object.keys(GENERIC_EXTRACT_FIELD_DESCRIPTIONS)) remember(key, key, false);
  const GENERIC_LABEL_ALIASES: Record<string, string> = {
    titlu:      "title",
    denumire:   "title",
    nr:         "nrDocument",
    numar:      "nrDocument",
    data:       "dateDocument",
    subiect:    "subject",
    obiect:     "subject",
  };
  for (const [alias, key] of Object.entries(GENERIC_LABEL_ALIASES)) remember(alias, key, false);

  // (c) Anything the caller says is already captured elsewhere — see the
  //     parameter's own comment. Keyed to itself: these rows are never saved,
  //     so the key only has to be stable enough to render.
  for (const label of capturedElsewhere) {
    rememberCaption(label, slugifyFieldKey(label), false);
  }

  for (const [source, realKey, ownField] of deferredUnclipped) {
    remember(source, realKey, ownField);
  }

  return existingByNorm;
}

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
  const existingByNorm = capturedFieldNames(existing, capturedElsewhere);

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
    const match = existingByNorm.get(norm);
    /**
     * ⚠️ **THE "SECOND OCCURRENCE IS A NEW FIELD" RULE APPLIES TO THE TYPE'S
     * OWN FIELDS AND TO NOTHING ELSE — a review round found it applying to all
     * three sources.** A type holding `cnp` and a deed printing „CNP" twice is
     * two real fields, the seller's and the buyer's, and the second must be
     * offered. A document printing „Nr." twice is still ONE document number and
     * a document printing „Notar" twice is still one Person link: those are
     * captured by mechanisms with exactly one slot, and the second occurrence
     * was arriving as an offerable `nr_2` / `notar_2` — the permanent double
     * storage that (b) and (c) above exist to prevent, reached by the one door
     * they do not watch.
     */
    const alreadyInForm =
      match !== undefined && (!match.ownField || !matchedExisting.has(norm));
    if (alreadyInForm && match?.ownField) matchedExisting.add(norm);

    out.push({
      // An already-present row keeps the EXISTING key — it is the same field,
      // and that key is what every document of this type already stores its
      // value under. Only a genuinely new one is uniquified.
      key: alreadyInForm ? (match as CapturedName).key : uniqueFieldKey(base, taken),
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
// The review step's starting position
// ---------------------------------------------------------------------------

/** A proposal plus the three things the review screen lets the user decide. */
export type DiscoveredFieldRow<T extends DiscoveredFieldProposal = DiscoveredFieldProposal> =
  T & {
    /**
     * Identity for React and for the dialog's `patchRow`, NOT the field key.
     * Two discovered labels can legitimately resolve to one already-captured
     * field, and a document that prints the same caption twice yields two rows
     * whose labels are identical on purpose — so the row index is the only
     * identity that both survives a reseed and tells those two apart.
     */
    rowId: string;
    include: boolean;
    label: string;
  };

/**
 * Seed the review screen's rows from a proposal list — with NOTHING TICKED.
 *
 * ⚠️ **THAT IS THE #29.10 CHANGE, AND IT IS THE OPPOSITE OF WHAT THIS DID.**
 * Until this slice a row was pre-ticked when it was not already captured, the
 * model called it high-confidence, and the type still had room. All three rules
 * were deliberate and the screen still failed: in the observed run THIRTY-FIVE
 * of thirty-six rows arrived ticked, and the one that did not was the
 * confidence guard working correctly. A default that fires on 97% of rows is
 * not a default, it is an accept-all with a checkbox column drawn over it —
 * and what it accepts is permanent in the one way that matters. A field can be
 * removed from the form again since #27.03; its KEY cannot be removed from the
 * `custom_fields` of every document captured under it in the meantime.
 *
 * ⚠️ **`DocTypeEngine`'s own default is deliberately NOT changed to match, and
 * the difference is the evidence behind the tick.** A field above that screen's
 * Matching % line was found in at least that share of the documents actually
 * read, and the screen prints the count it was computed over. A field proposed
 * here was seen once, in one document, by a model given no schema. Same
 * checkbox, different question — so the same answer would be a reflex rather
 * than a decision.
 *
 * There is deliberately no „tick everything" control to put the old behaviour
 * back one click away. One click that accepts thirty-five unread rows is the
 * same default wearing a hat, and the whole point of the change is that
 * acceptance costs a look.
 *
 * `MAX_TEMPLATE_FIELDS` no longer appears here for the reason it used to:
 * ticking stopped at the ceiling so the dialog could not open on a disabled
 * Save. Nothing is ticked now, so nothing can open over the ceiling; the
 * dialog still counts against it as the user ticks.
 */
export function seedReviewRows<T extends DiscoveredFieldProposal>(
  list: readonly T[],
): Array<DiscoveredFieldRow<T>> {
  return list.map((p, i) => ({ ...p, rowId: String(i), include: false, label: p.labelRo }));
}

/**
 * The key each ticked row would be stored under, derived from the name AS IT
 * STANDS.                                                            (#29.10)
 *
 * ⚠️ **Before this slice the review dialog froze a row's key at proposal time,
 * which made renaming a field cosmetic.** F5 reported names cut out of the
 * prose around them — `pretul_vanzarii_este_de`, `din_totalul_de`. The screen
 * already invited the user to fix those (the name is a text box) and already
 * printed the key under it — and `patchRow` changed only the label, so the
 * fragment was still what got written, permanently, under a caption that no
 * longer mentioned it. Showing a name a user can correct and then storing the
 * one they corrected away is worse than not offering the correction.
 *
 * ⚠️ **This does NOT make a stored key editable.** These rows are fields that
 * do not exist yet; a key is minted once, on Save, from whatever the field
 * ended up being called. A row matching a field the type ALREADY has is skipped
 * entirely — it keeps that field's stored key and is not saveable anyway.
 *
 * ⚠️ **ONLY TICKED ROWS ARE KEYED, AND A ROUND FOUND WHY THE ALTERNATIVE WAS
 * WORSE.** An unticked row is not being added and must not reserve a name — a
 * later row's key would move when an earlier one was unticked. The first
 * version keyed the ticked rows and let the screen fall back to the bare slug
 * for the rest, which was worse still: on a type already holding `suprafata`, a
 * second „Suprafață" row displayed `suprafata` — a key belonging to a different
 * field — until it was ticked. The screen now shows a key only where there is
 * one, which is also the honest reading of the tick.
 *
 * `DocTypeEngine`'s `acceptedKeys` is the precedent, down to the discipline: one
 * shared `taken` set walked left to right and seeded with the keys already in
 * use, so a key minted for an earlier row is unavailable to a later one.
 *
 * Pure and exported rather than a `useMemo` in the component, so the sequences
 * that matter — a rename, a rename onto a stored field, a document that prints
 * one caption twice — are things a test can actually run.
 */
export function keysForReviewRows(
  rows: readonly DiscoveredFieldRow[],
  /**
   * From `capturedFieldNames` — the SAME index `proposeTemplateFields` seeds
   * its own `taken` set from. ⚠️ A review round found this seeded from the
   * stored keys alone, so a second „Nr." row minted `nr` where the proposal had
   * minted `nr_2`, and the screen and the save disagreed with the module that
   * had just decided the row was new.
   */
  captured: ReadonlyMap<string, CapturedName>,
): Map<string, string> {
  const taken = new Set<string>(captured.keys());
  const out = new Map<string, string>();
  for (const row of rows) {
    if (row.alreadyInForm || !row.include) continue;
    // A row with no usable name gets no key. `slugifyFieldKey("")` is `camp`,
    // and printing `camp` under a row while the footer says the name is missing
    // is a screen arguing with itself. `reviewRowIssues` blocks the save.
    if (!normaliseKeyForComparison(rowName(row))) continue;
    out.set(row.rowId, uniqueFieldKey(slugifyFieldKey(rowName(row)), taken));
  }
  return out;
}

/**
 * The name a row would be saved under — the ONE expression every reader uses.
 *
 * ⚠️ **NO FALLBACK TO `labelRo`, AND A REVIEW ROUND IS WHY.** The obvious
 * `label.trim() || labelRo` reads as defensive and is not: it means a user who
 * CLEARS the name box gets the field saved under the caption they just deleted,
 * silently, with the empty-name guard unable to fire because the row is
 * "named". Emptying the box is a decision, and the honest answer to it is the
 * message beside the Save button, not a value the screen puts back.
 *
 * ⚠️ **Four call sites read this and a round found them reading three different
 * expressions** — the key and the save had `.trim()`, the fragment warning had
 * `row.label || row.labelRo`, the ARIA labels had `row.label || row.key`. So a
 * single typed space made the warning disappear while the fragment was still
 * what got stored, and a renamed row was announced to a screen reader by the
 * proposal's opening guess.
 */
export function rowName(row: DiscoveredFieldRow): string {
  return row.label.trim();
}

/**
 * The two ways a ticked row can be un-saveable, both opened by the key
 * following the name.                                                (#29.10)
 *
 * `unnamed` — ⚠️ **A ROW WHOSE NAME CARRIES NO LETTER OR DIGIT.** Two of them
 * save as `camp` and `camp_2`, with „camp" as the visible caption, permanently.
 * Tested on `normaliseKeyForComparison` rather than on `trim()`, and a review
 * round is why: the first version asked whether the label was blank, which
 * `proposeTemplateFields` guarantees it never is — so the guard could not fire
 * at all, while a name of „§ —" sailed through it into `camp`. This covers both
 * a box the user emptied and a name that is only punctuation.
 *
 * `duplicateOfCaptured` — ⚠️ **A ROW THE USER RENAMED ONTO A FIELD THAT IS
 * ALREADY CAPTURED.** `proposeTemplateFields` marks such a row already-in-form
 * before it reaches the screen; a user can type that name in afterwards, and
 * `uniqueFieldKey` politely mints `pret_total_2`. Two columns, identical
 * captions, one meaning. The set compared against is `capturedFieldNames` —
 * wider than the stored template, because a free-text second copy of the
 * document number or of the seller's name is exactly what
 * `proposeTemplateFields` refuses to offer in the first place.
 *
 * ⚠️ **RENAMED, not merely matching** — see the comment at the test itself.
 *
 * ⚠️ **THERE IS DELIBERATELY NO ROW-AGAINST-ROW TEST, AND A REVIEW ROUND PUT IT
 * HERE AND THEN TOOK IT OUT.** `DocTypeEngine` has one, correctly: two of its
 * rows are two distinct clusters, so the same name on both is a mistake. Here
 * two rows with the same name are the SAME CAPTION PRINTED TWICE on one
 * document — a deed naming two parties prints „CNP" twice, a dezmembrare prints
 * „Parcela" once per parcel — and `proposeTemplateFields` mints `cnp` /
 * `cnp_2` for exactly that case, on purpose, with its own comment saying so.
 * The row-against-row version disabled Save on every two-party contract in the
 * archive and printed „two fields would have the same name" beside two rows
 * showing two different keys. Same control, different document, opposite
 * answer.
 */
export function reviewRowIssue(
  row: DiscoveredFieldRow,
  /** From `capturedFieldNames` — see `keysForReviewRows` for why it is that. */
  captured: ReadonlyMap<string, CapturedName>,
): ReviewRowIssue {
  if (row.alreadyInForm || !row.include) return null;
  const name = rowName(row);
  // The empty test is on the RAW name: `slugifyFieldKey("")` is `camp`, which
  // is a perfectly good-looking key for a field with no name.
  if (!normaliseKeyForComparison(name)) return "unnamed";
  /**
   * ⚠️ **THROUGH THE UNCLIPPED SLUG — the form `capturedFieldNames` indexes
   * captions under for exactly this reader, and two rounds each broke on one of
   * the other two candidates.** Comparing the RAW name missed a rename onto a
   * stored field whose caption is longer than a key, because the map is keyed
   * on slugs; comparing the CLIPPED slug refused two different long captions
   * that share their first forty characters. `rawFieldSlug` is the slug before
   * the clip: the same question `proposeTemplateFields` asks, with the length
   * limit left out of it.
   */
  const norm = normaliseKeyForComparison(rawFieldSlug(name));
  // ⚠️ **ONLY A NAME THE USER TYPED IS MEASURED, AND THE SECOND REVIEW ROUND IS
  // WHY.** A row still carrying the caption discovery read has ALREADY been
  // adjudicated by `proposeTemplateFields`: the first occurrence of a repeated
  // caption is the captured field, the second is a genuinely new one and was
  // given a suffixed key on purpose. Measuring the untouched name against the
  // captured set re-decides that and refuses it — on a type already holding
  // `cnp`, a two-party deed's second „CNP" row disabled Save for the whole
  // screen while displaying the perfectly good key `cnp_2`.
  //
  // ⚠️ **Compared NORMALISED, not byte-for-byte, and a THIRD round is why.**
  // Byte equality made „CNP" retyped as „cnp" — or „Preţ" respelled „Preț" — a
  // rename onto a captured field, so a cosmetic correction disabled Save while
  // the untouched spelling of the same name saved happily. A name that
  // normalises onto the one discovery read has not been pointed at a different
  // field, which is the only thing this guard is about.
  if (norm === normaliseKeyForComparison(rawFieldSlug(row.labelRo))) return null;
  return captured.has(norm) ? "duplicate" : null;
}

/** Per-row so the screen can mark the row, folded so the footer can say it. */
export type ReviewRowIssue = "unnamed" | "duplicate" | null;

export function reviewRowIssues(
  rows: readonly DiscoveredFieldRow[],
  captured: ReadonlyMap<string, CapturedName>,
): { unnamed: boolean; duplicateOfCaptured: boolean } {
  let unnamed = false;
  let duplicateOfCaptured = false;
  for (const row of rows) {
    const issue = reviewRowIssue(row, captured);
    if (issue === "unnamed") unnamed = true;
    if (issue === "duplicate") duplicateOfCaptured = true;
  }
  return { unnamed, duplicateOfCaptured };
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
