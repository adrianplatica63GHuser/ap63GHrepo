/**
 * What the result screen says about the TYPE a document was filed under.
 *                                                              (Slice #29.06)
 *
 * Two rules live here and both exist because of a silence.
 *
 * `typeFilingNote` is finding F1: a document whose type create lost a race was
 * filed under the catch-all and said nothing, so it read exactly like a
 * document the model could not classify. One of those is a document to look at;
 * the other is a document to look at AND a create to wonder about, and the
 * screen has to be able to tell a business user which he is looking at.
 *
 * `typesCreatedWithNoDocuments` is the narrow half of finding F4: an import
 * invents a type, the AI read of the whole document then concludes something
 * more specific and re-types it — correct behaviour — and the first type is
 * left in Reference Data with no documents, no form, and nothing anywhere that
 * mentions it.
 *
 * Nothing here renders React, for the reason `import-outcome.test.ts` states
 * about itself: the reasoning was moved out of the component precisely so it
 * could be held to what happened.
 */

import {
  outcomeNotes,
  runTypeNotes,
  typeFilingNote,
  typesCreatedWithNoDocuments,
  type OutcomeRow,
} from "@/lib/import/import-outcome";

function row(patch: Partial<OutcomeRow> = {}): OutcomeRow {
  return {
    status: "done",
    isCoordinate: false,
    cornerPropertyCode: null,
    cornerCount: 0,
    isIdCard: false,
    canLinkPerson: true,
    ...patch,
  };
}

describe("typeFilingNote", () => {
  it("says nothing about an ordinary row", () => {
    expect(typeFilingNote(row())).toBeNull();
  });

  it("distinguishes a document nobody could classify from one whose type failed", () => {
    expect(typeFilingNote(row({ typeUnclassified: true }))?.id).toBe("typeUnclassified");
    expect(typeFilingNote(row({ typeCreateFailed: true }))?.id).toBe("typeCreateFailed");
  });

  /**
   * ⚠️ **No producer in the app can set both today — the wizard derives both
   * from one enum — so this pins a PRECEDENCE rather than a reachable state.**
   * A second review round asked whether that makes the test vacuous; it does
   * not, because the precedence is the thing a refactor would pick at random.
   * A row that is both classified and unfiled is coherent, and it must say the
   * actionable thing rather than the merely-true one.
   */
  it("prefers the failed create over the unclassified note, given both", () => {
    expect(
      typeFilingNote(row({ typeUnclassified: true, typeCreateFailed: true }))?.id,
    ).toBe("typeCreateFailed");
  });

  /**
   * ⚠️ **The pre-existing carve-out, which `readSkipNote` and `typeFormNote`
   * both make.** The archive already held the document, so this run neither
   * classified it nor filed it, and a sentence about how it was typed would be
   * a claim about an import that happened months ago.
   */
  it.each([
    ["linked" as const],
    ["skipped" as const],
  ])("says nothing on a %s pre-existing row", (preexisting) => {
    expect(typeFilingNote(row({ preexisting, typeCreateFailed: true }))).toBeNull();
  });

  it.each([
    ["pending" as const],
    ["importing" as const],
    ["error" as const],
  ])("says nothing while the row is %s", (status) => {
    expect(typeFilingNote(row({ status, typeCreateFailed: true }))).toBeNull();
  });

  /**
   * ⚠️ **A DOCUMENT NOTHING CLASSIFIED GETS NEITHER SENTENCE, and a sixth
   * review round found the row saying two contradictory things at once.** A
   * file with no page a model can see is never sent to the classifier, so its
   * type falls to the fallback for want of an answer — and the row drew
   * "nu are nicio pagină pe care AI să o poată citi" immediately followed by
   * "scanarea AI nu a putut stabili ce fel de document este", permanently, in
   * the saved report, on every office file in a folder.
   */
  it("says nothing about a document that has no page to classify", () => {
    expect(typeFilingNote(row({ readSkipped: "no-page", typeUnclassified: true }))).toBeNull();
    expect(typeFilingNote(row({ readSkipped: "no-page", typeCreateFailed: true }))).toBeNull();
    expect(outcomeNotes(row({ readSkipped: "no-page", typeUnclassified: true })).map((n) => n.id))
      .toEqual(["readSkippedNoPage"]);
  });

  /**
   * ⚠️ **An identity card is a different case and keeps its sentence.** Its
   * read was skipped because the type IS known — the scan classified it — so a
   * filing note there would be about something that genuinely happened. In
   * practice a card matches a seeded key and draws neither flag; the guard is
   * narrowed to `no-page` so it cannot silence a case it was not written for.
   */
  it("still speaks about an identity card, whose type the scan did decide", () => {
    expect(typeFilingNote(row({ readSkipped: "id-card", typeCreateFailed: true }))?.id)
      .toBe("typeCreateFailed");
  });

  /**
   * ⚠️ **Before the form note, and the ORDER is the assertion.** One is about
   * which type the document is ON and the other about what that type HAS. In
   * today's code they never both draw — `typeAwaitsForm` excludes the fallback
   * type — but the ordering is what keeps the pair readable the day that stops
   * being true, and an ordering nobody asserts is an ordering a refactor
   * reverses for free.
   */
  it("is drawn ahead of the form note", () => {
    const notes = outcomeNotes(row({ typeCreateFailed: true, typeFormMissing: true }));
    expect(notes.map((n) => n.id)).toEqual(["typeCreateFailed", "typeFormPending"]);
  });
});

