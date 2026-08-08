/**
 * POST /api/documents/[id]/process
 *
 * "Process" a document that contains a plain-text file of Stereo 70
 * cadastral coordinates:
 *
 * In the order the code runs them. Every number below is a `── n.` marker you
 * can search for in the body — a header list that counts differently from the
 * function is a map of somewhere else:
 *
 *  1-4. Auth, loads the document, finds its first text/plain page file, and
 *     parses the Stereo 70 coordinate lines (shared parser from
 *     stereo70-parse.ts). Fewer than 3 corners → 422.
 *  5. Looks at the document's entity tags for a "property folder" tag
 *     (any tag whose first character is a digit — e.g. "1-2-livada") and
 *     parses tarla + parcela out of the most specific one.
 *  6. Cheap pre-check: does this document already have a corner-source row?
 *     → 409 `conflict: "document"`.
 *  6.5 (Slice #26.07.fix) If step 5's tarla and parcela form a cadastral
 *     identity — both halves present AND of cadastral SHAPE — asks whether
 *     that parcel already has a Property, under the same advisory lock the
 *     import wizard uses, and REFUSES with 409 `conflict: "parcel"` if it
 *     does. Only an unidentified parcel reaches the unconditional create.
 *  7. Creates the Property from the parsed corners.
 *  7.05 Atomically CLAIMS the document as that Property's corner source by
 *     inserting into property_corner_source (UNIQUE on document_id) with
 *     ON CONFLICT DO NOTHING. Losing the race means another path already
 *     turned this document into a Property → 409, and the Property just
 *     created here is compensated away.
 *  7.10 Copies the document's folder tags onto the new Property.
 *  7.15 (Slice #23.06.Import) Provenance of the new Property. Provenance is no
 *     longer the lock — it is still stamped, COORDINATE_FILE is accurate here
 *     because this route really did parse coordinates, but nothing reads it to
 *     decide already-processed. Skipped on the #26.07.fix path, where the
 *     create already stamped it.
 *  7.20 Finds every Document and Person that shares the tag from step 5 and
 *     associates them all with the new Property.
 *  7.90 Calls patchEntityMetadata to stamp provenance on the SOURCE document
 *     and write the version snapshot + audit trail.
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
 *   409  — one of TWO conflicts, told apart by `conflict`:
 *            "document" — this document already produced a Property (an
 *              existing property_corner_source row, or a concurrent request
 *              that won the claim). The user's intent is satisfied.
 *            "parcel"   — this document's tarla and parcela already belong to
 *              a Property that something ELSE created. Nothing was processed
 *              and nothing was written; a second Property for one parcel is
 *              what #26.07 exists to stop. (Slice #26.07.fix)
 *            Both carry { propertyId, propertyCode } so the caller can link
 *            straight to the Property that does exist — nullable on the
 *            claim-loss 409, where the winner is re-read and may already have
 *            been compensated away. The parcel conflict adds { matchCount },
 *            because two Properties for one parcel is a different problem from
 *            one and needs different advice, and { tarla, parcela }, because
 *            with several matches a code names an arbitrary one of them and
 *            the parcel itself is the only thing worth naming.
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
import { ensurePropertyForFolder } from "@/lib/properties/import-property";
import { hasCadastralIdentity, looksCadastral } from "@/lib/properties/cadastral-identity";
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
    //
    // ⚠️ **This ranking was left alone by #26.07.fix, and the attempt is worth
    // recording so it is not made again.** Preferring a cadastral-SHAPED pair
    // over a longer tag inside a tier looks like an easy win: a document filed
    // under both an archive folder and its parcel folder carries both tags, and
    // "2019-2020 dosare vechi" (22 chars) beats "47per2-2" (8) on length alone.
    // But shape does not separate the two kinds of folder, it only correlates
    // with one of them. Turn the preference on and `2019-2020` (cadastral: two
    // bare numbers) beats `12-superficie teren` (not cadastral: a parcela made
    // of words) — so a real property folder loses to its archive ancestor, the
    // archive's halves get written into the Property's identity columns, and
    // `findEntitiesByTag` then associates the whole archive to it. That is a
    // worse failure than the one it fixes, and it is not hypothetical: both
    // names come from this codebase's own examples.
    //
    // So the tie stays on length, and an ambiguous tag simply fails
    // `looksCadastral` at step 6.5 and falls through to the unconditional
    // create — the behaviour that shipped before this slice. The fix for both
    // shapes is the same one: retire `parseFolderName` from this route in
    // favour of #26.01's grammar, which is its own slice.
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
          conflict:     "document",
          propertyId:   existingLink.propertyId,
          propertyCode: existingLink.propertyCode,
        },
        { status: 409 },
      );
    }

    // ── 6.5  Does this parcel already have a Property?  (Slice #26.07.fix) ──
    //
    // #26.07 made the import create one Property per cadastral identity under
    // an advisory lock. This route could still create a second: its lock is
    // `property_corner_source`, UNIQUE on DOCUMENT — so two coordinate
    // documents for one parcel, or one for a parcel the wizard had already
    // imported, each produced a duplicate. Nothing detected it, and the next
    // import of that folder then reported `ambiguous` and told a business user
    // to delete one of two Properties that both looked real.
    //
    // ⚠️ **It REFUSES rather than links, and that is deliberate — twice over.**
    // The wizard has a screen, so it can ask "this exists, may I attach your
    // documents to it?" and wait. This is one POST behind one button.
    //
    // An earlier draft of this slice ADOPTED the existing Property instead,
    // to rescue two states a refusal walls off: a wizard-made Property with no
    // corners (whose geometry is then reachable only by hand-typing), and an
    // orphan left by a run of this route that died before claiming. Three
    // adversarial rounds found five defects in it, and the last was measured
    // rather than argued: adoption gives a Property a SECOND possible claimer,
    // and `property_corner_source` has no unique index on `property_id` to stop
    // two documents both claiming one polygon. An `INSERT … WHERE NOT EXISTS`
    // does not close that — under READ COMMITTED the sub-select reads a
    // snapshot taken before the concurrent insert commits, and a four-client
    // run on Postgres 16 put two sources on 1706 of 2000 properties. The
    // guarantee needs `CREATE UNIQUE INDEX … (property_id)`, which is a
    // migration; adoption is worth having and belongs in the slice that adds
    // it. Refusing is recoverable by a user who can see what is in their way.
    // Silent double-sourcing is not.
    //
    // The identity comes from the folder TAG parsed in step 5 — the legacy
    // `parseFolderName`, not #26.01's strict grammar, because these are legacy
    // tags and the strict grammar rejects the shape they have
    // ("47per2-225per3per24-2716 prisecaru", no `||`). Both paths reach the
    // same key: `perToSlash` above, `cadastralKey` inside the lookup.
    //
    // ⚠️ **`looksCadastral` on BOTH halves, not merely non-empty.**
    // `hasCadastralIdentity` is the wizard's question, right there because
    // #26.01's grammar has already refused everything that is not a cadastral
    // segment. Here `parseFolderName` splits on the first `-` and returns
    // whatever follows: `2019-2020 dosare` is tarla "2019" / parcela
    // "2020 dosare", and `12-superficie teren` becomes parcela
    // "su/ficie teren" once `perToSlash` has run. Both are non-empty. Treating
    // either as an identity would let the FIRST coordinate document in an
    // archive folder claim it and lock every other document there — genuinely
    // different parcels — out of ever producing a Property.
    //
    // A document whose tags yield no identity falls through to the
    // unconditional create below, exactly as before. That is not a hole left
    // open so much as one that cannot be closed here: `hasCadastralIdentity`
    // refuses half an identity precisely because a Property carrying one could
    // never be found again, so there is nothing to compare it to. Leading zeros
    // are the same shape — `047/2` and `47/2` are two identities to
    // `cadastralKey`, deliberately, because the database stores what it is
    // given.
    const parcelIdentified =
      hasCadastralIdentity(tarlaSola, parcela) &&
      looksCadastral(tarlaSola as string) &&
      looksCadastral(parcela as string);

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
      const nickname = propertyTag ?? textPage.fileName ?? null;

      /**
       * Two creates, and the difference is whether there is an identity to
       * dedupe on.
       *
       * With one, `ensurePropertyForFolder` is reused verbatim: the advisory
       * lock, the lookup and the insert in one transaction, which is the only
       * arrangement in which "there is no Property for this parcel" is still
       * true at the moment the row lands. Called WITHOUT a `confirm`, so it
       * writes nothing when it finds a match — it reports it, which is exactly
       * the 409 this route needs.
       *
       * Without one, the old unconditional `createProperty`. Nothing else is
       * available: there is no key to lock on and nothing to look up.
       */
      let propertyId: string;
      let propertyCode: string;
      let propertyPrincipalObjId: string;
      let provenanceAlreadyStamped = false;

      if (parcelIdentified) {
        const outcome = await ensurePropertyForFolder(
          { tarlaSola: tarlaSola as string, parcela: parcela as string, nickname, corners },
          updatedBy,
        );

        if (outcome.outcome !== "created") {
          // `linked` and `stale` need a `confirm`, which the call above does
          // not send — so anything but `needs-confirmation` here is a broken
          // contract, not a state to render. Answering it with `matchCount: 0`
          // produced a panel sentence naming no property at all.
          if (outcome.outcome !== "needs-confirmation") {
            throw new Error(
              `ensurePropertyForFolder answered ${outcome.outcome} without a confirm`,
            );
          }

          // ── Did THIS document produce a Property while we were deciding? ──
          //
          // Two Process requests for one document — two tabs, or a click, a
          // reload and a second click — both pass step 6, and the second finds
          // what the first created. That is not a parcel conflict: the document
          // HAS been processed, by its own coordinates, and telling the user
          // "nu s-a creat nimic" while asking them to correct the tag of the
          // Property they just made is the confusion `parcelTaken` was added to
          // prevent, inverted.
          //
          // ⚠️ **Best-effort, and the narrow case it does NOT catch is the
          // interesting one.** The loser is woken by the advisory lock the
          // moment the winner's transaction COMMITS — which is before the
          // winner has stamped provenance and claimed the corner source. So a
          // loser that was blocked on the lock reads a corner source that is
          // not there yet and reports `parcel`, about a Property built from its
          // own file. (A loser that arrives after the winner has claimed never
          // gets this far — step 6 answers it.) Nothing is written either way
          // and pressing again answers `document` from step 6, so the cost is one wrong
          // sentence on a repeat click; closing it properly means claiming
          // inside `ensurePropertyForFolder`'s transaction, which is the same
          // migration adoption needs. The panel re-reads the corner source
          // before it renders this refusal, which shuts the window in practice.
          const ownLink = await getCornerSourceForDocument(documentId);
          if (ownLink) {
            return NextResponse.json(
              {
                error:        "Document already processed",
                conflict:     "document",
                propertyId:   ownLink.propertyId,
                propertyCode: ownLink.propertyCode,
              },
              { status: 409 },
            );
          }

          const [first] = outcome.matches;
          return NextResponse.json(
            {
              error:        "Parcel already has a property",
              conflict:     "parcel",
              propertyId:   first?.id ?? null,
              propertyCode: first?.code ?? null,
              matchCount:   outcome.matches.length,
              // The identity itself, because with several matches a code names
              // an arbitrary one of them and the user is left with a refusal
              // about a parcel the screen never names. These are the written
              // forms — `perToSlash` has already run.
              tarla:        tarlaSola,
              parcela,
            },
            { status: 409 },
          );
        }

        createdPropertyId      = outcome.property.id;
        propertyId             = outcome.property.id;
        propertyCode           = outcome.property.code;
        propertyPrincipalObjId = outcome.property.principalObjectId;
        // ensurePropertyForFolder stamps COORDINATE_FILE on a create carrying
        // corners, and this route never creates one without them.
        provenanceAlreadyStamped = true;
      } else {
        const created = await createProperty(
          { nickname, tarlaSola, parcela, corners },
          updatedBy,
        );
        createdPropertyId      = created.property.id;
        propertyId             = created.property.id;
        propertyCode           = created.property.code;
        propertyPrincipalObjId = created.property.principalObjectId;
      }

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
            conflict:     "document",
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
      // Slice #26.07.fix: skipped on the identified path, where
      // `ensurePropertyForFolder` has already written it. Two writes of one
      // value is how they drift.
      //
      // ⚠️ **And `.catch()`, because "best-effort" was only true of the inside
      // of that function.** It swallows a database without the provenance
      // lookup table; it does not swallow a dropped connection. An unswallowed
      // rejection here lands in the compensating catch below, which releases
      // the claim and DELETES a Property built from real parsed corners — for
      // a metadata badge. Step 7.90 already guards its own metadata write with
      // exactly this reasoning, in those words; this call was the one that had
      // the comment without the guard.
      const propertyProvenance = provenanceAlreadyStamped
        ? null
        : inferProvenance("COORDINATE_FILE");
      if (propertyProvenance) {
        await setInitialProvenance(propertyPrincipalObjId, propertyProvenance, updatedBy)
          .catch(() => {
            // Best-effort — never at the cost of the Property.
          });
      }

      // ── 7.20  Associate everything that shares the folder tag ─────────────
      //
      // All Documents and Persons carrying the property folder tag from step 5.
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
