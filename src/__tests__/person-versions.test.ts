/**
 * Unit tests for the Person versioning (Slice #18.05) pure helpers, for BOTH
 * subtypes: snapshot conversion, version label colour, per-field highlights,
 * and form-value equality. Persons have no corners, so (unlike Property) there
 * is no corner-diff to test.
 *
 * No DB / React — pure functions only.
 */

import {
  computeFieldHighlights as natHighlights,
  versionLabelColor as natLabel,
  formValuesEqual as natEqual,
  snapshotToFormValues as natToForm,
  emptyFormValues as natEmpty,
} from "@/app/natural-persons/_components/form-schema";
import {
  computeFieldHighlights as judHighlights,
  versionLabelColor as judLabel,
  formValuesEqual as judEqual,
  snapshotToFormValues as judToForm,
  emptyFormValues as judEmpty,
} from "@/app/judicial-persons/_components/form-schema";
import { fieldFrame, normVal } from "@/lib/versioning/field-diff";
import type {
  NaturalPersonSnapshot,
  PersonAddressSnapshot,
} from "@/lib/persons/validation";
import type { JudicialPersonSnapshot } from "@/lib/judicial-persons/validation";

// ---------------------------------------------------------------------------
// Snapshot builders
// ---------------------------------------------------------------------------

function addr(over: Partial<PersonAddressSnapshot> = {}): PersonAddressSnapshot {
  return {
    streetLine: null, postalCode: null, locality: null,
    county: null, country: null, notes: null,
    ...over,
  };
}

const EMPTY_NAT: NaturalPersonSnapshot["natural"] = {
  firstName: null, lastName: null, nickname: null, cnp: null,
  idDocumentType: null, idDocumentNumber: null, gender: null,
  dateOfBirth: null, personalPhone1: null, personalPhone2: null,
  workPhone: null, personalEmail1: null, personalEmail2: null,
  workEmail: null, placeOfBirth: null, idIssuingAuthority: null,
  idValidFrom: null, idValidUntil: null, idCardNumber: null,
  idMrzRaw: null, citizenshipId: null,
  // Slice #18.16.VL:
  physicalPersonTypeId: null,
};

function natSnap(over: {
  notes?: string | null;
  natural?: Partial<NaturalPersonSnapshot["natural"]>;
  home?: PersonAddressSnapshot | null;
  corr?: PersonAddressSnapshot | null;
} = {}): NaturalPersonSnapshot {
  return {
    notes: over.notes ?? null,
    natural: { ...EMPTY_NAT, ...(over.natural ?? {}) },
    addresses: {
      HOME: over.home ?? null,
      CORRESPONDENCE: over.corr ?? null,
    },
  };
}

const EMPTY_JUD: JudicialPersonSnapshot["judicial"] = {
  name: null, nickname: null, judicialPersonTypeId: null,
  cuiNumber: null, tradeRegisterNumber: null,
  contactPerson1Id: null, contactPerson2Id: null,
  correspondenceSameAsHq: false,
};

