/**
 * GET  /api/metadata/[principalObjectId]  — read current metadata for an entity
 * PATCH /api/metadata/[principalObjectId] — save importance, relevance, provenance
 *
 * GET response: EntityMetadataRow (importance, relevance, provenance, …)
 *
 * PATCH body: { importance: string | null; relevance: string | null; provenance: string | null }
 */

import { NextResponse } from "next/server";
import { getCurrentUserEmail } from "@/lib/auth/current-user";
import { getEntityMetadata, patchAllEntityMetadata } from "@/lib/metadata/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ principalObjectId: string }> },
) {
  const { principalObjectId } = await params;
  const meta = await getEntityMetadata(principalObjectId);
  return NextResponse.json(meta);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ principalObjectId: string }> },
) {
  const { principalObjectId } = await params;

  const body = (await req.json()) as {
    importance?: string | null;
    relevance?:  string | null;
    provenance?: string | null;
  };

  const updatedBy = await getCurrentUserEmail();

  const updated = await patchAllEntityMetadata(
    principalObjectId,
    {
      importance: body.importance ?? null,
      relevance:  body.relevance  ?? null,
      provenance: body.provenance ?? null,
    },
    updatedBy,
  );

  return NextResponse.json(updated);
}
