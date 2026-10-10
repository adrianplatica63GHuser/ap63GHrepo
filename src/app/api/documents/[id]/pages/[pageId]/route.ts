/**
 * /api/documents/[id]/pages/[pageId]
 *
 * DELETE — remove the page record and its associated stored file.
 * PATCH  — store the page's turn, `{ rotation: 0 | 90 | 180 | 270 }` (Slice #38.17):
 *          how far to the right the viewer draws it. The file is never touched,
 *          and a turn is not a new version of the document.
 *          Or (Slice #38.80) its notes, `{ pageNotes: string }` — trimmed, an
 *          empty string clears them; not a new version either. One or the
 *          other per request: the pen and the turn are two buttons.
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { unexpectedError } from "@/lib/api/errors";
import {
  deleteDocumentPage,
  getDocumentPage,
  updateDocumentPageNotes,
  updateDocumentPageRotation,
} from "@/lib/documents/pages-queries";
import { deleteFile } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string; pageId: string }> };

/** A page's turn: the one field, one of four numbers. Anything else is refused. */
const RotationUpdate = z
  .object({ rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]) })
  .strict();

/** The longest a page's notes may be — a paragraph or a few, never a file. */
export const PAGE_NOTES_MAX = 4000;

/** Slice #38.80: a page's notes, the one field; "" (after trimming) clears them. */
const NotesUpdate = z.object({ pageNotes: z.string().max(PAGE_NOTES_MAX) }).strict();

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id: documentId, pageId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }
  // Slice #38.80: a body naming the notes is read as notes, and refused as notes.
  const isNotes = typeof body === "object" && body !== null && !Array.isArray(body) && "pageNotes" in body;
  const notes = isNotes ? NotesUpdate.safeParse(body) : null;
  const turn = isNotes ? null : RotationUpdate.safeParse(body);
  if (notes && !notes.success) {
    return Response.json(
      { error: `pageNotes must be text of at most ${PAGE_NOTES_MAX} characters, and alone`, code: "invalid_notes" },
      { status: 400 },
    );
  }
  if (turn && !turn.success) {
    return Response.json(
      { error: "rotation must be 0, 90, 180 or 270", code: "invalid_rotation" },
      { status: 400 },
    );
  }

  try {
    const page = await getDocumentPage(pageId);
    // A page of another document is not this document's page to turn — or to write about.
    if (!page || page.documentId !== documentId) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }
    const row = notes?.success
      ? await updateDocumentPageNotes(pageId, notes.data.pageNotes.trim() || null)
      : await updateDocumentPageRotation(pageId, turn!.success ? turn!.data.rotation : 0);
    if (!row) return Response.json({ error: "Page not found" }, { status: 404 });
    return Response.json(row);
  } catch (err) {
    return unexpectedError(err, "PATCH /api/documents/[id]/pages/[pageId]");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { pageId } = await ctx.params;

  try {
    const page = await getDocumentPage(pageId);
    if (!page) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    // Row first, then the bytes — the same order and the same policy as
    // deleteDocuments (Slice #29.04). This used to be the other way round,
    // with a comment saying it wanted a storage failure to surface; it never
    // could, because deleteFile discarded the Supabase error. Making it throw
    // would have made this route 500 and KEEP the row, so the page became
    // undeletable and a retry hit the same branch again.
    //
    // What is left after a storage failure now is bytes nothing references —
    // invisible and sweepable. What the other order left was a page row on
    // screen whose file 404s, which is the visible lie this slice removes.
    await deleteDocumentPage(pageId);
    const gone = await deleteFile(page.filePath);
    if (!gone) {
      console.error(
        `[DELETE /api/documents/[id]/pages/[pageId]] page row ${pageId} deleted, but its file could not be removed from storage and is now orphaned: ${page.filePath}`,
      );
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/documents/[id]/pages/[pageId]");
  }
}