function judSnap(over: {
  notes?: string | null;
  judicial?: Partial<JudicialPersonSnapshot["judicial"]>;
  hq?: PersonAddressSnapshot | null;
  corr?: PersonAddressSnapshot | null;
} = {}): JudicialPersonSnapshot {
  return {
    notes: over.notes ?? null,
    judicial: { ...EMPTY_JUD, ...(over.judicial ?? {}) },
    addresses: {
      HEADQUARTERS: over.hq ?? null,
      CORRESPONDENCE: over.corr ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Shared primitive: fieldFrame
// ---------------------------------------------------------------------------

describe("fieldFrame", () => {
  it("null -> value is green (addition)", () => {
    expect(fieldFrame(null, "x")).toBe("green");
  });
  it("value -> null is red (deletion)", () => {
    expect(fieldFrame("x", null)).toBe("red");
  });
  it("value -> other value is red (modification)", () => {
    expect(fieldFrame("a", "b")).toBe("red");
  });
  it("unchanged (incl. whitespace-only == empty) is null", () => {
    expect(fieldFrame("a", "a")).toBeNull();
    expect(fieldFrame(null, "   ")).toBeNull();
  });
  it("normVal trims and treats blank as null", () => {
    expect(normVal("  hi ")).toBe("hi");
    expect(normVal("   ")).toBeNull();
    expect(normVal(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Natural person
// ---------------------------------------------------------------------------

describe("natural: versionLabelColor", () => {
  it("version 0 (no predecessor) is green", () => {
    expect(natLabel(null, natSnap({ natural: { firstName: "Ana" } }))).toBe("green");
  });
  it("addition-only field change is green", () => {
    const prev = natSnap({ natural: { nickname: null } });
    const curr = natSnap({ natural: { nickname: "Nelu" } });
    expect(natLabel(prev, curr)).toBe("green");
  });
  it("modifying an existing field is red", () => {
    expect(natLabel(
      natSnap({ natural: { lastName: "Old" } }),
      natSnap({ natural: { lastName: "New" } }),
    )).toBe("red");
  });
  it("deleting an existing field is red", () => {
    expect(natLabel(
      natSnap({ notes: "keep" }),
      natSnap({ notes: null }),
    )).toBe("red");
  });
  it("adding a whole address block is green (addition)", () => {
    const prev = natSnap({ home: null });
    const curr = natSnap({ home: addr({ streetLine: "Main 1", country: "RO" }) });
    expect(natLabel(prev, curr)).toBe("green");
  });
  it("modifying an existing address field is red", () => {
    const prev = natSnap({ home: addr({ locality: "Bragadiru", country: "RO" }) });
    const curr = natSnap({ home: addr({ locality: "Ilfov", country: "RO" }) });
    expect(natLabel(prev, curr)).toBe("red");
  });
});

describe("natural: computeFieldHighlights", () => {
  it("returns no highlights for version 0 (prev null)", () => {
    const h = natHighlights(null, natSnap({ natural: { firstName: "x" } }));
    expect(h.fields).toEqual({});
    expect(h.addresses.HOME).toEqual({});
    expect(h.addresses.CORRESPONDENCE).toEqual({});
  });
  it("flags an added field green and a modified field red", () => {
    const prev = natSnap({ natural: { nickname: null, lastName: "P1" } });
    const curr = natSnap({ natural: { nickname: "added", lastName: "P2" } });
    const h = natHighlights(prev, curr);
    expect(h.fields.nickname).toBe("green");
    expect(h.fields.lastName).toBe("red");
    expect(h.fields.firstName).toBeUndefined();
  });
  it("flags a deleted notes field red", () => {
    expect(natHighlights(natSnap({ notes: "kept" }), natSnap({ notes: null })).fields.notes).toBe("red");
  });
  it("diffs address fields, treating a missing block as all-empty", () => {
    const prev = natSnap({ home: null });
    const curr = natSnap({ home: addr({ streetLine: "Main 1", country: "RO" }) });
    const h = natHighlights(prev, curr);
    expect(h.addresses.HOME.streetLine).toBe("green");
    expect(h.addresses.HOME.country).toBe("green");
  });
});

describe("natural: formValuesEqual + snapshot conversion", () => {
  it("treats blank and whitespace-only as equal-to-empty", () => {
    expect(natEqual(natEmpty, { ...natEmpty, nickname: "   " })).toBe(true);
  });
  it("detects a real field change", () => {
    expect(natEqual(natEmpty, { ...natEmpty, lastName: "Popescu" })).toBe(false);
  });
  it("detects an address field change", () => {
    expect(natEqual(natEmpty, {
      ...natEmpty,
      addresses: { ...natEmpty.addresses, HOME: { ...natEmpty.addresses.HOME, locality: "Bragadiru" } },
    })).toBe(false);
  });
  it("round-trips fields + address into form values", () => {
    const s = natSnap({
      notes: "vip",
      natural: { firstName: "Ana", lastName: "Pop" },
      home: addr({ streetLine: "Main 1", country: "RO" }),
    });
    const fv = natToForm(s);
    expect(fv.firstName).toBe("Ana");
    expect(fv.lastName).toBe("Pop");
    expect(fv.notes).toBe("vip");
    expect(fv.addresses.HOME.streetLine).toBe("Main 1");
    expect(fv.addresses.HOME.country).toBe("RO");
  });
});

// ---------------------------------------------------------------------------
// Judicial person
// ---------------------------------------------------------------------------

describe("judicial: versionLabelColor", () => {
  it("version 0 is green", () => {
    expect(judLabel(null, judSnap({ judicial: { name: "ACME SRL" } }))).toBe("green");
  });
  it("addition-only field change is green", () => {
    expect(judLabel(
      judSnap({ judicial: { nickname: null } }),
      judSnap({ judicial: { nickname: "ACME" } }),
    )).toBe("green");
  });
  it("modifying an existing field is red", () => {
    expect(judLabel(
      judSnap({ judicial: { cuiNumber: "111" } }),
      judSnap({ judicial: { cuiNumber: "222" } }),
    )).toBe("red");
  });
  it("toggling correspondenceSameAsHq is a modification (red)", () => {
    expect(judLabel(
      judSnap({ judicial: { correspondenceSameAsHq: false } }),
      judSnap({ judicial: { correspondenceSameAsHq: true } }),
    )).toBe("red");
  });
});

describe("judicial: computeFieldHighlights", () => {
  it("returns no highlights for version 0 (prev null)", () => {
    const h = judHighlights(null, judSnap({ judicial: { name: "x" } }));
    expect(h.fields).toEqual({});
    expect(h.addresses.HEADQUARTERS).toEqual({});
  });
  it("flags an added name green and a modified cui red", () => {
    const prev = judSnap({ judicial: { name: null, cuiNumber: "111" } });
    const curr = judSnap({ judicial: { name: "ACME", cuiNumber: "222" } });
    const h = judHighlights(prev, curr);
    expect(h.fields.name).toBe("green");
    expect(h.fields.cuiNumber).toBe("red");
  });
  it("diffs the HEADQUARTERS address block", () => {
    const prev = judSnap({ hq: null });
    const curr = judSnap({ hq: addr({ streetLine: "Office 5", country: "RO" }) });
    const h = judHighlights(prev, curr);
    expect(h.addresses.HEADQUARTERS.streetLine).toBe("green");
  });
});

describe("judicial: formValuesEqual + snapshot conversion", () => {
  it("detects a name change", () => {
    expect(judEqual(judEmpty, { ...judEmpty, name: "ACME SRL" })).toBe(false);
  });
  it("detects a same-as-HQ flag change", () => {
    expect(judEqual(judEmpty, { ...judEmpty, correspondenceSameAsHq: true })).toBe(false);
  });
  it("ignores the read-only contact-person display name", () => {
    expect(judEqual(judEmpty, { ...judEmpty, contactPerson1Name: "Ana Pop" })).toBe(true);
  });
  it("round-trips fields + HEADQUARTERS address into form values", () => {
    const s = judSnap({
      judicial: { name: "ACME SRL", cuiNumber: "RO123" },
      hq: addr({ streetLine: "Office 5", country: "RO" }),
    });
    const fv = judToForm(s);
    expect(fv.name).toBe("ACME SRL");
    expect(fv.cuiNumber).toBe("RO123");
    expect(fv.addresses.HEADQUARTERS.streetLine).toBe("Office 5");
    expect(fv.addresses.HEADQUARTERS.country).toBe("RO");
  });
});
