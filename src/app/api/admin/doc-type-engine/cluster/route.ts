/**
 * POST /api/admin/doc-type-engine/cluster                       (Slice #29.09)
 *
 * One call per RUN — not per sample — that folds the pairs harvested off every
 * sample into one cluster per meaning.
 *
 * WHY IT IS A SECOND CALL RATHER THAN A BETTER FIRST PROMPT
 * --------------------------------------------------------
 * `buildDiscoverSystemPrompt` asks for the label „EXACTLY as printed" and the
 * value „EXACTLY as printed", and that must not change: verbatim is the
 * evidence, and a caption normalised at read time is evidence thrown away
 * before anyone has looked at it. What many samples give that one never did is
 * the same meaning appearing many times in many wordings against many different
 * values — and that is only visible once every sample has been read. So it is a
 * separate pass over the harvest.
 *
 * ⚠️ **ONE CALL FOR THE WHOLE RUN — AND IT IS THE ONE THE LIMITER REFUSES.**
 * Twenty reads plus one clustering call is twenty-one requests, not forty; but
 * a superuser's allowance is exactly twenty (Slice #29.09a), so this is the
 * request that lands one past it. That is why `SampleRunResult` carries
 * `slotStarts` at all: the run's pacing (`sample-read-pacing.ts`) accounts for
 * this call the same way it accounts for a read, and it is the last request the
 * run makes. Unpaced, it was refused and discarded the entire harvest. The
 * header this replaced said the call "costs nothing against the limiter",
 * which was written when the allowance was ten and every reading was paced.
 *
 * ⚠️ **THE MODEL IS SENT TEXT AND ANSWERS WITH IDS.** Every pair carries a
 * stable id, and the answer is a grouping of those ids — so no caption and no
 * value the user is later shown was written by a model. The label the form
 * finally offers is chosen by COUNTING the observed wordings
 * (`distilledLabel`), not by asking for a canonical name. A prompt that asked
 * for a tidy name would put a machine-written caption onto a document type
 * every future document of that type is read against, which is the
 * schema-fitting discover mode exists to avoid, reintroduced one step later.
 *
 * ⚠️ **EVERY ID COMES BACK, OR THE SERVER PUTS IT BACK.** A model that drops an
 * id would silently shrink the candidate list, and a candidate that never
 * appears cannot be seen to fall below the line either — it would simply not
 * exist, with no screen saying so. `rebuildClusters` below therefore reconciles
 * the answer against the input: unknown ids are discarded, duplicated ids are
 * kept only in their first cluster, and any id the model failed to place
 * becomes its own cluster of one. A cluster of one is a real answer — it means
 * "seen in one document" — and the counting rule will place it below the line
 * on its own merits.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { ANONYMOUS_USER_ID } from "@/lib/auth/current-user";
import { getCurrentUserIdAndRole } from "@/lib/auth/current-role";
import { checkOcrRateLimit } from "@/lib/rate-limit/ocr";
import { buildClusterSystemPrompt, type ClusterInputPair } from "@/lib/import/classify-prompts";
import type { FieldCluster } from "@/lib/documents/field-distillation";

export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLUSTER_MODEL = "claude-sonnet-4-6";

/**
 * ⚠️ **THE SAME BUDGET AS A READ, BECAUSE THE SAME SIXTY-SECOND CEILING APPLIES
 * — and a round costed the first draft's 32000.** A budget the function cannot
 * spend is not a bigger budget, it is a slower failure: `maxDuration = 60` kills
 * the request long before thirty-two thousand tokens can be emitted, Vercel
 * answers HTML, and the whole harvest is lost with no partial result. Sixteen
 * thousand is what `MAX_PAIRS` below is sized against, and `truncated` is
 * reported when even that is not enough.
 */
const CLUSTER_MAX_TOKENS = 16384;

/**
 * ⚠️ A ceiling on what is sent, and it is REPORTED when it bites.
 * Seven hundred pairs is already a large prompt, and the ANSWER is a partition
 * of them — every id emitted once — which is what `CLUSTER_MAX_TOKENS` above
 * has to cover inside sixty seconds. Several thousand, which a folder of long
 * deeds can produce, would blow both.
 *
 * ⚠️ **A PAIR BEYOND THE CAP IS STILL CLUSTERED, JUST NOT BY THE MODEL — and
 * the first draft dropped it entirely.** `rebuildClusters` is given every pair,
 * so an uncompared one becomes its own cluster of one and is counted, ranked
 * and shown below the line like any other candidate seen in one document.
 * Dropping it instead made it invisible: not above the line, not below it, not
 * anywhere, with nothing on screen saying so. `droppedPairIds` reports which
 * ones the model never saw, so the screen can say the comparison was partial.
 */
const MAX_PAIRS = 700;

const pairSchema = z.object({
  id:       z.string().min(1).max(64),
  sampleId: z.string().min(1).max(128),
  label:    z.string().min(1),
  value:    z.string(),
});

const bodySchema = z.object({
  /** Distinct samples the pairs came off — the clustering brief states it. */
  sampleCount: z.number().int().min(1).max(200),
  // ⚠️ Capped in the SCHEMA as well as at the slice below: zod parses and copies
  // every element before the slice runs, so an unbounded array is a body the
  // function pays for in full before deciding to ignore most of it.
  pairs:       z.array(pairSchema).min(1).max(5000),
});

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

/**
 * Turn the model's grouping of ids back into clusters of real pairs.
 *
 * Exported-in-spirit but deliberately local: it is meaningless without the
 * request that produced it, and the assertions that matter about the counting
 * that FOLLOWS it live in `field-distillation.ts`, which is pure and tested.
 */
