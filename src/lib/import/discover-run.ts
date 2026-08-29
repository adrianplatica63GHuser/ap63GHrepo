/**
 * discoverForType — the schema-free read, without a button.    (Slice #27.05)
 *
 * WHAT THIS IS, AND WHY IT SITS BESIDE `runAiInterpret`
 * ----------------------------------------------------
 * Until this slice, the only caller of the ai-interpret route's `discover` mode
 * was the "Descoperire AI" button on `document-form.tsx`: a user had to notice
 * that a document type had no custom form, find a document of that type, open
 * it, and remember which button reads it. The noticing and the running are what
 * #27.05 automates — the import run meets the type first, so the import run is
 * where the read belongs.
 *
 * ⚠️ **WHAT IT DOES NOT AUTOMATE IS THE ACCEPTING, and that is the point of the
 * slice rather than an omission.** This function WRITES NOTHING — not a field,
 * not a stamp, not a row. It reads one document and returns what the model
 * said. Everything after it is `DiscoverReviewDialog` and a human's tick boxes,
 * for three reasons the code around it already states:
 *
 *   - the evidence is ONE document read with no schema, and
 *     `discover-to-template.ts` says so about itself ("one sample is thin
 *     evidence, which is exactly why this is a proposal");
 *   - a template field's KEY is permanent once documents hold values under it,
 *     whatever #27.03's editor can now remove from the screen;
 *   - every accepted field is a line in the extraction prompt for every future
 *     document of that type, for ever.
 *
 * ⚠️ **NOTHING HERE IS GATED ON `ai_interpreted_at`.** Discover mode stamps
 * nothing, which is exactly what lets it be re-run as often as anyone likes,
 * and #26.11 refused that gate once already. The rule that stops a second call
 * is `shouldDiscoverType` below — one read per TYPE per run — and it is about
 * money, not about state.
 *
 * ⚠️ **IT IS A SEPARATE MODULE, NOT A `mode` PARAMETER ON `runAiInterpret`.**
 * The two share a route and nothing else: that one reads a document to fill IN
 * the document and makes three calls, of which one writes; this one reads a
 * document to describe its TYPE and makes exactly one call, which does not. A
 * flag threaded through the other would have put a `if (!discover)` in front of
 * the merge, the re-type and the patch — the three hunks whose comments are the
 * longest in this folder.
 *
 * WHAT IT SHARES, AND WHY
 * -----------------------
 * The session test, the sign-in-page test and the timeout wrapper are imported
 * from `ai-interpret-run.ts` rather than copied. Every one of them was wrong at
 * least once and was fixed by an adversarial round — 401-but-not-403, HTML on a
 * 2xx only, a timer bounding the headers and not the body — and a second copy
 * would inherit today's version of those fixes and none of tomorrow's. The
 * TIMEOUT is this module's own, because the budget genuinely differs: discover
 * asks for twice the output tokens of an extract and reads every page.
 */

// Type-only, so nothing from `app/` is pulled into anything this module is
// bundled with — the same reasoning `ai-interpret-run.ts` records for its own
// party type. The pair shape is declared beside the dialog that consumes it,
// and re-declaring it here would be a second copy of a wire format.
import type { DiscoverReviewPair } from "@/app/documents/_components/discover-review-dialog";
import { fetchWithTimeout, isSessionLoss, servesHtml } from "@/lib/import/ai-interpret-run";

/**
 * How long one schema-free read may take.
 *
 * ⚠️ **The SERVER's ceiling is lower than this and is the one that decides:**
 * `ai-interpret/route.ts` declares `export const maxDuration = 60`, so on Vercel
 * the request is killed at 60 s whatever this says. An adversarial round caught
 * a first draft at 180 s, argued from the model's side — discover asks for
 * `max_tokens: 16384` against the extract's 8192 — and that argument is the
 * reason the number cannot be spent rather than a reason to raise it.
 *
 * ⚠️ **So this is a BACKSTOP, not a budget, and it is the extract's own.**
 * `maxDuration` is a Vercel directive and is not enforced by `next start`, which
 * is how Ciprian's box runs — there the request really can hang, and this is the
 * only thing that ends it. Matching `MODEL_TIMEOUT_MS` is deliberate: two model
 * calls to one route, killed by the client at the same point, rather than a
 * second number nobody can derive.
 *
 * ⚠️ **It bounds the HEADERS, not the body** — see `fetchWithTimeout`, whose own
 * comment says why. A stalled body is not covered.
 */
