/**
 * POST /api/documents/[id]/ai-interpret
 *
 * Slice #21.02.Import — server-side AI field extraction for an existing
 * document. It reads the document's uploaded pages directly from storage, so
 * no client-side PDF rasterisation is needed. (Until Slice #23.04.Import the
 * orphaned import-wizard had its own POST /api/admin/import/extract-document,
 * which received a client-rasterised image instead; that route is gone.)
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
 *   - JPEG/PNG/GIF/WebP pages → sent as Anthropic image block (and nothing
 *     else: a .tif or .bmp page is an image everywhere else in this app and is
 *     refused here — Slice #34.06)
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
 *     referencedInstruments: ReferencedInstrument[],  // Slice #36.03 — see below
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
 * Slice #36.03 (referenced instruments) — the prompt also asks for the OTHER
 * instruments the document's pages name: the titlu de proprietate the seller's
 * right came from, the certificat de moștenitor before it, the certificat
 * fiscal, the extras CF, the procură, the antecontract, the parent contract an
 * act adițional completes. They come back as `referencedInstruments`, a
 * structured array on exactly the `parties[]` contract: extracted, reported,
 * and WRITTEN BY NOBODY. Each carries the type key (whitelisted through
 * `canonicalTypeKey`), the number and date as printed, the issuer, what the
 * instrument is FOR on this deed, and the page's own wording verbatim.
 *
 * This closes a hole Slice #36.01 opened deliberately and named: #36.01 decided
 * the title chain and the supporting certificates are ASSOCIATIONS and never
 * template fields, which left the reader with nowhere to put them — so they
 * landed in `unmappedRaw` and were folded into „Note extinse" by the block
 * further down this file. That block is correct and stays; what changes is that
 * these are no longer leftovers.
 *
 * Unlike `parties`, this section is asked for on EVERY document, because the
 * four purposes are a closed list this codebase owns rather than per-type
 * configuration — there is nothing here that can be unconfigured.
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
 * Slice #26.11 — that "persists nothing" is now load-bearing rather than
 * incidental, and MUST NOT be traded away. The response body is what the
 * review dialog turns into a document type's custom form
 * (src/lib/documents/discover-to-template.ts), and the write it leads to
 * happens in a separate route the user has to accept
 * (PUT /api/document-types/[id]/template-fields). Because this call still
 * writes nothing, a user may re-run it as often as they like — on a type that
 * already has a form, to see what is still unrecognised — so nothing here may
 * ever be gated on `ai_interpreted_at`.
 *
 * Rate-limited (the same per-user, per-role allowance as the import-wizard
 * routes — @/lib/rate-limit/ocr).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import {
  buildDiscoverSystemPrompt,
  buildExtractSystemPrompt,
} from "@/lib/import/classify-prompts";
import type { ReferencedInstrument } from "@/lib/documents/referenced-instruments";
import {
  formatDiscoverLog,
  parseDiscoverPayload,
  type DiscoverPayload,
} from "@/lib/documents/discover-log";
import {
  buildExtractRequestBody,
  buildPageBlocks,
  callAnthropic,
  extractJson,
  interpretExtractText,
  isTextFile,
  typeHintTextFor,
  type PageBlocks,
} from "@/lib/documents/ai-extract";
import { resolveClassifiedDocumentType } from "@/lib/documents/resolve-document-type";
import {
  MULTI_IDENTITY_CODE,
  showsMoreThanOnePerson,
} from "@/lib/import/multi-card-gate";
import {
  getDocumentById,
  getDocumentTypeTemplate,
  listPersonRolesForDocumentType,
} from "@/lib/documents/queries";
import { listDocumentPages } from "@/lib/documents/pages-queries";
import { readFileContent } from "@/lib/storage";
import { getCurrentUserIdAndRole } from "@/lib/auth/current-role";
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

// The model id, the endpoint, the request body, the call and the reading of
// the answer live in `@/lib/documents/ai-extract` since Slice #36.23, so the AI
// score harness runs exactly this extraction without an HTTP request.

type Ctx = { params: Promise<{ id: string }> };

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

  // ── The dev-only gate is GONE (Slice #26.11) ───────────────────────────────
  //
  // Slice #23.10.dev 404'd this mode on a build with NEXT_PUBLIC_DEV_TOOLS off,
  // because discover was then a developer diagnostic whose only output was a
  // block in the dev-server terminal: it had no UI on such a build, so it had
  // no business having a route either.
  //
  // It is not a diagnostic any more. It is the only way a USER can give a
  // document type a custom form — the other writer of `template_fields` is a
  // deliberate admin API call, which is Adrian with a terminal, not Ciprian —
  // and that form is what makes every subsequent import of that type fill
  // itself in. So on Ciprian's build, where the flag is off, a 404 here would
  // mean document types could never gain a form at all. The button
  // left <DevOnly> in document-form.tsx in the same commit; a gate on the UI
  // and a gate on the endpoint were one decision and are removed as one.
  //
  // What still protects it is unchanged and is the right shape for a business
  // action rather than a diagnostic: the middleware requires a session, and the
  // rate limiter below caps it at the same per-user, per-role allowance as
  // every other Anthropic-backed route (@/lib/rate-limit/ocr).

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const { userId, role } = await getCurrentUserIdAndRole();
  const rl = checkOcrRateLimit(userId, role);
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
  // Discover mode extracts no parties, and until Slice #26.11 it skipped this
  // lookup entirely as work whose result was thrown away. It now needs the
  // ROLE NAMES for a different reason: the review step must not offer
  // "Vanzator" or "Cumparator" as a free-text custom field, because the
  // extraction prompt already asks for those as structured `parties` and the
  // import links them to real Person records. Accepting one would put a
  // second, freely-editable copy of a person's name and CNP on every document
  // of the type — exactly what src/lib/import/id-card.ts refuses to do, and
  // for the same reason. The roles are returned in the discover response and
  // nothing else here changes: the prompt still gets no parties section,
  // because buildDiscoverSystemPrompt takes no arguments at all.
  const partyRoles = await listPersonRolesForDocumentType(docMeta.documentTypeId);
  const partyRoleNames = partyRoles.map((r) => r.name);

  const typeHintText = typeHintTextFor(typeTemplate);

  // Discover mode deliberately does NOT pass typeHintText: naming the
  // registered type would anchor the model back onto that type's expected
  // fields, which is exactly the schema-fitting this mode exists to avoid.
  // The registered type is still printed in the console report for context.
  const systemPrompt = isDiscover
    ? buildDiscoverSystemPrompt()
    : buildExtractSystemPrompt(templateFields, partyRoleNames);

  // ── Read all pages from storage, building one Anthropic content block per
  // supported page (Slice #21.03.Import multi-page) ─────────────────────────
  // Which pages can be sent, and why a page cannot, is `buildPageBlocks` in
  // `@/lib/documents/ai-extract` (Slice #36.23); the bytes come from storage.
  let pageBlocks: PageBlocks;
  try {
    pageBlocks = await buildPageBlocks(pages, (page) => readFileContent(page.filePath));
  } catch (err) {
    return unexpectedError(err, "ai-interpret:read-file");
  }
  const { fileBlocks, skippedPages, extraHeaders } = pageBlocks;

  if (fileBlocks.length === 0) {
    // None of this document's pages are in a supported format — return a
    // user-friendly 422 rather than sending garbage bytes to Anthropic.
    const allText = pages.every(isTextFile);
    const friendlyMsg = allText
      ? "Fișierele text (coordonate cadastrale) nu pot fi interpretate cu AI. Funcția este disponibilă doar pentru imagini și PDF-uri."
      : "Niciuna dintre paginile acestui document nu este într-un format pe care modelul îl poate citi (imagini JPEG, PNG, GIF sau WebP ori fișiere PDF).";
    // Slice #21.10.Import: carry the per-page reasons in the body. "Nothing
    // could be read" is only actionable if you can see WHICH page was rejected
    // and why — especially for the unrecognised-extension case, which since
    // Slice #34.06 is the honest one: the octet-stream case it replaced meant
    // the file was fine and only its recorded MIME type was missing, and the
    // type is now taken from the file name at upload, at serve and here.
    return Response.json(
      { error: friendlyMsg, code: "unsupported_file_type", skippedPages },
      { status: 422 },
    );
  }

  // ── Call Anthropic ─────────────────────────────────────────────────────────
  // Token ceilings, prompt text and error mapping: `@/lib/documents/ai-extract`.
  const body = buildExtractRequestBody({ isDiscover, systemPrompt, fileBlocks, typeHintText });
  let called: Awaited<ReturnType<typeof callAnthropic>>;
  try {
    called = await callAnthropic(apiKey, body, extraHeaders);
  } catch (err) {
    return unexpectedError(err, "ai-interpret:fetch");
  }

  if (!called.ok && called.kind === "http") {
    console.error("[ai-interpret] Anthropic error:", called.status, called.detail);
    return Response.json(
      { error: called.message, code: called.code },
      { status: called.status >= 500 ? 502 : called.status },
    );
  }
  if (!called.ok) {
    return Response.json({ error: "Anthropic API returned no text" }, { status: 502 });
  }
  const textBlock = called.textBlock;
  const hitOutputLimit = called.hitOutputLimit;

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
      // Slice #26.11 — captured elsewhere, so the review step shows a row
      // matching one of these as already handled instead of offering it.
      partyRoleNames,
    });
  }

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
    /**
     * The share this party takes, AS THE DEED STATES IT.        (Slice #36.01)
     *
     * Carried out of the model's answer unparsed and unvalidated, exactly like
     * `cnp` and `domiciliu` beside it: this route matches and reports, it never
     * writes a `person_document` row. `cotaMod` is not narrowed to the four
     * values `person_document_cota_mod_check` allows either — a fifth word
     * from the model is something the linking screen has to show a human, not
     * something this boundary should silently drop.
     *
     * ⚠️ **NOTHING DOWNSTREAM READS THESE YET.** The party-linking dialog does
     * not carry the share, so today they reach the client and stop there. They
     * are extracted rather than discarded because the pages have already been
     * paid for: the alternative is asking the model for the cotă, throwing the
     * answer away, and re-reading the same scan when the dialog learns to use
     * it.
     */
    cotaParte:          string | null;
    cotaSuprafataMp:    string | null;
    cotaMod:            string | null;
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

  // The model's answer → fields, template fields, notes, parties and cited
  // instruments: `interpretExtractText` in `@/lib/documents/ai-extract`
  // (Slice #36.23). What stays here is what needs the database — matching each
  // party to a Person — and the diagnostic log.
  let fields: Record<string, string | null> = {};
  let customFieldsOut: Record<string, string | null> = {};
  let suggestedTypeKey: string | null = null;
  let classifiedLabel: string | null = null;
  let lowConfidenceFields: string[] = [];
  let unmappedRaw: Record<string, string> = {};
  let enhancedNotes: string | null = null;
  /**
   * How many distinct people's identity documents these pages show, or `null`
   * when the model did not say.                                (Slice #32.08)
   */
  let identityPersonCount: number | null = null;
  const parties: ExtractedParty[] = [];
  /**
   * The instruments this document's pages CITE (Slice #36.03). The same
   * contract `parties` has: extracted and reported, never written here; the
   * caller persists them on `document.referenced_instruments`.
   */
  let referencedInstruments: ReferencedInstrument[] = [];

  try {
    const interpreted = interpretExtractText(textBlock, templateFields);
    fields = interpreted.fields;
    customFieldsOut = interpreted.customFields;
    suggestedTypeKey = interpreted.suggestedTypeKey;
    classifiedLabel = interpreted.classifiedLabel;
    lowConfidenceFields = interpreted.lowConfidenceFields;
    identityPersonCount = interpreted.identityPersonCount;
    unmappedRaw = interpreted.unmappedRaw;
    enhancedNotes = interpreted.enhancedNotes;
    referencedInstruments = interpreted.referencedInstruments;

    // ── Party matching (Slice #21.04.Import) ─────────────────────────────────
    // Resolve each extracted party's roleName to a real lookup_person_role.id
    // by exact name match (case/whitespace-insensitive) against the roles we
    // actually gave the model — never a fuzzy guess. If a role somehow
    // doesn't match (model invented a name, or roles changed mid-request),
    // roleMissing=true tells the caller to surface it rather than link
    // against the wrong role or silently drop the party.
    const roleByName = new Map<string, string>(partyRoles.map((r) => [r.name.trim().toLowerCase(), r.id]));

    for (const p of interpreted.parties) {
      const personRoleId = roleByName.get(p.roleName.toLowerCase()) ?? null;

      let matchCandidate: NaturalPersonMatchCandidate | JudicialPersonMatchCandidate | null = null;
      let possibleMatches: PersonSearchItem[] = [];
      try {
        if (p.personType === "NATURAL" && p.cnp?.trim()) {
          matchCandidate = await findNaturalPersonByCnp(p.cnp);
        } else if (p.personType === "JUDICIAL" && p.cuiNumber?.trim()) {
          matchCandidate = await findJudicialPersonByCui(p.cuiNumber);
        }

        // No CNP/CUI extracted (or it matched nobody) — fall back to a
        // fuzzy name search so the confirm UI can at least surface "maybe
        // this one?" instead of always defaulting to create-new. These are
        // never auto-linked; the UI must label them as unconfirmed guesses.
        if (!matchCandidate) {
          const fullName = (p.name ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`).trim();
          if (fullName) {
            const { items } = await searchPersonsAll({ name: fullName, type: p.personType, limit: 5, offset: 0 });
            possibleMatches = items;
          }
        }
      } catch (err) {
        // Non-fatal: a failed match lookup shouldn't sink the whole
        // extraction — the party is still returned, just without a candidate.
        console.warn("[ai-interpret] party match lookup failed:", err);
      }

      parties.push({ ...p, personRoleId, roleMissing: personRoleId === null, matchCandidate, possibleMatches });
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
    if (referencedInstruments.length) {
      console.log(`  Referenced instruments (${referencedInstruments.length}):`);
      for (const r of referencedInstruments) {
        const numBit = r.nrDocument ? ` nr. ${r.nrDocument}` : " (fără număr)";
        const dateBit = r.dateDocument ? `/${r.dateDocument}` : "";
        console.log(
          `    [${r.purpose ?? "?"}] ${r.typeLabel ?? r.typeKey ?? "(tip necunoscut)"}${numBit}${dateBit}${r.issuer ? ` — ${r.issuer}` : ""}`,
        );
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

  /**
   * ⚠️ **THE SECOND OF THE THREE PLACES THE SYSTEM CAN NOTICE, AND THE ONLY ONE
   * THAT SEES THE WHOLE DOCUMENT.**                            (Slice #32.08)
   *
   * The classification's gate is the blocking one: it runs before anything is
   * written and stops the import at `cards-blocked`. What it is given is the
   * FIRST PAGE of the entry — full size, not a thumbnail, but one page: page
   * one of a page group, or a PDF's first page rasterised. This call is given
   * EVERY page, which is the difference that matters: a two-card sheet on page
   * four of a group is invisible to the gate and visible here.
   *
   * ⚠️ **AND IT DOES NOT RUN FOR AN IDENTITY CARD THAT CAN PRODUCE A PERSON.**
   * `interpretSkipReason` answers `"id-card"` for `scan.isIdCard &&
   * scan.canCreatePerson`, deliberately, because the identity-card step
   * extracts strictly more from one of those. It is the SECOND term that a
   * reader trips on: a card under `common` or `floating` has no sole Property,
   * so it is not skipped and this call does read it. So the two backstops
   * divide up rather than overlap — the identity-card step covers the cards a
   * person can be built from, and this covers everything else, including the
   * dangerous case (a two-card sheet the classifier read as a contract) and
   * every card the person flow is not offered on. Said at this length because
   * two earlier drafts of this paragraph got it wrong in two different
   * directions, the second of them while correcting the first.
   *
   * ⚠️ **IT IS A REFUSAL, NOT A PREVENTION, AND SAYING SO IS THE POINT.** By
   * the time this runs the Document exists and its pages are uploaded — the
   * import loop creates and uploads before it reads. So this cannot keep the
   * file out; what it can do is refuse to put two people's details onto one
   * record, and hand the caller a row that says which file has to be dealt
   * with. `runAiInterpret` returns before it builds a single patch, so nothing
   * this call read is written anywhere.
   *
   * ⚠️ **A 422 WITH A CODE, and the code is what the caller reads.** The
   * sentence a user sees is `adminImport.wizard.importDialog.aiMultiIdentity`
   * in `messages/*.json`, chosen by the dialog; this route's `error` is the
   * developer-facing fallback every other refusal here carries.
   *
   * ⚠️ **A count the model did not give is `null` and does not refuse.** The
   * same fail-open direction `multi-card-gate.ts` argues at length: a rule that
   * treats silence as a finding stops the product the day a field is dropped
   * from a prompt.
   */
  if (showsMoreThanOnePerson(identityPersonCount)) {
    console.warn(
      "[ai-interpret] refused: identityPersonCount =",
      identityPersonCount,
      "for document",
      id,
    );
    return Response.json(
      {
        error: "This document holds more than one person's identity document.",
        code: MULTI_IDENTITY_CODE,
        identityPersonCount,
      },
      { status: 422 },
    );
  }

  // ── Resolve documentTypeId ──────────────────────────────────────────────────
  //
  // Slice #29.06: through the ONE writer, `resolveClassifiedDocumentType`. The
  // three-step rule it applies — key, then name, then create — is the rule
  // that used to be written out here, with three differences that were all
  // defects rather than choices:
  //
  //   - the name match was `eq(name, classifiedLabel)`, BYTE FOR BYTE, so this
  //     route was case-sensitive where the import wizard was not and diacritic-
  //     sensitive where the KEY generator was not. "Contract de arendă" and
  //     "Contract de arenda" were two types with one key between them, which is
  //     why the second create died on the UNIQUE constraint (finding F7);
  //   - the create sent no `origin`, so `createValue` defaulted it to MANUAL
  //     and a type no human ever typed displayed as "Adăugat manual" — the
  //     column is write-once and no screen can repair it (finding F2). The
  //     resolver writes IMPORT, because a machine chose the name;
  //   - a create that lost a race threw, and the `catch` below turned it into a
  //     document with no type at all. The resolver adopts the racer's row.
  //
  // NOTE: if this switches the document to a different type than the one the
  // prompt above was built for, customFieldsOut still reflects the *old*
  // type's template for this run — a follow-up AI Interpret click after the
  // type change picks up the new type's template.
  let documentTypeId: string | null = null;
  /**
   * Is the type this call resolved to an identity-card type?   (Slice #32.07)
   *
   * ⚠️ **THIS ROUTE IS THE OTHER CALLER OF `resolveClassifiedDocumentType`,
   * AND IT IS THE ONE THE WIZARD PREFERS.** `bulk-import-dialog.tsx` computes
   * `finalTypeId = interpreted.documentTypeId ?? resolvedTypeId` — this
   * answer first — and this route is also the path that auto-creates
   * `lookup_document_type` rows, so the type it MINTS is exactly the one
   * `docTypeIdCardRef` has no entry for. Carrying the verdict only from
   * `POST /api/document-types/resolve` closed the blind spot on the id the
   * wizard does not use and left it open on the id it does: a card the scan
   * mislabelled, filed on an ordinary type at step 2, re-typed here onto a
   * type this call invented, and then given a billed discovery read because
   * every witness said "not a card".
   *
   * `null` when no re-type happened, matching `documentTypeId` beside it: the
   * caller already holds the answer for the type it resolved itself.
   */
  let documentTypeIsIdCard: boolean | null = null;
  try {
    // ⚠️ **The two values go in exactly as this route already computed them.**
    // `suggestedTypeKey` came from `canonicalTypeKey`, and since Slice #29.07
    // the resolver asks the same function again before it uses the key to
    // CREATE a row — not because this route is untrusted, but because the
    // resolver's other door is an HTTP POST from the browser. `matchDocumentType`
    // skips an UNCLASSIFIED key for the same reason, so all three agree. What
    // moved in #29.06 is the label test: "" and "Document necunoscut" were a
    // string literal here and a different string literal in the wizard, and are
    // one function (`classifiedLabelOf`) from that slice on.
    const resolved = await resolveClassifiedDocumentType({
      typeKey: suggestedTypeKey,
      label:   classifiedLabel,
    });
    // ⚠️ **`unclassified` leaves the document on the type it already has**, and
    // that is the ending this route already had rather than a new one:
    // `document.document_type_id` is NOT NULL, so every document reaching here
    // already carries a type, and a `null` in the response body means the
    // caller writes nothing. What has changed is that a create which FAILED no
    // longer produces the same `null` — that now throws, and the `catch` below
    // is the only thing that still turns a resolution into silence.
    documentTypeId = resolved.id;
    documentTypeIsIdCard = resolved.outcome === "unclassified" ? null : resolved.isIdCard;
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
    /**
     * Slice #36.03 — see `referencedInstruments` above. Returned and WRITTEN BY
     * NOBODY: the caller persists the array itself (POST
     * /api/documents/[id]/instrument-references) and a person turns entries
     * into links one at a time. `[]` here means the pages cited nothing this
     * read could recognise, which for an identity card or a plan parcelar is
     * the ordinary answer.
     */
    referencedInstruments,
    // ⚠️ **A SIBLING KEY, NOT A MEMBER OF `fields`.** (Slice #32.07.)
    // `fields` becomes the PATCH body for the document, so a boolean added
    // there would be offered to `PATCH /api/documents/[id]` as a column.
    documentTypeIsIdCard,
  });
}
