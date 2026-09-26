/**
 * The AI extraction of a document's fields, as a module both the route and a
 * script can call.                                         (Slice #36.22 → #36.23)
 *
 * Until Slice #36.23 all of this lived inline in
 * `src/app/api/documents/[id]/ai-interpret/route.ts`, between an auth check and
 * a database read, so the only way to run the application's extraction was an
 * HTTP request with a signed-in session. The AI score harness
 * (`scripts/testing/ai-score.ts`) has to run THE SAME extraction over pages on
 * disk — a harness that restated the prompt would score itself, and be believed
 * (`scripts/testing/measure-title-loss.ts`). So the four steps that turn pages
 * into fields moved here, verbatim, and the route calls them:
 *
 *   1. `buildPageBlocks`       — pages → the model's content blocks, and the
 *                                pages that cannot be sent, with the reason;
 *   2. `buildExtractRequestBody` — the Messages API body, for extract or discover;
 *   3. `callAnthropic`         — the one HTTP call, and its error mapping;
 *   4. `interpretExtractText`  — the model's text → fields, template fields,
 *                                notes, parties (before any database matching),
 *                                referenced instruments.
 *
 * ⚠️ **PURE OF THE DATABASE, THE SESSION AND NEXT.** Every import below is a
 * module with no `@/db`, no `next/*` and no storage client, which is what lets a
 * plain `tsx` script import this file. What stays in the route is exactly what
 * needs those: the session and the rate limit, the document's pages and type
 * from the database, reading a page from storage, matching a party to a Person,
 * and resolving the classified type.
 *
 * ⚠️ **BEHAVIOUR-PRESERVING.** The strings the model sees, the model id, the
 * token ceilings, the header, the key split and the party normalisation are the
 * route's own, moved and not rewritten. `src/__tests__/ai-extract.test.ts` pins
 * the request shape and the interpretation; the route's own behaviour is what
 * the import wizard's cases drive.
 */

import {
  GENERIC_EXTRACT_FIELD_DESCRIPTIONS,
  canonicalTypeKey,
} from "@/lib/import/classify-prompts";
import {
  sanitizeExtractedInstrument,
  type ReferencedInstrument,
} from "@/lib/documents/referenced-instruments";
import type { SkippedPage } from "@/lib/documents/discover-log";
import { identityPersonCountOf } from "@/lib/import/multi-card-gate";
import {
  MODEL_IMAGE_MIME_TYPES,
  OCTET_STREAM,
  contentTypeOf,
  type ModelImageMimeType,
} from "@/lib/files/file-mime";
import type { DocumentTemplateField } from "@/lib/documents/template-fields";

export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const EXTRACT_MODEL = "claude-sonnet-4-6";
export const ANTHROPIC_VERSION = "2023-06-01";
export const PDF_BETA_HEADER = "pdfs-2024-09-25";

export function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// 1. Pages → content blocks
// ---------------------------------------------------------------------------

