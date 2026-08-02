/**
 * POST /api/documents/[id]/ai-interpret
 *
 * Slice #21.02.Import — server-side AI field extraction for an existing
 * document.  Unlike the import-wizard's POST /api/admin/import/extract-document
 * (which receives an image from the client), this route reads the document's
 * uploaded pages directly from storage, so no client-side PDF rasterisation
 * is needed.
 *
 * Slice #21.03.Import — the extraction prompt is now built dynamically per the
 * document's own type: a small fixed baseline (title, nrDocument, dateDocument,
 * subject) plus, when the type has one, its template_fields (see
 * src/lib/documents/template-fields.ts). Every document already has a
 * documentTypeId (NOT NULL FK), so the type — and its template — is always
 * known up front; no chicken-and-egg with classification.
 *
 * Slice #21.03.Import (multi-page) — ALL of the document's pages are sent to
 * the model in one call, not just the first. Verified against a real
 * Contract de Vânzare: the notarial "Încheiere de autentificare" block that
 * carries nrDocument/dateDocument/institution is typically on the LAST page,
 * not the first — page-1-only extraction was systematically missing those
 * fields for authenticated acts. Cost scales with page count; that trade-off
 * was chosen deliberately over missing this data.
 *
 * Supports (per page, mixed within one document is fine):
 *   - image/* pages → sent as Anthropic image block
 *   - application/pdf pages → sent as Anthropic document block (PDF beta)
 *   - unsupported pages (e.g. stray .txt coordinate files) are skipped
 *     individually rather than failing the whole request, as long as at
 *     least one page is usable.
 *
 * Slice #21.04.Import (party extraction) — when the document's type has
 * person roles configured (Reference Data → Document Persons, e.g.
 * "Vânzător"/"Cumpărător"/"Notar"/"Reprezentant legal / Mandatar" for
 * Contract de Vânzare), the prompt also asks for structured parties per
 * role, and each extracted party is matched against existing Persons by
 * exact CNP/CUI (never fuzzy). This route only extracts + matches — it
 * never creates a Person or writes person_document rows; that's the
 * confirm-or-create UI (a later slice) built on top of this response.
 *
 * On success, returns:
 *   {
 *     fields:       { documentTypeId, title, nrDocument, dateDocument, subject },
 *     customFields: Record<string, string | null>,  // template-defined values
 *     notes:        string | null,                   // "Enhanced Notes" — unmappedRaw
 *                                                      // formatted as readable text,
 *                                                      // or null when nothing was unmapped
 *     lowConfidenceFields: string[],
 *     unmappedRaw:         Record<string, string>,
 *     parties:             ExtractedParty[],  // see type below — [] if partyRolesConfigured is false
 *     partyRolesConfigured: boolean,          // false = this document type has no roles set up yet
 *   }
 *   The caller fills form fields (fields + customFields, appends notes) and
 *   PATCHes ai_interpreted_at separately via PATCH /api/documents/[id].
 *
 *   lowConfidenceFields / unmappedRaw are also still logged to the server
 *   console for a quick terminal read — but as of this slice they are no
 *   longer console-only: returning them in the response body lets the
 *   AI-Interpret click be driven and inspected end-to-end via browser
 *   automation, without needing to copy anything out of the dev-server
 *   terminal.
 *
 * Slice #21.10.Import — this route now has TWO modes, selected by an optional
 * `{ "mode": "discover" }` request body. A bodyless POST (what every existing
 * caller sends) keeps the schema-driven "extract" behaviour described above,
 * unchanged.
 *
 * In "discover" mode the model gets NO target field list at all and is asked to
 * report the document verbatim, split into label -> value pairs and
 * model-inferred sections. It exists for document types the system does not
 * understand yet, where the schema-driven prompt's four baseline fields plus a
 * flat `unmappedRaw` leftovers map systematically under-reads the page.
 *
 * Discover mode PERSISTS NOTHING: no field mapping, no customFields, no
 * documentTypeId resolution (so it never auto-creates a lookup_document_type
 * row the way the extract path does), no party extraction, no
 * ai_interpreted_at stamp. It is safe to run on any document, repeatedly. The
 * report goes to the dev-server console (src/lib/documents/discover-log.ts) and
 * is mirrored in the response body.
 *
 * Rate-limited (same 10/min per user as the import-wizard routes).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { lookupDocumentType } from "@/db/schema";
import { unexpectedError } from "@/lib/api/errors";
import {
  buildDiscoverSystemPrompt,
  buildExtractSystemPrompt,
  GENERIC_EXTRACT_FIELD_DESCRIPTIONS,
  KNOWN_TYPE_KEYS,
} from "@/lib/import/classify-prompts";
import {
  formatDiscoverLog,
  parseDiscoverPayload,
  type DiscoverPayload,
  type SkippedPage,
} from "@/lib/documents/discover-log";
import { createValue } from "@/lib/admin/value-lists/queries";
import {
  getDocumentById,
  getDocumentTypeTemplate,
  listPersonRolesForDocumentType,
} from "@/lib/documents/queries";
import { listDocumentPages } from "@/lib/documents/pages-queries";
import { readFileContent } from "@/lib/storage";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { checkOcrRateLimit } from "@/lib/rate-limit/ocr";
import {
  findNaturalPersonByCnp,
  searchPersonsAll,
  type NaturalPersonMatchCandidate,
  type PersonSearchItem,
} from "@/lib/persons/queries";
import {
  findJudicialPersonByCui,
  type JudicialPersonMatchCandidate,
} from "@/lib/judicial-persons/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const EXTRACT_MODEL = "claude-sonnet-4-6";

type Ctx = { params: Promise<{ id: string }> };

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;

  // ── Mode (Slice #21.10.Import) ─────────────────────────────────────────────
  //
  // "extract" (default, and what a bodyless POST still gets — the existing
  // callers send no body at all) is the schema-driven path this route has
  // always had. "discover" reads the document with NO target field list and
  // reports everything to the dev console; it persists nothing, so it is safe
  // to run on any document at any time.
  const bodyJson = (await req.json().catch(() => ({}))) as { mode?: unknown };
  const isDiscover = bodyJson.mode === "discover";

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rl = checkOcrRateLimit(await getCurrentUserId());
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Prea multe cereri. Încercați din nou în curând.", code: "rate_limited_local" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server", code: "no_api_key" },
      { status: 500 },
    );
  }

  // ── Get all pages ──────────────────────────────────────────────────────────
  let pages: Awaited<ReturnType<typeof listDocumentPages>>;
  try {
    pages = await listDocumentPages(id);
  } catch (err) {
    return unexpectedError(err, "ai-interpret:list-pages");
  }

  if (pages.length === 0) {
    return Response.json(
      { error: "Nu există pagini încărcate pentru acest document.", code: "no_pages" },
      { status: 422 },
    );
  }

  // ── Resolve the document's type + template (Slice #21.03.Import) ──────────
  // documentTypeId is NOT NULL on every document, so we always know which
  // template to extract into — no chicken-and-egg with classification. The
  // model is still free to suggest a different type below (unchanged
  // behaviour); if it does, a follow-up AI-Interpret run after the type
  // change will build its prompt from the new type's template.
  const docMeta = await getDocumentById(id);
  if (!docMeta) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }
  const typeTemplate = await getDocumentTypeTemplate(docMeta.documentTypeId);
  const templateFields = typeTemplate?.fields ?? [];

  // ── Party roles for this document type (Slice #21.04.Import) ──────────────
  // Only ask the model to look for parties when the type has roles
  // SPECIFICALLY configured (no "show every role from every type" fallback
  // here — see listPersonRolesForDocumentType's own comment). If none are
  // configured, partyRoles stays empty, buildExtractSystemPrompt omits the
  // "parties" section entirely, and the response tells the caller this type
  // isn't set up for party linking yet rather than guessing at role names.
  //
  // Discover mode skips this lookup entirely: it extracts no parties, so
  // asking the DB for roles would be work whose result is thrown away.
  const partyRoles = isDiscover
    ? []
    : await listPersonRolesForDocumentType(docMeta.documentTypeId);
  const partyRoleNames = partyRoles.map((r) => r.name);

  const typeHintText = typeTemplate
    ? ` Known document type: ${typeTemplate.name} (${typeTemplate.key}).`
    : "";

  // Discover mode deliberately does NOT pass typeHintText: naming the
  // registered type would anchor the model back onto that type's expected
  // fields, which is exactly the schema-fitting this mode exists to avoid.
  // The registered type is still printed in the console report for context.
  const systemPrompt = isDiscover
    ? buildDiscoverSystemPrompt()
    : buildExtractSystemPrompt(templateFields, partyRoleNames);

  // ── Read all pages from storage, building one Anthropic content block per
  // supported page (Slice #21.03.Import multi-page) ─────────────────────────
  const SUPPORTED_IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type SupportedImage = (typeof SUPPORTED_IMAGES)[number];

  type ContentBlock =
    | { type: "image";    source: { type: "base64"; media_type: SupportedImage; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
    | { type: "text";     text: string };

  const isTextFile = (p: { mimeType: string | null; fileName: string }) =>
    p.mimeType === "text/plain" || p.fileName.toLowerCase().endsWith(".txt");

  const fileBlocks: ContentBlock[] = [];
  const skippedPages: SkippedPage[] = [];
  let sawPdf = false;

  /**
   * Why a page could not be sent — Slice #21.10.Import.
   *
   * Previously an unsupported page was skipped with only a code comment to
   * explain it, which made two very different failures indistinguishable from
   * the outside: "the model found nothing" and "the model never saw this page".
   * The application/octet-stream case is the one worth calling out by name —
   * it means the browser recorded no MIME type at upload (the File System
   * Access API leaves File.type empty for some files on Windows), so the page
   * is perfectly readable on disk and skipped purely on a bookkeeping gap.
   */
  function skipReason(page: { mimeType: string | null; fileName: string }): string {
    if (isTextFile(page)) {
      return "plain-text file (cadastral coordinates or notes) — the model is sent images and PDFs only";
    }
    if (!page.mimeType || page.mimeType === "application/octet-stream") {
      return "no MIME type was recorded when this page was uploaded, so its format cannot be confirmed";
    }
    return "unsupported format — only JPEG/PNG/GIF/WebP images and PDF can be sent";
  }

  for (const page of pages) {
    const pageMimeType = page.mimeType ?? "application/octet-stream";

    if ((SUPPORTED_IMAGES as readonly string[]).includes(pageMimeType)) {
      let buf: Buffer;
      try {
        buf = await readFileContent(page.filePath);
      } catch (err) {
        return unexpectedError(err, "ai-interpret:read-file");
      }
      fileBlocks.push({
        type: "image",
        source: { type: "base64", media_type: pageMimeType as SupportedImage, data: buf.toString("base64") },
      });
    } else if (pageMimeType === "application/pdf") {
      let buf: Buffer;
      try {
        buf = await readFileContent(page.filePath);
      } catch (err) {
        return unexpectedError(err, "ai-interpret:read-file");
      }
      fileBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
      });
      sawPdf = true;
    } else {
      // Unsupported page (e.g. .txt coordinate files, .docx, .rtf) — skipped
      // individually rather than failing the whole request, but recorded so
      // discover mode can report it instead of leaving a silent gap.
      skippedPages.push({
        fileName: page.fileName,
        mimeType: page.mimeType,
        reason: skipReason(page),
      });
    }
  }

  const extraHeaders: Record<string, string> = sawPdf ? { "anthropic-beta": "pdfs-2024-09-25" } : {};

  if (fileBlocks.length === 0) {
    // None of this document's pages are in a supported format — return a
    // user-friendly 422 rather than sending garbage bytes to Anthropic.
    const allText = pages.every(isTextFile);
    const friendlyMsg = allText
      ? "Fișierele text (coordonate cadastrale) nu pot fi interpretate cu AI. Funcția este disponibilă doar pentru imagini și PDF-uri."
      : "Niciuna dintre paginile acestui document nu este într-un format acceptat pentru interpretare AI (imagine sau PDF).";
    // Slice #21.10.Import: carry the per-page reasons in the body. "Nothing
    // could be read" is only actionable if you can see WHICH page was rejected
    // and why — especially for the octet-stream case, where the file itself is
    // fine and only its recorded MIME type is missing.
    return Response.json(
      { error: friendlyMsg, code: "unsupported_file_type", skippedPages },
      { status: 422 },
    );
  }

  // ── Call Anthropic ─────────────────────────────────────────────────────────
  let anthropicRes: globalThis.Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...extraHeaders,
      },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        // Slice #21.04.Import: raised from 2048 — with party extraction
        // (multiple people per role, ~10 fields each) plus unmappedRaw plus
        // template fields, output for a document with several parties can
        // exceed 2048 tokens and get truncated mid-JSON (observed on the
        // real Contract de Vânzare sample, 4 sellers + buyer + mandatar +
        // notary). 8192 leaves generous headroom.
        // Slice #21.10.Import: discover mode asks for the document's content
        // VERBATIM, so its output is bounded by the document's length rather
        // than by a fixed field count — a long contract can easily exceed the
        // 8192 that suffices for schema-driven extraction. Truncation here is
        // not a degraded answer but a wrong one (silently missing pages of
        // content), so the ceiling is raised and a stop_reason check below
        // reports it loudly if it is still hit.
        max_tokens: isDiscover ? 16384 : 8192,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              ...fileBlocks,
              {
                type: "text",
                text: isDiscover
                  ? `Read this Romanian document (${fileBlocks.length} page(s), in order — treat them as one document) and report everything printed on it, exactly as instructed. Do not omit anything.`
                  : `Extract fields from this Romanian document (${fileBlocks.length} page(s), in order — treat them as one document; the closing/authentication block is often on the last page).${typeHintText}`,
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    return unexpectedError(err, "ai-interpret:fetch");
  }

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text().catch(() => "");
    let code = "unknown";
    let message = `Anthropic API error (HTTP ${anthropicRes.status})`;
    try {
      const parsed = JSON.parse(detail) as { error?: { type?: string; message?: string } };
      const t = parsed.error?.type ?? "";
      const m = parsed.error?.message ?? "";
      if (/credit balance is too low/i.test(m)) { code = "insufficient_credits"; message = m; }
      else if (anthropicRes.status === 401 || t === "authentication_error") { code = "invalid_api_key"; message = m || message; }
      else if (anthropicRes.status === 429 || t === "rate_limit_error") { code = "rate_limited"; message = m || message; }
      else if (anthropicRes.status === 529 || t === "overloaded_error") { code = "overloaded"; message = m || message; }
    } catch { /* non-JSON body */ }
    console.error("[ai-interpret] Anthropic error:", anthropicRes.status, detail);
    return Response.json(
      { error: message, code },
      { status: anthropicRes.status >= 500 ? 502 : anthropicRes.status },
    );
  }

  const anthropicJson = (await anthropicRes.json()) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
  };
  const textBlock = anthropicJson.content?.find((b) => b.type === "text")?.text;
  if (!textBlock) {
    return Response.json({ error: "Anthropic API returned no text" }, { status: 502 });
  }
  const hitOutputLimit = anthropicJson.stop_reason === "max_tokens";

  // ── Discover mode (Slice #21.10.Import) ────────────────────────────────────
  //
  // Returns before every line of the extraction path below: discover mode maps
  // nothing into `fields`/`customFields`, resolves no documentTypeId (and so
  // never auto-creates a lookup_document_type row), extracts no parties and
  // stamps no ai_interpreted_at. It reads and reports, and that is all.
  if (isDiscover) {
    let payload: DiscoverPayload;
    try {
      payload = parseDiscoverPayload(extractJson(textBlock));
    } catch (err) {
      console.error("[ai-discover] failed to parse model output:", textBlock, err);
      return Response.json(
        { error: "Could not parse discover response", raw: textBlock },
        { status: 502 },
      );
    }

    console.log(
      formatDiscoverLog({
        pageFileNames: pages.map((p) => p.fileName),
        pagesSent: fileBlocks.length,
        pagesTotal: pages.length,
        registeredTypeName: typeTemplate?.name ?? null,
        registeredTypeKey: typeTemplate?.key ?? null,
        skipped: skippedPages,
        truncated: hitOutputLimit,
        payload,
      }),
    );

    // Same payload in the body as on the console — the precedent Slice
    // #21.02.Import set when it stopped making these diagnostics console-only,
    // so a run can be driven and inspected end-to-end by browser automation.
    return Response.json({
      mode: "discover",
      documentLabel: payload.documentLabel,
      recognised: payload.recognised,
      sections: payload.sections,
      skippedPages,
      pagesSent: fileBlocks.length,
      pagesTotal: pages.length,
      truncated: hitOutputLimit,
    });
  }

  type RawParty = {
    roleName?:           string;
    personType?:         "NATURAL" | "JUDICIAL";
    name?:               string | null;
    firstName?:          string | null;
    lastName?:           string | null;
    cnp?:                string | null;
    cuiNumber?:          string | null;
    idDocumentNumber?:   string | null;
    idIssuingAuthority?: string | null;
    domiciliu?:          string | null;
    rawText?:            string;
  };

  type AiExtractResponse = {
    fields?: Record<string, string | null>;
    suggestedTypeKey?: string | null;
    classifiedLabel?: string | null;
    lowConfidenceFields?: string[];
    unmappedRaw?: Record<string, string>;
    parties?: RawParty[];
  };

  // Extracted party, enriched with the resolved lookup_person_role id (by
  // exact name match — see listPersonRolesForDocumentType) and, when a
  // CNP/CUI was extracted, a possible existing-Person match candidate. The
  // caller (Slice #21.04.Import UI, not yet built) is responsible for
  // confirming matches and creating/linking Person records — this route
  // only extracts and matches, it never writes person/person_document rows.
  type ExtractedParty = {
    roleName:           string;
    personRoleId:       string | null;
    roleMissing:        boolean;   // true if roleName didn't match a configured role — don't guess, ask the admin
    personType:         "NATURAL" | "JUDICIAL";
    name:               string | null;
    firstName:          string | null;
    lastName:           string | null;
    cnp:                string | null;
    cuiNumber:          string | null;
    idDocumentNumber:   string | null;
    idIssuingAuthority: string | null;
    domiciliu:          string | null;
    rawText:            string;
    matchCandidate:     NaturalPersonMatchCandidate | JudicialPersonMatchCandidate | null;
    // Fuzzy name-match suggestions — only populated when there's no exact
    // CNP/CUI match (either because none was extracted, e.g. sellers on a
    // sale contract, or the CNP/CUI didn't match anyone). Name matching is
    // inherently uncertain, so these are always "possible", never treated
    // as confirmed the way matchCandidate is — the confirm UI must label
    // them accordingly and still require an explicit user decision.
    possibleMatches:    PersonSearchItem[];
  };

  // Split by known-key membership: generic baseline keys → `fields`;
  // template-defined keys for the active type → `customFieldsOut`. Any other
  // stray key the model might invent is ignored — unmappedRaw is the
  // sanctioned channel for "doesn't fit a known field".
  const fields: Record<string, string | null> = {};
  const customFieldsOut: Record<string, string | null> = {};
  let suggestedTypeKey: string | null = null;
  let classifiedLabel: string | null = null;
  let lowConfidenceFields: string[] = [];
  let unmappedRaw: Record<string, string> = {};
  let enhancedNotes: string | null = null;
  const parties: ExtractedParty[] = [];

  try {
    const raw = extractJson(textBlock) as AiExtractResponse;
    const allFields = raw.fields ?? {};
    const templateKeys = new Set(templateFields.map((f) => f.key));

    for (const [k, v] of Object.entries(allFields)) {
      if (k in GENERIC_EXTRACT_FIELD_DESCRIPTIONS) fields[k] = v;
      else if (templateKeys.has(k)) customFieldsOut[k] = v;
    }

    suggestedTypeKey =
      raw.suggestedTypeKey &&
      (KNOWN_TYPE_KEYS as readonly string[]).includes(raw.suggestedTypeKey) &&
      raw.suggestedTypeKey !== "UNCLASSIFIED"
        ? raw.suggestedTypeKey
        : null;
    classifiedLabel = raw.classifiedLabel?.trim() || null;
    lowConfidenceFields = Array.isArray(raw.lowConfidenceFields) ? raw.lowConfidenceFields : [];
    unmappedRaw = raw.unmappedRaw && typeof raw.unmappedRaw === "object" ? raw.unmappedRaw : {};

    // ── Enhanced Notes (Slice #21.03.Import Phase 2) — fold anything the
    // model couldn't map to a field into readable text instead of silently
    // dropping it. The client appends this to the document's existing notes;
    // it never overwrites them.
    if (Object.keys(unmappedRaw).length > 0) {
      const lines = Object.entries(unmappedRaw).map(([label, val]) => `${label}: ${val}`);
      enhancedNotes = `[AI] Text neasociat unui câmp:\n${lines.join("\n")}`;
    }

    // ── Party extraction + matching (Slice #21.04.Import) ─────────────────────
    // Resolve each extracted party's roleName to a real lookup_person_role.id
    // by exact name match (case/whitespace-insensitive) against the roles we
    // actually gave the model — never a fuzzy guess. If a role somehow
    // doesn't match (model invented a name, or roles changed mid-request),
    // roleMissing=true tells the caller to surface it rather than link
    // against the wrong role or silently drop the party.
    const roleByName = new Map<string, string>(partyRoles.map((r) => [r.name.trim().toLowerCase(), r.id]));
    const rawParties = Array.isArray(raw.parties) ? raw.parties : [];

    for (const p of rawParties) {
      const roleName = p.roleName?.trim();
      if (!roleName) continue; // no role named — nothing to link this party to, skip

      const personRoleId = roleByName.get(roleName.toLowerCase()) ?? null;
      const personType: "NATURAL" | "JUDICIAL" = p.personType === "JUDICIAL" ? "JUDICIAL" : "NATURAL";

      let matchCandidate: NaturalPersonMatchCandidate | JudicialPersonMatchCandidate | null = null;
      let possibleMatches: PersonSearchItem[] = [];
      try {
        if (personType === "NATURAL" && p.cnp?.trim()) {
          matchCandidate = await findNaturalPersonByCnp(p.cnp);
        } else if (personType === "JUDICIAL" && p.cuiNumber?.trim()) {
          matchCandidate = await findJudicialPersonByCui(p.cuiNumber);
        }

        // No CNP/CUI extracted (or it matched nobody) — fall back to a
        // fuzzy name search so the confirm UI can at least surface "maybe
        // this one?" instead of always defaulting to create-new. These are
        // never auto-linked; the UI must label them as unconfirmed guesses.
        if (!matchCandidate) {
          const fullName = (p.name ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`).trim();
          if (fullName) {
            const { items } = await searchPersonsAll({ name: fullName, type: personType, limit: 5, offset: 0 });
            possibleMatches = items;
          }
        }
      } catch (err) {
        // Non-fatal: a failed match lookup shouldn't sink the whole
        // extraction — the party is still returned, just without a candidate.
        console.warn("[ai-interpret] party match lookup failed:", err);
      }

      parties.push({
        roleName,
        personRoleId,
        roleMissing: personRoleId === null,
        personType,
        name: p.name ?? null,
        firstName: p.firstName ?? null,
        lastName: p.lastName ?? null,
        cnp: p.cnp ?? null,
        cuiNumber: p.cuiNumber ?? null,
        idDocumentNumber: p.idDocumentNumber ?? null,
        idIssuingAuthority: p.idIssuingAuthority ?? null,
        domiciliu: p.domiciliu ?? null,
        rawText: p.rawText ?? "",
        matchCandidate,
        possibleMatches,
      });
    }

    // ── Diagnostic log — what did the model actually extract? ────────────────
    const extractedGeneric = Object.entries(fields).filter(([, v]) => v !== null && v !== "");
    const extractedCustom  = Object.entries(customFieldsOut).filter(([, v]) => v !== null && v !== "");
    console.log("\n─────────────────────────────────────────────────────");
    console.log(`[ai-interpret] Document: ${pages.map((p) => p.fileName).join(", ")} (${fileBlocks.length}/${pages.length} page(s) sent)`);
    console.log(`  Type       : ${typeTemplate?.name ?? "(unresolved)"} (${typeTemplate?.key ?? "?"}) — ${templateFields.length} template field(s)`);
    console.log(`  AI reclass : ${suggestedTypeKey ?? "(none)"} / ${classifiedLabel ?? "(none)"}`);
    console.log(`  Generic fields extracted (${extractedGeneric.length}):`);
    for (const [k, v] of extractedGeneric) console.log(`    ${k.padEnd(22)}: ${v}`);
    if (extractedCustom.length) {
      console.log(`  Template fields extracted (${extractedCustom.length}):`);
      for (const [k, v] of extractedCustom) console.log(`    ${k.padEnd(22)}: ${v}`);
    }
    if (lowConfidenceFields.length)
      console.log(`  Low confidence : ${lowConfidenceFields.join(", ")}`);
    if (Object.keys(unmappedRaw).length) {
      console.log(`  Unmapped text (${Object.keys(unmappedRaw).length}) — candidate template fields for "${typeTemplate?.name ?? "?"}":`);
      for (const [label, val] of Object.entries(unmappedRaw))
        console.log(`    "${label}" → "${val}"`);
    }
    if (partyRoles.length === 0) {
      console.log(`  Parties     : (skipped — no person roles configured for "${typeTemplate?.name ?? "?"}" in Reference Data → Document Persons)`);
    } else if (parties.length) {
      console.log(`  Parties extracted (${parties.length}):`);
      for (const p of parties) {
        const idBit = p.cnp ? ` CNP ${p.cnp}` : p.cuiNumber ? ` CUI ${p.cuiNumber}` : "";
        const matchBit = p.matchCandidate
          ? ` — exact match: ${p.matchCandidate.displayName} (${p.matchCandidate.code})`
          : p.possibleMatches.length
            ? ` — ${p.possibleMatches.length} possible name match(es), unconfirmed`
            : p.roleMissing ? " — ROLE NOT CONFIGURED" : "";
        console.log(`    [${p.roleName}] ${p.name ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()}${idBit}${matchBit}`);
      }
    }
    console.log("─────────────────────────────────────────────────────\n");
  } catch (err) {
    console.error("[ai-interpret] failed to parse model output:", textBlock, err);
    return Response.json(
      { error: "Could not parse extraction response", raw: textBlock },
      { status: 502 },
    );
  }

  // ── Resolve documentTypeId ──────────────────────────────────────────────────
  // 1. Match by known typeKey slug in the DB.
  // 2. Fall back to match by label name.
  // 3. Auto-create if the label is meaningful and not already present.
  // NOTE: if this switches the document to a different type than the one the
  // prompt above was built for, customFieldsOut still reflects the *old*
  // type's template for this run — a follow-up AI Interpret click after the
  // type change picks up the new type's template.
  let documentTypeId: string | null = null;
  try {
    if (suggestedTypeKey) {
      const [byKey] = await db
        .select({ id: lookupDocumentType.id })
        .from(lookupDocumentType)
        .where(and(eq(lookupDocumentType.key, suggestedTypeKey), isNull(lookupDocumentType.deletedAt)));
      if (byKey) documentTypeId = byKey.id;
    }

    if (!documentTypeId && classifiedLabel && classifiedLabel !== "Document necunoscut") {
      const [byName] = await db
        .select({ id: lookupDocumentType.id })
        .from(lookupDocumentType)
        .where(and(eq(lookupDocumentType.name, classifiedLabel), isNull(lookupDocumentType.deletedAt)));
      if (byName) {
        documentTypeId = byName.id;
      } else {
        // Auto-create a new document type (key auto-generated from name).
        const newRow = await createValue("document-types", { name: classifiedLabel });
        documentTypeId = newRow.id as string;
      }
    }
  } catch (err) {
    // Non-fatal: log and continue — fields are still useful even without a type.
    console.warn("[ai-interpret] documentTypeId resolution failed:", err);
  }

  return Response.json({
    fields: { ...fields, documentTypeId },
    customFields: customFieldsOut,
    notes: enhancedNotes,
    lowConfidenceFields,
    unmappedRaw,
    // Slice #21.04.Import (party extraction) — see ExtractedParty above.
    // partyRolesConfigured=false means this document type has no roles set
    // up in Reference Data → Document Persons yet; parties is always [] in
    // that case rather than a guess against unrelated roles.
    parties,
    partyRolesConfigured: partyRoles.length > 0,
  });
}
