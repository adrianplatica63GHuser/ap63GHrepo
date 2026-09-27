/**
 * @jest-environment node
 *
 * FU-234 — a paid read is never thrown away over a stray quote.   (Slice #37.06)
 *
 * One of Slice #36.23's thirty CVC reads came back as almost-JSON: a value held
 * a quoted name with the quotes unescaped („… "Birou X", sediul: …"), strict
 * `JSON.parse` refused it, `ai-interpret` answered 502 and the user got no field
 * from a read that had been paid for. `extractJson` now parses strictly FIRST
 * and only on failure repairs the one defect seen — an unescaped `"` inside a
 * string — and parses strictly again. What a repair did is returned, so the
 * route's log and the ai-score notes can say so.
 *
 * Every answer below is invented; none comes from a deed.
 */
import { extractJson, interpretExtractText, parseModelJson } from "@/lib/documents/ai-extract";

/** The #36.23 shape: a quoted office name inside a value, then more text after a comma. */
const NOTARY_QUOTE = [
  "```json",
  "{",
  '  "fields": { "nrDocument": "1234" },',
  '  "unmappedRaw": {',
  '    "birou_notarial": "Birou Individual Notarial "Ion Inventat", sediul: str. Exemplu nr. 1, Oras",',
  '    "suprafata": "500 mp"',
  "  }",
  "}",
  "```",
].join("\n");

describe("FU-234: an almost-JSON answer still gives its fields", () => {
  it("parses the #36.23 shape and keeps the quotes as text", () => {
    const value = extractJson(NOTARY_QUOTE) as { unmappedRaw: Record<string, string>; fields: Record<string, string> };
    expect(value.fields.nrDocument).toBe("1234");
    expect(value.unmappedRaw.birou_notarial).toBe(
      'Birou Individual Notarial "Ion Inventat", sediul: str. Exemplu nr. 1, Oras',
    );
    expect(value.unmappedRaw.suprafata).toBe("500 mp");
  });

  it("says what it repaired, and repairs nothing in a valid answer", () => {
    expect(parseModelJson(NOTARY_QUOTE).repair).toEqual({ quotesEscaped: 2 });
    expect(parseModelJson('{"a": "x \\"y\\" z", "b": ["c", "d"]}').repair).toBeNull();
  });

  it("repairs a quoted word that ends the value", () => {
    const v = extractJson('{"a": "Societatea "Exemplu"", "b": 1}') as { a: string; b: number };
    expect(v).toEqual({ a: 'Societatea "Exemplu"', b: 1 });
  });

  it("repairs a quote inside an array item", () => {
    const v = extractJson('{"a": ["zis "X" aici", "doi"]}') as { a: string[] };
    expect(v.a).toEqual(['zis "X" aici', "doi"]);
  });

  it("still refuses an answer that is broken in another way, with the strict parser's message", () => {
    expect(() => extractJson('{"a": "cut off')).toThrow(SyntaxError);
    expect(() => extractJson("I could not read this document.")).toThrow(SyntaxError);
  });

  it("reaches the interpretation: the fields arrive and the repair is recorded", () => {
    const read = interpretExtractText(NOTARY_QUOTE, []);
    expect(read.fields.nrDocument).toBe("1234");
    expect(read.jsonRepair).toEqual({ quotesEscaped: 2 });
    expect(interpretExtractText('{"fields": {}}', []).jsonRepair).toBeNull();
  });
});
