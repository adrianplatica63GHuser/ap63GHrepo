/**
 * The row logic behind Reference Data → Document Types → Formular.
 *                                                            (Slice #27.03)
 *
 * ⚠️ **This file exists because a review round found the previous version of
 * the slice had no way to test any of this.** `keyForRow` and its friends were
 * module-private inside the editor `.tsx`, so the one decision on that screen
 * that can lose real data — which `custom_fields` key a row is stored under —
 * was asserted nowhere, and the test file NAMED for the editor was testing the
 * Zod schema instead. Deleting the uniqueness pass would have left the suite
 * green while two new fields sharing a label shadowed each other.
 *
 * Every case below is a bug that round found, or the rule it violated.
 */

import type { DocumentTemplateField } from "@/lib/documents/template-fields";
import {
  GROUP_CUSTOM,
  GROUP_NONE,
  blankEditorRow,
  editorRowsEqual,
  fieldsFromEditorRows,
  keysForRows,
  rowFromStoredField,
  sameKeyList,
  validateEditorRows,
  type ReclaimableKey,
  type TemplateEditorRow,
} from "@/lib/documents/template-editor-rows";

function stored(over: Partial<DocumentTemplateField> = {}): DocumentTemplateField {
  return {
    key: "pretTotal",
    labelRo: "Preț total",
    labelEn: "Total price",
    type: "text",
    order: 0,
    aiHint: null,
    groupRo: null,
    groupEn: null,
    ...over,
  };
}

/** A new (unsaved) row with a label. */
function fresh(rowId: string, labelRo: string, over: Partial<TemplateEditorRow> = {}) {
  return { ...blankEditorRow(rowId), labelRo, ...over };
}

/** A field removed in this session, as `keysForRows` is handed it. */
function removed(key: string, labelRo: string, labelEn = ""): ReclaimableKey {
  return { key, labelRo, labelEn };
}

describe("a stored key is permanent", () => {
  it("comes back byte-for-byte after the label is renamed", () => {
    const row = rowFromStoredField(stored({ key: "pretTotal" }), 0);
    const renamed = { ...row, labelRo: "Valoare contract", labelEn: "Contract value" };
    // `pretTotal` would slug to `prettotal`. It must not.
    expect(keysForRows([renamed])).toEqual(["pretTotal"]);
  });

  it("is never displaced by a new row that would derive the same key", () => {
    const existing = rowFromStoredField(stored({ key: "pret_total" }), 0);
    // The new row is FIRST in the list — a per-row derivation would have let it
    // take `pret_total` and pushed the stored row's key out from under its data.
    const keys = keysForRows([fresh("new-0", "Preț total"), existing]);
    expect(keys[1]).toBe("pret_total");
    expect(keys[0]).not.toBe("pret_total");
  });
});

describe("keys are derived in one left-to-right pass", () => {
  // The bug: each row built `taken` from the OTHER rows, so both saw `pret`
  // occupied and both derived `pret_2` — nobody got `pret`, and the save failed
  // naming a key neither row was entitled to.
  it("gives two new rows with the same label distinct keys, first one plain", () => {
    const keys = keysForRows([fresh("new-0", "Preț"), fresh("new-1", "Preț")]);
    expect(keys).toEqual(["pret", "pret_2"]);
  });

  it("keeps going for a third", () => {
    const keys = keysForRows([
      fresh("new-0", "Preț"),
      fresh("new-1", "Preț"),
      fresh("new-2", "Preț"),
    ]);
    expect(new Set(keys).size).toBe(3);
    expect(keys[0]).toBe("pret");
  });

  // The second symptom: `slugifyFieldKey("")` returns the module's fallback
  // key, so a blank row RESERVED it — a row labelled "Camp" previewed as
  // `camp_2` and silently flipped to `camp` the moment the blank row was typed
  // into, which is a live preview changing for a reason nobody can see.
  it("reserves nothing for a row with no label", () => {
    expect(keysForRows([blankEditorRow("new-0"), fresh("new-1", "Camp")]))
      .toEqual(["", "camp"]);
  });

  it("falls back to the English label when the Romanian one is empty", () => {
    expect(keysForRows([fresh("new-0", "", { labelEn: "Total price" })]))
      .toEqual(["total_price"]);
  });

  it("recognises a stored camelCase key and a new snake_case one as the same field", () => {
    const existing = rowFromStoredField(stored({ key: "pretTotal" }), 0);
    const keys = keysForRows([existing, fresh("new-0", "Preț total")]);
    expect(keys[0]).toBe("pretTotal");
    // Not `pret_total` beside it: two fields that normalise alike cannot both
    // be filled usefully, and the server would collapse them anyway.
    expect(keys[1]).toBe("pret_total_2");
  });
});

