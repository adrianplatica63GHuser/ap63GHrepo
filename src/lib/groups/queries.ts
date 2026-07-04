/**
 * DB query helpers for the Groups API  (Slice #18.07, extended Slice #18.17)
 *
 * A Group gathers items of a single target type. As of Slice #18.17, all four
 * target types are wired: PROPERTY, PHYSICAL_PERSON, JUDICIAL_PERSON, DOCUMENT.
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
 * `memberId` is the FK value relevant to the group's target type
 * (propertyId / personId / documentId).
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

  // Each target type has its own member-count subquery because it joins a
  // different entity table (with its own deleted_at guard).
  const memberCount = sql<number>`(
    SELECT count(*)::int
    FROM ${groupMember} gm
    WHERE gm.group_id = groups.id
      AND (
        -- PROPERTY
        (gm.property_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM ${property} p WHERE p.id = gm.property_id AND p.deleted_at IS NULL
        ))
        -- PHYSICAL_PERSON / JUDICIAL_PERSON
        OR (gm.person_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM ${person} pe WHERE pe.id = gm.person_id AND pe.deleted_at IS NULL
        ))
        -- DOCUMENT
        OR (gm.document_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM ${document} d WHERE d.id = gm.document_id AND d.deleted_at IS NULL
        ))
      )
  )`;

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
    ? await query.where(eq(groups.targetType, targetType))
    : await query;

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
  const [g] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!g) return null;

  const targetType = g.targetType as GroupTargetType;

  // ------------------------------------------------------------------
  // Members
  // ------------------------------------------------------------------
  let members: GroupMemberItem[] = [];

  if (targetType === "PROPERTY") {
    const rows = await db
      .select({
        memberId: groupMember.propertyId,
        position: groupMember.position,
        code:     property.code,
        nickname: property.nickname,
      })
      .from(groupMember)
      .innerJoin(
        property,
        and(eq(property.id, groupMember.propertyId), isNull(property.deletedAt)),
      )
      .where(eq(groupMember.groupId, id))
      .orderBy(asc(groupMember.position));

    members = rows.map((r) => ({
      memberId:     r.memberId!,
      position:     r.position,
      displayLabel: propLabel(r.code, r.nickname),
    }));

  } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
    const personType = targetType === "PHYSICAL_PERSON" ? "NATURAL" : "JUDICIAL";
    const rows = await db
      .select({
        memberId:    groupMember.personId,
        position:    groupMember.position,
        displayName: person.displayName,
        code:        person.code,
      })
      .from(groupMember)
      .innerJoin(
        person,
        and(
          eq(person.id, groupMember.personId),
          isNull(person.deletedAt),
          eq(person.type, personType),
        ),
      )
      .where(eq(groupMember.groupId, id))
      .orderBy(asc(groupMember.position));

    members = rows.map((r) => ({
      memberId:     r.memberId!,
      position:     r.position,
      displayLabel: r.displayName?.trim() || r.code,
    }));

  } else if (targetType === "DOCUMENT") {
    const rows = await db
      .select({
        memberId: groupMember.documentId,
        position: groupMember.position,
        title:    document.title,
        code:     document.code,
      })
      .from(groupMember)
      .innerJoin(
        document,
        and(eq(document.id, groupMember.documentId), isNull(document.deletedAt)),
      )
      .where(eq(groupMember.groupId, id))
      .orderBy(asc(groupMember.position));

    members = rows.map((r) => ({
      memberId:     r.memberId!,
      position:     r.position,
      displayLabel: r.title?.trim() || r.code,
    }));
  }

  // ------------------------------------------------------------------
  // Candidates
  // ------------------------------------------------------------------
  let candidates: GroupCandidate[] = [];

  if (targetType === "PROPERTY") {
    // NOTE: Drizzle renders ${property.id} unqualified inside these correlated
    // subqueries; use literal qualified name `property.id` instead.
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

    candidates = (rows as (typeof rows[0] & { otherGroupCount: number })[])
      .filter((r) => r.otherGroupCount < MAX_GROUPS_PER_PROPERTY)
      .map((r) => ({
        id:              r.id,
        displayLabel:    propLabel(r.code, r.nickname),
        otherGroupCount: r.otherGroupCount,
      }));

  } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
    const personType = targetType === "PHYSICAL_PERSON" ? "NATURAL" : "JUDICIAL";

    // Count other SAME-type groups the person belongs to (different target types
    // are separate namespaces, so a PERS-XX physical group doesn't count against
    // a PERS-YY judicial group and vice versa).
    const otherGroupCount = sql<number>`(
      SELECT count(DISTINCT gm.group_id)::int
      FROM ${groupMember} gm
      JOIN ${groups} g2 ON g2.id = gm.group_id
      WHERE gm.person_id = person.id
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
            SELECT 1 FROM ${groupMember} gm2
            WHERE gm2.group_id = ${id} AND gm2.person_id = person.id
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
      FROM ${groupMember} gm
      WHERE gm.document_id = document.id AND gm.group_id <> ${id}
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
            SELECT 1 FROM ${groupMember} gm2
            WHERE gm2.group_id = ${id} AND gm2.document_id = document.id
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
    const [g] = await tx.select().from(groups).where(eq(groups.id, id)).limit(1);
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
      // Resolve current member ids (type-appropriate FK column)
      // ------------------------------------------------------------------
      let current: string[] = [];
      if (targetType === "PROPERTY") {
        const rows = await tx
          .select({ propertyId: groupMember.propertyId })
          .from(groupMember)
          .where(eq(groupMember.groupId, id));
        current = rows.map((r) => r.propertyId).filter((p): p is string => p !== null);

      } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
        const rows = await tx
          .select({ personId: groupMember.personId })
          .from(groupMember)
          .where(eq(groupMember.groupId, id));
        current = rows.map((r) => r.personId).filter((p): p is string => p !== null);

      } else if (targetType === "DOCUMENT") {
        const rows = await tx
          .select({ documentId: groupMember.documentId })
          .from(groupMember)
          .where(eq(groupMember.groupId, id));
        current = rows.map((r) => r.documentId).filter((d): d is string => d !== null);
      }

      const { toAdd, toRemove } = computeMemberDelta(current, input.memberIds);

      // ------------------------------------------------------------------
      // Enforce the per-item group cap on new additions
      // ------------------------------------------------------------------
      if (toAdd.length > 0) {
        if (targetType === "PROPERTY") {
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

        } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
          // Count OTHER same-type groups (PERS- physical and judicial are separate namespaces).
          const counts = await tx
            .select({
              personId: groupMember.personId,
              n: sql<number>`count(DISTINCT ${groupMember.groupId})::int`,
            })
            .from(groupMember)
            .innerJoin(groups, eq(groups.id, groupMember.groupId))
            .where(
              and(
                inArray(groupMember.personId, toAdd),
                ne(groupMember.groupId, id),
                eq(groups.targetType, targetType),
              ),
            )
            .groupBy(groupMember.personId);
          const countById = new Map(counts.map((c) => [c.personId, c.n]));
          for (const pid of toAdd) {
            if ((countById.get(pid) ?? 0) >= MAX_GROUPS_PER_ITEM) {
              throw new GroupError(
                `A person cannot belong to more than ${MAX_GROUPS_PER_ITEM} groups of the same type`,
                409,
              );
            }
          }

        } else if (targetType === "DOCUMENT") {
          const counts = await tx
            .select({
              documentId: groupMember.documentId,
              n: sql<number>`count(DISTINCT ${groupMember.groupId})::int`,
            })
            .from(groupMember)
            .where(and(inArray(groupMember.documentId, toAdd), ne(groupMember.groupId, id)))
            .groupBy(groupMember.documentId);
          const countById = new Map(counts.map((c) => [c.documentId, c.n]));
          for (const did of toAdd) {
            if ((countById.get(did) ?? 0) >= MAX_GROUPS_PER_ITEM) {
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
      if (toRemove.length > 0) {
        if (targetType === "PROPERTY") {
          await tx.delete(groupMember).where(
            and(eq(groupMember.groupId, id), inArray(groupMember.propertyId, toRemove)),
          );
        } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
          await tx.delete(groupMember).where(
            and(eq(groupMember.groupId, id), inArray(groupMember.personId, toRemove)),
          );
        } else if (targetType === "DOCUMENT") {
          await tx.delete(groupMember).where(
            and(eq(groupMember.groupId, id), inArray(groupMember.documentId, toRemove)),
          );
        }
      }

      // ------------------------------------------------------------------
      // Apply adds (allocate positions from the high-water counter)
      // ------------------------------------------------------------------
      if (toAdd.length > 0) {
        let pos = g.lastPosition;
        const values = toAdd.map((memberId) => {
          pos += 1;
          if (targetType === "PROPERTY") {
            return { groupId: id, propertyId: memberId, position: pos };
          } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
            return { groupId: id, personId: memberId, position: pos };
          } else {
            return { groupId: id, documentId: memberId, position: pos };
          }
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
// Enriched group tags for any entity — for the References tab.
// Returns { code, position, description } for all groups the item belongs to.
// ---------------------------------------------------------------------------

export type GroupEntityTag = { code: string; position: number; description: string };

export async function listEntityGroupTags(opts: {
  propertyId?: string;
  personId?: string;
  documentId?: string;
}): Promise<GroupEntityTag[]> {
  const base = db
    .select({ code: groups.code, position: groupMember.position, description: groups.description })
    .from(groupMember)
    .innerJoin(groups, eq(groups.id, groupMember.groupId));

  let rows: { code: string; position: number; description: string }[];

  if (opts.propertyId) {
    rows = await base.where(eq(groupMember.propertyId, opts.propertyId)).orderBy(asc(groups.code));
  } else if (opts.personId) {
    rows = await base.where(eq(groupMember.personId, opts.personId)).orderBy(asc(groups.code));
  } else if (opts.documentId) {
    rows = await base.where(eq(groupMember.documentId, opts.documentId)).orderBy(asc(groups.code));
  } else {
    rows = [];
  }

  return rows as GroupEntityTag[];
}

// ---------------------------------------------------------------------------
// Group codes by target type — for list-page "Groups" filter dropdowns
// (Slice #18.17)
// ---------------------------------------------------------------------------

/** All PROPERTY-target group codes, ascending. Includes empty groups. */
export async function listPropertyGroupCodes(): Promise<string[]> {
  const rows = await db
    .select({ code: groups.code })
    .from(groups)
    .where(eq(groups.targetType, "PROPERTY"))
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
      sql`${groups.targetType} IN ('PHYSICAL_PERSON', 'JUDICIAL_PERSON')`,
    )
    .orderBy(asc(groups.code));
  return rows.map((r) => r.code);
}

