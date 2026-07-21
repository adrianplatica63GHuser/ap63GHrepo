/**
 * POST /api/documents/[id]/process
 *
 * "Process" a document that contains a plain-text file of Stereo 70
 * cadastral coordinates:
 *
 *  1. Reads the document's first text/plain page file.
 *  2. Parses Stereo 70 coordinate lines (shared parser from stereo70-parse.ts).
 *  3. Atomically claims provenance = TEXT_FILE via SELECT FOR UPDATE inside a
 *     short DB transaction, so concurrent calls (multiple browser tabs, server
 *     retries) are serialised — only the first through the lock can proceed.
 *  4. Creates a new Property from the parsed corners.
 *  5. Looks at the document's entity tags for a "property folder" tag
 *     (any tag whose first character is a digit — e.g. "1-2-livada").
 *  6. Finds every Document and Person that shares that tag and associates
 *     them all with the newly-created Property.
 *  7. Calls patchEntityMetadata to write the version snapshot + audit trail
 *     (the value is already TEXT_FILE from step 3; this call is idempotent on
 *     the value itself but still writes the entity_metadata_version row).
 *
 * If anything in step 4 fails, a compensating delete removes any orphaned
 * property row and provenance is reset to null so the panel stays in "ready".
 *
 * Response: { propertyId, propertyCode, documentCount, personCount }
 *
 * Errors (4xx):
 *   401  — unauthenticated
 *   404  — document not found
 *   409  — document already processed (provenance = TEXT_FILE, or concurrent
 *            request already claimed it)
 *   422  — no text page found, or fewer than 3 corners parsed
 *   500  — unexpected error
 *
 * Runtime: Node.js — required because stereo70ToWgs84 reads grid files from disk.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse }     from "next/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db }               from "@/db";
import { document, entityMetadata, property as dbProperty, propertyDocument, propertyPerson } from "@/db/schema";
import { listDocumentPages }            from "@/lib/documents/pages-queries";
import { readFileContent }              from "@/lib/storage";
import { stereo70ToWgs84 }             from "@/lib/geo/transdatRO";
import { parseLine }                   from "@/lib/geo/stereo70-parse";
import { perToSlash, parseFolderName } from "@/lib/import/folder-utils";
import {
  addEntityTag,
  listEntityTags,
  patchEntityMetadata,
  findEntitiesByTag,
} from "@/lib/metadata/queries";
import {
  createProperty,
  associateDocumentsToProperty,
  associatePersonsToProperty,
} from "@/lib/properties/queries";
import { createServerClient } from "@/lib/supabase/server";
import { unexpectedError }    from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id: documentId } = await ctx.params;

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const updatedBy = user.email ?? user.id ?? null;

  try {
    // ── 2. Load document ────────────────────────────────────────────────────
    const rows = await db
      .select()
      .from(document)
      .where(and(eq(document.id, documentId), isNull(document.deletedAt)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const doc = rows[0];
    const principalObjectId = doc.principalObjectId;

    // ── 3. Find text page ───────────────────────────────────────────────────
    const pages = await listDocumentPages(documentId);
    const textPage = pages.find(
      (p) =>
        p.mimeType === "text/plain" ||
        p.fileName?.toLowerCase().endsWith(".txt") === true,
    );

    if (!textPage) {
      return NextResponse.json(
        { error: "Nu s-a găsit niciun fișier text în paginile documentului." },
        { status: 422 },
      );
    }

    // ── 4. Read and parse coordinates ───────────────────────────────────────
    const buffer = await readFileContent(textPage.filePath);
    const raw    = buffer.toString("utf-8");
    const lines  = raw.split(/\r?\n/);

    const corners: { lat: number; lon: number; originalIndex: number | null }[] = [];
    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      try {
        const wgs = stereo70ToWgs84(parsed.northing, parsed.easting);
        corners.push({ lat: wgs.lat, lon: wgs.lon, originalIndex: parsed.originalIndex });
      } catch {
        // Corner outside grid coverage — skip silently
      }
    }

    if (corners.length < 3) {
      return NextResponse.json(
        { error: "Nu s-au găsit suficiente coordonate în fișier (minim 3 colțuri)." },
        { status: 422 },
      );
    }

    // ── 5. Identify property-folder tag ─────────────────────────────────────
    const tags = await listEntityTags(principalObjectId);
    // Identify the property-folder tag by reusing parseFolderName — the same
    // function used in the scan table.  It recognises any tag that starts with
    // a digit (tarla) and tolerates "per"-notation fractions and free-text rest
    // segments (e.g. "47per2-225per3per24-2716 Prisecaru").
    // Tags are stored lowercase; parseFolderName works case-insensitively for
    // the digit-start check.
    // Identify the canonical property-folder tag.
    //
    // Since addEntityTag now auto-creates alias tags ("47/2", "225/3/24",
    // "47/2-225/3/24") alongside the original ("47per2-225per3per24-2716
    // prisecaru"), several tags in the list satisfy parseFolderName.  All aliases
    // share the same created_at (batch insert) so ordering is non-deterministic
    // and we can't rely on "first match".
    //
    // Strategy: among all property-folder tags, prefer the most complete one —
    //   1. tag with rest + parcela + tarlaSola  (most specific)
    //   2. tag with parcela + tarlaSola
    //   3. tag with tarlaSola only              (least specific; e.g. "47/2")
    //
    // Within each tier, prefer the longest tag (guards against unlikely ties).
    type Candidate = { tag: string; pf: ReturnType<typeof parseFolderName>; rank: number };
    const candidates: Candidate[] = [];
    for (const tag of tags) {
      const pf = parseFolderName(tag);
      if (!pf.isPropertyFolder) continue;
      const rank = pf.rest ? 3 : pf.parcela ? 2 : 1;
      candidates.push({ tag, pf, rank });
    }
    candidates.sort((a, b) =>
      b.rank - a.rank || b.tag.length - a.tag.length,
    );
    const best = candidates[0] ?? null;
    let propertyTag: string | null = best?.tag ?? null;
    let parsedFolder: ReturnType<typeof parseFolderName> | null = best?.pf ?? null;

    let tarlaSola: string | null = null;
    let parcela:   string | null = null;
    if (parsedFolder) {
      // perToSlash: "47per2" → "47/2", "225per3per24" → "225/3/24"
      tarlaSola = parsedFolder.tarlaSola ? perToSlash(parsedFolder.tarlaSola) || null : null;
      parcela   = parsedFolder.parcela   ? perToSlash(parsedFolder.parcela)   || null : null;
    }

    // ── 6. Atomically claim provenance = TEXT_FILE ──────────────────────────
    //
    // Design (fix for issue 7.1 — duplicate entity creation on concurrent
    // requests from multiple browser tabs or server-side retries):
    //
    //   Open a short DB transaction that:
    //     a) Ensures the entity_metadata row exists (INSERT … ON CONFLICT DO
    //        NOTHING) so there is always a concrete row to lock.
    //     b) Locks the row with SELECT … FOR UPDATE.  Any concurrent request
    //        for the same document blocks here until this transaction commits.
    //     c) Re-reads provenance under the lock.  If it is already TEXT_FILE a
    //        prior (or concurrent) request already processed this document → 409.
    //     d) Sets provenance = TEXT_FILE inside the lock so that the concurrent
    //        request sees TEXT_FILE when it finally acquires the lock.
    //
    // After this transaction commits the property creation is safe: no second
    // request can slip through the lock and create a duplicate property.
    //
    // If property creation then fails, the catch block below resets provenance
    // to null so the Process panel is not permanently stuck in "done".
    //
    // Error protocol: an object with code = "ALREADY_PROCESSED" signals a 409
    // from inside the transaction without being confused with a real DB error.

    let provClaimedByUs = false;

    try {
      await db.transaction(async (tx) => {
        // a) Ensure the metadata row exists before trying to lock it
        await tx
          .insert(entityMetadata)
          .values({ principalObjectId })
          .onConflictDoNothing();

        // b) Lock the row for the duration of this transaction
        const lockRows = await tx.execute(
          sql`SELECT provenance FROM entity_metadata
              WHERE principal_object_id = ${principalObjectId}
              FOR UPDATE`,
        );

        // c) Check provenance under the lock
        const currentProvenance =
          (lockRows.rows[0] as { provenance: string | null } | undefined)
            ?.provenance ?? null;

        if (currentProvenance === "TEXT_FILE") {
          throw Object.assign(new Error("already-processed"), {
            code: "ALREADY_PROCESSED",
          });
        }

        // d) Claim provenance inside the lock — any concurrent request's
        //    transaction will see TEXT_FILE once this one commits
        await tx.execute(
          sql`UPDATE entity_metadata
              SET provenance            = 'TEXT_FILE',
                  provenance_updated_at = NOW(),
                  updated_by            = ${updatedBy},
                  updated_at            = NOW()
              WHERE principal_object_id = ${principalObjectId}`,
        );
      });

      provClaimedByUs = true;

    } catch (err) {
      if ((err as { code?: string }).code === "ALREADY_PROCESSED") {
        return NextResponse.json(
          { error: "Document already processed", provenance: "TEXT_FILE" },
          { status: 409 },
        );
      }
      throw err;
    }

    // ── 7. Create property + associate + write audit trail ──────────────────
    //
    // Design (fix for issue 7.5 — no transaction around property creation +
    // association):
    //
    // `createProperty` internally runs its own Drizzle transaction for the
    // version snapshot, so it cannot be wrapped in an outer transaction without
    // a full refactor (passing `tx` through every call).  Instead we use a
    // compensating-action pattern:
    //
    //   a) Track whether the property row was created (`createdPropertyId`).
    //   b) If any step AFTER property creation throws (association inserts,
    //      patchEntityMetadata), the catch block deletes the orphaned property
    //      and resets provenance to null — so the Process panel shows "ready"
    //      and the user can retry with a clean slate.
    //   c) If property creation itself throws, `createdPropertyId` is still
    //      undefined so the delete is skipped, and provenance is still reset.
    //
    // This ensures the system never ends up with a property that has no
    // provenance marker (half-imported state).

    let documentCount     = 0;
    let personCount       = 0;
    let createdPropertyId: string | undefined;

    try {
      const created = await createProperty(
        {
          nickname:   propertyTag ?? textPage.fileName ?? null,
          tarlaSola,
          parcela,
          corners,
        },
        updatedBy,
      );

      createdPropertyId = created.property.id;
      const propertyId               = createdPropertyId;
      const propertyCode             = created.property.code;
      const propertyPrincipalObjId   = created.property.principalObjectId;

      // ── 7.10  Apply the document's folder tags to the property ─────────────
      //
      // During bulk import every document is tagged with its ancestor folder
      // names (root → parent).  The newly-created property should carry the
      // same tags so that `findEntitiesByTag` can locate it alongside the
      // sibling documents and persons that share the same folder tag.
      //
      // `tags` was fetched from the source document's entity_tag rows (step 5).
      // We reuse that list verbatim — `addEntityTag` normalises to lowercase
      // and is idempotent (ON CONFLICT DO NOTHING).
      //
      // We run the inserts sequentially (not Promise.all) to avoid hammering
      // the DB with a burst of short writes; there are at most 2-3 tags.
      for (const tag of tags) {
        await addEntityTag(propertyPrincipalObjId, tag);
      }

      // Associate all Documents and Persons sharing the property folder tag
      if (propertyTag) {
        const entities = await findEntitiesByTag(propertyTag);

        const docIds    = entities.documents.map((d) => d.id);
        const personIds = entities.persons.map((p) => p.id);

        // Fix for issue 7.4 — Sibling Association Spans Across Import Sessions:
        //
        // Without this guard, documents/persons from a PREVIOUS import that share
        // the same property folder tag (e.g. "1-2") would be re-associated with
        // the NEW property every time a new coordinate file is processed.
        //
        // We filter out any entity already linked to ANY property before calling
        // the association helpers — we only associate "fresh" entities (those not
        // yet attached to any property).  The `associateDocumentsToProperty` /
        // `associatePersonsToProperty` helpers already use .onConflictDoNothing()
        // for duplicate (propertyId, entityId) pairs within a single property, but
        // that does NOT prevent cross-property re-association, which is what we
        // address here.
        //
        // We keep this logic in the route (not inside the shared helpers) so that
        // the manual association UI is unaffected and can still link an entity to
        // multiple properties when the user does so deliberately.

        const alreadyLinkedDocs = docIds.length > 0
          ? await db
              .select({ documentId: propertyDocument.documentId })
              .from(propertyDocument)
              .where(inArray(propertyDocument.documentId, docIds))
          : [];
        const linkedDocSet  = new Set(alreadyLinkedDocs.map((r) => r.documentId));
        const freshDocIds   = docIds.filter((id) => !linkedDocSet.has(id));

        const alreadyLinkedPersons = personIds.length > 0
          ? await db
              .select({ personId: propertyPerson.personId })
              .from(propertyPerson)
              .where(inArray(propertyPerson.personId, personIds))
          : [];
        const linkedPersonSet  = new Set(alreadyLinkedPersons.map((r) => r.personId));
        const freshPersonIds   = personIds.filter((id) => !linkedPersonSet.has(id));

        if (freshDocIds.length > 0) {
          await associateDocumentsToProperty(propertyId, freshDocIds);
          documentCount = freshDocIds.length;
        }
        if (freshPersonIds.length > 0) {
          await associatePersonsToProperty(propertyId, freshPersonIds, null);
          personCount = freshPersonIds.length;
        }
      }

      // Write entity_metadata_version snapshot for the null → TEXT_FILE
      // transition.  The value is already set in the DB (step 6), so
      // patchEntityMetadata is idempotent on the field value itself but still
      // triggers appendVersion (which has its own deduplication).
      // provenance log entry is NOT written here because the old value was null
      // (the log rule is "log the OLD value when it changes from non-null").
      await patchEntityMetadata(
        principalObjectId,
        { field: "provenance", value: "TEXT_FILE" },
        updatedBy,
      );

      return NextResponse.json({ propertyId, propertyCode, documentCount, personCount });

    } catch (err) {
      // ── Compensating actions (issue 7.5) ─────────────────────────────────
      //
      // If property creation SUCCEEDED but a later step (associations or
      // patchEntityMetadata) failed, delete the orphaned property so the DB
      // stays consistent.  The principal_object and related rows (corners,
      // address) are removed via ON DELETE CASCADE.
      //
      // If property creation itself FAILED, createdPropertyId is undefined and
      // the delete is skipped.
      //
      // In both cases we reset provenance to null so the Process panel shows
      // "ready" and the user can safely retry.
      if (createdPropertyId) {
        await db
          .delete(dbProperty)
          .where(eq(dbProperty.id, createdPropertyId))
          .catch(() => {
            // Best-effort cleanup — do not mask the original error.
          });
      }
      if (provClaimedByUs) {
        await patchEntityMetadata(
          principalObjectId,
          { field: "provenance", value: null },
          updatedBy,
        ).catch(() => {
          // Best-effort reset — do not mask the original error.
        });
      }
      throw err;
    }

  } catch (err) {
    return unexpectedError(err, "POST /api/documents/[id]/process");
  }
}
