/**
 * The `select` field type, end to end through the pure parts. (Slice #36.01)
 *
 * WHY A NEW FIELD TYPE AND NOT A NEW VALUE SHAPE
 * ----------------------------------------------
 * „Starea juridică afirmată" is twenty-odd clauses whose value is one of a
 * tiny set — afirmat / nu e menționat / excepție. Storing that as anything but
 * a string would have reached `document.custom_fields`
 * (`Record<string, string | null>`), `customFieldsEqual` and `DocumentSnapshot`,
 * three things #26.11 and #18.06 spent slices getting right. So the VALUE stays
 * a string and only the INPUT changes, and the assertions below are mostly
 * about that boundary holding.
 *
 * ⚠️ **THE ONE THAT MATTERS IS THE UNKNOWN STORED VALUE.** An option list is
 * editable. A `<select>` whose value matches no `<option>` renders the FIRST
 * one, so a document captured under an option somebody later removed would
 * display an answer it does not hold, with nothing on screen saying so — the
 * form contradicting the deed. `selectOptionsForValue` is the one decision on
 * this path that can misrepresent stored data, which is why it is a pure
 * function in `template-fields.ts` rather than three lines inside the form's
 * JSX.
 */

import {
  parseTemplateFields,
  selectOptionsForValue,
  templateFieldFormatHint,
  type DocumentTemplateField,
} from "@/lib/documents/template-fields";
import {
  inferFieldType,
  sanitizeFieldOptions,
  sanitizeTemplateField,
} from "@/lib/documents/discover-to-template";
import {
  blankEditorRow,
  fieldFromEditorRow,
  formatOptionsText,
  parseOptionsText,
  rowFromStoredField,
} from "@/lib/documents/template-editor-rows";
import { buildExtractSystemPrompt } from "@/lib/import/classify-prompts";

const CLAUZA = [
  { value: "AFIRMAT", labelRo: "Afirmat", labelEn: "Asserted" },
  { value: "NEMENTIONAT", labelRo: "Nu e menționat", labelEn: "Not stated" },
  { value: "EXCEPTIE", labelRo: "Excepție", labelEn: "Exception" },
];

const clause: DocumentTemplateField = {
  key: "inCircuitCivil",
  labelRo: "În circuitul civil",
  labelEn: "In the civil circuit",
  type: "select",
  order: 0,
  aiHint: null,
  groupRo: "Stare juridică afirmată",
  groupEn: "Asserted legal situation",
  tabRo: "Stare juridică",
  tabEn: "Legal status",
  options: CLAUZA,
};

describe("a stored value that is no longer an option", () => {
  it("is still displayed, as itself", () => {
    const shown = selectOptionsForValue(CLAUZA.slice(0, 2), "EXCEPTIE");
    expect(shown.map((o) => o.value)).toEqual(["AFIRMAT", "NEMENTIONAT", "EXCEPTIE"]);
    // Labelled with the raw value: there is no caption for it, and inventing
    // one would hide that this answer is off the list.
    expect(shown[2]).toEqual({ value: "EXCEPTIE", label: "EXCEPTIE" });
  });

  it("is not appended twice when it IS an option", () => {
    expect(selectOptionsForValue(CLAUZA, "AFIRMAT")).toHaveLength(3);
  });

  it("appends nothing for an unset field", () => {
    for (const unset of ["", "   ", null, undefined]) {
      expect(selectOptionsForValue(CLAUZA, unset)).toHaveLength(3);
    }
  });

  it("shows the Romanian caption, falling back to the English one and then to the value", () => {
    const shown = selectOptionsForValue(
      [
        { value: "A", labelRo: "Afirmat", labelEn: "Asserted" },
        { value: "B", labelRo: "", labelEn: "Asserted" },
        { value: "C", labelRo: "", labelEn: "" },
      ],
      null,
    );
    expect(shown.map((o) => o.label)).toEqual(["Afirmat", "Asserted", "C"]);
  });

  it("renders a select with no options at all as an empty list rather than throwing", () => {
    expect(selectOptionsForValue(null, null)).toEqual([]);
    expect(selectOptionsForValue(undefined, "X")).toEqual([{ value: "X", label: "X" }]);
  });
});

