/**
 * DB query helpers for entity metadata  (Slice #19.10.Metadata)
 *
 * entity_metadata stores per-entity subjective tags (importance, relevance,
 * provenance) keyed by principal_object_id. One optional row per entity;
 * absent rows are returned as all-null defaults.
 *
 * Provenance history: [{method, date}] JSONB array (oldest first).
 * When a new provenance value differs from the current one, the old value is
 * automatically appended to the history with today's ISO date before the
 * update is persisted.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { entityMetadata } from "@/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProvenanceHistoryEntry = { method: string; date: string };

export type EntityMetadataRow = {
  importance:        string | null;
  relevance:         string | null;
  provenance:        string | null;
  provenanceHistory: ProvenanceHistoryEntry[];
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
  if (!row) {
    return { importance: null, relevance: null, provenance: null, provenanceHistory: [] };
  }
  return {
    importance:        row.importance,
    relevance:         row.relevance,
    provenance:        row.provenance,
    provenanceHistory: (row.provenanceHistory as ProvenanceHistoryEntry[] | null) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Upsert one metadata field for the given principal_object_id.
 *
 * For provenance: if the new value differs from the stored current value,
 * the old value is appended to provenanceHistory with today's ISO date.
 *
 * All other fields are preserved from the existing row (read-then-write).
 */
export async function patchEntityMetadata(
  principalObjectId: string,
  patch: MetadataPatch,
): Promise<EntityMetadataRow> {
  const current = await getEntityMetadata(principalObjectId);

  // Compute merged values
  const newImportance = patch.field === "importance" ? patch.value : current.importance;
  const newRelevance  = patch.field === "relevance"  ? patch.value : current.relevance;

  let newProvenance = current.provenance;
  let newHistory    = current.provenanceHistory;
  if (patch.field === "provenance") {
    const incoming = patch.value;
    if (current.provenance && current.provenance !== incoming) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      newHistory = [...current.provenanceHistory, { method: current.provenance, date: today }];
    }
    newProvenance = incoming;
  }

  // Full upsert — insert on first save, update on subsequent saves.
  await db
    .insert(entityMetadata)
    .values({
      principalObjectId,
      importance:        newImportance,
      relevance:         newRelevance,
      provenance:        newProvenance,
      provenanceHistory: newHistory,
    })
    .onConflictDoUpdate({
      target: entityMetadata.principalObjectId,
      set: {
        importance:        newImportance,
        relevance:         newRelevance,
        provenance:        newProvenance,
        provenanceHistory: newHistory,
        updatedAt:         new Date(),
      },
    });

  return {
    importance:        newImportance,
    relevance:         newRelevance,
    provenance:        newProvenance,
    provenanceHistory: newHistory,
  };
}
