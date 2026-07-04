import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { property } from "@/db/schema";
import { listEntityGroupTags } from "@/lib/groups/queries";
import { listEntityStampTags } from "@/lib/stamps/queries";
import { getEntityMetadata, patchEntityMetadata, restoreEntityMetadataSnapshot, touchEntityMetadataField } from "@/lib/metadata/queries";
import type { MetadataPatch, MetadataSnapshot } from "@/lib/metadata/queries";

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

  const body = (await req.json()) as { field: string; value?: string | null; action?: string };
  const { field, value, action } = body;

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

  const metaField = field as "importance" | "relevance" | "provenance";

  if (action === "touch") {
    const updated = await touchEntityMetadataField(principalObjectId, metaField);
    return NextResponse.json(updated);
  }

  const updated = await patchEntityMetadata(principalObjectId, { field: metaField, value: value ?? null } as MetadataPatch);
  return NextResponse.json(updated);
}

// ---------------------------------------------------------------------------
// PUT — restore a historical metadata snapshot ("Make current")
// ---------------------------------------------------------------------------

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = (await req.json()) as { snapshot: MetadataSnapshot };
  const { snapshot } = body;

  if (!snapshot || typeof snapshot !== "object") {
    return NextResponse.json({ error: "snapshot required" }, { status: 400 });
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

  const updated = await restoreEntityMetadataSnapshot(principalObjectId, snapshot);
  return NextResponse.json(updated);
}
