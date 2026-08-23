/**
 * A form distilled from ten to twenty documents, not from one.
 *                                                              (Slice #29.09)
 *
 * WHAT THIS MODULE IS THE ANSWER TO
 * ---------------------------------
 * F5 in the #29.01 import report. A form discovered from ONE notarial deed
 * produced thirty-five fields that were sentence fragments cut at the value —
 * `pretul_vanzarii_este_de`, `s_a_taxat_cu`, `din_totalul_de` — four fields
 * that were the same field twice with a `_2` suffix because the deed named two
 * parties, two keys truncated mid-word, one starting with a digit, and `aiHint`
 * values carrying that one parcel's tarla, parcela, area and sale price onto a
 * type every future contract of the kind will share.
 *
 * Fitting across many samples is the direct structural answer to most of that,
 * and it is arithmetic rather than cleverness: **a fragment that appears in one
 * deed and not in the other nineteen is not a field.** Everything here is a
 * pure function over a cluster table so that the rule can be asserted against
 * fixtures with no model call — which is where this slice's tests live.
 *
 * ⚠️ **THE DENOMINATOR IS SAMPLES *READ*, NEVER SAMPLES *PICKED*, AND THAT IS
 * THE MOST LOAD-BEARING SENTENCE IN THE FILE.** Twenty samples is twenty calls
 * against a limiter that allows twenty a minute to a superuser and five to
 * everyone else (`checkOcrRateLimit`), plus one more call to cluster them — so
 * a run CAN meet a 429, and a page that has already timed out or been refused is a
 * sample whose pairs nobody has. Dividing by the number picked would quietly
 * raise every share — a field present in 7 of 14 actually-read samples would
 * report 35% against 20 and vanish under a 50% threshold the user chose
 * believing it meant half the documents. `readSampleCount` is the only
 * denominator this module will compute, and the screen is required to print it
 * ("14 din 20 de mostre citite") rather than a bare percentage.
 *
 * ⚠️ **A CLUSTER'S COUNT IS DISTINCT SAMPLES, NOT MEMBERS.** One deed naming
 * two sellers prints "Vânzător" twice, and counting members would let a single
 * document reach a 50% threshold on its own — which is F5's `_2` bug wearing a
 * percentage. `sampleCount` de-duplicates by `sampleId` for exactly that.
 */

import type { DiscoverConfidence } from "@/lib/documents/discover-log";
import {
  collapseWhitespace,
  inferFieldType,
  slugifyFieldKey,
  normaliseKeyForComparison,
} from "@/lib/documents/discover-to-template";
import type {
  DocumentTemplateField,
  DocumentTemplateFieldType,
} from "@/lib/documents/template-fields";

// ---------------------------------------------------------------------------
// The Matching % the user picks
// ---------------------------------------------------------------------------

/**
 * The dropdown's values: 50 to 100 in fives.
 *
 * A list rather than a free number box because the threshold is the whole
 * decision and a typed "37" invites a form built from noise; and because the
 * screen has to say what each choice will do before the reads are paid for,
 * which is only possible over a closed set.
 */
export const MATCHING_PERCENTS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100] as const;

export type MatchingPercent = (typeof MATCHING_PERCENTS)[number];

export const DEFAULT_MATCHING_PERCENT: MatchingPercent = 75;

export function isMatchingPercent(value: number): value is MatchingPercent {
  return (MATCHING_PERCENTS as readonly number[]).includes(value);
}

// ---------------------------------------------------------------------------
// What one sample read produced
// ---------------------------------------------------------------------------

/**
 * Why a picked sample was not read.
 *
 * Every one of these leaves the sample in the DENOMINATOR of nothing and in the
 * "picked but not read" count that the screen prints. `discoverForType` folds
 * every non-ok response into one `"failed"`, and its own comment says a
 * discovery that did not happen is reported by the absence of a review step —
 * a fine answer when the output is one screen and a fatal one here, because
 * here the count IS the answer.
 */
export type SampleFailure =
  | "failed"      // the route answered, and not with a reading
  | "timeout"     // no answer inside the client budget, or the 60 s function ceiling
  | "rateLimited" // 429 that outlived the run's own pacing
  | "session"     // signed out mid-run
  | "cancelled"   // the user stopped the run before this one was attempted
  | "unsupported"; // nothing in the sample was an image or a PDF

