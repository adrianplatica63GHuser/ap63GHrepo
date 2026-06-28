/**
 * DB query helpers for the Groups API  (Slice #18.07)
 *
 * A Group gathers items of a single target type. Only PROPERTY membership is
 * wired for now; creating a group of another target type is allowed, but its
 * member editor surfaces a "not implemented yet" message and membership updates
 * are rejected.
 *
 * Codes are allocated from `group_code_seq` and encoded (AA, AB, …) by
 * src/lib/groups/code.ts — never reused. Member positions are allocated from
 * groups.last_position (a high-water counter) — never reused (removing a member
 * leaves a gap). A property may belong to at most MAX_GROUPS_PER_PROPERTY (3)
 * groups.
 */

import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMember, groups, property } from "@/db/schema";
import { encodeGroupCode } from "./code";
import { computeMemberDelta } from "./members";
import {
  MAX_GROUPS_PER_PROPERTY,
  type GroupCreate,
  type GroupTargetType,
  type GroupUpdate,
} from "./validation";

// Re-export the pure member-set helper (defined in ./members so it can be
// unit-tested without pulling in the DB connection).
export { computeMemberDelta };

// ---------------------------------------------------------------------------
// Error type — lets API routes map domain failures to the right HTTP status.
// ---------------------------------------------------------------------------

export class GroupError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GroupError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type GroupListItem = {
  id:          string;
  code:        string;
  targetType:  GroupTargetType;
  description: string;
  memberCount: number;
  createdAt:   Date;
};

export type GroupMemberItem = {
  propertyId: string;
  position:   number;
  code:       string;
  nickname:   string | null;
};

export type GroupCandidate = {
  id:              string;
  code:            string;
  nickname:        string | null;
  otherGroupCount: number;
};

export type GroupDetail = {
  id:          string;
  code:        string;
  targetType:  GroupTargetType;
  description: string;
  members:     GroupMemberItem[];
  // null when the target type is not PROPERTY (feature not implemented yet).
  candidates:  GroupCandidate[] | null;
};

export type GroupTag = { code: string; position: number };

// ---------------------------------------------------------------------------
// List — most-recent first, with the live (non-deleted) member count.
// ---------------------------------------------------------------------------

export async function listGroups(): Promise<GroupListItem[]> {
  // NOTE: reference the outer column as a literal `groups.id` rather than
  // interpolating ${groups.id} — drizzle renders the column object unqualified
  // (bare "id") inside this correlated subquery, which Postgres rejects as
  // ambiguous (both group_member and property expose an "id").
  const memberCount = sql<number>`(
    SELECT count(*)::int
    FROM ${groupMember} gm
    JOIN ${property} p ON p.id = gm.property_id AND p.deleted_at IS NULL
    WHERE gm.group_id = groups.id
  )`;

  const rows = await db
    .select({
      id:          groups.id,
      code:        groups.code,
      targetType:  groups.targetType,
      description: groups.description,
      memberCount,
      createdAt:   groups.createdAt,
    })
    .from(groups)
    .orderBy(desc(groups.createdAt));

  return rows as GroupListItem[];
}

// ---------------------------------------------------------------------------
// Create — allocate the next code from the sequence, encode it, insert.
// ---------------------------------------------------------------------------

