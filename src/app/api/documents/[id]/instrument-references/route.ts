/**
 * /api/documents/[id]/instrument-references                     (Slice #36.03)
 *
 * The instruments a document's own pages CITE, and the three things a person
 * may do with one of them.
 *
 * GET  — the stored reading, each entry with its ranked candidates, plus the
 *        document-type list and a suggested type per entry so the stub form
 *        needs no second round trip.
 * POST — one of four actions, every one of which a PERSON initiated:
 *          replace — store the array a fresh AI read returned
 *          link    — associate this reference with an existing document
 *          stub    — create a page-less document for it, then associate
 *          leave   — record that nobody could place it
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A ROUTE OF ITS OWN AND NOT PART OF `PATCH /api/documents/[id]`
 * ---------------------------------------------------------------------------
 *
 * `updateDocument` appends a `document_version` row whenever a versioned field
 * changed, and `referenced_instruments` is not one — it is operational
 * metadata, like `ai_interpreted_at` and `import_title`. Going through the
 * document PATCH would mean a version entry every time somebody pressed
 * „recitește" or answered one reference: entries in which nothing a user can
 * see has changed. `documentUpdateSchema` deliberately does not accept the key,
 * so this is not the preferred door, it is the only one.
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE LINKS ANYTHING A PERSON DID NOT CHOOSE
 * ---------------------------------------------------------------------------
 *
 * ⚠️ **THERE IS NO THRESHOLD IN THIS FILE AND THERE IS NOT MEANT TO BE ONE.**
 * `rankInstrumentCandidates` returns an ORDERED LIST for a human to read; the
 * top entry is not treated differently from the third anywhere in this route.
 * The `link` action takes a `documentId` the caller sent, and the caller got it
 * by the user clicking it. That is the whole of the automation policy and it is
 * the reason the ranking can afford to be generous: a suggestion that is wrong
 * costs a glance, where an auto-link that is wrong costs a corrupted chain of
 * title that nobody will notice for a year.
 */

import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { lookupDocumentType, lookupInstitution } from "@/db/schema";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { getCurrentUserEmail } from "@/lib/auth/current-user";
import { matchInstitution } from "@/lib/import/lookup-name-match";
import { sameDocumentTypeName } from "@/lib/documents/document-type-match";
import {
  PURPOSE_ROLE_NAME,
  foldDocumentNumber,
  linkDirection,
  rankInstrumentCandidates,
  sanitizeExtractedInstrument,
  type InstrumentPurpose,
  type ReferencedInstrument,
} from "@/lib/documents/referenced-instruments";
import {
  associateDocumentToDocument,
  createInstrumentStub,
  findDocumentDocumentRoleByName,
  getDocumentById,
  getReferencedInstruments,
  listInstrumentCandidateDocuments,
  saveReferencedInstruments,
} from "@/lib/documents/queries";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ⚠️ **THE TYPE LIST IS READ ONCE AND SHARED BY EVERY ENTRY**, rather than
 * resolved per reference in a loop. A deed cites five instruments and the list
 * is forty rows; reading it five times would be four reads for nothing.
 */
async function documentTypes() {
  return db
    .select({ id: lookupDocumentType.id, key: lookupDocumentType.key, name: lookupDocumentType.name })
    .from(lookupDocumentType)
    .orderBy(asc(lookupDocumentType.name));
}

/**
 * The type a stub for this reference should be created as, as a SUGGESTION.
 *
 * Key first, because `canonicalTypeKey` has already whitelisted it in the
 * ai-interpret route and a key is exact. Then the model's own Romanian label,
 * through `sameDocumentTypeName` — the fold that already decides „Contract de
 * arendă" and „Contract de arenda" are one type, rather than a fourth
 * comparison rule. `null` when neither resolves, and the dialog then makes the
 * user choose: **this function never creates a type**, which is the difference
 * between it and `resolveClassifiedDocumentType`. That function exists to file
 * a document that must go somewhere; a stub that has not been asked for yet may
 * simply not be created, so inventing a `lookup_document_type` row off a
 * citation nobody has confirmed would be minting reference data from a guess.
 */