describe("a key removed in this session can be reclaimed", () => {
  /**
   * This is what makes `confirmRemoveBody` true rather than aspirational. The
   * confirmation promises the captured values reappear if the field is put
   * back — and for the codebase's own camelCase convention it could not: a
   * removed `pretTotal` re-added from the label "Preț total" mints
   * `pret_total`, and the values sit in `custom_fields` unreachable from every
   * screen. A screen must not offer an undo it cannot perform.
   */
  it("hands a removed camelCase key back to a row added from the same label", () => {
    expect(keysForRows([fresh("new-0", "Preț total")], [removed("pretTotal", "Preț total")]))
      .toEqual(["pretTotal"]);
  });

  /**
   * ⚠️ **The label route, and it is not a nicety.** Rule 1 is that a label may
   * be renamed while the key stays — so by the time anyone removes a field it
   * may be keyed `pretTotal` and called "Valoare totală". Matching only on the
   * key then fails on exactly the fields the editor most encourages renaming:
   * the administrator types back the label he was just looking at and gets a
   * brand-new key, with the captured values stranded under the old one. Round
   * two of the review found the confirmation promising an undo that this
   * function could not perform.
   */
  it("hands it back for the label the removed field was WEARING, not only its key", () => {
    expect(keysForRows([fresh("new-0", "Valoare totală")], [removed("pretTotal", "Valoare totală")]))
      .toEqual(["pretTotal"]);
  });

  it("matches the English label too", () => {
    expect(
      keysForRows(
        [fresh("new-0", "", { labelEn: "Total value" })],
        [removed("numarCF", "Valoare totală", "Total value")],
      ),
    ).toEqual(["numarCF"]);
  });

  it("does not hand it to a row that means something else", () => {
    expect(keysForRows([fresh("new-0", "Data plății")], [removed("pretTotal", "Preț total")]))
      .toEqual(["data_platii"]);
  });

  it("will not reclaim a key another row still holds", () => {
    const existing = rowFromStoredField(stored({ key: "pretTotal" }), 0);
    // "pretTotal" is offered back but is still on the type — the new row must
    // get its own key rather than a duplicate.
    const keys = keysForRows(
      [existing, fresh("new-0", "Preț total")],
      [removed("pretTotal", "Preț total")],
    );
    expect(keys).toEqual(["pretTotal", "pret_total_2"]);
  });

  // ⚠️ **Enforced by `taken`, not by a set of its own.** A claim adds the key
  // to `taken`, and the predicate's first test after the empty-key guard is
  // whether `taken` already holds it — so the second row finds it occupied and
  // derives its own. Round three found a separate `claimed` set here that could
  // not decide a single case `taken` had not already decided: deleting it
  // changed no output anywhere, which made the test that named it green
  // without it. It is gone, and this comment is what remains of it.
  it("gives one reclaimable key to one row, not to both", () => {
    const keys = keysForRows(
      [fresh("new-0", "Preț total"), fresh("new-1", "Preț total")],
      [removed("pretTotal", "Preț total")],
    );
    expect(keys[0]).toBe("pretTotal");
    expect(keys[1]).not.toBe("pretTotal");
    expect(new Set(keys).size).toBe(2);
  });

  /**
   * ⚠️ **An empty key is not a key, and the label route did not check.**
   * `normaliseKeyForComparison("")` is `""`, which `taken` never holds, so a
   * row whose label matched "reclaimed" the empty string — and
   * `validateEditorRows` then reported "every field needs a label" about a row
   * that plainly had one, with no way out but renaming it. Nothing in the
   * dialog can build that today, which is precisely why the guarantee has to
   * live in the function: this module is exported and tested on its own terms,
   * and its docblock promises `""` only for a row with no usable label.
   */
  it("never hands back an empty key, and does not let one shadow a real one", () => {
    expect(keysForRows([fresh("new-0", "Preț")], [removed("", "Preț")]))
      .toEqual(["pret"]);
    expect(keysForRows([fresh("new-0", "Preț")], [removed("", "Preț"), removed("pretX", "Preț")]))
      .toEqual(["pretX"]);
  });

  it("reclaims two different removed fields independently", () => {
    const keys = keysForRows(
      [fresh("new-0", "Data plății"), fresh("new-1", "Preț total")],
      [removed("pretTotal", "Preț total"), removed("dataPlata", "Data plății")],
    );
    expect(keys).toEqual(["dataPlata", "pretTotal"]);
  });
});

