/**
 * Database CRUD helpers for document_page rows.
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentPage } from "@/db/schema";

export type DocumentPageRow = typeof documentPage.$inferSelect;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Return all pages for a document record, ordered by page_number ascending. */
export async function listDocumentPages(
  documentId: string,
): Promise<DocumentPageRow[]> {
  return db
    .select()
    .from(documentPage)
    .where(eq(documentPage.documentId, documentId))
    .orderBy(asc(documentPage.pageNumber));
}

/** Return a single page by its UUID, or undefined if not found. */
export async function getDocumentPage(
  pageId: string,
): Promise<DocumentPageRow | undefined> {
  const [row] = await db
    .select()
    .from(documentPage)
    .where(eq(documentPage.id, pageId));
  return row;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export type CreatePageData = {
  documentId: string;
  pageNumber: number;
  pageName:   string | null;
  pageNotes:  string | null;
  fileName:   string;
  filePath:   string;
  fileSize:   number | null;
  mimeType:   string | null;
};

/** Insert a new page row and return the created record. */
export async function createDocumentPage(
  data: CreatePageData,
): Promise<DocumentPageRow> {
  const [row] = await db
    .insert(documentPage)
    .values(data)
    .returning();
  return row;
}

/** Hard-delete a page row by its UUID. */
export async function deleteDocumentPage(pageId: string): Promise<void> {
  await db.delete(documentPage).where(eq(documentPage.id, pageId));
}
