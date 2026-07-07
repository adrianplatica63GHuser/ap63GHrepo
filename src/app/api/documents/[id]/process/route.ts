/**
 * POST /api/documents/[id]/process
 *
 * "Process" a document that contains a plain-text file of Stereo 70
 * cadastral coordinates:
 *
 *  1. Reads the document's first text/plain page file.
 *  2. Parses Stereo 70 coordinate lines (same logic as /api/properties/parse-text).
 *  3. Creates a new Property from the parsed corners.
 *  4. Looks at the document's entity tags for a "property folder" tag
 *     (any tag whose first character is a digit — e.g. "1-2-livada").
 *  5. Finds every Document and Person that shares that tag and associates
 *     them all with the newly-created Property.
 *  6. Records `provenance = "PROP:{code}"` on this document's metadata.
 *
 * Response: { propertyId, propertyCode, documentCount, personCount }
 *
 * Errors (4xx):
 *   401  — unauthenticated
 *   404  — document not found
 *   409  — document already processed (provenance already starts with "PROP:")
 *   422  — no text page found, or fewer than 3 corners parsed
 *   500  — unexpected error
 *
 * Runtime: Node.js — required because stereo70ToWgs84 reads grid files from disk.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse }     from "next/server";
import { and, eq, isNull }  from "drizzle-orm";
import { db }               from "@/db";
import { document }         from "@/db/schema";
import { listDocumentPages }            from "@/lib/documents/pages-queries";
import { readFileContent }              from "@/lib/storage";
import { stereo70ToWgs84 }             from "@/lib/geo/transdatRO";
import {
  listEntityTags,
  getEntityMetadata,
  findEntitiesByTag,
  patchEntityMetadata,
} from "@/lib/metadata/queries";
import {
  createProperty,
  associateDocumentsToProperty,
  associatePersonsToProperty,
} from "@/lib/properties/queries";
import { createServerClient } from "@/lib/supabase/server";
import { unexpectedError }    from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Stereo 70 line parser — copied verbatim from /api/properties/parse-text
// ---------------------------------------------------------------------------

function isStereo(n: number): boolean {
  const i = Math.floor(Math.abs(n));
  return i >= 100_000 && i <= 999_999;
}

function parseLine(
  line: string,
): { northing: number; easting: number; originalIndex: number | null } | null {
  const tokens = line
    .trim()
    .split(/[\s,;|\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length < 2) return null;

  // 3-column format: leading token (< 1 000) + X + Y
  if (tokens.length >= 3) {
    const idx = parseFloat(tokens[0].replace(",", "."));
    if (Number.isFinite(idx) && idx < 1_000) {
      const northing = parseFloat(tokens[1].replace(",", "."));
      const easting  = parseFloat(tokens[2].replace(",", "."));
      if (!isNaN(northing) && isStereo(northing) && !isNaN(easting) && isStereo(easting)) {
        return { northing, easting, originalIndex: idx };
      }
    }
  }

  // 2-column format: first token is itself Stereo 70
  const firstNum = parseFloat(tokens[0].replace(",", "."));
  if (!isNaN(firstNum) && isStereo(firstNum)) {
    const secondNum = parseFloat(tokens[1].replace(",", "."));
    if (!isNaN(secondNum) && isStereo(secondNum)) {
      return { northing: firstNum, easting: secondNum, originalIndex: null };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id: documentId } = await ctx.params;

  // Auth
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const updatedBy = user.email ?? user.id ?? null;

  try {
    // ── 1. Load document ──────────────────────────────────────────────────
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

    // ── 2. Guard: already processed? ──────────────────────────────────────
    const meta = await getEntityMetadata(principalObjectId);
    if (meta.provenance?.startsWith("PROP:")) {
      return NextResponse.json(
        { error: "Document already processed", provenance: meta.provenance },
        { status: 409 },
      );
    }

    // ── 3. Find text page ─────────────────────────────────────────────────
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

    // ── 4. Read and parse coordinates ──────────────────────────────────────
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

    // ── 5. Identify property-folder tag (first tag starting with a digit) ──
    const tags = await listEntityTags(principalObjectId);
    const propertyTag = tags.find((t) => /^\d/.test(t)) ?? null;

    // Parse tarlaSola / parcela from "tarla-parcela-rest" pattern
    let tarlaSola: string | null = null;
    let parcela:   string | null = null;
    if (propertyTag) {
      const parts = propertyTag.split("-");
      if (parts.length >= 2) {
        tarlaSola = parts[0].trim() || null;
        parcela   = parts[1].trim() || null;
      }
    }

    // ── 6. Create property ─────────────────────────────────────────────────
    const created = await createProperty(
      {
        nickname:   propertyTag ?? textPage.fileName ?? null,
        tarlaSola,
        parcela,
        corners,
      },
      updatedBy,
    );

    const propertyId   = created.property.id;
    const propertyCode = created.property.code;

    // ── 7. Associate sibling entities via the property-folder tag ──────────
    let documentCount = 0;
    let personCount   = 0;

    if (propertyTag) {
      const entities = await findEntitiesByTag(propertyTag);

      const docIds    = entities.documents.map((d) => d.id);
      const personIds = entities.persons.map((p) => p.id);

      if (docIds.length > 0) {
        await associateDocumentsToProperty(propertyId, docIds);
        documentCount = docIds.length;
      }
      if (personIds.length > 0) {
        await associatePersonsToProperty(propertyId, personIds, null);
        personCount = personIds.length;
      }
    }

    // ── 8. Mark document as processed ─────────────────────────────────────
    await patchEntityMetadata(
      principalObjectId,
      { field: "provenance", value: `PROP:${propertyCode}` },
      updatedBy,
    );

    return NextResponse.json({ propertyId, propertyCode, documentCount, personCount });

  } catch (err) {
    return unexpectedError(err, "POST /api/documents/[id]/process");
  }
}
