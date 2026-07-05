/**
 * DB query helpers for the Groups API  (Slice #18.07, extended Slice #18.17)
 *
 * A Group gathers items of a single target type. As of Slice #18.17, all four
 * target types are wired: PROPERTY, PHYSICAL_PERSON, JUDICIAL_PERSON, DOCUMENT.
 *
 * As of migration_051, group_member stores a single `principal_object_id` FK
 * instead of the old nullable triple (property_id, person_id, document_id).
 * All queries join through the entity table using the principal_object_id →
 * entity.principal_object_id link to recover the entity-specific columns.
 *
 * Codes are allocated from `group_code_seq` and prefixed by target type
 * (PROP-, PERS-, DOC-) in src/lib/groups/code.ts — never reused. Member
 * positions are allocated from groups.last_position (a high-water counter) —
 * never reused (removing a member leaves a gap).
 * Each item may belong to at most MAX_GROUPS_PER_ITEM groups of the same
 * target type.
 */

import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  document,
  groupMember,
  groups,
  person,
  property,
} from "@/db/schema";
import { encodeGroupCode, groupCodePrefix } from "./code";
import { computeMemberDelta } from "./members";
import {
  MAX_GROUPS_PER_ITEM,
  MAX_GROUPS_PER_PROPERTY,
  type GroupCreate,
  type GroupTargetType,
  type GroupUpdate,
} from "./validation";

// Re-export the pure member-set helper so consumers don't reach across files.
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

/**
 * Normalised member row — works for all target types.
 * `memberId` is the entity-table PK (property.id / person.id / document.id).
 */
export type GroupMemberItem = {
  memberId:     string;
  position:     number;
  displayLabel: string;
};

/**
 * Normalised candidate row — works for all target types.
 */
export type GroupCandidate = {
  id:              string;
  displayLabel:    string;
  otherGroupCount: number;
};

export type GroupDetail = {
  id:          string;
  code:        string;
  targetType:  GroupTargetType;
  description: string;
  members:     GroupMemberItem[];
  candidates:  GroupCandidate[];
};

export type GroupTag = { code: string; position: number };

// ---------------------------------------------------------------------------
// Internal helper — build display label for a property candidate/member
// ---------------------------------------------------------------------------

function propLabel(code: string, nickname: string | null): string {
  return nickname?.trim() || code;
}

// ---------------------------------------------------------------------------
// List — most-recent first, with the live (non-deleted) member count.
// Optionally filtered by targetType.
// ---------------------------------------------------------------------------

export async function listGroups(
  targetType?: GroupTargetType,
): Promise<GroupListItem[]> {
  // NOTE: Drizzle renders ${column} in a correlated subquery UNQUALIFIED (bare
  // "id"), which Postgres rejects as ambiguous when the subquery's own FROM
  // exposes an "id" column. Always reference outer columns as literal qualified
  // names inside sql`` templates used as correlated subqueries.
  //
  // After migration_051, group_member.principal_object_id links to
  // principal_object. We join to the entity table to check deleted_at.
  const memberCount = sql<number>`(
    SELECT count(*)::int
    FROM group_member gm
    JOIN principal_object po ON po.id = gm.principal_object_id
    WHERE gm.group_id = groups.id
      AND (
        (po.object_type = 'PROPERTY' AND EXISTS (
          SELECT 1 FROM property p WHERE p.principal_object_id = po.id AND p.deleted_at IS NULL
        ))
        OR (po.object_type = 'PERSON' AND EXISTS (
          SELECT 1 FROM person pe WHERE pe.principal_object_id = po.id AND pe.deleted_at IS NULL
        ))
        OR (po.object_type = 'DOCUMENT' AND EXISTS (
          SELECT 1 FROM document d WHERE d.principal_object_id = po.id AND d.deleted_at IS NULL
        ))
      )
  )`;

  const baseWhere = isNull(groups.deletedAt);

  const query = db
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

  const rows = targetType
    ? await query.where(and(baseWhere, eq(groups.targetType, targetType)))
    : await query.where(baseWhere);

  return rows as GroupListItem[];
}

