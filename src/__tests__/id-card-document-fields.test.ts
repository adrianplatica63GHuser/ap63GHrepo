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

/**
 * ⚠️ **The two numbers DIFFER here, and Slice #34.13 is why that matters.**
 * Until then this fixture carried only the secondary one, so every assertion
 * below was blind to which of the two the mapping reads — the question the
 * whole slice turned on. A card printing both, with different values, is also
 * the ordinary Romanian CI: the series+number is on the front and a permanent
 * number can be on the back.
 */
const FULL_CARD: IdCardDocumentSource = {
  idDocumentNumber: "RT123456",
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

    // Slice #34.13 — the SERIES+NUMBER, which is what a person reads off the
    // card, not the secondary number this used to take.
    expect(patch.nrDocument).toBe("RT123456");
    // Valid-from IS the issue date on a Romanian CI.
    expect(patch.dateDocument).toBe("2019-04-02");
    expect(patch.dateValidUntil).toBe("2029-04-02");
    expect(patch.subject).toBe(`${ID_CARD_SUBJECT_PREFIX}SPCLEP Bragadiru`);
    expect(patch.title).toBe(`${ID_CARD_TITLE_PREFIX}Popescu Ion`);
  });

  /**
   * The issuing authority is a ROW when a person placed it, prose only when
   * nobody has.                                                (Slice #34.02)
   *
   * The two arms are exclusive on purpose. With the FK written, a `subject`
   * reading "Eliberată de SPCLEP Bragadiru" would be a second, freely-editable
   * copy of a fact the schema now holds properly — the shape migration_068
   * exists because of. Both directions are asserted, because a change that
   * wrote both would look like an improvement in a diff.
   */
  describe("the issuing authority", () => {
    const CHOSEN = "11111111-2222-3333-4444-555555555555";

    it("writes the FK and NOT the subject line when a person chose a row", () => {
      const patch = documentFieldsFromIdCard({ ...FULL_CARD, institutionId: CHOSEN }, {});
      expect(patch.institutionId).toBe(CHOSEN);
      expect(patch.subject).toBeUndefined();
    });

    it("falls back to the subject line when nobody chose one", () => {
      for (const institutionId of [null, undefined, "", "   "]) {
        const patch = documentFieldsFromIdCard({ ...FULL_CARD, institutionId }, {});
        expect([institutionId, patch.institutionId]).toEqual([institutionId, undefined]);
        expect([institutionId, patch.subject]).toEqual([
          institutionId,
          `${ID_CARD_SUBJECT_PREFIX}SPCLEP Bragadiru`,
        ]);
      }
    });

    it("never overwrites an institution the document already has", () => {
      // Write-if-empty, exactly like every other field here: a person who set
      // the institution on the document form outranks a card read afterwards.
      const patch = documentFieldsFromIdCard(
        { ...FULL_CARD, institutionId: CHOSEN },
        { institutionId: "99999999-8888-7777-6666-555555555555" },
      );
      expect(patch.institutionId).toBeUndefined();
    });

    it("writes NOTHING when the document already holds the same institution", () => {
      // ⚠️ **The second review round's finding, and it is the ordinary second
      // pass over one document.** Click once: the FK is written. Click again:
      // the matcher now HITS that row, so `card.institutionId` equals
      // `current.institutionId`, the FK arm is blocked by write-if-empty — and
      // the first version of the fallback then wrote "Eliberată de SPCLEP
      // Bragadiru" into `subject` beside the institution it duplicates, and
      // reported "1 field written". Blocked because the fact is ALREADY THERE
      // is not the same as blocked because it went somewhere else.
      const patch = documentFieldsFromIdCard(
        { ...FULL_CARD, institutionId: CHOSEN },
        { institutionId: CHOSEN },
      );
      expect(patch.institutionId).toBeUndefined();
      expect(patch.subject).toBeUndefined();
      // nrDocument, dateDocument, dateValidUntil, title — and neither an
      // institution nor a subject, which is one field fewer than any other
      // outcome for this card.
      expect(idCardDocumentFieldCount(patch)).toBe(4);
      expect(idCardDocumentFieldCount(documentFieldsFromIdCard(FULL_CARD, {}))).toBe(5);
    });

    it("keeps the reading as prose when the FK arm is blocked", () => {
      // ⚠️ **The information-loss case a review round found in the first
      // version.** It was a plain `if / else if`, so a document that already
      // had a DIFFERENT institution took the first arm, wrote nothing, and
      // never reached the fallback — the authority the card named vanished,
      // with the dialog's preview having just shown it. Blocked for either
      // reason, the prose is written.
      const patch = documentFieldsFromIdCard(
        { ...FULL_CARD, institutionId: CHOSEN },
        { institutionId: "99999999-8888-7777-6666-555555555555" },
      );
      expect(patch.subject).toBe(`${ID_CARD_SUBJECT_PREFIX}SPCLEP Bragadiru`);

      // …unless the document's own subject already says something, which is
      // the same write-if-empty rule one field over.
      const filled = documentFieldsFromIdCard(
        { ...FULL_CARD, institutionId: CHOSEN },
        { institutionId: "99999999-8888-7777-6666-555555555555", subject: "Ceva scris de om" },
      );
      expect(filled.subject).toBeUndefined();
      expect(filled.institutionId).toBeUndefined();
    });

    it("counts as a document field, so the dialog reports it", () => {
      const patch = documentFieldsFromIdCard({ ...FULL_CARD, institutionId: CHOSEN }, {});
      expect(idCardDocumentFieldCount(patch)).toBe(
        idCardDocumentFieldCount(documentFieldsFromIdCard(FULL_CARD, {})),
      );
    });
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

  it("targets institutionId only when somebody handed it one", () => {
    // ⚠️ **The title of this assertion used to be "does not target
    // institutionId (an FK that would mean auto-creating rows)", and #34.02
    // changed what is true underneath it.** The reason has not changed — this
    // module still never RESOLVES an authority and never creates a row — but
    // the conclusion has: a person picks the row in the review dialog and the
    // id arrives on `card`. Left as it was, the assertion would have gone on
    // passing (FULL_CARD carries no id) while asserting the opposite of the
    // shipped behaviour, which a review round called out.
    const patch = documentFieldsFromIdCard(FULL_CARD, {}) as Record<string, unknown>;
    expect(patch.institutionId).toBeUndefined();
    const chosen = documentFieldsFromIdCard(
      { ...FULL_CARD, institutionId: "11111111-2222-3333-4444-555555555555" },
      {},
    ) as Record<string, unknown>;
    expect(chosen.institutionId).toBe("11111111-2222-3333-4444-555555555555");
  });
});