const DISCOVER_TIMEOUT_MS = 120_000;

/**
 * What one automatic discovery found, or why it found nothing.
 *
 * ⚠️ **There is no `partialWrite` here and there never can be**, which is the
 * one structural difference from `AiInterpretRunResult`: this function makes no
 * write to be partial about.
 *
 * `reason: "session"` is the failure the caller must not treat as this
 * document's own — the sign-in has gone, so every call after it fails the same
 * way. `failed` is this document only, and it is deliberately not reported to
 * the user as an error: a discovery that did not happen costs the type its
 * review screen this run, not its documents.
 */
export type DiscoverRunResult =
  | {
      ok: true;
      /** The label -> value pairs the model read, in its own reading order. */
      pairs: DiscoverReviewPair[];
      /** The model's own short Romanian name for what it read, or null. */
      documentLabel: string | null;
      /** The type's person roles — the review step shows them as captured. */
      partyRoleNames: string[];
      /** Pages the route could not send, and whether it ran out of budget. */
      skippedPages: number;
      truncated: boolean;
    }
  | { ok: false; reason: "session" | "failed" };

/**
 * Should this run spend a schema-free read on this document's type?
 *                                                              (Slice #27.05)
 *
 * ⚠️ **EXPORTED BECAUSE IT IS THE WHOLE SPENDING RULE**, and because two of its
 * four terms are wrong in a way no type checker sees. It is asked inside a loop
 * with three tasks in flight, which is where a test cannot reach it.
 *
 *   - `typeHasForm` — the type is already onboarded. A discovery run on a type
 *     WITH a form is a perfectly normal thing for a user to do by hand (it is
 *     how you find what is still unrecognised), but it is not a thing to do
 *     unasked and unattended, forty times, at a model call each.
 *
 *   - `claimedTypeIds` — one read per TYPE, not per document. The second
 *     document of a type has nothing to add to a proposal that is already
 *     waiting to be reviewed, and costs a billed read to say so.
 *
 *   - `fallbackTypeId` — ⚠️ **THE FALLBACK TYPE IS EXCLUDED, and it is the one
 *     term here that is a judgement rather than an economy.** `ensureDocType`
 *     puts every document whose scan produced no usable label on the
 *     catch-all — `catchAllType`, key UNCLASSIFIED, since Slice #29.07; before
 *     that, an `ALTUL` ?? `OTHER` ?? `items[0]` fall-through that always
 *     reached the same row by accident. That type is not a type whose form is
 *     missing; it is the type that means "we do not know what this is", and
 *     every unclassified document in the archive shares it. Reading one of them
 *     describes that one document, not the class — so the fields offered for
 *     review would be one contract's fields, proposed for the catch-all, with
 *     the ticks pre-set. That is precisely the trap #27.04 was opened to close,
 *     rebuilt inside an unattended loop. The rescue for such a document is
 *     #27.04's own: open it, press Descoperire AI, and say "this is a new
 *     document type".
 *
 *   - `typeIsIdCard` — ⚠️ **AN IDENTITY CARD'S TYPE IS NEVER READ FOR A FORM,
 *     and TWO adversarial rounds went into that one term.** The first
 *     assumption was that the run never reaches a card at all, because
 *     `interpretSkipReason` answers `id-card`. It does not: that rule also
 *     requires `canCreatePerson`, which is FALSE for a card under `common` or
 *     `floating` — and `ai-interpret-run.ts`'s own comment says that is
 *     "exactly where an owner's carte de identitate belongs". Such a card IS
 *     read by the general extract, its type has no form, and CARTE_IDENTITATE
 *     is not the fallback, so every other term said yes: the review opened on a
 *     card with `cnp`, `nume`, `prenume` and `domiciliu` PRE-TICKED, and one
 *     press would have put a second, freely-editable copy of somebody's
 *     national identity number on every identity card in the archive. That is
 *     what `src/lib/import/id-card.ts` captures as real Person records instead,
 *     what `proposeTemplateFields`'s `capturedElsewhere` parameter exists to
 *     refuse, and what `status.ts` calls the correct and permanent answer for
 *     this type.
 *
 *     ⚠️ **The second round then caught the FIX guarding the wrong axis.** It
 *     asked whether the SCAN said "identity card", and this rule is about the
 *     TYPE — the two come apart on the path #27.05 itself opened. A card the
 *     scan mislabels (a phone photo, both sides in one PDF) is not skipped, is
 *     read, and the model re-types it onto CARTE_IDENTITATE; the scan signal is
 *     false and the read went ahead. It comes apart the other way too: a scan
 *     that cries card over a document the model correctly re-types to a real
 *     contract type would suppress a form that type genuinely needs. So the
 *     caller answers this from the TYPE — its key, or a name that reads as a
 *     card — and falls back to the scan only for a type invented mid-run, where
 *     the scan is the only evidence there is.
 *
 * An empty `typeId` is refused as well. It cannot happen — `document_type_id`
 * is NOT NULL and the loop resolves one before it creates the row — but the
 * value that reaches here is a string from a JSON response, and an empty one
 * would claim a queue slot no dialog could ever be opened for.
 *
 * ⚠️ **`formsWaived` IS THE SECOND TERM, AND IT BELONGS HERE RATHER THAN IN
 * `typeAwaitsForm`.**                                          (Slice #32.05)
 * The stop screen now offers a second press: carry on with these types exactly
 * as they are. That press is a decision about what the run SPENDS, not a
 * different verdict about the types — so it answers the spending question NO
 * and leaves the reporting question answering YES. Both answers are honest on a
 * waived run: no discovery read is bought, and every row still says its type is
 * waiting for a form, because it is. Putting the waiver in `typeAwaitsForm`
 * instead would silence the rows as well, and the result screen would report a
 * fully landed import over documents whose types have nothing to put their
 * values in — which is the exact overclaim `type-form-gate.ts` was written to
 * stop.
 *
 * ⚠️ **REQUIRED RATHER THAN OPTIONAL.** A defaulted `formsWaived` is a call
 * site that can forget it and go on buying reads the user has just declined to
 * pay for, in silence. Both call sites pass the same value; the compiler is
 * what keeps a third one honest.
 */
