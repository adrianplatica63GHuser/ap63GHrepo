import { NextResponse } from "next/server";
import { listMetadataVersions } from "@/lib/metadata/queries";

// ---------------------------------------------------------------------------
// GET — version history for an entity_metadata row
// ---------------------------------------------------------------------------
//
// Called by the EntityMetadataTab version nav.
// The principalObjectId is returned by the entity-references GET routes.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ principalObjectId: string }> },
) {
  const { principalObjectId } = await params;
  const items = await listMetadataVersions(principalObjectId);
  return NextResponse.json({ items });
}
