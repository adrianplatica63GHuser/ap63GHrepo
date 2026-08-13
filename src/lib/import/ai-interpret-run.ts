/**
 * runAiInterpret — the AI interpretation, without a button.   (Slice #26.09)
 *
 * WHAT THIS IS, AND WHERE IT CAME FROM
 * ------------------------------------
 * Until this slice, interpreting an imported document meant pressing
 * "Interpretează AI" on its row and watching `DocumentAiInterpretDialog` do
 * three things: call the route, read the document's current state, and write
 * one patch. The slice's brief removes the button — *all* AI interpretation now
 * happens automatically during the import run — so those three steps had to
 * become something the loop can call. They are this function, and the dialog is
 * deleted in the same commit rather than left standing with no way in. Two
 * paths to one result is how they drift, which is the argument #26.02 already
 * made about the structure rules.
 *
 * ⚠️ **IT IS NOT A VERBATIM MOVE, AND THE DIFFERENCES ARE ALL IN ONE
 * DIRECTION.** There were TWO shipped versions of this action — the dialog's
 * and `document-form.tsx`'s, both deleted here — and where they disagreed, the
 * safer one was taken. Each is called out at its own line below; the two that
 * matter are that `customFields` is MERGED rather than overwritten (the form's
 * behaviour, not the dialog's; `updateDocument` replaces the whole JSON column,
 * so sending the model's object raw deletes every key it did not return), and
 * that a document whose current state could not be read is not written to at
 * all rather than written to from an assumption. The reason for the direction:
 * nobody is watching any more. The dialog ran once, on one document, with a
 * human reading the result; this runs ~40 times unattended.
 *
 * ⚠️ **THE ROUTE MAY RE-CLASSIFY THE DOCUMENT, and that write is applied.**
 * `fields.documentTypeId` comes back when a model reading every page disagrees
 * with the import scan's thumbnail glance, and the dialog's own header recorded
 * Adrian's decision to trust it. It is also the path that auto-creates
 * `lookup_document_type` rows. That was a considered trade with one document in
 * front of you; it is now a trade made ~40 times without asking, and the two
 * things that keep it honest are that the row COUNTS it (see `fieldCount`) and
 * that the row carries the scan's own confidence beside the tick.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not touch PARTIES. The route returns the people it read out of the
 * document, and this returns them untouched to its caller — nothing is linked
 * and nothing is created here. That is not an omission: `AiPartyLinkerDialog`
 * exists precisely because a person the model believes it recognised must be
 * confirmed by a human before a record is written or joined, and a run that
 * created people on its own would be the failure the whole 26.xx redesign was
 * opened to prevent. The caller queues them and walks the same stepper the
 * button used to open.
 *
 * IT DOES NOT TRANSLATE, EITHER
 * -----------------------------
 * A failure comes back as a REASON plus the route's own message when there was
 * one. The route's messages are already Romanian and specific (the 422 even
 * names the octet-stream case), so they are worth surfacing verbatim — but the
 * choice of a fallback sentence belongs to the screen, not to a module in
 * `lib/`, which has no locale.
 *
 * NOTHING WAITS FOR EVER
 * ----------------------
 * Each call carries its own timeout. Under a button a hung request was a
 * spinner somebody could walk away from; inside the run it is a task that never
 * settles, so the loop never finishes, so the dialog's Close never appears —
 * and the stage bar's Cancel is disabled for the whole `importing` phase, so a
 * page reload is the only way out. A timeout turns that into one amber row.
 *
 * Everything is written in ONE PATCH — fields, customFields, appended notes and
 * `aiInterpretedAt` together. Two would mean two `document_version` rows for
 * one action on a versioned entity.
 */

// Type-only, so nothing from `app/` is pulled into anything this module is
// bundled with: the party shape is declared beside the dialog that consumes it,
// and re-declaring it here would be a second copy of a wire format.
import type { AiExtractedParty } from "@/app/documents/_components/ai-party-linker-dialog";
import { hasReadablePage, type FSEntry } from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// Types — mirror the route's response rather than importing it, so no
// server-only module is ever pulled into the client bundle (the same reasoning
// ai-party-linker-dialog.tsx records for its own copies).
// ---------------------------------------------------------------------------

