/**
 * POST /api/admin/doc-type-engine/read-sample                   (Slice #29.09)
 *
 * Discover mode over a file the archive does not hold.
 *
 * WHY IT IS A NEW ROUTE AND NOT A FLAG ON THE OLD ONE
 * ---------------------------------------------------
 * `POST /api/documents/[id]/ai-interpret` with `{ mode: "discover" }` reads the
 * same prompt against the same model — but it begins by resolving a Document
 * row, listing its pages and reading them out of storage. DocTypeEngine's
 * samples are files on a disk the user has just pointed at: no row, no pages,
 * no id, and deliberately so — this screen imports nothing and creates nothing.
 * There is no id to give that route, and threading an "or read these bytes
 * instead" branch through it would put a conditional in front of the page load,
 * the type resolve, the party-role lookup and the extract path, all of which
 * exist for a document that exists. `discover-run.ts`'s own header made the
 * same call for the same reason and is the precedent followed here.
 *
 * ⚠️ **NO RASTERISATION, ANYWHERE.** The obvious precedent for reading a picked
 * file is `scanEntry` in the import wizard, which rasterises page 1 with pdf.js
 * and posts one PNG to `/api/admin/import/scan-folder`. It is the WRONG shape
 * twice over: the notarial „Încheiere de autentificare" block carrying
 * `nrDocument` and `dateDocument` is typically on the LAST page (this
 * codebase's #21.03 lesson, recorded in the ai-interpret header), and nothing in
 * this repository can rasterise a page other than the first — both
 * `pdfToImageBlob` and the rasteriser worker hard-code `getPage(1)`. The closer
 * precedent, and the one taken, is `ai-interpret` itself: a PDF is sent to the
 * model as a native `document` block, bytes unchanged, with the
 * `anthropic-beta: pdfs-2024-09-25` header. Every page of the sample reaches the
 * model, and no pdf.js code is written for this slice at all.
 *
 * ⚠️ **ONE SAMPLE PER CALL, NEVER A BATCH.** Twenty samples is twenty calls
 * against `checkOcrRateLimit`, which allows ten per minute per user — so the
 * eleventh WILL be refused. Keeping one sample per request is what lets the
 * PACING live on the client, where the user can watch it, and what lets a
 * refused or timed-out sample be counted as unread rather than taking the other
 * nineteen with it. A batch route would have had to invent its own partial-
 * failure protocol; this one reports the failure of one sample as an HTTP
 * status the client already knows how to read.
 *
 * ⚠️ **`maxDuration = 60` IS A FAILURE MODE, NOT ONLY A COST.** Discover asks
 * `max_tokens: 16384` and sends every page, so a long deed can outrun the
 * function ceiling — and on Vercel a killed function answers HTML, which is why
 * `servesHtml` exists and is asked of a 2xx. The client counts such a sample as
 * NOT READ, which keeps it in the denominator line („14 din 20 de mostre
 * citite") instead of quietly out of the arithmetic. A silently lost sample is
 * the worst bug this slice could ship.
 *
 * Auth: middleware requires a session for everything outside /api/auth, and the
 * rate limiter caps this at the same ten per minute as every other
 * Anthropic-backed route. That is the same posture `ai-interpret` and
 * `extract-id-card` take, and this route makes no additional claim.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { unexpectedError } from "@/lib/api/errors";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { checkOcrRateLimit } from "@/lib/rate-limit/ocr";
import { buildDiscoverSystemPrompt } from "@/lib/import/classify-prompts";
import { parseDiscoverPayload, type SkippedPage } from "@/lib/documents/discover-log";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/import/constraint-rules";

export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * The same model and the same budget as `ai-interpret`'s discover branch.
 *
 * Not "a model that would do", and not a cheaper one: the whole value of this
 * screen is that the twenty readings are the same kind of reading the import
 * will do afterwards. A different model here would distil a form against
 * evidence the extraction never sees.
 */
const EXTRACT_MODEL = "claude-sonnet-4-6";
const DISCOVER_MAX_TOKENS = 16384;

/**
 * A sample is one document, and one document is not fifty files.
 *
 * ⚠️ **Bounded, and the truncation is REPORTED rather than silent.** A page
 * dropped without saying so is the same class of defect as a lost sample: the
 * screen would show a confident reading of a document two thirds of which was
 * never sent. Pages beyond the cap are returned in `skippedPages` with the
 * reason, exactly like an unsupported format.
 */
const MAX_SAMPLE_PAGES = 30;

