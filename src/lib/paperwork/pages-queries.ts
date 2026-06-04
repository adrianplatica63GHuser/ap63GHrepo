/**
 * Database CRUD helpers for paperwork_page rows.
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { paperworkPage } from "@/db/schema";

export type PaperworkPageRow = typeof paperworkPage.$inferSelect;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Return all pages for a paperwork record, ordered by page_number ascending. */
export async function listPaperworkPages(
  paperworkId: string,
): Promise<PaperworkPageRow[]> {
  return db
    .select()
    .from(paperworkPage)
    .where(eq(paperworkPage.paperworkId, paperworkId))
    .orderBy(asc(paperworkPage.pageNumber));
}

/** Return a single page by its UUID, or undefined if not found. */
export async function getPaperworkPage(
  pageId: string,
): Promise<PaperworkPageRow | undefined> {
  const [row] = await db
    .select()
    .from(paperworkPage)
    .where(eq(paperworkPage.id, pageId));
  return row;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export type CreatePageData = {
  paperworkId: string;
  pageNumber:  number;
  pageName:    string | null;
  pageNotes:   string | null;
  fileName:    string;
  filePath:    string;
  fileSize:    number | null;
  mimeType:    string | null;
};

/** Insert a new page row and return the created record. */
export async function createPaperworkPage(
  data: CreatePageData,
): Promise<PaperworkPageRow> {
  const [row] = await db
    .insert(paperworkPage)
    .values(data)
    .returning();
  return row;
}

/** Hard-delete a page row by its UUID. */
export async function deletePaperworkPage(pageId: string): Promise<void> {
  await db.delete(paperworkPage).where(eq(paperworkPage.id, pageId));
}
