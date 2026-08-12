/**
 * What a document type IS, and what a document HAS BEEN THROUGH.   (Slice #26.12)
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The brief asks for six labels — New / AI scanned / AI completed on a type,
 * New / AI processed / Imported on a document — and for a colour coding on the
 * Reference Data list. It also says, in as many words, not to add a status
 * column for any of them.
 *
 * That instruction is the whole design. Five of the six labels are already
 * written down somewhere in this database, and writing them down a second time
 * is how two answers to one question start to drift:
 *
 *   type  AI completed   `template_fields` is a non-empty array. Since #26.11
 *                        that is the ONLY way a type gets a form, and both
 *                        origins reach it the same way — which is the answer to
 *                        the source document's own question about moving a
 *                        hand-added type to one with a form.
 *   doc   AI processed   `aiInterpretedAt` set AND the type has a form.
 *   doc   Imported       `aiInterpretedAt` set and the type has none.
 *   doc   New            `aiInterpretedAt` null.
 *
 * ⚠️ **`aiInterpretedAt` means "an import read this", and only since #26.09.**
 * It used to mean "somebody pressed AI Interpret on the document page". That
 * button is gone — `runAiInterpret` (src/lib/import/ai-interpret-run.ts) and
 * the identity-card dialog beside it, both inside the import run, are the only
 * writers left. So the column now answers exactly the question the brief asks.
 * **If a second writer outside an import is ever added, `documentStatus` stops
 * being true and this comment is the thing to come back to** — AI Discover is
 * deliberately not one: it persists nothing and stamps nothing, which is what
 * lets it be re-run.
 *
 * The one fact NOT recoverable from the row is a type's ORIGIN — nothing
 * distinguishes a type Adrian typed into Reference Data from one
 * `ensureDocType` created mid-scan, because both go through the same POST. So
 * that one is stored (`lookup_document_type.origin`,
 * migration_069_document_type_origin.sql) and everything else is computed here.
 *
 * ONE FUNCTION FOR THE LABEL AND THE COLOUR
 * -----------------------------------------
 * The brief's three colours and its three type statuses partition the same rows
 * the same way:
 *
 *   has a form          -> bold green -> AI completed
 *   else origin IMPORT  -> blue       -> AI scanned
 *   else                -> black      -> New
 *
 * They are one decision, so they are taken once. A colour that contradicted the
 * label beside it would be a bug nobody could see in a diff.
 *
 * NO ROMANIAN LIVES HERE. The functions return ids; `messages/*.json` owns the
 * words, for the reason `import-outcome.ts` and `report-html.ts` both state
 * about themselves — a second home for display text is a second version of it.
 *
 * Kept pure and framework-free so server components, client components and the
 * admin list can all import it.
 */

import { parseTemplateFields } from "./template-fields";

// ---------------------------------------------------------------------------
// Origin — the stored fact
// ---------------------------------------------------------------------------

/**
 * The value set of `lookup_document_type.origin`. Mirrors the CHECK constraint
 * in migration_069_document_type_origin.sql; the two must move together.
 */
export const DOCUMENT_TYPE_ORIGINS = ["MANUAL", "IMPORT"] as const;

export type DocumentTypeOrigin = (typeof DOCUMENT_TYPE_ORIGINS)[number];

export function isDocumentTypeOrigin(value: unknown): value is DocumentTypeOrigin {
  return typeof value === "string"
    && (DOCUMENT_TYPE_ORIGINS as readonly string[]).includes(value);
}

/**
 * Read an origin off a row that may have come from anywhere.
 *
 * ⚠️ **Anything unrecognised reads as MANUAL, deliberately.** The column is NOT
 * NULL with a default, so a live row cannot be null — but a row can reach this
 * function from a `fetch` whose JSON predates the migration, from a test
 * fixture, or from a cached TanStack Query result written before a hard reload.
 * MANUAL is the value that makes no new claim: it renders black and reads
 * "New", which is exactly what the list showed before this slice. Guessing
 * IMPORT would paint a type Adrian created himself as something the machine
 * invented, and he would have no way to correct it.
 */
export function documentTypeOriginOf(value: unknown): DocumentTypeOrigin {
  return isDocumentTypeOrigin(value) ? value : "MANUAL";
}

// ---------------------------------------------------------------------------
// Does the type have a custom form?
// ---------------------------------------------------------------------------

/**
 * The "AI completed" test, and the "AI processed" half of the document test.
 *
 * Delegates to `parseTemplateFields` rather than testing the raw jsonb, and
 * that is not a stylistic preference. `parseTemplateFields` drops entries with
 * no usable `key`, so `[{}]` and `[{ labelRo: "x" }]` parse to zero fields —
 * they render no inputs on the document form and contribute nothing to the
 * extraction prompt. A raw `Array.isArray(raw) && raw.length > 0` would call
 * that type AI completed while the form it promises is empty, and the document
 * beside it would read "AI processed" having had nothing extracted. The rule
 * this codebase learned the hard way applies: a claim about the system must be
 * derived from the code that does the work, never from the shape it is stored
 * in.
 */