export async function createGroup(input: GroupCreate): Promise<GroupListItem> {
  return await db.transaction(async (tx) => {
    const seqRes = await tx.execute(sql`SELECT nextval('group_code_seq')::int AS n`);
    const n = (seqRes.rows[0] as { n: number }).n;
    const code = encodeGroupCode(n);

    const [row] = await tx
      .insert(groups)
      .values({
        code,
        targetType:  input.targetType,
        description: input.description,
      })
      .returning();

    return {
      id:          row.id,
      code:        row.code,
      targetType:  row.targetType as GroupTargetType,
      description: row.description,
      memberCount: 0,
      createdAt:   row.createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Get detail — group + ordered members + (for PROPERTY) eligible candidates.
// ---------------------------------------------------------------------------

export async function getGroupDetail(id: string): Promise<GroupDetail | null> {
  const [g] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!g) return null;

  const members = await db
    .select({
      propertyId: groupMember.propertyId,
      position:   groupMember.position,
      code:       property.code,
      nickname:   property.nickname,
    })
    .from(groupMember)
    .innerJoin(
      property,
      and(eq(property.id, groupMember.propertyId), isNull(property.deletedAt)),
    )
    .where(eq(groupMember.groupId, id))
    .orderBy(asc(groupMember.position));

  let candidates: GroupCandidate[] | null = null;
  if (g.targetType === "PROPERTY") {
    // Qualify the outer column as a literal `property.id` (see the NOTE in
    // listGroups: drizzle renders ${property.id} unqualified inside these
    // correlated subqueries, which would silently bind to group_member.id).
    const otherGroupCount = sql<number>`(
      SELECT count(DISTINCT gm.group_id)::int
      FROM ${groupMember} gm
      WHERE gm.property_id = property.id AND gm.group_id <> ${id}
    )`;

    const rows = await db
      .select({
        id:              property.id,
        code:            property.code,
        nickname:        property.nickname,
        otherGroupCount,
      })
      .from(property)
      .where(
        and(
          isNull(property.deletedAt),
          sql`NOT EXISTS (
            SELECT 1 FROM ${groupMember} gm2
            WHERE gm2.group_id = ${id} AND gm2.property_id = property.id
          )`,
        ),
      )
      .orderBy(desc(sql`greatest(${property.updatedAt}, ${property.createdAt})`));

    // A property already in the max number of OTHER groups can't be added here.
    candidates = (rows as GroupCandidate[]).filter(
      (r) => r.otherGroupCount < MAX_GROUPS_PER_PROPERTY,
    );
  }

  return {
    id:          g.id,
    code:        g.code,
    targetType:  g.targetType as GroupTargetType,
    description: g.description,
    members:     members as GroupMemberItem[],
    candidates,
  };
}

// ---------------------------------------------------------------------------
// Update — patch description and/or set the complete member set.
// ---------------------------------------------------------------------------

export async function updateGroup(
  id: string,
  input: GroupUpdate,
): Promise<GroupDetail | null> {
  await db.transaction(async (tx) => {
    const [g] = await tx.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (!g) return;

    if (input.description !== undefined) {
      await tx
        .update(groups)
        .set({ description: input.description })
        .where(eq(groups.id, id));
    }

    if (input.memberIds !== undefined) {
      if (g.targetType !== "PROPERTY") {
        throw new GroupError("Membership is not implemented for this target type", 400);
      }

      const currentRows = await tx
        .select({ propertyId: groupMember.propertyId })
        .from(groupMember)
        .where(eq(groupMember.groupId, id));
      const current = currentRows
        .map((r) => r.propertyId)
        .filter((p): p is string => p !== null);

      const { toAdd, toRemove } = computeMemberDelta(current, input.memberIds);

      // Enforce the max-groups-per-property cap on each newly added property,
      // counting groups OTHER than this one.
      if (toAdd.length > 0) {
        const counts = await tx
          .select({
            propertyId: groupMember.propertyId,
            n: sql<number>`count(DISTINCT ${groupMember.groupId})::int`,
          })
          .from(groupMember)
          .where(and(inArray(groupMember.propertyId, toAdd), ne(groupMember.groupId, id)))
          .groupBy(groupMember.propertyId);
        const countById = new Map(counts.map((c) => [c.propertyId, c.n]));
        for (const pid of toAdd) {
          if ((countById.get(pid) ?? 0) >= MAX_GROUPS_PER_PROPERTY) {
            throw new GroupError(
              `A property cannot belong to more than ${MAX_GROUPS_PER_PROPERTY} groups`,
              409,
            );
          }
        }
      }

      if (toRemove.length > 0) {
        await tx
          .delete(groupMember)
          .where(
            and(
              eq(groupMember.groupId, id),
              inArray(groupMember.propertyId, toRemove),
            ),
          );
      }

      if (toAdd.length > 0) {
        let pos = g.lastPosition;
        const values = toAdd.map((pid) => {
          pos += 1;
          return { groupId: id, propertyId: pid, position: pos };
        });
        await tx.insert(groupMember).values(values);
        await tx.update(groups).set({ lastPosition: pos }).where(eq(groups.id, id));
      }
    }
  });

  return getGroupDetail(id);
}

// ---------------------------------------------------------------------------
// Delete — cascades to group_member.
// ---------------------------------------------------------------------------

export async function deleteGroup(id: string): Promise<boolean> {
  const r = await db.delete(groups).where(eq(groups.id, id)).returning({ id: groups.id });
  return r.length > 0;
}

// ---------------------------------------------------------------------------
// Group tags for a property — for the badge on the property detail page.
// ---------------------------------------------------------------------------

export async function listPropertyGroupTags(propertyId: string): Promise<GroupTag[]> {
  const rows = await db
    .select({ code: groups.code, position: groupMember.position })
    .from(groupMember)
    .innerJoin(groups, eq(groups.id, groupMember.groupId))
    .where(eq(groupMember.propertyId, propertyId))
    .orderBy(asc(groups.code));
  return rows as GroupTag[];
}

// ---------------------------------------------------------------------------
// Properties-Map "Groups" filter data  (Slice #18.08)
// ---------------------------------------------------------------------------
//
// Two reads that feed the map's group filter:
//   - listPropertyGroupCodes()       → every PROPERTY-target group code (the
//     panel checkboxes; includes groups that currently have no members).
//   - listPropertyGroupMemberships() → (propertyId, code) pairs for each
//     non-deleted property that belongs to a PROPERTY-target group (the data
//     the client diffs against the unchecked set to decide visibility).
// Only PROPERTY-target groups are relevant on the Properties Map — a group of
// any other target type can never have a property member, so it is excluded.

/** All PROPERTY-target group codes, ascending. Includes empty groups. */
export async function listPropertyGroupCodes(): Promise<string[]> {
  const rows = await db
    .select({ code: groups.code })
    .from(groups)
    .where(eq(groups.targetType, "PROPERTY"))
    .orderBy(asc(groups.code));
  return rows.map((r) => r.code);
}

/** (propertyId, group code) pairs for every non-deleted property that is a
 *  member of a PROPERTY-target group. */
export async function listPropertyGroupMemberships(): Promise<
  { propertyId: string; code: string }[]
> {
  const rows = await db
    .select({ propertyId: groupMember.propertyId, code: groups.code })
    .from(groupMember)
    .innerJoin(groups, eq(groups.id, groupMember.groupId))
    .innerJoin(
      property,
      and(eq(property.id, groupMember.propertyId), isNull(property.deletedAt)),
    )
    .where(eq(groups.targetType, "PROPERTY"));
  return rows.filter(
    (r): r is { propertyId: string; code: string } => r.propertyId !== null,
  );
}

// Re-export so consumers don't reach across files for the cap.
export { MAX_GROUPS_PER_PROPERTY };
