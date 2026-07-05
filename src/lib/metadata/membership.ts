/**
 * Entity-centric group and stamp membership helpers  (Slice #19.11.PM)
 *
 * All operations take a `principalObjectId` and look up the entity type
 * automatically, so the caller (the /api/metadata/* routes) never needs to
 * know whether the entity is a property, person or document.
 *
 * As of migration_051, group_member and stamp_member store a single
 * `principal_object_id` FK instead of three nullable typed FK columns.
 * This removes all per-type branching from add/remove operations — they
 * are now uniform single-column INSERT / DELETE.  Only `resolveEntity` still
 * needs a DB lookup to determine the group/stamp target type (for cap
 * enforcement and PHYSICAL_PERSON vs JUDICIAL_PERSON disambiguation).
 */

import { and, asc, eq, not, exists, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  groupMember,
  groups,
  person,
  principalObject,
  stampMember,
  stamps,
} from "@/db/schema";
import { MAX_GROUPS_PER_ITEM, MAX_GROUPS_PER_PROPERTY } from "@/lib/groups/validation";
import type { GroupTargetType } from "@/lib/groups/validation";
import type { StampTargetType } from "@/lib/stamps/validation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved entity type — all we need to drive group/stamp membership logic. */
type EntityInfo = {
  groupTargetType: GroupTargetType;
  stampTargetType: StampTargetType;
};

export type AvailableGroup = { id: string; code: string; description: string };
export type AvailableStamp = { id: string; code: string; shortDescription: string };

// ---------------------------------------------------------------------------
// Internal — resolve entity type from principalObjectId.
// For PROPERTY and DOCUMENT we only need the principal_object.object_type.
// For PERSON we also need person.type to distinguish NATURAL/JUDICIAL.
// ---------------------------------------------------------------------------