/** All DOCUMENT-target group codes, ascending. Includes empty groups. */
export async function listDocumentGroupCodes(): Promise<string[]> {
  const rows = await db
    .select({ code: groups.code })
    .from(groups)
    .where(eq(groups.targetType, "DOCUMENT"))
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

/**
 * (personId, group code) pairs for every non-deleted person that is a member
 * of a PHYSICAL_PERSON or JUDICIAL_PERSON group. Used by the Persons list
 * filter. The group code carries the PERS- prefix so the client can match it
 * directly against the codes returned by listPersonGroupCodes().
 */
export async function listPersonGroupMemberships(): Promise<
  { personId: string; code: string }[]
> {
  const rows = await db
    .select({ personId: groupMember.personId, code: groups.code })
    .from(groupMember)
    .innerJoin(groups, eq(groups.id, groupMember.groupId))
    .innerJoin(
      person,
      and(eq(person.id, groupMember.personId), isNull(person.deletedAt)),
    )
    .where(
      sql`${groups.targetType} IN ('PHYSICAL_PERSON', 'JUDICIAL_PERSON')`,
    );
  return rows.filter(
    (r): r is { personId: string; code: string } => r.personId !== null,
  );
}

/** (documentId, group code) pairs for every non-deleted document that is a
 *  member of a DOCUMENT-target group. */
export async function listDocumentGroupMemberships(): Promise<
  { documentId: string; code: string }[]
> {
  const rows = await db
    .select({ documentId: groupMember.documentId, code: groups.code })
    .from(groupMember)
    .innerJoin(groups, eq(groups.id, groupMember.groupId))
    .innerJoin(
      document,
      and(eq(document.id, groupMember.documentId), isNull(document.deletedAt)),
    )
    .where(eq(groups.targetType, "DOCUMENT"));
  return rows.filter(
    (r): r is { documentId: string; code: string } => r.documentId !== null,
  );
}

// Re-export so consumers don't reach across files for the cap.
export { MAX_GROUPS_PER_PROPERTY };
