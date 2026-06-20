/**
 * POST /api/admin/import/extract-id-card
 *
 * Accepts a multipart/form-data upload with a single `image` field (a
 * scanned/photographed Romanian ID card — "Carte de Identitate"). Sends the
 * image to a vision-capable LLM (Anthropic Claude) and asks it to read off
 * the fields we can map to `natural_person` columns.
 *
 * This route requires internet access and incurs a per-call API cost
 * (accepted by Adrian — Slice #14.15.01). Requires ANTHROPIC_API_KEY to be
 * set in the environment (see .env.example).
 *
 * Response shape:
 *   {
 *     fields: {
 *       lastName, firstName, gender, dateOfBirth, cnp,
 *       idDocumentNumber, idCardNumber, placeOfBirth,
 *       idIssuingAuthority, idValidFrom, idValidUntil, idMrzRaw,
 *       citizenshipId, citizenshipRaw,
 *     },
 *     lowConfidenceFields: string[],   // keys the model wasn't sure about —
 *                                      // the review UI should highlight these
 *                                      // for the user to double-check.
 *     unmappedRaw: Record<string, string>, // anything read on the card that
 *                                      // didn't map to a known field
 *   }
 *
 * Per Adrian's standing instruction: any field that the model cannot map
 * clearly to an existing natural_person column is returned in `unmappedRaw`
 * rather than guessed into the wrong field — the review dialog must show
 * these to the user rather than silently dropping them.
 */

import type { NextRequest } from "next/server";
import { db } from "@/db";
import { lookupCitizenship } from "@/db/schema";
import { unexpectedError } from "@/lib/api/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

const EXTRACTION_FIELDS = [
  "lastName",
  "firstName",
  "gender",
  "dateOfBirth",
  "cnp",
  "idDocumentNumber",
  "idCardNumber",
  "placeOfBirth",
  "idIssuingAuthority",
  "idValidFrom",
  "idValidUntil",
  "idMrzRaw",
  "citizenshipRaw",
] as const;

type ExtractedFields = Partial<Record<(typeof EXTRACTION_FIELDS)[number], string>>;

type ExtractionResult = {
  fields: ExtractedFields;
  lowConfidenceFields: string[];
  unmappedRaw: Record<string, string>;
};

/**
 * Known Anthropic API failure modes that the review UI should explain to
 * Adrian with a clear message box rather than a raw/blank failure. See
 * CLAUDE.md Slice #14.15.01 follow-up — "insufficient_credits" in particular
 * covers running out of API balance.
 */
type AnthropicErrorCode =
  | "insufficient_credits"
  | "invalid_api_key"
  | "rate_limited"
  | "overloaded"
  | "unknown";

/**
 * Classifies a non-OK response from the Anthropic Messages API into a
 * stable `code` the client can map to a translated, user-facing message,
 * plus an English fallback `message` for any code the client doesn't
 * recognise. Anthropic's error body shape is
 * `{ type: "error", error: { type: string, message: string } }`.
 */
function classifyAnthropicError(
  status: number,
  rawBody: string,
): { code: AnthropicErrorCode; message: string } {
  let bodyType = "";
  let bodyMessage = "";
  try {
    const parsed = JSON.parse(rawBody) as { error?: { type?: string; message?: string } };
    bodyType = parsed.error?.type ?? "";
    bodyMessage = parsed.error?.message ?? "";
  } catch {
    // Non-JSON body — fall through and classify on status code alone.
  }

  // "Credit balance is too low" is returned as a 400 invalid_request_error
  // for several distinct root causes (depleted balance, usage tier too low,
  // an orphaned/stale key) — we can't tell which from the response alone,
  // so the message below covers all three.
  if (/credit balance is too low/i.test(bodyMessage)) {
    return {
      code: "insufficient_credits",
      message:
        "The Anthropic API credit balance is too low (or the key can no longer bill). Add credits / check the plan at console.anthropic.com, then try again.",
    };
  }
  if (status === 401 || bodyType === "authentication_error") {
    return {
      code: "invalid_api_key",
      message:
        "The configured ANTHROPIC_API_KEY was rejected. Check the value in .env and that the key hasn't been revoked.",
    };
  }
  if (status === 429 || bodyType === "rate_limit_error") {
    return {
      code: "rate_limited",
      message: "The vision API is rate-limited right now. Wait a moment and try again.",
    };
  }
  if (status === 529 || status === 503 || bodyType === "overloaded_error") {
    return {
      code: "overloaded",
      message: "The vision API is temporarily overloaded. Please try again shortly.",
    };
  }
  return {
    code: "unknown",
    message: bodyMessage || `Vision API request failed (HTTP ${status}).`,
  };
}

