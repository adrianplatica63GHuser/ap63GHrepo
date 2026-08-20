/**
 * ID-card recognition for the import wizard — Slice #23.01.Import
 *
 * Decides whether a scanned entry is a Romanian identity card, so the import
 * results table can offer "Creează persoană din CI" on that row.
 *
 * Two signals, in priority order:
 *
 *  1. `typeKey` — Haiku's own `suggestedTypeKey`, already whitelisted against
 *     KNOWN_TYPE_KEYS by the scan route. This is the reliable signal and it
 *     was previously ignored entirely.
 *  2. `description` — the free-text `classifiedLabel`, used only when the
 *     model gave no usable key. Matched on a diacritic-folded, case-folded
 *     form, because the label comes back in whatever casing and spelling the
 *     model chose ("Carte de Identitate", "carte de identitate", "CARTE DE
 *     IDENTITATE", with or without ș/ț/ă).
 *
 * The label path carries a deliberate veto list: "carte de identitate a
 * vehiculului" (CIV) is a real Romanian document and a plain substring match
 * on "carte de identitate" classifies it as a person's ID card, which would
 * send a vehicle registration to the ID-card extractor.
 *
 * Slice #23.08.Import added a second, related job to this module: mapping the
 * fields the card extraction already produced onto the Document the import
 * created for the same image (see documentFieldsFromIdCard at the foot of the
 * file). Both halves answer "what does this image mean", so they share a home.
 *
 * Pure module — no React, no fetch, no DB. Unit-tested in
 * src/__tests__/id-card.test.ts and src/__tests__/id-card-document-fields.test.ts.
 */

/**
 * Document-type keys that mean "this is a personal identity card".
 *
 * Slice #23.08.Import removed CARTE_IDENTITATE_ALT. It had been kept as a
 * "defensive match" against a hand-created row or a stale scan, and that
 * justification does not survive inspection:
 *
 *   - This array is matched against Haiku's `suggestedTypeKey`, and the scan
 *     route whitelists that answer against KNOWN_TYPE_KEYS — which has not
 *     contained CARTE_IDENTITATE_ALT since Slice #23.01.Import. The model
 *     cannot emit it any more.
 *   - It cannot arrive from the DB either. An unseeded key never reaches a
 *     lookup_document_type row under its own name: the type resolver finds no
 *     row with that key and auto-creates a type from the free-text label,
 *     generating a DIFFERENT key (see the KNOWN_TYPE_KEYS gotcha in CLAUDE.md;
 *     the resolver is `resolveClassifiedDocumentType` since Slice #29.06).
 *   - Confirmed empirically: `SELECT key FROM lookup_document_type` returns 26
 *     rows and CARTE_IDENTITATE_ALT is not among them.
 *
 * The three real alternate wordings seeded by migration_021 are
 * AUTORIZATIE_ALT, CERTIFICAT_SARCINI_ALT and EXTRAS_CARTE_FUNCIARA_ALT.
 * CARTE_IDENTITATE_ALT looked like a fourth member of that family and never
 * was one — that resemblance is exactly why it survived this long, so if you
 * are about to re-add it, check the seed list first.
 *
 * Kept as an array rather than collapsed to a constant: a genuine alternate
 * wording for an identity card is a one-line addition here, and every consumer
 * already treats it as a set.
 */
export const ID_CARD_TYPE_KEYS = ["CARTE_IDENTITATE"] as const;

/**
 * Lowercase and strip Romanian diacritics.
 *
 * NFD decomposition handles both encodings of ș/ț that appear in practice —
 * comma-below (U+0219/U+021B, correct Romanian) and cedilla (U+015F/U+0163,
 * the legacy Turkish-borrowed forms still emitted by some OCR and fonts) —
 * because both decompose to a base letter plus a combining mark.
 */
