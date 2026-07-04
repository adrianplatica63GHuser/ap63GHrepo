/**
 * DB query helpers for entity metadata  (Slice #19.10.Metadata)
 *
 * entity_metadata stores per-entity subjective tags (importance, relevance,
 * provenance) keyed by principal_object_id. One optional row per entity;
 * absent rows are returned as all-null defaults.
 *
 * Per-field timestamps (importanceUpdatedAt etc.) are set whenever that
 * specific field is saved, letting the UI show "last changed N days ago"
 * and flag values older than 90 days as potentially stale.
 *
 * Provenance history: [{method, date}] JSONB array (oldest first).
 * When a new provenance value differs from the current one, the old value is
 * automatically appended to the history with today's ISO date.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { entityMetadata } from "@/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProvenanceHistoryEntry = { method: string; date: string };

export type EntityMetadataRow = {
  importance:           string | null;
  relevance:            string | null;
  provenance:           string | null;
  provenanceHistory:    ProvenanceHistoryEntry[];
  /** ISO timestamp of the last time importance was explicitly saved. Null = never saved. */
  importanceUpdatedAt:  string | null;
  relevanceUpdatedAt:   string | null;
  provenanceUpdatedAt:  string | null;
};

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

/** Which single field the caller wants to update in one save action. */
export type MetadataPatch =
  | { field: "importance"; value: string | null }
  | { field: "relevance";  value: string | null }
  | { field: "provenance"; value: string | null };

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getEntityMetadata(
  principalObjectId: string,
): Promise<EntityMetadataRow> {
  const rows = await db
    .select()
    .from(entityMetadata)
    .where(eq(entityMetadata.principalObjectId, principalObjectId))
    .limit(1);

  const row = rows[0];
  if (!row) return { ...EMPTY_ROW };

  return {
    importance:          row.importance,
    relevance:           row.relevance,
    provenance:          row.provenance,
    provenanceHistory:   (row.provenanceHistory as ProvenanceHistoryEntry[] | null) ?? [],
    importanceUpdatedAt: row.importanceUpdatedAt?.toISOString() ?? null,
    relevanceUpdatedAt:  row.relevanceUpdatedAt?.toISOString()  ?? null,
    provenanceUpdatedAt: row.provenanceUpdatedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Upsert one metadata field for the given principal_object_id.
 *
 * - Sets the matching field_updated_at to now().
 * - For provenance: if the new value differs from the stored current value,
 *   the old value is appended to provenanceHistory with today's ISO date.
 * - All other fields are preserved from the existing row (read-then-write).
 */
export async function patchEntityMetadata(
  principalObjectId: string,
  patch: MetadataPatch,
): Promise<EntityMetadataRow> {
  const current = await getEntityMetadata(principalObjectId);
  const now     = new Date();

  // Compute merged values
  const newImportance = patch.field === "importance" ? patch.value : current.importance;
  const newRelevance  = patch.field === "relevance"  ? patch.value : current.relevance;

  let newProvenance = current.provenance;
  let newHistory    = current.provenanceHistory;
  if (patch.field === "provenance") {
    const incoming = patch.value;
    if (current.provenance && current.provenance !== incoming) {
      const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
      newHistory = [...current.provenanceHistory, { method: current.provenance, date: today }];
    }
    newProvenance = incoming;
  }

  // Per-field timestamps — only update the one being patched
  const newImportanceUpdatedAt =
    patch.field === "importance" ? now : (current.importanceUpdatedAt ? new Date(current.importanceUpdatedAt) : null);
  const newRelevanceUpdatedAt =
    patch.field === "relevance"  ? now : (current.relevanceUpdatedAt  ? new Date(current.relevanceUpdatedAt)  : null);
  const newProvenanceUpdatedAt =
    patch.field === "provenance" ? now : (current.provenanceUpdatedAt ? new Date(current.provenanceUpdatedAt) : null);

  await db
    .insert(entityMetadata)
    .values({
      principalObjectId,
      importance:          newImportance,
      relevance:           newRelevance,
      provenance:          newProvenance,
      provenanceHistory:   newHistory,
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
        provenanceHistory:   newHistory,
        importanceUpdatedAt: newImportanceUpdatedAt,
        relevanceUpdatedAt:  newRelevanceUpdatedAt,
        provenanceUpdatedAt: newProvenanceUpdatedAt,
        updatedAt:           now,
      },
    });

  return {
    importance:          newImportance,
    relevance:           newRelevance,
    provenance:          newProvenance,
    provenanceHistory:   newHistory,
    importanceUpdatedAt: newImportanceUpdatedAt?.toISOString() ?? null,
    relevanceUpdatedAt:  newRelevanceUpdatedAt?.toISOString()  ?? null,
    provenanceUpdatedAt: newProvenanceUpdatedAt?.toISOString() ?? null,
  };
}
