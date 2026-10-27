/**
 * /api/documents/[id]
 *
 * GET    — fetch full document record, with its `identity` block (Slice 40.82: the kind, the values and the
 *          CNP warnings on a document of an identity type; null on an ordinary one)
 * PATCH  — partial update; an `identity` block is written in the same transaction (Slice 40.82), and a refusal
 *          is a 400 with its `code` and the `fields` it names
 * DELETE — deletes the row AND its stored page files (Slice #29.04). Pages,
 *          versions, junctions and the document's principal_object row all go
 *          with it; the code it held is retired, never reused. Unguarded
 *          until Slice #29.05.
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import {
  getDocumentById,
  deleteDocument,
  updateDocument,
} from "@/lib/documents/queries";
import { documentUpdateSchema } from "@/lib/documents/validation";
import { getCurrentUserEmail } from "@/lib/auth/current-user";
import { db } from "@/db";
import { identityBlockFor, identityRefusalToResponse } from "@/lib/identity-documents/queries";
import { StaleVersionError, splitBaseVersion, staleVersionResponse } from "@/lib/versioning/base-version";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const result = await getDocumentById(id);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ ...result, identity: await identityBlockFor(db, result.id, result.documentTypeId) });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/[id]");
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: Ctx,
): Promise<Response> {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Slice #37.21: the version the form was loaded at travels beside the fields
  // and is checked inside the save's transaction; the entity's schema never sees it.
  const split = splitBaseVersion(body);
  if (!split.ok) {
    return Response.json({ error: "baseVersion must be a version number" }, { status: 400 });
  }
  const parsed = documentUpdateSchema.safeParse(split.rest);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await updateDocument(id, parsed.data, await getCurrentUserEmail(), split.baseVersion);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ ...result, identity: await identityBlockFor(db, result.id, result.documentTypeId) });
  } catch (err) {
    if (err instanceof StaleVersionError) return staleVersionResponse(err);
    const identityRefusal = identityRefusalToResponse(err);
    if (identityRefusal) return identityRefusal;
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "PATCH /api/documents/[id]");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const ok = await deleteDocument(id);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/documents/[id]");
  }
}
