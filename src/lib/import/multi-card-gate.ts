/**
 * Does any file in this folder show more than ONE person's identity document?
 *                                                              (Slice #32.08)
 *
 * WHY THIS EXISTS
 * ---------------
 * `C:\dev\TEST.DATA\CLINCENI.3\40-212per40IE55818-Sud Costache Mihail\Costache
 * Mihai Claudiu.jpg` is one A4 scan of TWO different men's Romanian identity
 * cards, one above the other — two names, two CNPs, two card series. Until this
 * slice the import classified it as an identity card, created one Document for
 * it, and the identity-card step built ONE Person record out of both. That is a
 * correctness failure before it is a privacy one: the archive gains a person
 * who is a blend of two real people, and nothing anywhere says so.
 *
 * So the run stops, names the file, and says what to do about it: split the
 * scan so that one file holds exactly one card.
 *
 * ⚠️ **THIS IS THE IMPORT'S FIRST CONTENT-BASED REFUSAL, and every other
 * blocking rule in the wizard decides from a NAME or from file METADATA.**
 * Fifteen structure rules, six file rules, two copy rules and four archive
 * rules all run before a single billed call and none of them opens a file. This
 * one cannot be asked until an image has been looked at, so it lives where the
 * looking first happens — the classification — and the wizard stops between
 * that and the Evaluation screen, exactly where the type gate stops.
 *
 * ⚠️ **THE SIGNAL IS MORE THAN ONE PERSON, NOT MORE THAN ONE CARD-SHAPED
 * OBJECT, AND THE WHOLE MODULE IS DESIGNED AGAINST THAT FALSE POSITIVE.** The
 * commonest identity scan in any archive is the FRONT AND BACK of one card on
 * one page; the second commonest is one booklet `buletin` photographed twice,
 * spread by spread, on one sheet. Both show two card-shaped rectangles and both
 * are ONE person, and refusing them would make this rule the thing a user
 * learns to work around. A Romanian identity card carries a CNP, which is
 * unique to a person, so the discriminator is TWO DISTINCT CNPs (or, on an old
 * booklet that predates the CNP, two distinct names and two distinct series).
 * `CLASSIFY_SYSTEM_PROMPT` says that to the model in those words; this module
 * only reads the number that comes back.
 *
 * Measured by eye over twenty identity scans in CLINCENI.3 before the check was
 * written, precisely so the negatives were known rather than assumed:
 * `Toma Veturia.jpg` and `Toma Tudor.jpg` are each one booklet photographed
 * twice — two card-shaped spreads, one serial, ONE person — and
 * `Dumitru Niculae.jpg` carries two photographs of the same man in the
 * booklet's two photo slots. Those three are what a rectangle-counting rule
 * would refuse and this one must not.
 *
 * ⚠️ **AN ABSENT ANSWER DOES NOT REFUSE, and that is the opposite of the
 * under-claiming direction this codebase takes everywhere else.** The type gate
 * blocks on "we could not find out" because the thing it promises is that no
 * document is written on an unproved type, and there the safe answer is to
 * stop. Here the promise is a POSITIVE finding — this file shows two people —
 * and treating "the model said nothing" as that finding would refuse every
 * image in every folder the day the field is dropped from the prompt, a
 * response is truncated, or an older cached answer comes back. A rule that
 * fails closed on silence is a rule that stops the product. So silence is
 * `null`, `null` never refuses, and the two other refusal points (the AI read
 * and the identity-card step) are what stand behind it.
 *
 * ⚠️ **IT SEES ONE PAGE PER ENTRY, AND THE PROMISE IS WRITTEN AROUND THAT
 * RATHER THAN OVER IT.** `scanEntry` sends the FIRST page of a page group and,
 * for a PDF, the first page rasterised — that is what the classification has
 * always cost and always covered, and widening it here would multiply the
 * folder's whole classification bill to answer one question. So a two-card
 * sheet sitting on page four of a page group, or on page two of a PDF, is NOT
 * caught by this gate. The screen's copy is careful not to claim more.
 *
 * ⚠️ **AND THE OTHER TWO REFUSALS DIVIDE THE WORK — an earlier draft of this
 * paragraph said "three places, each seeing a different amount", a fifth
 * adversarial round replaced it with "the AI read is never called for an
 * identity card", and a SIXTH showed that is not true either.**
 * `interpretSkipReason` answers `"id-card"` only for a card that can produce a
 * person — `scan.isIdCard && scan.canCreatePerson` — and `canCreatePerson` is
 * false for a card under `common` or `floating`, which `discover-run.ts` has
 * recorded since #27.05. So:
 *
 *  - a card with a sole Property is skipped by the AI read and backed up by the
 *    IDENTITY-CARD STEP, which is the only refusal standing between a scan and
 *    a `natural_person` row — and which reads the same first page this gate
 *    read, so it adds accuracy rather than pages;
 *  - a card under `common` or `floating`, and every document this gate did NOT
 *    type as a card — which is the dangerous case, a two-card sheet the
 *    classifier read as a contract — is read by `runAiInterpret`, which is
 *    given EVERY page.
 *
 * The residual gap is therefore narrow and worth naming: a two-card sheet on
 * page two or later of a page group that the run reads as an identity card WITH
 * a sole Property. Nothing looks at that page — and nothing builds a person
 * from it either, because the person step reads page one.
 *
 * ⚠️ **IT IS ASKED OF THE ENTRIES THE RUN WOULD CREATE A DOCUMENT FOR, not of
 * every file in the folder** — the identical argument `type-form-gate.ts`
 * makes. A `link` or `skip` row from the Pre-existing stage creates nothing and
 * was never sent for classification, so it has no answer; and refusing an
 * import over a two-card scan the archive ALREADY HOLDS would stop a run over
 * something that happened months ago and that this run cannot put right.
 *
 * NO ROMANIAN LIVES HERE. The verdict carries paths, which are data, and
 * counts; every sentence around them is `messages/*.json`'s — the rule every
 * checker in this folder follows.
 *
 * Pure, client-safe, no DB and no React: the wizard calls it, and its test
 * calls it with the same shapes.
 */

