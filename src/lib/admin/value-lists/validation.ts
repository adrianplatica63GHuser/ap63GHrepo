/**
 * Zod input schemas for the Value Lists API.
 * One schema per list (create = update shape; all payload fields required
 * or optional as the domain dictates; sortOrder always optional).
 */

import { z } from "zod/v4";
import type { ListKey } from "./config";
import { DOCUMENT_TYPE_ORIGINS } from "@/lib/documents/status";
import {
  MAX_TEMPLATE_FIELDS,
  mergeAcceptedFields,
} from "@/lib/documents/discover-to-template";
import type { DocumentTemplateField } from "@/lib/documents/template-fields";

// ── Leaf schemas ─────────────────────────────────────────────────────────────

const sortOrder = z.coerce.number().int().min(0).default(0);

/**
 * The same field on a PUT: optional, and **with no `.default()`**.
 *                                                            (Slice #27.03)
 *
 * ⚠️ **A default here is a silent data change on every rename in the app.** The
 * admin edit form is built from `LIST_META`, and not one list lists
 * `sortOrder` — so a PUT never carries it. `updateValue` is a full-replace
 * `.set(parsed.data)`, so a `.default(0)` makes every rename ALSO write
 * `sort_order = 0`. On Property Types, whose list is ordered by that column,
 * renaming an entry jumps it to the top of the list; on Document Types the
 * ordering is by name so nothing moves on screen and the reset is invisible
 * until something else reads the column. Nothing in the UI can put the value
 * back, because nothing in the UI can set it.
 *
 * Left `.optional()`, an absent `sortOrder` parses to `undefined`, and Drizzle's
 * `mapUpdateSet` drops undefined entries before building the SQL — so the
 * column is not named in the UPDATE at all and keeps whatever it had. Every
 * list schema still has one required field that always parses to a value
 * (`name` on ten of them, `indicativ` on `tarla`), so the set can never be
 * empty — Drizzle throws "No values to set" on an empty one.
 *
 * ⚠️ **The `null` preprocess is not defensive noise — `z.coerce` makes `null`
 * a 0.** `Number(null)` is 0, so a bare `z.coerce.number().optional()` accepts
 * an explicit `sortOrder: null` and quietly parses it to zero, which is the
 * exact reset this whole field exists to stop, arriving by the one route the
 * `.optional()` does not cover. Mapping `null` to `undefined` FIRST makes the
 * two spellings of "no sort order given" behave identically: the key is left
 * out of the UPDATE and the column keeps what it had. Anything else still
 * coerces as before, so a form value of `"7"` is still 7 and `-1` is still
 * rejected.
 *
 * ⚠️ **Not `.nullish()` on the number itself.** That would let a real `null`
 * through to `.set()` and write NULL into a NOT NULL column — a 500 where the
 * point of this is a no-op.
 *
 * This is the shape of the `origin` guard above, one column over: the create
 * path decides the value, and the update path does not name it. The difference
 * is that `sortOrder` is not write-once — a caller that genuinely means to
 * reorder still sends a number and still gets it written.
 */
const sortOrderOnUpdate = z.preprocess(
  (v) => (v === null ? undefined : v),
  z.coerce.number().int().min(0).optional(),
);

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

/**
 * Both relationship-role lists.                                (Slice #29.13)
 *
 * The same three fields as `personRoleSchema` — because
 * `lookup_property_property_role` and `lookup_document_document_role` are the
 * same table as `lookup_person_role`, column for column. ONE schema shared by
 * the two rather than two identical copies: they are edited by one generic
 * form and there is no field either could grow that the other would not.
 *
 * It replaces the two hand-written zod objects that lived in the deleted
 * `[id]` routes, which had `.max(200)` on the name and `.max(500)` on the
 * description where the nine have neither — a ceiling nothing on the screen
 * announced and nothing else in Reference Data enforces.
 */