function suggestTypeId(
  ref: ReferencedInstrument,
  types: { id: string; key: string; name: string }[],
): string | null {
  if (ref.typeKey) {
    const byKey = types.find((t) => t.key === ref.typeKey);
    if (byKey) return byKey.id;
  }
  if (ref.typeLabel) {
    const byName = types.find((t) => sameDocumentTypeName(t.name, ref.typeLabel!));
    if (byName) return byName.id;
  }
  return null;
}

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const stored = await getReferencedInstruments(id);
    const types = await documentTypes();

    // `null` means never read — a different answer from „read, cited nothing",
    // and the tab renders two different sentences for them.
    if (stored === null) {
      return Response.json({ read: false, items: [], documentTypes: types });
    }

    const items = await Promise.all(
      stored.map(async (instrument, index) => {
        // A settled reference needs no candidates: the screen shows what it
        // became, and ranking it again is a query per already-answered row
        // every time the dialog is opened.
        if (instrument.status !== "PENDING") {
          return { index, instrument, candidates: [], suggestedTypeId: suggestTypeId(instrument, types) };
        }
        const folded = foldDocumentNumber(instrument.nrDocument);
        const pool = folded === "" ? [] : await listInstrumentCandidateDocuments(id, folded);
        return {
          index,
          instrument,
          candidates: rankInstrumentCandidates(instrument, pool),
          suggestedTypeId: suggestTypeId(instrument, types),
        };
      }),
    );

    return Response.json({ read: true, items, documentTypes: types });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/[id]/instrument-references");
  }
}

const replaceSchema = z.object({
  action: z.literal("replace"),
  instruments: z.array(z.unknown()),
});

const linkSchema = z.object({
  action: z.literal("link"),
  index: z.number().int().min(0),
  documentId: z.string().uuid(),
});

const stubSchema = z.object({
  action: z.literal("stub"),
  index: z.number().int().min(0),
  documentTypeId: z.string().uuid(),
});

const leaveSchema = z.object({
  action: z.literal("leave"),
  index: z.number().int().min(0),
});