// ---------------------------------------------------------------------------
// Create — allocate the next code from the sequence, prefix it, insert.
// ---------------------------------------------------------------------------

export async function createGroup(input: GroupCreate): Promise<GroupListItem> {
  return await db.transaction(async (tx) => {
    const seqRes = await tx.execute(sql`SELECT nextval('group_code_seq')::int AS n`);
    const n = (seqRes.rows[0] as { n: number }).n;
    const code = groupCodePrefix(input.targetType) + encodeGroupCode(n);

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
// Get detail — group + ordered members + eligible candidates (all types).
// ---------------------------------------------------------------------------

export async function getGroupDetail(id: string): Promise<GroupDetail | null> {
  // Slice #19.30: treat soft-deleted groups as not found.
  const [g] = await db.select().from(groups).where(and(eq(groups.id, id), isNull(groups.deletedAt))).limit(1);
  if (!g) return null;

  const targetType = g.targetType as GroupTargetType;

  // ------------------------------------------------------------------
  // Members — join through entity table via principal_object_id
  // ------------------------------------------------------------------
  let members: GroupMemberItem[] = [];

  if (targetType === "PROPERTY") {
    const rows = await db
      .select({
        memberId: property.id,
        position: groupMember.position,
        code:     property.code,
        nickname: property.nickname,
      })
      .from(groupMember)
      .innerJoin(
        property,
        and(
          eq(property.principalObjectId, groupMember.principalObjectId),
          isNull(property.deletedAt),
        ),
      )
      .where(eq(groupMember.groupId, id))
      .orderBy(asc(groupMember.position));

    members = rows.map((r) => ({
      memberId:     r.memberId,
      position:     r.position,
      displayLabel: propLabel(r.code, r.nickname),
    }));

  } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
    const personType = targetType === "PHYSICAL_PERSON" ? "NATURAL" : "JUDICIAL";
    const rows = await db
      .select({
        memberId:    person.id,
        position:    groupMember.position,
        displayName: person.displayName,
        code:        person.code,
      })
      .from(groupMember)
      .innerJoin(
        person,
        and(
          eq(person.principalObjectId, groupMember.principalObjectId),
          isNull(person.deletedAt),
          eq(person.type, personType),
        ),
      )
      .where(eq(groupMember.groupId, id))
      .orderBy(asc(groupMember.position));

    members = rows.map((r) => ({
      memberId:     r.memberId,
      position:     r.position,
      displayLabel: r.displayName?.trim() || r.code,
    }));

  } else if (targetType === "DOCUMENT") {
    const rows = await db
      .select({
        memberId: document.id,
        position: groupMember.position,
        title:    document.title,
        code:     document.code,
      })
      .from(groupMember)
      .innerJoin(
        document,
        and(
          eq(document.principalObjectId, groupMember.principalObjectId),
          isNull(document.deletedAt),
        ),
      )
      .where(eq(groupMember.groupId, id))
      .orderBy(asc(groupMember.position));

    members = rows.map((r) => ({
      memberId:     r.memberId,
      position:     r.position,
      displayLabel: r.title?.trim() || r.code,
    }));
  }

  // ------------------------------------------------------------------
  // Candidates — items not yet in this group, under the per-item cap.
  // Correlated subqueries use literal qualified column names to avoid
  // the Drizzle unqualified-column gotcha (CLAUDE.md).
  // ------------------------------------------------------------------
  let candidates: GroupCandidate[] = [];

  if (targetType === "PROPERTY") {
    const otherGroupCount = sql<number>`(
      SELECT count(DISTINCT gm.group_id)::int
      FROM group_member gm
      WHERE gm.principal_object_id = property.principal_object_id
        AND gm.group_id <> ${id}
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
            SELECT 1 FROM group_member gm2
            WHERE gm2.group_id = ${id}
              AND gm2.principal_object_id = property.principal_object_id
          )`,
        ),
      )
      .orderBy(desc(sql`greatest(${property.updatedAt}, ${property.createdAt})`));

    candidates = (rows as (typeof rows[0] & { otherGroupCount: number })[])
      .filter((r) => r.otherGroupCount < MAX_GROUPS_PER_PROPERTY)
      .map((r) => ({
        id:              r.id,
        displayLabel:    propLabel(r.code, r.nickname),
        otherGroupCount: r.otherGroupCount,
      }));

  } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
    const personType = targetType === "PHYSICAL_PERSON" ? "NATURAL" : "JUDICIAL";

    // Count other SAME-type groups the person belongs to (PHYSICAL and JUDICIAL
    // are separate namespaces — a PERS-XX physical group does not count against
    // a PERS-YY judicial group).
    const otherGroupCount = sql<number>`(
      SELECT count(DISTINCT gm.group_id)::int
      FROM group_member gm
      JOIN groups g2 ON g2.id = gm.group_id
      WHERE gm.principal_object_id = person.principal_object_id
        AND gm.group_id <> ${id}
        AND g2.target_type = ${targetType}
    )`;

    const rows = await db
      .select({
        id:          person.id,
        displayName: person.displayName,
        code:        person.code,
        otherGroupCount,
      })
      .from(person)
      .where(
        and(
          isNull(person.deletedAt),
          eq(person.type, personType),
          sql`NOT EXISTS (
            SELECT 1 FROM group_member gm2
            WHERE gm2.group_id = ${id}
              AND gm2.principal_object_id = person.principal_object_id
          )`,
        ),
      )
      .orderBy(desc(sql`greatest(${person.updatedAt}, ${person.createdAt})`));

    candidates = (rows as (typeof rows[0] & { otherGroupCount: number })[])
      .filter((r) => r.otherGroupCount < MAX_GROUPS_PER_ITEM)
      .map((r) => ({
        id:              r.id,
        displayLabel:    r.displayName?.trim() || r.code,
        otherGroupCount: r.otherGroupCount,
      }));

  } else if (targetType === "DOCUMENT") {
    const otherGroupCount = sql<number>`(
      SELECT count(DISTINCT gm.group_id)::int
      FROM group_member gm
      WHERE gm.principal_object_id = document.principal_object_id
        AND gm.group_id <> ${id}
    )`;

    const rows = await db
      .select({
        id:    document.id,
        title: document.title,
        code:  document.code,
        otherGroupCount,
      })
      .from(document)
      .where(
        and(
          isNull(document.deletedAt),
          sql`NOT EXISTS (
            SELECT 1 FROM group_member gm2
            WHERE gm2.group_id = ${id}
              AND gm2.principal_object_id = document.principal_object_id
          )`,
        ),
      )
      .orderBy(desc(sql`greatest(${document.updatedAt}, ${document.createdAt})`));

    candidates = (rows as (typeof rows[0] & { otherGroupCount: number })[])
      .filter((r) => r.otherGroupCount < MAX_GROUPS_PER_ITEM)
      .map((r) => ({
        id:              r.id,
        displayLabel:    r.title?.trim() || r.code,
        otherGroupCount: r.otherGroupCount,
      }));
  }

  return {
    id:          g.id,
    code:        g.code,
    targetType,
    description: g.description,
    members,
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
    // Slice #19.30: treat soft-deleted groups as not found.
    const [g] = await tx.select().from(groups).where(and(eq(groups.id, id), isNull(groups.deletedAt))).limit(1);
    if (!g) return;

    if (input.description !== undefined) {
      await tx
        .update(groups)
        .set({ description: input.description })
        .where(eq(groups.id, id));
    }

    if (input.memberIds !== undefined) {
      const targetType = g.targetType as GroupTargetType;

      // ------------------------------------------------------------------
      // Resolve current member entity IDs by joining through entity table.
      // ------------------------------------------------------------------
      let current: string[] = [];

      if (targetType === "PROPERTY") {
        const rows = await tx
          .select({ entityId: property.id })
          .from(groupMember)
          .innerJoin(property, eq(property.principalObjectId, groupMember.principalObjectId))
          .where(eq(groupMember.groupId, id));
        current = rows.map((r) => r.entityId);

      } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
        const rows = await tx
          .select({ entityId: person.id })
          .from(groupMember)
          .innerJoin(person, eq(person.principalObjectId, groupMember.principalObjectId))
          .where(eq(groupMember.groupId, id));
        current = rows.map((r) => r.entityId);

      } else if (targetType === "DOCUMENT") {
        const rows = await tx
          .select({ entityId: document.id })
          .from(groupMember)
          .innerJoin(document, eq(document.principalObjectId, groupMember.principalObjectId))
          .where(eq(groupMember.groupId, id));
        current = rows.map((r) => r.entityId);
      }

      const { toAdd, toRemove } = computeMemberDelta(current, input.memberIds);

      // ------------------------------------------------------------------
      // Translate entity IDs → principal_object_ids for all affected rows.
      // One query covers both toAdd and toRemove to minimise round-trips.
      // ------------------------------------------------------------------
      const allEntityIds = [...toAdd, ...toRemove];
      let entityPoMap = new Map<string, string>(); // entityId → principalObjectId

      if (allEntityIds.length > 0) {
        if (targetType === "PROPERTY") {
          const rows = await tx
            .select({ entityId: property.id, poId: property.principalObjectId })
            .from(property)
            .where(inArray(property.id, allEntityIds));
          entityPoMap = new Map(rows.map((r) => [r.entityId, r.poId]));

        } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
          const rows = await tx
            .select({ entityId: person.id, poId: person.principalObjectId })
            .from(person)
            .where(inArray(person.id, allEntityIds));
          entityPoMap = new Map(rows.map((r) => [r.entityId, r.poId]));

        } else if (targetType === "DOCUMENT") {
          const rows = await tx
            .select({ entityId: document.id, poId: document.principalObjectId })
            .from(document)
            .where(inArray(document.id, allEntityIds));
          entityPoMap = new Map(rows.map((r) => [r.entityId, r.poId]));
        }
      }

      const toAddPoIds    = toAdd.map((eid) => entityPoMap.get(eid)).filter(Boolean) as string[];
      const toRemovePoIds = toRemove.map((eid) => entityPoMap.get(eid)).filter(Boolean) as string[];

      // ------------------------------------------------------------------
      // Enforce the per-item group cap on new additions.
      // ------------------------------------------------------------------
      if (toAddPoIds.length > 0) {
        if (targetType === "PROPERTY") {
          const counts = await tx
            .select({
              poId: groupMember.principalObjectId,
              n:    sql<number>`count(DISTINCT ${groupMember.groupId})::int`,
            })
            .from(groupMember)
            .where(and(inArray(groupMember.principalObjectId, toAddPoIds), ne(groupMember.groupId, id)))
            .groupBy(groupMember.principalObjectId);
          const countByPoId = new Map(counts.map((c) => [c.poId, c.n]));

          for (const eid of toAdd) {
            const poId = entityPoMap.get(eid);
            if ((countByPoId.get(poId ?? "") ?? 0) >= MAX_GROUPS_PER_PROPERTY) {
              throw new GroupError(
                `A property cannot belong to more than ${MAX_GROUPS_PER_PROPERTY} groups`,
                409,
              );
            }
          }

        } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
          // Count only same-type groups (PHYSICAL and JUDICIAL namespaces are separate).
          const counts = await tx
            .select({
              poId: groupMember.principalObjectId,
              n:    sql<number>`count(DISTINCT ${groupMember.groupId})::int`,
            })
            .from(groupMember)
            .innerJoin(groups, eq(groups.id, groupMember.groupId))
            .where(
              and(
                inArray(groupMember.principalObjectId, toAddPoIds),
                ne(groupMember.groupId, id),
                eq(groups.targetType, targetType),
              ),
            )
            .groupBy(groupMember.principalObjectId);
          const countByPoId = new Map(counts.map((c) => [c.poId, c.n]));

          for (const eid of toAdd) {
            const poId = entityPoMap.get(eid);
            if ((countByPoId.get(poId ?? "") ?? 0) >= MAX_GROUPS_PER_ITEM) {
              throw new GroupError(
                `A person cannot belong to more than ${MAX_GROUPS_PER_ITEM} groups of the same type`,
                409,
              );
            }
          }

        } else if (targetType === "DOCUMENT") {
          const counts = await tx
            .select({
              poId: groupMember.principalObjectId,
              n:    sql<number>`count(DISTINCT ${groupMember.groupId})::int`,
            })
            .from(groupMember)
            .where(and(inArray(groupMember.principalObjectId, toAddPoIds), ne(groupMember.groupId, id)))
            .groupBy(groupMember.principalObjectId);
          const countByPoId = new Map(counts.map((c) => [c.poId, c.n]));

          for (const eid of toAdd) {
            const poId = entityPoMap.get(eid);
            if ((countByPoId.get(poId ?? "") ?? 0) >= MAX_GROUPS_PER_ITEM) {
              throw new GroupError(
                `A document cannot belong to more than ${MAX_GROUPS_PER_ITEM} groups`,
                409,
              );
            }
          }
        }
      }

      // ------------------------------------------------------------------
      // Apply removes
      // ------------------------------------------------------------------
      if (toRemovePoIds.length > 0) {
        await tx.delete(groupMember).where(
          and(eq(groupMember.groupId, id), inArray(groupMember.principalObjectId, toRemovePoIds)),
        );
      }

      // ------------------------------------------------------------------
      // Apply adds (allocate positions from the high-water counter)
      // ------------------------------------------------------------------
      if (toAddPoIds.length > 0) {
        let pos = g.lastPosition;
        const values = toAdd.map((eid) => {
          pos += 1;
          return { groupId: id, principalObjectId: entityPoMap.get(eid)!, position: pos };
        });
        await tx.insert(groupMember).values(values);
        await tx.update(groups).set({ lastPosition: pos }).where(eq(groups.id, id));
      }
    }
  });

  return getGroupDetail(id);
}

