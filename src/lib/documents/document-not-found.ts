/**
 * „That document does not exist" — the refusal, as an error the route can
 * recognise without string-matching.                            (Slice #34.26)
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   `associatePersonsToDocument` asks the role door first, and the door's
 *   offered set is `listPersonRolesForDocument(documentId)` — which returns
 *   `[]` for a document that does not exist. An empty offered set refuses every
 *   non-null role, correctly, so a POST naming a document that is gone came
 *   back `ROLE_NOT_OFFERED` and the screen told the user, in Romanian, that
 *   their ROLE was withdrawn. #34.15's own handover recorded it the day the
 *   door went in: „a POST naming a non-existent document now reads as a bad
 *   role rather than a bad document".
 *
 * ⚠️ **A NAMED CLASS RATHER THAN A `code` ON A PLAIN ERROR**, for the reason
 * `RoleNotOfferedError` is one: the five association routes funnel every throw
 * into `unexpectedError`, which answers 500. `instanceof` is what lets
 * `documentNotFoundToResponse` pick this one out while every other throw keeps
 * the 500 it had.
 *
 * ⚠️ **ITS OWN MODULE, AND THE MODULE IS PURE.** `lib/api/errors.ts` maps it to
 * a Response and must not acquire a `@/db` import to do so — the same split
 * that keeps `role-attachment.ts` (the rule) apart from `role-offers.ts` (the
 * query), and the same reason `errors.ts` already imports its other domain
 * error from a pure file rather than from a query module.
 */
export class DocumentNotFoundError extends Error {
  readonly documentId: string;

  constructor(documentId: string) {
    super(`Document ${documentId} does not exist`);
    this.name = "DocumentNotFoundError";
    this.documentId = documentId;
  }
}