export const relationshipRoleSchema = z.object({
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
  // Slice #27.03: the Reference Data form editor writes through this door and
  // can ADD a field, so the ceiling that PUT /api/document-types/[id]/
  // template-fields already enforces has to hold here too — otherwise the two
  // writers disagree about how large a template may be and the smaller one is
  // the only honest number. Capped on the array rather than checked in the
  // route so a script that reaches the schema directly is bound by it as well.
  //
  // Editing an existing template can only hold the count or shrink it, and no
  // stored template can exceed the cap (both writers enforce it), so this can
  // never lock an administrator out of fixing a label on a type he already has.
  templateFields: z
    .array(documentTemplateFieldSchema)
    .max(MAX_TEMPLATE_FIELDS, `at most ${MAX_TEMPLATE_FIELDS} fields`)
    .nullish(),
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
export const documentTypeUpdateSchema = documentTypeSchema
  .omit({ origin: true })
  .extend({ sortOrder: sortOrderOnUpdate });

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
  "property-property-roles": relationshipRoleSchema,
  "document-document-roles": relationshipRoleSchema,
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
 * Drop a `templateFields` array through the one sanitiser.   (Slice #27.03)
 *
 * ⚠️ **The value-lists PUT is now a keyboard, and it was not before.** Until
 * this slice the only writer of `template_fields` was PUT /api/document-types/
 * [id]/template-fields, which runs every field through `mergeAcceptedFields`.
 * The Reference Data form editor writes through THIS door instead — it has to,
 * because the other one is additive by construction and cannot rename, reorder
 * or remove. So the same choke point has to sit on this door too, or a label
 * typed with a line break reaches `buildExtractSystemPrompt`, which renders
 * each field as ONE `//` comment line inside the JSON shape it shows the model,
 * and breaks that shape.
 *
 * ⚠️ **`mergeAcceptedFields(fields, [])`, not a second sanitiser.** Its
 * EXISTING-row arm is exactly the contract this door needs, stated in its own
 * docblock: labels, hints and group names cleaned; `key` kept BYTE-FOR-BYTE,
 * never re-slugged, because a key is what every document of the type already
 * stores its value under; `order` renumbered 0..n-1 from array position, so the
 * editor can reorder by moving rows and never has to compute a number; and two
 * rows sharing one key collapsed to the first, because `custom_fields` is keyed
 * by it and the second could only shadow the first.
 *
 * That arm also means **an unsafe key sent by a caller is stored as sent.** It
 * is the right trade: re-slugging a stored key would strand real data on a save
 * the user asked for something else entirely. The editor never lets a key be
 * typed — an added field's key comes from `slugifyFieldKey`, which emits
 * `[a-z0-9_]{1,40}` — and no stored key can be unsafe, because both writers
 * have always produced them through that same function.
 *
 * `undefined` (the field absent — a plain rename) and `null` are returned
 * untouched, so a rename still cannot disturb the column and an explicit
 * `null` still clears the form.
 *
 * Lives here rather than beside its call site for the same blunt reason
 * `stripDocumentTypeOrigin` does: `queries.ts` imports `@/db`, which opens a
 * `pg.Pool` at module load, so a Jest test importing it would connect to a
 * database to check an array transform. This module is zod-and-pure-imports
 * only.
 */
export function sanitizeDocumentTypeTemplateFields<T extends Record<string, unknown>>(
  data: T,
): T {
  const raw = data.templateFields;
  if (!Array.isArray(raw)) return data;
  return {
    ...data,
    templateFields: mergeAcceptedFields(raw as DocumentTemplateField[], []),
  };
}

/**
 * PUT bodies. Identical to LIST_SCHEMAS except for the two things a PUT must
 * not say: a column that may be set at creation and never afterwards
 * (`origin`, document-types only), and `sortOrder`, which is optional-without-
 * a-default on EVERY list — see `sortOrderOnUpdate` for the rename it was
 * silently resetting.
 *
 * ⚠️ **Written out per list rather than spread-then-overridden.** The spread
 * was there so a list added to `VALID_LIST_KEYS` got its update schema for
 * free; the `sortOrder` fix means every entry now needs the same `.extend`, and
 * mapping over `LIST_SCHEMAS` to apply it would need a cast, because that map
 * is typed `z.ZodType<any>` and `.extend` lives on `z.ZodObject`. A new list
 * still fails loudly — `Record<ListKey, …>` will not compile with a key
 * missing — which is what the spread was really buying.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LIST_UPDATE_SCHEMAS: Record<ListKey, z.ZodType<any>> = {
  "property-types":        propertyTypeSchema.extend({ sortOrder: sortOrderOnUpdate }),
  "tarla":                 tarlaSchema.extend({ sortOrder: sortOrderOnUpdate }),
  "use-categories":        useCategorySchema.extend({ sortOrder: sortOrderOnUpdate }),
  "person-types":          personTypeSchema.extend({ sortOrder: sortOrderOnUpdate }),
  "person-roles":          personRoleSchema.extend({ sortOrder: sortOrderOnUpdate }),
  "citizenships":          citizenshipSchema.extend({ sortOrder: sortOrderOnUpdate }),
  "judicial-person-types": judicialPersonTypeSchema.extend({ sortOrder: sortOrderOnUpdate }),
  // Already carries `sortOrderOnUpdate` — the omit-plus-extend is on the
  // exported schema itself, so the two cannot fall out of step.
  "document-types":        documentTypeUpdateSchema,
  "institutions":          institutionSchema.extend({ sortOrder: sortOrderOnUpdate }),
  "property-property-roles": relationshipRoleSchema.extend({ sortOrder: sortOrderOnUpdate }),
  "document-document-roles": relationshipRoleSchema.extend({ sortOrder: sortOrderOnUpdate }),
};