// ---------------------------------------------------------------------------
// Delete (soft) — Slice #19.30: sets deleted_at instead of hard-deleting.
// group_member rows are kept; the group simply disappears from all lists.
// ---------------------------------------------------------------------------

export async function deleteGroup(id: string): Promise<boolean> {
  const r = await db
    .update(groups)
    .set({ deletedAt: sql`NOW()` })
    .where(and(eq(groups.id, id), isNull(groups.deletedAt)))
    .returning({ id: groups.id });
  return r.length > 0;
}

// ---------------------------------------------------------------------------
// Group tags for a property — for the [code position] badges on the property
// detail page.  Accepts the property's principal_object_id (not property.id).
// ---------------------------------------------------------------------------

export async function listPropertyGroupTags(principalObjectId: string): Promise<GroupTag[]> {
  // Slice #19.30: exclude soft-deleted groups from tag badges.
  const rows = await db
    .select({ code: groups.code, position: groupMember.position })
    .from(groupMember)
    .innerJoin(groups, eq(groups.id, groupMember.groupId))
    .where(and(eq(groupMember.principalObjectId, principalObjectId), isNull(groups.deletedAt)))
    .orderBy(asc(groups.code));
  return rows as GroupTag[];
}

// ---------------------------------------------------------------------------
// Enriched group tags for any entity — for the References tab.
// Accepts the entity's principal_object_id directly (no branching needed).
// Returns { code, position, description } for all groups the item belongs to.
// ---------------------------------------------------------------------------