export type ContentBlock =
  | { type: "image";    source: { type: "base64"; media_type: ModelImageMimeType; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  | { type: "text";     text: string };

/** A page as the extraction needs it: its name, its recorded type, and a way to read it. */
export type ExtractPage = {
  fileName: string;
  mimeType: string | null;
};

export function isTextFile(p: { mimeType: string | null; fileName: string }): boolean {
  return p.mimeType === "text/plain" || p.fileName.toLowerCase().endsWith(".txt");
}

/**
 * Why a page could not be sent — Slice #21.10.Import.
 *
 * Previously an unsupported page was skipped with only a code comment to
 * explain it, which made two very different failures indistinguishable from
 * the outside: "the model found nothing" and "the model never saw this page".
 * The unrecognised-extension case is the one worth calling out by name.
 * Until Slice #34.06 that case was `application/octet-stream` — the browser
 * had recorded no MIME type at upload (the File System Access API leaves
 * File.type empty for some files on Windows) and a perfectly readable scan
 * was skipped on a bookkeeping gap. The type is now taken from the file
 * name, here and at upload, so what remains is the honest case: a stored
 * page whose extension this system has never heard of.
 */
export function skipReason(page: { mimeType: string | null; fileName: string }): string {
  if (isTextFile(page)) {
    return "plain-text file (cadastral coordinates or notes) — the model is sent JPEG, PNG, GIF or WebP images and PDFs only";
  }
  if (!contentTypeOf(page.fileName)) {
    return "this system does not recognise the page's format from its name";
  }
  return "unsupported format — only JPEG/PNG/GIF/WebP images and PDF can be sent";
}

export type PageBlocks = {
  fileBlocks: ContentBlock[];
  skippedPages: SkippedPage[];
  sawPdf: boolean;
  /** The `anthropic-beta` header a PDF page needs, or nothing. */
  extraHeaders: Record<string, string>;
};

/**
 * One content block per page the model can read, in page order.
 *
 * `read` is how a page's bytes are obtained — storage for the route, the disk
 * for the harness. A read that throws propagates: the route turns it into its
 * `ai-interpret:read-file` error, as it did before this moved.
 */
export async function buildPageBlocks<P extends ExtractPage>(
  pages: readonly P[],
  read: (page: P) => Promise<Buffer>,
): Promise<PageBlocks> {
  const fileBlocks: ContentBlock[] = [];
  const skippedPages: SkippedPage[] = [];
  let sawPdf = false;

  for (const page of pages) {
    // ⚠️ EXTENSION FIRST (Slice #34.06), for the same reason the upload route
    // now records the extension's type: every page stored before that change
    // could carry `application/octet-stream` because `File.type` was empty at
    // upload on Windows, and dispatching on the recorded value alone made a
    // perfectly readable scan unreadable for ever on a bookkeeping gap.
    const pageMimeType = contentTypeOf(page.fileName) ?? (page.mimeType || OCTET_STREAM);

    if ((MODEL_IMAGE_MIME_TYPES as readonly string[]).includes(pageMimeType)) {
      const buf = await read(page);
      fileBlocks.push({
        type: "image",
        source: { type: "base64", media_type: pageMimeType as ModelImageMimeType, data: buf.toString("base64") },
      });
    } else if (pageMimeType === "application/pdf") {
      const buf = await read(page);
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
        // The DERIVED type, not the recorded one (Slice #34.06): `skipReason`
        // is computed from the extension, so reporting a stored
        // `application/octet-stream` beside it would contradict it.
        mimeType: pageMimeType,
        reason: skipReason(page),
      });
    }
  }

  const extraHeaders: Record<string, string> = sawPdf ? { "anthropic-beta": PDF_BETA_HEADER } : {};
  return { fileBlocks, skippedPages, sawPdf, extraHeaders };
}

// ---------------------------------------------------------------------------
// 2. The request body
// ---------------------------------------------------------------------------

export type ExtractRequestInput = {
  isDiscover: boolean;
  systemPrompt: string;
  fileBlocks: readonly ContentBlock[];
  /** `" Known document type: <name> (<key>)."`, or "" — extract mode only. */
  typeHintText: string;
};

/** The hint the route appends for the document's registered type. */
export function typeHintTextFor(type: { name: string; key: string } | null): string {
  return type ? ` Known document type: ${type.name} (${type.key}).` : "";
}

export function buildExtractRequestBody(input: ExtractRequestInput): Record<string, unknown> {
  const { isDiscover, systemPrompt, fileBlocks, typeHintText } = input;
  return {
    model: EXTRACT_MODEL,
    // Slice #21.04.Import: raised from 2048 — with party extraction (multiple
    // people per role, ~10 fields each) plus unmappedRaw plus template fields,
    // output for a document with several parties can exceed 2048 tokens and get
    // truncated mid-JSON. 8192 leaves generous headroom.
    // Slice #21.10.Import: discover mode asks for the document's content
    // VERBATIM, so its output is bounded by the document's length rather than
    // by a fixed field count — the ceiling is raised and the caller checks
    // stop_reason.
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
  };
}