export function documentTypeHasForm(templateFields: unknown): boolean {
  return parseTemplateFields(templateFields).length > 0;
}

// ---------------------------------------------------------------------------
// The document type's status  (and, identically, its colour)
// ---------------------------------------------------------------------------

/**
 * `new` — added by hand, no form yet.
 * `aiScanned` — created by an import scan, no form yet.
 * `aiCompleted` — has a custom form, whichever way it was created.
 */
export type DocumentTypeStatus = "new" | "aiScanned" | "aiCompleted";

export type DocumentTypeStatusInput = {
  /** `lookup_document_type.origin`. Unrecognised/absent reads as MANUAL. */
  origin?: unknown;
  /** `lookup_document_type.template_fields`, raw. */
  templateFields?: unknown;
};

export function documentTypeStatus(row: DocumentTypeStatusInput): DocumentTypeStatus {
  // The form wins over the origin, and the brief says so twice — "types with a
  // custom form are bold green" is stated without qualification, and #26.11's
  // note that both origins reach a form the same way is the same rule from the
  // other side. An imported type that has since been given a form is finished,
  // not still scanned.
  if (documentTypeHasForm(row.templateFields)) return "aiCompleted";
  return documentTypeOriginOf(row.origin) === "IMPORT" ? "aiScanned" : "new";
}

/**
 * The Reference Data list's colour coding, keyed by the SAME status.
 *
 * ⚠️ **The only place these classes are written.** `document-type-origin-
 * single-source.test.ts` fails the build if a second component hand-writes a
 * blue-or-green document-type name, because the failure mode is silent: a
 * colour that disagrees with the label beside it looks like a design choice.
 *
 * Black is `text-ink dark:text-zinc-300` — the table's own body colour, not a
 * literal black — so an untouched type looks exactly as it did before this
 * slice, which is what "added by hand is black" means on a list where every
 * other row is already that colour.
 */
export const DOCUMENT_TYPE_STATUS_CLASS: Record<DocumentTypeStatus, string> = {
  new:         "text-ink dark:text-zinc-300",
  aiScanned:   "text-blue-700 dark:text-blue-400",
  aiCompleted: "font-bold text-green-700 dark:text-green-400",
};

/** Convenience: the class for a row, without naming the status twice. */
export function documentTypeNameClass(row: DocumentTypeStatusInput): string {
  return DOCUMENT_TYPE_STATUS_CLASS[documentTypeStatus(row)];
}

// ---------------------------------------------------------------------------
// The document's status
// ---------------------------------------------------------------------------

/**
 * `new` — nothing has read it: created with Add New on the Documents page.
 * `imported` — an import read it, but its type had no form to fill in.
 * `aiProcessed` — an import read it into its type's custom form.
 */
export type DocumentStatus = "new" | "imported" | "aiProcessed";

export type DocumentStatusInput = {
  /** `document.ai_interpreted_at`. A Date, an ISO string, or null. */
  aiInterpretedAt?: Date | string | null;
  /** `template_fields` of THIS DOCUMENT'S type, raw. */
  typeTemplateFields?: unknown;
};

export function documentStatus(input: DocumentStatusInput): DocumentStatus {
  // ⚠️ An empty string is not a timestamp. The one production caller — the
  // document page — passes the raw `Date | null` off Drizzle, so this branch is
  // defensive rather than load-bearing TODAY; it exists for a client-side or
  // JSON-round-tripped caller, where `""` is what an unset form value and a
  // serialised null both tend to become. `"" != null` is true, so without the
  // trim an untouched document would read "Imported". Same rule the forms' own
  // `blank` helper applies to every other field.
  const stamped = typeof input.aiInterpretedAt === "string"
    ? input.aiInterpretedAt.trim().length > 0
    : input.aiInterpretedAt != null;

  if (!stamped) return "new";
  return documentTypeHasForm(input.typeTemplateFields) ? "aiProcessed" : "imported";
}

/**
 * The document-page badge's colours.
 *
 * Deliberately NOT the type list's three classes: those are a name rendered in
 * a colour, these are a pill, and the two statuses they encode are different
 * sets. Sharing one map would mean the day one of the two gains a fourth state
 * the other silently gains a wrong one.
 */
export const DOCUMENT_STATUS_CLASS: Record<DocumentStatus, string> = {
  new:         "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  imported:    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  aiProcessed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};