export type GroupEntityTag = { id: string; code: string; position: number; description: string };

export async function listEntityGroupTags(principalObjectId: string): Promise<GroupEntityTag[]> {
  // Slice #19.30: exclude soft-deleted groups from the References tab.
  const rows = await db
    .select({
      id:          groups.id,
      code:        groups.code,
      position:    groupMember.position,
      description: groups.description,
    })
    .from(groupMember)
    .innerJoin(groups, eq(groups.id, groupMember.groupId))
    .where(and(eq(groupMember.principalObjectId, principalObjectId), isNull(groups.deletedAt)))
    .orderBy(asc(groups.code));
  return rows as GroupEntityTag[];
}

// ---------------------------------------------------------------------------
// Group codes by target type — for list-page "Groups" filter dropdowns
// ---------------------------------------------------------------------------

/** All PROPERTY-target group codes, ascending. Includes empty groups. */
export async function listPropertyGroupCodes(): Promise<string[]> {
  const rows = await db
    .select({ code: groups.code })
    .from(groups)
    .where(and(eq(groups.targetType, "PROPERTY"), isNull(groups.deletedAt)))
    .orderBy(asc(groups.code));
  return rows.map((r) => r.code);
}

/**
 * All PHYSICAL_PERSON- and JUDICIAL_PERSON-target group codes, ascending.
 * Both are returned together for the unified Persons list filter.
 */
