/**
 * @jest-environment node
 *
 * FU-024 — „Note extinse" in Romanian, not in the model's identifiers.
 *                                                              (Slice #37.06)
 *
 * The leftover facts the model could not map arrive under keys it invents:
 * `echivalent_pret_ron`, `notarBirou`, `tarif_intabulare_OCPI`. They were folded
 * into the notes verbatim, so a Romanian user read snake_case and camelCase. The
 * common ones now have labels in `messages/*.json` (`aiNotes.unmappedLabels`),
 * and any other identifier-shaped key is spelled out as words. A label the
 * model already wrote as words is left alone.
 */
import { interpretExtractText } from "@/lib/documents/ai-extract";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

function notesFor(unmappedRaw: Record<string, string>): string {
  return interpretExtractText(JSON.stringify({ fields: {}, unmappedRaw }), []).enhancedNotes ?? "";
}

describe("FU-024: the leftover facts are labelled for a person", () => {
  it("has the labels in both message files, under one namespace", () => {
    const roLabels = (ro as { aiNotes?: { unmappedLabels?: Record<string, string> } }).aiNotes?.unmappedLabels ?? {};
    const enLabels = (en as { aiNotes?: { unmappedLabels?: Record<string, string> } }).aiNotes?.unmappedLabels ?? {};
    expect(Object.keys(roLabels).length).toBeGreaterThan(10);
    expect(Object.keys(enLabels).sort()).toEqual(Object.keys(roLabels).sort());
  });

  it("uses the Romanian label for a known key, however the model spelled it", () => {
    const notes = notesFor({ echivalent_pret_ron: "10.000 lei", notarBirou: "BNP X", tarif_intabulare_OCPI: "120 lei" });
    expect(notes).toContain("Echivalent preț (RON): 10.000 lei");
    expect(notes).toContain("Birou notarial: BNP X");
    expect(notes).toContain("Tarif intabulare OCPI: 120 lei");
    expect(notes).not.toMatch(/echivalent_pret_ron|notarBirou|tarif_intabulare_OCPI/);
  });

  it("spells an unknown identifier out as words, never snake_case or camelCase", () => {
    const notes = notesFor({ obligatie_cumparator_extra: "a", scopulOperatiuniiZeta: "b" });
    expect(notes).toContain("Obligatie cumparator extra: a");
    expect(notes).toContain("Scopul operatiunii zeta: b");
    expect(notes).not.toMatch(/[a-z]_[a-z]|[a-z][A-Z]/);
  });

  it("keeps an acronym, and leaves a label the model already wrote as words", () => {
    expect(notesFor({ nrCF: "123" })).toContain("Nr CF: 123");
    expect(notesFor({ "Tarla": "40", "Nr. cadastral": "1234" })).toBe(
      "[AI] Text neasociat unui câmp:\nTarla: 40\nNr. cadastral: 1234",
    );
  });
});
