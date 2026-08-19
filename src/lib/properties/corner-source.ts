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
 * The row's existence is the single source of truth for "is this document
 * claimed?", and since Slice #29.04 nothing can make it disagree: deleting a
 * Property deletes it, and this table's ON DELETE CASCADE takes the link with
 * it. The INNER JOIN below is what turns that into an answer — a link whose
 * Property is gone cannot be returned, because the Property row it joins to
 * does not exist.
 *
 * That used to need help. While Properties soft-deleted, the cascade never
 * fired on the normal delete path, so `softDeleteProperty` deleted the link
 * itself via a `releaseCornerSourceForProperty` helper — a second source of
 * truth that any new delete path had to remember to call, and that the batch
 * delete route did in fact forget. The helper is gone; the constraint does
 * the work, in the one place a future caller cannot skip.
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

/*
 * REMOVED IN SLICE #29.04: releaseCornerSourceForProperty(propertyId).
 *
 * It hard-deleted every link row pointing at a Property, and it existed for
 * exactly one reason: Properties soft-deleted, so `property_corner_source`'s
 * ON DELETE CASCADE never fired on the normal delete path and a link would
 * outlive its Property and lock its source document forever.
 *
 * Properties are now deleted for real, so the cascade fires and does the same
 * job from inside the database. Keeping the call as well would have left two
 * places that free a claim and one of them optional — and the old comment
 * here said as much: "If a second soft-delete path for Properties ever
 * appears, it must call this too." One had already appeared and did not
 * (POST /api/properties/batch-delete wrote `deleted_at` inline), which is the
 * argument for the constraint rather than the helper.
 *
 * `releaseCornerSourceLink` below is NOT the same thing and stays: it is the
 * Process route's compensating rollback for a pair it created itself, on a
 * path where no Property is being deleted at all.
 */

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
