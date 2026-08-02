/**
 * Discover-mode console report — Slice #21.10.Import
 *
 * `POST /api/documents/[id]/ai-interpret` with `{ mode: "discover" }` reads a
 * document with NO target field list (see buildDiscoverSystemPrompt in
 * src/lib/import/classify-prompts.ts) and gets back two lists: label -> value
 * pairs it could read, and everything else grouped by the model's own inferred
 * section headings.
 *
 * This module turns that into the block printed in the terminal running
 * `npm run dev`. It is kept PURE — no console, no I/O, no framework imports —
 * so the formatting is unit-testable and the route stays a thin caller. The
 * route does the single `console.log(formatDiscoverLog(...))`.
 *
 * The report is deliberately in ENGLISH: it is a development diagnostic read in
 * the dev-server terminal, never shown to a user, and it sits next to the
 * existing English `[ai-interpret]` block in the same route. The document's own
 * content inside it stays Romanian and verbatim — that is the whole point of
 * discover mode, so nothing here translates, normalises or truncates a value.
 *
 * parseDiscoverPayload follows the parseTemplateFields convention: it NEVER
 * throws on malformed model output. A bad entry is dropped rather than sinking
 * the whole run — a diagnostic that crashes when the data is odd is useless
 * precisely when the data is odd.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiscoverConfidence = "high" | "medium" | "low";

/** One label -> value pair, both sides verbatim as printed in the document. */
export type DiscoverPair = {
  name: string;
  value: string;
  confidence: DiscoverConfidence;
};

/** A block of non-field content, grouped under the model's inferred heading. */
export type DiscoverSection = {
  heading: string;
  lines: string[];
};

export type DiscoverPayload = {
  documentLabel: string | null;
  recognised: DiscoverPair[];
  sections: DiscoverSection[];
};

/**
 * A page that could not be sent to the model.
 *
 * Reporting these matters more than it looks. The route dispatches strictly on
 * the page's stored `mime_type`, and a page whose MIME was never recorded at
 * upload (stored as application/octet-stream) is skipped silently. Without this
 * list a document can come back with nothing found and no indication that its
 * pages were never actually read — a model failure and a plumbing failure look
 * identical from the outside.
 */
export type SkippedPage = {
  fileName: string;
  mimeType: string | null;
  reason: string;
};

