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
 *   Four of those five are gone: #29.13 folded the relationship-role lists into
 *   the generic modal and Slice #34.04 folded the two person-role whitelists
 *   into booleans on `lookup_person_role` (see ./config.ts). „Persoană →
 *   Document" and the generic modal read this file. One
 *   sentence, translated once, is also the reason this is not five key sets:
 *   each panel keeps its own scoped namespace for its own words and takes a
 *   SECOND `useTranslations("valueList.confirm.errors")` hook for these.
 */

import {
  ID_CARD_FORM_CODE,
  ID_CARD_RENAME_CODE,
} from "@/lib/documents/id-card-form-guard";
import {
  CATCH_ALL_FORM_CODE,
  CATCH_ALL_RENAME_CODE,
} from "@/lib/documents/catch-all-form-guard";
import {
  DOCUMENT_TYPE_KEY_INVALID_CODE,
  DOCUMENT_TYPE_KEY_RESERVED_CODE,
  DOCUMENT_TYPE_KEY_TAKEN_CODE,
  DOCUMENT_TYPE_NAME_TAKEN_CODE,
} from "@/lib/documents/document-type-name-guard";

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
  // Slice #34.03: `ambiguousValue` was here. It was the refusal a `tarla` row
  // with a same-named twin produced, and it existed only because a property
  // held the CODE as text; migration_078 made it a foreign key, so the
  // question it answered ("which of these two rows do these properties belong
  // to") always has an answer. Nothing raises it, so the member goes rather
  // than sitting in a union that this file's own docblock says must be
  // reachable in both locales.
  "duplicate",
  "notFound",
  "validation",
  // Slice #32.07 — the two halves of the identity-card refusal. They are the
  // first members that arrive on a **400**, which is why `throwRequestFailed`
  // below had to start reading the body's `code` before it decided that a 400
  // is the form's own rejection.
  //
  // ⚠️ **`idCardForm` IS UNREACHABLE FROM THESE FOUR SCREENS TODAY, and it is
  // kept anyway.** A round traced it: Reference Data's document-type form is
  // `LIST_META["document-types"].fields = [{ key: "name" }]` — since Slice #34.09 `[{ key: "name" }, { key: "key", createOnly: true }]`, and `createOnly` means `startEdit` does not seed it, so the EDIT form still sends `{ name }` and the sentence below is unchanged — so every write
  // that reaches this module carries a `name` and no `templateFields` — and on
  // such a write `idCardFormRefusal` answers `rename` or nothing at all,
  // because its `writesTheForm` term is false. `idCardForm` is what a DIRECT
  // caller of the two value-lists doors gets, and a member of this array with
  // no message renders as a raw key path, which is the failure this module
  // exists to stop. So the sentence is written, and `idCardRename`'s — the live
  // one — is the one that names the screen the remedy lives on.
  "idCardForm",
  "idCardRename",
  // Slice #32.19, finding S-02 — the two halves of the catch-all refusal, on
  // the same two doors and with the same 400 as the pair above.
  //
  // ⚠️ **`catchAllForm` IS UNREACHABLE THROUGH THIS FUNCTION, exactly like
  // `idCardForm`, and an adversarial round corrected the claim that stood here.**
  // The first version said the form editor reaches it, "so a user adding a field
  // on the NECLASIFICAT row gets `catchAllForm`". The editor never reaches this
  // module: `document-type-form-editor.tsx` reads `body.code` off its own
  // response and throws its own Romanian sentence, and never builds a
  // `RequestFailedError`. What reaches `failureFromResponse` on this list is the
  // MODAL's row form and its delete — and `LIST_META["document-types"].fields`
  // is `[{ key: "name" }]` (since Slice #34.09 `[{ key: "name" }, { key: "key", createOnly: true }]`, and `createOnly` means `startEdit` does not seed it, so the EDIT form still sends `{ name }` and the sentence below is unchanged), so every such write carries no `templateFields` and
  // can only produce `catchAllRename` or nothing at all.
  //
  // So both are written for the reason `idCardForm` was: a member of this array
  // with no message renders as a raw key path, which is the failure this module
  // exists to stop. Saying which one is live matters because the next reader
  // builds on it — this repo's own rule about a claim nobody can trigger.
  "catchAllForm",
  "catchAllRename",
  // Slice #34.09 — the two things a person can now type into the document-type
  // ADD form that the archive may already hold.
  //
  // ⚠️ **BOTH ARE LIVE, WHICH MAKES THEM THE FIRST PAIR HERE THAT IS.** The
  // four members above are written-but-unreachable-through-this-function by
  // construction, and each says so at length. These two are the opposite: a
  // duplicate NAME is what a stale client list produces every time
  // (`createValue`'s own comment described the hole and #34.09 closed it), and
  // a duplicate KEY is reachable the moment the key field exists, because the
  // form offers no list of the keys already taken.
  //
  // ⚠️ **`duplicate` was NOT reused, and the difference matters on screen.**
  // That member's Romanian is „Această înregistrare există deja în listă" — a
  // sentence about the ROW, written for the „Persoană → Document" panel's
  // 409, where the row IS the pair and there is nothing else to say. Here the
  // row is fine and exactly one FIELD is wrong, and which one it is decides
  // what the user does next: change the name, or change the key. One sentence
  // covering both would send half the people who see it to the wrong field.
  "documentTypeNameTaken",
  "documentTypeKeyTaken",
  // The other two things the key field can be told, added in the same slice
  // after an adversarial round found the second of them.
  //
  // ⚠️ **`documentTypeKeyReserved` IS A HOLE #34.09 OPENED AND CLOSED IN ONE
  // SLICE.** Before the key field existed a type's key was always the slug of
  // its name, so a row could only be keyed `NECLASIFICAT` by being NAMED
  // something that slugs to it — and both halves are recognised by the same
  // guards. A typed key severs that, and a row keyed `NECLASIFICAT` but named
  // „Contract de Vânzare" is one every carve-out in the codebase disagrees
  // with itself about. See `documentTypeKeyRefusal`.
  "documentTypeKeyInvalid",
  "documentTypeKeyReserved",
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
 * this function is ever reached. What is left is the „Persoană → Document"
 * panel's "this row already exists", which carries `code: "DUPLICATE"` so it is
 * recognised by a code rather than by a status a different door also uses.
 * (Three panels until Slice #34.04; the other two whitelists are booleans on
 * `lookup_person_role` now, and a checkbox has no duplicate to refuse.)
 */