export type AiInterpretSkippedPage = {
  fileName: string;
  mimeType: string | null;
  reason: string;
};

type AiInterpretResponse = {
  fields?: Record<string, string | null>;
  customFields?: Record<string, string | null>;
  notes?: string | null;
  parties?: AiExtractedParty[];
  partyRolesConfigured?: boolean;
};

/**
 * What one automatic interpretation did.
 *
 * ⚠️ **`ok: true` with `parties.length > 0` means the people are still
 * UNRESOLVED.** Nothing has been linked or created — see the module header.
 */
export type AiInterpretRunResult =
  | {
      ok: true;
      fieldCount: number;
      parties: AiExtractedParty[];
      /**
       * Something the model returned was NOT written, because the document's
       * current state could not be read.   (See `currentReadable` below.)
       *
       * ⚠️ **ONE FLAG FOR ONE CONDITION, and the second adversarial round is
       * why.** It was called `notesDropped` and computed from the notes alone —
       * but the same unreadable GET also suppresses the custom fields, and most
       * document types produce custom fields and no notes. So the commonest
       * shape of this failure reported nothing at all: a green tick over a
       * billed call whose type-specific values had been thrown away, on a row
       * that then said "AI processed" and offered no way to try again.
       *
       * ⚠️ **A partial success has to be visible or it is a lie.** The rest of
       * the run succeeded — the baseline fields are written and the stamp is
       * set — so returning `ok: false` would misreport it in the other
       * direction.
       */
      partialWrite: boolean;
      /**
       * The document type this call MOVED the document to, or null when it left
       * the type alone.                                        (Slice #27.05)
       *
       * ⚠️ **The caller cannot work this out for itself, and #27.05 needs it to
       * be right.** The route may re-classify the document — this file's own
       * header calls that out, and says it is also the path that auto-creates
       * `lookup_document_type` rows — so the type the import loop RESOLVED
       * before creating the document is not necessarily the type the document
       * is on afterwards. A discovery queued against the resolved id would then
       * open a review screen naming one type, over pairs read out of a document
       * that now sits on another, and write the fields onto the wrong one.
       *
       * ⚠️ **Null means "not changed", NOT "unknown".** It is the same
       * expression the patch is built from (`retyped`), so it is null in all
       * three of the cases where nothing was written: the model agreed, the
       * model said nothing, or the current type could not be read and the
       * re-type was skipped — which `partialWrite` beside it already reports.
       */
      documentTypeId: string | null;
    }
  | {
      ok: false;
      /**
       * `session` is the one the caller must not treat as a per-row failure:
       * the sign-in has gone, so every row after this one would fail the same
       * way and the loop aborts. `failed` is this document only.
       */
      reason: "session" | "failed";
      /** The route's own Romanian sentence, when it gave one. */
      detail: string | null;
      /** The pages the route could not send, when it said which. */
      skipped: AiInterpretSkippedPage[];
    };

// ---------------------------------------------------------------------------
// Which entries are read at all
// ---------------------------------------------------------------------------

/**
 * Should the run spend a model call on this entry?   (Slice #26.09)
 *
 * ⚠️ **EXPORTED SO IT CAN BE TESTED AND SO IT IS SAID ONCE**, and both halves
 * matter. It is the rule the import loop applies per row, and it is also what
 * the Import screen counts to tell the user in advance what the click will
 * cost. A number on a screen and the loop it describes must be one expression;
 * and inside the loop it sits behind an awaited create-and-upload sequence with
 * no way to reach it from a test.
 *
 * The identity-card half is #23.08's argument, moved from a render to here and
 * not rewritten: on a card the person action extracts the card number, the
 * issuing authority and both validity dates, while this route builds its prompt
 * from the type's `template_fields` — and CARTE_IDENTITATE has none, so it asks
 * for four generic fields and returns strictly less for a second billed call.
 *
 * ⚠️ `canCreatePerson` is what makes that true, and dropping it is a real bug
 * rather than a simplification: since #26.07 the person action is NOT offered
 * on a card under `common` or `floating`, which is exactly where an owner's
 * carte de identitate belongs — so suppressing this one as well would leave the
 * file imported and never read by anything.
 */
