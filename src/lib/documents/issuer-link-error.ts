/**
 * The error a dissociation throws on the link a document's issuer made.                             (Slice 41.53)
 *
 * In a module of its own, with no database import, so `src/lib/api/errors.ts` can recognise it without pulling the
 * query layer in (as `share-not-held-error.ts`). The office is changed on „Identificarea actului", never in
 * „Legături", so the two never disagree.
 */
export class IssuerLinkDissociationError extends Error {
  readonly linkId: string;

  constructor(linkId: string) {
    super(`Link ${linkId} is the document's issuer: it is changed on the document's identification tile`);
    this.name = "IssuerLinkDissociationError";
    this.linkId = linkId;
  }
}

export const ISSUER_LINK_CODE = "ISSUER_LINK";