export function foldRomanian(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Labels that describe a different document but contain an ID-card phrase.
 * Checked before the positive patterns, so a veto always wins.
 */
const VETO_PATTERNS: RegExp[] = [
  // "carte de identitate a vehiculului" / "... auto" — vehicle registration.
  /vehicul/,
  /\bauto(mobil|turism)?\b/,
  /\bremorc/,
];

const POSITIVE_PATTERNS: RegExp[] = [
  /carte\s+(de\s+)?identitate/,
  /\bbuletin\b/,
  /act\s+de\s+identitate/,
  /\bid\s*card\b/,
  /\bidentity\s+card\b/,
  // Standalone "CI" / "C.I." — bounded so it never fires inside CIF, CIV,
  // "cinci", etc.
  /(^|[^a-z0-9])c\.?\s?i\.?([^a-z0-9]|$)/,
];

/**
 * Does this free-text classification label describe an identity card?
 * Exported separately so the label heuristic can be tested on its own.
 */
export function isIdCardLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const folded = foldRomanian(label);
  if (!folded) return false;
  if (VETO_PATTERNS.some((re) => re.test(folded))) return false;
  return POSITIVE_PATTERNS.some((re) => re.test(folded));
}

/**
 * Does this document TYPE's NAME describe the identity-card type?
 *                                                              (Slice #27.05)
 *
 * ⚠️ **A NARROWER TEST THAN `isIdCardLabel`, deliberately, and an adversarial
 * round is why it is a second function rather than a second caller of that
 * one.** The two read different distributions. `isIdCardLabel` judges a model's
 * free-text classification of a scanned IMAGE, where a bare "buletin" or a
 * standalone "CI" is reasonably a card; this judges a row in a land-registry
 * archive's type list, where "Buletin de analiză", "Buletin de încercare" and
 * "Copie CI" are ordinary names and `VETO_PATTERNS` — which only knows about
 * vehicles — does not save them. A false positive here is silent and costs a
 * whole type its form: #27.05 excludes it from discovery for the run and its
 * rows never say a form is missing.
 *
 * So only the unambiguous wordings — but ALL of them, and a fifth adversarial
 * round is why that second half matters as much as the first. A first draft
 * matched `(carte|act) de identitate` and nothing else, which misses every one
 * of these: **"Buletin de identitate"** (the pre-1997 official name, and the
 * label a model reaches for), **"Cartea de identitate"** (the definite article —
 * the form this very file uses in `ID_CARD_NOTE_LINE`), "Acte de identitate",
 * "Cărți de identitate". Those are not corner cases: `ensureDocType` POSTs the
 * scan's own free-text label as a type NAME, so the run that correctly declines
 * to read a card can persist exactly such a row — and the NEXT run finds it in
 * the type list, answers `false` here, and reads it.
 *
 * The KEY is the real answer wherever there is one (`ID_CARD_TYPE_KEYS`); this
 * arm exists for a row somebody added by hand, or one an import invented from a
 * classified label.
 *
 * The vehicle veto is kept: "carte de identitate a vehiculului" is a car's
 * registration document and is exactly the phrase this would otherwise match.
 *
 * No `\b` anywhere near the Romanian — it is ASCII-only and this text has been
 * folded, not transliterated; the space-and-anchor forms below say the same
 * thing without it.
 */
export function isIdCardTypeName(name: string | null | undefined): boolean {
  const folded = foldRomanian(name ?? "");
  if (!folded) return false;
  if (VETO_PATTERNS.some((re) => re.test(folded))) return false;
  // `carte` / `cartea` / `carti` (folded from cărți), `act` / `acte`, and
  // `buletin` — each optionally followed by "de", then "identitate". A bare
  // "buletin" or a standalone "CI" is deliberately NOT here: those are what
  // `isIdCardLabel` reads off a scanned image, and what make "Buletin de
  // analiză" and "Copie CI" false positives in a type list.
  return /(^|[^a-z0-9])(cart(e|ea|i)|act(e)?|buletin)\s+(de\s+)?identitate([^a-z0-9]|$)/.test(
    folded,
  );
}

/** The shape this module needs off a ScanResult. Structural, not imported. */
export type IdCardScanSignal = {
  typeKey?: string | null;
  description?: string | null;
};