export function shouldInterpretEntry(
  entry: FSEntry,
  scan: { isIdCard: boolean; canCreatePerson: boolean },
): boolean {
  return interpretSkipReason(entry, scan) === null;
}

/**
 * WHY the run will not read this entry, or null when it will.   (Slice #26.10)
 *
 * ⚠️ **`shouldInterpretEntry` is now defined in terms of this, rather than the
 * other way round, and that direction is the point.** 26.10 puts a sentence on
 * every result row saying how far processing got, and the row that said nothing
 * at all was the skipped one — so the screen needed the reason, not the
 * boolean. Deriving the reason from a second expression beside the first is how
 * a screen comes to explain a decision the loop did not make: the two would
 * agree on the day they were written and drift on the day one of them gains a
 * term. There is one rule here, and the boolean is the thinner view of it.
 *
 *   - `no-page`  — nothing a model can look at. A `.txt` document, a page
 *     folder of files the route refuses; reading it returns 422 and nothing
 *     else.
 *   - `id-card`  — #23.08's argument, unchanged: the person action reads the
 *     card number, the issuing authority and both validity dates, where this
 *     route builds its prompt from the type's `template_fields` and
 *     CARTE_IDENTITATE has none. A second billed call for strictly less.
 *
 * The order matters and is the same order the rule has always had: a card with
 * no readable page is `no-page`, because that is the reason nothing could have
 * been read from it whatever the type turned out to be.
 */
export function interpretSkipReason(
  entry: FSEntry,
  scan: { isIdCard: boolean; canCreatePerson: boolean },
): "no-page" | "id-card" | null {
  if (!hasReadablePage(entry)) return "no-page";
  if (scan.isIdCard && scan.canCreatePerson) return "id-card";
  return null;
}

/**
 * May a failed or partial read be tried again right now?   (Slice #26.09)
 *
 * ⚠️ **EXPORTED BECAUSE IT HAS BEEN WRONG FOUR ROUNDS RUNNING**, which is the
 * only argument a three-term boolean needs to leave a component. The header
 * sentence and the row buttons both read it, so the screen cannot instruct an
 * action it has removed — that mismatch is what it was wrong about twice.
 *
 * ⚠️ **An expired session is deliberately NOT a term.** The flag never clears
 * on its own, so gating on it made an expiry a one-way door: sign in again and
 * the button that would now work was gone for the life of the dialog. The retry
 * discovers the truth by itself — it comes back `reason: "session"` and
 * re-raises the banner, or it succeeds and clears it. What the session changes
 * is the sentence beside the button, not whether the button exists.
 *
 * `stepperOpen` stays, and for a different reason entirely: nothing in this app
 * traps focus, so a control rendered under an open modal is reachable by
 * keyboard from inside it.
 *
 * ⚠️ **`retryRunning` is the term the reset's own safety argument assumes.** A
 * successful retry REPLACES the party queue rather than editing it, which is
 * only sound while retries are serial — and six amber rows after a rate limit
 * is the ordinary case, so clicking the second one while the first is still in
 * flight is ordinary behaviour. Two overlapping retries then resolve in turn
 * and the second one's `setPartySteps` throws the first one's people away,
 * pulling their stepper out from under the user mid-answer. The file's own
 * header already promises the follow-up actions are one at a time.
 */
export function canRetryReads(state: {
  done: boolean;
  stepperOpen: boolean;
  retryRunning: boolean;
}): boolean {
  return state.done && !state.stepperOpen && !state.retryRunning;
}