async function resolveEntity(principalObjectId: string): Promise<EntityInfo | null> {
  const [po] = await db
    .select({ objectType: principalObject.objectType })
    .from(principalObject)
    .where(eq(principalObject.id, principalObjectId))
    .limit(1);

  if (!po) return null;

  if (po.objectType === "PROPERTY") {
    return { groupTargetType: "PROPERTY", stampTargetType: "PROPERTY" };
  }

  if (po.objectType === "DOCUMENT") {
    return { groupTargetType: "DOCUMENT", stampTargetType: "DOCUMENT" };
  }

  // PERSON — need person.type to distinguish NATURAL / JUDICIAL
  if (po.objectType === "PERSON") {
    const [row] = await db
      .select({ type: person.type })
      .from(person)
      .where(eq(person.principalObjectId, principalObjectId))
      .limit(1);
    if (!row) return null;
    const groupTargetType: GroupTargetType =
      row.type === "NATURAL" ? "PHYSICAL_PERSON" : "JUDICIAL_PERSON";
    const stampTargetType: StampTargetType =
      row.type === "NATURAL" ? "PHYSICAL_PERSON" : "JUDICIAL_PERSON";
    return { groupTargetType, stampTargetType };
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

  const { groupTargetType } = info;

  // Count same-type groups already joined (per-item cap).
  const capQuery =
    groupTargetType === "PHYSICAL_PERSON" || groupTargetType === "JUDICIAL_PERSON"
      ? // Person caps are per same target-type group only.
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(groupMember)
          .innerJoin(groups, eq(groups.id, groupMember.groupId))
          .where(
            and(
              eq(groupMember.principalObjectId, principalObjectId),
              eq(groups.targetType, groupTargetType),
            ),
          )
      : db
          .select({ n: sql<number>`count(*)::int` })
          .from(groupMember)
          .innerJoin(groups, eq(groups.id, groupMember.groupId))
          .where(eq(groupMember.principalObjectId, principalObjectId));

  const [cnt] = await capQuery;
  const currentGroupCount = cnt?.n ?? 0;
  const cap = groupTargetType === "PROPERTY" ? MAX_GROUPS_PER_PROPERTY : MAX_GROUPS_PER_ITEM;
  if (currentGroupCount >= cap) return [];

  // Groups of the right type where this entity is not yet a member.
  const notAlreadyMember = not(
    exists(
      db
        .select({ x: sql`1` })
        .from(groupMember)
        .where(
          and(
            eq(groupMember.groupId, groups.id),
            eq(groupMember.principalObjectId, principalObjectId),
          ),
        ),
    ),
  );

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

  const { groupTargetType } = info;

  // Verify group exists and matches the target type.
  const [g] = await db
    .select({ id: groups.id, lastPosition: groups.lastPosition, targetType: groups.targetType })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!g) return { ok: false, error: "Group not found" };
  if (g.targetType !== groupTargetType) return { ok: false, error: "Target type mismatch" };

  // Cap check.
  const cap = groupTargetType === "PROPERTY" ? MAX_GROUPS_PER_PROPERTY : MAX_GROUPS_PER_ITEM;

  const capQuery =
    groupTargetType === "PHYSICAL_PERSON" || groupTargetType === "JUDICIAL_PERSON"
      ? db
          .select({ n: sql<number>`count(*)::int` })
          .from(groupMember)
          .innerJoin(groups, eq(groups.id, groupMember.groupId))
          .where(
            and(
              eq(groupMember.principalObjectId, principalObjectId),
              eq(groups.targetType, groupTargetType),
            ),
          )
      : db
          .select({ n: sql<number>`count(*)::int` })
          .from(groupMember)
          .where(eq(groupMember.principalObjectId, principalObjectId));

  const [c] = await capQuery;
  const currentCount = c?.n ?? 0;
  if (currentCount >= cap) {
    return { ok: false, error: `Maximum ${cap} groups per entity reached` };
  }

  // Allocate next position (high-water counter, never reused) and insert.
  const newPosition = g.lastPosition + 1;
  await db.transaction(async (tx) => {
    await tx
      .insert(groupMember)
      .values({ groupId, principalObjectId, position: newPosition })
      .onConflictDoNothing();
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
  await db.delete(groupMember).where(
    and(
      eq(groupMember.groupId, groupId),
      eq(groupMember.principalObjectId, principalObjectId),
    ),
  );
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

  const { stampTargetType } = info;

  // Stamps of any target type where this entity is not yet stamped.
  // stamp_member.target_type is used to match the right subtype for persons.
  const notAlreadyStamped = not(
    exists(
      db
        .select({ x: sql`1` })
        .from(stampMember)
        .where(
          and(
            eq(stampMember.stampId, stamps.id),
            eq(stampMember.principalObjectId, principalObjectId),
          ),
        ),
    ),
  );

  const rows = await db
    .select({ id: stamps.id, code: stamps.code, shortDescription: stamps.shortDescription })
    .from(stamps)
    .where(notAlreadyStamped)
    .orderBy(asc(stamps.code));

  // Only return stamps that match the entity's target type (stamps are created
  // for a specific target type; we filter client-side to avoid an extra JOIN).
  // Actually stamps are not filtered by target type at creation time in the
  // current schema — any stamp can be applied to any entity type.  Return all.
  void stampTargetType; // keep for future use

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

  const { stampTargetType } = info;

  const [s] = await db
    .select({ id: stamps.id })
    .from(stamps)
    .where(eq(stamps.id, stampId))
    .limit(1);
  if (!s) return { ok: false, error: "Stamp not found" };

  await db
    .insert(stampMember)
    .values({ stampId, targetType: stampTargetType, principalObjectId })
    .onConflictDoNothing();

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stamps — remove from entity
// ---------------------------------------------------------------------------

export async function removeStampFromEntity(
  principalObjectId: string,
  stampId: string,
): Promise<{ ok: boolean }> {
  await db.delete(stampMember).where(
    and(
      eq(stampMember.stampId, stampId),
      eq(stampMember.principalObjectId, principalObjectId),
    ),
  );
  return { ok: true };
}