export function failureFromResponse(status: number, body: unknown): FailureCode {
  if (status === 404) return "notFound";
  const code = (body as { code?: string } | null)?.code;
  if (code === "SAME_VALUE") return "sameValue";
  if (code === "DUPLICATE") return "duplicate";
  // ⚠️ **Slice #32.07 — snake_case, and the constants rather than literals.**
  // The same refusal reaches `PUT /api/document-types/[id]/template-fields`,
  // whose own codes are `template_changed` and `too_many_fields`, so one of the
  // two conventions had to give; spelling one refusal two ways on two wires is
  // what this slice exists to stop. See `id-card-form-guard.ts`.
  if (code === ID_CARD_FORM_CODE) return "idCardForm";
  if (code === ID_CARD_RENAME_CODE) return "idCardRename";
  // Slice #32.19 — same wire convention, same reason. See above.
  if (code === CATCH_ALL_FORM_CODE) return "catchAllForm";
  if (code === CATCH_ALL_RENAME_CODE) return "catchAllRename";
  // Slice #34.09 — same wire convention again. These two arrive on a 400 from
  // both value-lists write doors, so they are read here BEFORE the
  // `formRejects400` branch below turns an unrecognised 400 into "a required
  // field is missing or wrong" — which for a name the archive already holds
  // would send an administrator to check a field that is filled in correctly.
  // That is #32.07's lesson, and it is why the code is read first.
  if (code === DOCUMENT_TYPE_NAME_TAKEN_CODE) return "documentTypeNameTaken";
  if (code === DOCUMENT_TYPE_KEY_TAKEN_CODE) return "documentTypeKeyTaken";
  if (code === DOCUMENT_TYPE_KEY_INVALID_CODE) return "documentTypeKeyInvalid";
  if (code === DOCUMENT_TYPE_KEY_RESERVED_CODE) return "documentTypeKeyReserved";
  return "generic";
}

/**
 * Throw the right `RequestFailedError` for a response that is not ok.
 *
 * `formRejects400` is for the doors where a 400 means the form: the „Persoană
 * → Document" panel's POST and the value-lists PUT/POST all answer 400 for a
 * body their zod schema refused, and "Validation failed" plus a zod path is
 * not something to show anybody. A DELETE passes `false` and a 400 there falls
 * through to the generic sentence.
 */
export async function throwRequestFailed(
  res: Response,
  formRejects400 = false,
): Promise<never> {
  const body: unknown = await res.json().catch(() => null);
  const mapped = failureFromResponse(res.status, body);
  // ⚠️ **THE BODY'S CODE IS READ FIRST, AND ONLY AN UNRECOGNISED 400 IS THE
  // FORM'S OWN REJECTION.**                                    (Slice #32.07)
  // Until this slice every 400 on a form door became "a required field is
  // missing or wrong" before the body was ever looked at — correct while the
  // only 400 these doors could answer was a zod failure, and wrong the moment
  // one of them started refusing a write for a reason no field on the form
  // controls. Sending an administrator to fix a perfectly correct field is the
  // failure #29.06 argued a 400 must never produce, one door over.
  //
  // ⚠️ **Behaviour-preserving for every code that existed before it**: none of
  // `SAME_VALUE`, `AMBIGUOUS_VALUE` or `DUPLICATE` is ever answered with a 400
  // (the first two are the reassign route's 409, the third the „Persoană →
  // Document" panel's), so `mapped` was `generic` for every 400 this function saw and the
  // branch below fired exactly as it used to.
  if (formRejects400 && (res.status === 400 || res.status === 422) && mapped === "generic") {
    throw new RequestFailedError("validation");
  }
  throw new RequestFailedError(mapped);
}
