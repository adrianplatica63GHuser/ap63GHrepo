/**
 * safeMutate — shared fetch wrapper for all mutating API calls.
 *
 * Handles the three failure modes that bare `fetch` misses:
 *
 *  1. **Expired session redirect** — the auth middleware redirects a PATCH/POST
 *     to /sign-in; fetch follows it silently and returns a 200 (the sign-in
 *     HTML), making the save *appear* successful while the change is lost.
 *     `res.redirected` catches this and throws a user-visible i18n error.
 *
 *  2. **A foreign key the form could not check** — the row an id names is gone,
 *     so the write is refused with `code: FOREIGN_KEY_VIOLATION` and an English
 *     `error` written for a hand-made request. Translated here rather than
 *     shown. See the branch below for the two windows it comes from.
 *
 *  3. **Non-OK HTTP status** — reads the JSON error body if available and
 *     throws a descriptive error string.
 *
 * On success the raw `Response` is returned so callers can read the body
 * (e.g. to get a newly-created entity's id).
 *
 * `t` is the caller's own next-intl translator — the keys `saveErrorSession`,
 * `saveErrorForeignKey` and `saveError` must exist in that namespace (all four
 * form namespaces already have them).
 */
export async function safeMutate(
  url: string,
  options: RequestInit,
  t: (key: string) => string,
): Promise<Response> {
  const res = await fetch(url, options);

  // An expired session is redirected to /sign-in by the auth middleware;
  // fetch follows that as a 200 (the sign-in HTML), which would otherwise
  // look like a successful save and silently lose the change.
  if (res.redirected) {
    throw new Error(t("saveErrorSession"));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // ⚠️ **THE ONE ANSWER THESE FORMS CAN GET IN ENGLISH.**       (Slice #34.28)
    // `dbErrorToResponse` writes „Foreign key violation" for a 23503, and the
    // line below would print it verbatim on a screen whose every other sentence
    // is Romanian. #34.17 MEASURED the two windows that produce it rather than
    // reasoning about them: a value list whose fetch keeps FAILING leaves every
    // snapshot id `pending`, and a row deleted inside the five-minute
    // `staleTime` still reads `resolved` — in both, „Make current" is offered,
    // the PATCH goes, and this is the answer.
    //
    // ⚠️ **TRANSLATED, NOT REFUSED EARLIER, AND THAT IS #34.17's OWN
    // RECOMMENDATION:** „refusing on `pending` would take every restore away on
    // evidence nobody has read." The refusal `property-form.tsx` already draws
    // is a decision taken on a list that WAS read; these two windows are states
    // where it was not, or was read too long ago. Different evidence, different
    // answer.
    //
    // ⚠️ **MATCHED ON `code`, NEVER ON THE PROSE** — `associationFailureMessage`
    // and `pgErrorConstraint` both make the point at length: matching a message
    // is how you recognise something you did not mean.
    //
    // ⚠️ **BEFORE the `body?.error` line, not after.** That line is a `??` on a
    // value that is always present here, so a branch placed after it is dead.
    //
    // ⚠️ **THE LITERAL IS WRITTEN OUT RATHER THAN IMPORTED**, for the reason
    // `errors.ts` gives beside the other end of it: an `export const` there
    // would drag that module — and the two error classes it constructs — into
    // the client bundle of every form, to carry one string. It is the shape
    // `ROLE_NOT_OFFERED` and `DOCUMENT_NOT_FOUND` already ship, and
    // `src/__tests__/foreign-key-refusal.test.ts` is what keeps the two
    // spellings from drifting.
    if ((body as { code?: unknown } | null)?.code === "FOREIGN_KEY_VIOLATION") {
      throw new Error(t("saveErrorForeignKey"));
    }
    throw new Error(body?.error ?? `${t("saveError")} (HTTP ${res.status})`);
  }

  return res;
}
