/**
 * What the result screen SAYS a run did.   (Slice #26.10)
 *
 * The screen stopped offering buttons and started making claims, and a claim
 * about the database is a different kind of thing from a button: a button that
 * is wrong does nothing, and a sentence that is wrong is believed. So the rule
 * behind every sentence lives in `import-outcome.ts` and this suite is what
 * holds it to what actually happened.
 *
 * Four things go silently wrong here, and there is a section for each:
 *
 *  1. **The order.** The coordinate file is listed first because creating the
 *     Property from it is the first thing that happened — but PER PROPERTY
 *     FOLDER. A global hoist reads as correct on a one-property run and is
 *     wrong on every real one.
 *  2. **The notes.** Five states for one identity card and three for one
 *     coordinate file, and two of them are the difference between "a person was
 *     created" and "nobody was".
 *  3. **The statistics.** A concluding message is the last thing a user reads
 *     before walking away, so a count that is quietly too high is the most
 *     expensive number in the application.
 *  4. **The copy.** `DEFAULT_LOCALE` is `ro-RO`, so a missing key does not fall
 *     back to English — it renders the raw key path into the shipping UI. And a
 *     key left behind after the thing that drew it was deleted is the standing
 *     #26.02 rule this file also enforces.
 *
 * Nothing here renders React. The components are not testable in this suite and
 * that is exactly why the reasoning was moved out of them.
 */

import fs from "node:fs";
import path from "node:path";

import {
  OUTCOME_NOTE_IDS,
  SUMMARY_LINE_IDS,
  awaitsRefill,
  coordinateNote,
  idCardNote,
  inResultOrder,
  outcomeNotes,
  readSkipNote,
  refillNote,
  runLandedSomething,
  summariseImportRun,
  summaryLines,
  typeFormNote,
  type OutcomeRow,
  type RefillState,
  type SummaryRow,
} from "@/lib/import/import-outcome";
import { scanIcu } from "@/test-support/icu";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

function loadMessages(file: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as Record<string, unknown>;
}

function at(node: unknown, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (n, part) =>
        n !== null && typeof n === "object" ? (n as Record<string, unknown>)[part] : undefined,
      node,
    );
}

/** A settled, ordinary row: imported, nothing special about it. */
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

// ---------------------------------------------------------------------------
// 1. The order
// ---------------------------------------------------------------------------

type OrderFixture = { path: string; pathParts: string[]; isCoordinate: boolean };

const file = (p: string, isCoordinate = false): OrderFixture => ({
  path: p,
  pathParts: p.split("/").slice(0, -1),
  isCoordinate,
});

const read = (f: OrderFixture) => ({
  pathParts: f.pathParts,
  isCoordinate: f.isCoordinate,
});