describe("what counts as a problem", () => {
  it("refuses a row with no label in either locale", () => {
    const rows = [blankEditorRow("new-0")];
    expect(validateEditorRows(rows, keysForRows(rows)))
      .toEqual({ code: "labelRequired", index: 0 });
  });

  it("refuses “another panel” with no name", () => {
    const rows = [fresh("new-0", "Preț", { groupChoice: GROUP_CUSTOM, groupCustom: "  " })];
    expect(validateEditorRows(rows, keysForRows(rows)))
      .toEqual({ code: "groupNameRequired", index: 0 });
  });

  /**
   * ⚠️ **Duplicates are EXACT, and a normalised check here was a real lock-out.**
   * `mergeAcceptedFields`' existing-row arm dedupes on the exact key and
   * deliberately keeps `pretTotal` and `pret_total` side by side —
   * `discover-to-template.test.ts` pins that, so a type holding both is a state
   * this codebase supports. A normalised check refused to save such a type with
   * "change one of the labels", which cannot be done: no input on that screen
   * can change either key. The type became permanently unsaveable.
   */
  it("accepts two stored keys that merely normalise alike", () => {
    const rows = [
      rowFromStoredField(stored({ key: "pretTotal" }), 0),
      rowFromStoredField(stored({ key: "pret_total" }), 1),
    ];
    expect(validateEditorRows(rows, keysForRows(rows))).toBeNull();
  });

  it("still catches two rows that really would share one custom_fields key", () => {
    const rows = [
      rowFromStoredField(stored({ key: "pretTotal" }), 0),
      rowFromStoredField(stored({ key: "pretTotal" }), 1),
    ];
    expect(validateEditorRows(rows, keysForRows(rows)))
      .toEqual({ code: "duplicateKey", index: 1, key: "pretTotal" });
  });

  // The index is what the screen scrolls to. A problem reported without one is
  // a message the administrator has to hunt for down a twenty-row table.
  it("points at the row that is actually wrong, not at the first", () => {
    const rows = [
      rowFromStoredField(stored({ key: "a" }), 0),
      rowFromStoredField(stored({ key: "b" }), 1),
      { ...blankEditorRow("new-0"), groupChoice: GROUP_CUSTOM },
    ];
    expect(validateEditorRows(rows, keysForRows(rows)))
      .toEqual({ code: "labelRequired", index: 2 });
  });

  it("passes a well-formed list", () => {
    const rows = [
      rowFromStoredField(stored({ key: "pretTotal" }), 0),
      fresh("new-0", "Data plății"),
    ];
    expect(validateEditorRows(rows, keysForRows(rows))).toBeNull();
  });
});

