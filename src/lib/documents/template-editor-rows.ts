/**
 * The rows behind the Reference Data template-fields editor.   (Slice #27.03)
 *
 * WHY THIS IS NOT IN THE COMPONENT
 * --------------------------------
 * It was, and an adversarial round pointed out what that cost: `keyForRow` and
 * its friends were module-private inside a `.tsx` client component, so the one
 * decision on that screen that can lose data — which `custom_fields` key a row
 * will be stored under — could not be asserted anywhere. The test file named
 * for the editor was testing the Zod schema instead, and deleting the
 * uniqueness pass would have left the whole suite green while two new fields
 * sharing a label silently shadowed each other.
 *
 * So: pure, framework-free, no React, and the component below it does layout
 * and state only. Same contract as `template-fields.ts` and
 * `discover-to-template.ts`, which it builds on rather than duplicating.
 *
 * THE ONE RULE EVERYTHING HERE SERVES
 * -----------------------------------
 * A stored `key` is permanent. It is the JSON key under which every document
 * of the type already holds its value, so a label may be renamed freely and a
 * key may never be rewritten. `keysForRows` returns a stored row's key
 * byte-for-byte, always, and only ever DERIVES one for a row the administrator
 * added in this session — from the label, through the same `slugifyFieldKey` /
 * `uniqueFieldKey` pair the AI-Discovery path uses, so the two cannot mint keys
 * by different rules.
 */

import {
  normaliseKeyForComparison,
  slugifyFieldKey,
  uniqueFieldKey,
} from "@/lib/documents/discover-to-template";
import type {
  DocumentTemplateField,
  DocumentTemplateFieldType,
} from "@/lib/documents/template-fields";
import {
  templateFieldGroupById,
  templateFieldGroupOf,
} from "@/lib/documents/template-groups";

/** The group `<select>`'s two non-group options. */
export const GROUP_NONE = "";
export const GROUP_CUSTOM = "__custom__";

export type TemplateEditorRow = {
  /** Stable React key. NOT the field key — a new row has none until it has a label. */
  rowId: string;
  /** The STORED key, or "" for a row added in this session. */
  key: string;
  labelRo: string;
  labelEn: string;
  type: DocumentTemplateFieldType;
  aiHint: string;
  /** One of the three group ids, GROUP_NONE, or GROUP_CUSTOM. */
  groupChoice: string;
  /** The free-text group name. Only meaningful when groupChoice is GROUP_CUSTOM. */
  groupCustom: string;
  /**
   * The free-text group pair EXACTLY as it was stored, or null.
   *
   * ⚠️ **Without this, editing any row rewrites another row's English panel
   * title.** A free-text group is one input but two stored columns, and a row
   * can arrive with `groupRo: "Suprafețe"` and `groupEn: "Areas"`. Collapsing
   * both to the single input's text on every save would rename the English
   * panel to "Suprafețe" because an administrator fixed an unrelated row's AI
   * hint. Kept here, and re-emitted verbatim whenever the input was not
   * actually edited.
   */
  storedGroup: { ro: string | null; en: string | null } | null;
};

/** Build an editor row from a stored field. */
export function rowFromStoredField(
  field: DocumentTemplateField,
  index: number,
): TemplateEditorRow {
  const bucket = field.groupRo || field.groupEn || "";
  const known = templateFieldGroupOf(bucket);
  return {
    rowId: `stored-${index}-${field.key}`,
    key: field.key,
    labelRo: field.labelRo,
    labelEn: field.labelEn,
    type: field.type,
    aiHint: field.aiHint ?? "",
    // ⚠️ A stored group that is not one of the three stays free text. Quietly
    // re-mapping it onto a name it did not have would change the document
    // form's layout on a save made for some other reason.
    groupChoice: bucket ? (known ?? GROUP_CUSTOM) : GROUP_NONE,
    groupCustom: bucket && !known ? bucket : "",
    storedGroup: bucket && !known ? { ro: field.groupRo ?? null, en: field.groupEn ?? null } : null,
  };
}

/** A blank row, ready for a label. */
export function blankEditorRow(rowId: string): TemplateEditorRow {
  return {
    rowId,
    key: "",
    labelRo: "",
    labelEn: "",
    type: "text",
    aiHint: "",
    groupChoice: GROUP_NONE,
    groupCustom: "",
    storedGroup: null,
  };
}

