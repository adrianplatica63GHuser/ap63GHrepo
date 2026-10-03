/**
 * The error `assertShareMayBeStored` throws (Slice #37.59) — in a module of its
 * own, with no database import, so `src/lib/api/errors.ts` can recognise it
 * without pulling the query layer in.
 */
export class ShareNotHeldError extends Error {
  readonly documentIds: readonly string[];
  readonly personRoleId: string;

  constructor(documentIds: readonly string[], personRoleId: string) {
    super(`Role ${personRoleId} holds no share on the type of ${documentIds.join(", ")}`);
    this.name = "ShareNotHeldError";
    this.documentIds = documentIds;
    this.personRoleId = personRoleId;
  }
}
