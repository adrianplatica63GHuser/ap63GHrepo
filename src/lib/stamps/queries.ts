/**
 * DB query helpers for the Stamps API  (Slice #19.09.Stamps)
 *
 * A Stamp can be applied to items of any target type (PHYSICAL_PERSON,
 * JUDICIAL_PERSON, PROPERTY, DOCUMENT).  There is no per-item cap and no
 * position ordering — membership is a simple set.
 *
 * Codes: STMP-AAA … STMP-ZZZ, allocated from `stamp_code_seq`, never reused.
 * Display name: "{code} - {shortDescription}"
 *
 * As of migration_051, stamp_member stores a single `principal_object_id` FK
 * instead of the old nullable triple (property_id, person_id, document_id).
 * The `target_type` column is kept to distinguish PHYSICAL_PERSON from
 * JUDICIAL_PERSON (since principal_object.object_type only has PERSON).
 */

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  document,
  person,
  property,
  stampMember,
  stamps,
} from "@/db/schema";
import { encodeFullStampCode } from "./code";
import type {
  StampCreate,
  StampMemberChangeEntry,
  StampTargetType,
  StampUpdate,
} from "./validation";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class StampError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StampError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type StampListItem = {
  id:               string;
  code:             string;
  shortDescription: string;
  notes:            string | null;
  memberCount:      number;
  createdAt:        Date;
};

export type StampMemberItem = {
  memberId:     string;
  displayLabel: string;
};

export type StampCandidate = {
  id:           string;
  displayLabel: string;
};