describe("inResultOrder", () => {
  it("puts a property folder's coordinate file at the head of its own block", () => {
    const rows = [
      file("47per2/contract.pdf"),
      file("47per2/plan.jpg"),
      file("47per2/coord 47per2.txt", true),
    ];
    expect(inResultOrder(rows, read).map((r) => r.path)).toEqual([
      "47per2/coord 47per2.txt",
      "47per2/contract.pdf",
      "47per2/plan.jpg",
    ]);
  });

  it("⚠️ hoists per folder, never once for the whole table", () => {
    // The failure this pins: a run imports up to five properties, and a single
    // global hoist puts five coordinate files at the top followed by five
    // folders' worth of documents — so no row sits beside the Property it
    // belongs to, which is the one thing the ordering exists to arrange.
    const rows = [
      file("47per2/contract.pdf"),
      file("47per2/coord a.txt", true),
      file("225per3/deed.pdf"),
      file("225per3/coord b.txt", true),
    ];
    expect(inResultOrder(rows, read).map((r) => r.path)).toEqual([
      "47per2/coord a.txt",
      "47per2/contract.pdf",
      "225per3/coord b.txt",
      "225per3/deed.pdf",
    ]);
  });

  it("keeps the walk's own order everywhere else, and the folders' first-seen order", () => {
    const rows = [
      file("common/hotarare.pdf"),
      file("47per2/a.pdf"),
      file("floating/x.pdf"),
      file("47per2/b.pdf"),
    ];
    // `common` was seen first, so it stays first; the two 47per2 rows keep
    // their relative order although another folder came between them.
    expect(inResultOrder(rows, read).map((r) => r.path)).toEqual([
      "common/hotarare.pdf",
      "47per2/a.pdf",
      "47per2/b.pdf",
      "floating/x.pdf",
    ]);
  });

  it("groups the chosen folder's own loose files under one key rather than dropping them", () => {
    // `pathParts` is empty for a file lying at the root of the chosen folder.
    // An `undefined` key would be a different group per row in a Map that
    // stringifies it, which is harmless, and a crash if it were ever indexed.
    const rows = [file("loose.pdf"), file("47per2/a.pdf"), file("other.pdf")];
    expect(inResultOrder(rows, read).map((r) => r.path)).toEqual([
      "loose.pdf",
      "other.pdf",
      "47per2/a.pdf",
    ]);
  });

  it("returns every row it was given, exactly once", () => {
    const rows = [
      file("47per2/a.pdf"),
      file("47per2/coord.txt", true),
      file("225per3/b.pdf"),
      file("c.pdf"),
    ];
    const out = inResultOrder(rows, read);
    expect(out).toHaveLength(rows.length);
    expect(new Set(out.map((r) => r.path)).size).toBe(rows.length);
  });

  it("is a no-op on an empty table", () => {
    expect(inResultOrder([], read)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. The notes
// ---------------------------------------------------------------------------

describe("coordinateNote", () => {
  it("says which Property the corners built, and how many", () => {
    expect(
      coordinateNote(row({ isCoordinate: true, cornerPropertyCode: "PROP-AA", cornerCount: 4 })),
    ).toEqual({ id: "coordinateApplied", values: { code: "PROP-AA", count: 4 } });
  });

  it("says the corners were NOT taken up when this file built nothing", () => {
    // Absent from `cornerSourceByPath` covers three states — the Property had
    // corners already, the file parsed to none, the folder had none — and none
    // of the three is an error. One sentence, because the user's next action is
    // the same in all of them: nothing.
    expect(coordinateNote(row({ isCoordinate: true }))).toEqual({
      id: "coordinateNotApplied",
      values: {},
    });
  });

  it("says nothing at all about a file that is not coordinate-named", () => {
    expect(coordinateNote(row({ cornerPropertyCode: "PROP-AA" }))).toBeNull();
  });

  it("⚠️ is still said on a row the archive already held", () => {
    // The claim is about the CORNERS, which the property step wrote before this
    // run created or declined to create any document. Suppressing it would
    // leave a coordinate file that genuinely built the Property saying only
    // "already in the system".
    expect(
      coordinateNote(
        row({ isCoordinate: true, preexisting: "linked", cornerPropertyCode: "PROP-AB", cornerCount: 6 }),
      ),
    ).toEqual({ id: "coordinateApplied", values: { code: "PROP-AB", count: 6 } });
  });

  it("makes no claim about a row that never reached the archive", () => {
    expect(
      coordinateNote(row({ status: "error", isCoordinate: true, cornerPropertyCode: "PROP-AA" })),
    ).toBeNull();
    expect(coordinateNote(row({ status: "importing", isCoordinate: true }))).toBeNull();
  });
});

describe("idCardNote", () => {
  const card = (patch: Partial<OutcomeRow> = {}) => row({ isIdCard: true, ...patch });

  it("says a person was CREATED — the source document's own sentence", () => {
    expect(idCardNote(card({ personId: "p1", personCreated: true }))).toEqual({
      id: "personCreated",
      values: {},
    });
  });

  it("says the person was already here when nothing was created", () => {
    // ⚠️ The distinction the row discarded until this slice. Telling a user a
    // person was created when one was merely matched is how a duplicate person
    // gets created by hand next time, to "fix" a creation that never happened.
    expect(idCardNote(card({ personId: "p1", personCreated: false }))).toEqual({
      id: "personConfirmed",
      values: {},
    });
  });

  it("distinguishes not-asked-yet from asked-and-declined", () => {
    expect(idCardNote(card())).toEqual({ id: "personPending", values: {} });
    expect(idCardNote(card({ personDeclined: true }))).toEqual({
      id: "personDeclined",
      values: {},
    });
  });

  it("says why a card in a shared folder produced no person", () => {
    // Not a failure: the person flow writes to ONE Property, a `common` card
    // concerns several and a `floating` one none. Since #26.09 such a card is
    // read by the model instead, so the row already carries a field count —
    // what was missing was any sentence saying why the person half did not
    // happen.
    expect(idCardNote(card({ canLinkPerson: false }))).toEqual({
      id: "personNoProperty",
      values: {},
    });
  });

  it("⚠️ keeps a card whose READ failed apart from one whose image would not open", () => {
    // A third adversarial round caught the two being merged. The first means
    // the image could not be prepared, so the question was never put and no
    // control can offer it; the second means the question WAS put and a 429, a
    // 5xx or a timeout answered it, with the image fine and the step still in
    // the queue. Telling a user their scan could not be prepared, when the
    // model was merely busy, sends them to re-scan a perfectly good file.
    expect(idCardNote(card({ personStepUnfinished: true }))).toEqual({
      id: "personStepUnfinished",
      values: {},
    });
    expect(idCardNote(card({ personFileUnreadable: true }))).toEqual({
      id: "personUnreadable",
      values: {},
    });
    // …and a read that failed does not stop the row saying so once the person
    // has been created on a later attempt.
    expect(idCardNote(card({ personStepUnfinished: true, personId: "p1", personCreated: true }))).toEqual(
      { id: "personCreated", values: {} },
    );
  });

  it("keeps an unreadable image apart from a decline", () => {
    // Opposite remedies: a decline is the user's answer and re-offering it is
    // nagging; this is the run failing to ask, and the file needs looking at.
    expect(idCardNote(card({ personFileUnreadable: true }))).toEqual({
      id: "personUnreadable",
      values: {},
    });
  });

  it("prefers what HAPPENED over what failed earlier", () => {
    // A card whose first image failed and whose person was then created by the
    // header's own control must say the person exists.
    expect(
      idCardNote(card({ personFileUnreadable: true, personId: "p1", personCreated: true })),
    ).toEqual({ id: "personCreated", values: {} });
  });

  it("says nothing on a row that is not a card, or that did not finish", () => {
    expect(idCardNote(row({ personId: "p1" }))).toBeNull();
    expect(idCardNote(card({ status: "error" }))).toBeNull();
    expect(idCardNote(card({ preexisting: "linked" }))).toBeNull();
  });
});

describe("readSkipNote", () => {
  it("names both reasons the run did not read a document", () => {
    expect(readSkipNote(row({ readSkipped: "id-card" }))).toEqual({
      id: "readSkippedIdCard",
      values: {},
    });
    expect(readSkipNote(row({ readSkipped: "no-page" }))).toEqual({
      id: "readSkippedNoPage",
      values: {},
    });
  });

  it("says nothing about a document that WAS read", () => {
    expect(readSkipNote(row())).toBeNull();
  });
});

describe("outcomeNotes", () => {
  it("draws the corners, the person and the skipped read in that order", () => {
    const notes = outcomeNotes(
      row({
        isCoordinate: true,
        cornerPropertyCode: "PROP-AA",
        cornerCount: 3,
        isIdCard: true,
        personId: "p1",
        personCreated: true,
        readSkipped: "id-card",
      }),
    );
    expect(notes.map((n) => n.id)).toEqual([
      "coordinateApplied",
      "personCreated",
      "readSkippedIdCard",
    ]);
  });

  it("is empty on an ordinary document the model read", () => {
    expect(outcomeNotes(row())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2b. The type's form   (Slice #27.05)
// ---------------------------------------------------------------------------

describe("what the row says about the document TYPE's form", () => {
  const row = (over: Partial<OutcomeRow> = {}): OutcomeRow => ({
    status: "done",
    isCoordinate: false,
    cornerPropertyCode: null,
    cornerCount: 0,
    isIdCard: false,
    canLinkPerson: false,
    ...over,
  });

  it("says the type is waiting when the loop marked it", () => {
    expect(typeFormNote(row({ typeFormMissing: true }))).toEqual({
      id: "typeFormPending",
      values: {},
    });
  });

  it("says nothing at all about a type that has a form", () => {
    expect(typeFormNote(row())).toBeNull();
  });

  it("⚠️ stops saying 'waiting' the moment the user accepts a form", () => {
    // The row has to stop drawing the old sentence over a decision it has just
    // watched them take. Both flags at once is the shape a partial update
    // leaves behind, and the newer one wins.
    expect(typeFormNote(row({ typeFormMissing: true, typeFormAdded: true }))).toEqual({
      id: "typeFormAdded",
      values: {},
    });
    expect(typeFormNote(row({ typeFormAdded: true }))).toEqual({
      id: "typeFormAdded",
      values: {},
    });
  });

  it("makes no claim about a row the archive already held, or one still running", () => {
    expect(typeFormNote(row({ typeFormMissing: true, preexisting: "linked" }))).toBeNull();
    expect(typeFormNote(row({ typeFormMissing: true, status: "error" }))).toBeNull();
    expect(typeFormNote(row({ typeFormMissing: true, status: "importing" }))).toBeNull();
  });

  it("is drawn last, after everything about the document itself", () => {
    const notes = outcomeNotes(
      row({ isIdCard: true, canLinkPerson: true, personId: "p1", typeFormMissing: true }),
    );
    expect(notes.map((n) => n.id)).toEqual(["personConfirmed", "typeFormPending"]);
  });

  it("⚠️ counts TYPES, not rows", () => {
    // Thirty documents of one new type are one type waiting for a form. The
    // number under the heading is the one a user decides by.
    const of = (documentTypeId: string): SummaryRow => ({
      ...row({ typeFormMissing: true }),
      documentTypeId,
    });
    expect(
      summariseImportRun([of("t1"), of("t1"), of("t1"), of("t2")], 0).typesWithoutForm,
    ).toBe(2);
  });

  it("stops counting a type once its form is accepted", () => {
    const accepted: SummaryRow = {
      ...row({ typeFormMissing: true, typeFormAdded: true }),
      documentTypeId: "t1",
    };
    expect(summariseImportRun([accepted], 0).typesWithoutForm).toBe(0);
  });

  it("over-counts rather than under-counts a row with no type id", () => {
    // Under-counting here would tell the user there is nothing left to do.
    const anonymous: SummaryRow = row({ typeFormMissing: true });
    expect(summariseImportRun([anonymous, anonymous], 0).typesWithoutForm).toBe(2);
  });

  it("counts nothing from a row that never reached the archive", () => {
    const failed: SummaryRow = { ...row({ typeFormMissing: true, status: "error" }), documentTypeId: "t1" };
    expect(summariseImportRun([failed], 0).typesWithoutForm).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2c. Reading the documents that came before the form   (Slice #27.06)
// ---------------------------------------------------------------------------

describe("what the row says about being read again", () => {
  const row = (over: Partial<OutcomeRow> = {}): OutcomeRow => ({
    status: "done",
    isCoordinate: false,
    cornerPropertyCode: null,
    cornerCount: 0,
    isIdCard: false,
    canLinkPerson: false,
    ...over,
  });

  it("says which of the four settled positions the row is in", () => {
    expect(refillNote(row({ refill: "pending" }))?.id).toBe("refillPending");
    expect(refillNote(row({ refill: "done" }))?.id).toBe("refillDone");
    expect(refillNote(row({ refill: "failed" }))?.id).toBe("refillFailed");
    expect(refillNote(row({ refill: "retyped" }))?.id).toBe("refillRetyped");
  });

  it("⚠️ never calls a re-typed read a plain success", () => {
    // The read happened and was paid for, and the values it wrote were keyed by
    // the form of the type the document was on when the call was made — so on a
    // document the same call moved elsewhere they reach no column the new form
    // renders. Drawn as `refillDone` this was an emerald tick on the one
    // document the walk achieved nothing for, filed permanently in the report.
    expect(refillNote(row({ refill: "retyped" }))?.id).not.toBe("refillDone");
  });

  it("⚠️ says NOTHING while the call is in flight", () => {
    // The status cell is blinking "se citește din nou" at that moment. A note
    // beside it saying the document is *waiting* to be read again is the screen
    // a beat behind itself, and it is the state the row spends longest in.
    expect(refillNote(row({ refill: "running" }))).toBeNull();
  });

  it("says nothing at all about a row nothing queued", () => {
    expect(refillNote(row())).toBeNull();
  });

  it("makes no claim about a row the archive already held, or one still running", () => {
    // A pre-existing row is a document from an EARLIER run, which #27.06 puts
    // out of scope in as many words — the same carve-out the two notes above it
    // make, for the same reason.
    expect(refillNote(row({ refill: "pending", preexisting: "linked" }))).toBeNull();
    expect(refillNote(row({ refill: "pending", status: "error" }))).toBeNull();
    expect(refillNote(row({ refill: "pending", status: "importing" }))).toBeNull();
  });

  it("is drawn last, after what the form did to the TYPE", () => {
    // The two are one sentence read in order: the type gained a form, and then
    // this document was read again against it.
    const notes = outcomeNotes(row({ typeFormAdded: true, refill: "done" }));
    expect(notes.map((n) => n.id)).toEqual(["typeFormAdded", "refillDone"]);
  });

  /**
   * ⚠️ **The predicate the offer, the button's number and the walk all read.**
   *
   * This is `canRetryReads`'s lesson applied before it can be learnt again: a
   * header that offers "read 6 documents again" over a walk that finds five is
   * a control whose count never reaches zero, so it goes on offering itself for
   * the life of the dialog. Every case below is a way the two could have come
   * apart.
   */
  describe("awaitsRefill", () => {
    it("takes the two positions that still owe a read", () => {
      expect(awaitsRefill(row({ refill: "pending" }))).toBe(true);
      // ⚠️ `failed` is IN. A rate limit at document twelve of forty is this
      // run's commonest failure; dropping its casualties would rebuild the dead
      // end #26.09 opened the retry to close. Pressing again is a person's
      // decision against a sentence that prices it, not a loop.
      expect(awaitsRefill(row({ refill: "failed" }))).toBe(true);
    });

    it("takes none of the three that do not", () => {
      expect(awaitsRefill(row({ refill: "running" }))).toBe(false);
      expect(awaitsRefill(row({ refill: "done" }))).toBe(false);
      expect(awaitsRefill(row())).toBe(false);
    });

    it("⚠️ does NOT re-offer a read that re-typed the document", () => {
      // A second call would re-classify it the same way and charge again. It is
      // still outstanding — see the summary count below — but the remedy is a
      // person opening the document, not this button.
      expect(awaitsRefill(row({ refill: "retyped" }))).toBe(false);
    });

    /**
     * ⚠️ **The two predicates must agree on EVERY term, and two adversarial
     * rounds found them disagreeing in both directions.**
     *
     * The header and the walk read `awaitsRefill`; the row notes, the concluding
     * message and the saved report read `refillNote`. A `docId` term on one and
     * not the other gave, in round one, a row the walk billed and no sentence
     * described, and in round two the mirror: a row counted by the report with
     * the whole header block — sentence and button — never rendered. So the
     * `docId` invariant lives at the set site, and these two ask the same
     * question of the same fields.
     */
    /**
     * ⚠️ **The whole partition, stated as a table, and a third round is why it
     * is not a pair of `if`s.** The first draft asserted "offered ⇒ has a note"
     * and "no note ⇒ not offered" — which are contrapositives, so it asserted
     * one thing twice, and the shape it was written to catch (a note with no
     * control behind it) is one `retyped` now ships DELIBERATELY. A green suite
     * therefore could not tell that shape from an accident. Pinning the exact
     * pair for every state makes a new one impossible to add silently: a sixth
     * `RefillState`, or a change of mind about any of these five, fails here and
     * has to be argued for.
     */
    it("⚠️ pins the whole (offered, note) partition, state by state", () => {
      /**
       * ⚠️ **A `Record` KEYED BY THE UNION, not an array of tuples**, and a
       * fourth round is why. An array literal stays type-correct when a sixth
       * `RefillState` is added, and the loop walks only what is written — so a
       * new state would ship drawing no note, offered by nothing and counted by
       * nothing, on a green suite: the exact "reachable by no control" shape the
       * comments around it were written against. A `Record` over the union fails
       * to compile until the new member is given an answer here.
       */
      const expected: Record<
        NonNullable<RefillState> | "none",
        { offered: boolean; note: string | null }
      > = {
        none: { offered: false, note: null },
        pending: { offered: true, note: "refillPending" },
        running: { offered: false, note: null },
        done: { offered: false, note: "refillDone" },
        failed: { offered: true, note: "refillFailed" },
        // ⚠️ The one intended asymmetry: a note and a count, and no button. The
        // read happened and a second one would re-type it the same way.
        retyped: { offered: false, note: "refillRetyped" },
      };
      for (const [key, { offered, note }] of Object.entries(expected)) {
        const refill = key === "none" ? undefined : (key as RefillState);
        const r = row({ refill });
        expect(awaitsRefill(r)).toBe(offered);
        expect(refillNote(r)?.id ?? null).toBe(note);
      }
    });

    it("⚠️ refuses the same contexts `refillNote` is silent about", () => {
      // The terms that are NOT about the queue position. These two must not
      // drift: `awaitsRefill` grew them precisely because a first draft had a
      // term `refillNote` could not have, and the pair disagreed in both
      // directions across two rounds.
      for (const over of [
        { status: "error" as const },
        { status: "importing" as const },
        { status: "pending" as const },
        { preexisting: "linked" as const },
        { preexisting: "skipped" as const },
      ]) {
        for (const refill of ["pending", "failed", "retyped", "done"] as const) {
          const r = row({ refill, ...over });
          expect(awaitsRefill(r)).toBe(false);
          expect(refillNote(r)).toBeNull();
        }
      }
    });
  });

  /**
   * ⚠️ **The concluding message has to keep saying it after the header stops.**
   *
   * `typesWithoutForm` counts a type only while `typeFormMissing` is set, and
   * accepting the form clears that flag on every row of the type at once — so
   * the moment a user reviews a form for forty documents that line goes to zero
   * and `summaryLines` drops it. The re-read queue lives in the dialog's state
   * and dies with it. Without a line of its own, the last screen of the wizard
   * tells a user who never pressed the button that there was nothing left.
   */
  describe("what the concluding message says about them", () => {
    const srow = (over: Partial<SummaryRow> = {}): SummaryRow => ({ ...row(), ...over });

    it("counts every document whose information is still in Notes", () => {
      const summary = summariseImportRun(
        [
          srow({ refill: "pending", typeFormAdded: true }),
          srow({ refill: "failed", typeFormAdded: true }),
          // ⚠️ Counted although the button will not touch it: the read happened
          // and the columns are still empty. Dropping it would let the run
          // conclude that everything landed.
          srow({ refill: "retyped", typeFormAdded: true }),
          srow({ refill: "done", typeFormAdded: true }),
          srow({ typeFormAdded: true }),
        ],
        0,
      );
      expect(summary.documentsAwaitingRefill).toBe(3);
    });

    it("⚠️ survives the acceptance that empties `typesWithoutForm`", () => {
      const accepted = srow({
        typeFormMissing: undefined,
        typeFormAdded: true,
        refill: "pending",
        documentTypeId: "t1",
      });
      const summary = summariseImportRun([accepted, accepted, accepted], 0);
      expect(summary.typesWithoutForm).toBe(0);
      expect(summary.documentsAwaitingRefill).toBe(3);
      // …and it is drawn, where a zero would have been dropped.
      expect(summaryLines(summary).map((l) => l.id)).toContain("documentsAwaitingRefill");
    });

    it("says nothing on a run where every one of them was read again", () => {
      const summary = summariseImportRun([srow({ refill: "done" })], 0);
      expect(summary.documentsAwaitingRefill).toBe(0);
      expect(summaryLines(summary).map((l) => l.id)).not.toContain("documentsAwaitingRefill");
    });

    it("counts nothing from a row that never reached the archive", () => {
      expect(
        summariseImportRun([srow({ refill: "pending", status: "error" })], 0)
          .documentsAwaitingRefill,
      ).toBe(0);
    });

    it("is the last thing the message says", () => {
      // With the other things still outstanding, and after the type-form line,
      // because it is what that one leaves behind.
      expect(SUMMARY_LINE_IDS[SUMMARY_LINE_IDS.length - 1]).toBe("documentsAwaitingRefill");
    });
  });
});

// ---------------------------------------------------------------------------
// 3. The statistics
// ---------------------------------------------------------------------------

const srow = (patch: Partial<SummaryRow> = {}): SummaryRow => ({ ...row(), ...patch });

describe("summariseImportRun", () => {
  it("counts created documents apart from the ones the archive already held", () => {
    const summary = summariseImportRun(
      [
        srow(),
        srow(),
        srow({ preexisting: "linked" }),
        srow({ preexisting: "skipped" }),
        srow({ status: "error" }),
      ],
      2,
    );
    expect(summary.documentsCreated).toBe(2);
    expect(summary.alreadyLinked).toBe(1);
    expect(summary.alreadySkipped).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.properties).toBe(2);
  });

  it("⚠️ counts nothing else about a row that failed", () => {
    // An errored row wrote nothing and read nothing. A first draft folded the
    // tallies in before the status check, so a row that died mid-upload still
    // contributed its scan's field count to "fields filled in by the AI" — a
    // number describing work that did not happen, in the message a user reads
    // on the way out.
    const summary = summariseImportRun(
      [
        srow({
          status: "error",
          isCoordinate: true,
          cornerPropertyCode: "PROP-AA",
          aiProcessed: true,
          aiFieldCount: 9,
          personId: "p1",
          personCreated: true,
        }),
      ],
      1,
    );
    expect(summary).toMatchObject({
      failed: 1,
      documentsCreated: 0,
      coordinateFilesApplied: 0,
      fieldsFilled: 0,
      peopleCreated: 0,
    });
  });

  it("splits people created from people merely matched", () => {
    const summary = summariseImportRun(
      [
        srow({ isIdCard: true, personId: "p1", personCreated: true }),
        srow({ isIdCard: true, personId: "p2", personCreated: false }),
      ],
      1,
    );
    expect(summary.peopleCreated).toBe(1);
    expect(summary.peopleConfirmed).toBe(1);
    expect(summary.cardsUnanswered).toBe(0);
  });

  it("⚠️ counts exactly the cards the result screen's own control can reach", () => {
    // `idCardQueued`, not "is a card with no person", and an adversarial round
    // is why. The two sets differ in BOTH directions, and the header counts the
    // first: a card the run never queued cannot be answered by the button that
    // republishes the queue, so a concluding message that counted it would give
    // a different number for the same question one screen later.
    const summary = summariseImportRun(
      [
        srow({ isIdCard: true, idCardQueued: true }),
        srow({ isIdCard: true, idCardQueued: true, personDeclined: true }),
        // Never queued: no single Property to link to, an image that could not
        // be prepared, no page at all. None of them is waiting for an answer.
        srow({ isIdCard: true, canLinkPerson: false }),
        srow({ isIdCard: true, personFileUnreadable: true }),
        srow({ isIdCard: true, readSkipped: "no-page" }),
      ],
      1,
    );
    expect(summary.cardsUnanswered).toBe(2);
  });

  it("⚠️ gives a card nobody could open a line of its own", () => {
    // The hole an adversarial round found: such a card is never queued (so
    // `cardsUnanswered` misses it), its read is `skipped` (so `documentsUnread`
    // misses it) and it has no person (so `documentsRead` misses it). Five
    // `.tiff` cards produced a concluding message reading "5 documents created"
    // and nothing else, and the only screen that ever named the five missing
    // people was the one the user had just closed.
    const summary = summariseImportRun(
      [srow({ isIdCard: true, personFileUnreadable: true }), srow({ isIdCard: true, personFileUnreadable: true })],
      1,
    );
    expect(summary.cardsUnreadable).toBe(2);
    expect(summary.cardsUnanswered).toBe(0);
    expect(summaryLines(summary).map((l) => l.id)).toContain("cardsUnreadable");
  });

  it("counts what the identity-card step read, not only the generic read", () => {
    // #23.08 moved the card's extraction into the person step precisely because
    // it reads MORE than the generic route. Counting only `aiProcessed` made a
    // run of nothing but identity cards report "0 documents read, 0 fields
    // filled" over a run that was almost entirely model-filled.
    const summary = summariseImportRun(
      [
        srow({ isIdCard: true, idCardQueued: true, personId: "p1", personCreated: true, idCardFieldsWritten: 5 }),
        srow({ aiProcessed: true, aiFieldCount: 2 }),
      ],
      1,
    );
    expect(summary.documentsRead).toBe(2);
    expect(summary.fieldsFilled).toBe(7);
  });

  it("adds up what the reads did and what they left outstanding", () => {
    const summary = summariseImportRun(
      [
        srow({ aiProcessed: true, aiFieldCount: 5, aiPeopleSettled: 2 }),
        srow({ aiProcessed: true, aiFieldCount: 3, aiPeoplePending: 1 }),
        srow({ aiUnread: true }),
      ],
      1,
    );
    expect(summary).toMatchObject({
      documentsRead: 2,
      fieldsFilled: 8,
      peopleFromDocuments: 2,
      peopleUnconfirmed: 1,
      documentsUnread: 1,
    });
  });

  it("counts a coordinate file that built a Property even where the archive held the document", () => {
    const summary = summariseImportRun(
      [srow({ isCoordinate: true, preexisting: "linked", cornerPropertyCode: "PROP-AA" })],
      1,
    );
    expect(summary.coordinateFilesApplied).toBe(1);
    expect(summary.documentsCreated).toBe(0);
  });

  it("says zero for a run that did nothing, rather than throwing", () => {
    const summary = summariseImportRun([], 0);
    expect(summary.documentsCreated).toBe(0);
    expect(summary.failed).toBe(0);
  });
});

describe("summaryLines", () => {
  it("⚠️ always says how many documents were created, even when none were", () => {
    // The shape where this line is missing entirely is the shape where a user
    // walks away believing the import worked.
    const lines = summaryLines(summariseImportRun([srow({ status: "error" })], 0));
    expect(lines.map((l) => l.id)).toContain("documentsCreated");
    expect(lines.find((l) => l.id === "documentsCreated")?.value).toBe(0);
  });

  it("drops every other zero", () => {
    const lines = summaryLines(summariseImportRun([srow(), srow()], 0));
    expect(lines.map((l) => l.id)).toEqual(["documentsCreated"]);
  });

  it("keeps the catalogue's own order", () => {
    const summary = summariseImportRun(
      [srow({ status: "error" }), srow({ isIdCard: true, personId: "p1", personCreated: true })],
      3,
    );
    const ids = summaryLines(summary).map((l) => l.id);
    const positions = ids.map((id) => SUMMARY_LINE_IDS.indexOf(id));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

// ---------------------------------------------------------------------------
// 4. The copy
// ---------------------------------------------------------------------------

describe("the result screen's copy", () => {
  it.each(LOCALES)("%s translates every note id", (locale) => {
    const messages = loadMessages(locale);
    for (const id of OUTCOME_NOTE_IDS) {
      const value = at(messages, `adminImport.wizard.importDialog.note.${id}`);
      expect(typeof value).toBe("string");
      expect((value as string).trim()).not.toBe("");
    }
  });

  it.each(LOCALES)("%s translates every summary line id", (locale) => {
    const messages = loadMessages(locale);
    for (const id of SUMMARY_LINE_IDS) {
      const value = at(messages, `adminImport.result.summary.${id}`);
      expect(typeof value).toBe("string");
      expect((value as string).trim()).not.toBe("");
    }
  });

  it.each(LOCALES)("%s carries every other key the result screen asks for", (locale) => {
    const messages = loadMessages(locale);
    const keys = [
      "title",
      "intro",
      "statsTitle",
      "invitation",
      "closeButton",
      "saveButton",
      "saveHint",
      "saveDone",
      "reportTitle",
      "reportGenerated",
      "reportFolder",
      "reportSummaryTitle",
      "reportPropertiesTitle",
      "reportNoProperties",
      "reportFilePrefix",
      "reportRowImported",
      "reportRowFailed",
    ];
    for (const key of keys) {
      expect(typeof at(messages, `adminImport.result.${key}`)).toBe("string");
    }
    expect(typeof at(messages, "adminImport.wizard.importDialog.colOutcome")).toBe("string");
  });

  it.each(LOCALES)("%s interpolates exactly what the code passes", (locale) => {
    const messages = loadMessages(locale);
    // `coordinateApplied` is the only note with placeholders, and both of them
    // come from `coordinateNote`'s `values`. A message asking for an argument
    // nobody passes renders the raw name; one that ignores an argument silently
    // drops the number it was written to show.
    const applied = at(
      messages,
      "adminImport.wizard.importDialog.note.coordinateApplied",
    ) as string;
    expect([...scanIcu(applied).args].sort()).toEqual(["code", "count"]);

    for (const id of OUTCOME_NOTE_IDS.filter((i) => i !== "coordinateApplied")) {
      const message = at(messages, `adminImport.wizard.importDialog.note.${id}`) as string;
      expect([...scanIcu(message).args]).toEqual([]);
    }

    expect([...scanIcu(at(messages, "adminImport.result.intro") as string).args]).toEqual([
      "folder",
    ]);
    expect([
      ...scanIcu(at(messages, "adminImport.result.reportRowFailed") as string).args,
    ]).toEqual(["reason"]);
  });

  /**
   * The header sentences #27.05 added, which nothing else in this file walks.
   *                                                              (Slice #27.05)
   *
   * ⚠️ **The note and summary catalogues are pinned by the two tests above
   * because they have ID CONSTANTS to walk; these have none**, and an
   * adversarial round pointed out what that leaves open: delete the `few` arm
   * from one of the four Romanian plurals and both suites stay green while
   * `DEFAULT_LOCALE` — which is `ro-RO` — renders the raw key path, or throws,
   * on the one screen a business user reads to find out what the system just
   * did to their archive. Romanian needs one/few/other; English needs one/other.
   */
  it.each(LOCALES)("%s carries every sentence the type-form header draws", (locale) => {
    const messages = loadMessages(locale);
    const plural = ["one", "few", "other"];
    for (const key of [
      "doneTypesNoForm",
      "doneTypesNoFormWaiting",
      "doneTypesNoFormLocked",
      "doneTypesNoFormNothing",
    ]) {
      const value = at(messages, `adminImport.wizard.importDialog.${key}`) as string;
      expect(typeof value).toBe("string");
      // The count is the only argument the four call sites pass.
      expect([...scanIcu(value).args]).toEqual(["count"]);
      const needed = locale === "ro-RO.json" ? plural : ["one", "other"];
      for (const form of needed) expect(value).toContain(`${form} {`);
    }
    for (const key of ["reviewTypesButton", "typeListUnavailable", "importStartFailed"]) {
      const value = at(messages, `adminImport.wizard.importDialog.${key}`) as string;
      expect(typeof value).toBe("string");
      expect(value.trim()).not.toBe("");
      expect([...scanIcu(value).args]).toEqual([]);
    }
    // The five endings of #27.04's new-type path, as the IMPORT dialog words
    // them — each names the type it left on the server, and nothing else.
    for (const key of [
      "typeNewTypeNoFields",
      "typeNewTypeNotMoved",
      "typeNewTypeMoveUnknown",
      "typeNewTypeFieldsUnknown",
      "typeNewTypeUnresolved",
    ]) {
      const value = at(messages, `adminImport.wizard.importDialog.${key}`) as string;
      expect(typeof value).toBe("string");
      expect([...scanIcu(value).args]).toEqual(["type"]);
    }
  });

  /**
   * The sentences #27.06 added, pinned by hand for the same reason #27.05's
   * are: there is no id constant to walk, so nothing else in this suite would
   * notice a `few` arm going missing from a Romanian plural — and `ro-RO` is
   * `DEFAULT_LOCALE`, so what a business user then reads is the raw key path.
   */
  it.each(LOCALES)("%s carries every sentence the re-read header draws", (locale) => {
    const messages = loadMessages(locale);
    const plural = ["one", "few", "other"];
    for (const key of ["doneRefill", "doneRefillWaiting", "doneRefillLocked", "refillButton"]) {
      const value = at(messages, `adminImport.wizard.importDialog.${key}`) as string;
      expect(typeof value).toBe("string");
      // The count is the only argument the four call sites pass.
      expect([...scanIcu(value).args]).toEqual(["count"]);
      const needed = locale === "ro-RO.json" ? plural : ["one", "other"];
      for (const form of needed) expect(value).toContain(`${form} {`);
    }
    /**
     * ⚠️ **The offer names BOTH costs, and this is what holds it to that.**
     * #27.06's constraint is that a billed read and a `document_version` row per
     * document are visible BEFORE the click, not discovered after it — so a
     * reword that quietly drops one of the two numbers is a reword that makes
     * the screen ask for money it did not mention. Read on the copy rather than
     * on the code, because the copy is the only place the promise exists.
     */
    const offer = at(messages, "adminImport.wizard.importDialog.doneRefill") as string;
    const cost = locale === "ro-RO.json" ? [/citir/i, /versiu/i] : [/read/i, /version/i];
    for (const term of cost) expect(offer).toMatch(term);

    // The progress line is the one that counts, so it takes two numbers and no
    // plural — it is read while the walk is running and both arms are live.
    const progress = at(messages, "adminImport.wizard.importDialog.refillProgress") as string;
    expect([...scanIcu(progress).args].sort()).toEqual(["done", "total"]);

    const short = at(messages, "adminImport.wizard.importDialog.refillingShort") as string;
    expect(typeof short).toBe("string");
    expect(short.trim()).not.toBe("");
    expect([...scanIcu(short).args]).toEqual([]);

    // ⚠️ **The one new key that is evaluated inside `handleSaveReport`**, and a
    // fifth round caught it as the only one this test skipped. It wraps the
    // route's own text so a bullet reading `HTTP 429` cannot land between two
    // Romanian sentences in the run's durable artefact; a renamed placeholder or
    // a key dropped from one locale would ship green and surface as a raw key
    // path in the saved report, in the shipping locale.
    const detail = at(messages, "adminImport.wizard.importDialog.refillFailedDetail") as string;
    expect(typeof detail).toBe("string");
    expect([...scanIcu(detail).args]).toEqual(["reason"]);
  });

  it.each(LOCALES)("%s no longer carries the keys of the deleted buttons", (locale) => {
    // #26.02's standing rule: delete a thing and its message keys in BOTH
    // locales, in the same commit. These four drew the two row buttons and the
    // dialog behind one of them; a key left behind is harmless to render and
    // corrosive to read, because the next person to reword it cannot tell that
    // nothing draws it.
    const messages = loadMessages(locale);
    for (const gone of [
      "createPersonButton",
      "personLinked",
      "coordinatesButton",
      "coordinates",
      "colAction",
      // …and the sentence the deleted person BUTTON showed when it could not
      // read the file. Its three call sites went with `handleOpenIdCard`; the
      // row now says `note.personUnreadable` instead, and an adversarial round
      // found this one still sitting in both locales with nothing drawing it.
      "idCardNoFile",
    ]) {
      expect(at(messages, `adminImport.wizard.importDialog.${gone}`)).toBeUndefined();
    }
  });

  it("keeps the two locales' note and summary catalogues identical", () => {
    const keysUnder = (locale: string, keyPath: string) =>
      Object.keys((at(loadMessages(locale), keyPath) ?? {}) as Record<string, unknown>).sort();
    for (const keyPath of [
      "adminImport.wizard.importDialog.note",
      "adminImport.result.summary",
    ]) {
      expect(keysUnder("ro-RO.json", keyPath)).toEqual(keysUnder("en-GB.json", keyPath));
    }
    // …and neither locale has grown a note the code cannot draw.
    expect(keysUnder("ro-RO.json", "adminImport.wizard.importDialog.note")).toEqual(
      [...OUTCOME_NOTE_IDS].sort(),
    );
    expect(keysUnder("ro-RO.json", "adminImport.result.summary")).toEqual(
      [...SUMMARY_LINE_IDS].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. The predicate the notes are only as honest as
// ---------------------------------------------------------------------------

describe("which file the result row is allowed to call a coordinate file", () => {
  it("⚠️ asks STR-08's rule, never the extension shortlist", () => {
    // The regression this exists to stop, found by an adversarial round: the
    // deleted BUTTON was gated on `isCoordinateFileName`, the extension
    // shortlist, because a click that did nothing on a stray `notite.txt` cost
    // nothing. The SENTENCE that replaced it costs a great deal — it tells a
    // business user that their page of notes failed to become geometry — and
    // `inResultOrder` would also hoist that file above the folder's real
    // `coord….txt`, destroying the one ordering guarantee this screen makes.
    //
    // Reading the source is the only way to pin it from here; nothing in this
    // suite renders React. It is the same technique `import-preexisting-check`
    // uses to keep the loop's title expression honest.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/admin/import/_components/bulk-import-dialog.tsx"),
      "utf8",
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).toContain("isDeclaredCoordinateFile");
    expect(code).not.toContain("isCoordinateFileName");
    // …and the second half of the rule: a file that ACTUALLY built a Property
    // is the coordinate file whatever it is called, which is a fact from the
    // property step rather than a guess from a name.
    expect(code).toContain("cornerSourceByPath?.has(result.entry.path)");
  });
});

// ---------------------------------------------------------------------------
// 6. Whether there is a conclusion to report at all
// ---------------------------------------------------------------------------

describe("runLandedSomething", () => {
  it("⚠️ counts a failed read as still outstanding, not as unreadable", () => {
    // The image is fine and the step is still in the queue, so the header's own
    // control offers it again — which makes this card exactly as outstanding as
    // one nobody has opened yet, and NOT one nothing can reach.
    const summary = summariseImportRun(
      [srow({ isIdCard: true, idCardQueued: true, personStepUnfinished: true })],
      1,
    );
    expect(summary.cardsUnanswered).toBe(1);
    expect(summary.cardsUnreadable).toBe(0);
  });

  it("⚠️ refuses to conclude a run that wrote nothing", () => {
    // The shape an adversarial round found: every `POST /api/documents` answers
    // 500, the loop completes, and the concluding message told the user the
    // import had finished and invited them to go and check the imported data —
    // then navigated off the wizard, throwing away a metadata pass and a
    // folder's worth of paid Haiku scans.
    const summary = summariseImportRun([srow({ status: "error" }), srow({ status: "error" })], 0);
    expect(runLandedSomething(summary)).toBe(false);
  });

  it("⚠️ DOES conclude when the property step WROTE Properties and every document failed", () => {
    // The term that is easy to leave out. The property step writes each
    // Property before the first document exists, so this run has three real
    // rows in the archive — which is exactly the case where the user most needs
    // sending to look at them.
    expect(runLandedSomething(summariseImportRun([srow({ status: "error" })], 3, 3))).toBe(true);
  });

  it("⚠️ …and does NOT conclude when it only MATCHED them", () => {
    // A third adversarial round found this one. The property step resolves
    // every folder it settles, including ones whose Property already existed
    // and needed nothing — so a second import of that folder, whose documents
    // then all fail, would have announced itself finished, invited the user to
    // go and check the imported data, and navigated off the wizard, throwing
    // away a paid metadata pass and a folder of Haiku scans over a run that
    // wrote nothing at all.
    expect(runLandedSomething(summariseImportRun([srow({ status: "error" })], 3, 0))).toBe(false);
  });

  it("concludes an ordinary run, and one that only linked what was already here", () => {
    expect(runLandedSomething(summariseImportRun([srow()], 0, 0))).toBe(true);
    expect(
      runLandedSomething(summariseImportRun([srow({ preexisting: "linked" })], 0)),
    ).toBe(true);
  });

  it("does not count a document the archive held and nothing was done with", () => {
    // `skip` means there was nothing to attach it to: no link was written, no
    // Property was made. There is nothing new to go and look at.
    expect(
      runLandedSomething(summariseImportRun([srow({ preexisting: "skipped" })], 0)),
    ).toBe(false);
  });
});