/**
 * A field removed in this session, and the labels it was wearing.
 *
 * ⚠️ **The labels are here because the key alone could not keep the
 * confirmation's promise.** Rule 1 of the editor is that a label may be renamed
 * freely while the key stays — so a field minted as `pretTotal` may be sitting
 * under the label "Valoare totală" by the time anyone removes it. Matching only
 * on "does the new label slug to the removed key" then fails on exactly the
 * fields the editor most encourages you to rename: the administrator types back
 * the label he was just looking at, gets `valoare_totala`, and the captured
 * values stay under `pretTotal` for good. Round two of the review found this;
 * the fix is to remember what the row was CALLED as well as what it was keyed.
 */
export type ReclaimableKey = {
  key: string;
  labelRo: string;
  labelEn: string;
};

/**
 * The key each row will be stored under, in row order.
 *
 * ⚠️ **ONE left-to-right pass over a single shared `taken` set — not one
 * independent call per row.** The per-row version looked symmetrical and was:
 * for two new rows both labelled "Preț", each built `taken` from the OTHER
 * row's slug, so each saw `pret` occupied and each derived `pret_2`. Nobody got
 * `pret`, the live key preview showed the same key on two rows, and the save
 * failed naming a key neither row was entitled to. `uniqueFieldKey` mutates the
 * set it is given precisely so a single walk does the right thing.
 *
 * Every STORED key is seeded first, before the walk, so a new row earlier in
 * the list can never take a key that belongs to a stored row further down.
 *
 * @param reclaimable rows REMOVED in this session, offered back to a new row
 *   that means the same thing — either because its label slugs to the removed
 *   KEY, or because its label IS one of the removed row's labels. See
 *   `confirmRemoveBody`: removal promises the captured values reappear when the
 *   field is put back, and that promise is only keepable if the key comes back
 *   too. A stored `pretTotal` re-added from "Preț total" (the key route) or
 *   from "Valoare totală" (the label route, after an earlier rename) must both
 *   land on `pretTotal`, or the values are unreachable from every screen.
 * @returns one key per row, same order. `""` for a row with no usable label.
 */
export function keysForRows(
  rows: readonly TemplateEditorRow[],
  reclaimable: readonly ReclaimableKey[] = [],
): string[] {
  const taken = new Set<string>();
  for (const row of rows) {
    if (row.key) taken.add(normaliseKeyForComparison(row.key));
  }
  return rows.map((row) => {
    if (row.key) return row.key;

    const source = row.labelRo.trim() || row.labelEn.trim();
    // ⚠️ No fallback slug for a blank row. `slugifyFieldKey("")` returns the
    // module's FALLBACK_KEY, which would RESERVE that name: a blank row beside
    // a row labelled "Camp" pushed the labelled one to `camp_2`, and it flipped
    // back to `camp` the instant the blank row was typed into — a live preview
    // that changes for reasons the administrator cannot see.
    if (!source) return "";

    const slug = slugifyFieldKey(source);
    const norm = normaliseKeyForComparison(slug);
    const reclaimed = reclaimable.find((r) => {
      // ⚠️ **An empty key is not reclaimable, and the check has to be HERE.**
      // `normaliseKeyForComparison("")` is `""`, which `taken` never holds, so
      // without this the label route hands back `""` for any row whose label
      // matches — and `validateEditorRows` then reports "every field needs a
      // label" about a row that plainly has one, with no way out but renaming
      // it. Nothing in the dialog can construct that today (`requestRemove`
      // and `removeConfirmed` both refuse a keyless row, and
      // `parseTemplateFields` drops empty-key fields), which is exactly why it
      // belongs to the function rather than to two call sites in a component.
      if (!r.key) return false;
      const keyNorm = normaliseKeyForComparison(r.key);
      // Its own key is still on the type — reclaiming would duplicate it. This
      // is ALSO what stops two rows claiming one removed key, because a claim
      // adds to `taken` below: the second row finds it occupied and derives its
      // own. (A separate `claimed` set was tried and could not decide a single
      // case `taken` did not already decide, so it was removed rather than left
      // as a guard nobody could fail.)
      if (taken.has(keyNorm)) return false;
      if (keyNorm === norm) return true;
      // …or the label matches what the row was called when it was removed.
      return [r.labelRo, r.labelEn]
        .filter(Boolean)
        .some((l) => normaliseKeyForComparison(slugifyFieldKey(l)) === norm);
    });
    if (reclaimed) {
      taken.add(normaliseKeyForComparison(reclaimed.key));
      return reclaimed.key;
    }
    // Mutates `taken`, which is why this is one walk and not one call per row.
    return uniqueFieldKey(slug, taken);
  });
}

