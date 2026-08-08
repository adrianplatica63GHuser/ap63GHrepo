/**
 * src/lib/documents/preexisting-lookup.ts — which of these documents does the
 * archive already hold?   (Slice #26.08)
 *
 * SERVER ONLY. It imports `@/db`, so it must never be reachable from a client
 * component — which is why it lives here rather than beside the rest of the
 * stage in `src/lib/import/`. Everything under that folder is imported by the
 * wizard, and one `import { db }` reaching it would pull `pg` into the browser
 * bundle. The pure half of this stage — including the comparison key both sides
 * use — is in `src/lib/import/preexisting-check.ts` and is imported FROM here,
 * never the other way round.
 *
 * THE COMPARISON HAS EXACTLY ONE DEFINITION
 * ─────────────────────────────────────────
 * `preexistingKeyOf` is it, and this module calls it for the archive side
 * exactly as the client calls it for the folder side. A second spelling of
 * "the same document" — a hand-written SQL comparison, say — would be a second
 * thing to keep in step, and the failure it produces is silent in the worst
 * direction: the screen promises a file will not be imported and the loop, or a
 * later slice's query, disagrees.
 *
 * WHY THE FILTER IS ON SIZE
 * ─────────────────────────
 * The key folds names and titles, so it cannot be computed in SQL without
 * teaching Postgres `foldRomanian`. The pre-filter therefore has to be
 * something exact, cheap and impossible to get wrong: a byte count. A document
 * that matches a candidate necessarily shares at least one page size with it,
 * so filtering on the candidate sizes has NO false negatives — it only decides
 * which documents are worth loading in full and comparing properly in
 * JavaScript.
 *
 * ⚠️ **A PAGE WITH NO SIZE MAKES ITS DOCUMENT UNMATCHABLE, on purpose.**
 * `document_page.file_size` is nullable, and rows predating the import wizard
 * can carry null. Such a document cannot be keyed, so it is left out and the
 * incoming file is imported again. That is the safe direction for this stage —
 * see the header of `preexisting-check.ts`: under-claiming costs a duplicate,
 * over-claiming loses a file.
 *
 * ⚠️ **SOFT-DELETED DOCUMENTS DO NOT COUNT AS PRESENT.** `document.deleted_at`
 * is the archive's tombstone, and a user who deleted a document and is now
 * re-importing the file is asking for it back. Telling them it is already here
 * — and then linking a deleted row to their new Property — is the one outcome
 * that would make this stage worse than not having it.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { document, documentPage } from "@/db/schema";
import {
  matchArchiveDocuments,
  type ArchivePageRow,
  type PreexistingCandidate,
  type PreexistingMatch,
} from "@/lib/import/preexisting-check";

/**
 * How many bind parameters one `IN (…)` may carry.
 *
 * Postgres' wire protocol caps a statement at 65535 parameters, and drizzle's
 * `inArray` spends one per element. 1000 is far below that and keeps a single
 * statement's plan sane; the cost of chunking is a handful of extra round trips
 * on an archive large enough to need them.
 */
const CHUNK = 1000;

function chunked<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Which of these candidates the archive already holds.
 *
 * Two queries and one call. Everything that DECIDES — the keying, the
 * unmeasurable page, the untitled document, the tie between two archived
 * copies — is `matchArchiveDocuments` in `src/lib/import/preexisting-check.ts`,
 * where it is pure and reachable from a test. What is left here is the part a
 * test could only re-assert: that the rows handed over are complete.
 *
 * The answer is one match per candidate PATH at most, and a candidate with no
 * match is simply absent — the caller (`checkPreexistingStage`) treats an
 * absent path as "new", which is the same thing this function would have to say
 * with an extra field.
 */
export async function findExistingDocuments(
  candidates: readonly PreexistingCandidate[],
): Promise<PreexistingMatch[]> {
  if (candidates.length === 0) return [];

  const sizes = [...new Set(candidates.flatMap((c) => c.files.map((f) => f.size)))];
  // Not reachable through `preexistingCandidatesOf`, which never emits a
  // candidate with no files — but `inArray` on an empty array is a SQL syntax
  // error rather than an empty result, so the guard is load-bearing for any
  // future caller rather than decorative.
  if (sizes.length === 0) return [];

  // -- 1. Which documents are worth loading at all --------------------------
  const candidateIds = new Set<string>();
  for (const batch of chunked(sizes, CHUNK)) {
    const rows = await db
      .selectDistinct({ documentId: documentPage.documentId })
      .from(documentPage)
      .where(inArray(documentPage.fileSize, batch));
    for (const row of rows) candidateIds.add(row.documentId);
  }
  if (candidateIds.size === 0) return [];

  // -- 2. Load them WHOLE ---------------------------------------------------
  //
  // Every page, not only the pages whose size matched: the key is over the
  // complete set, so a document loaded partially would key as a different — and
  // usually smaller — document and match things it does not hold. A document's
  // id lands in exactly one chunk, so no document is split across two queries.
  const rows: ArchivePageRow[] = [];
  for (const batch of chunked([...candidateIds], CHUNK)) {
    const page = await db
      .select({
        documentId: documentPage.documentId,
        fileName: documentPage.fileName,
        fileSize: documentPage.fileSize,
        code: document.code,
        title: document.title,
        createdAt: document.createdAt,
      })
      .from(documentPage)
      .innerJoin(document, eq(document.id, documentPage.documentId))
      .where(and(inArray(documentPage.documentId, batch), isNull(document.deletedAt)));
    rows.push(...page);
  }

  // -- 3. Decide ------------------------------------------------------------
  return matchArchiveDocuments(rows, candidates);
}
