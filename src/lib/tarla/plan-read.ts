/**
 * A plan parcelar, read: its locality, its tarla and the parcels it draws.                         (Slice #39.69)
 *
 * WHY
 *   A plan parcelar draws one tarla with every parcel in it. Adrian, on the research doc: „SO we should create lists
 *   of tarla from "plan parcelar" documents that we import! let's prepare for that". The import reads each plan with
 *   this prompt, proposes the tarla — the one that exists in that locality, or a new one — with its parcels, and a
 *   person confirms (D-12: nothing an AI read enters a list unconfirmed). The document is then linked to its tarla.
 *
 * ⚠️ **ITS OWN READ, NOT A SECTION OF THE DOCUMENT READ.** `buildExtractSystemPrompt` is the prompt every document
 * pays for and `ai-score` measures (CLAUDE.md: a change to it is scored before and after). A plan's parcels are a
 * list, not a field, and only one document type has them, so they are asked for here, by a second call made only
 * for a plan — the general read stays byte-for-byte what was scored.
 *
 * ⚠️ **NO OWNERS.** A plan lists the owners of its parcels. The prompt asks for none and the parser keeps no key it
 * does not know, so a name the model volunteers anyway is dropped here, before anything is shown or stored. Persons
 * go through the parties step, as they always have.
 *
 * PURE: no database, no fetch. The route sends `buildTarlaPlanRequestBody`, parses with `parseTarlaPlanReading`;
 * the import step proposes with `tarlaPlanProposal`.
 */

import { EXTRACT_MODEL } from "@/lib/ai/models";
import type { ContentBlock } from "@/lib/documents/ai-extract";
import { foldRomanian } from "@/lib/import/id-card";
import { tarlaCodeTakenBy, type TarlaCoded } from "@/lib/properties/tarla-code-guard";

/** The document type whose documents are read this way (migration_072). */
export const PLAN_PARCELAR_KEY = "PLAN_PARCELAR";

/** The most parcels kept from one plan: a tarla of several hundred is real; a list longer than this is a misread. */
export const TARLA_PLAN_MAX_PARCELS = 400;

/** One parcel as read. `null` is „printed but could not be read", or „not printed" for the use. */
export type TarlaPlanParcel = {
  parcela: string;
  areaSqm: number | null;
  use: string | null;
};

export type TarlaPlanReading = {
  /** The locality (UAT, village or town) the plan names, or null when it names none legibly. */
  locality: string | null;
  county: string | null;
  /** The tarla's code as printed („40", „T 52", „47/2"), or null. */
  tarla: string | null;
  parcels: TarlaPlanParcel[];
  /** Parcels drawn whose number could not be read — counted, never guessed. */
  illegibleParcels: number;
  /** What the model says it could not read, in its words, for the step to show. */
  unread: string[];
  /** Two entries for one parcel number: the first is kept, and this counts the rest. */
  duplicatesDropped: number;
};

// ── the request ──────────────────────────────────────────────────────────────────────────────────────────────────────

export function buildTarlaPlanSystemPrompt(): string {
  return [
    "You read a Romanian „plan parcelar\": a cadastral drawing of ONE tarla (also called „sola\") with the parcels in it.",
    "Return ONLY a JSON object, with exactly these keys:",
    '{"locality": string|null, "county": string|null, "tarla": string|null,',
    ' "parcels": [{"parcela": string, "areaSqm": number|null, "use": string|null}],',
    ' "illegibleParcels": number, "unread": string[]}',
    "",
    "- locality: the UAT, town or village the plan is for, as printed (e.g. „Bragadiru\"), without „UAT\", „comuna\" or „oraș\".",
    "- county: the county (județ) as printed, without „jud.\". null when not printed.",
    "- tarla: the tarla / sola code exactly as printed, without the word „Tarla\" or „T\" before it (e.g. „52\", „47/2\").",
    "- parcels: one entry per parcel the plan draws or tabulates. parcela: its number as printed (e.g. „12\", „12/3\", „A 45\").",
    "  areaSqm: its area in square metres as a number — convert hectares (ha) to m² (1 ha = 10000 m²); null when unreadable.",
    "  use: the use category when printed (e.g. „A\" or „arabil\", „Pd\", „CC\", „DE\"), written out in Romanian when it is an",
    "  abbreviation you are sure of (A → Arabil, P → Pășune, F → Fânețe, V → Vie, L → Livadă, PD → Pădure,",
    "  CC → Curți-construcții, DE/DS/DC → Drumuri, HB/HR → Ape, N → Neproductiv); otherwise as printed; null when absent.",
    "- illegibleParcels: how many parcels are drawn whose NUMBER you cannot read. Never guess a number.",
    "- unread: short Romanian phrases naming anything you could not read (e.g. „suprafața parcelei 14\").",
    "",
    "Do NOT return owners' names, personal identification numbers, addresses or any other personal data, even though the",
    "plan lists them. If the document is not a plan parcelar, return every key with null / [] / 0.",
  ].join("\n");
}

export function buildTarlaPlanRequestBody(fileBlocks: readonly ContentBlock[]): Record<string, unknown> {
  return {
    model: EXTRACT_MODEL,
    // A tarla of 400 parcels at ~25 tokens each is 10 000 tokens; the parser keeps at most TARLA_PLAN_MAX_PARCELS.
    max_tokens: 16384,
    system: buildTarlaPlanSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [
          ...fileBlocks,
          {
            type: "text",
            text: `Read this plan parcelar (${fileBlocks.length} page(s), in order — one document) as instructed.`,
          },
        ],
      },
    ],
  };
}