export async function listPersonGroupCodes(): Promise<string[]> {
  const rows = await db
    .select({ code: groups.code })
    .from(groups)
    .where(
      and(
        sql`${groups.targetType} IN ('PHYSICAL_PERSON', 'JUDICIAL_PERSON')`,
        isNull(groups.deletedAt),
      ),
    )
    .orderBy(asc(groups.code));
  return rows.map((r) => r.code);
}

/** All DOCUMENT-target group codes, ascending. Includes empty groups. */
export async function listDocumentGroupCodes(): Promise<string[]> {
  const rows = await db
    .select({ code: groups.code })
    .from(groups)
    .where(and(eq(groups.targetType, "DOCUMENT"), isNull(groups.deletedAt)))
    .orderBy(asc(groups.code));
  return rows.map((r) => r.code);
}

// ---------------------------------------------------------------------------
// Group membership for list-page filtering
// ---------------------------------------------------------------------------

/** (propertyId, group code) pairs for every non-deleted property that is a
 *  member of a PROPERTY-target group. */
export async function listPropertyGroupMemberships(): Promise<
  { propertyId: string; code: string }[]
> {
  const rows = await db
    .select({ propertyId: property.id, code: groups.code })
    .from(groupMember)
    .innerJoin(groups, eq(groups.id, groupMember.groupId))
    .innerJoin(
      property,
      and(
        eq(property.principalObjectId, groupMember.principalObjectId),
        isNull(property.deletedAt),
      ),
    )
    .where(and(eq(groups.targetType, "PROPERTY"), isNull(groups.deletedAt)));
  return rows;
}