export type SampleRead =
  | {
      sampleId: string;
      fileName: string;
      read: true;
      pairs: readonly { name: string; value: string; confidence: DiscoverConfidence }[];
      /**
       * Pages of this sample the route did NOT send to the model — beyond the
       * per-sample page cap, over the size limit, or in a format it cannot read.
       * Carried so the screen can say a document was read in part; a reading of
       * two thirds of a deed reported as a reading is the same class of defect
       * as a lost sample.
       */
      skippedPages: number;
      /** The model's answer was cut off at its output limit. */
      truncated: boolean;
    }
  | { sampleId: string; fileName: string; read: false; reason: SampleFailure };

/**
 * How many of the picked samples actually came back with a reading.
 *
 * ⚠️ De-duplicated by `sampleId`, not `.filter().length`. An adversarial round
 * pointed out that the numerator (`sampleCount`) de-dupes and the denominator
 * did not, so one repeated entry in this array deflated every share on the
 * screen. Two counts of the same thing must be counted the same way.
 */
export function readSampleCount(samples: readonly SampleRead[]): number {
  return readSampleIds(samples).size;
}

/** The ids of the samples that were read — the universe every share is over. */
export function readSampleIds(samples: readonly SampleRead[]): Set<string> {
  const ids = new Set<string>();
  for (const s of samples) if (s.read) ids.add(s.sampleId);
  return ids;
}

/** The sentence's other half: picked, and never read. */
export function unreadSampleCount(samples: readonly SampleRead[]): number {
  const unread = new Set<string>();
  for (const s of samples) if (!s.read) unread.add(s.sampleId);
  return unread.size;
}

/**
 * The cluster, with every member that came off a sample nobody read removed.
 *
 * ⚠️ **A round found that nothing tied the numerator to the denominator.** The
 * clusters come back from a model call that was given the harvest, and the
 * harvest is built from the reads — but nothing in this module ENFORCED that,
 * so a cluster naming twelve samples over a run that read six produced
 * `sharePercent: 200` and sat above a 100% threshold. Every entry point now
 * restricts to the read set first, so a share cannot exceed 100 by
 * construction rather than by trusting the caller.
 */
export function restrictToRead(cluster: FieldCluster, readIds: ReadonlySet<string>): FieldCluster {
  return { ...cluster, members: cluster.members.filter((m) => readIds.has(m.sampleId)) };
}

// ---------------------------------------------------------------------------
// The cluster table
// ---------------------------------------------------------------------------

/** One reading of one caption in one sample. */
export type ClusterMember = {
  sampleId: string;
  /** The caption exactly as printed in that sample. */
  label: string;
  /** The value exactly as printed in that sample. */
  value: string;
};

/**
 * One meaning, gathered from however many wordings carried it.
 *
 * This is what the clustering call returns and the only thing the counting rule
 * below reads. It deliberately holds the VALUES as well as the labels: the
 * values are what prove two differently-worded captions are the same thing, and
 * they are also what `inferFieldType` votes over.
 */
export type FieldCluster = {
  clusterId: string;
  members: readonly ClusterMember[];
};

/** Distinct samples this cluster was seen in — never the number of members. */
export function sampleCount(cluster: FieldCluster): number {
  const seen = new Set<string>();
  for (const m of cluster.members) seen.add(m.sampleId);
  return seen.size;
}

/**
 * The share, as a percentage, over samples actually read.
 *
 * ⚠️ **FLOOR, NOT ROUND, AND A ROUND FOUND OUT WHY.** This number is printed on
 * the same row as the decision `meetsThreshold` made, so the two must never
 * disagree — and with `Math.round` they did, inside the range this screen
 * actually works in: 6 of 11 rounds to 55% and prints „55%" on a row filed
 * BELOW a 55% threshold, and 11 of 13 prints 85% below an 85% one. Flooring
 * makes the printed number exactly the predicate: for an integer threshold
 * `p`, `floor(c*100/r) >= p` if and only if `c*100 >= p*r`, which is what
 * `meetsThreshold` computes. The row now says what happened to it.
 */
export function clusterSharePercent(cluster: FieldCluster, samplesRead: number): number {
  if (samplesRead <= 0) return 0;
  return Math.floor((sampleCount(cluster) * 100) / samplesRead);
}

/**
 * ⚠️ **AT LEAST the threshold, not MORE THAN it — and the slice text says both,
 * so this comment is the decision.** "More than 100%" is unsatisfiable, so a
 * strict comparison makes the top of the dropdown a setting that always
 * produces an empty form; and "found in at least that share of the samples it
 * actually read" is what the goal sentence asks for. Compared as
 * `count * 100 >= percent * read` rather than through a division, so 2 of 3 at
 * 66% is not decided by a float.
 */