// ---------------------------------------------------------------------------
// 3. The call
// ---------------------------------------------------------------------------

export type AnthropicCallResult =
  | { ok: true; textBlock: string; hitOutputLimit: boolean }
  | { ok: false; kind: "http"; status: number; code: string; message: string; detail: string }
  | { ok: false; kind: "no-text" };

/**
 * POST the body to the Messages API. A network failure throws (the route turns
 * it into its `ai-interpret:fetch` error); an HTTP error comes back mapped to
 * the codes the wizard reads.
 */
export async function callAnthropic(
  apiKey: string,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const res = await fetchImpl(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let code = "unknown";
    let message = `Anthropic API error (HTTP ${res.status})`;
    try {
      const parsed = JSON.parse(detail) as { error?: { type?: string; message?: string } };
      const t = parsed.error?.type ?? "";
      const m = parsed.error?.message ?? "";
      if (/credit balance is too low/i.test(m)) { code = "insufficient_credits"; message = m; }
      else if (res.status === 401 || t === "authentication_error") { code = "invalid_api_key"; message = m || message; }
      else if (res.status === 429 || t === "rate_limit_error") { code = "rate_limited"; message = m || message; }
      else if (res.status === 529 || t === "overloaded_error") { code = "overloaded"; message = m || message; }
    } catch { /* non-JSON body */ }
    return { ok: false, kind: "http", status: res.status, code, message, detail };
  }

  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
  };
  const textBlock = json.content?.find((b) => b.type === "text")?.text;
  if (!textBlock) return { ok: false, kind: "no-text" };
  return { ok: true, textBlock, hitOutputLimit: json.stop_reason === "max_tokens" };
}

// ---------------------------------------------------------------------------
// 4. The model's text → fields
// ---------------------------------------------------------------------------

/** A party exactly as the model returned it. */
export type RawParty = {
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
  // Slice #36.01 — the cotă-parte the deed gives this party in this role.
  // Strings, because that is what the model is asked for; the numbers they
  // become are `person_document`'s (36.02), parsed where a row is written.
  cotaParte?:          string | null;
  cotaSuprafataMp?:    string | null;
  cotaMod?:            string | null;
  rawText?:            string;
};

type AiExtractResponse = {
  fields?: Record<string, string | null>;
  suggestedTypeKey?: string | null;
  classifiedLabel?: string | null;
  lowConfidenceFields?: string[];
  identityPersonCount?: unknown;
  unmappedRaw?: Record<string, string>;
  parties?: RawParty[];
  referencedInstruments?: unknown[];
};

/** A party with its role named and every field present — before any database matching. */
export type InterpretedParty = {
  roleName:           string;
  personType:         "NATURAL" | "JUDICIAL";
  name:               string | null;
  firstName:          string | null;
  lastName:           string | null;
  cnp:                string | null;
  cuiNumber:          string | null;
  idDocumentNumber:   string | null;
  idIssuingAuthority: string | null;
  domiciliu:          string | null;
  cotaParte:          string | null;
  cotaSuprafataMp:    string | null;
  cotaMod:            string | null;
  rawText:            string;
};

export type InterpretedExtraction = {
  /** Generic baseline keys (title, nrDocument, dateDocument, subject). */
  fields: Record<string, string | null>;
  /** Keys of the document type's own template. */
  customFields: Record<string, string | null>;
  suggestedTypeKey: string | null;
  classifiedLabel: string | null;
  lowConfidenceFields: string[];
  identityPersonCount: number | null;
  unmappedRaw: Record<string, string>;
  /** „[AI] Text neasociat unui câmp: …", or null when nothing was unmapped. */
  enhancedNotes: string | null;
  /** Parties with a role, in the model's order. A party with no role is dropped. */
  parties: InterpretedParty[];
  referencedInstruments: ReferencedInstrument[];
};

/**
 * Parse the model's answer. Throws when it is not the JSON asked for — the
 * route answers that with its 502 „Could not parse extraction response".
 */
