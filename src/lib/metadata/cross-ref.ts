/**
 * DB query helpers for the "See Also / Related to" cross-reference section.
 * (Slice #19.11.PM)
 *
 * HOW TO USE THIS FEATURE (for future maintainers):
 *   entity_cross_reference is for INFORMAL, researcher-curated connections
 *   between entities — the kind of link you'd write in the margin of a paper
 *   file.  Use it when:
 *     - Two entities are obviously related but no formal transaction or
 *       document in the system captures that relationship.
 *     - You want to remind yourself to check another entity when working on
 *       this one.
 *   Do NOT use it to duplicate or shadow the formal associations that already
 *   live on the "Related" tab (People ↔ Properties ↔ Documents M:M links).
 *
 * Directionality:
 *   Each row is unidirectional (source → target).  The list query returns refs
 *   in BOTH directions so both entities see the link.  Only the source entity
 *   may delete the row (enforced in the API route, not the DB).
 */

import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  entityCrossReference,
  principalObject,
  person,
  property,
  document,
} from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CrossRefItem = {
  id:                string;
  /** The other entity's principalObjectId (peer — either target or source). */
  peerPrincipalObjectId: string;
  /** The other entity's human code (e.g. PERS00001). */
  peerCode:          string;
  /** PERSON | PROPERTY | DOCUMENT */
  peerType:          string;
  /** Display name: person.display_name / property.nickname / document.title. */
  peerName:          string | null;
  /** The entity's detail-page id (person.id / property.id / document.id). */
  peerEntityId:      string;
  /** Optional explanatory note typed by the creator. */
  note:              string | null;
  /** True when this entity is the source (i.e. it created the link → can delete). */
  isOwner:           boolean;
  createdAt:         string;
};

export type CodeLookupResult = {
  principalObjectId: string;
  code:              string;
  objectType:        string;
  entityId:          string;
  displayName:       string | null;
};

// ---------------------------------------------------------------------------
// List — both directions, newest first
// ---------------------------------------------------------------------------