// ── the answer ───────────────────────────────────────────────────────────────────────────────────────────────────────

const text = (v: unknown): string | null => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
};

/** „Tarla 52", „T52", „sola 47/2" → „52", „47/2": the word is the label, not the code. „TCP9" stays „TCP9". */
export function cleanTarlaCode(v: unknown): string | null {
  const t = text(v);
  if (t === null) return null;
  // „T" only as a word of its own („T 52", „T.52", „T52"), so a code that starts with T („TCP9") keeps it.
  const stripped = t.replace(/^(tarlaua|tarla|sola|t(?=[\s.\d]))\.?\s*(nr\.?\s*)?/i, "").trim();
  return stripped === "" ? null : stripped;
}

/** „UAT Bragadiru", „comuna Cornetu", „jud. Ilfov" → the name alone. */
export function cleanPlace(v: unknown): string | null {
  const t = text(v);
  if (t === null) return null;
  const stripped = t.replace(/^(uat|u\.a\.t\.|comuna|com\.|ora[sș]ul|ora[sș]|municipiul|mun\.|satul|sat|jude[tț]ul|jud\.?)\s+/i, "").trim();
  return stripped === "" ? null : stripped;
}

/**
 * An area in m², from what the model returned: a number, or a string as a plan prints it — „1.234,56", „1234.56",
 * „1 234 mp", „0,5 ha". `null` for anything else, and for zero or less (the table refuses those).
 */
export function parseAreaSqm(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    const ha = /\bha\b/.test(s);
    let digits = s.replace(/[^\d.,]/g, "");
    if (digits === "") return null;
    if (digits.includes(",") && digits.includes(".")) {
      // Whichever comes last is the decimal mark.
      digits = digits.lastIndexOf(",") > digits.lastIndexOf(".")
        ? digits.replace(/\./g, "").replace(",", ".")
        : digits.replace(/,/g, "");
    } else if (digits.includes(",")) {
      digits = /,\d{3}$/.test(digits) && !ha ? digits.replace(/,/g, "") : digits.replace(",", ".");
    } else if ((digits.match(/\./g) ?? []).length > 1 || (/\.\d{3}$/.test(digits) && !ha)) {
      // „1.234" in a Romanian plan is a thousand separator; „0.5 ha" is a decimal.
      digits = digits.replace(/\./g, "");
    }
    n = Number(digits);
    if (ha) n *= 10000;
  } else {
    return null;
  }
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** The model's text → a reading, or null when it is not the object asked for. Unknown keys are dropped. */
export function parseTarlaPlanReading(value: unknown): TarlaPlanReading | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const parcels: TarlaPlanParcel[] = [];
  const seen = new Set<string>();
  let duplicatesDropped = 0;
  let illegible = 0;
  for (const raw of Array.isArray(o.parcels) ? o.parcels : []) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const parcela = text(r.parcela);
    if (parcela === null) {
      illegible += 1;
      continue;
    }
    const key = foldRomanian(parcela);
    if (seen.has(key)) {
      duplicatesDropped += 1;
      continue;
    }
    if (parcels.length >= TARLA_PLAN_MAX_PARCELS) {
      duplicatesDropped += 1;
      continue;
    }
    seen.add(key);
    parcels.push({ parcela, areaSqm: parseAreaSqm(r.areaSqm), use: text(r.use) });
  }
  const said = typeof o.illegibleParcels === "number" && Number.isFinite(o.illegibleParcels) ? Math.max(0, Math.floor(o.illegibleParcels)) : 0;
  return {
    locality: cleanPlace(o.locality),
    county: cleanPlace(o.county),
    tarla: cleanTarlaCode(o.tarla),
    parcels,
    illegibleParcels: said + illegible,
    unread: (Array.isArray(o.unread) ? o.unread : []).map(text).filter((u): u is string => u !== null).slice(0, 20),
    duplicatesDropped,
  };
}

/** Did the read find anything a tarla could be made of? A code is the least it needs. */
export function readingHasTarla(r: TarlaPlanReading): boolean {
  return r.tarla !== null;
}

// ── the proposal ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type TarlaPlanProposal<T extends TarlaCoded> =
  | { action: "link"; tarla: T }
  | { action: "create" }
  | { action: "none" };

/**
 * Link to the tarla that already has this code in this locality, else create one; nothing without a code.
 * The same per-locality identity the unique index holds (`tarlaCodeTakenBy`, #39.67) — so „link" is exactly the case
 * where „create" would be refused.
 */
export function tarlaPlanProposal<T extends TarlaCoded>(
  code: string | null,
  locality: string | null,
  tarlale: readonly T[],
): TarlaPlanProposal<T> {
  if (code === null || code.trim() === "") return { action: "none" };
  const taken = tarlaCodeTakenBy(code, tarlale, null, locality ?? "");
  return taken !== null ? { action: "link", tarla: taken } : { action: "create" };
}

/** The use categories by folded name, for matching a printed use: „arabil" → „Arabil"'s id. */
export function matchUseCategory(use: string | null, categories: readonly { id: string; name: string }[]): string | null {
  if (use === null) return null;
  const f = foldRomanian(use);
  if (f === "") return null;
  return categories.find((c) => foldRomanian(c.name) === f)?.id ?? null;
}