export function meetsThreshold(
  cluster: FieldCluster,
  samplesRead: number,
  percent: number,
): boolean {
  if (samplesRead <= 0) return false;
  return sampleCount(cluster) * 100 >= percent * samplesRead;
}

/**
 * The whole counting rule: which candidates become fields, and which do not.
 *
 * ⚠️ **The `below` half is a SAYING, not a second writer.** A cluster under the
 * line needs nothing built: `document.fields.notes` is „Note extinse", the
 * ai-interpret route defines it as `unmappedRaw` rendered as readable text, and
 * a value the model reads that matches no template field is already routed
 * there. What this slice owes is that the user can SEE that consequence while
 * the percentage is still changeable — so `below` is returned to be drawn, and
 * nothing anywhere writes an overflow path by hand. A second writer of that
 * rule is the shape #29.06 deleted.
 */
export function splitByThreshold(
  clusters: readonly FieldCluster[],
  samplesRead: number,
  percent: number,
): { above: FieldCluster[]; below: FieldCluster[] } {
  const above: FieldCluster[] = [];
  const below: FieldCluster[] = [];
  for (const cluster of clusters) {
    (meetsThreshold(cluster, samplesRead, percent) ? above : below).push(cluster);
  }
  // Most-seen first, then by cluster id so the order is stable across renders
  // and across two runs of the same folder.
  const byShare = (a: FieldCluster, b: FieldCluster) =>
    sampleCount(b) - sampleCount(a) || a.clusterId.localeCompare(b.clusterId);
  above.sort(byShare);
  below.sort(byShare);
  return { above, below };
}

// ---------------------------------------------------------------------------
// Caption variants — the part of the hint that many samples make safe
// ---------------------------------------------------------------------------

/** Beyond this a caption stops being a caption and starts being a sentence. */
const MAX_VARIANT_LENGTH = 60;

/**
 * Three, not twenty.
 *
 * `aiHint` lands inside a `//` comment on one line of a prompt charged by the
 * token (`buildExtractSystemPrompt` renders `"key": string | null,  //
 * <formatHint> — <aiHint> (<labelRo>)`), and a list of twenty wordings costs
 * more than it teaches.
 */
export const MAX_CAPTION_VARIANTS = 3;

/**
 * ⚠️ **THE TWO RULES THAT DECIDE WHAT MAY BE WRITTEN INTO `aiHint`. THERE WERE
 * THREE; SEE THE BLOCK BELOW FOR HOW THE THIRD DIED.**
 *
 * The hint carries the wordings a caption was actually printed under, which is
 * what lets the user rename a label to something official without the model
 * losing the prose it reads by. `buildFieldHint`'s header records why the
 * single-sample path could never do this: the case it had to exclude is a
 * caption with a person glued onto it („Notar Public MARIA IONESCU" renamed to
 * „Notar"), and every textual test for that also matches ordinary Romanian
 * captions, which are routinely Title Case or ALL CAPS.
 *
 * Many samples make it decidable — but „printed in more than one document" was
 * not enough, because a folder of sample deeds is normally deeds from ONE
 * notary office, so the same person really is printed on two of the twenty.
 * What actually separates a caption from a caption-plus-something is:
 *
 *  1. **A caption has to be established at all.** If the commonest single
 *     wording does not cover a third of the documents the field appears in,
 *     there is no settled wording — twenty deeds by twenty notaries — and
 *     nothing is emitted. An empty hint box is exactly today's behaviour and
 *     is never worse than a wrong one.
 *  2. **A wording has to be within a third of the commonest one** (and printed
 *     in at least two documents) before it counts as a second way of saying the
 *     same thing rather than one office's phrasing.
 *
 * A third rule tried to tell a caption-plus-a-name from a caption-plus-a-
 * qualifier by reading the difference between two wordings. It was measured and
 * removed; the block below says what the measurement was.
 */
const VARIANT_MIN_SHARE_DENOMINATOR = 3;
const VARIANT_MIN_SAMPLES = 2;

/**
 * ⚠️ **No hint at all from a cluster this thin, whatever the shares say.**
 * Rule 1 is a FRACTION of the cluster's samples, so it loosens as the cluster
 * shrinks: a run the limiter cut down to two readings gave a two-sample cluster
 * a floor of two, and one notary's name printed on both cleared every rule. A
 * run whose denominator collapsed is exactly the run that most needs the guard,
 * so there is an absolute floor underneath the fraction.
 */