/**
 * How many people's identity documents make a file refusable.
 *
 * Two. Named rather than spelled `>= 2` at the one call site, because the
 * number is the RULE — "one file, one card" — and a reader looking for where
 * that is decided should find a constant rather than a comparison.
 */
export const MULTI_CARD_THRESHOLD = 2;

/**
 * The `code` the two later refusal points answer with — the AI read
 * (`POST /api/documents/[id]/ai-interpret`) and the identity-card step
 * (`POST /api/admin/import/extract-id-card`).
 *
 * ⚠️ **ONE STRING, IN THE MODULE BOTH ENDS ALREADY IMPORT.** It is a contract
 * between four files — two routes that write it, `runAiInterpret` that reads
 * it, and the review dialog that turns it into a sentence — and a typo in any
 * half is a refusal that silently degrades into an ordinary failure, which is
 * to say into a row offering a retry that will be refused again.
 *
 * ⚠️ **AND IT LIVES HERE RATHER THAN IN `ai-interpret-run.ts`**, which is where
 * the first draft put it: that module fetches, and pulling it into a Route
 * Handler to reach one string is how a server file starts importing the client
 * side of the app. This one is pure by contract and both routes already ask it
 * `showsMoreThanOnePerson`.
 *
 * The value is the string the dialog's `KNOWN_ERROR_CODES` carries, which is
 * what selects `error_multiple_identities` out of `messages/*.json`.
 */
export const MULTI_IDENTITY_CODE = "multiple_identities";

/**
 * The largest count this module will BELIEVE.
 *
 * ⚠️ **REJECTED, NOT CLAMPED — and the first draft clamped, which an
 * adversarial round caught as the module contradicting itself.** A model
 * answering `1e9` is not a finding, it is a malformed answer; this file's whole
 * stated direction is that it refuses only on evidence, and clamping turned the
 * malformed answer into a refusal (99 is `>= MULTI_CARD_THRESHOLD`) while the
 * comment above it said the opposite. So anything above this is `null`, which
 * never refuses, and the two later refusal points are what stand behind it.
 *
 * The number is generous on purpose: a real sheet of identity cards is two,
 * occasionally three. Ninety-nine is far outside anything a scanner produces
 * and comfortably inside anything a confused model might.
 */
export const MAX_BELIEVABLE_PERSONS = 99;

/**
 * One entry, as this gate needs it.
 *
 * ⚠️ **`identityPersonCount: null` and the property being ABSENT are one
 * thing, deliberately.** A file that was never sent (not an image, already in
 * the archive, the request failed) and a file whose answer carried no count are
 * both "nobody said", and both are answered the same way — see the module
 * header on why silence never refuses. Distinguishing them here would put a
 * second meaning on a field whose only reader is the comparison below.
 */