/**
 * Is this scanned entry an ID card?
 *
 * A confident non-ID `typeKey` VETOES the label: if the model already decided
 * the document is a Contract de Vânzare, a stray "buletin" in its prose label
 * must not override that. Only a missing key, or the explicitly-uncertain
 * UNCLASSIFIED, falls through to the label heuristic.
 */
export function isIdCardEntry(scan: IdCardScanSignal | null | undefined): boolean {
  if (!scan) return false;

  const key = scan.typeKey?.trim();
  if (key) {
    if ((ID_CARD_TYPE_KEYS as readonly string[]).includes(key)) return true;
    if (key !== "UNCLASSIFIED") return false;
  }

  return isIdCardLabel(scan.description);
}

// ---------------------------------------------------------------------------
// Slice #23.08.Import — card fields → the Document the import already created
// ---------------------------------------------------------------------------
//
// Adrian's question was why an ID-card row offered two buttons. "Interpretează
// cu AI" built its prompt from the document type's template_fields, and
// CARTE_IDENTITATE has no template — so on an ID card it asked for four generic
// baseline fields and little else, while extract-id-card had ALREADY read the
// card number, the issuing authority and both validity dates. A second
// Anthropic call that returned less than the first one already had.
//
// So the card write folds into "Creează persoană": one button, one AI call,
// more data than either had alone.
//
// ── What is deliberately NOT mapped ──────────────────────────────────────────
//
// cnp, dateOfBirth, placeOfBirth, gender and idMrzRaw describe the PERSON, and
// they are already written to natural_person by the same action. Copying them
// onto the Document would create a second, freely-editable copy of a CNP that
// migration_025's trigger makes immutable on the person — two sources of truth
// for the one field the schema goes out of its way to protect. The Document
// gets the fields that describe the card AS A DOCUMENT, and nothing else.
//
// institutionId is not a target either: it is an FK to lookup_institution, so
// resolving "SPCLEP Bragadiru" would mean auto-creating lookup rows from an AI
// reading — the exact trap the KNOWN_TYPE_KEYS gotcha records. The issuing
// authority goes into the free-text `subject` instead.
//
// No customFields keys are invented. CARTE_IDENTITATE has no template_fields,
// and a key written without a template is invisible in the document form. If
// richer per-field capture on ID cards is wanted, the right move is a
// template_fields template for the type — a data change, not a code change.
//
// Pure module: no React, no fetch, no DB. Unit-tested in
// src/__tests__/id-card-document-fields.test.ts.