export function shouldDiscoverType(input: {
  typeId: string;
  /** The catch-all row (`catchAllType`) — see above. Null when it is not known. */
  fallbackTypeId: string | null;
  typeHasForm: boolean;
  /** The document that would be read is an identity card — see above. */
  typeIsIdCard: boolean;
  /** The types this run has already claimed a discovery for. */
  claimedTypeIds: ReadonlySet<string>;
  /**
   * The user pressed "continue without forms" on the stop screen.
   *                                                            (Slice #32.05)
   *
   * ONE boolean for the whole run, never a set of type ids: half the types the
   * stop screen lists have no id to key on — `ClassifiedType.id` is null for
   * every type the run would CREATE — and a third case has no id anywhere on
   * that screen, the type `runAiInterpret` invents mid-run. One boolean answers
   * all three.
   */
  formsWaived: boolean;
}): boolean {
  return (
    !input.formsWaived &&
    typeAwaitsForm(input) &&
    !input.claimedTypeIds.has(input.typeId)
  );
}

/**
 * Is this document's type one that is waiting for a form at all?
 *                                                              (Slice #27.05)
 *
 * ⚠️ **`shouldDiscoverType` is defined in terms of THIS, and the direction is
 * the point** — the same relationship `interpretSkipReason` and
 * `shouldInterpretEntry` already have in `ai-interpret-run.ts`. Two questions
 * are asked of one document: should the run spend a read on its type, and
 * should the row SAY the type has no form. They differ by the per-run claim —
 * the second, third and fortieth document of a new type all report a type that
 * is waiting, while only the first is read — and, since #32.05, by the run's
 * waiver, which stops the spending and changes none of the reporting. Writing
 * them as two expressions is how a screen comes to describe a decision the loop
 * did not make.
 */
