/**
 * A failure a Reference Data screen can say in Romanian.        (Slice #29.13)
 *
 * ⚠️ **THE SERVER'S `error` STRING IS NEVER RENDERED, AND THAT IS THE WHOLE
 * POINT OF THIS MODULE.** Those strings are English by construction — "Delete
 * failed (404)", "Validation failed", "Invalid input", "Failed to create",
 * "Internal server error" — and every screen that reaches them is one a
 * Romanian user is looking at. So the transport carries a CODE and the
 * sentence is chosen on the client from `valueList.confirm.errors.*`. Anything
 * unrecognised becomes the generic Romanian sentence rather than leaking.
 *
 * WHY IT IS A MODULE RATHER THAN THREE MORE COPIES
 *   #29.05 wrote this pattern inside `value-list-modal.tsx` and it fixed that
 *   one screen. The five panels beside it went on rendering `err.message`
 *   straight from the server on every save, and their delete mutations had no
 *   `onError` AT ALL — the exact state value-list-modal's own comment
 *   describes as fixed, one modal over: a refused delete left the confirmation
 *   dialog open with its button re-enabled and nothing said anywhere.
 *
 *   Two of those five are gone (#29.13 folded the relationship-role lists into
 *   the generic modal — see ./config.ts). The other three read this file. One
 *   sentence, translated once, is also the reason this is not five key sets:
 *   each panel keeps its own scoped namespace for its own words and takes a
 *   SECOND `useTranslations("valueList.confirm.errors")` hook for these.
 */

/**
 * Everything a Reference Data screen knows how to say about a failure.
 *
 * ⚠️ **An ARRAY with the type derived from it, not a hand-written union.**
 * Every member has to exist under `valueList.confirm.errors` in BOTH locales —
 * a member without a key renders as the raw key path on a Romanian-only
 * screen, which is the exact failure this module exists to stop. Exported so
 * value-list-dependents.test.ts iterates the real list instead of a second
 * hand-written copy that a seventh member would not appear in.
 */
export const FAILURE_CODES = [
  "sameValue",
  "ambiguousValue",
  "duplicate",
  "notFound",
  "validation",
  "generic",
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

export class RequestFailedError extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
    this.name = "RequestFailedError";
  }
}

/**
 * Which sentence a failed response earns.
 *
 * ⚠️ **A 400 is NOT read here**, and the omission is deliberate: on a save it
 * is the form's own rejection ("a required field is missing or wrong") and on
 * a DELETE or a move it is not a form at all. The two callers that can receive
 * a form rejection map it themselves, at the point where they know which door
 * they knocked on.
 *
 * ⚠️ **409 is TWO different answers and only one of them lands here.** The
 * value-lists DELETE answers 409 with an `IN_USE` body, which its caller
 * recognises with `isInUseBody` and turns into the whole refusal dialog before
 * this function is ever reached. What is left is the three whitelist panels'
 * "this row already exists", which now carries `code: "DUPLICATE"` so it is
 * recognised by a code rather than by a status a different door also uses.
 */
export function failureFromResponse(status: number, body: unknown): FailureCode {
  if (status === 404) return "notFound";
  const code = (body as { code?: string } | null)?.code;
  if (code === "SAME_VALUE") return "sameValue";
  if (code === "AMBIGUOUS_VALUE") return "ambiguousValue";
  if (code === "DUPLICATE") return "duplicate";
  return "generic";
}

/**
 * Throw the right `RequestFailedError` for a response that is not ok.
 *
 * `formRejects400` is for the doors where a 400 means the form: the three
 * whitelist panels' POSTs and the value-lists PUT/POST all answer 400 for a
 * body their zod schema refused, and "Validation failed" plus a zod path is
 * not something to show anybody. A DELETE passes `false` and a 400 there falls
 * through to the generic sentence.
 */
export async function throwRequestFailed(
  res: Response,
  formRejects400 = false,
): Promise<never> {
  const body: unknown = await res.json().catch(() => null);
  if (formRejects400 && (res.status === 400 || res.status === 422)) {
    throw new RequestFailedError("validation");
  }
  throw new RequestFailedError(failureFromResponse(res.status, body));
}