export function interpretExtractText(
  textBlock: string,
  templateFields: readonly DocumentTemplateField[],
): InterpretedExtraction {
  const raw = extractJson(textBlock) as AiExtractResponse;
  const allFields = raw.fields ?? {};
  const templateKeys = new Set(templateFields.map((f) => f.key));

  // Split by known-key membership: generic baseline keys → `fields`;
  // template-defined keys for the active type → `customFields`. Any other
  // stray key the model might invent is ignored — unmappedRaw is the
  // sanctioned channel for "doesn't fit a known field".
  const fields: Record<string, string | null> = {};
  const customFields: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(allFields)) {
    if (k in GENERIC_EXTRACT_FIELD_DESCRIPTIONS) fields[k] = v;
    else if (templateKeys.has(k)) customFields[k] = v;
  }

  // Slice #29.07: a string, on the whitelist, not UNCLASSIFIED — one function
  // that the scan route and the resolver ask too.
  const suggestedTypeKey = canonicalTypeKey(raw.suggestedTypeKey);
  const classifiedLabel = raw.classifiedLabel?.trim() || null;
  const lowConfidenceFields = Array.isArray(raw.lowConfidenceFields) ? raw.lowConfidenceFields : [];
  // Sanitised by the multi-card gate's own function (Slice #32.08).
  const identityPersonCount = identityPersonCountOf(raw.identityPersonCount);
  const unmappedRaw = raw.unmappedRaw && typeof raw.unmappedRaw === "object" ? raw.unmappedRaw : {};

  // ── Enhanced Notes (Slice #21.03.Import Phase 2) — fold anything the model
  // couldn't map to a field into readable text instead of silently dropping it.
  let enhancedNotes: string | null = null;
  if (Object.keys(unmappedRaw).length > 0) {
    const lines = Object.entries(unmappedRaw).map(([label, val]) => `${label}: ${val}`);
    enhancedNotes = `[AI] Text neasociat unui câmp:\n${lines.join("\n")}`;
  }

  const parties: InterpretedParty[] = [];
  const rawParties = Array.isArray(raw.parties) ? raw.parties : [];
  for (const p of rawParties) {
    const roleName = p.roleName?.trim();
    if (!roleName) continue; // no role named — nothing to link this party to, skip
    parties.push({
      roleName,
      personType: p.personType === "JUDICIAL" ? "JUDICIAL" : "NATURAL",
      name: p.name ?? null,
      firstName: p.firstName ?? null,
      lastName: p.lastName ?? null,
      cnp: p.cnp ?? null,
      cuiNumber: p.cuiNumber ?? null,
      idDocumentNumber: p.idDocumentNumber ?? null,
      idIssuingAuthority: p.idIssuingAuthority ?? null,
      domiciliu: p.domiciliu ?? null,
      cotaParte: p.cotaParte ?? null,
      cotaSuprafataMp: p.cotaSuprafataMp ?? null,
      cotaMod: p.cotaMod ?? null,
      rawText: p.rawText ?? "",
    });
  }

  // ── Referenced instruments (Slice #36.03) — the type key goes through
  // `canonicalTypeKey`, the same door `suggestedTypeKey` goes through; a key
  // that does not survive it becomes `null`, and `typeLabel` still carries what
  // the page said. Nothing here is matched against the archive.
  const referencedInstruments: ReferencedInstrument[] = [];
  const rawInstruments = Array.isArray(raw.referencedInstruments) ? raw.referencedInstruments : [];
  for (const entry of rawInstruments) {
    const clean = sanitizeExtractedInstrument(entry);
    if (clean === null) continue;
    referencedInstruments.push({ ...clean, typeKey: canonicalTypeKey(clean.typeKey) });
  }

  return {
    fields,
    customFields,
    suggestedTypeKey,
    classifiedLabel,
    lowConfidenceFields,
    identityPersonCount,
    unmappedRaw,
    enhancedNotes,
    parties,
    referencedInstruments,
  };
}
