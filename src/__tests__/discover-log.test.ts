/**
 * Tests for the discover-mode console report — Slice #21.10.Import.
 *
 * Two things are worth locking down here.
 *
 * 1. parseDiscoverPayload must NEVER throw. It is fed raw model output, and a
 *    diagnostic that crashes on odd data fails exactly when the data is odd —
 *    which is the whole situation discover mode exists for. Same contract as
 *    parseTemplateFields.
 *
 * 2. formatDiscoverLog must not lose content. Discover mode's promise is
 *    completeness, so the assertions below are mostly "this text survived into
 *    the output", not "the output looks like this" — the layout is free to
 *    change, the guarantee that nothing is silently dropped is not.
 */

import {
  formatDiscoverLog,
  parseDiscoverPayload,
  type DiscoverLogInput,
  type DiscoverPayload,
} from "@/lib/documents/discover-log";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyPayload: DiscoverPayload = {
  documentLabel: null,
  recognised: [],
  sections: [],
};

function makeInput(overrides: Partial<DiscoverLogInput> = {}): DiscoverLogInput {
  return {
    pageFileNames: ["scan001.jpg"],
    pagesSent: 1,
    pagesTotal: 1,
    registeredTypeName: "Contract de Vânzare",
    registeredTypeKey: "CONTRACT_VANZARE",
    skipped: [],
    truncated: false,
    payload: emptyPayload,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseDiscoverPayload
// ---------------------------------------------------------------------------

describe("parseDiscoverPayload", () => {
  it("parses a well-formed payload", () => {
    const result = parseDiscoverPayload({
      documentLabel: "Contract de arendă",
      recognised: [
        { name: "Nr. cadastral", value: "102345", confidence: "high" },
        { name: "Data încheierii", value: "12.04.2021", confidence: "medium" },
      ],
      sections: [{ heading: "Preambul", lines: ["Între subsemnații", "..."] }],
    });

    expect(result.documentLabel).toBe("Contract de arendă");
    expect(result.recognised).toHaveLength(2);
    expect(result.recognised[1]).toEqual({
      name: "Data încheierii",
      value: "12.04.2021",
      confidence: "medium",
    });
    expect(result.sections[0].lines).toEqual(["Între subsemnații", "..."]);
  });

  it("keeps values verbatim — no date or number normalisation", () => {
    // The point of discover mode: "12.04.2021" must NOT become "2021-04-12",
    // and Romanian decimal separators must survive. The printed wording is the
    // evidence for what a future template field should look like.
    const result = parseDiscoverPayload({
      recognised: [
        { name: "Data", value: "12.04.2021", confidence: "high" },
        { name: "Preț", value: "2.500,00 RON", confidence: "high" },
      ],
    });

    expect(result.recognised[0].value).toBe("12.04.2021");
    expect(result.recognised[1].value).toBe("2.500,00 RON");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "not an object"],
    ["a number", 42],
    ["an array", [1, 2, 3]],
    ["an empty object", {}],
  ])("never throws on %s", (_label, input) => {
    expect(() => parseDiscoverPayload(input)).not.toThrow();
    const result = parseDiscoverPayload(input);
    expect(result.recognised).toEqual([]);
    expect(result.sections).toEqual([]);
    expect(result.documentLabel).toBeNull();
  });

  it("drops entries with no name or no heading but keeps their neighbours", () => {
    const result = parseDiscoverPayload({
      recognised: [
        { name: "Bun", value: "da", confidence: "high" },
        { value: "orfan", confidence: "high" },
        { name: "   ", value: "gol", confidence: "high" },
        null,
        "nonsense",
      ],
      sections: [
        { heading: "Bun", lines: ["a"] },
        { lines: ["fără titlu"] },
      ],
    });

    expect(result.recognised).toHaveLength(1);
    expect(result.recognised[0].name).toBe("Bun");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].heading).toBe("Bun");
  });

  it("keeps a named pair whose value is empty", () => {
    // "this label is printed but nothing is filled in" is real information
    // about the document, not a malformed entry.
    const result = parseDiscoverPayload({
      recognised: [{ name: "Observații", value: "", confidence: "low" }],
    });

    expect(result.recognised).toHaveLength(1);
    expect(result.recognised[0].value).toBe("");
  });

  it("defaults an unrecognised confidence to low rather than dropping the pair", () => {
    const result = parseDiscoverPayload({
      recognised: [
        { name: "A", value: "1", confidence: "very-sure" },
        { name: "B", value: "2" },
      ],
    });

    expect(result.recognised.map((p) => p.confidence)).toEqual(["low", "low"]);
  });

  it("tolerates non-string entries inside a section's lines", () => {
    const result = parseDiscoverPayload({
      sections: [{ heading: "Mixt", lines: ["bun", 42, null, "tot bun"] }],
    });

    expect(result.sections[0].lines).toEqual(["bun", "tot bun"]);
  });
});

