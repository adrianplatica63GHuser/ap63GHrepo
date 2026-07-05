import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document } from "@/db/schema";
import { listEntityGroupTags } from "@/lib/groups/queries";
import { listEntityStampTags } from "@/lib/stamps/queries";
import { getEntityMetadata, patchEntityMetadata, restoreEntityMetadataSnapshot, touchEntityMetadataField } from "@/lib/metadata/queries";
import type { MetadataPatch, MetadataSnapshot } from "@/lib/metadata/queries";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET — groups + stamps + entity metadata
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const docRows = await db
    .select({ principalObjectId: document.principalObjectId })
    .from(document)
    .where(eq(document.id, id))
    .limit(1);

  const principalObjectId = docRows[0]?.principalObjectId ?? null;

  const [entityGroups, entityStamps, metadata] = await Promise.all([
    principalObjectId ? listEntityGroupTags(principalObjectId) : Promise.resolve([]),
    principalObjectId ? listEntityStampTags(principalObjectId) : Promise.resolve([]),
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

  const docRows = await db
    .select({ principalObjectId: document.principalObjectId })
    .from(document)
    .where(eq(document.id, id))
    .limit(1);

  const principalObjectId = docRows[0]?.principalObjectId;
  if (!principalObjectId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const metaField = field as "importance" | "relevance" | "provenance";

  // Resolve caller identity for the updated_by audit column
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const updatedBy = user?.email ?? user?.id ?? null;

  if (action === "touch") {
    const updated = await touchEntityMetadataField(principalObjectId, metaField, updatedBy);
    return NextResponse.json(updated);
  }

  const updated = await patchEntityMetadata(principalObjectId, { field: metaField, value: value ?? null } as MetadataPatch, updatedBy);
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

  const docRows = await db
    .select({ principalObjectId: document.principalObjectId })
    .from(document)
    .where(eq(document.id, id))
    .limit(1);

  const principalObjectId = docRows[0]?.principalObjectId;
  if (!principalObjectId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const updatedBy = user?.email ?? user?.id ?? null;

  const updated = await restoreEntityMetadataSnapshot(principalObjectId, snapshot, updatedBy);
  return NextResponse.json(updated);
}