/**
 * (personId, group code) pairs for every non-deleted person that is a member
 * of a PHYSICAL_PERSON or JUDICIAL_PERSON group.
 */
export async function listPersonGroupMemberships(): Promise<
  { personId: string; code: string }[]
> {
  const rows = await db
    .select({ personId: person.id, code: groups.code })
    .from(groupMember)
    .innerJoin(groups, eq(groups.id, groupMember.groupId))
    .innerJoin(
      person,
      and(
        eq(person.principalObjectId, groupMember.principalObjectId),
        isNull(person.deletedAt),
      ),
    )
    .where(
      sql`${groups.targetType} IN ('PHYSICAL_PERSON', 'JUDICIAL_PERSON')`,
    );
  return rows;
}

/** (documentId, group code) pairs for every non-deleted document that is a
 *  member of a DOCUMENT-target group. */
export async function listDocumentGroupMemberships(): Promise<
  { documentId: string; code: string }[]
> {
  const rows = await db
    .select({ documentId: document.id, code: groups.code })
    .from(groupMember)
    .innerJoin(groups, eq(groups.id, groupMember.groupId))
    .innerJoin(
      document,
      and(
        eq(document.principalObjectId, groupMember.principalObjectId),
        isNull(document.deletedAt),
      ),
    )
    .where(eq(groups.targetType, "DOCUMENT"));
  return rows;
}

// Re-export so consumers don't reach across files for the cap.
export { MAX_GROUPS_PER_PROPERTY };