export function typeAwaitsForm(input: {
  typeId: string;
  fallbackTypeId: string | null;
  typeHasForm: boolean;
  typeIsIdCard: boolean;
}): boolean {
  return typeMayHoldAForm(input) && !input.typeHasForm;
}

/**
 * May this type have a form AT ALL — whether or not it already has one?
 *                                                              (Slice #29.09)
 *
 * ⚠️ **THIS IS THE SAME RULE WITH ONE TERM REMOVED, AND `typeAwaitsForm` IS NOW
 * DEFINED IN TERMS OF IT — the direction that file's own header insists on.**
 * DocTypeEngine asks a question #27.05 never had to: not "is this type waiting
 * for a form", but "may I point twenty documents and twenty billed reads at
 * this type". The two answers differ for exactly one input — a type that
 * ALREADY has a form — because a discovery run against such a type is a normal
 * thing to do (it is how you find what is still unrecognised) and the save is
 * additive. They must not differ for any other, and writing the refusal by hand
 * in the new screen is precisely how they would: `type-form-gate.ts`'s header
 * says a validator that disagrees with the executor is worse than no validator,
 * because it is believed, and #29.06 was deleted for being that shape.
 *
 * So the two permanent refusals live here, once:
 *
 *  - **CARTE_IDENTITATE.** It has no form and must never be given one — its
 *    data comes from the import's own identity-card step, and a second editable
 *    copy of a CNP on every document is what `id-card.ts` refuses. Without this
 *    a user would discover the refusal by spending twenty reads first.
 *  - **The catch-all.** NECLASIFICAT holds documents whose type is WRONG, not
 *    documents whose type is unfinished. A form distilled from whatever
 *    happened to be unclassifiable would be written onto the row every
 *    unrecognised document in the archive shares.
 */
export function typeMayHoldAForm(input: {
  typeId: string;
  fallbackTypeId: string | null;
  typeIsIdCard: boolean;
}): boolean {
  if (input.typeId === "") return false;
  // ⚠️ Ahead of every other term, because it is the one that is about the
  // DOCUMENT and it makes the row's sentence wrong as well as the read: a card
  // must not print "this type has no form yet" either. See above.
  if (input.typeIsIdCard) return false;
  if (input.fallbackTypeId !== null && input.typeId === input.fallbackTypeId) return false;
  return true;
}

/**
 * Read one document with no schema and report what the model found.
 *
 * Never throws: every outcome is a value, for the reason `runAiInterpret`
 * states about its own loop — one unreadable document must not take the rest of
 * the import with it. And a discovery that fails costs strictly less than an
 * extract that fails: the Document exists, its pages are uploaded, its fields
 * were filled by the extract call that ran before this one. What is lost is the
 * offer to give its TYPE a form during this run.
 *
 * @param documentId the document to read, and ⚠️ **WHICH ONE that is deserves
 *        saying plainly, because the honest answer is not the flattering one.**
 *        The loop claims a type from the first task to REACH this line — which,
 *        with three tasks in flight and each having just uploaded its pages and
 *        waited on an extract, is in practice the SHORTEST document of the type
 *        rather than the first in folder order. The alternative considered was
 *        the one with the most pages, which is likelier to carry the notarial
 *        authentication block where `nrDocument` and `dateDocument` live on an
 *        authenticated act (#21.03's lesson) — but knowing which that is means
 *        waiting for every row to settle and then paying for a serial read with
 *        the user watching, and it costs more per call, because discover sends
 *        every page. What makes the cheap choice survivable is that the review
 *        step is additive and re-runnable: `mergeAcceptedFields` appends, and
 *        Descoperire AI on a fuller document of the same type later offers what
 *        the thin one could not. A form is not finished by this run; it is
 *        started by it.
 */
