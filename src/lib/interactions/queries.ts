/**
 * „Interacțiuni" — the log's queries.   (Slice #38.83)
 *
 * List (filtered, sorted, paged), read one, create, change, delete. The list filters every structured field and
 * sorts by every grid column; its search matches a person's name and the subject only. Description and internal note
 * are read and written, never filtered, sorted or searched on (§8.2) — `listWhere` is the one place a filter is
 * built, and `interactions-validation.test.ts` reads it to hold that. A change compares the `updated_at` it read: a
 * row changed since answers `conflict`, never overwritten (§7).
 */
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { document, interaction, interactionDocument, interactionTag, person } from "@/db/schema";
import type { InteractionInput, InteractionListQuery, InteractionUpdate } from "./validation";
import type { InteractionListItem, InteractionRecord } from "./model";

/** How many documents an interaction links — a subquery, so it filters and sorts as a column would. */
const documentCount = sql<number>`(SELECT count(*)::int FROM interaction_document d WHERE d.interaction_id = ${interaction.id})`;

/** The WHERE of the history: the structured fields only. Never `description`, never `internal_note` (§8.2). */
export function listWhere(f: InteractionListQuery): SQL | undefined {
  const pattern = f.q ? `%${f.q}%` : null;
  return and(
    f.from ? gte(interaction.occurredAt, new Date(f.from)) : undefined,
    f.to ? lte(interaction.occurredAt, new Date(f.to)) : undefined,
    f.channels ? inArray(interaction.channel, f.channels) : undefined,
    f.direction ? eq(interaction.direction, f.direction) : undefined,
    f.personId ? eq(interaction.personId, f.personId) : undefined,
    f.subject ? ilike(interaction.subject, `%${f.subject}%`) : undefined,
    f.hasDocuments === undefined ? undefined : f.hasDocuments ? sql`${documentCount} > 0` : sql`${documentCount} = 0`,
    f.statuses ? inArray(interaction.status, f.statuses) : undefined,
    pattern ? or(ilike(person.displayName, pattern), ilike(interaction.subject, pattern)) : undefined,
  );
}

const SORT_COLUMN = {
  occurredAt: interaction.occurredAt,
  channel: interaction.channel,
  direction: interaction.direction,
  person: person.displayName,
  subject: interaction.subject,
  documents: documentCount,
  status: interaction.status,
} as const;

const listColumns = {
  id: interaction.id,
  channel: interaction.channel,
  direction: interaction.direction,
  occurredAt: interaction.occurredAt,
  personId: interaction.personId,
  personName: person.displayName,
  personType: person.type,
  subject: interaction.subject,
  status: interaction.status,
  followUpOn: interaction.followUpOn,
  documentCount,
  updatedAt: interaction.updatedAt,
};

type ListRow = { [K in keyof typeof listColumns]: unknown };

function toListItem(r: ListRow): InteractionListItem {
  return {
    id: r.id as string,
    channel: r.channel as InteractionListItem["channel"],
    direction: r.direction as InteractionListItem["direction"],
    occurredAt: (r.occurredAt as Date).toISOString(),
    personId: r.personId as string,
    personName: r.personName as string,
    personType: r.personType as InteractionListItem["personType"],
    subject: r.subject as string,
    status: r.status as InteractionListItem["status"],
    followUpOn: (r.followUpOn as string | null) ?? null,
    documentCount: Number(r.documentCount ?? 0),
    updatedAt: (r.updatedAt as Date).toISOString(),
  };
}

