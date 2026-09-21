/**
 * The instruments a deed CITES, and the ranking that suggests which archived
 * document each one might be.                                  (Slice #36.03)
 *
 * ---------------------------------------------------------------------------
 * WHY THIS MODULE EXISTS AT ALL — IT IS 36.01'S HOLE, AND 36.01 NAMES IT
 * ---------------------------------------------------------------------------
 *
 * Slice #36.01's central decision is that the four repeating groups on a sale
 * contract — parties, objects, the seller's title chain, the supporting
 * certificates — are ASSOCIATIONS and never template fields, because
 * `document.custom_fields` is a flat `Record<string, string | null>` and a
 * `_2` suffix is finding F5 of the #29.01 import report coming back. That
 * decision is right and is not reopened here.
 *
 * But it leaves the reader with nowhere to put what it finds. When the model
 * reads „Titlu de proprietate nr. 65106/11.06.1996 emis de CJSDPT Giurgiu" it
 * cannot write a field, because 36.01 deliberately made none, and it cannot
 * create a link, because the instrument may not be in the archive at all — the
 * 1996 titlu usually exists ONLY as this citation. So it lands in
 * `unmappedRaw` and is folded into „Note extinse" by `ai-interpret/route.ts`,
 * which is the designed behaviour, is correct, and is also exactly the symptom
 * Adrian named as bad.
 *
 * The cure is not to stop folding leftovers into notes. It is to stop these
 * being leftovers. `referencedInstruments[]` is asked for beside `parties[]`,
 * returned beside `parties[]`, and — like `parties[]` — **WRITTEN BY NOBODY**
 * until a person says so.
 *
 * ---------------------------------------------------------------------------
 * CLIENT-SAFE, AND THAT IS A CONSTRAINT RATHER THAN AN OBSERVATION
 * ---------------------------------------------------------------------------
 *
 * The reference-linker dialog imports this file, so it must never pull in `db`,
 * `node:fs`, or anything that transitively does. It imports two pure modules
 * and nothing else:
 *
 *   * `foldLookupName` from `@/lib/import/lookup-name-match` — the issuer fold,
 *   * `sameDocumentTypeName` from `@/lib/documents/document-type-match` — the
 *     type-name test.
 *
 * ⚠️ **AND IT WRITES NO FOLD OF ITS OWN.** There are already three in this
 * codebase (`foldLookupName`, `normaliseDocumentTypeName`,
 * `preexistingKeyOf`); a fourth would be the fourth copy of a comparison rule
 * that has to agree with the other three forever. `foldDocumentNumber` below is
 * the ONE new normaliser, and it is new because none of the three is about
 * NUMBERS — they all keep digits and drop nothing else, where a document number
 * needs „nr. 03264" and „3264" to be one number.
 *
 * ⚠️ **AND IT DOES NOT IMPORT `canonicalTypeKey`.** Whitelisting the model's
 * `typeKey` against the known catalogue is the ROUTE's job, on the server,
 * before the entry is ever stored — `classify-prompts.ts` carries the
 * catalogue and a client bundle has no business holding it. By the time an
 * entry reaches this module its key has already been through that door or is
 * `null`.
 */

import { foldLookupName } from "@/lib/import/lookup-name-match";
import { sameDocumentTypeName } from "@/lib/documents/document-type-match";

// ---------------------------------------------------------------------------
// What an instrument is FOR on the deed that cites it
// ---------------------------------------------------------------------------

/**
 * ⚠️ **ASKED OF THE MODEL RATHER THAN INFERRED FROM THE TYPE, AND THAT IS THE
 * CHEAP HALF OF THIS SLICE.** The model has the sentence in front of it — „…a
 * dobândit prin…", „…s-a prezentat…", „…completează contractul…" — and the
 * page it is reading has already been paid for. Deriving the purpose afterwards
 * from the document TYPE cannot work and is not a near miss: a
 * `CERTIFICAT_MOSTENITOR` is a title-chain link on one deed and a supporting
 * certificate on another, and a `CONTRACT_VANZARE` is the PARENT on an act
 * adițional and a title-chain link on a later sale. The same type, three
 * answers.
 *
 * The purpose is what becomes the relationship role, which is why it is a
 * closed list of four and not free text.
 */