export type StampDetail = {
  id:               string;
  code:             string;
  shortDescription: string;
  notes:            string | null;
  targetType:       StampTargetType;   // the type currently being viewed
  members:          StampMemberItem[]; // stamped items of targetType
  candidates:       StampCandidate[];  // un-stamped items of targetType
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function propLabel(code: string, nickname: string | null): string {
  return nickname?.trim() || code;
}

// ---------------------------------------------------------------------------
// List — most-recent first, with total member count across all target types.
// ---------------------------------------------------------------------------

export async function listStamps(): Promise<StampListItem[]> {
  // stamp_member has a single principal_object_id — count is straightforward.
  const memberCount = sql<number>`(
    SELECT count(*)::int FROM stamp_member sm WHERE sm.stamp_id = stamps.id
  )`;

  // Slice #19.30: exclude soft-deleted stamps.
  const rows = await db
    .select({
      id:               stamps.id,
      code:             stamps.code,
      shortDescription: stamps.shortDescription,
      notes:            stamps.notes,
      memberCount,
      createdAt:        stamps.createdAt,
    })
    .from(stamps)
    .where(isNull(stamps.deletedAt))
    .orderBy(desc(stamps.createdAt));

  return rows as StampListItem[];
}

// ---------------------------------------------------------------------------
// Create — allocate next code from sequence, insert stamp.
// ---------------------------------------------------------------------------

export async function createStamp(input: StampCreate): Promise<StampListItem> {
  return db.transaction(async (tx) => {
    const seqRes = await tx.execute(
      sql`SELECT nextval('stamp_code_seq')::int AS n`,
    );
    const n = (seqRes.rows[0] as { n: number }).n;
    const code = encodeFullStampCode(n);

    const [row] = await tx
      .insert(stamps)
      .values({
        code,
        shortDescription: input.shortDescription,
        notes:            input.notes ?? null,
      })
      .returning();

    return {
      id:               row.id,
      code:             row.code,
      shortDescription: row.shortDescription,
      notes:            row.notes,
      memberCount:      0,
      createdAt:        row.createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Get detail — stamp fields + members + candidates for one target type.
// ---------------------------------------------------------------------------

export async function getStampDetail(
  id: string,
  targetType: StampTargetType,
): Promise<StampDetail | null> {
  // Slice #19.30: treat soft-deleted stamps as not found.
  const [s] = await db
    .select()
    .from(stamps)
    .where(and(eq(stamps.id, id), isNull(stamps.deletedAt)))
    .limit(1);
  if (!s) return null;

  // ── Members for this type ────────────────────────────────────────────────
  // Join via entity.principal_object_id = stamp_member.principal_object_id.
  let members: StampMemberItem[] = [];

  if (targetType === "PROPERTY") {
    const rows = await db
      .select({
        memberId: property.id,
        code:     property.code,
        nickname: property.nickname,
      })
      .from(stampMember)
      .innerJoin(
        property,
        and(
          eq(property.principalObjectId, stampMember.principalObjectId),
          isNull(property.deletedAt),
        ),
      )
      .where(
        and(eq(stampMember.stampId, id), eq(stampMember.targetType, "PROPERTY")),
      )
      .orderBy(asc(property.code));

    members = rows.map((r) => ({
      memberId:     r.memberId,
      displayLabel: propLabel(r.code, r.nickname),
    }));

  } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
    const personType = targetType === "PHYSICAL_PERSON" ? "NATURAL" : "JUDICIAL";
    const rows = await db
      .select({
        memberId:    person.id,
        displayName: person.displayName,
        code:        person.code,
      })
      .from(stampMember)
      .innerJoin(
        person,
        and(
          eq(person.principalObjectId, stampMember.principalObjectId),
          isNull(person.deletedAt),
          eq(person.type, personType),
        ),
      )
      .where(
        and(eq(stampMember.stampId, id), eq(stampMember.targetType, targetType)),
      )
      .orderBy(asc(person.displayName));

    members = rows.map((r) => ({
      memberId:     r.memberId,
      displayLabel: r.displayName?.trim() || r.code,
    }));

  } else if (targetType === "DOCUMENT") {
    const rows = await db
      .select({
        memberId: document.id,
        title:    document.title,
        code:     document.code,
      })
      .from(stampMember)
      .innerJoin(
        document,
        and(
          eq(document.principalObjectId, stampMember.principalObjectId),
          isNull(document.deletedAt),
        ),
      )
      .where(
        and(eq(stampMember.stampId, id), eq(stampMember.targetType, "DOCUMENT")),
      )
      .orderBy(asc(document.code));

    members = rows.map((r) => ({
      memberId:     r.memberId,
      displayLabel: r.title?.trim() || r.code,
    }));
  }

  // ── Candidates — items NOT yet stamped with this stamp ───────────────────
  // Correlated NOT EXISTS uses literal qualified column names to avoid the
  // Drizzle unqualified-column gotcha (CLAUDE.md): ${table.col} inside a
  // correlated sql`` subquery emits a bare column name that Postgres may
  // reject as ambiguous. Write the outer table reference as a literal string.
  let candidates: StampCandidate[] = [];

  if (targetType === "PROPERTY") {
    const rows = await db
      .select({ id: property.id, code: property.code, nickname: property.nickname })
      .from(property)
      .where(
        and(
          isNull(property.deletedAt),
          sql`NOT EXISTS (
            SELECT 1 FROM stamp_member sm2
            WHERE sm2.stamp_id = ${id}
              AND sm2.principal_object_id = property.principal_object_id
          )`,
        ),
      )
      .orderBy(desc(sql`greatest(${property.updatedAt}, ${property.createdAt})`));

    candidates = rows.map((r) => ({
      id:           r.id,
      displayLabel: propLabel(r.code, r.nickname),
    }));

  } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
    const personType = targetType === "PHYSICAL_PERSON" ? "NATURAL" : "JUDICIAL";
    const rows = await db
      .select({ id: person.id, displayName: person.displayName, code: person.code })
      .from(person)
      .where(
        and(
          isNull(person.deletedAt),
          eq(person.type, personType),
          sql`NOT EXISTS (
            SELECT 1 FROM stamp_member sm2
            WHERE sm2.stamp_id = ${id}
              AND sm2.principal_object_id = person.principal_object_id
          )`,
        ),
      )
      .orderBy(desc(sql`greatest(${person.updatedAt}, ${person.createdAt})`));

    candidates = rows.map((r) => ({
      id:           r.id,
      displayLabel: r.displayName?.trim() || r.code,
    }));

  } else if (targetType === "DOCUMENT") {
    const rows = await db
      .select({ id: document.id, title: document.title, code: document.code })
      .from(document)
      .where(
        and(
          isNull(document.deletedAt),
          sql`NOT EXISTS (
            SELECT 1 FROM stamp_member sm2
            WHERE sm2.stamp_id = ${id}
              AND sm2.principal_object_id = document.principal_object_id
          )`,
        ),
      )
      .orderBy(desc(sql`greatest(${document.updatedAt}, ${document.createdAt})`));

    candidates = rows.map((r) => ({
      id:           r.id,
      displayLabel: r.title?.trim() || r.code,
    }));
  }

  return {
    id:               s.id,
    code:             s.code,
    shortDescription: s.shortDescription,
    notes:            s.notes,
    targetType,
    members,
    candidates,
  };
}

// ---------------------------------------------------------------------------
// Update — patch shortDescription/notes and/or apply member changes.
// ---------------------------------------------------------------------------

export async function updateStamp(
  id: string,
  input: StampUpdate,
): Promise<boolean> {
  // Slice #19.30: treat soft-deleted stamps as not found.
  const [s] = await db
    .select({ id: stamps.id })
    .from(stamps)
    .where(and(eq(stamps.id, id), isNull(stamps.deletedAt)))
    .limit(1);
  if (!s) return false;

  await db.transaction(async (tx) => {
    // ── Patch metadata fields ──────────────────────────────────────────────
    const patch: Partial<{ shortDescription: string; notes: string | null }> = {};
    if (input.shortDescription !== undefined) {
      patch.shortDescription = input.shortDescription;
    }
    if (input.notes !== undefined) {
      patch.notes = input.notes ?? null;
    }
    if (Object.keys(patch).length > 0) {
      await tx.update(stamps).set(patch).where(eq(stamps.id, id));
    }

    // ── Apply member changes (per target type) ─────────────────────────────
    for (const change of input.memberChanges ?? []) {
      await applyMemberChange(tx, id, change);
    }
  });

  return true;
}

async function applyMemberChange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  stampId: string,
  change: StampMemberChangeEntry,
): Promise<void> {
  const { targetType, toAdd, toRemove } = change;

  // Translate entity IDs → principal_object_ids once, reuse for removes + adds.
  const allEntityIds = [...toAdd, ...toRemove];
  let entityPoMap = new Map<string, string>(); // entityId → principalObjectId

  if (allEntityIds.length > 0) {
    if (targetType === "PROPERTY") {
      const rows = await tx
        .select({ entityId: property.id, poId: property.principalObjectId })
        .from(property)
        .where(inArray(property.id, allEntityIds));
      entityPoMap = new Map(rows.map((r: { entityId: string; poId: string }) => [r.entityId, r.poId]));

    } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
      const rows = await tx
        .select({ entityId: person.id, poId: person.principalObjectId })
        .from(person)
        .where(inArray(person.id, allEntityIds));
      entityPoMap = new Map(rows.map((r: { entityId: string; poId: string }) => [r.entityId, r.poId]));

    } else if (targetType === "DOCUMENT") {
      const rows = await tx
        .select({ entityId: document.id, poId: document.principalObjectId })
        .from(document)
        .where(inArray(document.id, allEntityIds));
      entityPoMap = new Map(rows.map((r: { entityId: string; poId: string }) => [r.entityId, r.poId]));
    }
  }

  const toRemovePoIds = toRemove
    .map((eid) => entityPoMap.get(eid))
    .filter(Boolean) as string[];
  const toAddPoIds = toAdd
    .map((eid) => entityPoMap.get(eid))
    .filter(Boolean) as string[];

  // ── Removes ───────────────────────────────────────────────────────────────
  if (toRemovePoIds.length > 0) {
    await tx
      .delete(stampMember)
      .where(
        and(
          eq(stampMember.stampId, stampId),
          eq(stampMember.targetType, targetType),
          inArray(stampMember.principalObjectId, toRemovePoIds),
        ),
      );
  }

  // ── Adds ──────────────────────────────────────────────────────────────────
  if (toAddPoIds.length > 0) {
    const values = toAddPoIds.map((poId) => ({
      stampId,
      targetType,
      principalObjectId: poId,
    }));
    await tx.insert(stampMember).values(values).onConflictDoNothing();
  }
}

// ---------------------------------------------------------------------------
// Delete (soft) — Slice #19.30: sets deleted_at instead of hard-deleting.
// stamp_member rows are kept; the stamp disappears from all lists.
// ---------------------------------------------------------------------------

export async function deleteStamp(id: string): Promise<boolean> {
  const r = await db
    .update(stamps)
    .set({ deletedAt: sql`NOW()` })
    .where(and(eq(stamps.id, id), isNull(stamps.deletedAt)))
    .returning({ id: stamps.id });
  return r.length > 0;
}

// ---------------------------------------------------------------------------
// Stamp tags for an entity — e.g. for badges / the References tab.
// Accepts the entity's principal_object_id directly (no branching needed).
// ---------------------------------------------------------------------------

/** Enriched stamp tag for the References tab (id + code + short description). */
export type StampEntityTag = { id: string; code: string; shortDescription: string };

export async function listEntityStampTags(
  principalObjectId: string,
): Promise<StampEntityTag[]> {
  // Slice #19.30: exclude soft-deleted stamps from the References tab.
  const rows = await db
    .select({
      id:               stamps.id,
      code:             stamps.code,
      shortDescription: stamps.shortDescription,
    })
    .from(stampMember)
    .innerJoin(stamps, eq(stamps.id, stampMember.stampId))
    .where(and(eq(stampMember.principalObjectId, principalObjectId), isNull(stamps.deletedAt)))
    .orderBy(asc(stamps.code));

  return rows;
}

export async function listEntityStampCodes(
  principalObjectId: string,
): Promise<string[]> {
  // Slice #19.30: exclude soft-deleted stamps.
  const rows = await db
    .select({ code: stamps.code })
    .from(stampMember)
    .innerJoin(stamps, eq(stamps.id, stampMember.stampId))
    .where(and(eq(stampMember.principalObjectId, principalObjectId), isNull(stamps.deletedAt)))
    .orderBy(asc(stamps.code));

  return rows.map((r) => r.code);
}

