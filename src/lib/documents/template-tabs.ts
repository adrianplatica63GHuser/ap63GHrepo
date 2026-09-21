/**
 * The notebook behind a document type's Details tab.            (Slice #36.01)
 *
 * WHY THIS IS A MODULE AND NOT A CVC-SHAPED TABLE
 * -----------------------------------------------
 * Adrian's escape hatch for the sixty-field ceiling was "turn the details tab
 * into a notebook with 3, 4, 5 tabs, each holding a number of panels that are
 * related, each small enough to make scrolling unnecessary". The cheap way to
 * get that would have been a `CONTRACT_VANZARE` → tab-list map in
 * `template-groups.ts`. It is not taken, and the reason is the stated design of
 * the whole template mechanism: "adding a new document type's full template is
 * a DB row, never a schema migration or a code deploy"
 * (template-fields.ts's header, and migration_066's). A hard-coded map breaks
 * that promise for every type that comes after the one it was written for.
 *
 * So a tab is a field-level key pair, `tabRo` / `tabEn`, stored in the same
 * jsonb beside `groupRo` / `groupEn` — no migration, authored from the Form
 * editor, and read by the three functions here.
 *
 * ⚠️ **THE COMPATIBILITY GUARANTEE IS `templateTabsOf(fields).length === 0`.**
 * When no field on a type carries a tab, that is the empty array, and
 * `document-form.tsx` takes the branch it has taken since #27.03 — one column
 * of sections, no notebook chrome, byte-identical rendering. Every existing
 * type is in that state and stays there until somebody types a tab name. The
 * test that matters is the one pinning THAT, not the one proving the new path
 * works.
 *
 * ⚠️ **ONE ORDER, NOT FOUR.** The Form editor's ↑/↓ renumber `order` 0..n-1
 * server-side, `parseTemplateFields` sorts on it, and the form buckets panels
 * by first appearance in that order. Tabs follow the same rule — a tab's
 * position is the `order` of its first field — so there is nothing extra to
 * store and no way for field order, panel order and tab order to disagree.
 *
 * ⚠️ **EXACT TEXT, NO FOLDING** — the same decision `templateFieldGroupOf`
 * makes and for the same reason. Two tab names differing by one diacritic are
 * two tabs, visibly, rather than one tab that silently swallowed a field.
 *
 * PURE — no React, no DB, no next/*. Imported by a client component and by
 * tests alike, same contract as `template-fields.ts` and `template-groups.ts`.
 */

import type { DocumentTemplateField } from "@/lib/documents/template-fields";

/** The tab label a field carries, or "" when it names none. */
export function templateTabLabelOf(
  field: Pick<DocumentTemplateField, "tabRo" | "tabEn">,
): string {
  return field.tabRo || field.tabEn || "";
}

/**
 * The type's tabs, in `order`, deduplicated, first appearance winning.
 *
 * `[]` means this type has no notebook — see the guarantee in the header.
 */
export function templateTabsOf(fields: readonly DocumentTemplateField[]): string[] {
  const tabs: string[] = [];
  for (const field of fields) {
    const label = templateTabLabelOf(field);
    if (label && !tabs.includes(label)) tabs.push(label);
  }
  return tabs;
}

/**
 * Which tab a field sits on.
 *
 * A field that names no tab — or names one that is somehow not in `tabs` —
 * goes on the FIRST tab. There is no such thing as a field the notebook cannot
 * show: a field nobody can reach is a field whose captured value is invisible,
 * which is the one outcome this module must not produce.
 */
export function tabIndexOfField(
  field: Pick<DocumentTemplateField, "tabRo" | "tabEn">,
  tabs: readonly string[],
): number {
  const i = tabs.indexOf(templateTabLabelOf(field));
  return i >= 0 ? i : 0;
}

/**
 * Which tab a PANEL sits on: the tab of its first field.
 *
 * A panel is a bucket of fields sharing a group name, and its fields are in
 * `order`, so "first field" is the same first-appearance rule that decides the
 * panel's own position on the page. A panel whose fields disagree about the tab
 * follows its first field and does not split — splitting one titled box across
 * two pages of a notebook is not a layout, it is two panels with one name.
 */
export function tabIndexOfPanel(
  fields: readonly Pick<DocumentTemplateField, "tabRo" | "tabEn">[],
  tabs: readonly string[],
): number {
  return fields.length > 0 ? tabIndexOfField(fields[0], tabs) : 0;
}

/**
 * Which tab the „Taxe și onorarii” / „Financiar” PAIR sits on.
 *
 * ⚠️ **The pair is one unit, and it has to be, because the fees panel is not
 * only template fields.** It always renders — it carries Notariat / Nr. act
 * autentic / Data autentificării for every document type in the app, whether or
 * not the type has a template at all — and `document-form.tsx` lays the two
 * side by side at half width when Financiar exists. So the unit's tab is the
 * tab of the first field among the two groups' fields, in `order`, and when
 * NEITHER group has a field the unit falls on the first tab, where the three
 * always-present inputs belong.
 *
 * When the two groups' fields land on different tabs the pairing is dropped and
 * each renders alone on its own tab — see `document-form.tsx`. Half a pair on
 * one page and half on another would be the same panel drawn twice.
 */
export function tabIndexOfFeesPair(
  feesFields: readonly DocumentTemplateField[],
  financialFields: readonly DocumentTemplateField[],
  tabs: readonly string[],
): number {
  const first = [...feesFields, ...financialFields].sort((a, b) => a.order - b.order)[0];
  return first ? tabIndexOfField(first, tabs) : 0;
}

/**
 * Do the fees panel and the Financiar panel still pair up?
 *
 * True when there is no notebook at all (the pre-#36.01 answer, unchanged), or
 * when both land on the same tab.
 */
export function feesPairStaysTogether(
  feesFields: readonly DocumentTemplateField[],
  financialFields: readonly DocumentTemplateField[],
  tabs: readonly string[],
): boolean {
  if (tabs.length === 0) return true;
  if (financialFields.length === 0) return false;
  return (
    tabIndexOfPanel(feesFields, tabs) === tabIndexOfPanel(financialFields, tabs) ||
    feesFields.length === 0
  );
}
