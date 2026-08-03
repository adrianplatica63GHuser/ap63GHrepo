/**
 * Client-side helpers for the coordinate-document → Property link.
 * (Slice #23.06.Import)
 *
 * Two import surfaces claim the link — the bulk import loop, for the
 * coordinate file that supplied the run's Property at the property step, and
 * CoordinatePropertyDialog, for the "Aplică pe proprietate" row action. This
 * module is the one place either of them talks to
 * /api/documents/[id]/corner-source.
 *
 * It exists as a shared module rather than a copy in each caller for the
 * reason CLAUDE.md records about UAT_NO_AUTH: when a rule gets pasted into a
 * third place, the fourth site is the one that gets missed. This rule — "a
 * coordinate file becomes exactly one Property" — is the entire slice.
 *
 * THE IDEMPOTENCY RULE
 *
 * A claim that loses to a link ALREADY POINTING AT THE SAME PROPERTY is not a
 * conflict, it is a no-op. That distinction is what makes the whole flow
 * retry-safe: the caller claims first and writes corners second, so if the
 * corner write fails the user can simply try again — the second attempt finds
 * its own claim, recognises it, and carries on. Without it, one failed PATCH
 * would spend the document permanently and the only way back would be to
 * soft-delete the Property.
 *
 * A claim that loses to a link pointing at a DIFFERENT Property is a real
 * conflict and must stop the caller. That is the duplicate this slice exists
 * to prevent.
 *
 * Pure fetch wrappers — no React, safe to import from any client component.
 */

/** What GET/POST return about an existing link. */
export type CornerSourceLink = {
  propertyId:       string;
  propertyCode:     string;
  propertyNickname: string | null;
};

export type ClaimResult =
  /** This call created the link. */
  | { kind: "claimed" }
  /** A link already existed and it points at the property we asked for. */
  | { kind: "already-ours" }
  /** A link already exists for a DIFFERENT property — caller must not write. */
  | { kind: "conflict"; link: CornerSourceLink | null };

/**
 * The expired-Supabase-session tell (CLAUDE.md): the middleware redirects the
 * request to /sign-in and fetch follows it, so the response is a cheerful 200
 * full of sign-in HTML. Without this check a claim reports success on a write
 * that never happened — and the caller then writes corners believing it holds
 * a lock it does not hold.
 */
function assertNotRedirected(res: Response, sessionMsg: string): void {
  if (res.redirected) throw new Error(sessionMsg);
}

/**
 * Which Property this document's coordinate file already produced, or null.
 * Read-only; safe to call before asking the user anything.
 */
export async function fetchCornerSource(
  documentId: string,
): Promise<CornerSourceLink | null> {
  const res = await fetch(
    `/api/documents/${encodeURIComponent(documentId)}/corner-source`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { link?: CornerSourceLink | null };
  return body.link ?? null;
}

/**
 * Claim `documentId` as the corner source of `propertyId`.
 *
 * Call this BEFORE writing corners, never after: the claim is the permission
 * to write, so writing first and asking second would let a file that belongs
 * to another Property replace this one's geometry before anyone noticed.
 *
 * Throws only on transport/session failure. A conflict is a RESULT, not an
 * exception — callers have to render it, and an exception would flatten
 * "someone else owns this file" into the same channel as "the network died".
 */
export async function claimCornerSource(
  documentId: string,
  propertyId: string,
  sessionErrorMessage: string,
): Promise<ClaimResult> {
  const res = await fetch(
    `/api/documents/${encodeURIComponent(documentId)}/corner-source`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ propertyId }),
    },
  );
  assertNotRedirected(res, sessionErrorMessage);

  if (res.status === 201) return { kind: "claimed" };

  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as { link?: CornerSourceLink | null };
    const link = body.link ?? null;
    // The idempotency rule — see the module header.
    if (link && link.propertyId === propertyId) return { kind: "already-ours" };
    return { kind: "conflict", link };
  }

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error ?? `HTTP ${res.status}`);
}