const VARIANT_MIN_CLUSTER_SAMPLES = 3;

/** 4+ digits in a row is a number off a document, never part of a caption. */
const LONG_DIGIT_RUN = /\d{4,}/g;

/**
 * ⚠️ **MASKING HAPPENS ON THE WAY OUT, NEVER BEFORE THE COUNT — and a round
 * found the bug the other order produced.** Masking first made
 * „Dosar nr. 4471/2023" and „Dosar nr. 9902/2024", each printed on ONE
 * document, collapse into a single wording seen on two — so the belt-and-braces
 * step manufactured the very multi-sample evidence the safety rule rests on,
 * and then emitted „Dosar nr. …/…" as the caption. Counting on the caption as
 * printed keeps them two once-seen wordings, which is what they are.
 */
function maskForEmit(caption: string): string {
  return caption.replace(LONG_DIGIT_RUN, "…");
}

function usableCaption(label: string): string | null {
  const caption = collapseWhitespace(label);
  if (!caption || caption.length > MAX_VARIANT_LENGTH) return null;
  if (!/[a-zA-Z]/.test(caption)) return null;
  return caption;
}

/** caption (as printed) -> the distinct samples it was printed in. */
function captionsBySample(cluster: FieldCluster): Map<string, Set<string>> {
  const seenIn = new Map<string, Set<string>>();
  for (const member of cluster.members) {
    const caption = usableCaption(member.label);
    if (caption === null) continue;
    const bucket = seenIn.get(caption) ?? new Set<string>();
    bucket.add(member.sampleId);
    seenIn.set(caption, bucket);
  }
  return seenIn;
}

/*
 * ⚠️ **THERE WAS A THIRD RULE HERE, IT WAS MEASURED, AND THE MEASUREMENT KILLED
 * IT. THIS PARAGRAPH IS THE POINT OF THE FILE.**
 *
 * Rules 1 and 2 count. A third rule tried to READ: when one wording contained
 * another, it looked at what the longer one added and asked whether that looked
 * like a person — „Notar public" plus „MARIA IONESCU" is a caption plus a name,
 * „Suprafaţă" plus „construită desfăşurată" is a caption plus a qualifier. It
 * was rewritten three times across three adversarial rounds, each version
 * fixing the previous one's counter-example and producing its own: counts alone
 * let a busy notary's name become the plurality; case alone deleted „SUPRAFAŢĂ
 * CONSTRUITĂ DESFĂŞURATĂ" as if it were somebody's name; case-CONTRAST between
 * the caption and the residue was the last attempt.
 *
 * Then it was run over a corpus of realistic Romanian notarial captions instead
 * of over the examples it had been written from. **It missed 47% of names and
 * deleted 39% of qualifiers** — and the misses clustered exactly where this
 * product lives: an ALL-CAPS deed („VÂNZĂTOR" / „VÂNZĂTOR MARIA IONESCU") caught
 * NONE of them, because a caption that already shouts gives a shouted name
 * nothing to contrast with. The false positives were almost all abbreviations —
 * „Suprafaţă UTILĂ", „Nr. cadastral CF", „…TVA", „…IBAN" — a caps run inside an
 * otherwise level caption, which is far commoner in Romanian than a name is.
 * The rule was anti-correlated with its target, and its errors were SILENT: a
 * wording it deleted did not appear anywhere on the screen.
 *
 * `buildFieldHint`'s header said this before any of it was written — that the
 * one case it had to exclude "could not be filtered, because every test for that
 * also matches ordinary Romanian captions, which are routinely Title Case or
 * ALL CAPS". Many samples make COUNTING work where one sample could not. They do
 * not make READING work. So the third rule is gone, and what remains is what
 * was measured to hold.
 *
 * ⚠️ **THE RESIDUAL, NAMED RATHER THAN PAPERED OVER.** When one office
 * certifies most of a folder, the wording carrying its notary's name IS the
 * plurality, and it becomes the label. What makes that survivable — and what did
 * not exist on the single-sample path this slice replaces — is that the label is
 * a text box the user is looking at, the key derived from it is printed live
 * underneath as they type, every observed wording is drawn beside it, and
 * nothing is written until they press a button. A wrong caption is one
 * keystroke from right, and it is visible. That is the whole answer, and it is a
 * better one than a rule that is wrong two ways in five.
 */

/**
 * The caption wordings observed for this cluster, commonest first.
 *
 * See the two rules above for why each filter is there and which
 * counter-example produced it.
 */