export type MultiCardEntry = {
  /** The walk's path for the entry, so the input reads as itself. */
  path: string;
  /**
   * How many DISTINCT people's identity documents the classifier said this
   * file shows. `null`, or absent, when nobody said.
   */
  identityPersonCount?: number | null;
};

/** One file the run refuses, and how many people the classifier read on it. */
export type MultiCardFinding = {
  /** The walk's path, exactly as it arrived. */
  path: string;
  /**
   * The count that refused it — always at least `MULTI_CARD_THRESHOLD`.
   *
   * Carried rather than left at "more than one" because the screen says it: a
   * user standing in File Explorer with a scan of three cards needs to know
   * they are looking for three, not two.
   */
  personCount: number;
};

/** What the classification established about this folder's identity scans. */
export type MultiCardVerdict = {
  /** Every refused file, in walk order — never sorted and never capped. */
  refused: readonly MultiCardFinding[];
  /** Empty `refused` means the import may carry on. */
  clean: boolean;
};

/**
 * The count a classifier's answer actually gives us, or `null`.
 *
 * ⚠️ **THE BOUNDARY WHERE A MODEL'S OUTPUT IS READ, and it is the only one.**
 * The scan route calls it on the way in, so nothing downstream ever handles a
 * raw `unknown`; `identity-card` and `ai-interpret` call it on their own
 * answers for the same reason. A `"2"` returned as a string is accepted —
 * models return JSON and JSON numbers, but a string of digits is the commonest
 * shape a model reaches for when a field is described in prose, and refusing it
 * would silently drop exactly the finding this slice exists for.
 *
 * ⚠️ **DIGITS ONLY ON THE STRING BRANCH, and `Number()` alone is why.** It
 * accepts `"0x10"` (16), `"1e2"` (100) and `" 2 "` — so a model that answered
 * in any of those shapes would have produced a refusal out of something nobody
 * meant as a count. The regex is the whole guard; the trim before it is what
 * keeps `" 2 "` working, which is an ordinary thing for a model to emit.
 *
 * Everything else is `null`: a boolean, an object, `NaN`, `Infinity`, a
 * negative, a fraction that is not a whole number of people, and any count
 * above `MAX_BELIEVABLE_PERSONS`. `null` never refuses.
 */
export function identityPersonCountOf(raw: unknown): number | null {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : Number.NaN;
  if (!Number.isFinite(value)) return null;
  // Not `Math.round`: `1.6` is not two people, it is an answer nobody should
  // act on, and rounding it up would manufacture the refusal.
  if (!Number.isInteger(value)) return null;
  if (value < 0) return null;
  // See the constant: an answer this large is malformed, and a malformed answer
  // is not evidence of anything.
  if (value > MAX_BELIEVABLE_PERSONS) return null;
  return value;
}

/**
 * Does this count refuse the file?
 *
 * One expression, asked by the gate below and by the two later refusal points,
 * so "more than one person" cannot come to mean different things at the three
 * places the system can notice it.
 */
export function showsMoreThanOnePerson(count: number | null | undefined): boolean {
  return typeof count === "number" && count >= MULTI_CARD_THRESHOLD;
}

/**
 * Which files this classification refuses.
 *
 * Walk order, because that is what makes the list checkable line by line
 * against File Explorer — the argument every violation list in this folder
 * makes.
 */
export function checkMultiCard(
  entries: readonly MultiCardEntry[],
): MultiCardVerdict {
  const refused: MultiCardFinding[] = [];
  for (const entry of entries) {
    const count = entry.identityPersonCount;
    if (showsMoreThanOnePerson(count)) {
      // Narrowed by `showsMoreThanOnePerson`, which is the only test that lets
      // a value through — so the non-null assertion a reader might expect here
      // is a `typeof` inside that function instead.
      refused.push({ path: entry.path, personCount: count as number });
    }
  }
  return { refused, clean: refused.length === 0 };
}

/**
 * May this import carry on past the identity scans?
 *
 * Exported so the wizard holds no copy of the rule. `null` is "not asked in
 * this run", and it answers `true`: unlike the type gate, a question that was
 * never put has produced no finding, and this rule refuses only on a finding.
 * See the module header.
 */
export function cardsAreClean(verdict: MultiCardVerdict | null): boolean {
  return verdict === null || verdict.clean;
}
