/**
 * DB query helpers for the Stamps API  (Slice #19.09.Stamps)
 *
 * A Stamp can be applied to items of any target type (PHYSICAL_PERSON,
 * JUDICIAL_PERSON, PROPERTY, DOCUMENT).  There is no per-item cap and no
 * position ordering — membership is a simple set.
 *
 * Codes: STMP-AAA … STMP-ZZZ, allocated from `stamp_code_seq`, never reused.
 * Display name: "{code} - {shortDescription}"
 */

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { document, person, property, stampMember, stamps } from "@/db/schema";
import { encodeFullStampCode } from "./code";
import type { StampCreate, StampMemberChangeEntry, StampTargetType, StampUpdate } from "./validation";

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
  const memberCount = sql<number>`(
    SELECT count(*)::int FROM ${stampMember} sm WHERE sm.stamp_id = stamps.id
  )`;

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
  const [s] = await db
    .select()
    .from(stamps)
    .where(eq(stamps.id, id))
    .limit(1);
  if (!s) return null;

  // ── Members for this type ────────────────────────────────────────────────
  let members: StampMemberItem[] = [];

  if (targetType === "PROPERTY") {
    const rows = await db
      .select({
        memberId: stampMember.propertyId,
        code:     property.code,
        nickname: property.nickname,
      })
      .from(stampMember)
      .innerJoin(
        property,
        and(eq(property.id, stampMember.propertyId), isNull(property.deletedAt)),
      )
      .where(
        and(eq(stampMember.stampId, id), eq(stampMember.targetType, "PROPERTY")),
      )
      .orderBy(asc(property.code));

    members = rows.map((r) => ({
      memberId:     r.memberId!,
      displayLabel: propLabel(r.code, r.nickname),
    }));

  } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
    const personType = targetType === "PHYSICAL_PERSON" ? "NATURAL" : "JUDICIAL";
    const rows = await db
      .select({
        memberId:    stampMember.personId,
        displayName: person.displayName,
        code:        person.code,
      })
      .from(stampMember)
      .innerJoin(
        person,
        and(
          eq(person.id, stampMember.personId),
          isNull(person.deletedAt),
          eq(person.type, personType),
        ),
      )
      .where(
        and(eq(stampMember.stampId, id), eq(stampMember.targetType, targetType)),
      )
      .orderBy(asc(person.displayName));

    members = rows.map((r) => ({
      memberId:     r.memberId!,
      displayLabel: r.displayName?.trim() || r.code,
    }));

  } else if (targetType === "DOCUMENT") {
    const rows = await db
      .select({
        memberId: stampMember.documentId,
        title:    document.title,
        code:     document.code,
      })
      .from(stampMember)
      .innerJoin(
        document,
        and(eq(document.id, stampMember.documentId), isNull(document.deletedAt)),
      )
      .where(
        and(eq(stampMember.stampId, id), eq(stampMember.targetType, "DOCUMENT")),
      )
      .orderBy(asc(document.code));

    members = rows.map((r) => ({
      memberId:     r.memberId!,
      displayLabel: r.title?.trim() || r.code,
    }));
  }

  // ── Candidates for this type — items NOT yet stamped with this stamp ─────
  let candidates: StampCandidate[] = [];

  if (targetType === "PROPERTY") {
    const rows = await db
      .select({ id: property.id, code: property.code, nickname: property.nickname })
      .from(property)
      .where(
        and(
          isNull(property.deletedAt),
          sql`NOT EXISTS (
            SELECT 1 FROM ${stampMember} sm2
            WHERE sm2.stamp_id = ${id}
              AND sm2.property_id = property.id
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
            SELECT 1 FROM ${stampMember} sm2
            WHERE sm2.stamp_id = ${id}
              AND sm2.person_id = person.id
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
            SELECT 1 FROM ${stampMember} sm2
            WHERE sm2.stamp_id = ${id}
              AND sm2.document_id = document.id
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
  const [s] = await db
    .select({ id: stamps.id })
    .from(stamps)
    .where(eq(stamps.id, id))
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

  // ── Removes ───────────────────────────────────────────────────────────────
  if (toRemove.length > 0) {
    if (targetType === "PROPERTY") {
      await tx
        .delete(stampMember)
        .where(
          and(
            eq(stampMember.stampId, stampId),
            inArray(stampMember.propertyId, toRemove),
          ),
        );
    } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
      await tx
        .delete(stampMember)
        .where(
          and(
            eq(stampMember.stampId, stampId),
            eq(stampMember.targetType, targetType),
            inArray(stampMember.personId, toRemove),
          ),
        );
    } else if (targetType === "DOCUMENT") {
      await tx
        .delete(stampMember)
        .where(
          and(
            eq(stampMember.stampId, stampId),
            inArray(stampMember.documentId, toRemove),
          ),
        );
    }
  }

  // ── Adds ──────────────────────────────────────────────────────────────────
  if (toAdd.length > 0) {
    const values = toAdd.map((memberId) => {
      if (targetType === "PROPERTY") {
        return { stampId, targetType, propertyId: memberId };
      } else if (targetType === "PHYSICAL_PERSON" || targetType === "JUDICIAL_PERSON") {
        return { stampId, targetType, personId: memberId };
      } else {
        return { stampId, targetType, documentId: memberId };
      }
    });
    await tx.insert(stampMember).values(values).onConflictDoNothing();
  }
}

// ---------------------------------------------------------------------------
// Delete — cascades to stamp_member.
// ---------------------------------------------------------------------------

export async function deleteStamp(id: string): Promise<boolean> {
  const r = await db
    .delete(stamps)
    .where(eq(stamps.id, id))
    .returning({ id: stamps.id });
  return r.length > 0;
}

// ---------------------------------------------------------------------------
// Stamp tags for an entity — e.g. for badges on detail pages.
// ---------------------------------------------------------------------------

export async function listEntityStampCodes(opts: {
  propertyId?: string;
  personId?: string;
  documentId?: string;
}): Promise<string[]> {
  let rows: { code: string }[] = [];

  if (opts.propertyId) {
    rows = await db
      .select({ code: stamps.code })
      .from(stampMember)
      .innerJoin(stamps, eq(stamps.id, stampMember.stampId))
      .where(eq(stampMember.propertyId, opts.propertyId))
      .orderBy(asc(stamps.code));
  } else if (opts.personId) {
    rows = await db
      .select({ code: stamps.code })
      .from(stampMember)
      .innerJoin(stamps, eq(stamps.id, stampMember.stampId))
      .where(eq(stampMember.personId, opts.personId))
      .orderBy(asc(stamps.code));
  } else if (opts.documentId) {
    rows = await db
      .select({ code: stamps.code })
      .from(stampMember)
      .innerJoin(stamps, eq(stamps.id, stampMember.stampId))
      .where(eq(stampMember.documentId, opts.documentId))
      .orderBy(asc(stamps.code));
  }

  return rows.map((r) => r.code);
}