export const INSTRUMENT_PURPOSES = [
  /** The instrument the seller's own right came from. */
  "TITLE_CHAIN",
  /** A certificate or authorisation produced FOR this deed. */
  "SUPPORTING",
  /** The instrument THIS document completes — an act adițional's parent. */
  "PARENT",
  /** The promise that preceded this sale. */
  "PROMISE",
] as const;

export type InstrumentPurpose = (typeof INSTRUMENT_PURPOSES)[number];

export function isInstrumentPurpose(v: unknown): v is InstrumentPurpose {
  return typeof v === "string" && (INSTRUMENT_PURPOSES as readonly string[]).includes(v);
}

/**
 * The `lookup_document_document_role.name` each purpose links under, exactly as
 * `migration_086` and `src/db/sync-reference-data.sql` seed it — diacritics
 * included, because that is what is stored and what the role is resolved by.
 *
 * ⚠️ **RESOLVED BY NAME AND NOT BY ID, AND THE FOLD IS WHY THAT IS SAFE.**
 * These rows have no `key` column — `lookup_document_document_role` is
 * `id/name/description/sort_order` — so a name is the only stable handle
 * available, and the ids differ between every database. The server resolves
 * them through `foldLookupName`, so a row an admin renamed to drop a diacritic
 * still resolves. A row renamed to something else entirely does not, and the
 * linker says so rather than linking under the wrong role.
 */
export const PURPOSE_ROLE_NAME: Readonly<Record<InstrumentPurpose, string>> = Object.freeze({
  TITLE_CHAIN: "Titlu anterior al",
  SUPPORTING:  "Înscris doveditor pentru",
  PARENT:      "Act adițional la",
  PROMISE:     "Antecontract al",
});

/**
 * Which way each role reads, expressed once, in the only terms that are stable:
 * **from the CITED instrument to the CITING document**, or the other way.
 *
 * ⚠️ **THIS IS NOT `role_reads_a_to_b`, AND CONFLATING THE TWO IS THE DEFECT
 * THIS SLICE EXISTS TO FIX.** `role_reads_a_to_b` is about `document_id_a` and
 * `document_id_b`, which are ordered BY UUID and mean nothing. This table is
 * about the deed and the instrument it names, which is what the sentence on the
 * page actually says. `linkDirection` below is the one function that converts
 * the second into the first, and it is the only place the uuid order is ever
 * looked at.
 *
 *   „Titlu anterior al"        titlu  -> deed      (cited -> citing)
 *   „Înscris doveditor pentru" extras -> deed      (cited -> citing)
 *   „Act adițional la"         act    -> parent    (CITING -> cited)
 *   „Antecontract al"          antec. -> deed      (cited -> citing)
 *
 * PARENT is the odd one and is odd for a real reason: on an act adițional the
 * CITING document is the dependent one. Every other purpose names something the
 * deed leans on; PARENT names the thing the deed is attached to.
 */
export const PURPOSE_READS_CITED_TO_CITING: Readonly<Record<InstrumentPurpose, boolean>> =
  Object.freeze({
    TITLE_CHAIN: true,
    SUPPORTING:  true,
    PARENT:      false,
    PROMISE:     true,
  });

/**
 * The `(document_id_a, document_id_b, role_reads_a_to_b)` triple for a link
 * between the deed on screen and the instrument it cites.
 *
 * ⚠️ **THE `.sort()` IS THE CANONICALISATION AND NOTHING ELSE.** It exists to
 * satisfy `CHECK document_document_order (document_id_a < document_id_b)`, so
 * one pair cannot be stored twice. It says nothing about the relationship, and
 * the boolean is what carries the meaning it destroys.
 */