const SYSTEM_PROMPT = `You read scanned Romanian national ID cards (Carte de Identitate) and extract structured data. Respond with ONLY a single JSON object, no prose, no markdown fences.

Shape:
{
  "fields": {
    "lastName": string | null,        // "Nume"
    "firstName": string | null,       // "Prenume"
    "gender": "MALE" | "FEMALE" | null,  // "Sex" — M -> MALE, F -> FEMALE
    "dateOfBirth": string | null,     // ISO yyyy-mm-dd, from CNP or printed DOB
    "cnp": string | null,             // "CNP" — 13 digits, digits only
    "idDocumentNumber": string | null,// series + number combined, e.g. "RT123456" (no space)
    "idCardNumber": string | null,    // secondary card / document number if a DIFFERENT number is printed (e.g. on the back, or a permanent-number field), else null
    "placeOfBirth": string | null,    // "Loc nastere"
    "idIssuingAuthority": string | null, // "Emisa de" / issuing authority
    "idValidFrom": string | null,     // ISO yyyy-mm-dd, "Valabilitate" start
    "idValidUntil": string | null,    // ISO yyyy-mm-dd, "Valabilitate" end
    "idMrzRaw": string | null,        // the raw machine-readable zone text (back of card), verbatim, lines joined with \\n
    "citizenshipRaw": string | null   // citizenship/nationality as printed, e.g. "ROU" or "Romana"
  },
  "lowConfidenceFields": string[],    // keys above where you are not confident in the OCR read (blurry, ambiguous, or guessed)
  "unmappedRaw": { [label: string]: string }  // any other text visibly printed on the card that does not fit one of the fields above (e.g. an address printed on the front, a parent's name, etc.) — key is your best label for it, value is the raw text
}

Rules:
- Only include a field in "unmappedRaw" if it genuinely does not fit one of the named fields above. Do not duplicate a named field into unmappedRaw.
- If you cannot read a field at all, set it to null and do NOT list it in lowConfidenceFields (null means "not found", not "uncertain"). Only list a field in lowConfidenceFields if you extracted a value but are unsure it is correct.
- Dates must be ISO yyyy-mm-dd or null. Never invent a date.
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;

function extractJson(text: string): unknown {
  // Strip markdown fences if the model added them despite instructions.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

/** Loose match of a free-text citizenship string against lookup_citizenship rows. */
function matchCitizenship(
  raw: string | null | undefined,
  rows: { id: string; name: string }[],
): string | null {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase();

  // Direct / substring match against the stored Romanian adjective name.
  const direct = rows.find(
    (r) => r.name.toLowerCase() === norm || norm.includes(r.name.toLowerCase()),
  );
  if (direct) return direct.id;

  // Common ISO / English aliases for the seeded list (Slice 9.1 names).
  const aliases: Record<string, string> = {
    rou: "Română",
    ro: "Română",
    romania: "Română",
    romanian: "Română",
    md: "Moldoveană",
    mda: "Moldoveană",
    moldova: "Moldoveană",
    usa: "Americană",
    us: "Americană",
    american: "Americană",
    deu: "Germană",
    germany: "Germană",
    german: "Germană",
    fra: "Franceză",
    france: "Franceză",
    french: "Franceză",
    ita: "Italiană",
    italy: "Italiană",
    italian: "Italiană",
    esp: "Spaniolă",
    spain: "Spaniolă",
    spanish: "Spaniolă",
    gbr: "Engleză",
    uk: "Engleză",
    england: "Engleză",
    english: "Engleză",
  };
  const aliasName = aliases[norm];
  if (aliasName) {
    const match = rows.find((r) => r.name === aliasName);
    if (match) return match.id;
  }

  return null;
}

export async function POST(request: NextRequest): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const imageField = formData.get("image");
  if (!imageField || !(imageField instanceof File)) {
    return Response.json({ error: "No image provided" }, { status: 400 });
  }
  if (!imageField.type.startsWith("image/")) {
    return Response.json({ error: "File is not an image" }, { status: 400 });
  }

  const buffer = Buffer.from(await imageField.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mediaType = imageField.type;

  const model = process.env.ANTHROPIC_VISION_MODEL || DEFAULT_MODEL;

  let anthropicRes: globalThis.Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: "Extract the fields from this Romanian ID card image as instructed.",
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    return unexpectedError(err, "extract-id-card:fetch");
  }

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text().catch(() => "");
    const { code, message } = classifyAnthropicError(anthropicRes.status, detail);
    console.error("[extract-id-card] Anthropic API error:", anthropicRes.status, detail);
    // Surface a stable `code` so the client can show a translated message
    // box (e.g. "out of credits") instead of a generic failure — the raw
    // `error` string is kept as an English fallback for any code the
    // client doesn't recognise.
    const httpStatus =
      code === "insufficient_credits" ? 402 : code === "rate_limited" ? 429 : code === "invalid_api_key" ? 401 : 502;
    return Response.json({ error: message, code }, { status: httpStatus });
  }

  const anthropicJson = (await anthropicRes.json()) as {
    content?: { type: string; text?: string }[];
  };
  const textBlock = anthropicJson.content?.find((b) => b.type === "text")?.text;
  if (!textBlock) {
    return Response.json({ error: "Vision API returned no text" }, { status: 502 });
  }

  let parsed: ExtractionResult;
  try {
    const raw = extractJson(textBlock) as Partial<ExtractionResult>;
    parsed = {
      fields: raw.fields ?? {},
      lowConfidenceFields: Array.isArray(raw.lowConfidenceFields) ? raw.lowConfidenceFields : [],
      unmappedRaw:
        raw.unmappedRaw && typeof raw.unmappedRaw === "object" ? raw.unmappedRaw : {},
    };
  } catch (err) {
    console.error("[extract-id-card] failed to parse model output:", textBlock, err);
    return Response.json(
      { error: "Could not parse vision API response", raw: textBlock },
      { status: 502 },
    );
  }

  // Resolve citizenshipRaw -> citizenshipId against the live lookup table.
  const citizenshipRows = await db
    .select({ id: lookupCitizenship.id, name: lookupCitizenship.name })
    .from(lookupCitizenship);

  const citizenshipId = matchCitizenship(parsed.fields.citizenshipRaw, citizenshipRows);
  if (!citizenshipId && parsed.fields.citizenshipRaw) {
    // Couldn't confidently resolve to a known lookup row — flag it instead
    // of guessing, per Adrian's standing instruction.
    parsed.lowConfidenceFields = [...new Set([...parsed.lowConfidenceFields, "citizenshipRaw"])];
  }

  return Response.json({
    fields: { ...parsed.fields, citizenshipId },
    lowConfidenceFields: parsed.lowConfidenceFields,
    unmappedRaw: parsed.unmappedRaw,
  });
}
