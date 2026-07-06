/**
 * DB query helpers for entity metadata  (Slice #19.10 / #19.11)
 *
 * entity_metadata stores per-entity subjective tags (importance, relevance,
 * provenance) keyed by principal_object_id. One optional row per entity;
 * absent rows are returned as all-null defaults.
 *
 * Per-field timestamps (importanceUpdatedAt etc.) are set whenever that
 * specific field is saved, letting the UI show "last changed N days ago"
 * and flag values older than 90 days as potentially stale.
 *
 * Provenance history: stored in entity_provenance_log (one row per change,
 * recording the method value that was active BEFORE the change).
 *
 * Version history: every patchEntityMetadata / restoreEntityMetadataSnapshot
 * call appends a full snapshot to entity_metadata_version (same pattern as
 * property_version / person_version / document_version). Deduplication: a new
 * version is NOT appended if the new snapshot equals the latest stored one.
 */

import { eq, desc, asc, sql, count } from "drizzle-orm";
import { db } from "@/db";
import {
  entityMetadata,
  entityProvenanceLog,
  entityMetadataVersion,
  entityTag,
} from "@/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProvenanceHistoryEntry = { method: string; date: string };

/** Snapshot stored in entity_metadata_version — all fields string | null. */
export type MetadataSnapshot = {
  importance: string | null;
  relevance:  string | null;
  provenance: string | null;
};

export type EntityMetadataRow = {
  importance:           string | null;
  relevance:            string | null;
  provenance:           string | null;
  /** Ordered oldest-first; sourced from entity_provenance_log. */
  provenanceHistory:    ProvenanceHistoryEntry[];
  /** ISO timestamp of the last time importance was explicitly saved. Null = never saved. */
  importanceUpdatedAt:  string | null;
  relevanceUpdatedAt:   string | null;
  provenanceUpdatedAt:  string | null;
};

export type MetadataVersionItem = {
  id:            string;
  versionNumber: number;
  snapshot:      MetadataSnapshot;
  createdAt:     string;
};

/** Which single field the caller wants to update in one save action. */
export type MetadataPatch =
  | { field: "importance"; value: string | null }
  | { field: "relevance";  value: string | null }
  | { field: "provenance"; value: string | null };

