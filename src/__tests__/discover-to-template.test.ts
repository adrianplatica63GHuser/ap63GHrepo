/**
 * Discovery → a document type's custom form.   (Slice #26.11)
 *
 * The module under test is the whole of this slice's judgement: everything
 * else is plumbing that already existed. Four things are worth pinning.
 *
 * 1. **A STORED KEY IS PERMANENT.** `.claude/skills/onboard-document-type/`
 *    documents `key` as camelCase and "permanent once real data exists under
 *    it — renaming means a migration to move data". This module invents
 *    snake_case slugs, so both conventions coexist on one type: an existing
 *    key must come out byte-for-byte, and `pretTotal` must be recognised as
 *    the same field as a discovered `pret_total` rather than added beside it.
 *    Get either half wrong and every value already captured under that key is
 *    still in `document.custom_fields` and unreachable from the form.
 *
 * 2. **Keys must be stable and ASCII.** "Preț" and "Preţ" — the comma-below
 *    and cedilla forms, mixed freely across Romanian scans and fonts — must
 *    not become two fields.
 *
 * 3. **Nothing may carry a newline into the prompt.** buildExtractSystemPrompt
 *    renders each template field as ONE `//` comment line inside the JSON
 *    shape it shows the model. A label or hint with a line break in it splits
 *    that line and corrupts the shape. The prompt describe below asserts that
 *    against the real prompt builder rather than against a rule restated here.
 *
 * 4. **Accepting a discovery is additive.** A type that already has a curated
 *    form must gain fields and lose none — that is what makes the button safe
 *    to press on a type that already works.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  buildFieldHint,
  collapseWhitespace,
  formValueForField,
  inferFieldType,
  MAX_TEMPLATE_FIELDS,
  mergeAcceptedFields,
  normaliseKeyForComparison,
  proposeTemplateFields,
  sanitizeTemplateField,
  slugifyFieldKey,
  uniqueFieldKey,
} from "@/lib/documents/discover-to-template";
import { parseTemplateFields, type DocumentTemplateField } from "@/lib/documents/template-fields";
import { buildExtractSystemPrompt } from "@/lib/import/classify-prompts";
import type { DiscoverPair } from "@/lib/documents/discover-log";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pair(
  name: string,
  value: string,
  confidence: DiscoverPair["confidence"] = "high",
): DiscoverPair {
  return { name, value, confidence };
}

function field(over: Partial<DocumentTemplateField> = {}): DocumentTemplateField {
  return {
    key:     "camp",
    labelRo: "Câmp",
    labelEn: "Field",
    type:    "text",
    order:   0,
    aiHint:  null,
    groupRo: null,
    groupEn: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// slugifyFieldKey
// ---------------------------------------------------------------------------

describe("slugifyFieldKey", () => {
  it("folds Romanian diacritics to ASCII", () => {
    expect(slugifyFieldKey("Preț total")).toBe("pret_total");
    expect(slugifyFieldKey("Suprafață măsurată")).toBe("suprafata_masurata");
    expect(slugifyFieldKey("Încheiere de autentificare")).toBe("incheiere_de_autentificare");
  });

  it("treats the comma-below and cedilla forms as the same letter", () => {
    expect(slugifyFieldKey("Preţ")).toBe(slugifyFieldKey("Preț"));
    expect(slugifyFieldKey("Adresă imobil şi vecinătăţi")).toBe(
      slugifyFieldKey("Adresă imobil și vecinătăți"),
    );
  });

  it("collapses punctuation and trims separators", () => {
    expect(slugifyFieldKey("Nr. / dată document:")).toBe("nr_data_document");
    expect(slugifyFieldKey("   spaced   out   ")).toBe("spaced_out");
    expect(slugifyFieldKey("(C.F.)")).toBe("c_f");
  });

  it("never returns an empty key", () => {
    expect(slugifyFieldKey("")).toBe("camp");
    expect(slugifyFieldKey("§ — ///")).toBe("camp");
    expect(slugifyFieldKey("...")).toBe("camp");
  });

  it("clips a long label without leaving a trailing separator", () => {
    const key = slugifyFieldKey(
      "Denumirea completă a imobilului situat în intravilanul localității conform actelor",
    );
    expect(key.length).toBeLessThanOrEqual(40);
    expect(key.endsWith("_")).toBe(false);
    expect(key).toMatch(/^[a-z0-9_]+$/);
  });

  it("emits only characters that are safe in a JSON key and a form field name", () => {
    for (const label of ["Preț (RON)", "50%", "Ștampilă & semnătură", "A\nB"]) {
      expect(slugifyFieldKey(label)).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// normaliseKeyForComparison
// ---------------------------------------------------------------------------

describe("normaliseKeyForComparison", () => {
  it("makes the project's camelCase convention and this module's slug meet", () => {
    expect(normaliseKeyForComparison("pretTotal")).toBe(normaliseKeyForComparison("pret_total"));
    expect(normaliseKeyForComparison("nrCadastral")).toBe(normaliseKeyForComparison("nr_cadastral"));
  });

  it("does not collapse genuinely different keys", () => {
    expect(normaliseKeyForComparison("pretTotal")).not.toBe(normaliseKeyForComparison("pretPartial"));
  });
});

// ---------------------------------------------------------------------------
// uniqueFieldKey
// ---------------------------------------------------------------------------

describe("uniqueFieldKey", () => {
  it("returns the key untouched when it is free, and records it", () => {
    const taken = new Set<string>();
    expect(uniqueFieldKey("pret", taken)).toBe("pret");
    expect(taken.has("pret")).toBe(true);
  });

  it("suffixes collisions in order", () => {
    const taken = new Set(["pret"]);
    expect(uniqueFieldKey("pret", taken)).toBe("pret_2");
    expect(uniqueFieldKey("pret", taken)).toBe("pret_3");
  });

  it("collides across naming conventions, not just across identical strings", () => {
    // The stored key is camelCase; the proposal is a slug. Handing back
    // `pret_total` would put a second field beside `pretTotal` for one thing.
    const taken = new Set([normaliseKeyForComparison("pretTotal")]);
    expect(uniqueFieldKey("pret_total", taken)).toBe("pret_total_2");
  });

  it("shortens the base so a suffixed key still fits the limit", () => {
    const long = "a".repeat(40);
    const taken = new Set([long]);
    const next = uniqueFieldKey(long, taken);
    expect(next.length).toBeLessThanOrEqual(40);
    expect(next).not.toBe(long);
    expect(next.endsWith("_2")).toBe(true);
  });

  it("never hands out a key that is already taken", () => {
    const taken = new Set<string>();
    const issued = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const k = uniqueFieldKey("pret", taken);
      expect(issued.has(k)).toBe(false);
      issued.add(k);
    }
  });
});

// ---------------------------------------------------------------------------
// inferFieldType
// ---------------------------------------------------------------------------

describe("inferFieldType", () => {
  it("recognises ISO and Romanian dates", () => {
    expect(inferFieldType("2024-03-17")).toBe("date");
    expect(inferFieldType("17.03.2024")).toBe("date");
    expect(inferFieldType("17/03/2024")).toBe("date");
    expect(inferFieldType("17-03-2024")).toBe("date");
  });

  it("rejects impossible dates rather than proposing a date input for them", () => {
    expect(inferFieldType("2024-13-45")).toBe("text");
    expect(inferFieldType("47.02.2024")).toBe("text");
    expect(inferFieldType("225.3.24")).toBe("text");
  });

  it("asks the calendar, not just the digit ranges", () => {
    // 31 June and 29 February 2023 sit inside every bound and are not dates.
    // <input type="date"> blanks an impossible date string exactly the way it
    // blanks a Romanian-formatted one, so letting one through would store a
    // value the form can never show.
    expect(inferFieldType("31.06.2023")).toBe("text");
    expect(inferFieldType("30.02.2024")).toBe("text");
    expect(inferFieldType("29.02.2023")).toBe("text");
    // …and a real leap day still is one.
    expect(inferFieldType("29.02.2024")).toBe("date");
  });

  it("proposes number only for a dot-separated fraction", () => {
    expect(inferFieldType("1234.56")).toBe("number");
    expect(inferFieldType("0.5")).toBe("number");
    expect(inferFieldType("-12.25")).toBe("number");
  });

  it("leaves a Romanian comma decimal as text", () => {
    // The model is told to keep Romanian separators, nothing between it and
    // the column converts one, and <input type="number"> renders a comma
    // decimal as EMPTY — so the value would be stored, invisible and
    // un-editable, on every document of the type.
    expect(inferFieldType("1234,56")).toBe("text");
    expect(inferFieldType("-12,25")).toBe("text");
  });

  it("leaves identifiers and grouped/united numbers as text", () => {
    expect(inferFieldType("1800101123456")).toBe("text"); // CNP
    expect(inferFieldType("0123")).toBe("text");
    expect(inferFieldType("2716")).toBe("text");
    expect(inferFieldType("125.000")).toBe("text");       // 125 thousand, in RO
    expect(inferFieldType("1.234")).toBe("text");
    expect(inferFieldType("1.234,56 lei")).toBe("text");
    expect(inferFieldType("47/2")).toBe("text");
  });

  it("proposes textarea for prose and for anything with a line break", () => {
    expect(inferFieldType("linia unu\nlinia doi")).toBe("textarea");
    expect(inferFieldType("x".repeat(200))).toBe("textarea");
    expect(inferFieldType("scurt")).toBe("text");
  });

  it("falls back to text for an empty or blank value", () => {
    expect(inferFieldType("")).toBe("text");
    expect(inferFieldType("   ")).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// buildFieldHint
// ---------------------------------------------------------------------------

describe("buildFieldHint", () => {
  const base = { sampleValue: "", type: "text" } as const;

  it("says nothing when there is nothing to say", () => {
    expect(buildFieldHint(base)).toBeNull();
    expect(buildFieldHint({ ...base, sampleValue: "   " })).toBeNull();
  });

  it("never records the label, however it was printed", () => {
    // Dropped deliberately — see the function's own comment. The case it had
    // to exclude (a caption with a person glued on) cannot be told apart from
    // an ordinary Romanian ALL-CAPS or Title Case caption.
    const hint = buildFieldHint({ ...base, sampleValue: "parter" }) ?? "";
    expect(hint).not.toContain("printed on the document");
  });

  it("gives no example for anything that reads like a person", () => {
    // Masking digits cannot reach the value most worth not copying onto a
    // document type. A seller's name baked into the type's prompt is offered
    // to the model as the answer on every later document where it cannot read
    // that field — the same failure the date/number rule below prevents.
    expect(buildFieldHint({ ...base, sampleValue: "POPESCU ION" })).toBeNull();
    expect(buildFieldHint({ ...base, sampleValue: "Ion Popescu, dom. în Cluj" })).toBeNull();
    // Shapes survive, which is the whole point of having an example.
    expect(buildFieldHint({ ...base, sampleValue: "120 mp" })).toContain("120 mp");
    expect(buildFieldHint({ ...base, sampleValue: "parter" })).toContain("parter");
  });

  it("gives no example for a value long enough to be a quotation", () => {
    expect(buildFieldHint({ ...base, sampleValue: "a ".repeat(40) })).toBeNull();
  });

  it("gives an example for text, and none for date or number", () => {
    // For a date or a number the prompt line already carries an ISO / bare
    // decimal instruction from templateFieldFormatHint. A Romanian-notation
    // example on the same line contradicts it, and a model that follows the
    // example writes a value <input type="date"> then renders as blank.
    expect(buildFieldHint({ ...base, sampleValue: "parter" })).toContain("parter");
    expect(buildFieldHint({ ...base, sampleValue: "17.03.2024", type: "date" })).toBeNull();
    expect(buildFieldHint({ ...base, sampleValue: "1234.56", type: "number" })).toBeNull();
  });

  it("collapses the sample onto one line", () => {
    const hint = buildFieldHint({ ...base, sampleValue: "prima\nlinie" }) ?? "";
    expect(hint).not.toContain("\n");
    expect(hint).toContain("prima linie");
  });

  it("masks digit runs so an identifier is not stored on the type", () => {
    // The hint is sent to the model for EVERY future document of this type; a
    // CNP or cadastral number read out of the one discovered document would
    // otherwise describe a stranger in every prompt from then on.
    const cnp = buildFieldHint({ ...base, sampleValue: "cnp 1800101123456" }) ?? "";
    expect(cnp).not.toContain("1800101123456");
    expect(cnp).toContain("cnp");
  });

  it("drops a sample that masking reduced to noise", () => {
    expect(buildFieldHint({ ...base, sampleValue: "1800101123456" })).toBeNull();
  });

  it("never emits a double quote", () => {
    const hint = buildFieldHint({ ...base, sampleValue: 'a "quoted" b' }) ?? "";
    expect(hint).toContain("quoted");
    expect(hint).not.toContain('"');
  });
});

// ---------------------------------------------------------------------------
// formValueForField
// ---------------------------------------------------------------------------

describe("formValueForField", () => {
  it("converts a Romanian date to the only thing a date input can hold", () => {
    // The discover prompt tells the model to leave "12.04.2021" as printed;
    // <input type="date"> shows anything but ISO as EMPTY while react-hook-form
    // still holds the string — so the user saves a value they cannot see, into
    // a key every later import writes in ISO.
    expect(formValueForField("12.04.2021", "date")).toBe("2021-04-12");
    expect(formValueForField("7/3/2024", "date")).toBe("2024-03-07");
    expect(formValueForField("2024-3-7", "date")).toBe("2024-03-07");
  });

  it("leaves a date field blank rather than storing something it cannot show", () => {
    expect(formValueForField("cândva în primăvară", "date")).toBeNull();
    expect(formValueForField("47.02.2024", "date")).toBeNull();
    expect(formValueForField("31.06.2023", "date")).toBeNull();
    expect(formValueForField("29.02.2023", "date")).toBeNull();
  });

  it("prefills a number only in the form the input accepts", () => {
    expect(formValueForField("1234.56", "number")).toBe("1234.56");
    // The user can set the type by hand on any row, so this is checked.
    expect(formValueForField("1234,56", "number")).toBeNull();
    expect(formValueForField("1.234,56 lei", "number")).toBeNull();
    // HTML's valid-floating-point grammar allows a leading "-" and not a "+",
    // so a number input blanks "+12.50" the same way.
    expect(formValueForField("+12.50", "number")).toBeNull();
    expect(formValueForField("-12.50", "number")).toBe("-12.50");
  });

  it("passes text through exactly as it was read", () => {
    expect(formValueForField("Ion Popescu", "text")).toBe("Ion Popescu");
    expect(formValueForField("a\nb", "textarea")).toBe("a\nb");
    expect(formValueForField("   ", "text")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// proposeTemplateFields
// ---------------------------------------------------------------------------

describe("proposeTemplateFields", () => {
  it("keeps the model's reading order", () => {
    const out = proposeTemplateFields(
      [pair("Vânzător", "Ion"), pair("Cumpărător", "Maria"), pair("Preț", "1,50")],
      [],
    );
    expect(out.map((p) => p.key)).toEqual(["vanzator", "cumparator", "pret"]);
  });

  it("flags a pair the type already carries, and keeps the existing key", () => {
    const existing = [field({ key: "pret", labelRo: "Preț convenit" })];
    const out = proposeTemplateFields([pair("Preț", "1,50")], existing);
    expect(out).toHaveLength(1);
    expect(out[0].alreadyInForm).toBe(true);
    expect(out[0].key).toBe("pret");
  });

  it("recognises a field by its LABEL when the key is an abbreviation of it", () => {
    // Curated fields are routinely keyed shorter than their caption. Without
    // the label side of the match, a discovery that reads that very caption
    // offers it as new and the form ends up with two identical captions.
    const existing = [field({ key: "nrAct", labelRo: "Nr. act autentic" })];
    const out = proposeTemplateFields([pair("Nr. act autentic", "123")], existing);
    expect(out[0].alreadyInForm).toBe(true);
    expect(out[0].key).toBe("nrAct");
  });

  it("does not offer the four generic fields every document already has", () => {
    // title / nrDocument / dateDocument / subject are COLUMNS, so no template
    // carries them — and discover's own prompt uses "Nr. 1234" and
    // "Data: 12.04.2021" as its worked examples of what to report. Accepting
    // them would make every later import write one printed value twice, once
    // to the column and once to custom_fields, after which the two copies
    // diverge the first time anyone edits one.
    const out = proposeTemplateFields(
      [pair("Nr.", "1234/2024"), pair("Data", "17.03.2024"), pair("Titlu", "Contract"),
       pair("Subiect", "vânzare"), pair("Preț", "1.50")],
      [],
    );
    expect(out.map((p) => p.alreadyInForm)).toEqual([true, true, true, true, false]);
    expect(out.filter((p) => !p.alreadyInForm).map((p) => p.key)).toEqual(["pret"]);
  });

  it("recognises a camelCase field it would have slugged differently", () => {
    // The whole hand-written convention is camelCase. Missing this match makes
    // a re-run offer the entire existing form as new, and accepting it appends
    // a second snake_case copy of every field.
    const existing = [field({ key: "pretTotal", labelRo: "Preț total" })];
    const out = proposeTemplateFields([pair("Preț total", "1,50")], existing);
    expect(out[0].alreadyInForm).toBe(true);
    // And it hands back the key the DATA is under, not the slug that matched it.
    expect(out[0].key).toBe("pretTotal");
  });

  it("never issues a new key that collides with an existing field", () => {
    // "Preț" and "Pret" both slug to `pret`. The FIRST is the field the type
    // already has; the second is a second occurrence on the page and must get
    // its own key rather than silently overwriting the first on save.
    const existing = [field({ key: "pret" })];
    const out = proposeTemplateFields([pair("Preț", "1"), pair("Pret", "2")], existing);
    expect(out.map((p) => p.alreadyInForm)).toEqual([true, false]);
    expect(out.map((p) => p.key)).toEqual(["pret", "pret_2"]);
    expect(new Set(out.map((p) => p.key)).size).toBe(out.length);
  });

  it("uniquifies two identically-labelled pairs from the same document", () => {
    const out = proposeTemplateFields([pair("Martor", "A"), pair("Martor", "B")], []);
    expect(out.map((p) => p.key)).toEqual(["martor", "martor_2"]);
  });

  it("drops a pair whose label is only whitespace it cannot key", () => {
    const out = proposeTemplateFields([pair("   ", "x"), pair("Preț", "1")], []);
    expect(out.map((p) => p.key)).toEqual(["pret"]);
  });

  it("carries the value through verbatim as evidence, unmasked and untruncated", () => {
    // The review step shows this beside the row; only the STORED hint is
    // masked and clipped. A user checking a CNP against the page needs to see
    // the CNP.
    const value = `1800101123456 ${"y".repeat(300)}`;
    const out = proposeTemplateFields([pair("CNP", value)], []);
    expect(out[0].sampleValue).toBe(value);
  });

  it("carries the model's confidence through", () => {
    const out = proposeTemplateFields([pair("Preț", "1", "low")], []);
    expect(out[0].confidence).toBe("low");
  });

  it("does not offer a label the system captures some other way", () => {
    // Person roles are extracted as structured `parties` and linked to real
    // Person records. Accepting one here as well would put a second, freely
    // editable copy of a name and CNP on every document of the type.
    const out = proposeTemplateFields(
      [pair("Vânzător", "POPESCU ION"), pair("Suprafață", "120 mp")],
      [],
      ["Vânzător", "Cumpărător"],
    );
    expect(out.map((p) => p.alreadyInForm)).toEqual([true, false]);
    expect(out.filter((p) => !p.alreadyInForm).map((p) => p.key)).toEqual(["suprafata"]);
  });

  it("never throws on odd model output", () => {
    expect(() =>
      proposeTemplateFields(
        [pair("", ""), pair("§", ""), pair("A".repeat(500), "B".repeat(5000))],
        [],
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// sanitizeTemplateField / mergeAcceptedFields
// ---------------------------------------------------------------------------

describe("sanitizeTemplateField", () => {
  it("leaves a usable key exactly as it was", () => {
    // The one property that protects already-captured data: `custom_fields` is
    // keyed by this string on every document of the type. Lower-casing
    // `pretTotal` here orphans every value stored under it.
    for (const key of ["pretTotal", "nr_cadastral", "nr-cadastral", "C.F.", "a1"]) {
      expect(sanitizeTemplateField(field({ key })).key).toBe(key);
    }
  });

  it("re-slugs only a key that could corrupt the prompt line", () => {
    expect(sanitizeTemplateField(field({ key: "Preț Total!" })).key).toBe("pret_total");
    expect(sanitizeTemplateField(field({ key: 'a"b' })).key).toBe("a_b");
    expect(sanitizeTemplateField(field({ key: "a\nb" })).key).toBe("a_b");
  });

  it("collapses newlines out of every string that reaches the prompt", () => {
    const clean = sanitizeTemplateField(
      field({ labelRo: "Preț\ntotal", labelEn: "Total\nprice", aiHint: "a\nb" }),
    );
    expect(clean.labelRo).toBe("Preț total");
    expect(clean.labelEn).toBe("Total price");
    expect(clean.aiHint).toBe("a b");
  });

  it("falls back rather than leaving a field with no caption", () => {
    const clean = sanitizeTemplateField(field({ key: "pret", labelRo: "  ", labelEn: "Price" }));
    expect(clean.labelRo).toBe("Price");
    const both = sanitizeTemplateField(field({ key: "pret", labelRo: " ", labelEn: " " }));
    expect(both.labelRo).toBe("pret");
    expect(both.labelEn).toBe("pret");
  });

  it("turns an emptied hint into null, not an empty string", () => {
    expect(sanitizeTemplateField(field({ aiHint: "   " })).aiHint).toBeNull();
  });
});

describe("mergeAcceptedFields", () => {
  const existing = [
    field({ key: "vanzator", labelRo: "Vânzător", order: 0 }),
    field({ key: "pret", labelRo: "Preț", order: 1 }),
  ];

  it("keeps every existing field, in front and in order", () => {
    const merged = mergeAcceptedFields(existing, [field({ key: "notar", labelRo: "Notar" })]);
    expect(merged.map((f) => f.key)).toEqual(["vanzator", "pret", "notar"]);
  });

  it("does not rename a camelCase template it was handed", () => {
    // The failure this test exists for: every prior document of the type
    // stores its value at custom_fields.pretTotal, and a renamed key leaves
    // that data in the database and unreachable from the form and the prompt.
    const curated = [
      field({ key: "pretTotal", labelRo: "Preț total", order: 0 }),
      field({ key: "nrCadastral", labelRo: "Nr. cadastral", order: 1 }),
    ];
    const merged = mergeAcceptedFields(curated, [field({ key: "notar" })]);
    expect(merged.map((f) => f.key)).toEqual(["pretTotal", "nrCadastral", "notar"]);
  });

  it("drops an accepted field that is the same key in another convention", () => {
    const curated = [field({ key: "pretTotal", labelRo: "Preț total", order: 0 })];
    const merged = mergeAcceptedFields(curated, [field({ key: "pret_total", labelRo: "Preț" })]);
    expect(merged.map((f) => f.key)).toEqual(["pretTotal"]);
    expect(merged[0].labelRo).toBe("Preț total");
  });

  it("renumbers order from the final position, with no gaps or ties", () => {
    const merged = mergeAcceptedFields(existing, [
      field({ key: "notar", order: 99 }),
      field({ key: "martor", order: 99 }),
    ]);
    expect(merged.map((f) => f.order)).toEqual([0, 1, 2, 3]);
  });

  it("collapses a duplicate key to its first occurrence", () => {
    const merged = mergeAcceptedFields(existing, [
      field({ key: "pret", labelRo: "Preț (din nou)" }),
      field({ key: "notar" }),
    ]);
    expect(merged.map((f) => f.key)).toEqual(["vanzator", "pret", "notar"]);
    expect(merged.find((f) => f.key === "pret")?.labelRo).toBe("Preț");
  });

  it("drops an EXACT duplicate key already in the stored template", () => {
    // Two rows under one key cannot both be filled — custom_fields is keyed by
    // it, so the second shadows the first for ever.
    const dirty = [field({ key: "pret", labelRo: "A" }), field({ key: "pret", labelRo: "B" })];
    expect(mergeAcceptedFields(dirty, []).map((f) => f.labelRo)).toEqual(["A"]);
  });

  it("keeps two stored fields that merely normalise alike", () => {
    // They are different keys, so they hold different data, and dropping one
    // on a save the user asked for something else entirely would lose it. The
    // normalised test governs what may be ADDED, never what is already there.
    const dirty = [
      field({ key: "pretTotal", labelRo: "A" }),
      field({ key: "pret_total", labelRo: "B" }),
    ];
    expect(mergeAcceptedFields(dirty, []).map((f) => f.key)).toEqual(["pretTotal", "pret_total"]);
  });

  it("does not re-slug a stored key that would fail the safe-key test", () => {
    // Nothing has ever constrained stored keys — the admin full-replace PUT
    // validates a key as a non-empty string. Repairing one here would strand
    // every value already captured under it.
    const odd = [field({ key: "nr act autentic", labelRo: "Nr. act" })];
    expect(mergeAcceptedFields(odd, []).map((f) => f.key)).toEqual(["nr act autentic"]);
  });

  it("survives a round trip through parseTemplateFields unchanged", () => {
    // What is stored is jsonb; what is read back builds the form and the
    // prompt. A merge whose output the reader would alter is a merge whose
    // result nobody actually gets.
    const merged = mergeAcceptedFields(existing, [field({ key: "notar", type: "date" })]);
    expect(parseTemplateFields(JSON.parse(JSON.stringify(merged)))).toEqual(merged);
  });

  it("accepts an empty acceptance without disturbing the type", () => {
    expect(mergeAcceptedFields(existing, [])).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// The prompt-line contract
// ---------------------------------------------------------------------------

describe("what reaches the extraction prompt", () => {
  it("puts every discovered field on exactly one line of the real prompt", () => {
    // Asserted against buildExtractSystemPrompt itself, not against a rule
    // restated here: the one-line-per-field shape is that module's, and this
    // is what stops a label typed with a line break from splitting it.
    const proposals = proposeTemplateFields(
      [
        pair("Preț\ntotal", "1.234,56 lei"),
        pair("Observații", "prima linie\na doua linie\na treia"),
        pair("Data autentificării", "17.03.2024"),
      ],
      [],
    );
    const merged = mergeAcceptedFields(
      [],
      proposals.map((p, i) => ({
        key:     p.key,
        labelRo: p.labelRo,
        labelEn: p.labelEn,
        type:    p.type,
        order:   i,
        aiHint:  buildFieldHint({ sampleValue: p.sampleValue, type: p.type }),
        groupRo: null,
        groupEn: null,
      })),
    );

    const prompt = buildExtractSystemPrompt(merged, []);
    for (const f of merged) {
      const hits = prompt.split("\n").filter((line) => line.includes(`"${f.key}"`));
      expect(hits).toHaveLength(1);
      expect(hits[0]).toContain(f.labelRo);
      if (f.aiHint) expect(hits[0]).toContain(f.aiHint);
    }
  });

  it("keeps the ceiling the route enforces in one place", () => {
    expect(MAX_TEMPLATE_FIELDS).toBeGreaterThan(0);
    const routeSource = readFileSync(
      join(process.cwd(), "src", "app", "api", "document-types", "[id]", "template-fields", "route.ts"),
      "utf8",
    );
    // A second literal in the route would let the dialog's pre-check and the
    // route's rejection disagree, which is a Save button that is enabled and
    // then fails.
    expect(routeSource).toContain("MAX_TEMPLATE_FIELDS");
    expect(routeSource).not.toMatch(/const MAX_FIELDS\s*=/);
  });
});

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

function loadDocumentCopy(file: string): Record<string, unknown> {
  const raw = readFileSync(join(process.cwd(), "messages", file), "utf8");
  return (JSON.parse(raw) as { document: Record<string, unknown> }).document;
}

function loadReviewCopy(file: string): Record<string, unknown> {
  return loadDocumentCopy(file).discoverReview as Record<string, unknown>;
}

describe("review-step copy", () => {
  it.each(LOCALES)("%s carries the whole namespace", (file) => {
    const copy = loadReviewCopy(file);
    for (const key of [
      "title", "intro", "warnSkipped", "warnTruncated", "nothingNew",
      "tableCaption", "colInclude", "colLabel", "colType", "colSample",
      "includeAria", "labelAria", "typeAria", "lowConfidence", "sampleEmpty",
      "alreadyTitle", "alreadyBody", "selectedCount", "needSelection",
      "nothingToAddFooter", "typeFull", "cancel", "close", "save", "saving",
      "overLimit", "errorSession", "errorChanged", "errorNotFound",
      "errorTooMany", "errorSave",
    ]) {
      expect(typeof copy[key]).toBe("string");
    }
    const types = copy.types as Record<string, unknown>;
    for (const t of ["text", "textarea", "date", "number"]) {
      expect(typeof types[t]).toBe("string");
    }
  });

  it("both locales define exactly the same keys", () => {
    // A key present in en-GB and missing from ro-RO renders as a raw key path
    // in the shipping locale — the failure #26.02 recorded.
    const ro = Object.keys(loadReviewCopy("ro-RO.json")).sort();
    const en = Object.keys(loadReviewCopy("en-GB.json")).sort();
    expect(ro).toEqual(en);
  });

  it("Romanian plurals carry one/few/other", () => {
    // Romanian has a `few` form (2..19) that English does not. Omitting it
    // makes "5 câmpuri" render through the `other` rule, which is the
    // "de câmpuri" form and reads wrong.
    const review = loadReviewCopy("ro-RO.json");
    for (const key of ["warnSkipped", "alreadyTitle", "selectedCount"]) {
      const msg = String(review[key]);
      expect(msg).toContain("one {");
      expect(msg).toContain("few {");
      expect(msg).toContain("other {");
    }
    const doc = loadDocumentCopy("ro-RO.json");
    for (const key of ["aiDiscoverSaved", "aiDiscoverSkipped"]) {
      const msg = String(doc[key]);
      expect(msg).toContain("one {");
      expect(msg).toContain("few {");
      expect(msg).toContain("other {");
    }
  });

  it("carries a localised message for every failure the run can report", () => {
    // The route serves an API and most of its failures are English, some of
    // them Anthropic's own. None of them may reach this screen verbatim.
    for (const file of LOCALES) {
      const doc = loadDocumentCopy(file);
      for (const key of [
        "aiDiscoverError", "aiDiscoverErrorBusy", "aiDiscoverErrorNoPages",
        "aiDiscoverErrorUnreadable", "aiDiscoverErrorNotConfigured",
      ]) {
        expect(typeof doc[key]).toBe("string");
      }
    }
  });

  it("no AI-Discovery string sends a business user to the server console", () => {
    // The button's whole point changed in this slice: the report is not a
    // developer diagnostic any more, and every string on its path — the hint,
    // and the two that ride along with the nothing-found message — must not
    // mention a terminal the user does not have.
    for (const file of LOCALES) {
      const doc = loadDocumentCopy(file);
      const strings = [
        String((doc.hints as Record<string, string>).aiDiscover),
        ...Object.entries(doc)
          .filter(([k, v]) => k.startsWith("aiDiscover") && typeof v === "string")
          .map(([, v]) => String(v)),
      ];
      for (const s of strings) {
        expect(s.toLowerCase()).not.toContain("console");
        expect(s.toLowerCase()).not.toContain("consol");
      }
    }
  });
});

describe("collapseWhitespace", () => {
  it("is the one-line guarantee everything else leans on", () => {
    expect(collapseWhitespace("  a \n b \t c  ")).toBe("a b c");
    expect(collapseWhitespace("\n\n")).toBe("");
  });
});