export function captionVariants(
  cluster: FieldCluster,
  cap: number = MAX_CAPTION_VARIANTS,
): string[] {
  const samples = sampleCount(cluster);
  if (samples < VARIANT_MIN_CLUSTER_SAMPLES) return [];

  // ⚠️ **DE-DUPLICATED AFTER MASKING AND BEFORE THE CAP, AND A ROUND FOUND WHY
  // THE OTHER ORDER WAS WRONG.** Counting happens on the caption AS PRINTED (see
  // `maskForEmit`), so „Dosar nr. 4471/2023" and „Dosar nr. 9902/2024" are two
  // wordings — correctly. But they mask to one string, and slicing first emitted
  // it twice: „printed on the document as 'Dosar nr. …/…' / 'Dosar nr. …/…'" on
  // the prompt line and on the row, with one of the three slots burnt so a
  // genuinely different third wording was dropped.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const caption of settledCaptions(cluster)) {
    const masked = maskForEmit(caption);
    if (seen.has(masked)) continue;
    seen.add(masked);
    out.push(masked);
    if (out.length >= Math.max(0, cap)) break;
  }
  return out;
}

/**
 * Rules 1 and 2 — the leader test and the share test — without rule 1's
 * ABSOLUTE cluster floor, which is about the hint alone.
 *
 * ⚠️ **THE SPLIT EXISTS BECAUSE TWO ROUNDS PUSHED IT BOTH WAYS AND BOTH WERE
 * RIGHT.** The label used to route through `captionVariants`, which imposed the
 * three-sample floor on it too — so a two-sample cluster fell to the
 * shortest-caption fallback and a field printed „Suprafaţă construită
 * desfăşurată" on both deeds was named „Sc" after a one-off abbreviation. Cut
 * loose from the rules entirely, the label then took a wording the share test
 * had already refused. The absolute floor is about whether a cluster is broad
 * enough to teach the MODEL anything; the leader and share tests are about
 * whether a wording is the caption at all, and the label needs those.
 */
function settledCaptions(cluster: FieldCluster): string[] {
  const seenIn = captionsBySample(cluster);
  if (seenIn.size === 0) return [];

  const samples = sampleCount(cluster);
  const counts = [...seenIn.values()].map((s) => s.size);
  const topCount = Math.max(...counts);

  // Rule 1 — is there a settled wording at all?
  const leaderFloor = Math.max(
    VARIANT_MIN_SAMPLES,
    Math.ceil(samples / VARIANT_MIN_SHARE_DENOMINATOR),
  );
  if (topCount < leaderFloor) return [];

  // Rule 2 — within a third of the commonest, and printed in at least two.
  const qualified = [...seenIn.entries()]
    .filter(
      ([, inSamples]) =>
        inSamples.size >= VARIANT_MIN_SAMPLES &&
        inSamples.size * VARIANT_MIN_SHARE_DENOMINATOR >= topCount,
    )
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([caption]) => caption);

  return qualified;
}

/**
 * The hint the extraction prompt will carry for this field.
 *
 * ⚠️ **This emits a hint and `buildFieldHint` — the other writer of
 * `template_fields.aiHint` — emits none at all, and the difference is
 * deliberate.** The reasoning is written down once, in that function's header
 * (src/lib/documents/discover-to-template.ts): a wording printed in three of
 * twenty documents is a property of the document TYPE, while anything read out
 * of one document is a property of that document, and no test on the string
 * tells the two apart. This path has the samples to count; that one has one
 * reading and refuses. **If the two are ever merged, this is the rule that
 * survives — with the single-sample case refusing to emit — never that one
 * extended to the engine.**
 *
 * Note what this DOES emit that the value-example version could not: a hint for
 * all four types. A Romanian example value ("17.03.2024") on a line that has
 * already said "ISO yyyy-mm-dd" contradicts the instruction beside it. A
 * CAPTION contradicts nothing — telling the model the date it wants is printed
 * after „Data autentificării" does not tell it what format to answer in.
 *
 * Returns null rather than an empty string, because `sanitizeTemplateField`
 * stores `aiHint: hint || null` and a stored `""` would render a trailing
 * „ — " on the prompt line.
 */
export function distilledHint(variants: readonly string[]): string | null {
  if (variants.length === 0) return null;
  const quoted = variants.map((v) => `'${v.replace(/"/g, "'")}'`).join(" / ");
  return collapseWhitespace(`printed on the document as ${quoted}`);
}