// ---------------------------------------------------------------------------
// formatDiscoverLog
// ---------------------------------------------------------------------------

describe("formatDiscoverLog", () => {
  it("reports the page counts and both type readings", () => {
    const out = formatDiscoverLog(
      makeInput({
        pageFileNames: ["a.jpg", "b.jpg", "c.docx"],
        pagesSent: 2,
        pagesTotal: 3,
        payload: { ...emptyPayload, documentLabel: "Contract de arendă" },
      }),
    );

    expect(out).toContain("2/3 page(s) sent");
    expect(out).toContain("Contract de Vânzare");
    expect(out).toContain("CONTRACT_VANZARE");
    expect(out).toContain("Contract de arendă");
  });

  it("prints every recognised pair with its Romanian label intact", () => {
    const out = formatDiscoverLog(
      makeInput({
        payload: {
          documentLabel: null,
          recognised: [
            { name: "Nr. cadastral", value: "102345", confidence: "high" },
            { name: "Suprafață", value: "2.500 mp", confidence: "low" },
          ],
          sections: [],
        },
      }),
    );

    expect(out).toContain("Nr. cadastral");
    expect(out).toContain("102345");
    expect(out).toContain("Suprafață");
    expect(out).toContain("2.500 mp");
    // Below-full-confidence readings are flagged, not hidden.
    expect(out).toContain("[low]");
    expect(out).toContain("1 of 2 below full confidence");
  });

  it("does not flag confidence when every reading is high", () => {
    const out = formatDiscoverLog(
      makeInput({
        payload: {
          documentLabel: null,
          recognised: [{ name: "A", value: "1", confidence: "high" }],
          sections: [],
        },
      }),
    );

    expect(out).not.toContain("below full confidence");
    expect(out).not.toContain("[high]");
  });

  it("prints a long or multi-line value in full, on its own lines", () => {
    const long = "x".repeat(200);
    const out = formatDiscoverLog(
      makeInput({
        payload: {
          documentLabel: null,
          recognised: [
            { name: "Clauză", value: `prima linie\na doua linie`, confidence: "high" },
            { name: "Lung", value: long, confidence: "high" },
          ],
          sections: [],
        },
      }),
    );

    expect(out).toContain("prima linie");
    expect(out).toContain("a doua linie");
    // Never truncated — completeness is the whole promise of this mode.
    expect(out).toContain(long);
  });

  it("prints every section heading and line, in order", () => {
    const out = formatDiscoverLog(
      makeInput({
        payload: {
          documentLabel: null,
          recognised: [],
          sections: [
            { heading: "Preambul", lines: ["Între subsemnații", "domiciliat în"] },
            { heading: "Clauze", lines: ["1. Obiectul contractului"] },
          ],
        },
      }),
    );

    expect(out).toContain("Preambul");
    expect(out).toContain("Între subsemnații");
    expect(out).toContain("domiciliat în");
    expect(out).toContain("Clauze");
    expect(out).toContain("1. Obiectul contractului");
    expect(out).toContain("2 section(s), 3 line(s)");
    expect(out.indexOf("Preambul")).toBeLessThan(out.indexOf("Clauze"));
  });

  it("reports skipped pages with their mime and reason", () => {
    const out = formatDiscoverLog(
      makeInput({
        skipped: [
          {
            fileName: "notite.docx",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            reason: "unsupported format",
          },
          { fileName: "scan.jpg", mimeType: null, reason: "no MIME type was recorded" },
        ],
      }),
    );

    expect(out).toContain("Pages NOT sent (2)");
    expect(out).toContain("notite.docx");
    expect(out).toContain("unsupported format");
    expect(out).toContain("scan.jpg");
    expect(out).toContain("mime=(null)");
    expect(out).toContain("no MIME type was recorded");
  });

  it("says so plainly when nothing was found", () => {
    const out = formatDiscoverLog(makeInput());

    expect(out).toContain("Name / value pairs: (none found)");
    expect(out).toContain("Unrecognised content: (none)");
  });

  it("warns loudly when the model hit its output limit", () => {
    const out = formatDiscoverLog(makeInput({ truncated: true }));

    expect(out).toContain("TRUNCATED");
    expect(out).toContain("INCOMPLETE");
  });

  it("stays silent about truncation when there was none", () => {
    expect(formatDiscoverLog(makeInput())).not.toContain("TRUNCATED");
  });

  it("handles a document with no pages without throwing", () => {
    const out = formatDiscoverLog(
      makeInput({ pageFileNames: [], pagesSent: 0, pagesTotal: 0 }),
    );

    expect(out).toContain("(no pages)");
  });

  it("handles an unresolved document type", () => {
    const out = formatDiscoverLog(
      makeInput({ registeredTypeName: null, registeredTypeKey: null }),
    );

    expect(out).toContain("(unresolved)");
  });
});