function rebuildClusters(
  pairs: readonly ClusterInputPair[],
  groups: readonly { memberIds: readonly string[] }[],
): FieldCluster[] {
  // ⚠️ FIRST wins, not last: `new Map(pairs.map(...))` keeps the LAST entry for
  // a repeated id, and `placed` is keyed by id, so a duplicated id silently
  // discarded one of the two pairs — in a route whose header promises every id
  // comes back. Not reachable from this client, whose ids are
  // `${sampleId}#${index}`, but this is an authenticated JSON endpoint.
  const byId = new Map<string, ClusterInputPair>();
  for (const p of pairs) if (!byId.has(p.id)) byId.set(p.id, p);
  const placed = new Set<string>();
  const clusters: FieldCluster[] = [];

  groups.forEach((group, index) => {
    const members = [];
    for (const id of group.memberIds) {
      const pair = byId.get(id);
      if (!pair || placed.has(id)) continue; // unknown, or already spoken for
      placed.add(id);
      members.push({ sampleId: pair.sampleId, label: pair.label, value: pair.value });
    }
    if (members.length > 0) clusters.push({ clusterId: `c${index}`, members });
  });

  // Anything the model forgot becomes its own cluster of one. Not a repair of
  // the model's answer — a refusal to let a candidate vanish without the screen
  // being able to say where it went.
  let orphan = 0;
  for (const pair of pairs) {
    if (placed.has(pair.id)) continue;
    clusters.push({
      clusterId: `o${orphan++}`,
      members: [{ sampleId: pair.sampleId, label: pair.label, value: pair.value }],
    });
  }

  return clusters;
}

export async function POST(request: NextRequest): Promise<Response> {
  const { userId, role, degraded } = await getCurrentUserIdAndRole();

  // 503, not 403, when nobody could read the caller — a role lookup that threw
  // (`degraded`) or an auth round trip that did, which leaves `userId` as
  // "anonymous". Both are transients, and both are retried by the client. See
  // the read-sample route for the full note (Slice #29.09a).
  if (degraded || userId === ANONYMOUS_USER_ID) {
    return NextResponse.json(
      { error: "Nu am putut verifica drepturile contului. Încercați din nou în curând.", code: "role_unavailable" },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }

  // Superuser-only, checked HERE rather than inherited from /admin: a page
  // layout does not run for a Route Handler. See the read-sample route for the
  // full note (Slice #29.09a).
  if (role !== "superuser") {
    return NextResponse.json(
      { error: "Nu aveți dreptul să folosiți această funcție.", code: "forbidden" },
      { status: 403 },
    );
  }

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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body", code: "bad_request" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return zodErrorToResponse(parsed.error);

  const sent = parsed.data.pairs.slice(0, MAX_PAIRS);
  const droppedPairIds = parsed.data.pairs.slice(MAX_PAIRS).map((p) => p.id);

  // ⚠️ **The brief says how many DOCUMENTS these pairs came off, and it is
  // derived rather than believed.** `sampleCount` arrives in the body, and a
  // client that miscounted it would have the model told it is comparing five
  // documents when it is comparing twenty — which changes how readily it merges
  // two wordings. The pairs themselves carry the answer.
  const distinctSamples = new Set(parsed.data.pairs.map((p) => p.sampleId)).size;

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLUSTER_MODEL,
        max_tokens: CLUSTER_MAX_TOKENS,
        system: buildClusterSystemPrompt(distinctSamples),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  sent.map((p) => ({
                    id: p.id,
                    sample: p.sampleId,
                    label: p.label,
                    // Values are what prove two wordings are one field. Clipped
                    // because a whole clause teaches nothing the first eighty
                    // characters do not, and the prompt is charged by the token.
                    value: p.value.slice(0, 80),
                  })),
                ),
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    return unexpectedError(err, "doc-type-engine:cluster:fetch");
  }

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text().catch(() => "");
    console.error("[doc-type-engine:cluster] Anthropic error:", anthropicRes.status, detail);
    let code = "unknown";
    let message = `Anthropic API error (HTTP ${anthropicRes.status})`;
    try {
      const body = JSON.parse(detail) as { error?: { type?: string; message?: string } };
      const t = body.error?.type ?? "";
      const m = body.error?.message ?? "";
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
    return Response.json({ error: "Anthropic API returned no text", code: "no_text" }, { status: 502 });
  }

  let groups: { memberIds: string[] }[];
  try {
    const answer = extractJson(textBlock) as { clusters?: unknown };
    groups = (Array.isArray(answer.clusters) ? answer.clusters : [])
      .filter((c): c is { memberIds: unknown } => !!c && typeof c === "object")
      .map((c) => ({
        memberIds: Array.isArray(c.memberIds)
          ? c.memberIds.filter((id): id is string => typeof id === "string")
          : [],
      }));
  } catch (err) {
    console.error("[doc-type-engine:cluster] failed to parse model output:", textBlock, err);
    return Response.json(
      { error: "Could not parse cluster response", code: "unparsable" },
      { status: 502 },
    );
  }

  return Response.json({
    // Every pair, not only the ones the model saw — see MAX_PAIRS.
    clusters: rebuildClusters(parsed.data.pairs, groups),
    /**
     * How many of the harvested pairs never reached the model, and how many the
     * model never placed. Both are zero on a normal run; a screen that could not
     * say them would be claiming a complete candidate list it does not have.
     */
    droppedPairIds,
    truncated: anthropicJson.stop_reason === "max_tokens",
  });
}
