/**
 * Unit tests for the Document versioning (Slice #18.06) pure helpers:
 * snapshot conversion, version label colour, per-field highlights, and
 * form-value equality. Documents have no corners, no subtypes, no satellites,
 * so the diff is a flat field-by-field comparison.
 *
 * No DB / React — pure functions only.
 */

import {
  computeFieldHighlights,
  emptyFormValues,
  formValuesEqual,
  snapshotToFormValues,
  versionLabelColor,
} from "@/app/documents/_components/form-schema";
import type { DocumentSnapshot } from "@/lib/documents/validation";

// ---------------------------------------------------------------------------
// Snapshot builder
// ---------------------------------------------------------------------------

const EMPTY_SNAP: DocumentSnapshot = {
  documentTypeId:    null,
  title:             null,
  nrDocument:        null,
  dateDocument:      null,
  institutionId:     null,
  emitent:           null,
  bazaLegala:        null,
  uatProprietate:    null,
  uatProprietar:     null,
  suprafata:         null,
  nrDosarSuccesoral: null,
  dataDecesului:     null,
  ultimulDomiciliu:  null,
  nrCertificatDeces: null,
  dateStart:         null,
  dateEnd:           null,
  notes:             null,
  // Slice #19.03
  subject:           null,
  dateValidUntil:    null,
  surveyorId:        null,
};

function snap(over: Partial<DocumentSnapshot> = {}): DocumentSnapshot {
  return { ...EMPTY_SNAP, ...over };
}

// A real-shaped v4 uuid for documentTypeId fixtures (Zod v4 uuid is strict).
const TYPE_A = "11111111-1111-4111-8111-111111111111";
const TYPE_B = "22222222-2222-4222-8222-222222222222";

// ---------------------------------------------------------------------------
// versionLabelColor
// ---------------------------------------------------------------------------

describe("versionLabelColor", () => {
  it("version 0 (no predecessor) is always green", () => {
    expect(versionLabelColor(null, snap({ title: "Deed" }))).toBe("green");
  });

  it("addition-only field change is green", () => {
    const prev = snap({ title: null });
    const curr = snap({ title: "Deed 12" });
    expect(versionLabelColor(prev, curr)).toBe("green");
  });

  it("multiple additions with no modify/delete stays green", () => {
    const prev = snap({ title: "Deed" });
    // institution was free text (now institutionId uuid); use nrDosarSuccesoral as a second addition
    const curr = snap({ title: "Deed", nrDocument: "123", nrDosarSuccesoral: "DOS-1" });
    expect(versionLabelColor(prev, curr)).toBe("green");
  });

  it("modifying an existing field is red", () => {
    expect(versionLabelColor(
      snap({ nrDocument: "123" }),
      snap({ nrDocument: "456" }),
    )).toBe("red");
  });

  it("deleting an existing field is red", () => {
    expect(versionLabelColor(
      snap({ notes: "keep" }),
      snap({ notes: null }),
    )).toBe("red");
  });

  it("changing the document type is a modification (red)", () => {
    expect(versionLabelColor(
      snap({ documentTypeId: TYPE_A }),
      snap({ documentTypeId: TYPE_B }),
    )).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// computeFieldHighlights
// ---------------------------------------------------------------------------

describe("computeFieldHighlights", () => {
  it("returns no highlights for version 0 (prev null)", () => {
    expect(computeFieldHighlights(null, snap({ title: "x" }))).toEqual({});
  });

  it("flags an added field green and a modified field red", () => {
    const prev = snap({ title: null, nrDocument: "1" });
    const curr = snap({ title: "added", nrDocument: "2" });
    const h = computeFieldHighlights(prev, curr);
    expect(h.title).toBe("green");
    expect(h.nrDocument).toBe("red");
    expect(h.institutionId).toBeUndefined();
  });

  it("flags a deleted field red", () => {
    expect(computeFieldHighlights(snap({ notes: "kept" }), snap({ notes: null })).notes).toBe("red");
  });

  it("treats whitespace-only as equal-to-empty (no highlight)", () => {
    expect(computeFieldHighlights(snap({ title: null }), snap({ title: "   " }))).toEqual({});
  });

  it("diffs the suprafata (numeric-as-string) field", () => {
    expect(computeFieldHighlights(snap({ suprafata: "450.00" }), snap({ suprafata: "500.00" })).suprafata).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// formValuesEqual + snapshot conversion
// ---------------------------------------------------------------------------

describe("formValuesEqual", () => {
  it("treats blank and whitespace-only as equal-to-empty", () => {
    expect(formValuesEqual(emptyFormValues, { ...emptyFormValues, title: "   " })).toBe(true);
  });

  it("detects a real field change", () => {
    expect(formValuesEqual(emptyFormValues, { ...emptyFormValues, nrDocument: "123" })).toBe(false);
  });

  it("detects a document type change", () => {
    expect(formValuesEqual(
      { ...emptyFormValues, documentTypeId: TYPE_A },
      { ...emptyFormValues, documentTypeId: TYPE_B },
    )).toBe(false);
  });
});

describe("snapshot conversion", () => {
  it("round-trips fields into form values", () => {
    const s = snap({
      documentTypeId: TYPE_A,
      title: "Vânzare Popescu",
      nrDocument: "1234",
      dateDocument: "2021-06-01",
      suprafata: "450.50",
      notes: "vip",
    });
    const fv = snapshotToFormValues(s);
    expect(fv.documentTypeId).toBe(TYPE_A);
    expect(fv.title).toBe("Vânzare Popescu");
    expect(fv.nrDocument).toBe("1234");
    expect(fv.dateDocument).toBe("2021-06-01");
    expect(fv.suprafata).toBe("450.50");
    expect(fv.notes).toBe("vip");
  });

  it("coerces a null documentTypeId to an empty string", () => {
    expect(snapshotToFormValues(snap({ documentTypeId: null })).documentTypeId).toBe("");
  });
});