describe("parsing never throws on an odd row", () => {
  it("keeps a select and its options", () => {
    const [f] = parseTemplateFields([{ ...clause }]);
    expect(f.type).toBe("select");
    expect(f.options).toHaveLength(3);
  });

  it("drops options with no value, and duplicates", () => {
    const [f] = parseTemplateFields([
      { ...clause, options: [{ value: "A" }, { value: "" }, { value: "A", labelRo: "again" }, 7, null] },
    ]);
    expect(f.options).toEqual([{ value: "A", labelRo: "A", labelEn: "A" }]);
  });

  it("stores null rather than an empty array when nothing usable is left", () => {
    const [f] = parseTemplateFields([{ ...clause, options: [{ value: "" }] }]);
    expect(f.options).toBeNull();
  });

  it("falls back to text for a type it does not know, as it always has", () => {
    const [f] = parseTemplateFields([{ ...clause, type: "radio" }]);
    expect(f.type).toBe("text");
  });
});

describe("the editor round-trips a select without rewriting it", () => {
  it("reads a stored list into the box and writes the same list back", () => {
    const row = rowFromStoredField(clause, 0);
    expect(parseOptionsText(row.optionsText)).toEqual(CLAUZA);
    expect(fieldFromEditorRow(row, clause.key, 0).options).toEqual(CLAUZA);
  });

  it("prints the short form for an option whose labels are its own value", () => {
    expect(formatOptionsText([{ value: "DA", labelRo: "DA", labelEn: "DA" }])).toBe("DA");
    expect(formatOptionsText([{ value: "DA", labelRo: "Da", labelEn: "Da" }])).toBe("DA | Da");
    expect(formatOptionsText([{ value: "DA", labelRo: "Da", labelEn: "Yes" }])).toBe("DA | Da | Yes");
    expect(formatOptionsText(null)).toBe("");
  });

  it("treats a half-typed line as a value that is its own caption", () => {
    // Called on every keystroke. A line with one part is not an error.
    expect(parseOptionsText("AFIRMAT")).toEqual([
      { value: "AFIRMAT", labelRo: "AFIRMAT", labelEn: "AFIRMAT" },
    ]);
    expect(parseOptionsText("AFIRMAT | Afirmat")).toEqual([
      { value: "AFIRMAT", labelRo: "Afirmat", labelEn: "Afirmat" },
    ]);
  });

  it("skips blank lines and keeps the first spelling of a repeated value", () => {
    expect(parseOptionsText("\n A | Unu \n\n A | Doi \n")).toEqual([
      { value: "A", labelRo: "Unu", labelEn: "Unu" },
    ]);
  });

  it("stores no options for a field that is not a select, and keeps the typed text on the row", () => {
    const row = { ...rowFromStoredField(clause, 0), type: "text" as const };
    expect(fieldFromEditorRow(row, clause.key, 0).options).toBeNull();
    // The text is still there, so switching back restores the list.
    expect(row.optionsText).not.toBe("");
    expect(fieldFromEditorRow({ ...row, type: "select" }, clause.key, 0).options).toEqual(CLAUZA);
  });

  it("starts a new row with no options and no tab", () => {
    const row = blankEditorRow("r1");
    expect(row.optionsText).toBe("");
    expect(row.tabName).toBe("");
    const f = fieldFromEditorRow({ ...row, labelRo: "Preț" }, "pret", 0);
    expect(f.options).toBeNull();
    expect(f.tabRo).toBeNull();
    expect(f.tabEn).toBeNull();
  });

  it("keeps both stored tab spellings when the one input was not edited", () => {
    // The `storedGroup` hazard, for tabs: one input over two columns, so an
    // untouched row must re-emit the pair it arrived with rather than
    // collapsing the English tab onto the Romanian text.
    const row = rowFromStoredField(clause, 0);
    expect(fieldFromEditorRow(row, clause.key, 0)).toMatchObject({
      tabRo: "Stare juridică",
      tabEn: "Legal status",
    });
    const edited = { ...row, tabName: "Clauze" };
    expect(fieldFromEditorRow(edited, clause.key, 0)).toMatchObject({
      tabRo: "Clauze",
      tabEn: "Clauze",
    });
  });
});