/** Shared null-filled default when no row exists yet. */
const EMPTY_ROW: EntityMetadataRow = {
  importance:          null,
  relevance:           null,
  provenance:          null,
  provenanceHistory:   [],
  importanceUpdatedAt: null,
  relevanceUpdatedAt:  null,
  provenanceUpdatedAt: null,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function snapshotsEqual(a: MetadataSnapshot, b: MetadataSnapshot): boolean {
  return (
    a.importance === b.importance &&
    a.relevance  === b.relevance  &&
    a.provenance === b.provenance
  );
}

async function getLatestVersion(
  entityMetadataId: string,
): Promise<{ versionNumber: number; snapshot: MetadataSnapshot } | null> {
  const rows = await db
    .select()
    .from(entityMetadataVersion)
    .where(eq(entityMetadataVersion.entityMetadataId, entityMetadataId))
    .orderBy(desc(entityMetadataVersion.versionNumber))
    .limit(1);
  if (!rows[0]) return null;
  return {
    versionNumber: rows[0].versionNumber,
    snapshot:      rows[0].snapshot as MetadataSnapshot,
  };
}

async function appendVersion(
  entityMetadataId: string,
  snapshot: MetadataSnapshot,
): Promise<void> {
  const latest = await getLatestVersion(entityMetadataId);
  // No-op deduplication: skip if the snapshot is identical to the latest stored one.
  if (latest && snapshotsEqual(snapshot, latest.snapshot)) return;
  const nextNumber = latest ? latest.versionNumber + 1 : 0;
  await db.insert(entityMetadataVersion).values({
    entityMetadataId,
    versionNumber: nextNumber,
    snapshot,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getEntityMetadata(
  principalObjectId: string,
): Promise<EntityMetadataRow> {
  const metaRows = await db
    .select()
    .from(entityMetadata)
    .where(eq(entityMetadata.principalObjectId, principalObjectId))
    .limit(1);

  const row = metaRows[0];
  if (!row) return { ...EMPTY_ROW };

  // Fetch provenance history from the relational log table (oldest first).
  const logRows = await db
    .select()
    .from(entityProvenanceLog)
    .where(eq(entityProvenanceLog.entityMetadataId, row.id))
    .orderBy(entityProvenanceLog.loggedAt, entityProvenanceLog.createdAt);

  const provenanceHistory: ProvenanceHistoryEntry[] = logRows.map((l) => ({
    method: l.method,
    date:   l.loggedAt,
  }));

  return {
    importance:          row.importance,
    relevance:           row.relevance,
    provenance:          row.provenance,
    provenanceHistory,
    importanceUpdatedAt: row.importanceUpdatedAt?.toISOString() ?? null,
    relevanceUpdatedAt:  row.relevanceUpdatedAt?.toISOString()  ?? null,
    provenanceUpdatedAt: row.provenanceUpdatedAt?.toISOString() ?? null,
  };
}

export async function listMetadataVersions(
  principalObjectId: string,
): Promise<MetadataVersionItem[]> {
  const metaRows = await db
    .select({ id: entityMetadata.id })
    .from(entityMetadata)
    .where(eq(entityMetadata.principalObjectId, principalObjectId))
    .limit(1);

  if (!metaRows[0]) return [];

  const rows = await db
    .select()
    .from(entityMetadataVersion)
    .where(eq(entityMetadataVersion.entityMetadataId, metaRows[0].id))
    .orderBy(entityMetadataVersion.versionNumber);

  return rows.map((r) => ({
    id:            r.id,
    versionNumber: r.versionNumber,
    snapshot:      r.snapshot as MetadataSnapshot,
    createdAt:     r.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Write — single field patch
// ---------------------------------------------------------------------------

/**
 * Upsert one metadata field for the given principal_object_id.
 *
 * - Sets the matching field_updated_at to now().
 * - For provenance: if the new value differs from the stored current value,
 *   a row is inserted into entity_provenance_log recording the OLD value.
 * - After every upsert a new version snapshot is appended to
 *   entity_metadata_version (skipped if snapshot is identical to the latest).
 * - All other fields are preserved from the existing row (read-then-write).
 */
export async function patchEntityMetadata(
  principalObjectId: string,
  patch: MetadataPatch,
  updatedBy?: string | null,
): Promise<EntityMetadataRow> {
  const current = await getEntityMetadata(principalObjectId);
  const now     = new Date();

  // Compute merged values
  const newImportance = patch.field === "importance" ? patch.value : current.importance;
  const newRelevance  = patch.field === "relevance"  ? patch.value : current.relevance;
  const newProvenance = patch.field === "provenance" ? patch.value : current.provenance;

  // Per-field timestamps — only update the one being patched
  const newImportanceUpdatedAt =
    patch.field === "importance" ? now : (current.importanceUpdatedAt ? new Date(current.importanceUpdatedAt) : null);
  const newRelevanceUpdatedAt =
    patch.field === "relevance"  ? now : (current.relevanceUpdatedAt  ? new Date(current.relevanceUpdatedAt)  : null);
  const newProvenanceUpdatedAt =
    patch.field === "provenance" ? now : (current.provenanceUpdatedAt ? new Date(current.provenanceUpdatedAt) : null);

  // Upsert and retrieve the entity_metadata.id
  const upserted = await db
    .insert(entityMetadata)
    .values({
      principalObjectId,
      importance:          newImportance,
      relevance:           newRelevance,
      provenance:          newProvenance,
      importanceUpdatedAt: newImportanceUpdatedAt,
      relevanceUpdatedAt:  newRelevanceUpdatedAt,
      provenanceUpdatedAt: newProvenanceUpdatedAt,
    })
    .onConflictDoUpdate({
      target: entityMetadata.principalObjectId,
      set: {
        importance:          newImportance,
        relevance:           newRelevance,
        provenance:          newProvenance,
        importanceUpdatedAt: newImportanceUpdatedAt,
        relevanceUpdatedAt:  newRelevanceUpdatedAt,
        provenanceUpdatedAt: newProvenanceUpdatedAt,
        updatedBy:           updatedBy ?? null,
        updatedAt:           now,
      },
    })
    .returning({ id: entityMetadata.id });

  const metadataId = upserted[0].id;

  // If provenance changed, log the OLD value into entity_provenance_log
  if (
    patch.field === "provenance" &&
    current.provenance !== null &&
    current.provenance !== patch.value
  ) {
    await db.insert(entityProvenanceLog).values({
      entityMetadataId: metadataId,
      method:           current.provenance,
      loggedAt:         now.toISOString().slice(0, 10),
    });
  }

  // Append a version snapshot (skipped if identical to latest)
  const newSnapshot: MetadataSnapshot = {
    importance: newImportance,
    relevance:  newRelevance,
    provenance: newProvenance,
  };
  await appendVersion(metadataId, newSnapshot);

  // Return the full updated row (including refreshed provenance history)
  return getEntityMetadata(principalObjectId);
}

// ---------------------------------------------------------------------------
// Write — patch all three fields at once (used by unified "Save" button)
// ---------------------------------------------------------------------------

/**
 * Upsert all three metadata fields in one write.
 * Used by the unified Save button that saves importance + relevance + provenance together.
 * Sets all three field_updated_at timestamps to now().
 * Logs old provenance into entity_provenance_log if it changed.
 * Appends a version snapshot (deduplication inside appendVersion).
 */
export async function patchAllEntityMetadata(
  principalObjectId: string,
  patch: { importance: string | null; relevance: string | null; provenance: string | null },
  updatedBy?: string | null,
): Promise<EntityMetadataRow> {
  const current = await getEntityMetadata(principalObjectId);
  const now     = new Date();

  const upserted = await db
    .insert(entityMetadata)
    .values({
      principalObjectId,
      importance:          patch.importance,
      relevance:           patch.relevance,
      provenance:          patch.provenance,
      importanceUpdatedAt: now,
      relevanceUpdatedAt:  now,
      provenanceUpdatedAt: now,
    })
    .onConflictDoUpdate({
      target: entityMetadata.principalObjectId,
      set: {
        importance:          patch.importance,
        relevance:           patch.relevance,
        provenance:          patch.provenance,
        importanceUpdatedAt: now,
        relevanceUpdatedAt:  now,
        provenanceUpdatedAt: now,
        updatedBy:           updatedBy ?? null,
        updatedAt:           now,
      },
    })
    .returning({ id: entityMetadata.id });

  const metadataId = upserted[0].id;

  // Log old provenance if it changed
  if (
    current.provenance !== null &&
    current.provenance !== patch.provenance
  ) {
    await db.insert(entityProvenanceLog).values({
      entityMetadataId: metadataId,
      method:           current.provenance,
      loggedAt:         now.toISOString().slice(0, 10),
    });
  }

  // Append version snapshot
  await appendVersion(metadataId, {
    importance: patch.importance,
    relevance:  patch.relevance,
    provenance: patch.provenance,
  });

  return getEntityMetadata(principalObjectId);
}

// ---------------------------------------------------------------------------
// Write — restore full snapshot (used by "Make current" in the version nav)
// ---------------------------------------------------------------------------

/**
 * Restore all three metadata fields from a historical snapshot in one
 * atomic write.  Writes exactly one new version entry (no 3-field loop).
 * Also logs the provenance change if provenance differs.
 */
export async function restoreEntityMetadataSnapshot(
  principalObjectId: string,
  snapshot: MetadataSnapshot,
  updatedBy?: string | null,
): Promise<EntityMetadataRow> {
  const current = await getEntityMetadata(principalObjectId);
  const now     = new Date();

  const upserted = await db
    .insert(entityMetadata)
    .values({
      principalObjectId,
      importance:          snapshot.importance,
      relevance:           snapshot.relevance,
      provenance:          snapshot.provenance,
      importanceUpdatedAt: now,
      relevanceUpdatedAt:  now,
      provenanceUpdatedAt: now,
    })
    .onConflictDoUpdate({
      target: entityMetadata.principalObjectId,
      set: {
        importance:          snapshot.importance,
        relevance:           snapshot.relevance,
        provenance:          snapshot.provenance,
        importanceUpdatedAt: now,
        relevanceUpdatedAt:  now,
        provenanceUpdatedAt: now,
        updatedBy:           updatedBy ?? null,
        updatedAt:           now,
      },
    })
    .returning({ id: entityMetadata.id });

  const metadataId = upserted[0].id;

  // Log old provenance value if it changed
  if (
    current.provenance !== null &&
    current.provenance !== snapshot.provenance
  ) {
    await db.insert(entityProvenanceLog).values({
      entityMetadataId: metadataId,
      method:           current.provenance,
      loggedAt:         now.toISOString().slice(0, 10),
    });
  }

  // Append version (deduplication inside appendVersion)
  await appendVersion(metadataId, {
    importance: snapshot.importance,
    relevance:  snapshot.relevance,
    provenance: snapshot.provenance,
  });

  return getEntityMetadata(principalObjectId);
}

// ---------------------------------------------------------------------------
// Write — touch a single field (update *_updated_at without changing value)
// ---------------------------------------------------------------------------

/**
 * Update only the `<field>_updated_at` timestamp for the given entity, leaving
 * the field value unchanged.  Used by the "Mark as reviewed" button.
 * If no entity_metadata row exists yet, one is created with all null values.
 */
export async function touchEntityMetadataField(
  principalObjectId: string,
  field: "importance" | "relevance" | "provenance",
  updatedBy?: string | null,
): Promise<EntityMetadataRow> {
  const current = await getEntityMetadata(principalObjectId);
  const now     = new Date();

  const newImportanceUpdatedAt =
    field === "importance" ? now : (current.importanceUpdatedAt ? new Date(current.importanceUpdatedAt) : null);
  const newRelevanceUpdatedAt =
    field === "relevance"  ? now : (current.relevanceUpdatedAt  ? new Date(current.relevanceUpdatedAt)  : null);
  const newProvenanceUpdatedAt =
    field === "provenance" ? now : (current.provenanceUpdatedAt ? new Date(current.provenanceUpdatedAt) : null);

  await db
    .insert(entityMetadata)
    .values({
      principalObjectId,
      importance:          current.importance,
      relevance:           current.relevance,
      provenance:          current.provenance,
      importanceUpdatedAt: newImportanceUpdatedAt,
      relevanceUpdatedAt:  newRelevanceUpdatedAt,
      provenanceUpdatedAt: newProvenanceUpdatedAt,
    })
    .onConflictDoUpdate({
      target: entityMetadata.principalObjectId,
      set: {
        importanceUpdatedAt: newImportanceUpdatedAt,
        relevanceUpdatedAt:  newRelevanceUpdatedAt,
        provenanceUpdatedAt: newProvenanceUpdatedAt,
        updatedBy:           updatedBy ?? null,
        updatedAt:           now,
      },
    });

  return getEntityMetadata(principalObjectId);
}

// ---------------------------------------------------------------------------
// Tags — list, add, remove
// ---------------------------------------------------------------------------

/** All tags for an entity, oldest-first. */
export async function listEntityTags(principalObjectId: string): Promise<string[]> {
  const rows = await db
    .select({ tag: entityTag.tag })
    .from(entityTag)
    .where(eq(entityTag.principalObjectId, principalObjectId))
    .orderBy(asc(entityTag.createdAt));
  return rows.map((r) => r.tag);
}

/**
 * Add a tag to an entity.  Always normalises to lowercase + trim so the corpus
 * stays consistent.  Duplicates (case-insensitive) are silently ignored via the
 * DB unique index on (principal_object_id, lower(tag)).
 */
export async function addEntityTag(
  principalObjectId: string,
  tag: string,
): Promise<string[]> {
  const normalised = tag.trim().toLowerCase();
  if (!normalised) return listEntityTags(principalObjectId);

  await db
    .insert(entityTag)
    .values({ principalObjectId, tag: normalised })
    .onConflictDoNothing();

  return listEntityTags(principalObjectId);
}

/** Remove a tag from an entity (case-insensitive match). */
export async function removeEntityTag(
  principalObjectId: string,
  tag: string,
): Promise<string[]> {
  const lower = tag.toLowerCase();

  const fullRows = await db
    .select({ id: entityTag.id, tag: entityTag.tag })
    .from(entityTag)
    .where(eq(entityTag.principalObjectId, principalObjectId));

  const idsToDelete = fullRows
    .filter((r) => r.tag.toLowerCase() === lower)
    .map((r) => r.id);

  if (idsToDelete.length > 0) {
    await db.delete(entityTag).where(eq(entityTag.id, idsToDelete[0]));
  }

  return listEntityTags(principalObjectId);
}

// ---------------------------------------------------------------------------
// Tags — global management (tag cloud, rename, merge)
// ---------------------------------------------------------------------------

export type TagWithCount = { tag: string; count: number };

/**
 * Returns every distinct tag in the corpus with its usage count, sorted by
 * count DESC then tag ASC.  Used for the tag cloud and autocomplete list.
 */
export async function listAllTags(): Promise<TagWithCount[]> {
  const rows = await db
    .select({
      tag:   entityTag.tag,
      count: count(entityTag.id),
    })
    .from(entityTag)
    .groupBy(entityTag.tag)
    .orderBy(desc(count(entityTag.id)), asc(entityTag.tag));

  return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

/**
 * Renames a tag globally: every entity_tag row with tag = from (case-insensitive)
 * gets updated to the normalised (lowercase+trim) value of `to`.
 *
 * If `to` is empty or the same as `from` after normalisation, does nothing.
 * Rows that already have the target tag on the same entity are hard-deleted
 * (merge semantics — the existing target row wins, the renamed duplicate is
 * dropped via ON CONFLICT DO NOTHING pattern below).
 *
 * Returns the updated tag corpus.
 */
export async function renameTag(from: string, to: string): Promise<TagWithCount[]> {
  const normFrom = from.trim().toLowerCase();
  const normTo   = to.trim().toLowerCase();

  if (!normFrom || !normTo || normFrom === normTo) return listAllTags();

  // Update all rows matching `from`.  When a row would collide with an existing
  // `to` tag on the same entity, the unique index raises a conflict — we handle
  // this by deleting the conflicting row first and then updating, effectively
  // merging duplicates on the same entity.
  //
  // Step 1: delete any `to` rows on entities that ALSO have a `from` row
  //         (so the subsequent UPDATE has no collisions).
  await db.execute(sql`
    DELETE FROM entity_tag
    WHERE  tag = ${normTo}
      AND  principal_object_id IN (
        SELECT principal_object_id FROM entity_tag WHERE tag = ${normFrom}
      )
  `);

  // Step 2: rename all remaining `from` rows to `to`.
  await db.execute(sql`
    UPDATE entity_tag
    SET    tag = ${normTo}
    WHERE  tag = ${normFrom}
  `);

  return listAllTags();
}
