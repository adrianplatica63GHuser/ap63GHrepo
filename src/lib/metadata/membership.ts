/**
 * Entity-centric group and stamp membership helpers  (Slice #19.11.PM)
 *
 * All operations take a `principalObjectId` and look up the entity type +
 * entity id automatically, so the caller (the /api/metadata/* routes) never
 * needs to know whether the entity is a property, person or document.
 *
 * Group add/remove works with targeted single-row INSERT / DELETE rather
 * than the full member-set replacement used by the group admin pages.
 */

import { and, eq, sql, not, exists, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  principalObject,
  person,
  property,
  document,
  groups,
  groupMember,
  stampMember,
  stamps,
} from "@/db/schema";
import { MAX_GROUPS_PER_ITEM, MAX_GROUPS_PER_PROPERTY } from "@/lib/groups/validation";
import type { GroupTargetType } from "@/lib/groups/validation";
import type { StampTargetType } from "@/lib/stamps/validation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityInfo = {
  entityId:        string;
  groupTargetType: GroupTargetType;
  stampTargetType: StampTargetType;
};

export type AvailableGroup = { id: string; code: string; description: string };
export type AvailableStamp = { id: string; code: string; shortDescription: string };

// ---------------------------------------------------------------------------
// Internal — resolve entity from principalObjectId
// ---------------------------------------------------------------------------