describe("the save choke point carries the new keys instead of deleting them", () => {
  it("keeps the tab and the options through sanitizeTemplateField", () => {
    // ⚠️ It builds a NEW object rather than spreading, so a property it does
    // not name is silently dropped — a tab authored in the editor would
    // survive exactly until the next unrelated label edit.
    const clean = sanitizeTemplateField(clause);
    expect(clean.tabRo).toBe("Stare juridică");
    expect(clean.tabEn).toBe("Legal status");
    expect(clean.options).toEqual(CLAUZA);
  });

  it("collapses whitespace in a tab name, as it does in a label", () => {
    const clean = sanitizeTemplateField({ ...clause, tabRo: "  Stare\n juridică  ", tabEn: "" });
    expect(clean.tabRo).toBe("Stare juridică");
    expect(clean.tabEn).toBeNull();
  });

  it("drops an option with an empty value and keeps the first of two alike", () => {
    expect(sanitizeFieldOptions([
      { value: " A ", labelRo: " Unu ", labelEn: "" },
      { value: "", labelRo: "x", labelEn: "x" },
      { value: "A", labelRo: "Doi", labelEn: "Two" },
    ])).toEqual([{ value: "A", labelRo: "Unu", labelEn: "Unu" }]);
    expect(sanitizeFieldOptions(null)).toBeNull();
    expect(sanitizeFieldOptions([])).toBeNull();
  });
});

describe("what the model is told", () => {
  it("lists a select's allowed VALUES on the field's one prompt line", () => {
    const prompt = buildExtractSystemPrompt([clause]);
    const line = prompt.split("\n").find((l) => l.includes(`"${clause.key}"`));
    expect(line).toBeDefined();
    expect(line).toContain('exactly one of: "AFIRMAT" | "NEMENTIONAT" | "EXCEPTIE", or null');
    // Values and not captions: the value is what lands in `custom_fields`.
    expect(line).not.toContain("Nu e menționat");
    expect(line).toContain(clause.labelRo);
  });

  it("says a closed list is closed", () => {
    expect(buildExtractSystemPrompt([clause])).toContain("closed list");
  });

  it("asks for the cotă-parte once a type has party roles", () => {
    const prompt = buildExtractSystemPrompt([], ["Vânzător", "Cumpărător"]);
    expect(prompt).toContain('"cotaParte"');
    expect(prompt).toContain("DEVALMASIE");
    // A type with no roles configured is asked for no parties and therefore no
    // shares — the app's "admin-managed roles, never auto-guessed" convention.
    expect(buildExtractSystemPrompt([])).not.toContain("cotaParte");
  });

  it("says nothing about allowed values for a select that has none", () => {
    const line = buildExtractSystemPrompt([{ ...clause, options: null }])
      .split("\n")
      .find((l) => l.includes(`"${clause.key}"`));
    expect(line).not.toContain("exactly one of");
    expect(line).toContain(templateFieldFormatHint("select"));
  });
});

describe("discovery proposes no option lists", () => {
  it("never infers select from one document's value", () => {
    // An option list is the small closed set a clause can be in, decided by
    // reading the corpus. One sample is evidence of exactly one member of it.
    for (const v of ["Afirmat", "Da", "5000", "2006-10-10", "NEMENTIONAT"]) {
      expect(inferFieldType(v)).not.toBe("select");
    }
  });
});