describe("what gets written", () => {
  it("puts a known group's exact pair on the field, both locales", () => {
    const rows = [fresh("new-0", "Preț", { groupChoice: "financial" })];
    const [field] = fieldsFromEditorRows(rows, keysForRows(rows));
    expect([field.groupRo, field.groupEn]).toEqual(["Financiar", "Financial"]);
  });

  /**
   * ⚠️ **An untouched free-text group keeps BOTH stored spellings.** A field
   * can arrive with `groupRo: "Suprafețe"` and `groupEn: "Areas"`; the editor
   * shows one input. Collapsing both to that input's text on every save renamed
   * the English panel to the Romanian word because an administrator fixed an
   * unrelated row's AI hint.
   */
  it("re-emits an untouched free-text group's two spellings unchanged", () => {
    const rows = [rowFromStoredField(stored({ groupRo: "Suprafețe", groupEn: "Areas" }), 0)];
    const [field] = fieldsFromEditorRows(rows, keysForRows(rows));
    expect([field.groupRo, field.groupEn]).toEqual(["Suprafețe", "Areas"]);
  });

  it("writes an EDITED free-text group to both locales", () => {
    const base = rowFromStoredField(stored({ groupRo: "Suprafețe", groupEn: "Areas" }), 0);
    const rows = [{ ...base, groupCustom: "Suprafețe și vecinătăți" }];
    const [field] = fieldsFromEditorRows(rows, keysForRows(rows));
    expect([field.groupRo, field.groupEn])
      .toEqual(["Suprafețe și vecinătăți", "Suprafețe și vecinătăți"]);
  });

  it("clears the group when the row is set back to no panel", () => {
    const base = rowFromStoredField(stored({ groupRo: "Financiar", groupEn: "Financial" }), 0);
    const rows = [{ ...base, groupChoice: GROUP_NONE }];
    const [field] = fieldsFromEditorRows(rows, keysForRows(rows));
    expect([field.groupRo, field.groupEn]).toEqual([null, null]);
  });

  it("reads a stored known group back as that group, not as free text", () => {
    const row = rowFromStoredField(stored({ groupRo: "Financiar", groupEn: "Financial" }), 0);
    expect(row.groupChoice).toBe("financial");
    expect(row.storedGroup).toBeNull();
  });

  it("reads a stored unknown group back as free text, not remapped", () => {
    const row = rowFromStoredField(stored({ groupRo: "Taxe si onorarii", groupEn: null }), 0);
    // One diacritic off the special group. It must stay exactly what it was —
    // silently promoting it would change the document form's layout.
    expect(row.groupChoice).toBe(GROUP_CUSTOM);
    expect(row.groupCustom).toBe("Taxe si onorarii");
  });

  it("numbers order by array position and falls a blank label back to the other locale", () => {
    const rows = [
      fresh("new-0", "", { labelEn: "Total price" }),
      rowFromStoredField(stored({ key: "dataPlata", labelRo: "Data plății", labelEn: "" }), 0),
    ];
    const fields = fieldsFromEditorRows(rows, keysForRows(rows));
    expect(fields.map((f) => f.order)).toEqual([0, 1]);
    expect(fields[0].labelRo).toBe("Total price");
    expect(fields[1].labelEn).toBe("Data plății");
  });

  it("trims an AI hint away to null rather than storing an empty string", () => {
    const rows = [fresh("new-0", "Preț", { aiHint: "   " })];
    expect(fieldsFromEditorRows(rows, keysForRows(rows))[0].aiHint).toBeNull();
  });
});

describe("the dirty check and the concurrency check", () => {
  it("calls an untouched list clean", () => {
    const rows = [rowFromStoredField(stored(), 0)];
    expect(editorRowsEqual(rows, [rowFromStoredField(stored(), 0)])).toBe(true);
  });

  it("sees a renamed label", () => {
    const rows = [rowFromStoredField(stored(), 0)];
    expect(editorRowsEqual(rows, [{ ...rows[0], labelRo: "Altceva" }])).toBe(false);
  });

  // A reorder of two rows carrying identical values is still a change: `order`
  // is what the form renders and what the extraction prompt lists.
  it("sees a reorder that changes no value", () => {
    const a = rowFromStoredField(stored({ key: "a" }), 0);
    const b = rowFromStoredField(stored({ key: "b" }), 1);
    expect(editorRowsEqual([a, b], [b, a])).toBe(false);
  });

  it("sees an added and a removed row", () => {
    const a = rowFromStoredField(stored(), 0);
    expect(editorRowsEqual([a], [a, blankEditorRow("new-0")])).toBe(false);
    expect(editorRowsEqual([a], [])).toBe(false);
  });

  // Ordered, not set-compared — the same rule #26.11's 409 states: a reordering
  // elsewhere is a change the administrator in front of the dialog did not see.
  it("treats a reordered key list as a different one", () => {
    expect(sameKeyList(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameKeyList(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameKeyList(["a"], ["a", "b"])).toBe(false);
  });
});