export async function listInteractions(
  f: InteractionListQuery,
): Promise<{ items: InteractionListItem[]; total: number; needsReply: number; anyLogged: boolean }> {
  const where = listWhere(f);
  const column = SORT_COLUMN[f.sort];
  const order = f.order === "asc" ? asc(column) : desc(column);
  // A stable order under ties: newest first, then the id.
  const rows = await db
    .select(listColumns)
    .from(interaction)
    .innerJoin(person, eq(person.id, interaction.personId))
    .where(where)
    .orderBy(order, desc(interaction.occurredAt), asc(interaction.id))
    .limit(f.limit)
    .offset(f.offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(interaction)
    .innerJoin(person, eq(person.id, interaction.personId))
    .where(where);
  // §2: the „Așteaptă răspuns" counter — inbound rows awaiting a reply, in the scope shown.
  const [{ needsReply }] = await db
    .select({ needsReply: sql<number>`count(*)::int` })
    .from(interaction)
    .innerJoin(person, eq(person.id, interaction.personId))
    .where(and(where, eq(interaction.status, "NEEDS_REPLY"), eq(interaction.direction, "INBOUND")));
  // §3's two empty states: filters matching nothing, or a log truly empty — for the scope shown (#38.84).
  const anyLogged =
    Number(total) > 0 ||
    (await db
      .select({ id: interaction.id })
      .from(interaction)
      .where(f.personId ? eq(interaction.personId, f.personId) : undefined)
      .limit(1)).length > 0;
  return { items: rows.map(toListItem), total: Number(total), needsReply: Number(needsReply), anyLogged };
}

export async function getInteraction(id: string): Promise<InteractionRecord | null> {
  const [row] = await db
    .select({
      ...listColumns,
      description: interaction.description,
      internalNote: interaction.internalNote,
      relatedPropertyId: interaction.relatedPropertyId,
      createdAt: interaction.createdAt,
      createdBy: interaction.createdBy,
      updatedBy: interaction.updatedBy,
    })
    .from(interaction)
    .innerJoin(person, eq(person.id, interaction.personId))
    .where(eq(interaction.id, id));
  if (!row) return null;
  const docs = await db
    .select({ id: interactionDocument.documentId, title: document.title })
    .from(interactionDocument)
    .innerJoin(document, eq(document.id, interactionDocument.documentId))
    .where(eq(interactionDocument.interactionId, id))
    .orderBy(asc(interactionDocument.createdAt));
  const tags = await db.select({ tag: interactionTag.tag }).from(interactionTag).where(eq(interactionTag.interactionId, id)).orderBy(asc(interactionTag.tag));
  return {
    ...toListItem(row),
    description: row.description,
    internalNote: row.internalNote,
    relatedPropertyId: row.relatedPropertyId,
    documentIds: docs.map((d) => d.id),
    documents: docs.map((d) => ({ id: d.id, title: d.title })),
    tags: tags.map((t) => t.tag),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
}

function rowValues(input: InteractionInput) {
  return {
    channel: input.channel,
    direction: input.direction,
    occurredAt: new Date(input.occurredAt),
    personId: input.personId,
    subject: input.subject,
    description: input.description,
    internalNote: input.internalNote,
    status: input.status,
    followUpOn: input.followUpOn,
    relatedPropertyId: input.relatedPropertyId,
  };
}

export async function createInteraction(input: InteractionInput, by: string | null): Promise<string> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .insert(interaction)
      .values({ ...rowValues(input), createdBy: by, updatedBy: by, createdAt: now, updatedAt: now })
      .returning({ id: interaction.id });
    if (input.documentIds.length > 0) {
      await tx.insert(interactionDocument).values(input.documentIds.map((documentId) => ({ interactionId: row.id, documentId })));
    }
    if (input.tags.length > 0) {
      await tx.insert(interactionTag).values(input.tags.map((tag) => ({ interactionId: row.id, tag })));
    }
    return row.id;
  });
}

export type UpdateOutcome = "updated" | "not_found" | "conflict";

/**
 * §7: a change saves only over the row it read. The UPDATE names the `updated_at` the form read; a row changed
 * since matches nothing, and the answer is `conflict` — the caller says so and overwrites nothing.
 */
export async function updateInteraction(id: string, input: InteractionUpdate, by: string | null): Promise<UpdateOutcome> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(interaction)
      .set({ ...rowValues(input), updatedBy: by, updatedAt: new Date() })
      .where(and(eq(interaction.id, id), eq(interaction.updatedAt, new Date(input.expectedUpdatedAt))))
      .returning({ id: interaction.id });
    if (!row) {
      const [exists] = await tx.select({ id: interaction.id }).from(interaction).where(eq(interaction.id, id));
      return exists ? "conflict" : "not_found";
    }
    await tx.delete(interactionDocument).where(eq(interactionDocument.interactionId, id));
    if (input.documentIds.length > 0) {
      await tx.insert(interactionDocument).values(input.documentIds.map((documentId) => ({ interactionId: id, documentId })));
    }
    await tx.delete(interactionTag).where(eq(interactionTag.interactionId, id));
    if (input.tags.length > 0) {
      await tx.insert(interactionTag).values(input.tags.map((tag) => ({ interactionId: id, tag })));
    }
    return "updated";
  });
}

export async function deleteInteraction(id: string): Promise<boolean> {
  const rows = await db.delete(interaction).where(eq(interaction.id, id)).returning({ id: interaction.id });
  return rows.length > 0;
}

/** Suggestions for a tag box (§4): the tags already used on interactions, most used first. */
export async function interactionTagSuggestions(prefix: string | undefined, limit = 20): Promise<string[]> {
  const rows = await db
    .select({ tag: interactionTag.tag, n: sql<number>`count(*)::int` })
    .from(interactionTag)
    .where(prefix ? ilike(interactionTag.tag, `${prefix}%`) : undefined)
    .groupBy(interactionTag.tag)
    .orderBy(desc(sql`count(*)`), asc(interactionTag.tag))
    .limit(limit);
  return rows.map((r) => r.tag);
}