export function linkDirection(
  citingDocumentId: string,
  citedDocumentId: string,
  purpose: InstrumentPurpose,
): { documentIdA: string; documentIdB: string; roleReadsAToB: boolean } {
  const [documentIdA, documentIdB] = [citingDocumentId, citedDocumentId].sort();
  const from = PURPOSE_READS_CITED_TO_CITING[purpose] ? citedDocumentId : citingDocumentId;
  return { documentIdA, documentIdB, roleReadsAToB: from === documentIdA };
}

// ---------------------------------------------------------------------------
// The stored entry
// ---------------------------------------------------------------------------

/**
 * What a person did with one reference. `PENDING` is every entry a read
 * produces, and it is the only value the model's answer can arrive as.
 *
 * ⚠️ **`LEFT` IS NOT AN ERROR AND MUST NOT READ AS ONE.** A reference nobody
 * could place stays in „Note extinse" exactly as it does today, which is the
 * correct home for something nobody could place. The dialog counts it, the tab
 * does not nag about it, and no screen shows it in red.
 */
export const INSTRUMENT_STATUSES = ["PENDING", "LINKED", "STUBBED", "LEFT"] as const;
export type InstrumentStatus = (typeof INSTRUMENT_STATUSES)[number];

export function isInstrumentStatus(v: unknown): v is InstrumentStatus {
  return typeof v === "string" && (INSTRUMENT_STATUSES as readonly string[]).includes(v);
}

export type ReferencedInstrument = {
  /** A `KNOWN_DOCUMENT_TYPES` key, already whitelisted by the route, or null. */
  typeKey:      string | null;
  /** The model's own Romanian words for the type — „Titlu de proprietate". */
  typeLabel:    string | null;
  /** The number as printed. Never normalised in storage; see `foldDocumentNumber`. */
  nrDocument:   string | null;
  /** ISO `yyyy-mm-dd`, or null. */
  dateDocument: string | null;
  /** The issuer as printed — „CJSDPT Giurgiu", „BNP Dumitrescu Florentina". */
  issuer:       string | null;
  purpose:      InstrumentPurpose | null;
  /**
   * The page's own wording, verbatim.
   *
   * ⚠️ **THE ONE FIELD THE SCREEN MUST ALWAYS SHOW.** Everything else here is
   * the model's reading; this is what it read. A user deciding whether
   * candidate DOC01511 is the titlu this deed means is checking it against the
   * scan, and the scan's own sentence is what makes that possible.
   */
  rawText:      string;
  status:       InstrumentStatus;
  /** Set when `status` is LINKED or STUBBED — the document it ended up as. */
  linkedDocumentId: string | null;
};

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

/** ISO `yyyy-mm-dd` or null. Anything else the model sends is dropped. */
const isoDate = (v: unknown): string | null => {
  const s = str(v);
  if (s === null || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Reject 2006-02-31 and friends: a date that does not exist is a misread, and
  // storing it would make a date comparison quietly impossible to satisfy.
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
    ? s
    : null;
};

/**
 * One entry of the model's answer, made safe, or `null` because there is
 * nothing here worth showing a person.
 *
 * ⚠️ **`rawText` IS THE ONLY REQUIRED FIELD, AND THE BAR IS DELIBERATELY THAT
 * LOW.** A citation with no number and no date is still a citation — „titlul de
 * proprietate al autoarei" with nothing else — and the right answer for it is
 * „lasă", which a person can only give if the screen shows it. Dropping it here
 * would put it straight back into „Note extinse", which is the behaviour this
 * slice is removing. What is dropped is an entry with no wording at all, which
 * is not a citation, it is an empty object.
 *
 * ⚠️ **`status` AND `linkedDocumentId` ARE FORCED, NOT READ, ON THIS PATH.**
 * This function sanitises a MODEL's answer, and a model that returned
 * `"status": "LINKED"` must not be able to make the screen show a link nobody
 * made. `parseReferencedInstruments` — which reads the STORED column, written
 * by the route after a person pressed a button — is the one that keeps them.
 */
export function sanitizeExtractedInstrument(raw: unknown): ReferencedInstrument | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const rawText = str(r.rawText);
  if (rawText === null) return null;
  const purpose = r.purpose;
  return {
    typeKey:      str(r.typeKey),
    typeLabel:    str(r.typeLabel),
    nrDocument:   str(r.nrDocument),
    dateDocument: isoDate(r.dateDocument),
    issuer:       str(r.issuer),
    purpose:      isInstrumentPurpose(purpose) ? purpose : null,
    rawText,
    status:       "PENDING",
    linkedDocumentId: null,
  };
}

