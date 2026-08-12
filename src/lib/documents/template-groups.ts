/**
 * The three template-field group names the document form lays out specially.
 *                                                            (Slice #27.03)
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * `document-form.tsx` recognises three group names BY EXACT TEXT (Slice
 * #21.06.misc) and gives each its own layout: Financiar and Taxe și onorarii
 * pair up side by side at half width, and every field under Certificate și
 * referințe is forced full-width / auto-grow whatever its configured `type`.
 * Any other group name falls through to the generic two-column rendering.
 *
 * ⚠️ **An exact-text match is a silent failure mode, and #27.03 gave it a
 * second writer.** Until this slice the only way a group name reached
 * `template_fields` was the AI-Discovery review step, which never sets one at
 * all — so the three names existed solely in the seed templates, typed once.
 * The Reference Data form editor lets an administrator put a field in a group
 * from a keyboard, and a name that is one diacritic or one space off (
 * "Taxe si onorarii", "Certificate si referinte") is not an error anywhere: the
 * field saves, the form renders, and the type quietly loses the layout it had.
 * So the editor offers these three BY NAME, from here, and never asks anyone to
 * retype them.
 *
 * ONE PAIR, BOTH LOCALES, STORED TOGETHER. A field carries `groupRo` and
 * `groupEn`, and `document-form.tsx` buckets on `groupRo || groupEn` — so a
 * field written with only `groupEn` still groups, and still matches, which is
 * why each matcher tests BOTH spellings rather than just the Romanian one.
 * Nothing here decides which of the two is displayed; the form shows the label
 * it bucketed on.
 *
 * PURE — no React, no DB, no next/*. Imported by a server-rendered form and by
 * a client-side admin dialog alike.
 */

export type TemplateFieldGroupId = "financial" | "fees" | "certificates";

export type TemplateFieldGroup = {
  id: TemplateFieldGroupId;
  /** The exact text stored in `groupRo`. */
  ro: string;
  /** The exact text stored in `groupEn`. */
  en: string;
};

/**
 * The three, in the order the editor offers them — which is also the order they
 * appear down the document form (Financiar and Taxe și onorarii share a row,
 * Certificate și referințe sits below).
 *
 * ⚠️ **These strings are DATA, not display text, so they do not live in
 * `messages/*.json`.** They are compared against what is stored on rows that
 * already exist; a translator improving the Romanian would silently unmatch
 * every seeded template. The editor shows both spellings side by side
 * ("Financiar / Financial") rather than picking one by locale, so an
 * administrator can see exactly what is being written.
 */
export const TEMPLATE_FIELD_GROUPS: readonly TemplateFieldGroup[] = [
  { id: "financial",    ro: "Financiar",                en: "Financial" },
  { id: "fees",         ro: "Taxe și onorarii",         en: "Fees" },
  { id: "certificates", ro: "Certificate și referințe", en: "Certificates and references" },
] as const;

/** Look one up by id. Returns undefined for an id that is not one of the three. */
export function templateFieldGroupById(
  id: string | null | undefined,
): TemplateFieldGroup | undefined {
  return TEMPLATE_FIELD_GROUPS.find((g) => g.id === id);
}

/**
 * Which of the three a bucket label is, or null for a free-text group.
 *
 * ⚠️ **Exact, deliberately — no trim, no case fold, no diacritic fold.** This
 * function answers "will `document-form.tsx` lay this group out specially?",
 * and that question has exactly one correct answer: the one the form's own
 * comparison gives. A tolerant match here would report a layout the form does
 * not apply, which is worse than reporting none.
 */
export function templateFieldGroupOf(
  label: string | null | undefined,
): TemplateFieldGroupId | null {
  if (!label) return null;
  const hit = TEMPLATE_FIELD_GROUPS.find((g) => g.ro === label || g.en === label);
  return hit ? hit.id : null;
}

/** `Financiar` / `Financial` — pairs with Taxe și onorarii at half width. */
export function isFinancialGroup(label: string): boolean {
  return templateFieldGroupOf(label) === "financial";
}

/** `Taxe și onorarii` / `Fees` — the always-rendered panel. */
export function isFeesGroup(label: string): boolean {
  return templateFieldGroupOf(label) === "fees";
}

/** `Certificate și referințe` / `Certificates and references` — full-width, auto-grow. */
export function isCertificatesGroup(label: string): boolean {
  return templateFieldGroupOf(label) === "certificates";
}
