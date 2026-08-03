/**
 * Slice #23.08.Import — the ID-card → Document field mapping.
 *
 * These tests pin the RULES, not the wording. The one exception is the notes
 * marker, which is asserted through the exported constant rather than a
 * literal: the marker's whole job is to make the append idempotent, so a change
 * to its text must not quietly make every previously-noted document eligible
 * for a second note.
 */

import {
  ID_CARD_NOTE_LINE,
  ID_CARD_NOTE_MARKER,
  ID_CARD_SUBJECT_PREFIX,
  ID_CARD_TITLE_PREFIX,
  ID_CARD_TYPE_KEYS,
  documentFieldsFromIdCard,
  idCardDocumentFieldCount,
  isIdCardEntry,
  type IdCardDocumentSource,
} from "@/lib/import/id-card";

const FULL_CARD: IdCardDocumentSource = {
  idCardNumber: "ZZ 123456",
  idIssuingAuthority: "SPCLEP Bragadiru",
  idValidFrom: "2019-04-02",
  idValidUntil: "2029-04-02",
  firstName: "Ion",
  lastName: "Popescu",
};

describe("documentFieldsFromIdCard — the mapping", () => {
  it("maps every card field onto its document target on a blank document", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, {});

    expect(patch.nrDocument).toBe("ZZ 123456");
    // Valid-from IS the issue date on a Romanian CI.
    expect(patch.dateDocument).toBe("2019-04-02");
    expect(patch.dateValidUntil).toBe("2029-04-02");
    expect(patch.subject).toBe(`${ID_CARD_SUBJECT_PREFIX}SPCLEP Bragadiru`);
    expect(patch.title).toBe(`${ID_CARD_TITLE_PREFIX}Popescu Ion`);
  });

  it("never maps person attributes onto the document", () => {
    // The guard against a second, editable copy of an immutable CNP. If a
    // future change adds one of these to the patch, this fails loudly.
    const patch = documentFieldsFromIdCard(
      { ...FULL_CARD },
      {},
    ) as Record<string, unknown>;

    for (const forbidden of ["cnp", "dateOfBirth", "placeOfBirth", "gender", "idMrzRaw"]) {
      expect(patch[forbidden]).toBeUndefined();
    }
  });

  it("invents no customFields key", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, {}) as Record<string, unknown>;
    expect(patch.customFields).toBeUndefined();
  });

  it("does not target institutionId (an FK that would mean auto-creating rows)", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, {}) as Record<string, unknown>;
    expect(patch.institutionId).toBeUndefined();
  });
});

describe("documentFieldsFromIdCard — write-if-empty", () => {
  it("leaves every already-filled target alone", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, {
      title: "Buletin scanat 2019",
      nrDocument: "AA 000111",
      dateDocument: "2001-01-01",
      dateValidUntil: "2031-01-01",
      subject: "Ceva scris de om",
    });

    expect(patch.title).toBeUndefined();
    expect(patch.nrDocument).toBeUndefined();
    expect(patch.dateDocument).toBeUndefined();
    expect(patch.dateValidUntil).toBeUndefined();
    expect(patch.subject).toBeUndefined();
    // Nothing was written, so no provenance note either.
    expect(patch.notes).toBeUndefined();
    expect(Object.keys(patch)).toHaveLength(0);
  });

  it("fills only the gaps when the document is partly populated", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, { nrDocument: "AA 000111" });

    expect(patch.nrDocument).toBeUndefined();
    expect(patch.dateDocument).toBe("2019-04-02");
    expect(patch.title).toBe(`${ID_CARD_TITLE_PREFIX}Popescu Ion`);
  });

  it("treats a whitespace-only current value as empty", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, { nrDocument: "   " });
    expect(patch.nrDocument).toBe("ZZ 123456");
  });

  it("treats a whitespace-only card value as absent", () => {
    const patch = documentFieldsFromIdCard({ ...FULL_CARD, idCardNumber: "  " }, {});
    expect(patch.nrDocument).toBeUndefined();
  });

  it("returns an empty patch for an empty card and an empty document", () => {
    expect(documentFieldsFromIdCard({}, {})).toEqual({});
  });
});

describe("documentFieldsFromIdCard — title composition", () => {
  it("uses the surname alone when there is no first name", () => {
    const patch = documentFieldsFromIdCard({ lastName: "Popescu" }, {});
    expect(patch.title).toBe(`${ID_CARD_TITLE_PREFIX}Popescu`);
  });

  it("writes no title when the card carries no name at all", () => {
    const patch = documentFieldsFromIdCard({ idCardNumber: "ZZ 1" }, {});
    expect(patch.title).toBeUndefined();
  });
});

