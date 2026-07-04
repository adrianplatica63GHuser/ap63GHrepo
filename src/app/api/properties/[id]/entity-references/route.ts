import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { property } from "@/db/schema";
import { listEntityGroupTags } from "@/lib/groups/queries";
import { listEntityStampTags } from "@/lib/stamps/queries";
import { getEntityMetadata, patchEntityMetadata } from "@/lib/metadata/queries";
import type { MetadataPatch } from "@/lib/metadata/queries";

// ---------------------------------------------------------------------------
// GET — groups + stamps + entity metadata
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Resolve principal_object_id for this property
  const propRows = await db
    .select({ principalObjectId: property.principalObjectId })
    .from(property)
    .where(eq(property.id, id))
    .limit(1);

  const principalObjectId = propRows[0]?.principalObjectId ?? null;

  const [entityGroups, entityStamps, metadata] = await Promise.all([
    listEntityGroupTags({ propertyId: id }),
    listEntityStampTags({ propertyId: id }),
    principalObjectId
      ? getEntityMetadata(principalObjectId)
      : Promise.resolve({ importance: null, relevance: null, provenance: null, provenanceHistory: [], importanceUpdatedAt: null, relevanceUpdatedAt: null, provenanceUpdatedAt: null }),
  ]);

  return NextResponse.json({
    groups: entityGroups,
    stamps: entityStamps,
    principalObjectId,
    ...metadata,
  });
}

// ---------------------------------------------------------------------------
// PATCH — update one metadata field (importance | relevance | provenance)
// ---------------------------------------------------------------------------

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = (await req.json()) as { field: string; value: string | null };
  const { field, value } = body;

  if (!["importance", "relevance", "provenance"].includes(field)) {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }

  const propRows = await db
    .select({ principalObjectId: property.principalObjectId })
    .from(property)
    .where(eq(property.id, id))
    .limit(1);

  const principalObjectId = propRows[0]?.principalObjectId;
  if (!principalObjectId) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const updated = await patchEntityMetadata(principalObjectId, { field, value } as MetadataPatch);
  return NextResponse.json(updated);
}