export async function listCrossRefs(
  principalObjectId: string,
): Promise<CrossRefItem[]> {
  // We need entity details for the peer. Use aliases so we can join twice.
  const peerPO  = alias(principalObject, "peer_po");
  const peerPer = alias(person,          "peer_per");
  const peerPro = alias(property,        "peer_prop");
  const peerDoc = alias(document,        "peer_doc");

  // Rows where this entity is SOURCE (isOwner = true)
  const asSourceRows = await db
    .select({
      id:                     entityCrossReference.id,
      peerPrincipalObjectId:  entityCrossReference.targetPrincipalObjectId,
      note:                   entityCrossReference.relationshipNote,
      isOwner:                sql<boolean>`true`,
      createdAt:              entityCrossReference.createdAt,
      peerCode:               peerPO.code,
      peerType:               peerPO.objectType,
      peerPersonId:           peerPer.id,
      peerPersonName:         peerPer.displayName,
      peerPropertyId:         peerPro.id,
      peerPropertyName:       peerPro.nickname,
      peerDocumentId:         peerDoc.id,
      peerDocumentName:       peerDoc.title,
    })
    .from(entityCrossReference)
    .innerJoin(peerPO,  eq(peerPO.id,  entityCrossReference.targetPrincipalObjectId))
    .leftJoin(peerPer,  eq(peerPer.principalObjectId,  entityCrossReference.targetPrincipalObjectId))
    .leftJoin(peerPro,  eq(peerPro.principalObjectId,  entityCrossReference.targetPrincipalObjectId))
    .leftJoin(peerDoc,  eq(peerDoc.principalObjectId,  entityCrossReference.targetPrincipalObjectId))
    .where(eq(entityCrossReference.sourcePrincipalObjectId, principalObjectId))
    .orderBy(entityCrossReference.createdAt);

  // Rows where this entity is TARGET (isOwner = false)
  const peerPO2  = alias(principalObject, "peer_po2");
  const peerPer2 = alias(person,          "peer_per2");
  const peerPro2 = alias(property,        "peer_prop2");
  const peerDoc2 = alias(document,        "peer_doc2");

  const asTargetRows = await db
    .select({
      id:                     entityCrossReference.id,
      peerPrincipalObjectId:  entityCrossReference.sourcePrincipalObjectId,
      note:                   entityCrossReference.relationshipNote,
      isOwner:                sql<boolean>`false`,
      createdAt:              entityCrossReference.createdAt,
      peerCode:               peerPO2.code,
      peerType:               peerPO2.objectType,
      peerPersonId:           peerPer2.id,
      peerPersonName:         peerPer2.displayName,
      peerPropertyId:         peerPro2.id,
      peerPropertyName:       peerPro2.nickname,
      peerDocumentId:         peerDoc2.id,
      peerDocumentName:       peerDoc2.title,
    })
    .from(entityCrossReference)
    .innerJoin(peerPO2,  eq(peerPO2.id,  entityCrossReference.sourcePrincipalObjectId))
    .leftJoin(peerPer2,  eq(peerPer2.principalObjectId,  entityCrossReference.sourcePrincipalObjectId))
    .leftJoin(peerPro2,  eq(peerPro2.principalObjectId,  entityCrossReference.sourcePrincipalObjectId))
    .leftJoin(peerDoc2,  eq(peerDoc2.principalObjectId,  entityCrossReference.sourcePrincipalObjectId))
    .where(eq(entityCrossReference.targetPrincipalObjectId, principalObjectId))
    .orderBy(entityCrossReference.createdAt);

  // Merge and normalise
  const normalise = (
    row: (typeof asSourceRows)[0],
    isOwner: boolean,
  ): CrossRefItem => {
    const peerEntityId =
      row.peerPersonId ?? row.peerPropertyId ?? row.peerDocumentId ?? "";
    const peerName =
      row.peerPersonName?.trim() ||
      row.peerPropertyName?.trim() ||
      row.peerDocumentName?.trim() ||
      null;
    return {
      id:                    row.id,
      peerPrincipalObjectId: row.peerPrincipalObjectId,
      peerCode:              row.peerCode,
      peerType:              row.peerType,
      peerName,
      peerEntityId,
      note:                  row.note,
      isOwner,
      createdAt:             row.createdAt.toISOString(),
    };
  };

  const result: CrossRefItem[] = [
    ...asSourceRows.map((r) => normalise(r as Parameters<typeof normalise>[0], true)),
    ...asTargetRows.map((r) => normalise(r as Parameters<typeof normalise>[0], false)),
  ];

  // Deduplicate (if somehow the same pair appears in both directions, keep first)
  const seen = new Set<string>();
  return result.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Code lookup — resolve an entity by its human code (e.g. PERS00001)
// ---------------------------------------------------------------------------

export async function lookupEntityByCode(
  code: string,
): Promise<CodeLookupResult | null> {
  const trimmed = code.trim().toUpperCase();
  const [po] = await db
    .select({ id: principalObject.id, code: principalObject.code, objectType: principalObject.objectType })
    .from(principalObject)
    .where(eq(principalObject.code, trimmed))
    .limit(1);

  if (!po) return null;

  if (po.objectType === "PROPERTY") {
    const [row] = await db
      .select({ id: property.id, nickname: property.nickname })
      .from(property)
      .where(eq(property.principalObjectId, po.id))
      .limit(1);
    if (!row) return null;
    return {
      principalObjectId: po.id,
      code:              po.code,
      objectType:        po.objectType,
      entityId:          row.id,
      displayName:       row.nickname?.trim() || null,
    };
  }

  if (po.objectType === "DOCUMENT") {
    const [row] = await db
      .select({ id: document.id, title: document.title })
      .from(document)
      .where(eq(document.principalObjectId, po.id))
      .limit(1);
    if (!row) return null;
    return {
      principalObjectId: po.id,
      code:              po.code,
      objectType:        po.objectType,
      entityId:          row.id,
      displayName:       row.title?.trim() || null,
    };
  }

  // PERSON
  const [row] = await db
    .select({ id: person.id, displayName: person.displayName })
    .from(person)
    .where(eq(person.principalObjectId, po.id))
    .limit(1);
  if (!row) return null;
  return {
    principalObjectId: po.id,
    code:              po.code,
    objectType:        po.objectType,
    entityId:          row.id,
    displayName:       row.displayName?.trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Add — create a cross-reference
// ---------------------------------------------------------------------------

export async function addCrossRef(
  sourcePrincipalObjectId: string,
  targetPrincipalObjectId: string,
  note: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (sourcePrincipalObjectId === targetPrincipalObjectId) {
    return { ok: false, error: "Cannot link an entity to itself" };
  }

  // Check the pair doesn't already exist in either direction
  const existing = await db
    .select({ id: entityCrossReference.id })
    .from(entityCrossReference)
    .where(
      or(
        and(
          eq(entityCrossReference.sourcePrincipalObjectId, sourcePrincipalObjectId),
          eq(entityCrossReference.targetPrincipalObjectId, targetPrincipalObjectId),
        ),
        and(
          eq(entityCrossReference.sourcePrincipalObjectId, targetPrincipalObjectId),
          eq(entityCrossReference.targetPrincipalObjectId, sourcePrincipalObjectId),
        ),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return { ok: false, error: "A cross-reference between these two entities already exists" };
  }

  await db.insert(entityCrossReference).values({
    sourcePrincipalObjectId,
    targetPrincipalObjectId,
    relationshipNote: note?.trim() || null,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Remove — only the source entity may delete
// ---------------------------------------------------------------------------

export async function removeCrossRef(
  id: string,
  requestingPrincipalObjectId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [row] = await db
    .select({ sourcePrincipalObjectId: entityCrossReference.sourcePrincipalObjectId })
    .from(entityCrossReference)
    .where(eq(entityCrossReference.id, id))
    .limit(1);

  if (!row) return { ok: false, error: "Cross-reference not found" };
  if (row.sourcePrincipalObjectId !== requestingPrincipalObjectId) {
    return { ok: false, error: "Only the entity that created this link may remove it" };
  }

  await db.delete(entityCrossReference).where(eq(entityCrossReference.id, id));
  return { ok: true };
}