/**
 * The stored column, made safe.
 *
 * ⚠️ **NULL AND `[]` ARE DIFFERENT AND BOTH ARE ORDINARY**, and this function
 * cannot tell you which you had — it answers `[]` for both. `NULL` means the
 * document has never been read for references (every document imported before
 * this slice); `[]` means it was read and cited nothing. The caller that needs
 * to tell them apart — the tab, which offers „citește referințele" on the first
 * and „nicio referință" on the second — tests the column for `null` itself,
 * before calling this.
 */
export function parseReferencedInstruments(raw: unknown): ReferencedInstrument[] {
  if (!Array.isArray(raw)) return [];
  const out: ReferencedInstrument[] = [];
  for (const entry of raw) {
    const base = sanitizeExtractedInstrument(entry);
    if (base === null) continue;
    const r = entry as Record<string, unknown>;
    const status = isInstrumentStatus(r.status) ? r.status : "PENDING";
    const linkedDocumentId = status === "LINKED" || status === "STUBBED" ? str(r.linkedDocumentId) : null;
    out.push({ ...base, status, linkedDocumentId });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Number folding — the ONE new normaliser in this file
// ---------------------------------------------------------------------------

/**
 * A document number reduced to what two spellings of the same number share.
 *
 * Digits and letters only, lower-cased, diacritics stripped, and **leading
 * zeros removed from each run of digits** — „nr. 03264" and „3264" are one
 * number; „165/2754" keeps both halves as `165/2754` would fold to `1652754`,
 * which is why the separator is kept as a single `/` rather than dropped.
 *
 * ⚠️ **THE SLASH IS KEPT AND EVERY OTHER SEPARATOR IS NOT, AND ONE REAL
 * CITATION IS WHY.** Deed 5 of the sample set cites „Ofertă vânzare
 * 165/2754/31.05.2016" — a compound number, not a number and a date. Dropping
 * the slash folds it onto the single number `1652754`, which matches nothing
 * and would match the wrong thing if it ever did. Keeping it means a stored
 * `165/2754` and a cited `165 / 2754` are one number, which is what a person
 * reading the page would say.
 *
 * ⚠️ **NOT `foldLookupName`, AND NOT BECAUSE OF NOT-INVENTED-HERE.**
 * `foldLookupName` collapses to `[a-z0-9 ]` and keeps single spaces because it
 * feeds a whole-word SUBSTRING test over institution names. It has no notion of
 * a leading zero and it would turn „nr. 3264" into `nr 3264`, so the same
 * number written with and without the abbreviation would not compare equal.
 * This is a different question about a different kind of string.
 */
export function foldDocumentNumber(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Everything that is not a letter, a digit or a slash becomes a separator,
    // then the separators go — a number has no words in it worth keeping.
    .replace(/[^a-z0-9/]+/g, "")
    // „nr", „no" and „număr" are the only prefixes worth removing: they are
    // written by transcribers, never by the instrument.
    .replace(/^(?:nr|no|numar)/, "")
    // ⚠️ **LEADING zeros only — the boundary group is the whole of this rule,
    // and its first draft was a data-corrupting bug that the measurement over
    // the sample corpus caught on its first run.** `/0+(\d)/g` looks like „strip
    // leading zeros" and is not: it matches ANYWHERE, so the real titlu de
    // proprietate number 65106 folded to 6516 — an internal zero eaten, a
    // number that matches nothing, and silently, because a fold that returns a
    // plausible string has no way to complain. `(^|[^0-9])` pins the run to the
    // start of the string or to the character after a separator, which is what
    // „leading" actually means once a number may contain a slash.
    //
    // So 03264 == 3264 and 165/02754 == 165/2754, while 65106 is left alone. A
    // run that is ALL zeros collapses to one „0" rather than to nothing, so „0"
    // stays a number and does not become an empty fold.
    .replace(/(^|[^0-9])0+(\d)/g, "$1$2")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

/**
 * Is this number too common to be evidence on its own?
 *
 * ⚠️ **MEASURED, NOT CHOSEN.** The corpus is the instrument citations of the
 * six deeds transcribed in full in
 * `dev.docs\01.Slice.Inputs\Slices.36.nn.CVC.etc\Grok.CVC-semantic-template-filled-examples-v01.docx`
 * — six of the thirty-two deed folders under
 * `C:\dev\TEST.DATA\Modele.Acte\ZZZ Modele acte`, chosen there as one of
 * each of the six kinds. **45 citations, 43 distinct instruments.** The corpus
 * and every number below are reproduced in
 * `src/__tests__/document-reference-ranking.test.ts`, which fails if the
 * thresholds move without the counts moving with them.
 *
 * Folded digit lengths across those 45: **two of 2 digits, thirteen of 3,
 * eighteen of 4, eleven of 5, one of 7** (the compound „165/2754").
 *
 * The two short ones are „10" (încheiere de completare 10/18.02.2015, BNP
 * Haiduc) and „53" (procură rectificativă 53/07.08.2015). Both are genuine
 * instruments, and both would, on the number alone, tie against practically
 * anything — this archive's own folder names carry tarla 2, tarla 3, parcela 11,
 * parcela 14, parcela 45 and a hundred more, and Adrian's own example is a „3"
 * that is a parcela, a tarla and a contract number in three different rows.
 *
 * So the rule is: **fewer than three significant digits is not a candidate on
 * the number alone.** It is not a rule about being a candidate at all — measured
 * on „10" against an archive holding one dated match and three undated rows
 * carrying the same number, the dated one IS offered (tier `fair`) and the three
 * are not. What the rule removes is the case with nothing else to go on.
 *
 * ⚠️ **THREE, NOT FOUR, AND THE COST OF FOUR IS MEASURED TOO.** At `< 3` the
 * rule can silence **2 of 45 (4%)**. At `< 4` it would silence **15 of 45
 * (33%)** — 914, 918, 898, 828, 325, 310, 128, 574, 770, 846, 443, 305, 220 are
 * every one of them a real, distinct instrument — and at `< 5`, **33 of 45
 * (73%)**. The point of the rule is to stop an embarrassing suggestion, not to
 * stop suggesting.
 */
export function isCommonDocumentNumber(folded: string): boolean {
  const digits = folded.replace(/\D/g, "");
  return digits.length > 0 && digits.length < 3;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/** One archived document a reference might be. Everything the ranker reads. */
export type InstrumentCandidateDoc = {
  id:              string;
  code:            string;
  title:           string | null;
  typeName:        string | null;
  nrDocument:      string | null;
  dateDocument:    string | null;
  institutionName: string | null;
  /** True when this document has no `document_page` rows — see the stub rule. */
  isStub:          boolean;
};

export type MatchSignal = "number" | "date" | "type" | "issuer";

/**
 * How good a candidate is, in the three words a person can act on.
 *
 * ⚠️ **A TIER AND NOT A PERCENTAGE, DELIBERATELY.** „nr. 3264 și data
 * 23.11.2007 se potrivesc; notarul nu e completat pe documentul din arhivă" is
 * a sentence a business user can act on. „87% încredere" is not: it invites the
 * question „what would 88% have meant?", which has no answer, and it invites a
 * threshold, which this slice refuses to have. The dialog builds that sentence
 * from `matched` and `missing`; this module never writes prose.
 */
export type CandidateTier = "strong" | "fair" | "weak";

export type InstrumentCandidate = {
  document: InstrumentCandidateDoc;
  tier:     CandidateTier;
  /** Signals that agree, in a stable order — the dialog renders these. */
  matched:  MatchSignal[];
  /**
   * Signals that could NOT be compared because one side is blank.
   *
   * ⚠️ **„NOT COMPARABLE" IS NOT „DISAGREES", AND THE SCREEN SAYS SO.** A
   * candidate whose `institution_id` is null has a missing issuer, not a wrong
   * one — that is the „notarul nu e completat pe documentul din arhivă" half of
   * the sentence above, and it is the commonest state in this archive. A signal
   * that genuinely DISAGREES is in neither list, because a disagreement is
   * fatal: see `rankInstrumentCandidates`.
   */
  missing:  MatchSignal[];
};

const TIER_ORDER: Record<CandidateTier, number> = { strong: 0, fair: 1, weak: 2 };

/**
 * The archived documents a cited instrument might be, best first.
 *
 * **SUGGESTS; NEVER DECIDES.** Nothing in this slice writes a `document_document`
 * row that a person did not confirm, and no tier is high enough to change that.
 * This function returns an ordered list for a human to read.
 *
 * THE RULES, IN THE ORDER THEY APPLY
 *
 *   1. **A DISAGREEMENT IS FATAL, WHATEVER ELSE AGREES.** Two documents with
 *      different numbers are not the same document, however well the dates line
 *      up; two with different dates are not either. This is the rule that keeps
 *      the list short, and it is why there is no scoring: a score lets three
 *      agreements outvote one contradiction, which for identity is never right.
 *      Type and issuer are the exceptions — see 3.
 *
 *   2. **THE NUMBER IS REQUIRED.** A candidate with no number in common is not
 *      offered at all. A date and a type alone describe every certificat fiscal
 *      the commune issued that morning.
 *
 *   3. **TYPE AND ISSUER DISAGREEING IS A DEMOTION, NOT A REFUSAL**, and the
 *      archive is why. A type is a human's filing choice — „Contract de
 *      Vânzare" against „Contract de vânzare-cumpărare" is the same instrument
 *      under two names, and `sameDocumentTypeName` folds what it can; an issuer
 *      is a free-text reading of a notary's stamp. Neither is identity. A
 *      number and a date that agree while the type does not is the case the
 *      sentence in the header is written for.
 *
 *   4. **THE TIERS.**
 *        strong — number, date and type all agree.
 *        fair   — number and date agree.
 *        weak   — number agrees, and a date could not be compared because one
 *                 side has none.
 *      A number that agrees while the dates DISAGREE is rule 1: not a
 *      candidate. A common number (see `isCommonDocumentNumber`) with nothing
 *      else to go on is not a candidate either.
 *
 *   5. **WHAT IT MEASURES, ON THE 45-CITATION CORPUS DESCRIBED ON
 *      `isCommonDocumentNumber`**, ranked against an archive built from the 43
 *      distinct instruments those citations name:
 *
 *        * archive complete (type, date and issuer all filled in):
 *          **45 of 45 offered, the right document at rank 1 in 45 of 45, none
 *          wrong, no reference with more than one candidate**, every rank-1 at
 *          tier `strong`.
 *        * archive with `institution_id` NULL, which is the commonest real
 *          state in this archive: **identical — 45/45 correct at rank 1**. The
 *          issuer earns its place as a tie-breaker and is never needed as one
 *          here, which is exactly why rule 3 refuses to let it disqualify.
 *        * archive where the sale contracts are filed under „Contract de
 *          Vânzare" while the deeds cite „contract de vânzare-cumpărare":
 *          **still 45/45 correct at rank 1**, three of them dropping from
 *          `strong` to `fair`. That is rule 3 being right: a type is a filing
 *          choice, not identity.
 *        * archive with no dates at all: **45/45 still offered, all at tier
 *          `weak`**, and exactly two references then have two candidates each —
 *          the 1762 pair below — which the screen shows and nobody auto-picks.
 *
 *   6. **THE ONE MEASURED FAILURE, NAMED RATHER THAN HIDDEN.** „procură 1762"
 *      appears twice in the corpus with dates a year apart — 07.08.2016 on the
 *      2016 sale and 07.08.2015 on the act adițional. It is one instrument and
 *      one of the two transcriptions is wrong. **This ranker offers NO
 *      candidate for it**, because rule 1 treats a date disagreement as fatal,
 *      so a user linking the 2016 citation against an archive holding only the
 *      2015 row is offered nothing and may well mint a second stub.
 *
 *      That is the price of rule 1 and it is paid deliberately. The
 *      alternative — offering a candidate whose date contradicts the page — is
 *      presenting two instruments as one in the part of the archive that exists
 *      to prove a chain of title, and it would do so with a confident-looking
 *      „numărul se potrivește" beside it. A missing suggestion costs one manual
 *      association from the References tab, which is still there. Worth
 *      revisiting with evidence if duplicate stubs actually appear; not worth
 *      loosening in advance.
 *
 *   7. **STUBS RANK WITH EVERYTHING ELSE, AND THAT IS THE POINT OF THE STUB
 *      RULE.** The second deed citing the same titlu de proprietate must be
 *      offered the FIRST deed's stub rather than minting a second one, so a
 *      page-less document is an ordinary candidate here and is only marked as a
 *      stub so the screen can say what it is. Sorting them below real documents
 *      at the same tier is the one nudge applied, because where both exist the
 *      one with pages is the better answer.
 */
export function rankInstrumentCandidates(
  ref: Pick<ReferencedInstrument, "nrDocument" | "dateDocument" | "typeLabel" | "issuer">,
  docs: readonly InstrumentCandidateDoc[],
  limit = 5,
): InstrumentCandidate[] {
  const refNumber = foldDocumentNumber(ref.nrDocument);
  if (refNumber === "") return [];

  const refIssuer = foldLookupName(ref.issuer ?? "");
  const out: InstrumentCandidate[] = [];

  for (const doc of docs) {
    // ── 2. the number ──────────────────────────────────────────────────────
    const docNumber = foldDocumentNumber(doc.nrDocument);
    if (docNumber === "" || docNumber !== refNumber) continue;

    // ── 1. the date, where both sides have one ─────────────────────────────
    const bothDated = Boolean(ref.dateDocument && doc.dateDocument);
    if (bothDated && ref.dateDocument !== doc.dateDocument) continue;

    // ── 3. type and issuer: compared, never disqualifying ──────────────────
    const bothTyped = Boolean(ref.typeLabel && doc.typeName);
    const typeAgrees = bothTyped && sameDocumentTypeName(ref.typeLabel!, doc.typeName!);

    const docIssuer = foldLookupName(doc.institutionName ?? "");
    const bothIssued = refIssuer !== "" && docIssuer !== "";
    // Whole-string equality rather than a substring test: `matchLookupByName`
    // does the substring work against a LIST of rows, where the shorter name is
    // known to be the row's. Here both sides are free readings, and „OCPI"
    // sitting inside „OCPI Ilfov" is not evidence that the two deeds mean the
    // same office.
    const issuerAgrees = bothIssued && refIssuer === docIssuer;

    // ── the common-number rule ─────────────────────────────────────────────
    // A short number with NOTHING else to go on is not a candidate. It is still
    // a candidate the moment a date agrees.
    if (!bothDated && !typeAgrees && isCommonDocumentNumber(refNumber)) continue;

    const matched: MatchSignal[] = ["number"];
    const missing: MatchSignal[] = [];
    if (bothDated) matched.push("date");
    else missing.push("date");
    if (typeAgrees) matched.push("type");
    else if (!bothTyped) missing.push("type");
    if (issuerAgrees) matched.push("issuer");
    else if (!bothIssued) missing.push("issuer");

    const tier: CandidateTier = bothDated && typeAgrees ? "strong" : bothDated ? "fair" : "weak";
    out.push({ document: doc, tier, matched, missing });
  }

  return out
    .sort((a, b) => {
      const byTier = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      if (byTier !== 0) return byTier;
      // More agreeing signals first (this is where a matching issuer earns its
      // place), then real documents before stubs, then by code so the order is
      // stable for a test and for a user reading it twice.
      const bySignals = b.matched.length - a.matched.length;
      if (bySignals !== 0) return bySignals;
      if (a.document.isStub !== b.document.isStub) return a.document.isStub ? 1 : -1;
      return a.document.code.localeCompare(b.document.code);
    })
    .slice(0, limit);
}