describe("typesCreatedWithNoDocuments", () => {
  const created = [
    { id: "a", name: "Contract de arendă" },
    { id: "b", name: "Adeverință" },
  ];

  it("names a created type no row ended up on", () => {
    expect(typesCreatedWithNoDocuments(created, ["a"])).toEqual(["Adeverință"]);
  });

  it("is empty when every created type carries a document", () => {
    expect(typesCreatedWithNoDocuments(created, ["a", "b"])).toEqual([]);
  });

  it("is empty when the run created nothing, whatever the rows say", () => {
    expect(typesCreatedWithNoDocuments([], ["a", "b", "c"])).toEqual([]);
  });

  /**
   * ⚠️ **A type that already existed is nobody's business here.** An empty type
   * Adrian created himself last month is not this run's doing, and reporting it
   * would be the screen inventing work — so a type that appears in NEITHER list
   * is silent, and one that appears in `occupied` but not in `created` is
   * silent too, however empty it may be.
   *
   * (A review round pointed out that the earlier version of this test asserted
   * the happy case and an empty-input case, and left its own title untested.)
   */
  it("never names a type the run did not create", () => {
    const created = [{ id: "mine", name: "Contract de arendă" }];
    // Two types in play that the run did not create — one carrying documents,
    // one carrying none. Neither is named; only the run's own empty one is.
    expect(
      typesCreatedWithNoDocuments(created, ["someone-elses-occupied"]),
    ).toEqual(["Contract de arendă"]);
    expect(typesCreatedWithNoDocuments([], ["someone-elses-occupied"])).toEqual([]);
  });

  it("ignores rows that never reached a type", () => {
    expect(typesCreatedWithNoDocuments(created, [undefined, "b", undefined])).toEqual([
      "Contract de arendă",
    ]);
  });

  /**
   * ⚠️ **Deduped by ID before the names are taken**, the guard
   * `typesThatGainedForm` records for itself: the caller assembles these across
   * a run, and one type recorded twice would be named twice in the sentence.
   */
  it("names a repeated type once", () => {
    expect(
      typesCreatedWithNoDocuments(
        [
          { id: "a", name: "Contract de arendă" },
          { id: "a", name: "Contract de arendă" },
        ],
        [],
      ),
    ).toEqual(["Contract de arendă"]);
  });
});

describe("runTypeNotes and the empty types", () => {
  it("draws nothing when there are none", () => {
    expect(runTypeNotes({ gained: [], withoutForm: [] })).toEqual([]);
    expect(runTypeNotes({ gained: [], withoutForm: [], createdEmpty: [] })).toEqual([]);
  });

  it("draws the sentence last, with the count and the names", () => {
    const notes = runTypeNotes({
      gained: ["Titlu de proprietate"],
      withoutForm: ["Contract de arendă"],
      createdEmpty: ["Adeverință", "Certificat fiscal"],
    });
    expect(notes.map((n) => n.id)).toEqual([
      "typesGainedForm",
      "typesStillWithoutForm",
      "typesCreatedEmpty",
    ]);
    expect(notes[2].values).toEqual({ count: 2, names: "Adeverință, Certificat fiscal" });
  });

  /**
   * ⚠️ **NOT subtracted from the backlog above it, and that is deliberate.** A
   * type nothing was filed under has no form either, so the same name can
   * honestly appear in both sentences — they say different things to the
   * reader: one is work to do, the other is a leftover to decide about.
   * Suppressing either would be the screen choosing which true thing the user
   * is allowed to know.
   */
  it("does not suppress a name that is also in the backlog", () => {
    const notes = runTypeNotes({
      gained: [],
      withoutForm: ["Adeverință"],
      createdEmpty: ["Adeverință"],
    });
    expect(notes.map((n) => n.id)).toEqual(["typesStillWithoutForm", "typesCreatedEmpty"]);
  });
});