export async function discoverForType(documentId: string): Promise<DiscoverRunResult> {
  try {
    // Inside the try for the reason the sibling module records: on a lone
    // surrogate `encodeURIComponent` throws `URIError`, and it is the one
    // statement that would break the promise in the sentence above.
    const id = encodeURIComponent(documentId);

    // ⚠️ **`{ mode: "discover" }` is the whole difference from the extract
    // call, and it must be an explicit body.** A bodyless POST is what the
    // route treats as extract mode — see its own comment — so a request that
    // lost its body would silently re-run the extract this document has already
    // had, write a second patch and a second `document_version` row, and return
    // a shape with no `recognised` in it.
    const res = await fetchWithTimeout(
      `/api/documents/${id}/ai-interpret`,
      DISCOVER_TIMEOUT_MS,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "discover" }),
      },
    );
    // `servesHtml` is asked of a 2xx ONLY, which is what the `res.ok &&`
    // enforces — a 504 from a function timeout is HTML too, and reading it as a
    // lost session would abort a folder for an infrastructure hiccup.
    if (isSessionLoss(res) || (res.ok && servesHtml(res))) {
      return { ok: false, reason: "session" };
    }
    // ⚠️ **Nothing from the route is surfaced verbatim, and nothing is
    // surfaced at all.** Its failures are English and some are Anthropic's own
    // words ("ANTHROPIC_API_KEY is not configured on the server"), which is why
    // #26.11 stopped `document-form.tsx` showing them. Here there is no
    // sentence to put them in either way: a discovery that did not happen is
    // reported by the ABSENCE of a review step for that type, and the row's own
    // note still says the type has no form — which is the true and useful
    // statement in every one of these branches.
    if (!res.ok) return { ok: false, reason: "failed" };

    const data = (await res.json().catch(() => null)) as {
      recognised?:     unknown;
      documentLabel?:  unknown;
      partyRoleNames?: unknown;
      skippedPages?:   unknown;
      truncated?:      unknown;
    } | null;
    if (data === null) return { ok: false, reason: "failed" };

    // The same filter `document-form.tsx` applies to the same payload, and it
    // is here so the two clients of one route cannot come to disagree about
    // what a usable pair is: a row with no name is a row the review dialog
    // would render as a blank tick box.
    const pairs = (Array.isArray(data.recognised) ? data.recognised : []).filter(
      (p): p is DiscoverReviewPair =>
        !!p && typeof p === "object" && typeof (p as { name?: unknown }).name === "string",
    );

    return {
      ok: true,
      pairs,
      // The route's schema allows null and the model may return an empty
      // string, so anything that is not a usable name becomes null — the review
      // step then opens with an empty new-type box rather than a blank name it
      // would have to reject. Same rule as `document-form.tsx`.
      documentLabel:
        typeof data.documentLabel === "string" && data.documentLabel.trim() !== ""
          ? data.documentLabel.trim()
          : null,
      partyRoleNames: Array.isArray(data.partyRoleNames)
        ? data.partyRoleNames.filter((r): r is string => typeof r === "string")
        : [],
      skippedPages: Array.isArray(data.skippedPages) ? data.skippedPages.length : 0,
      truncated: data.truncated === true,
    };
  } catch {
    // An abort is OUR timer rather than the user, and `DOMException`'s message
    // is English. There is no detail channel on this result for exactly that
    // reason — see `DiscoverRunResult`.
    return { ok: false, reason: "failed" };
  }
}
