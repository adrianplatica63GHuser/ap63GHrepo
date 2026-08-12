/**
 * Zod input schemas for the Value Lists API.
 * One schema per list (create = update shape; all payload fields required
 * or optional as the domain dictates; sortOrder always optional).
 */

import { z } from "zod/v4";
import type { ListKey } from "./config";
import { DOCUMENT_TYPE_ORIGINS } from "@/lib/documents/status";

// ── Leaf schemas ─────────────────────────────────────────────────────────────

const sortOrder = z.coerce.number().int().min(0).default(0);

// Slice #19.02: boolean flags sent as actual JSON booleans from the admin UI.
const boolField = z.preprocess(
  (v) => v === true || v === "true",
  z.boolean(),
);

export const propertyTypeSchema = z.object({
  name:             z.string().min(1, "required"),
  showTarlaParcela: boolField.default(false),
  showAddress:      boolField.default(false),
  showStreetView:   boolField.default(false),
  sortOrder,
});

export const tarlaSchema = z.object({
  indicativ: z.string().min(1, "required"),
  descriere: z.string().nullish(),
  sortOrder,
});

export const useCategorySchema = z.object({
  name:      z.string().min(1, "required"),
  sortOrder,
});

export const personTypeSchema = z.object({
  name:      z.string().min(1, "required"),
  sortOrder,
});

export const personRoleSchema = z.object({
  name:        z.string().min(1, "required"),
  description: z.string().nullish(),
  sortOrder,
});

export const citizenshipSchema = z.object({
  name:      z.string().min(1, "required"),
  sortOrder,
});

// Slice #21.03.Import / Slice 3 — optional type-specific field template.
// Mirrors DocumentTemplateField (src/lib/documents/template-fields.ts) but is
// declared separately here rather than imported: that module is deliberately
// framework-free and shared with AI-extraction prompt building, and keeping
// this validation-only shape local avoids coupling the two. parseTemplateFields
// on the read side never throws on malformed data regardless, so the two
// staying loosely in sync (not literally sharing a type) is safe.
// Exported since Slice #26.11: PUT /api/document-types/[id]/template-fields
// validates with the same shape, so the two write paths into template_fields
// cannot disagree about what a field is.
export const documentTemplateFieldSchema = z.object({
  key:     z.string().min(1, "required"),
  labelRo: z.string().min(1, "required"),
  labelEn: z.string().min(1, "required"),
  type:    z.enum(["text", "textarea", "date", "number"]),
  order:   z.coerce.number().int().min(0).default(0),
  aiHint:  z.string().nullish(),
  // Optional sub-panel grouping (e.g. "Financiar" / "Financial") — see the
  // DocumentTemplateField comment for how ungrouped fields behave.
  groupRo: z.string().nullish(),
  groupEn: z.string().nullish(),
});

export const documentTypeSchema = z.object({
  name:      z.string().min(1, "required"),
  sortOrder,
  // Optional — omitted entirely by the admin UI's name/sortOrder-only edit
  // form (see LIST_META["document-types"]), so a plain rename never touches
  // this column. Only a caller that explicitly sends `templateFields` (e.g.
  // a one-off admin API call to set a type's template) writes to it.
  templateFields: z.array(documentTemplateFieldSchema).nullish(),
  // Slice #26.12 — how this type came to exist. CREATE ONLY: see
  // documentTypeUpdateSchema below, which omits it, and updateValue, which
  // strips it a second time.
  //
  // ⚠️ **No `.default()`, and that is the point.** A default would make the
  // field present-and-MANUAL on every parse, so a payload that never mentioned
  // origin would still arrive at the query layer carrying one. Left optional,
  // an absent origin stays absent and `createValue` supplies MANUAL itself —
  // one place decides the fallback instead of two.
  origin: z.enum(DOCUMENT_TYPE_ORIGINS).optional(),
});

/**
 * The same list, minus `origin`.   (Slice #26.12)
 *
 * ⚠️ **Origin is write-once, and a rename is what would have broken it.** The
 * admin edit form sends only the fields in LIST_META — `{ name }` for document
 * types — and PUT is a FULL-REPLACE update: `updateValue` does
 * `.set(parsed.data)`. Had `origin` carried a `.default("MANUAL")` on the
 * shared schema, every rename of an imported type would have parsed to
 * `{ name, sortOrder: 0, origin: "MANUAL" }` and quietly re-originated it —
 * blue to black, "AI scanned" to "New", with nothing in the diff to see. So the
 * update path cannot even name the column.
 *
 * `.omit()` rather than a hand-written second object so the two can never fall
 * out of step on `name`, `sortOrder` or `templateFields`.
 */
export const documentTypeUpdateSchema = documentTypeSchema.omit({ origin: true });

export const judicialPersonTypeSchema = z.object({
  name:      z.string().min(1, "required"),
  sortOrder,
});

export const institutionSchema = z.object({
  name:            z.string().min(1, "required"),
  institutionType: z.string().nullish(),
  sortOrder,
});

// ── Dispatch map ─────────────────────────────────────────────────────────────

/** POST bodies. Create-only fields (e.g. document-types' `origin`) live here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LIST_SCHEMAS: Record<ListKey, z.ZodType<any>> = {
  "property-types":  propertyTypeSchema,
  "tarla":           tarlaSchema,
  "use-categories":  useCategorySchema,
  "person-types":    personTypeSchema,
  "person-roles":    personRoleSchema,
  "citizenships":    citizenshipSchema,
  "judicial-person-types": judicialPersonTypeSchema,
  "document-types":  documentTypeSchema,
  "institutions":    institutionSchema,
};

/**
 * Drop `origin` from an update payload.   (Slice #26.12)
 *
 * ⚠️ **The second of two guards on a write-once column, and the redundancy is
 * deliberate.** `updateValue` in ./queries.ts is a full-replace `.set(...)`, so
 * anything that reaches it is written. `LIST_UPDATE_SCHEMAS` below protects the
 * HTTP route by omitting the column from the PUT schema; this protects every
 * OTHER caller — a script, a future admin action, a test — from re-originating
 * a type by handing back the row it just read. A rename must never turn an
 * import-created type into a hand-added one.
 *
 * ⚠️ **It lives HERE, not next to its call site**, for one blunt reason:
 * `queries.ts` imports `@/db`, which constructs a `pg.Pool` at module load, so
 * a Jest test importing it would open a database connection to check a
 * three-line object spread. This module is zod-only. Keeping it here also puts
 * both halves of the guard in one file, which is where a reader looking for one
 * would expect to find the other.
 *
 * Named and exported rather than inlined as a destructure so the guard can be
 * asserted on BEHAVIOUR — the test it replaced looked for two source substrings
 * anywhere in a 300-line file and would have stayed green after a refactor that
 * moved the strip out of the branch that needs it.
 */
export function stripDocumentTypeOrigin<T extends Record<string, unknown>>(
  data: T,
): Omit<T, "origin"> {
  const { origin: _ignored, ...safe } = data;
  void _ignored;
  return safe;
}

/**
 * PUT bodies. Identical to LIST_SCHEMAS except where a list has a field that
 * may be set at creation and never afterwards.
 *
 * Spread-then-override rather than a full second literal: a list added to
 * VALID_LIST_KEYS gets its update schema for free, and only a list that
 * genuinely needs a different one has to say so here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LIST_UPDATE_SCHEMAS: Record<ListKey, z.ZodType<any>> = {
  ...LIST_SCHEMAS,
  "document-types": documentTypeUpdateSchema,
};
