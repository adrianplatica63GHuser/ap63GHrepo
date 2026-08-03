/**
 * POST /api/documents/[id]/process
 *
 * "Process" a document that contains a plain-text file of Stereo 70
 * cadastral coordinates:
 *
 *  1. Reads the document's first text/plain page file.
 *  2. Parses Stereo 70 coordinate lines (shared parser from stereo70-parse.ts).
 *  3. Creates a new Property from the parsed corners, then atomically CLAIMS
 *     the document as that Property's corner source by inserting into
 *     property_corner_source (UNIQUE on document_id) with ON CONFLICT DO
 *     NOTHING. Losing the race means another path already turned this
 *     document into a Property → 409, and the Property just created here is
 *     compensated away.
 *  4. (Slice #23.06.Import) Provenance is no longer the lock. It is still
 *     stamped — COORDINATE_FILE is accurate here, this route really did parse
 *     coordinates — but nothing reads it to decide already-processed.
 *  5. Looks at the document's entity tags for a "property folder" tag
 *     (any tag whose first character is a digit — e.g. "1-2-livada").
 *  6. Finds every Document and Person that shares that tag and associates
 *     them all with the newly-created Property.
 *  7. Calls patchEntityMetadata to stamp provenance = COORDINATE_FILE on the
 *     source document and write the version snapshot + audit trail.
 *
 * If anything after property creation fails, a compensating delete removes the
 * orphaned property row AND releases its corner-source claim, so the panel
 * returns to "ready" and the document can be processed again.
 *
 * Response: { propertyId, propertyCode, documentCount, personCount }
 *
 * Errors (4xx):
 *   401  — unauthenticated
 *   404  — document not found
 *   409  — document already produced a Property (an existing
 *            property_corner_source row, or a concurrent request that won the
 *            claim). The body carries { propertyId, propertyCode } so the
 *            caller can link straight to it.
 *   422  — no text page found, or fewer than 3 corners parsed
 *   500  — unexpected error
 *
 * Runtime: Node.js — required because stereo70ToWgs84 reads grid files from disk.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse }     from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db }               from "@/db";
import { document, property as dbProperty, propertyDocument, propertyPerson } from "@/db/schema";
import { listDocumentPages }            from "@/lib/documents/pages-queries";
import { readFileContent }              from "@/lib/storage";
import { stereo70ToWgs84 }             from "@/lib/geo/transdatRO";
import { parseLine }                   from "@/lib/geo/stereo70-parse";
import { perToSlash, parseFolderName } from "@/lib/import/folder-utils";
import {
  addEntityTag,
  listEntityTags,
  patchEntityMetadata,
  setInitialProvenance,
  findEntitiesByTag,
} from "@/lib/metadata/queries";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import {
  createProperty,
  associateDocumentsToProperty,
  associatePersonsToProperty,
} from "@/lib/properties/queries";
import {
  claimCornerSource,
  getCornerSourceForDocument,
  releaseCornerSourceLink,
} from "@/lib/properties/corner-source";
import { getCurrentUser }     from "@/lib/auth/current-user";
import { unexpectedError }    from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id: documentId } = await ctx.params;

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  // getCurrentUser() honours UAT_NO_AUTH. Before Slice #21.11.uat.auth this
  // called supabase.auth.getUser() directly and returned 401 on Ciprian's UAT
  // box, where there is no Supabase project at all — and the client rendered
  // that as "session expired, please sign in again" on a build whose login
  // link is deliberately hidden. Do not reintroduce a direct call here.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const updatedBy = user.email ?? null;

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
    const propertyTag: string | null = best?.tag ?? null;
    const parsedFolder: ReturnType<typeof parseFolderName> | null = best?.pf ?? null;

    let tarlaSola: string | null = null;
    let parcela:   string | null = null;
    if (parsedFolder) {
      // perToSlash: "47per2" → "47/2", "225per3per24" → "225/3/24"
      tarlaSola = parsedFolder.tarlaSola ? perToSlash(parsedFolder.tarlaSola) || null : null;
      parcela   = parsedFolder.parcela   ? perToSlash(parsedFolder.parcela)   || null : null;
    }

    // ── 6. Cheap pre-check: has this document already produced a Property? ──
    //
    // Slice #23.06.Import. This is an OPTIMISATION, not the lock. It exists so
    // the common already-processed case does not create a Property and then
    // immediately delete it again. The authoritative check is the
    // claimCornerSource insert below, which cannot be raced.
    //
    // What this replaced: an entity_metadata row locked with SELECT … FOR
    // UPDATE inside a short transaction, where provenance = 'COORDINATE_FILE'
    // doubled as the already-processed flag. That value is written by
    // classifyFileSource-driven inference elsewhere in the app, and the import
    // wizard writes DOC_FILE for a coordinate .txt (a .txt is
    // indistinguishable from any other text file BY NAME — which is all
    // classifyFileSource looks at). So a wizard-imported coordinate document
    // read as "not processed" here and this route happily built a second
    // Property on top of the wizard's. See src/lib/properties/corner-source.ts.
    const existingLink = await getCornerSourceForDocument(documentId);
    if (existingLink) {
      return NextResponse.json(
        {
          error:        "Document already processed",
          propertyId:   existingLink.propertyId,
          propertyCode: existingLink.propertyCode,
        },
        { status: 409 },
      );
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
    //      AND releases its corner-source claim — so the Process panel shows
    //      "ready" and the user can retry with a clean slate.
    //   c) If property creation itself throws, `createdPropertyId` is still
    //      undefined so both the delete and the release are skipped.
    //
    // Slice #23.06.Import: there is no longer a provenance reset here, because
    // provenance is no longer the lock. It is stamped once, at the very end,
    // as the last write of a successful run — so a failed run simply never
    // stamps it, and nothing has to be undone.

    let documentCount       = 0;
    let personCount         = 0;
    let createdPropertyId:  string | undefined;
    let claimedCornerSource = false;

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

      // ── 7.05  Claim the document as this Property's corner source ────────
      //
      // Slice #23.06.Import — THIS is the lock. UNIQUE(document_id) plus
      // ON CONFLICT DO NOTHING means exactly one caller can ever win, with no
      // window between a check and a claim for a second request to slip
      // through. Two concurrent requests both reach here having created a
      // Property; one wins, and the loser's Property is compensated away
      // immediately below.
      //
      // The claim must come BEFORE any other post-creation work, so the
      // loser's rollback is as small as possible.
      //
      // Why not claim before creating the Property: property_corner_source
      // .property_id is NOT NULL, so there is nothing to point at until the
      // Property exists. Paying for a wasted insert-then-delete on a genuine
      // race is much cheaper than a nullable link column, which would make
      // "claimed but pointing nowhere" a representable state.
      claimedCornerSource = await claimCornerSource(documentId, propertyId, updatedBy);
      if (!claimedCornerSource) {
        // Lost the race. Delete the Property we just made and report the
        // winner, so the caller can link to the Property that does exist.
        await db
          .delete(dbProperty)
          .where(eq(dbProperty.id, propertyId))
          .catch(() => {
            // Best-effort cleanup — the 409 is the important part.
          });
        createdPropertyId = undefined;

        const winner = await getCornerSourceForDocument(documentId);
        return NextResponse.json(
          {
            error:        "Document already processed",
            propertyId:   winner?.propertyId   ?? null,
            propertyCode: winner?.propertyCode ?? null,
          },
          { status: 409 },
        );
      }

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

      // ── 7.15  Provenance of the new Property  (Slice #21.07.Import) ───────
      //
      // Adrian's rule: "for the property object created from coordinate file
      // the provenience will be: coordinate file .TXT". Unambiguous, so the
      // system sets it - the user is never asked here.
      //
      // Before this slice the source .txt DOCUMENT got a provenance marker but
      // the Property built from it got none, which is the gap this closes.
      //
      // Best-effort inside setInitialProvenance: the property row is already
      // committed, so a metadata write failure must not roll the import back.
      const propertyProvenance = inferProvenance("COORDINATE_FILE");
      if (propertyProvenance) {
        await setInitialProvenance(propertyPrincipalObjId, propertyProvenance, updatedBy);
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

      // ── 7.90  Stamp provenance on the SOURCE document ────────────────────
      //
      // Slice #23.06.Import: this used to be a no-op re-write of a value
      // claimed back in step 6; now it is the only place the document's
      // provenance is set, and it runs LAST, once everything else succeeded.
      //
      // COORDINATE_FILE is simply accurate here — this route read the file and
      // parsed real corners out of it, so it is not guessing from an
      // extension. What changed is that nothing reads this value to decide
      // whether the document has been processed; property_corner_source does
      // that. Provenance is metadata again.
      //
      // Kept OUTSIDE any transaction, per #21.07.Import: a metadata failure
      // must never turn a successful entity create into an error response.
      // (Here it would also throw into the compensating catch and delete a
      // perfectly good Property — which is precisely the outcome that rule
      // exists to prevent.)
      // Best-effort, and it must stay that way: this runs after the Property,
      // its corner-source claim, its tags and its associations are all
      // committed. Letting a metadata write failure reach the catch below
      // would delete a Property that was created correctly and release a claim
      // that was won fairly — turning a cosmetic problem into data loss.
      await patchEntityMetadata(
        principalObjectId,
        { field: "provenance", value: "COORDINATE_FILE" },
        updatedBy,
      ).catch(() => {
        // Provenance is a display value now. Losing it costs a badge, not a
        // record; the property_corner_source row is what makes this document
        // processed, and it is already written.
      });

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
      // In both cases the corner-source claim is released so the document is
      // free to be processed again — a claim that outlived its Property would
      // lock the document out permanently (Slice #23.06.Import).
      //
      // Release BEFORE the delete would also work (ON DELETE CASCADE would
      // take the row anyway), but doing it explicitly and first keeps the
      // rollback readable and correct even if the property delete fails.
      if (createdPropertyId && claimedCornerSource) {
        await releaseCornerSourceLink(documentId, createdPropertyId).catch(() => {
          // Best-effort release — do not mask the original error.
        });
      }
      if (createdPropertyId) {
        await db
          .delete(dbProperty)
          .where(eq(dbProperty.id, createdPropertyId))
          .catch(() => {
            // Best-effort cleanup — do not mask the original error.
          });
      }
      throw err;
    }

  } catch (err) {
    return unexpectedError(err, "POST /api/documents/[id]/process");
  }
}