export type DiscoverLogInput = {
  /** Page file names, in page order. */
  pageFileNames: string[];
  /** How many pages were actually sent to the model. */
  pagesSent: number;
  /** How many pages the document has in total. */
  pagesTotal: number;
  /** The type currently registered on the document, if it resolved. */
  registeredTypeName: string | null;
  registeredTypeKey: string | null;
  /** Pages that could not be sent, with the reason. */
  skipped: SkippedPage[];
  /** True when the model hit its output limit — the report is then incomplete. */
  truncated: boolean;
  payload: DiscoverPayload;
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const VALID_CONFIDENCE: readonly DiscoverConfidence[] = ["high", "medium", "low"];

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/**
 * Parse raw model output into a DiscoverPayload. Never throws.
 *
 * Entries missing a name (for a pair) or a heading (for a section) are dropped:
 * without them the entry cannot be printed usefully and would just be noise in
 * the report. A pair with a name but an empty value IS kept — "this label is
 * printed but has nothing filled in" is real information about the document.
 */
export function parseDiscoverPayload(raw: unknown): DiscoverPayload {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const recognised: DiscoverPair[] = Array.isArray(obj.recognised)
    ? obj.recognised
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
        .map((p) => {
          const name = asString(p.name);
          if (!name) return null;
          return {
            name,
            value: typeof p.value === "string" ? p.value : "",
            confidence: VALID_CONFIDENCE.includes(p.confidence as DiscoverConfidence)
              ? (p.confidence as DiscoverConfidence)
              : "low",
          };
        })
        .filter((p): p is DiscoverPair => p !== null)
    : [];

  const sections: DiscoverSection[] = Array.isArray(obj.sections)
    ? obj.sections
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
        .map((s) => {
          const heading = asString(s.heading);
          if (!heading) return null;
          return {
            heading,
            lines: Array.isArray(s.lines)
              ? s.lines.filter((l): l is string => typeof l === "string")
              : [],
          };
        })
        .filter((s): s is DiscoverSection => s !== null)
    : [];

  return {
    documentLabel: asString(obj.documentLabel),
    recognised,
    sections,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const RULE = "─".repeat(70);

/** Longest name column we are willing to pad to before it stops aiding reading. */
const MAX_NAME_COL = 38;
/** Values longer than this, or containing a newline, get their own lines. */
const MAX_INLINE_VALUE = 90;

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Format one pair. Short single-line values sit inline in a padded column;
 * long or multi-line values move to indented continuation lines so a single
 * paragraph-length value cannot destroy the alignment of the whole table.
 * Either way the value is printed in full — discover mode never truncates.
 */
function formatPair(pair: DiscoverPair, nameWidth: number): string[] {
  const flag = pair.confidence === "high" ? "" : `  [${pair.confidence}]`;
  const isLong = pair.value.includes("\n") || pair.value.length > MAX_INLINE_VALUE;

  if (!isLong) {
    return [`    ${pair.name.padEnd(nameWidth)} : ${pair.value}${flag}`];
  }

  const out = [`    ${pair.name.padEnd(nameWidth)} :${flag}`];
  for (const line of pair.value.split("\n")) {
    out.push(`    ${" ".repeat(nameWidth)}   ${line}`);
  }
  return out;
}

/**
 * Build the full console report.
 *
 * Order is deliberate: what was read (and what was NOT) comes first, so a
 * skipped-pages problem is visible before the reader starts wondering why the
 * field list looks thin.
 */
export function formatDiscoverLog(input: DiscoverLogInput): string {
  const { payload, skipped } = input;
  const out: string[] = [];

  out.push("");
  out.push(RULE);
  out.push(
    `[ai-discover] ${input.pageFileNames.join(", ") || "(no pages)"} ` +
      `(${input.pagesSent}/${input.pagesTotal} page(s) sent to the model)`,
  );
  out.push(
    `  Registered type : ${input.registeredTypeName ?? "(unresolved)"} (${input.registeredTypeKey ?? "?"})`,
  );
  out.push(`  AI reads it as  : ${payload.documentLabel ?? "(no label offered)"}`);

  // ── Skipped pages ─────────────────────────────────────────────────────────
  if (skipped.length > 0) {
    out.push("");
    out.push(`  ⚠ Pages NOT sent (${skipped.length}):`);
    for (const p of skipped) {
      out.push(`    ${p.fileName}`);
      out.push(`      mime=${p.mimeType ?? "(null)"}`);
      out.push(`      ${p.reason}`);
    }
  }

  // ── Recognised name/value pairs ───────────────────────────────────────────
  out.push("");
  if (payload.recognised.length === 0) {
    out.push("  Name / value pairs: (none found)");
  } else {
    const nameWidth = Math.min(
      MAX_NAME_COL,
      Math.max(...payload.recognised.map((p) => p.name.length)),
    );
    out.push(`  Name / value pairs (${payload.recognised.length}):`);
    for (const pair of payload.recognised) {
      out.push(...formatPair(pair, nameWidth));
    }

    const unsure = payload.recognised.filter((p) => p.confidence !== "high").length;
    if (unsure > 0) {
      out.push(
        `    (!) ${unsure} of ${payload.recognised.length} below full confidence — flagged inline above`,
      );
    }
  }

  // ── Everything else, by inferred section ──────────────────────────────────
  out.push("");
  if (payload.sections.length === 0) {
    out.push("  Unrecognised content: (none)");
  } else {
    const lineTotal = payload.sections.reduce((n, s) => n + s.lines.length, 0);
    out.push(
      `  Unrecognised content, by inferred section ` +
        `(${payload.sections.length} section(s), ${lineTotal} line(s)):`,
    );
    for (const section of payload.sections) {
      out.push("");
      out.push(`    § ${collapse(section.heading)}`);
      if (section.lines.length === 0) {
        out.push("      (empty)");
      } else {
        for (const line of section.lines) out.push(`      ${line}`);
      }
    }
  }

  // ── Truncation warning ────────────────────────────────────────────────────
  // Last, not first: it describes the report above it, and discover mode asks
  // for verbatim content so hitting the output cap is a real possibility on a
  // long contract. Silently returning a partial read would be the worst
  // outcome for a mode whose entire promise is completeness.
  if (input.truncated) {
    out.push("");
    out.push(
      "  ⚠ TRUNCATED — the model hit its output limit, so the report above is INCOMPLETE.",
    );
    out.push("    Re-run on fewer pages, or raise max_tokens in the route.");
  }

  out.push(RULE);
  out.push("");

  return out.join("\n");
}