const bodySchema = z.discriminatedUnion("action", [
  replaceSchema,
  linkSchema,
  stubSchema,
  leaveSchema,
]);

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;

  let raw: unknown;
  try { raw = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  const body = parsed.data;

  try {
    const doc = await getDocumentById(id);
    if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

    // ── replace ────────────────────────────────────────────────────────────
    //
    // ⚠️ **EVERY ENTRY COMES BACK AS `PENDING`, INCLUDING ON A RE-READ, AND
    // THAT IS A DELIBERATE LOSS.** A second read of the same deed produces a
    // fresh array, and matching its entries against the previous one's
    // statuses would need an identity for a citation — which is the model's
    // wording, which is exactly what changes between two reads of one scan.
    // Carrying a status across on a fuzzy match would mean a reference silently
    // inheriting „already linked" from a DIFFERENT instrument. So a re-read
    // re-asks, and the links already written stay written: they are
    // `document_document` rows, which this action does not touch. The tab warns
    // before a re-read for exactly this reason.
    if (body.action === "replace") {
      const clean: ReferencedInstrument[] = [];
      for (const entry of body.instruments) {
        const one = sanitizeExtractedInstrument(entry);
        if (one !== null) clean.push(one);
      }
      await saveReferencedInstruments(id, clean);
      return Response.json({ stored: clean.length });
    }

    // ── the three per-reference actions ────────────────────────────────────
    const stored = await getReferencedInstruments(id);
    if (stored === null || body.index >= stored.length) {
      return Response.json(
        { error: "No stored reference at that index", code: "reference_gone" },
        { status: 409 },
      );
    }
    const ref = stored[body.index];

    if (body.action === "leave") {
      stored[body.index] = { ...ref, status: "LEFT", linkedDocumentId: null };
      await saveReferencedInstruments(id, stored);
      return Response.json({ status: "LEFT" });
    }

    // Both remaining actions end in a link, so both need the role — and a
    // purpose the model did not give means there is no role to link under.
    //
    // ⚠️ **A MISSING PURPOSE IS REFUSED RATHER THAN DEFAULTED.** Linking under
    // „Înscris doveditor pentru" because it is the commonest answer would put a
    // wrong, directional, confident-looking role on a chain of title. The
    // dialog lets the user pick the purpose when the model gave none, and this
    // is the door that makes sure it did.
    const purpose: InstrumentPurpose | null = ref.purpose;
    if (purpose === null) {
      return Response.json(
        { error: "This reference has no purpose, so there is no role to link it under", code: "no_purpose" },
        { status: 422 },
      );
    }

    const roleName = PURPOSE_ROLE_NAME[purpose];
    const roleId = await findDocumentDocumentRoleByName(roleName);
    if (roleId === null) {
      // ⚠️ Named in the response so the screen can say WHICH role is missing
      // and where to add it. Reference Data can rename or delete any of the
      // four migration_086 seeded, and a link written with a null role is the
      // „Consolidat cu"-shaped silence this slice exists to stop producing.
      return Response.json(
        { error: `Relationship role not found: ${roleName}`, code: "role_missing", roleName },
        { status: 422 },
      );
    }

    const email = await getCurrentUserEmail();

    // ── stub ───────────────────────────────────────────────────────────────
    let targetId: string;
    let createdStub: { id: string; code: string } | null = null;
    if (body.action === "stub") {
      const institutions = await db
        .select({ id: lookupInstitution.id, name: lookupInstitution.name })
        .from(lookupInstitution)
        .orderBy(asc(lookupInstitution.sortOrder), asc(lookupInstitution.name));

      // ⚠️ **A `null` HERE IS NOT A LICENCE TO CREATE**, which is
      // `matchInstitution`'s own rule and `src/lib/import/id-card.ts`'s refusal
      // one module over: an institution row only ever comes from a person
      // pressing „adaugă". The issuer as PRINTED is not lost either — it is in
      // the stub's `importTitle` below, and in the reference's own `rawText`.
      const institutionId = matchInstitution(ref.issuer, institutions);

      // The title a person will see in a list of documents. It is composed
      // rather than copied because a stub has no printed heading to copy: its
      // whole existence is a citation on somebody else's page, and the code of
      // that page is what makes it findable.
      const parts = [
        ref.typeLabel ?? ref.typeKey ?? "Înscris",
        ref.nrDocument ? `nr. ${ref.nrDocument}` : null,
        ref.dateDocument,
        ref.issuer,
      ].filter((v): v is string => Boolean(v));
      const importTitle = `${parts.join(" · ")} (schiță, citat în ${doc.code})`;

      const stub = await createInstrumentStub({
        documentTypeId: body.documentTypeId,
        nrDocument:     ref.nrDocument,
        dateDocument:   ref.dateDocument,
        institutionId,
        importTitle,
        updatedBy:      email,
      });
      targetId = stub.id;
      createdStub = { id: stub.id, code: stub.code };
    } else {
      targetId = body.documentId;
      if (targetId === id) {
        return Response.json(
          { error: "A document cannot reference itself", code: "self_reference" },
          { status: 422 },
        );
      }
    }

    // ── the link ───────────────────────────────────────────────────────────
    //
    // `linkDirection` is the ONE place the uuid order is looked at. The purpose
    // says which way the sentence on the page reads — „titlu -> deed" for a
    // title chain, „act adițional -> parent" for a supplement — and this turns
    // that into the (a, b, flag) triple the table stores.
    const { roleReadsAToB } = linkDirection(id, targetId, purpose);
    const result = await associateDocumentToDocument(id, [targetId], roleId, roleReadsAToB);

    // ⚠️ **„ALREADY ASSOCIATED" IS AN ANSWER, NOT A SILENT NO-OP.** Before this
    // slice `.onConflictDoNothing()` swallowed it: the pair was already linked,
    // nothing was written, and the screen advanced as though something had
    // been. The stored entry is NOT marked LINKED here, deliberately — this
    // call changed nothing, so claiming it did would be the same silence in the
    // column instead of on the screen. The dialog shows the sentence, names the
    // role the pair already carries, and „Lasă" is one click away.
    if (result.inserted === 0) {
      const existing = result.alreadyLinked[0] ?? null;
      return Response.json(
        {
          code: "already_associated",
          documentId: targetId,
          existingRoleName: existing?.roleName ?? null,
          // A stub really was created even though the link did nothing — which
          // can only happen if the user stubbed twice for one reference. Said
          // out loud so the screen can name the orphan rather than leave it.
          createdStub,
        },
        { status: 200 },
      );
    }

    stored[body.index] = {
      ...ref,
      status: body.action === "stub" ? "STUBBED" : "LINKED",
      linkedDocumentId: targetId,
    };
    await saveReferencedInstruments(id, stored);

    return Response.json({
      status: body.action === "stub" ? "STUBBED" : "LINKED",
      documentId: targetId,
      roleName,
      createdStub,
    });
  } catch (err) {
    return unexpectedError(err, "POST /api/documents/[id]/instrument-references");
  }
}
