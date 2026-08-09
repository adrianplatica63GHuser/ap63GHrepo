/**
 * property_corner_source — the link between a coordinate document and the
 * Property its corners built.  (Slice #23.06.Import, migration_068)
 *
 * WHY THIS EXISTS
 *
 * Before this slice, "has this document already been turned into a Property?"
 * was answered by reading `entity_metadata.provenance` and testing it against
 * the string "COORDINATE_FILE" — a display value doing duty as a concurrency
 * lock. It failed exactly where it mattered:
 *
 *   classifyFileSource() maps a file by EXTENSION only and deliberately never
 *   returns COORDINATE_FILE, because a `.txt` is indistinguishable from any
 *   other text file by name alone. "txt" is in DOCUMENT_EXTENSIONS, so the
 *   import wizard stamped DOC_FILE on the coordinate document it had just
 *   parsed. DOC_FILE is not COORDINATE_FILE, so the Process panel rendered
 *   ready — and processing an already-processed document created a SECOND
 *   Property with identical coordinates.
 *
 * The rule behind classifyFileSource is right in general; the wizard simply
 * isn't guessing. PropertyStepDialog — and CoordinatePropertyDialog, until
 * #26.10 deleted it — run the file through POST /api/properties/parse-text and
 * count real corners. They have proof. This table is where that proof now
 * goes.
 *
 * THE UNIQUE INDEX IS THE LOCK
 *
 * `UNIQUE (document_id)` plus `INSERT … ON CONFLICT (document_id) DO NOTHING
 * … RETURNING id` is the whole concurrency story. Zero rows back means another
 * path already claimed this document → 409. There is no window between a check
 * and a claim for a second request to slip through, because there is no
 * separate check: the insert IS the check. No SELECT … FOR UPDATE, no advisory
 * lock, no provenance overloading.
 *
 * Provenance is still stamped wherever the code has parsed proof — it is
 * honest metadata now, and nothing reads it as a lock.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { property, propertyCornerSource } from "@/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CornerSourceLink = {
  /** The Property this document's coordinate file produced. */
  propertyId: string;
  /** Its human-readable code, e.g. "PROP00042" — for display. */
  propertyCode: string;
  /** Property nickname, or null. */
  propertyNickname: string | null;
  createdAt: Date;
  createdBy: string | null;
};

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

/**
 * Record that `documentId`'s coordinate file produced `propertyId`.
 *
 * Returns TRUE when this call won the claim, FALSE when the document was
 * already claimed (by a concurrent request, an earlier import, or the other
 * creation path). A false return is a 409, never a retry: the whole point is
 * that a coordinate file becomes exactly one Property.
 *
 * The insert is the lock. Do not add a read-then-write guard around it —
 * that reintroduces the check/claim race this table exists to remove. A cheap
 * read BEFORE doing expensive work (see the Process route) is fine as an
 * optimisation, as long as the claim itself stays authoritative.
 */
export async function claimCornerSource(
  documentId: string,
  propertyId: string,
  createdBy: string | null,
): Promise<boolean> {
  const rows = await db
    .insert(propertyCornerSource)
    .values({ documentId, propertyId, createdBy })
    .onConflictDoNothing({ target: propertyCornerSource.documentId })
    .returning({ id: propertyCornerSource.id });

  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * The Property this document's coordinate file produced, or null if it has not
 * been used as a corner source.
 *
 * Deliberately does NOT filter out soft-deleted Properties. The row's
 * existence is the single source of truth for "is this document claimed?", and
 * `softDeleteProperty` releases the row as part of deleting (see
 * releaseCornerSourceForProperty below), so the two can never disagree in
 * normal operation. If some future delete path forgets to release, the visible
 * symptom is a Process panel linking to a deleted Property — obvious and
 * diagnosable — rather than a silent duplicate Property, which is the failure
 * this whole slice exists to prevent. Fail in the loud direction.
 */
export async function getCornerSourceForDocument(
  documentId: string,
): Promise<CornerSourceLink | null> {
  const rows = await db
    .select({
      propertyId:       propertyCornerSource.propertyId,
      propertyCode:     property.code,
      propertyNickname: property.nickname,
      createdAt:        propertyCornerSource.createdAt,
      createdBy:        propertyCornerSource.createdBy,
    })
    .from(propertyCornerSource)
    .innerJoin(property, eq(propertyCornerSource.propertyId, property.id))
    .where(eq(propertyCornerSource.documentId, documentId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * True when this document has already produced a Property. Thin wrapper over
 * the read above, for callers that only need the yes/no.
 */
export async function isCornerSourceClaimed(documentId: string): Promise<boolean> {
  return (await getCornerSourceForDocument(documentId)) !== null;
}

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

/**
 * Hard-delete every link row pointing at `propertyId`, freeing its source
 * document(s) for a correct re-run.
 *
 * WHY A HARD DELETE, AND WHY HERE
 *
 * Properties SOFT-delete — `softDeleteProperty` sets `deleted_at` and the row
 * stays — so the table's `ON DELETE CASCADE` never fires on the normal delete
 * path. Without this call a link would survive its Property forever and block
 * its source document permanently: the Process panel would point at a deleted
 * Property and refuse to run again, with no way back short of SQL.
 *
 * This is the same shape as the CNP-uniqueness problem recorded in CLAUDE.md
 * (a partial unique index cannot see the PARENT row's `deleted_at`, so it keeps
 * enforcing uniqueness against logically-deleted data). That one is solved with
 * a trigger. This one is solved by cleaning up on delete instead, deliberately:
 *
 *   - The link carries no history worth preserving. It answers exactly one
 *     question — "is this document already spent?" — and once its Property is
 *     gone the honest answer is "no". There is nothing to keep.
 *   - A trigger would have to live in SQL, invisible to the query layer and to
 *     anyone reading corner-source.ts, and CLAUDE.md already records how
 *     expensive invisible database behaviour is to rediscover.
 *   - The cleanup has exactly one caller. A trigger's whole advantage is
 *     catching callers you forgot about; with one delete path that advantage
 *     is zero, and the cost — a second, hidden source of truth — is not.
 *
 * If a second soft-delete path for Properties ever appears, it must call this
 * too. That is the one thing the trigger would have bought us; note it here
 * rather than paying for it up front.
 *
 * Returns the number of links released (normally 0 or 1).
 */
export async function releaseCornerSourceForProperty(
  propertyId: string,
): Promise<number> {
  const rows = await db
    .delete(propertyCornerSource)
    .where(eq(propertyCornerSource.propertyId, propertyId))
    .returning({ id: propertyCornerSource.id });

  return rows.length;
}

/**
 * Release the link for one specific (document, property) pair.
 *
 * Used by the Process route's compensating action: if the Property was created
 * and claimed but a LATER step failed, the Property is deleted and its claim
 * must go with it, or the document stays locked to a Property that no longer
 * exists. Scoped to the pair rather than to the property alone so a
 * compensating rollback can never release a claim it did not make.
 */
export async function releaseCornerSourceLink(
  documentId: string,
  propertyId: string,
): Promise<boolean> {
  const rows = await db
    .delete(propertyCornerSource)
    .where(
      and(
        eq(propertyCornerSource.documentId, documentId),
        eq(propertyCornerSource.propertyId, propertyId),
      ),
    )
    .returning({ id: propertyCornerSource.id });

  return rows.length > 0;
}