/**
 * Slice #34.13 — WHICH number reaches „Nr. document".
 *
 * The extraction contract returns two, and until this slice the mapping read
 * the wrong one — `idCardNumber`, the SECONDARY number printed only when it
 * differs from the series, and therefore `null` on most cards. The field is
 * write-if-empty, so whichever number lands first is the one the document
 * keeps for good; that is what made the wrong choice permanent and what makes
 * these assertions worth having in both directions.
 *
 * `CARTE_IDENTITATE`'s „Nr. document" label in `type-config.ts` is only true
 * while the first assertion here holds — `document.test.ts` pins the label,
 * this suite pins the column, and the two must move together.
 */
describe("documentFieldsFromIdCard — which of the card's two numbers", () => {
  it("takes the series+number when the card prints both, and they differ", () => {
    const patch = documentFieldsFromIdCard(
      { idDocumentNumber: "RT123456", idCardNumber: "ZZ 123456" },
      {},
    );
    expect(patch.nrDocument).toBe("RT123456");
  });

  it("falls back to the secondary number when there is no series+number", () => {
    // The stated fallback, not an accident of ordering: a card with no
    // series+number still has a number printed on it, and an empty
    // „Nr. document" is worse than the one it actually carries.
    expect(
      documentFieldsFromIdCard({ idCardNumber: "ZZ 123456" }, {}).nrDocument,
    ).toBe("ZZ 123456");
    expect(
      documentFieldsFromIdCard({ idDocumentNumber: null, idCardNumber: "ZZ 123456" }, {}).nrDocument,
    ).toBe("ZZ 123456");
    expect(
      documentFieldsFromIdCard({ idDocumentNumber: "   ", idCardNumber: "ZZ 123456" }, {}).nrDocument,
    ).toBe("ZZ 123456");
  });

  it("writes nothing when the card prints neither", () => {
    expect(documentFieldsFromIdCard({ lastName: "Popescu" }, {}).nrDocument).toBeUndefined();
  });

  it("trims whichever one it takes", () => {
    expect(
      documentFieldsFromIdCard({ idDocumentNumber: "  RT123456 " }, {}).nrDocument,
    ).toBe("RT123456");
    expect(
      documentFieldsFromIdCard({ idCardNumber: " ZZ 123456  " }, {}).nrDocument,
    ).toBe("ZZ 123456");
  });

  it("is still write-if-empty — the preference never overwrites", () => {
    // The whole reason the choice had to be corrected rather than left: this
    // guard is what makes the first number permanent, so a document already
    // carrying the secondary one keeps it and is not rewritten here.
    const patch = documentFieldsFromIdCard(FULL_CARD, { nrDocument: "ZZ 123456" });
    expect(patch.nrDocument).toBeUndefined();
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
    expect(patch.nrDocument).toBe("RT123456");
  });

  it("treats a whitespace-only card value as absent", () => {
    // BOTH numbers, because either one alone would be enough to fill the field
    // and a card with one blank is the fallback case, not this one.
    const patch = documentFieldsFromIdCard(
      { ...FULL_CARD, idDocumentNumber: "  ", idCardNumber: "  " },
      {},
    );
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
    expect(patch.nrDocument).toBe("RT123456");
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
    // it in #23.01) nor from auto-creation — ⚠️ **and the REASON changed in
    // Slice #29.07.** Until then the resolver slugged a key from the label, so
    // it could never produce this one; now it offers the canonical key, but
    // only one `canonicalTypeKey` accepts, and this is not in the catalogue.
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