/** …and a ceiling on the bytes those pages may add up to. See the loop. */
const MAX_SAMPLE_BYTES = 40 * 1024 * 1024;
const MAX_SAMPLE_MB = Math.round(MAX_SAMPLE_BYTES / 1024 / 1024);

/** Anthropic accepts these four and no other image type. */
const SUPPORTED_IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedImage = (typeof SUPPORTED_IMAGES)[number];

type ContentBlock =
  | { type: "image"; source: { type: "base64"; media_type: SupportedImage; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  | { type: "text"; text: string };

/**
 * ⚠️ A fourth copy of a function that should have been extracted three copies
 * ago — `ai-interpret`, `extract-id-card` and `scan-folder` each carry it
 * verbatim. Copied rather than extracted DELIBERATELY, and the reason is the
 * slice boundary: pulling it into `lib/` means editing three shipped routes on
 * a slice whose subject is a new screen, and a shared helper that changes how
 * three billed routes parse a model answer is not a change to make in passing.
 * Named here so the next reader sees four and not three. Listed in the handover.
 */
function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

function skipReason(name: string, mime: string): string {
  if (mime === "text/plain" || name.toLowerCase().endsWith(".txt")) {
    return "plain-text file (cadastral coordinates or notes) — the model is sent images and PDFs only";
  }
  if (!mime || mime === "application/octet-stream") {
    return "the browser reported no MIME type for this file, so its format cannot be confirmed";
  }
  return "unsupported format — only JPEG/PNG/GIF/WebP images and PDF can be sent";
}

export async function POST(request: NextRequest): Promise<Response> {
  // ── Rate limiting ─────────────────────────────────────────────────────────
  // The same bucket as ai-interpret, scan-image, parse-text and extract-id-card
  // — ten per minute per user, shared. The client paces itself against these
  // same two numbers (`sample-read-pacing.ts`) so this branch is the backstop
  // rather than the mechanism, and `Retry-After` is what it retries on.
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data", code: "bad_request" }, { status: 400 });
  }

  const sampleIdField = formData.get("sampleId");
  const sampleId = typeof sampleIdField === "string" ? sampleIdField : "";
  if (!sampleId) {
    return Response.json({ error: "No sampleId provided", code: "bad_request" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return Response.json({ error: "No files provided", code: "bad_request" }, { status: 400 });
  }

  const fileBlocks: ContentBlock[] = [];
  const skippedPages: SkippedPage[] = [];
  let sawPdf = false;

  let bytesSent = 0;

  for (const file of files) {
    // `File.type` is empty for plenty of browser-picked files; the pages route
    // makes the same substitution.
    const mime = file.type || "application/octet-stream";

    // ⚠️ **The cap counts pages SENT, not files SEEN, and a round found the
    // difference.** Checking the loop index first meant thirty leading text
    // files pushed every real page of the deed past the cap, and the sample
    // came back 422 „unsupported" — a true-sounding reason for something else
    // entirely.
    if (fileBlocks.length >= MAX_SAMPLE_PAGES) {
      skippedPages.push({
        fileName: file.name,
        mimeType: file.type || null,
        reason: `beyond the ${MAX_SAMPLE_PAGES}-page limit for one sample — this page was not sent`,
      });
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      skippedPages.push({
        fileName: file.name,
        mimeType: file.type || null,
        reason: `larger than ${MAX_UPLOAD_MB} MB — this page was not sent`,
      });
      continue;
    }
    // ⚠️ **An aggregate ceiling as well as a per-file one.** Both shipped
    // FormData routes accept exactly one file, so neither needed this; thirty
    // pages at the 20 MB per-file limit is 600 MB buffered, copied into a
    // Buffer, base64-expanded by a third and then serialised into one JSON
    // body, inside one function with a 60-second budget.
    if (bytesSent + file.size > MAX_SAMPLE_BYTES) {
      skippedPages.push({
        fileName: file.name,
        mimeType: file.type || null,
        reason: `the sample reached its ${MAX_SAMPLE_MB} MB total — this page was not sent`,
      });
      continue;
    }

    if ((SUPPORTED_IMAGES as readonly string[]).includes(mime)) {
      const buf = Buffer.from(await file.arrayBuffer());
      bytesSent += file.size;
      fileBlocks.push({
        type: "image",
        source: { type: "base64", media_type: mime as SupportedImage, data: buf.toString("base64") },
      });
    } else if (mime === "application/pdf") {
      const buf = Buffer.from(await file.arrayBuffer());
      bytesSent += file.size;
      fileBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
      });
      sawPdf = true;
    } else {
      skippedPages.push({
        fileName: file.name,
        mimeType: file.type || null,
        reason: skipReason(file.name, mime),
      });
    }
  }

  if (fileBlocks.length === 0) {
    // 422 rather than 400: the request was well formed and the sample simply
    // cannot be read. The client records it as unread with reason "unsupported"
    // — still in the denominator line, never silently absent from it.
    return Response.json(
      {
        error: "Nicio pagină a acestei mostre nu este într-un format care poate fi citit.",
        code: "unsupported_file_type",
        sampleId,
        skippedPages,
      },
      { status: 422 },
    );
  }

  const extraHeaders: Record<string, string> = sawPdf
    ? { "anthropic-beta": "pdfs-2024-09-25" }
    : {};

  let anthropicRes: Response;
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
        max_tokens: DISCOVER_MAX_TOKENS,
        system: buildDiscoverSystemPrompt(),
        messages: [
          {
            role: "user",
            content: [
              ...fileBlocks,
              {
                type: "text",
                text: `Read this Romanian document (${fileBlocks.length} page(s), in order — treat them as one document) and report everything printed on it, exactly as instructed. Do not omit anything.`,
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    return unexpectedError(err, "doc-type-engine:read-sample:fetch");
  }

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text().catch(() => "");
    let code = "unknown";
    let message = `Anthropic API error (HTTP ${anthropicRes.status})`;
    try {
      const parsed = JSON.parse(detail) as { error?: { type?: string; message?: string } };
      const t = parsed.error?.type ?? "";
      const m = parsed.error?.message ?? "";
      if (/credit balance is too low/i.test(m)) {
        code = "insufficient_credits";
        message = m;
      } else if (anthropicRes.status === 401 || t === "authentication_error") {
        code = "invalid_api_key";
        message = m || message;
      } else if (anthropicRes.status === 429 || t === "rate_limit_error") {
        code = "rate_limited";
        message = m || message;
      } else if (anthropicRes.status === 529 || t === "overloaded_error") {
        code = "overloaded";
        message = m || message;
      }
    } catch {
      /* non-JSON body */
    }
    console.error("[doc-type-engine:read-sample] Anthropic error:", anthropicRes.status, detail);

    // ⚠️ **AN ANTHROPIC 401 MUST NOT REACH THE CLIENT AS A 401, AND AN
    // ADVERSARIAL ROUND SHOWED WHY THIS FORK CANNOT INHERIT THAT.**
    // `isSessionLoss` is `res.redirected || res.status === 401`, so a bad
    // server-side ANTHROPIC_API_KEY arrived at the client as a lost login — and
    // here that is a LATCH: the run stops on the first sample and tells the user
    // to sign in again in a new tab, which can never fix a key on the server.
    // `ai-interpret` passes Anthropic's status straight through and has the same
    // ambiguity, but it reads ONE document and reports one failure; named in the
    // handover rather than changed from here.
    const status =
      code === "invalid_api_key" || anthropicRes.status >= 500
        ? 502
        : anthropicRes.status;

    // Anthropic's own 429 is answered as a 429, which the client treats exactly
    // as it treats the limiter's: wait on `Retry-After` and re-offer the
    // sample. Its header is FORWARDED — without it the client blind-waits a
    // whole window instead of the seconds Anthropic actually asked for.
    const headers: Record<string, string> = {};
    if (status === 429) {
      headers["Retry-After"] = anthropicRes.headers.get("retry-after") ?? String(
        Math.ceil(rl.retryAfterSeconds) || 30,
      );
    }

    return Response.json({ error: message, code, sampleId }, { status, headers });
  }

  const anthropicJson = (await anthropicRes.json()) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
  };
  const textBlock = anthropicJson.content?.find((b) => b.type === "text")?.text;
  if (!textBlock) {
    return Response.json(
      { error: "Anthropic API returned no text", code: "no_text", sampleId },
      { status: 502 },
    );
  }

  let payload;
  try {
    payload = parseDiscoverPayload(extractJson(textBlock));
  } catch (err) {
    console.error("[doc-type-engine:read-sample] failed to parse model output:", textBlock, err);
    return Response.json(
      { error: "Could not parse discover response", code: "unparsable", sampleId },
      { status: 502 },
    );
  }

  return Response.json({
    sampleId,
    documentLabel: payload.documentLabel,
    recognised: payload.recognised,
    skippedPages,
    pagesSent: fileBlocks.length,
    pagesTotal: files.length,
    // ⚠️ Reported, not swallowed. A reading cut off at `max_tokens` is a
    // reading of part of the document, and the run has to be able to say so
    // beside its count — a truncated sample still counts as read, because its
    // pairs are real, but the screen names how many were truncated.
    truncated: anthropicJson.stop_reason === "max_tokens",
  });
}