/**
 * The queued documents in the FOLDER's order, not in the order three concurrent
 * tasks happened to finish.   (Slice #26.09)
 *
 * Exported for the same reason as the rule above: it is a one-line reduction
 * whose only failure mode — a queue that jumps about — is invisible until a
 * user is halfway through confirming people for eight documents and cannot tell
 * where they are.
 */
export function inFolderOrder<T>(
  entries: readonly { path: string }[],
  byPath: ReadonlyMap<string, T>,
): T[] {
  const out: T[] = [];
  for (const entry of entries) {
    const queued = byPath.get(entry.path);
    if (queued !== undefined) out.push(queued);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The four generic baseline keys the route returns alongside documentTypeId. */
const BASELINE_KEYS = ["title", "nrDocument", "dateDocument", "subject"] as const;

const filled = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.trim() !== "";

const sessionFailure = (): AiInterpretRunResult => ({
  ok: false,
  reason: "session",
  detail: null,
  skipped: [],
});

/**
 * Has the sign-in gone?
 *
 * ⚠️ **`redirected` alone is not enough, and under a button it did not matter.**
 * A deployment that answers an expired session with a 401 never sets
 * `redirected`, so the old dialog reported "interpretation failed" and the user
 * pressed the button again. In a loop over forty documents the same misreading
 * spends forty billed attempts into a dead session and labels forty rows with a
 * cause that is not true.
 *
 * ⚠️ **401 ONLY — 403 is deliberately NOT here**, and it was for one round.
 * 401 is authentication; 403 is authorization, which is what a row-level rule,
 * an ownership check or a CSRF guard returns. Treating one document's
 * permission problem as a lost session aborts the whole folder, discards the
 * party queue and tells a signed-in user to sign in again — while throwing away
 * the 403's own message, because a session failure carries no detail. A 403 is
 * this document's failure and is reported as one.
 *
 * The third case — a rewritten 200 holding a sign-in PAGE — cannot be seen from
 * the status at all. `servesHtml` below is what catches it, and it is applied to
 * ALL THREE calls: the PATCH is the only one that writes, and a 200 sign-in page
 * swallowing it made this function report `ok: true` over a document it had not
 * touched.
 *
 * ⚠️ **EXPORTED SINCE #27.05, and the export is what stops a second copy.**
 * `discover-run.ts` makes the same call to the same route and needs the same
 * three tests; every one of them was wrong once and was fixed by an adversarial
 * round (401-but-not-403 here, HTML-on-a-2xx-only below, headers-not-body on
 * the timer). A copy would carry today's version of those fixes and none of
 * tomorrow's — which is the argument this file's own header makes about two
 * paths to one result.
 */
export const isSessionLoss = (res: { redirected: boolean; status: number }): boolean =>
  res.redirected || res.status === 401;

/**
 * Is this response a web PAGE where JSON was expected?
 *
 * ⚠️ **Positively HTML, not merely "not JSON", and an adversarial round is why.**
 * The naive test was `!contentType.includes("json")`, which fails toward the
 * ABORTING branch for anything unlabelled — and an empty or truncated 200 from a
 * proxy commonly carries no content type at all. That is one of the two benign
 * cases the rule was written to spare, so it was aborting the folder for exactly
 * what it claimed to protect. A sign-in page, by contrast, always announces
 * itself as HTML.
 *
 * ⚠️ It is deliberately blind to a 204. `PATCH /api/documents/[id]` answers
 * `new Response(null, { status: 204 })` on success, which carries no content
 * type — read as "not JSON" that would have made every successful write look
 * like a lost session.
 *
 * ⚠️ **Only ever asked of a 2xx, and the call sites enforce that.** A gateway
 * error page is HTML too — a 504 from a function timeout, a 502 during a
 * deploy, a Cloudflare 5xx — and the request most likely to draw one is the
 * slow extract POST. Asked ahead of the status it turned the commonest
 * infrastructure failure into a false session expiry, which aborts the folder
 * and throws away the whole run's unconfirmed people, while suppressing the
 * `HTTP 504` the status branch would have put on the row. A page behind a 200
 * is a swallowed request; a page behind a 5xx is a gateway saying so.
 *
 * ⚠️ **Exported since #27.05** — see `isSessionLoss` above for why it is
 * shared rather than copied.
 */
export const servesHtml = (res: { headers: { get(name: string): string | null } }): boolean =>
  (res.headers.get("content-type") ?? "").toLowerCase().includes("html");

/**
 * How long a call may take, by what it is doing.
 *
 * The model call is generous: it sends every page of a document, and a
 * twenty-page authenticated act is not quick. The other two are ordinary
 * database round trips and get a database round trip's patience — sharing the
 * model's budget would mean a hung PATCH costing two extra minutes per document
 * for nothing.
 *
 * ⚠️ **This bounds the HEADERS, not the body.** `fetch` resolves when the
 * response head arrives, so the timer is cleared before `res.json()` reads
 * anything. A stalled body is not covered — say so rather than implying the
 * whole call is fenced.
 */
const MODEL_TIMEOUT_MS = 120_000;
const RECORD_TIMEOUT_MS = 30_000;

/**
 * `fetch` that gives up rather than hanging the whole import.
 *
 * ⚠️ **Exported since #27.05**, with the MS as an argument rather than a
 * constant inside — `discover-run.ts` has its own budget (the route asks the
 * model for twice the output tokens in discover mode) and shares this wrapper.
 */
export async function fetchWithTimeout(
  url: string,
  ms: number,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/**
 * Read one document with the model and write what it found onto that document.
 *
 * Never throws: every outcome is a value, because the caller is a loop over a
 * folder and one unreadable document must not take the rest of the import with
 * it. The Document itself already exists and is already linked by the time this
 * runs — a failure here costs its fields, not its file.
 *
 * @param stamp the value written to `aiInterpretedAt`. An argument rather than
 *        a `new Date()` inside, so a test can pin the patch exactly. The caller
 *        evaluates it when the read STARTS, which is the honest reading of a
 *        stamp on a call that takes tens of seconds.
 */
export async function runAiInterpret(
  documentId: string,
  stamp: string,
): Promise<AiInterpretRunResult> {
  try {
    // Inside the try, not above it: `encodeURIComponent` throws `URIError` on a
    // lone surrogate, and it is the one statement that would break the promise
    // in this function's first sentence.
    const id = encodeURIComponent(documentId);

    // 1. Extract. A bodyless POST is exactly what the route treats as
    //    "extract" mode — discover mode needs an explicit {mode:"discover"}.
    const res = await fetchWithTimeout(`/api/documents/${id}/ai-interpret`, MODEL_TIMEOUT_MS, {
      method: "POST",
    });
    if (isSessionLoss(res) || (res.ok && servesHtml(res))) return sessionFailure();

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        skippedPages?: AiInterpretSkippedPage[];
      };
      return {
        ok: false,
        reason: "failed",
        detail: body.error ?? `HTTP ${res.status}`,
        skipped: body.skippedPages ?? [],
      };
    }

    // The sign-in-page case is caught by `servesHtml` above. What is left here
    // is a body that claimed to be JSON and was not — a reset mid-stream, a
    // truncated proxy response — which is this document's failure and not a
    // reason to abandon the folder. Guarded at all because an unguarded
    // `json()` turned the parse failure into a raw English V8 parser message on
    // a Romanian screen.
    const data = (await res.json().catch(() => null)) as AiInterpretResponse | null;
    if (data === null) {
      return { ok: false, reason: "failed", detail: null, skipped: [] };
    }

    // 2. Read the document as it stands. TWO things come from this call and
    //    both are about not destroying what is already there:
    //
    //      - `notes`, so Enhanced Notes are APPENDED rather than substituted.
    //      - `customFields`, so the model's values are MERGED into whatever is
    //        stored rather than replacing the column. `updateDocument` writes
    //        `patch.customFields` whole, so sending the model's object raw
    //        deletes every key it did not return — which is precisely what a
    //        curated field on a type with a template is.
    //
    //    A freshly imported document has neither, but this also runs against
    //    one somebody touched in between, and losing a human's work to an
    //    automatic append would be unrecoverable from here.
    //
    //    ⚠️ A GET that fails is not a failure of the run — it means we could
    //    not prove what is there. Every write that depends on knowing it is
    //    then SKIPPED rather than made from an assumption, and `partialWrite`
    //    says so out loud.
    let existingNotes: string | null = null;
    let existingTypeId: string | null = null;
    let existingCustom: Record<string, string | null> = {};
    let currentReadable = false;
    const cur = await fetchWithTimeout(`/api/documents/${id}`, RECORD_TIMEOUT_MS);
    if (isSessionLoss(cur) || (cur.ok && servesHtml(cur))) return sessionFailure();
    if (cur.ok) {
      const row = (await cur.json().catch(() => null)) as {
        notes?: string | null;
        documentTypeId?: string | null;
        customFields?: Record<string, string | null> | null;
      } | null;
      if (row !== null) {
        existingNotes = row.notes ?? null;
        existingTypeId = row.documentTypeId ?? null;
        // ⚠️ Checked rather than trusted, in the one hunk whose whole purpose
        // is not destroying data. `{ ...aString }` spreads to `{"0":"{", …}`
        // and an array spreads to numeric keys, and either would become the
        // PATCH body for this column.
        const custom = row.customFields;
        existingCustom =
          typeof custom === "object" && custom !== null && !Array.isArray(custom)
            ? custom
            : {};
        currentReadable = true;
      }
    }

    // 3. Build one patch.
    const fields = data.fields ?? {};
    const patch: Record<string, unknown> = { aiInterpretedAt: stamp };

    let fieldCount = 0;
    for (const key of BASELINE_KEYS) {
      if (filled(fields[key])) {
        patch[key] = fields[key];
        fieldCount++;
      }
    }

    /**
     * What the model wants to do to this document's TYPE, and whether we know
     * enough to let it.
     *
     * ⚠️ **A RE-TYPE IS A WRITE THAT NEEDS THE CURRENT STATE.** `documentTypeId`
     * is NOT NULL on `document`, so it is only ever sent when the route resolved
     * one — but sending it while the current type is unknown re-types a document
     * whose `customFields` cannot then be cleared, which is exactly the orphaned
     * state the block below exists to prevent. Skipped and reported instead.
     *
     * (The WRITE itself is narrower still and lives under `retyped` below —
     * these two lines decide whether the question can be answered at all, not
     * whether the answer is yes.)
     */
    const wantsRetype = filled(fields.documentTypeId);
    // ⚠️ **`typeKnown`, not `currentReadable`**, and the two writes below must
    // read the SAME test or they disagree. A GET that answers without a
    // `documentTypeId` leaves the re-type firing while the orphan-clearing
    // below cannot — which is verbatim the state that clearing exists to
    // prevent, arrived at through the guard added to prevent it.
    const typeKnown = currentReadable && existingTypeId !== null;

    /**
     * ⚠️ **MERGED — unless this patch also re-types the document, and then
     * REPLACED.** Merging is right while the type stays put: the column is
     * written whole, so anything the model did not return would otherwise be
     * deleted, and a curated value the model returned as null would be nulled.
     *
     * It is wrong the moment `documentTypeId` changes. `customFields` holds the
     * values of the TYPE's template, and the form renders the fields the
     * current type declares — so keys carried over from the old type are
     * persisted, snapshotted into every later `document_version`, and visible on
     * no screen and editable from none.
     *
     * ⚠️ **`existingTypeId !== null` is the guard that makes this FAIL SAFE,
     * and an adversarial round is why.** Written as "the model's id differs
     * from what we read", an absent or nested `documentTypeId` in the GET reads
     * as "the type changed" on EVERY document — and the changed branch is the
     * destructive one, so a response-shape change would silently delete every
     * curated custom field in the folder. "I could not read the current type"
     * means "I cannot prove it changed", which is the merge case.
     */
    const retyped = wantsRetype && typeKnown && fields.documentTypeId !== existingTypeId;

    // ⚠️ Sent only when it CHANGES. The other baseline fields go in without
    // comparison because nothing here knows what they held; this one is
    // compared anyway, and writing — and counting — an id the document already
    // has inflated the number this file calls the whole report, on the ordinary
    // run where the model agrees with the scan about most documents.
    if (retyped) {
      patch.documentTypeId = fields.documentTypeId;
      fieldCount++;
    }

    const customFields = data.customFields ?? {};
    const extracted = Object.keys(customFields).filter((k) => filled(customFields[k]));

    // ⚠️ `|| retyped`, not `extracted.length > 0` alone. A re-classification to
    // a type with no template returns no custom fields at all, and that is the
    // case where the orphans most need clearing — the block that clears them
    // must not be gated on the model having sent something.
    // ⚠️ `existingCustom` has to hold something for a re-type to be worth
    // clearing. A freshly imported document has no custom fields at all, so
    // every re-classification during a run took this branch to write
    // `customFields: {}` over nothing — a column write whose only certain
    // effect is whatever `updateDocument`'s diffing makes of it, on an entity
    // where a version row is the thing this module's one-patch rule cares
    // about.
    const clearsOrphans = retyped && Object.keys(existingCustom).length > 0;
    if (currentReadable && (extracted.length > 0 || clearsOrphans)) {
      const merged: Record<string, string | null> = retyped ? {} : { ...existingCustom };
      for (const key of extracted) merged[key] = customFields[key];
      patch.customFields = merged;
      fieldCount += extracted.length;
    }

    // Every write this run wanted to make and could not — see `partialWrite`.
    // The notes and the custom fields need the document readable; the re-type
    // needs its current TYPE, which is the stricter of the two.
    const partialWrite =
      (!currentReadable && (filled(data.notes) || extracted.length > 0)) ||
      (wantsRetype && !typeKnown);
    if (filled(data.notes) && currentReadable) {
      patch.notes = filled(existingNotes)
        ? `${existingNotes}\n\n${data.notes}`
        : data.notes;
    }

    const patchRes = await fetchWithTimeout(`/api/documents/${id}`, RECORD_TIMEOUT_MS, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    // ⚠️ **The only call in this function that WRITES, and the one that had no
    // page check.** A 200 sign-in page here satisfies `patchRes.ok`, skips the
    // error branch, and this function then reported `ok: true` with a field
    // count over a document it had not touched — while the row set
    // `aiProcessed` and queued that document's people against a dead session.
    if (isSessionLoss(patchRes) || (patchRes.ok && servesHtml(patchRes))) return sessionFailure();
    if (!patchRes.ok) {
      const body = (await patchRes.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        reason: "failed",
        detail: body.error ?? `HTTP ${patchRes.status}`,
        skipped: [],
      };
    }

    // 4. Parties, when this document type has roles configured. When it does
    //    not, the route returns [] with partyRolesConfigured=false — not an
    //    error, just a type nobody has set up in Reference Data yet.
    return {
      ok: true,
      fieldCount,
      parties: data.parties ?? [],
      partialWrite,
      // ⚠️ Read off `retyped`, not off `fields.documentTypeId`, so it can never
      // name a type this call did not actually write — `retyped` is the one
      // expression the PATCH itself is built from, and `filled()` has already
      // proved the value is a non-empty string by the time it is true.
      documentTypeId: retyped ? (fields.documentTypeId as string) : null,
    };
  } catch (err) {
    // ⚠️ An abort is OUR timer, not the user, and `DOMException`'s message says
    // "The user aborted a request." in English. Putting that on a row's tooltip
    // in a Romanian UI is the same leak the JSON guard above exists to have
    // stopped; the screen's own fallback sentence is the right thing here.
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      reason: "failed",
      detail: aborted || !(err instanceof Error) ? null : err.message,
      skipped: [],
    };
  }
}