/**
 * The label to offer the user, before they rename it.
 *
 * ⚠️ **RANKED BY DISTINCT SAMPLES, LIKE EVERYTHING ELSE HERE — a round caught
 * this counting members while `captionVariants` counted samples**, so on a
 * cluster where one deed listed six parcels the label named one wording and the
 * hint printed beneath it named another. Two counts of the same thing.
 *
 * ⚠️ **THE FALLBACK IS THE SHORTEST CAPTION, NOT THE FIRST, AND THE REASON IS
 * THE KEY.** When no wording clears the share rule — twenty deeds, twenty
 * notaries, every caption printed once — there is no trustworthy caption at
 * all, and this still has to return something, because the KEY is minted from
 * it and a key is permanent. A caption with a person or a value glued onto it
 * is LONGER than the bare caption, so the shortest observed wording is the
 * least contaminated one available. It is a mitigation and not a guarantee, and
 * it is named as such: the residual case — a cluster above the threshold whose
 * every wording carries something document-specific — is the part of F5 that is
 * true regardless of how many samples there are, which is #29.10's subject.
 */
export function distilledLabel(cluster: FieldCluster): string {
  // ⚠️ **RANKED DIRECTLY, NOT THROUGH `captionVariants` — a third round showed
  // the shortcut moving a KEY decision.** Routing this through the variant
  // rules meant the hint's three-sample floor also decided the label: a
  // two-sample cluster where both deeds print „Suprafaţă construită
  // desfăşurată" and one also prints „Sc" fell to the shortest-caption fallback
  // and was labelled „Sc" — and the key is minted from the label. The floor is
  // about whether a wording is settled enough to teach the MODEL; it has no
  // business deciding what the field is called.
  const settled = settledCaptions(cluster);
  if (settled.length > 0) return maskForEmit(settled[0]);

  // Every caption was blank, longer than a caption can be, or carried no
  // letters at all. Trim on a word boundary rather than mid-word — F5 reported
  // two keys "truncated mid-word".
  //
  // ⚠️ **A caption with no letter in it is not a caption, and returning one
  // anyway put two nameless rows keyed `camp` and `camp_2` on the screen — the
  // exact pair of defects this module lists as F5's.** Page numbers and cadastral
  // numbers OCR'd into the label position produce „123456", which the masking
  // then turned into „…" — non-empty, so it survived the caller's empty-label
  // filter. It returns "" now, and the caller drops the cluster.
  const shortest = cluster.members
    .map((m) => collapseWhitespace(m.label))
    .filter((label) => /[a-zA-Z]/.test(label))
    .sort((a, b) => a.length - b.length)[0];
  if (!shortest) return "";
  return maskForEmit(trimToWord(shortest, MAX_VARIANT_LENGTH));
}

/**
 * Cut at the last word boundary at or before `max`.
 *
 * ⚠️ Except when there is no boundary to cut at: a 60-character run with no
 * space in it is cut where it falls, because the alternative is returning
 * nothing and dropping the field. F5's "truncated mid-word" complaint was about
 * ordinary multi-word captions, which this does keep whole.
 */
function trimToWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * The type, decided by every SAMPLE rather than guessed from one value.
 *
 * ⚠️ **ONE VOTE PER SAMPLE, AND A NARROW TYPE ONLY IF EVERY SAMPLE AGREES. BOTH
 * HALVES CAME OUT OF AN ADVERSARIAL ROUND, AND BOTH ARE ABOUT THE SAME
 * FAILURE.** `<input type="date">` renders a stored value that is not ISO as
 * BLANK — stored, invisible and uneditable — and `<input type="number">` does
 * the same with anything that is not a bare decimal. `<input type="text">`
 * renders whatever is there. So the two are not symmetric choices and must not
 * be decided by a majority:
 *
 *  - **Counting members let one document outvote all the others.** A deed with
 *    a six-row parcel table contributed six numeric members against four other
 *    deeds' one prose member each, and the field was stored as `number` — so
 *    four documents out of five would show an empty box. That is the exact
 *    failure this function exists to prevent, committed by the function itself.
 *  - **A sample-level majority is not enough either.** Three date-shaped deeds
 *    against two that print „conform anexei" is 60/40, and 40% of the type's
 *    documents would render blank. Unanimity is the only rule where being wrong
 *    costs a wider input rather than an invisible value.
 *
 * A sample whose values disagree with themselves counts as `text`, which is the
 * same conservative direction.
 */