/**
 * What is wrong with the rows, or null.
 *
 * ⚠️ **Duplicates are compared on the EXACT key, not the normalised one, and
 * that is a correction rather than a shortcut.** `mergeAcceptedFields`'
 * existing-row arm — the code that actually writes this column — dedupes on the
 * exact key and deliberately keeps `pretTotal` and `pret_total` side by side;
 * `discover-to-template.test.ts` pins that. A normalised check here would have
 * refused to save a type holding both, with a message ("change one of the
 * labels") that cannot be acted on, because no input on this screen can change
 * either key. The type would have been permanently unsaveable from Reference
 * Data. Normalisation belongs in `keysForRows`, where it stops a NEW key
 * colliding with an old one, and nowhere else.
 */
export type EditorRowProblem =
  // `index` on every variant: a twenty-field type scrolls, and a message that
  // says a label is missing without saying WHICH row is a message the
  // administrator has to search for. The screen scrolls that row into view.
  | { code: "labelRequired"; index: number }
  | { code: "groupNameRequired"; index: number }
  | { code: "duplicateKey"; index: number; key: string };

export function validateEditorRows(
  rows: readonly TemplateEditorRow[],
  keys: readonly string[],
): EditorRowProblem | null {
  for (const [i, row] of rows.entries()) {
    if (!row.labelRo.trim() && !row.labelEn.trim()) return { code: "labelRequired", index: i };
    // A label of only punctuation slugs to the fallback key, so this fires only
    // where the label vanished entirely — but a field with no usable key is one
    // `mergeAcceptedFields` drops on the floor, and a save that silently loses
    // a row the administrator just typed is the worst outcome on this screen.
    if (!keys[i]) return { code: "labelRequired", index: i };
    if (row.groupChoice === GROUP_CUSTOM && !row.groupCustom.trim()) {
      return { code: "groupNameRequired", index: i };
    }
  }

  const seen = new Set<string>();
  for (const [i, key] of keys.entries()) {
    if (seen.has(key)) return { code: "duplicateKey", index: i, key };
    seen.add(key);
  }
  return null;
}

/** One row, as the field that will be stored. `order` is array position. */
export function fieldFromEditorRow(
  row: TemplateEditorRow,
  key: string,
  order: number,
): DocumentTemplateField {
  const known = templateFieldGroupById(row.groupChoice);
  const custom = row.groupChoice === GROUP_CUSTOM ? row.groupCustom.trim() : "";
  // An untouched free-text group keeps BOTH stored spellings; an edited one
  // becomes the typed text in both, because there is one input and claiming a
  // translation nobody supplied would be a lie the document form then renders.
  const stored = row.groupChoice === GROUP_CUSTOM ? row.storedGroup : null;
  const untouched = stored !== null && custom === (stored.ro || stored.en || "");

  const group: { ro: string | null; en: string | null } = known
    ? { ro: known.ro, en: known.en }
    : untouched && stored
      ? { ro: stored.ro, en: stored.en }
      : { ro: custom || null, en: custom || null };

  return {
    key,
    labelRo: row.labelRo.trim() || row.labelEn.trim(),
    labelEn: row.labelEn.trim() || row.labelRo.trim(),
    type: row.type,
    // Renumbered again on the server from array position; sent so the payload
    // is valid on its own terms rather than relying on a default.
    order,
    aiHint: row.aiHint.trim() || null,
    groupRo: group.ro,
    groupEn: group.en,
  };
}

/** The whole payload, in row order. */
export function fieldsFromEditorRows(
  rows: readonly TemplateEditorRow[],
  keys: readonly string[],
): DocumentTemplateField[] {
  return rows.map((row, i) => fieldFromEditorRow(row, keys[i], i));
}

/**
 * Has anything the administrator can change actually changed?
 *
 * Drives the discard confirmation on Escape and Cancel. `rowId` is included: it
 * is stable per row, so comparing the id sequence catches a reorder that
 * happens to leave every other value identical (two rows with the same label,
 * swapped), which comparing the contents alone would call clean.
 */
export function editorRowsEqual(
  a: readonly TemplateEditorRow[],
  b: readonly TemplateEditorRow[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i];
    return (
      row.rowId === other.rowId &&
      row.key === other.key &&
      row.labelRo === other.labelRo &&
      row.labelEn === other.labelEn &&
      row.type === other.type &&
      row.aiHint === other.aiHint &&
      row.groupChoice === other.groupChoice &&
      row.groupCustom === other.groupCustom
    );
  });
}

/**
 * Are two key lists the same, in the same order?
 *
 * The client-side half of the concurrency check #26.11's route answers with a
 * 409. Ordered, not set-compared, for the reason that route gives: order is
 * what the form renders and what the extraction prompt lists, so a reordering
 * elsewhere is a change the administrator in front of this dialog did not see
 * either.
 */
export function sameKeyList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}