async function resolveEntity(principalObjectId: string): Promise<EntityInfo | null> {
  // 1. Look up principal_object.object_type
  const [po] = await db
    .select({ objectType: principalObject.objectType })
    .from(principalObject)
    .where(eq(principalObject.id, principalObjectId))
    .limit(1);

  if (!po) return null;

  if (po.objectType === "PROPERTY") {
    const [row] = await db
      .select({ id: property.id })
      .from(property)
      .where(eq(property.principalObjectId, principalObjectId))
      .limit(1);
    if (!row) return null;
    return { entityId: row.id, groupTargetType: "PROPERTY", stampTargetType: "PROPERTY" };
  }

  if (po.objectType === "DOCUMENT") {
    const [row] = await db
      .select({ id: document.id })
      .from(document)
      .where(eq(document.principalObjectId, principalObjectId))
      .limit(1);
    if (!row) return null;
    return { entityId: row.id, groupTargetType: "DOCUMENT", stampTargetType: "DOCUMENT" };
  }

  // PERSON — check person.type to distinguish NATURAL/JUDICIAL
  if (po.objectType === "PERSON") {
    const [row] = await db
      .select({ id: person.id, type: person.type })
      .from(person)
      .where(eq(person.principalObjectId, principalObjectId))
      .limit(1);
    if (!row) return null;
    const groupTargetType: GroupTargetType =
      row.type === "NATURAL" ? "PHYSICAL_PERSON" : "JUDICIAL_PERSON";
    const stampTargetType: StampTargetType =
      row.type === "NATURAL" ? "PHYSICAL_PERSON" : "JUDICIAL_PERSON";
    return { entityId: row.id, groupTargetType, stampTargetType };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Groups — available (not yet joined)
// ---------------------------------------------------------------------------

export async function listAvailableGroups(
  principalObjectId: string,
): Promise<AvailableGroup[]> {
  const info = await resolveEntity(principalObjectId);
  if (!info) return [];

  const { entityId, groupTargetType } = info;

  // Build the NOT EXISTS clause against the right FK column
  const notAlreadyMember =
    groupTargetType === "PROPERTY"
      ? not(exists(db.select().from(groupMember).where(
          and(eq(groupMember.groupId, groups.id), eq(groupMember.propertyId, entityId)))))
      : groupTargetType === "PHYSICAL_PERSON" || groupTargetType === "JUDICIAL_PERSON"
      ? not(exists(db.select().from(groupMember).where(
          and(eq(groupMember.groupId, groups.id), eq(groupMember.personId, entityId)))))
      : not(exists(db.select().from(groupMember).where(
          and(eq(groupMember.groupId, groups.id), eq(groupMember.documentId, entityId)))));

  // Count how many groups this entity already belongs to (for cap check)
  let currentGroupCount = 0;
  if (groupTargetType === "PROPERTY") {
    const [cnt] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(groupMember)
      .where(and(eq(groupMember.propertyId, entityId)));
    currentGroupCount = cnt?.n ?? 0;
  } else if (groupTargetType === "PHYSICAL_PERSON" || groupTargetType === "JUDICIAL_PERSON") {
    const [cnt] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(groupMember)
      .innerJoin(groups, eq(groups.id, groupMember.groupId))
      .where(and(eq(groupMember.personId, entityId), eq(groups.targetType, groupTargetType)));
    currentGroupCount = cnt?.n ?? 0;
  } else {
    const [cnt] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(groupMember)
      .where(and(eq(groupMember.documentId, entityId)));
    currentGroupCount = cnt?.n ?? 0;
  }

  const cap = groupTargetType === "PROPERTY" ? MAX_GROUPS_PER_PROPERTY : MAX_GROUPS_PER_ITEM;
  if (currentGroupCount >= cap) return []; // entity already at cap — no additions possible

  const rows = await db
    .select({ id: groups.id, code: groups.code, description: groups.description })
    .from(groups)
    .where(and(eq(groups.targetType, groupTargetType), notAlreadyMember))
    .orderBy(asc(groups.code));

  return rows;
}

// ---------------------------------------------------------------------------
// Groups — add entity to group
// ---------------------------------------------------------------------------

export async function addEntityToGroup(
  principalObjectId: string,
  groupId: string,
): Promise<{ ok: boolean; error?: string }> {
  const info = await resolveEntity(principalObjectId);
  if (!info) return { ok: false, error: "Entity not found" };

  const { entityId, groupTargetType } = info;

  // Check the group exists and matches the target type
  const [g] = await db
    .select({ id: groups.id, lastPosition: groups.lastPosition, targetType: groups.targetType })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!g) return { ok: false, error: "Group not found" };
  if (g.targetType !== groupTargetType) return { ok: false, error: "Target type mismatch" };

  // Cap check
  const cap = groupTargetType === "PROPERTY" ? MAX_GROUPS_PER_PROPERTY : MAX_GROUPS_PER_ITEM;
  let currentCount = 0;
  if (groupTargetType === "PROPERTY") {
    const [c] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(groupMember)
      .where(eq(groupMember.propertyId, entityId));
    currentCount = c?.n ?? 0;
  } else if (groupTargetType === "PHYSICAL_PERSON" || groupTargetType === "JUDICIAL_PERSON") {
    const [c] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(groupMember)
      .innerJoin(groups, eq(groups.id, groupMember.groupId))
      .where(and(eq(groupMember.personId, entityId), eq(groups.targetType, groupTargetType)));
    currentCount = c?.n ?? 0;
  } else {
    const [c] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(groupMember)
      .where(eq(groupMember.documentId, entityId));
    currentCount = c?.n ?? 0;
  }
  if (currentCount >= cap) {
    return { ok: false, error: `Maximum ${cap} groups per entity reached` };
  }

  // Allocate next position (high-water counter, never reused)
  const newPosition = g.lastPosition + 1;
  await db.transaction(async (tx) => {
    if (groupTargetType === "PROPERTY") {
      await tx.insert(groupMember).values({ groupId, propertyId: entityId, position: newPosition }).onConflictDoNothing();
    } else if (groupTargetType === "PHYSICAL_PERSON" || groupTargetType === "JUDICIAL_PERSON") {
      await tx.insert(groupMember).values({ groupId, personId: entityId, position: newPosition }).onConflictDoNothing();
    } else {
      await tx.insert(groupMember).values({ groupId, documentId: entityId, position: newPosition }).onConflictDoNothing();
    }
    await tx.update(groups).set({ lastPosition: newPosition }).where(eq(groups.id, groupId));
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Groups — remove entity from group
// ---------------------------------------------------------------------------

export async function removeEntityFromGroup(
  principalObjectId: string,
  groupId: string,
): Promise<{ ok: boolean }> {
  const info = await resolveEntity(principalObjectId);
  if (!info) return { ok: false };

  const { entityId, groupTargetType } = info;

  if (groupTargetType === "PROPERTY") {
    await db.delete(groupMember).where(
      and(eq(groupMember.groupId, groupId), eq(groupMember.propertyId, entityId)));
  } else if (groupTargetType === "PHYSICAL_PERSON" || groupTargetType === "JUDICIAL_PERSON") {
    await db.delete(groupMember).where(
      and(eq(groupMember.groupId, groupId), eq(groupMember.personId, entityId)));
  } else {
    await db.delete(groupMember).where(
      and(eq(groupMember.groupId, groupId), eq(groupMember.documentId, entityId)));
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stamps — available (not yet applied)
// ---------------------------------------------------------------------------

export async function listAvailableStamps(
  principalObjectId: string,
): Promise<AvailableStamp[]> {
  const info = await resolveEntity(principalObjectId);
  if (!info) return [];

  const { entityId, stampTargetType } = info;

  const notAlreadyStamped =
    stampTargetType === "PROPERTY"
      ? not(exists(db.select().from(stampMember).where(
          and(eq(stampMember.stampId, stamps.id), eq(stampMember.propertyId, entityId)))))
      : stampTargetType === "PHYSICAL_PERSON" || stampTargetType === "JUDICIAL_PERSON"
      ? not(exists(db.select().from(stampMember).where(
          and(eq(stampMember.stampId, stamps.id),
              eq(stampMember.targetType, stampTargetType),
              eq(stampMember.personId, entityId)))))
      : not(exists(db.select().from(stampMember).where(
          and(eq(stampMember.stampId, stamps.id), eq(stampMember.documentId, entityId)))));

  const rows = await db
    .select({ id: stamps.id, code: stamps.code, shortDescription: stamps.shortDescription })
    .from(stamps)
    .where(notAlreadyStamped)
    .orderBy(asc(stamps.code));

  return rows;
}

// ---------------------------------------------------------------------------
// Stamps — add to entity
// ---------------------------------------------------------------------------

export async function addStampToEntity(
  principalObjectId: string,
  stampId: string,
): Promise<{ ok: boolean; error?: string }> {
  const info = await resolveEntity(principalObjectId);
  if (!info) return { ok: false, error: "Entity not found" };

  const { entityId, stampTargetType } = info;

  const [s] = await db.select({ id: stamps.id }).from(stamps).where(eq(stamps.id, stampId)).limit(1);
  if (!s) return { ok: false, error: "Stamp not found" };

  if (stampTargetType === "PROPERTY") {
    await db.insert(stampMember).values({ stampId, targetType: stampTargetType, propertyId: entityId }).onConflictDoNothing();
  } else if (stampTargetType === "PHYSICAL_PERSON" || stampTargetType === "JUDICIAL_PERSON") {
    await db.insert(stampMember).values({ stampId, targetType: stampTargetType, personId: entityId }).onConflictDoNothing();
  } else {
    await db.insert(stampMember).values({ stampId, targetType: stampTargetType, documentId: entityId }).onConflictDoNothing();
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stamps — remove from entity
// ---------------------------------------------------------------------------

export async function removeStampFromEntity(
  principalObjectId: string,
  stampId: string,
): Promise<{ ok: boolean }> {
  const info = await resolveEntity(principalObjectId);
  if (!info) return { ok: false };

  const { entityId, stampTargetType } = info;

  if (stampTargetType === "PROPERTY") {
    await db.delete(stampMember).where(
      and(eq(stampMember.stampId, stampId), eq(stampMember.propertyId, entityId)));
  } else if (stampTargetType === "PHYSICAL_PERSON" || stampTargetType === "JUDICIAL_PERSON") {
    await db.delete(stampMember).where(
      and(eq(stampMember.stampId, stampId),
          eq(stampMember.targetType, stampTargetType),
          eq(stampMember.personId, entityId)));
  } else {
    await db.delete(stampMember).where(
      and(eq(stampMember.stampId, stampId), eq(stampMember.documentId, entityId)));
  }

  return { ok: true };
}