export function distilledType(cluster: FieldCluster): DocumentTemplateFieldType {
  const perSample = new Map<string, DocumentTemplateFieldType | "mixed">();
  for (const m of cluster.members) {
    const t = inferFieldType(m.value);
    const seen = perSample.get(m.sampleId);
    perSample.set(m.sampleId, seen === undefined ? t : seen === t ? t : "mixed");
  }

  const votes = [...perSample.values()];
  if (votes.length === 0) return "text";
  const everySampleSays = (t: DocumentTemplateFieldType) => votes.every((v) => v === t);

  if (everySampleSays("date")) return "date";
  if (everySampleSays("number")) return "number";
  // `textarea` is the one widening choice, so a single long value is enough:
  // a textarea renders a short value perfectly and a text input truncates
  // nothing but shows a 400-character clause through a one-line window.
  if (votes.some((v) => v === "textarea")) return "textarea";
  return "text";
}

// ---------------------------------------------------------------------------
// The proposal
// ---------------------------------------------------------------------------

/** One row on the proposal screen, above the line. */
export type DistilledField = {
  clusterId: string;
  labelRo: string;
  labelEn: string;
  type: DocumentTemplateFieldType;
  aiHint: string | null;
  /** Caption wordings observed across the samples; drawn under the label. */
  variants: string[];
  /** Distinct samples this was found in, and the share over samples READ. */
  foundIn: number;
  sharePercent: number;
  /** One (sample, value) per sample, so a field is approved having been seen to work. */
  evidence: readonly ClusterMember[];
};

/** One row below the line: named, and told where it will land. */
export type BelowThresholdCandidate = {
  clusterId: string;
  labelRo: string;
  foundIn: number;
  sharePercent: number;
  sampleValue: string;
};

export type Distillation = {
  samplesPicked: number;
  samplesRead: number;
  /** Above the Matching %, in the order they will be written to the form. */
  fields: DistilledField[];
  /** Below it. Nothing is built for these — they land in „Note extinse". */
  below: BelowThresholdCandidate[];
  /**
   * Above the line, but the type already stores a field under that key — so it
   * is already captured and is not offered again. Listed rather than dropped:
   * a candidate that simply vanished would look like a field the run failed to
   * find, and the additive save route is what makes this the right answer.
   */
  alreadyCaptured: BelowThresholdCandidate[];
};

/*
 * ⚠️ **THERE IS DELIBERATELY NO `overCapacity` OR `wouldBeFieldCount` HERE ANY
 * MORE, AND NO `key` ON `DistilledField`.** Both were computed over every field
 * ABOVE THE LINE, and both were wrong for the same reason: what gets saved is
 * the field the user has TICKED, under the key derived from the label the user
 * has EDITED. A capacity count over the untickable list made the screen's own
 * advice ("take some fields out") impossible to follow, and a key minted from
 * the machine's first guess could not be repaired by renaming. A third round
 * found both still being computed here with no production caller, and their
 * doc comments still claiming to be the single source of decisions they were no
 * longer consulted about. The screen computes both, from the rows.
 */

/**
 * The whole distillation: samples in, a proposal out. No model call.
 *
 * `existing` is the type's current `template_fields`, and it is used for one
 * thing only: recognising a cluster the type ALREADY holds, so it is reported
 * as already captured rather than offered again. It is not renamed and it is
 * not counted — the capacity check and the key minting both moved to the
 * screen, because both depend on what the user has ticked and on the label they
 * have edited, and this module sees neither.
 */