/** Card-derived values, as they stand in the review form at submit time. */
export type IdCardDocumentSource = {
  idCardNumber?: string | null;
  idIssuingAuthority?: string | null;
  idValidFrom?: string | null;
  idValidUntil?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

/** The Document's current values, as read back before the patch is built. */
export type IdCardDocumentCurrent = {
  title?: string | null;
  nrDocument?: string | null;
  dateDocument?: string | null;
  dateValidUntil?: string | null;
  subject?: string | null;
  notes?: string | null;
};

/** Only the keys that should actually change. Empty object = nothing to write. */
export type IdCardDocumentPatch = {
  title?: string;
  nrDocument?: string;
  dateDocument?: string;
  dateValidUntil?: string;
  subject?: string;
  notes?: string;
};

/**
 * Romanian prefix for the `subject` line. Always Romanian, never translated —
 * see ID_CARD_NOTE_LINE below for why.
 */
export const ID_CARD_SUBJECT_PREFIX = "Eliberată de ";

/** Romanian prefix for a generated document title. */
export const ID_CARD_TITLE_PREFIX = "CI ";

/**
 * Marker that makes the notes append idempotent.
 *
 * Deliberately machine-shaped: a human writing a note about an identity card
 * might reasonably type "[CI]", and a false positive there would silently
 * suppress the provenance line on a document that never had one.
 */
export const ID_CARD_NOTE_MARKER = "[CI-AI]";

/**
 * The provenance line appended to the Document's notes.
 *
 * ⚠️ Hardcoded Romanian, ON PURPOSE, and this is not a violation of the
 * two-track i18n rule. That rule governs UI STRINGS — text next-intl renders
 * for whoever is looking. The moment this sentence is written into
 * document.notes it stops being UI and becomes user DATA, living in a Romanian
 * record that Romanian users read. Sourcing it from the active locale would
 * mean an en-GB session permanently stamps an English sentence into a Romanian
 * document's notes, which is precisely the outcome the project rule "Romanian
 * user data stays Romanian and is never translated" exists to prevent.
 *
 * The WHEN is not recorded here on purpose — document.aiInterpretedAt carries
 * it, and a timestamp inside the text would make the marker check the only
 * thing standing between a re-run and a growing pile of near-identical lines.
 */
export const ID_CARD_NOTE_LINE =
  `${ID_CARD_NOTE_MARKER} Date preluate automat de pe cartea de identitate (interpretare AI).`;

/** Trimmed-non-empty. A whitespace-only field counts as absent. */
const filled = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.trim() !== "";

/**
 * ISO calendar date, the only shape `date` columns accept.
 *
 * The review form's inputs are `type="date"` so they already produce this, but
 * the guard is worth its two lines: a malformed date does not fail on its own,
 * it makes Postgres reject the WHOLE patch, so one bad character would cost
 * every other field on the card. Failing one field closed is strictly better
 * than failing five open.
 */
const isoDate = (v: string | null | undefined): v is string =>
  filled(v) && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

/**
 * Build the single PATCH body for the Document behind an ID-card row.
 *
 * ── Write-if-empty ───────────────────────────────────────────────────────────
 *
 * A value is only ever written into a target the Document has left blank. In
 * the normal case the two rules coincide — the bulk import created this
 * Document seconds earlier and every target is null — but write-if-empty makes
 * a second click on the row, or a card re-read against a document someone has
 * since filled in, non-destructive for free. Nothing a human typed is ever
 * overwritten by a machine reading.
 *
 * ── One PATCH ────────────────────────────────────────────────────────────────
 *
 * Everything travels together because `document` is versioned: two PATCHes
 * would append two document_version rows for one click, which is the defect
 * Slice #23.02.Import recorded when it replaced the orphaned two-call code.
 * If every target is already filled this returns `{}` and the caller sends only
 * aiInterpretedAt — which is not versioned, so the no-op backstop appends no
 * version row at all rather than an empty one.
 */
export function documentFieldsFromIdCard(
  card: IdCardDocumentSource,
  current: IdCardDocumentCurrent,
): IdCardDocumentPatch {
  const patch: IdCardDocumentPatch = {};

  // Card series+number → "Nr. document". The card's own identifier.
  if (filled(card.idCardNumber) && !filled(current.nrDocument)) {
    patch.nrDocument = card.idCardNumber.trim();
  }

  // Valid-from IS the issue date on a Romanian CI, which is what dateDocument
  // means for this type ("Data eliberării").
  if (isoDate(card.idValidFrom) && !filled(current.dateDocument)) {
    patch.dateDocument = card.idValidFrom.trim();
  }

  if (isoDate(card.idValidUntil) && !filled(current.dateValidUntil)) {
    patch.dateValidUntil = card.idValidUntil.trim();
  }

  if (filled(card.idIssuingAuthority) && !filled(current.subject)) {
    patch.subject = `${ID_CARD_SUBJECT_PREFIX}${card.idIssuingAuthority.trim()}`;
  }

  // Title is generated from the name only when the import left it blank — a
  // file the user deliberately named keeps its name.
  if (!filled(current.title)) {
    const name = [card.lastName, card.firstName]
      .filter(filled)
      .map((s) => s.trim())
      .join(" ");
    if (name) patch.title = `${ID_CARD_TITLE_PREFIX}${name}`;
  }

  // The provenance line goes on only when something was actually written —
  // a note claiming data was taken from the card, on a document where nothing
  // was, would be a lie in the one place nobody would think to check.
  const wroteSomething = Object.keys(patch).length > 0;
  const alreadyNoted = (current.notes ?? "").includes(ID_CARD_NOTE_MARKER);
  if (wroteSomething && !alreadyNoted) {
    patch.notes = filled(current.notes)
      ? `${current.notes.trimEnd()}\n\n${ID_CARD_NOTE_LINE}`
      : ID_CARD_NOTE_LINE;
  }

  return patch;
}

/** How many real document FIELDS a patch carries (the notes line is not one). */
export function idCardDocumentFieldCount(patch: IdCardDocumentPatch): number {
  return Object.keys(patch).filter((k) => k !== "notes").length;
}

// ---------------------------------------------------------------------------
// Slice #26.08 — the same question, asked of a NAME, several stages earlier
// ---------------------------------------------------------------------------

/**
 * Does this file or folder NAME say it is an identity card?
 *
 * ⚠️ **A weaker signal than `isIdCardEntry`, used at a point where the strong
 * one does not exist yet.** Everything above this line reads Haiku's verdict,
 * which arrives at the Scanning stage. The Pre-existing stage runs BEFORE
 * classification — its whole purpose is to decide what to send there — so the
 * only evidence it has about a JPEG is what it is called.
 *
 * #26.01 met the same wall and reached the opposite conclusion: the source
 * document's "ID card scans sit directly under the property folder" was DROPPED
 * as a structure rule, because a rule that BLOCKS an import cannot rest on a
 * naming convention nobody was told to follow. That reasoning does not
 * transfer, and the difference is which way being wrong hurts:
 *
 *  - A structure rule that guesses wrong REFUSES a correct folder and sends a
 *    business user to rename files to satisfy a machine. Unaffordable.
 *  - This test guessing wrong imports a document a second time. That is the
 *    outcome Adrian's constraint explicitly PREFERS — "a duplicate person in
 *    the system is better than a missing one" — so a false positive costs a
 *    duplicate and a false negative costs a person.
 *
 * So it is deliberately allowed to over-claim, and the copy that reports it
 * says plainly that this is what is happening.
 *
 * ⚠️ **It also catches precisely the dangerous case, which is not a
 * coincidence.** The pre-existing match is name-and-size (see
 * `preexisting-check.ts`), so a WRONG match needs two different cards sharing a
 * file name — `Buletin.jpg`, `CI.jpg`, `Carte identitate.jpg` — and those are
 * the very names this test recognises. A card named `scan001.jpg` is not
 * covered, and cannot be: nothing in its name or its byte count says what it
 * is. That residual gap is why the report asks the user to check afterwards
 * rather than claiming the exception is complete.
 *
 * The extension comes off first, so the question asked is about the name the
 * user typed rather than about the format it was saved in. `isIdCardLabel`
 * folds diacritics before matching, which is also what makes the ASCII `\b`
 * anchors in `POSITIVE_PATTERNS` legitimate here — by the time they run there
 * is no non-ASCII letter left for them to mis-anchor against. (See CLAUDE.md's
 * standing warning about `\b` and Romanian: it applies to matching RAW text,
 * and every pattern in this module matches folded text only.)
 */
export function looksLikeIdCardName(name: string): boolean {
  const dot = name.lastIndexOf(".");
  // `dot > 0`, not `dot >= 0`: a dotfile is all stem, and `.buletin` must be
  // matched on the whole of it rather than stripped to nothing.
  const stem = dot > 0 ? name.slice(0, dot) : name;
  // ⚠️ **UNDERSCORES BECOME SPACES FIRST, and leaving them out was a real hole
  // found by this slice's adversarial review.** `_` is an ASCII WORD character,
  // so `\b` does not fire beside it: `Buletin.jpg` matched and
  // `Buletin_Popescu.jpg`, `Buletin_2.jpg` and `Carte_de_identitate.jpg` all
  // did not. Underscore-as-separator is this archive's own convention —
  // `folderNameToTitleHint` exists to turn `CVC_2021-04-12` into a title — so
  // the misses were the ordinary spellings rather than exotic ones, and each
  // was an identity card silently taking the "already in the system" path.
  //
  // Hyphens need no such treatment: `-` is not a word character, so `\b`
  // already fires beside it.
  return isIdCardLabel(stem.replace(/_+/g, " "));
}
