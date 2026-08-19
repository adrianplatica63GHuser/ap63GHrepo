/**
 * Database CRUD helpers for document_page rows.
 */

import { asc, eq, inArray } from "drizzle-orm";
import { db, type DbTransaction } from "@/db";
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

/**
 * Every stored file key belonging to these documents.
 *
 * Read this BEFORE deleting the documents, and pass the SAME transaction:
 * `document_page` cascades from `document`, and `file_path` is the only
 * record anywhere of where the bytes live — once the rows are gone nothing in
 * the database can find them again.
 *
 * Reading it outside the transaction leaves a window: a page uploaded between
 * the read and the DELETE has its row cascaded away and its bytes left behind
 * with nothing anywhere naming them, not even the failure log. Inside the
 * transaction there is no window — the row either exists when the delete
 * takes its lock, in which case it is in this list, or it does not exist yet
 * and the insert fails on the FK. (Found by an adversarial round.)
 */
export async function listDocumentPageFilePaths(
  documentIds: string[],
  tx: DbTransaction | typeof db = db,
): Promise<string[]> {
  if (documentIds.length === 0) return [];
  const rows = await tx
    .select({ filePath: documentPage.filePath })
    .from(documentPage)
    .where(inArray(documentPage.documentId, documentIds));
  return rows.map((r) => r.filePath);
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