export function distilFields(input: {
  samples: readonly SampleRead[];
  clusters: readonly FieldCluster[];
  percent: MatchingPercent;
  existing: readonly DocumentTemplateField[];
}): Distillation {
  const readIds = readSampleIds(input.samples);
  const samplesRead = readSampleCount(input.samples);

  // ⚠️ Restricted BEFORE anything is counted. See `restrictToRead`.
  // A cluster with no readable caption at all is dropped here rather than
  // rendered as a nameless row with a blank label and the key „camp".
  const clusters = input.clusters
    .map((c) => restrictToRead(c, readIds))
    .filter((c) => c.members.length > 0 && distilledLabel(c) !== "");

  const { above, below } = splitByThreshold(clusters, samplesRead, input.percent);

  // ⚠️ **A CLUSTER THE TYPE ALREADY HAS IS NOT A NEW FIELD, AND SUFFIXING IT
  // WAS WORSE THAN USELESS.** The first draft seeded the key set with the
  // stored keys and let `uniqueFieldKey` rename a colliding proposal to
  // `pret_total_2` — which defeats the very collapse the save route performs:
  // `mergeAcceptedFields` drops an accepted key that NORMALISES onto a stored
  // one (`pret_total` onto `pretTotal`), and a renamed key no longer does. An
  // adversarial round produced the result: two columns, identical labels, one
  // meaning, every future document's data split between them — which is F5's
  // `_2` defect rebuilt by the code written to answer it. So a cluster whose
  // key normalises onto a stored key is reported as ALREADY CAPTURED and never
  // offered, the same answer `discover-review-dialog.tsx` gives.
  const storedNormalised = new Set<string>();
  for (const f of input.existing) if (f.key) storedNormalised.add(normaliseKeyForComparison(f.key));

  const fields: DistilledField[] = [];
  const alreadyCaptured: BelowThresholdCandidate[] = [];

  for (const cluster of above) {
    const labelRo = distilledLabel(cluster);
    const slug = slugifyFieldKey(labelRo);
    const found = sampleCount(cluster);

    // ⚠️ **EVERY WORDING THE CLUSTER WAS PRINTED UNDER IS TESTED, NOT ONLY THE
    // ONE THIS RUN SETTLED ON — and a round showed why the narrower test was
    // not enough.** The caption rules can shorten the label („Data
    // autentificării" down to „Data" when seven of twenty deeds print the short
    // form), and the shortened slug no longer normalises onto the stored
    // `dataAutentificarii`. So the already-captured branch missed, a second
    // permanent column was proposed for a field the type already had, and the
    // save route could not collapse them either — the very outcome the branch
    // below exists to prevent, arriving through the front door.
    const everySlug = new Set<string>([slug]);
    for (const caption of captionsBySample(cluster).keys()) {
      everySlug.add(slugifyFieldKey(caption));
    }
    const collides = [...everySlug].some((candidate) =>
      storedNormalised.has(normaliseKeyForComparison(candidate)),
    );

    if (collides) {
      alreadyCaptured.push({
        clusterId: cluster.clusterId,
        labelRo,
        foundIn: found,
        sharePercent: clusterSharePercent(cluster, samplesRead),
        sampleValue: collapseWhitespace(cluster.members[0]?.value ?? ""),
      });
      continue;
    }

    const variants = captionVariants(cluster);
    fields.push({
      clusterId: cluster.clusterId,
      labelRo,
      labelEn: labelRo,
      type: distilledType(cluster),
      aiHint: distilledHint(variants),
      variants,
      foundIn: found,
      sharePercent: clusterSharePercent(cluster, samplesRead),
      evidence: firstValuePerSample(cluster),
    });
  }

  return {
    samplesPicked: pickedSampleCount(input.samples),
    samplesRead,
    fields,
    alreadyCaptured,
    below: below.map((cluster) => ({
      clusterId: cluster.clusterId,
      labelRo: distilledLabel(cluster),
      foundIn: sampleCount(cluster),
      sharePercent: clusterSharePercent(cluster, samplesRead),
      sampleValue: collapseWhitespace(cluster.members[0]?.value ?? ""),
    })),
  };
}

/** Distinct samples the user picked — de-duplicated, like every other count. */
function pickedSampleCount(samples: readonly SampleRead[]): number {
  const ids = new Set<string>();
  for (const s of samples) ids.add(s.sampleId);
  return ids.size;
}

/**
 * One row of evidence per sample, so the mapping column shows a field against
 * the value it picked up in each document rather than the same document twice.
 * A deed naming two sellers contributes its FIRST „Vânzător" and not both — the
 * column is there to prove the field reads, not to render the document.
 */
function firstValuePerSample(cluster: FieldCluster): ClusterMember[] {
  const seen = new Set<string>();
  const out: ClusterMember[] = [];
  for (const m of cluster.members) {
    if (seen.has(m.sampleId)) continue;
    seen.add(m.sampleId);
    out.push(m);
  }
  return out;
}

/*
 * ⚠️ **THERE IS DELIBERATELY NO `templateFieldsFromDistillation` HERE ANY MORE.**
 * The first draft had one, "so the two callers of that route cannot come to
 * disagree about it" — and then had no production caller at all, because the
 * screen builds the payload itself. It had to: an adversarial round moved key
 * minting out of this module and into the moment the user approves a field, so
 * the key comes from the label they have edited rather than from the machine's
 * first guess, and this module never sees that label. A helper with no caller
 * that claims to be the single source of a decision it is not consulted about
 * is worse than no helper.
 */