describe("documentFieldsFromIdCard — the date guard", () => {
  it("drops a non-ISO date without taking the rest of the patch down with it", () => {
    // The failure this prevents: Postgres rejects the WHOLE patch on one bad
    // date, so a single malformed value would cost every other card field.
    const patch = documentFieldsFromIdCard(
      { ...FULL_CARD, idValidFrom: "02.04.2019" },
      {},
    );

    expect(patch.dateDocument).toBeUndefined();
    expect(patch.nrDocument).toBe("ZZ 123456");
    expect(patch.dateValidUntil).toBe("2029-04-02");
  });
});

describe("documentFieldsFromIdCard — the provenance note", () => {
  it("appends the note when something was written and there are no notes yet", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, {});
    expect(patch.notes).toBe(ID_CARD_NOTE_LINE);
  });

  it("appends after existing notes rather than replacing them", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, { notes: "Notă scrisă de om." });
    expect(patch.notes).toBe(`Notă scrisă de om.\n\n${ID_CARD_NOTE_LINE}`);
    expect(patch.notes).toContain("Notă scrisă de om.");
  });

  it("does not append a second time — the marker makes a re-run idempotent", () => {
    const first = documentFieldsFromIdCard(FULL_CARD, {});
    const second = documentFieldsFromIdCard(FULL_CARD, { notes: first.notes });
    expect(second.notes).toBeUndefined();
  });

  it("recognises the marker anywhere in the notes, not only at the end", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, {
      notes: `${ID_CARD_NOTE_MARKER} ceva\n\nadăugat ulterior de om`,
    });
    expect(patch.notes).toBeUndefined();
  });

  it("writes no note when nothing else was written", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, {
      title: "x",
      nrDocument: "x",
      dateDocument: "2001-01-01",
      dateValidUntil: "2031-01-01",
      subject: "x",
    });
    expect(patch.notes).toBeUndefined();
  });

  it("is Romanian regardless of anything else — it is document data, not UI", () => {
    // "cartea", not "carte": the line reads "de pe cartea de identitate".
    // The first version of this assertion dropped the definite article and
    // failed against correct Romanian — the string was right, the test was
    // wrong. Matching the articled form keeps it that way.
    expect(ID_CARD_NOTE_LINE).toContain("cartea de identitate");
    expect(ID_CARD_NOTE_LINE).toContain(ID_CARD_NOTE_MARKER);
  });
});

describe("idCardDocumentFieldCount", () => {
  it("counts document fields and excludes the notes line", () => {
    const patch = documentFieldsFromIdCard(FULL_CARD, {});
    expect(patch.notes).toBeDefined();
    expect(idCardDocumentFieldCount(patch)).toBe(5);
  });

  it("is zero for an empty patch", () => {
    expect(idCardDocumentFieldCount({})).toBe(0);
  });
});

describe("ID_CARD_TYPE_KEYS — Slice #23.08.Import removed the phantom _ALT key", () => {
  it("no longer carries CARTE_IDENTITATE_ALT", () => {
    // Confirmed against the live lookup_document_type: 26 rows, and this key is
    // not one of them. It also cannot arrive from Haiku (KNOWN_TYPE_KEYS lost
    // it in #23.01) nor from auto-creation (which generates a different key).
    expect(ID_CARD_TYPE_KEYS as readonly string[]).not.toContain("CARTE_IDENTITATE_ALT");
  });

  it("still recognises the real key", () => {
    expect(ID_CARD_TYPE_KEYS as readonly string[]).toContain("CARTE_IDENTITATE");
    expect(isIdCardEntry({ typeKey: "CARTE_IDENTITATE" })).toBe(true);
  });

  it("treats the retired key as any other non-ID key — no longer a match", () => {
    // A hypothetical stale _ALT is no longer a positive key match, and it is
    // not UNCLASSIFIED either, so it is vetoed like any other non-ID key.
    // Pinned deliberately: this is the behaviour change, and it is safe only
    // because nothing can produce that key any more.
    expect(isIdCardEntry({ typeKey: "CARTE_IDENTITATE_ALT" })).toBe(false);
    // ...but a row with no key and an ID-card label is still caught.
    expect(isIdCardEntry({ description: "Carte de identitate" })).toBe(true);
  });
});
