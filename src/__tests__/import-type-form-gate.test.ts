/**
 * Unit tests for src/lib/import/type-form-gate.ts   (Slice #29.08)
 *
 * THE GATE IS THE SLICE, so this file is where the slice is actually pinned.
 * `phaseAfterClassification` turns its verdict into a phase in one line and is
 * tested next door; everything that can go WRONG is here, and every one of
 * these failures is silent:
 *
 *  1. **A type is let through that is waiting for a form.** The import then
 *     creates documents whose type-specific values have nowhere to go, which is
 *     the state this slice exists to make rare.
 *  2. **A type is BLOCKED that is not waiting for one.** Worse in practice: the
 *     import stops, and the user is sent to DocTypeEngine to do something that
 *     is either pointless or actively wrong. The identity card is the case that
 *     makes or breaks this gate — see its own describe block, which is here
 *     because the first draft of the gate got it wrong and shipped a test
 *     pinning the bug.
 *  3. **The gate names a different type from the one the run will file the
 *     document on.** Then the stop screen tells the user to give a form to a
 *     type that is not the one blocking them.
 *
 * ⚠️ **WHAT THIS FILE DOES NOT TEST, SAID PLAINLY BECAUSE AN EARLIER HEADER
 * IMPLIED OTHERWISE.** Every answer below is a hand-built `{ typeKey, label }`
 * literal — the shape `bulk-import-dialog.tsx` feeds `ensureDocType`, but not
 * the same CALL. There is no test here that the gate and the run reach the same
 * conclusion on one input, and there cannot be a cheap one: the run's `create`
 * branch hands the decision to `POST /api/document-types/resolve`, which
 * re-reads the database. What IS guaranteed structurally is that both go
 * through `resolveAgainstTypes` for the match and decline halves, and through
 * `typeAwaitsForm` for the waiting half.
 */

import {
  catalogueIsUsable,
  checkTypeForms,
  noClassificationHappened,
  typesAreClean,
} from "@/lib/import/type-form-gate";
import type {
  ClassifiedEntry,
  DocumentTypeForGate,
} from "@/lib/import/type-form-gate";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A form, as `parseTemplateFields` actually accepts one. */
const FORM = [{ key: "numar", labelRo: "Număr", labelEn: "Number", type: "text" }];

/**
 * ⚠️ **A template that parses to NO usable field, and it is a fixture rather
 * than an edge case.** `documentTypeHasForm` delegates to `parseTemplateFields`
 * precisely so `[{}]` reads as "no form": it renders no inputs and contributes
 * nothing to the extraction prompt. A raw `Array.isArray && length > 0` would
 * call this type finished and let the run through.
 */
const EMPTY_FORM = [{ labelRo: "fără cheie" }];

const CATCH_ALL: DocumentTypeForGate = {
  id: "id-unclassified",
  key: "UNCLASSIFIED",
  name: "NECLASIFICAT",
};

function type(
  id: string,
  key: string,
  name: string,
  templateFields?: unknown,
): DocumentTypeForGate {
  return { id, key, name, templateFields };
}

function entry(
  path: string,
  answer: ClassifiedEntry["answer"],
  isIdCard = false,
  confidence?: ClassifiedEntry["confidence"],
): ClassifiedEntry {
  return { path, answer, isIdCard, confidence };
}

const WITH_FORM = type("id-arenda", "CONTRACT_ARENDA", "Contract de arendă", FORM);
const NO_FORM = type("id-vanzare", "CONTRACT_VANZARE", "Contract de vânzare");
/** The seeded identity card: no form, and that is the correct permanent state. */
const ID_CARD = type("id-ci", "CARTE_IDENTITATE", "Carte de identitate");

const CATALOGUE = [CATCH_ALL, WITH_FORM, NO_FORM, ID_CARD];

// ---------------------------------------------------------------------------

describe("noClassificationHappened", () => {
  it("⚠️ answers true for the two ordinary runs that send no images at all", () => {
    // A folder the archive already holds in its entirety — re-offered to attach
    // it to a new Property, the case #26.08 built `alreadyInSystem.linked` for
    // — and a folder holding nothing a model can read. The caller uses this to
    // skip the catalogue request entirely, because a read there can only
    // produce a reason to stop a run that cannot create a document on any type
    // the classifier named. Without it those runs were refused outright the
    // moment the archive's list was unreachable.
    expect(noClassificationHappened([])).toBe(true);
    expect(noClassificationHappened([entry("a.txt", null), entry("b.docx", null)])).toBe(true);
  });

  it("answers false the moment one entry carries an answer", () => {
    expect(
      noClassificationHappened([
        entry("a.txt", null),
        entry("b.pdf", { typeKey: "CONTRACT_ARENDA", label: "Contract de arendă" }),
      ]),
    ).toBe(false);
  });
});

describe("catalogueIsUsable", () => {
  it("accepts the list the archive actually holds", () => {
    expect(catalogueIsUsable(CATALOGUE)).toBe(true);
  });

  it("⚠️ refuses an empty list rather than reading it as data", () => {
    // `bulk-import-dialog.tsx` states the rule this carries: an empty list is a
    // failed read, not "every type was deleted". Read as data it would make
    // every real label a `create`, so the stop screen would name types that
    // exist and have forms and send the user to build duplicates of them.
    expect(catalogueIsUsable([])).toBe(false);
  });

  it("⚠️ refuses a list with no catch-all row", () => {
    // `fetchDocTypes` throws on exactly this, with a sentence telling Adrian
    // how to put the row back. Without the refusal the gate would answer
    // "carry on" and the RUN would then refuse to start three screens later —
    // the gate answering the question it exists to answer, wrongly and early.
    expect(catalogueIsUsable([WITH_FORM, NO_FORM])).toBe(false);
  });
});

describe("checkTypeForms — Branch A, the run that carries on", () => {
  it("passes a folder whose every type already has a form", () => {
    const verdict = checkTypeForms({
      entries: [
        entry("a.pdf", { typeKey: "CONTRACT_ARENDA", label: "Contract de arendă" }),
        entry("b.pdf", { typeKey: "CONTRACT_ARENDA", label: "Contract de arendă" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.clean).toBe(true);
    expect(verdict.missingForm).toEqual([]);
    expect(verdict.types).toEqual([
      {
        kind: "existing",
        id: "id-arenda",
        name: "Contract de arendă",
        hasForm: true,
        awaitsForm: false,
        documentCount: 2,
        // Slice #32.02 — the whole-object shape, so a field added to
        // `ClassifiedType` cannot slip past this suite unasserted.
        files: [
          { path: "a.pdf", how: "key", said: "CONTRACT_ARENDA", confidence: undefined },
          { path: "b.pdf", how: "key", said: "CONTRACT_ARENDA", confidence: undefined },
        ],
      },
    ]);
  });

  it("⚠️ passes a folder that classified nothing at all", () => {
    // A folder of nothing but unreadable files creates no document on any real
    // type, so there is no type that could be waiting for a form. `clean` is
    // `missingForm.length === 0` and not `types.every(...)` for exactly this:
    // an empty list of types is a clean answer, and it is a real one.
    const verdict = checkTypeForms({
      entries: [entry("scan.tif", null), entry("notes.txt", null)],
      catalogue: CATALOGUE,
    });
    expect(verdict.clean).toBe(true);
    expect(verdict.types).toEqual([]);
    expect(verdict.unclassifiedCount).toBe(2);
  });

  it("⚠️ does not block on a document that will land on the catch-all", () => {
    // `import-outcome.ts` states the rule this follows: a document on the
    // catch-all is not a document whose type lacks a form, it is a document
    // whose type is WRONG. Blocking here would stop every import containing one
    // unreadable page, permanently — DocTypeEngine cannot help, because there
    // is no type to give a form to.
    const verdict = checkTypeForms({
      entries: [
        entry("x.pdf", { typeKey: "UNCLASSIFIED", label: "Document necunoscut" }),
        entry("y.pdf", { typeKey: null, label: "   " }),
        entry("z.pdf", { typeKey: null, label: "—" }),
        entry("w.pdf", { typeKey: null, label: "NECLASIFICAT" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.clean).toBe(true);
    expect(verdict.types).toEqual([]);
    expect(verdict.unclassifiedCount).toBe(4);
  });

  it("⚠️ never reaches the catch-all as a MATCH, whichever way it is named", () => {
    // Why the `fallbackTypeId` term in the gate's `typeAwaitsForm` call cannot
    // currently fire, pinned rather than assumed. `matchDocumentType` refuses
    // the catch-all by key AND refuses any row whose NAME means "unclassified"
    // — an archive really can hold a second row called "Neclasificat", because
    // the byte-for-byte matching #29.06 replaced created exactly that. Both
    // answers below therefore decline, so the catch-all never becomes a
    // `ClassifiedType` at all and its formlessness is never on the table.
    const impostor = type("id-impostor", "NECLASIFICAT", "Neclasificat");
    const verdict = checkTypeForms({
      entries: [
        entry("x.pdf", { typeKey: "UNCLASSIFIED", label: "NECLASIFICAT" }),
        entry("y.pdf", { typeKey: null, label: "Neclasificat" }),
      ],
      catalogue: [CATCH_ALL, WITH_FORM, impostor],
    });
    expect(verdict.clean).toBe(true);
    expect(verdict.types).toEqual([]);
    expect(verdict.unclassifiedCount).toBe(2);
  });
});

describe("checkTypeForms — the identity card", () => {
  /**
   * ⚠️ **THE CASE THAT MAKES OR BREAKS THIS GATE, and the first draft got it
   * wrong.** CARTE_IDENTITATE has no form and must never have one: its data is
   * captured by the import's own identity-card step, and `ai-interpret` builds
   * its prompt from `template_fields`, so a fake form would spend a billed read
   * against invented columns. `status.ts` calls a formless card "the correct
   * and permanent answer" in as many words.
   *
   * A gate that blocked on it would refuse every folder containing a
   * `buletin.jpg` — which is most of them — with no way past: the stop screen
   * is an exit, and the one action it recommends is the one three separate
   * files in this codebase say is wrong. `typeAwaitsForm` already excuses it,
   * which is why the gate asks that function instead of `!hasForm`.
   */
  it("⚠️ does not block on the seeded identity-card type, which correctly has no form", () => {
    const verdict = checkTypeForms({
      entries: [entry("buletin.jpg", { typeKey: "CARTE_IDENTITATE", label: "Carte de identitate" })],
      catalogue: CATALOGUE,
    });
    expect(verdict.clean).toBe(true);
    expect(verdict.types).toEqual([
      {
        kind: "existing",
        id: "id-ci",
        name: "Carte de identitate",
        hasForm: false,
        awaitsForm: false,
        documentCount: 1,
        files: [
          { path: "buletin.jpg", how: "key", said: "CARTE_IDENTITATE", confidence: undefined },
        ],
      },
    ]);
  });

  it("⚠️ excuses a stored card by its NAME as well as by its key", () => {
    // A row somebody added by hand, or one an earlier import invented from a
    // classified label, carries neither `CARTE_IDENTITATE` nor a form.
    const handAdded = type("id-hand", "BULETIN_IDENTITATE", "Buletin de identitate");
    const verdict = checkTypeForms({
      entries: [entry("b.jpg", { typeKey: "BULETIN_IDENTITATE", label: "buletin" })],
      catalogue: [CATCH_ALL, handAdded],
    });
    expect(verdict.clean).toBe(true);
  });

  it("⚠️ excuses a card the run would CREATE off the SCAN SIGNAL ALONE", () => {
    // ⚠️ **A THIRD ROUND TOOK THE LABEL TEST OUT OF THIS BRANCH, and the
    // reason is again agreement rather than tidiness.** For a type the run
    // CREATES, `docTypeIdCardRef` has no entry — it is built once from the
    // start-of-run list — so the run's expression collapses to
    // `isIdCardEntry(sr)` and nothing else. An extra `isIdCardTypeName(label)`
    // term here excused types the run would then flag, spending a billed
    // discovery read on a type the gate had promised needed no form.
    const byScanSignal = checkTypeForms({
      entries: [entry("x.jpg", { typeKey: null, label: "CI Popescu Ion" }, true)],
      catalogue: [CATCH_ALL, WITH_FORM],
    });
    expect(byScanSignal.clean).toBe(true);
  });

  it("⚠️ does NOT excuse a created type off its label when the scan did not say card", () => {
    // The half the third round added. "Acte de identitate" passes
    // `isIdCardTypeName` and fails `isIdCardLabel`, and `isIdCardEntry`
    // short-circuits to false on any non-card key without reading the label at
    // all — so this is a type the RUN would report as awaiting a form, and the
    // gate has to agree.
    const verdict = checkTypeForms({
      entries: [entry("x.jpg", { typeKey: null, label: "Acte de identitate" }, false)],
      catalogue: [CATCH_ALL, WITH_FORM],
    });
    expect(verdict.clean).toBe(false);
    expect(verdict.missingForm.map((t) => t.name)).toEqual(["Acte de identitate"]);
  });

  it("⚠️ lets the scan's signal excuse a STORED type too, because the RUN does", () => {
    // ⚠️ **THE FIRST DRAFT ASSERTED THE OPPOSITE, AND THE ADVERSARIAL ROUND
    // SHOWED WHY THAT WAS THE WRONG READING.** `discover-run.ts` argues that
    // the TYPE should answer for a stored row, and it is right about what ought
    // to be asked — but the run asks
    // `docTypeIdCardRef.get(id) === true || isIdCardEntry(sr)`, where the left
    // half is exactly the key-and-name test and the right half is the scan.
    // Dropping the scan term here made the gate refuse imports the run would
    // never have flagged: `isIdCardTypeName` deliberately rejects "Buletin de
    // analiză", "Buletin de încercare" and "Copie CI" — ordinary formless types
    // in a land-registry archive — while `isIdCardLabel`, which the scan
    // signal comes from, accepts all three.
    //
    // So this test pins AGREEMENT WITH THE EXECUTOR rather than the tidier
    // rule. The gate's only promise is that the type it names is the type the
    // run will file the document on and report on; a stricter gate is still a
    // wrong one.
    const verdict = checkTypeForms({
      entries: [entry("x.pdf", { typeKey: "CONTRACT_VANZARE", label: "Contract de vânzare" }, true)],
      catalogue: CATALOGUE,
    });
    expect(verdict.clean).toBe(true);
  });

  it("⚠️ blocks a formless stored type when NO document of it reads as a card", () => {
    // The other side of the same coin, so the term above cannot be read as
    // "the gate never blocks a stored type": with the scan signal false the
    // type is waiting for a form and the run says so on every one of its rows.
    const verdict = checkTypeForms({
      entries: [entry("x.pdf", { typeKey: "CONTRACT_VANZARE", label: "Contract de vânzare" })],
      catalogue: CATALOGUE,
    });
    expect(verdict.clean).toBe(false);
    expect(verdict.missingForm.map((t) => t.id)).toEqual(["id-vanzare"]);
  });

  it("⚠️ blocks when ONE document of a type would report a missing form", () => {
    // The run asks per DOCUMENT; this gate answers per TYPE, so the two only
    // agree if the type is blocked when ANY of its documents would be. Taking
    // the first entry's answer instead would make the verdict depend on walk
    // order — and this vector, with the card-signalled file FIRST, is the one
    // that would then pass.
    const verdict = checkTypeForms({
      entries: [
        entry("1.pdf", { typeKey: "CONTRACT_VANZARE", label: "Contract de vânzare" }, true),
        entry("2.pdf", { typeKey: "CONTRACT_VANZARE", label: "Contract de vânzare" }, false),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.clean).toBe(false);
    expect(verdict.missingForm[0].documentCount).toBe(2);
  });

  it("⚠️ still blocks a vehicle registration, which is what the veto is for", () => {
    // "Carte de identitate a vehiculului" is a car's registration document and
    // is exactly the phrase the card test would otherwise match. It is an
    // ordinary type and needs an ordinary form.
    const verdict = checkTypeForms({
      entries: [entry("civ.pdf", { typeKey: null, label: "Carte de identitate a vehiculului" })],
      catalogue: [CATCH_ALL, WITH_FORM],
    });
    expect(verdict.clean).toBe(false);
    expect(verdict.missingForm.map((t) => t.name)).toEqual([
      "Carte de identitate a vehiculului",
    ]);
  });
});

describe("checkTypeForms — Branch B, the run that stops", () => {
  it("blocks on a stored type that has no form, and names it", () => {
    const verdict = checkTypeForms({
      entries: [
        entry("a.pdf", { typeKey: "CONTRACT_ARENDA", label: "Contract de arendă" }),
        entry("b.pdf", { typeKey: "CONTRACT_VANZARE", label: "Contract de vânzare" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.clean).toBe(false);
    expect(verdict.missingForm).toEqual([
      {
        kind: "existing",
        id: "id-vanzare",
        name: "Contract de vânzare",
        hasForm: false,
        awaitsForm: true,
        documentCount: 1,
        files: [
          { path: "b.pdf", how: "key", said: "CONTRACT_VANZARE", confidence: undefined },
        ],
      },
    ]);
  });

  it("⚠️ blocks on a type the run would CREATE, which can never have a form", () => {
    // The half a reader is most likely to leave out, and the one that matters
    // most: a label naming a type nothing holds is a `lookup_document_type` row
    // the import would mint seconds later, without a form, and file documents
    // on. It is reported as `new` with no id, because there is no row to point
    // the user at yet.
    const verdict = checkTypeForms({
      entries: [entry("a.pdf", { typeKey: null, label: "Proces-verbal de recepție" })],
      catalogue: CATALOGUE,
    });
    expect(verdict.clean).toBe(false);
    expect(verdict.missingForm).toEqual([
      {
        kind: "new",
        id: null,
        name: "Proces-verbal de recepție",
        hasForm: false,
        awaitsForm: true,
        documentCount: 1,
        // No key on the answer and no row carrying that name — so the file's
        // justification is the third sentence, over the label it read.
        files: [
          {
            path: "a.pdf",
            how: "none",
            said: "Proces-verbal de recepție",
            confidence: undefined,
          },
        ],
      },
    ]);
  });

  it("⚠️ blocks on a whitelisted key nothing is seeded for", () => {
    // The trap `.claude/rules/import-wizard.md` records: the model is offered a
    // vocabulary of keys, and a key in it with no seeded row matches nothing.
    // Since #29.07 the resolver CREATES a row under exactly that key, so the
    // gate must read this as a create rather than as a match.
    const verdict = checkTypeForms({
      entries: [entry("a.pdf", { typeKey: "CERTIFICAT_BUNURI", label: "Certificat de bunuri" })],
      catalogue: CATALOGUE,
    });
    expect(verdict.clean).toBe(false);
    expect(verdict.missingForm.map((t) => t.kind)).toEqual(["new"]);
  });

  it("⚠️ refuses a template that parses to no usable field", () => {
    const verdict = checkTypeForms({
      entries: [entry("a.pdf", { typeKey: "CONTRACT_HOLLOW", label: "Contract gol" })],
      catalogue: [CATCH_ALL, type("id-hollow", "CONTRACT_HOLLOW", "Contract gol", EMPTY_FORM)],
    });
    expect(verdict.clean).toBe(false);
    expect(verdict.missingForm.map((t) => t.name)).toEqual(["Contract gol"]);
  });
});

describe("checkTypeForms — counting and order", () => {
  it("⚠️ folds two labels carrying one key into one row", () => {
    // Since #29.07 the resolver creates the row under the KEY it was offered,
    // so two answers with one whitelisted key and two different free-text
    // labels produce ONE row — the second adopts the first. Listing them twice
    // would send the user to build two forms, one of which collects nothing.
    const verdict = checkTypeForms({
      entries: [
        entry("a.pdf", { typeKey: "PROCES_VERBAL", label: "Proces verbal" }),
        entry("b.pdf", { typeKey: "PROCES_VERBAL", label: "PV de recepție" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.missingForm).toHaveLength(1);
    expect(verdict.missingForm[0].documentCount).toBe(2);
  });

  it("⚠️ folds a keyed answer and a keyless one that share a name", () => {
    // ⚠️ **THE MIXED CASE, AND FOLDING ON THE KEY ALONE SPLIT IT.** The run
    // creates the first row and PUSHES it into the list it matches against, so
    // the second entry resolves as an ordinary match — by name, since it
    // carries no key. One row for the run; two on the stop screen before this
    // was fixed, both with `id: null` and the same name, which is a duplicate
    // React key and a count of "2 tipuri" over one type.
    const verdict = checkTypeForms({
      entries: [
        entry("a.pdf", { typeKey: "CONTRACT_COMODAT", label: "Contract de comodat" }),
        entry("b.pdf", { typeKey: null, label: "Contract de comodat" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.missingForm).toHaveLength(1);
    expect(verdict.missingForm[0].documentCount).toBe(2);
  });

  it("⚠️ does NOT fold transitively, because the run resolves in one hop", () => {
    // ⚠️ **THE CASE THAT SANK THE ALIAS TABLE, and it under-reports rather than
    // over-reports, which is the dangerous direction.** A(k1,"X"), B(k2,"X"),
    // C(k2,"Y"): the run creates "X" for A, name-matches B against it, and then
    // finds NEITHER k2 nor "Y" in its list — because B was a match and pushed
    // nothing — so it creates a second row for C. A union-find over the aliases
    // chained k2 through B into A's fold and reported one type where two would
    // be created; the second run would then stop on the type the first one
    // never named, and the classification would be paid for a third time.
    const verdict = checkTypeForms({
      // ⚠️ Three labels the CATALOGUE does not hold, deliberately — a name the
      // archive already has would resolve as a `match` and never reach the
      // create path this test is about.
      entries: [
        entry("a.pdf", { typeKey: "K1", label: "Adeverință de rol" }),
        entry("b.pdf", { typeKey: "K2", label: "Adeverință de rol" }),
        entry("c.pdf", { typeKey: "K2", label: "Certificat de urbanism" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.missingForm.map((t) => t.name)).toEqual([
      "Adeverință de rol",
      "Certificat de urbanism",
    ]);
    expect(verdict.missingForm.map((t) => t.documentCount)).toEqual([2, 1]);
  });

  it("⚠️ lets a CREATED row's key beat a catalogue row's name, as the run does", () => {
    // ⚠️ **THE CASE A FOURTH ROUND FUZZED OUT, and the divergence it produced
    // was an OVER-report — the worst kind here, because the user acts on it.**
    // `matchDocumentType` runs its KEY pass over the whole list before its NAME
    // pass over the whole list, and the run resolves against ONE list into
    // which it pushes every row it creates. So `b.pdf` below key-matches the
    // row created for `a.pdf` and never reaches the name pass that would have
    // found "Contract de vânzare" in the catalogue.
    //
    // A version that asked the catalogue first and the created rows second
    // inverted those two passes: it reported "Contract de vânzare" as a stored
    // type awaiting a form, under a sentence saying one document in this folder
    // is of that type — over a run that files neither document on it.
    const verdict = checkTypeForms({
      entries: [
        entry("a.pdf", { typeKey: "PROCES_VERBAL", label: "Proces verbal" }),
        entry("b.pdf", { typeKey: "PROCES_VERBAL", label: "Contract de vânzare" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.missingForm.map((t) => [t.kind, t.name, t.documentCount])).toEqual([
      ["new", "Proces verbal", 2],
    ]);
  });

  it("⚠️ folds two answers that both say UNCLASSIFIED into one created row", () => {
    // `matchDocumentType` refuses to NAME-match any row carrying the catch-all
    // key, so a created row that kept `UNCLASSIFIED` could never be folded into
    // — one type would be listed twice under one name with `id: null` on both,
    // which is also a duplicate React key on the stop screen's list. The key is
    // blanked on the way in for exactly that reason.
    const verdict = checkTypeForms({
      entries: [
        entry("a.pdf", { typeKey: "UNCLASSIFIED", label: "Contract de comodat" }),
        entry("b.pdf", { typeKey: "UNCLASSIFIED", label: "Contract de comodat" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.missingForm).toHaveLength(1);
    expect(verdict.missingForm[0].documentCount).toBe(2);
  });

  it("⚠️ folds two keys that share a name, in either order", () => {
    // The same argument with the halves swapped: two different whitelisted keys
    // whose labels agree still produce one row, because the second entry name-
    // matches the row the first one created. Asserted in both orders, because
    // the alias table is walked in entry order and a one-way implementation
    // passes one of them.
    for (const order of [0, 1] as const) {
      const answers = [
        { typeKey: "PV_A", label: "Proces-verbal" },
        { typeKey: "PV_B", label: "Proces verbal" },
      ];
      const verdict = checkTypeForms({
        entries: [
          entry("a.pdf", answers[order]),
          entry("b.pdf", answers[1 - order]),
        ],
        catalogue: CATALOGUE,
      });
      expect({ order, rows: verdict.missingForm.length }).toEqual({ order, rows: 1 });
      expect(verdict.missingForm[0].documentCount).toBe(2);
    }
  });

  it("⚠️ folds two spellings of one keyless name into one row", () => {
    // Where there is no key the resolver's advisory lock serialises on the
    // normalised name, so these three are one create — including the one that
    // differs only by punctuation, which `normaliseDocumentTypeName` deletes
    // rather than collapsing to a separator.
    const verdict = checkTypeForms({
      entries: [
        entry("a.pdf", { typeKey: null, label: "Contract de comodat" }),
        entry("b.pdf", { typeKey: null, label: "Contract de comodat" }),
        entry("c.pdf", { typeKey: null, label: "Contract-de-comodat" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.missingForm).toHaveLength(1);
    expect(verdict.missingForm[0].documentCount).toBe(3);
  });

  it("⚠️ counts one stored type once, however the answers reached it", () => {
    // Key-matched and name-matched answers land on the same row, so they must
    // land on the same line — otherwise a folder read twice, once with the
    // diacritic and once without, would look like two blocked types.
    const verdict = checkTypeForms({
      entries: [
        entry("a.pdf", { typeKey: "CONTRACT_VANZARE", label: "Ceva cu totul altfel" }),
        entry("b.pdf", { typeKey: null, label: "Contract de vânzare" }),
        entry("c.pdf", { typeKey: null, label: "Contract de vanzare" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.missingForm).toHaveLength(1);
    expect(verdict.missingForm[0].id).toBe("id-vanzare");
    expect(verdict.missingForm[0].documentCount).toBe(3);
  });

  it("⚠️ lists types in the folder's own order, not alphabetically", () => {
    // What makes the stop screen checkable against File Explorer. Alphabetical
    // would be an ordering nobody can find their way around a folder by.
    const zebra = type("id-z", "Z_TYPE", "Zăpadă");
    const alpha = type("id-a", "A_TYPE", "Adeverință");
    const verdict = checkTypeForms({
      entries: [
        entry("1.pdf", { typeKey: "Z_TYPE", label: "Zăpadă" }),
        entry("2.pdf", { typeKey: "A_TYPE", label: "Adeverință" }),
      ],
      catalogue: [CATCH_ALL, zebra, alpha],
    });
    expect(verdict.types.map((t) => t.name)).toEqual(["Zăpadă", "Adeverință"]);
  });

  it("keeps the unclassified count out of the blocked list entirely", () => {
    const verdict = checkTypeForms({
      entries: [
        entry("a.pdf", { typeKey: "CONTRACT_VANZARE", label: "Contract de vânzare" }),
        entry("b.tif", null),
        entry("c.pdf", { typeKey: null, label: "Document necunoscut" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.unclassifiedCount).toBe(2);
    expect(verdict.types).toHaveLength(1);
    expect(verdict.missingForm).toHaveLength(1);
  });

  it("⚠️ separates two catalogue rows that share a normalised name", () => {
    // `matchDocumentType` says an archive really can hold "Contract de arendă"
    // and "Contract de arenda" as two rows — nothing makes `name` unique — and
    // it answers with the first. Keying the fold on the ROW ID rather than on
    // the name is what stops a second row silently absorbing the first's count.
    const a = type("id-1", "K1", "Contract de arendă", FORM);
    const b = type("id-2", "K2", "Contract de arenda");
    const verdict = checkTypeForms({
      entries: [
        entry("1.pdf", { typeKey: "K1", label: "x" }),
        entry("2.pdf", { typeKey: "K2", label: "x" }),
      ],
      catalogue: [CATCH_ALL, a, b],
    });
    expect(verdict.types.map((t) => t.id)).toEqual(["id-1", "id-2"]);
    expect(verdict.missingForm.map((t) => t.id)).toEqual(["id-2"]);
  });
});

describe("checkTypeForms — the files behind each type   (Slice #32.02)", () => {
  /**
   * ⚠️ **THE INVARIANT THE WHOLE FEATURE RESTS ON.** `documentCount` is kept
   * rather than derived from `files.length` — the copy test pins `row.existing`
   * and `row.new` as plural sentences over that number, and a length computed
   * at the render site would be a second place deciding how many documents a
   * type has. Keeping both is only safe while they agree, so every verdict this
   * describe block builds is checked, and the day they diverge is a red test
   * rather than a stop screen showing "5 documents" over four bullets.
   */
  function pinCountsMatchFiles(verdict: ReturnType<typeof checkTypeForms>): void {
    expect(
      verdict.types.map((t) => ({ name: t.name, count: t.documentCount, files: t.files.length })),
    ).toEqual(verdict.types.map((t) => ({ name: t.name, count: t.documentCount, files: t.documentCount })));
  }

  it("⚠️ carries the walk's paths under a type, in the walk's own order", () => {
    // The property that makes the new bullets worth reading at all: a list a
    // user can check line by line against File Explorer. Not alphabetical, not
    // by confidence, and not with the low-confidence ones pulled to the top.
    const verdict = checkTypeForms({
      entries: [
        entry("z/9.pdf", { typeKey: "CONTRACT_VANZARE", label: "Contract de vânzare" }),
        entry("a/1.pdf", { typeKey: "CONTRACT_VANZARE", label: "Contract de vânzare" }),
        entry("m/5.pdf", { typeKey: "CONTRACT_VANZARE", label: "Contract de vânzare" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.missingForm).toHaveLength(1);
    expect(verdict.missingForm[0].files.map((f) => f.path)).toEqual([
      "z/9.pdf",
      "a/1.pdf",
      "m/5.pdf",
    ]);
    pinCountsMatchFiles(verdict);
  });

  it("⚠️ keeps walk order ACROSS the fold, not just within one answer shape", () => {
    // The fold is the run's own loop: the second entry of an invented type is
    // an ordinary match against the row the loop pushed. Both entries are files
    // of one type, and the one the walk met first has to be listed first.
    const verdict = checkTypeForms({
      entries: [
        entry("1.pdf", { typeKey: "CONTRACT_COMODAT", label: "Contract de comodat" }),
        entry("2.pdf", { typeKey: null, label: "Contract de comodat" }),
        entry("3.pdf", { typeKey: "CONTRACT_COMODAT", label: "Comodat" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.missingForm).toHaveLength(1);
    expect(verdict.missingForm[0].documentCount).toBe(3);
    // ⚠️ **THE WHOLE SHAPE, NOT JUST THE PATHS, and a mutation round is why.**
    // This is the only fixture in the suite that reaches the `match` branch
    // against a row THIS RUN invented, and a path-only assertion left `how` and
    // `said` free: a mutant reporting `how: "none"` for the second and third
    // documents changed two of the three italic sentences on the screen and
    // stopped the third printing the key that actually did the matching, with
    // every test in all three suites still green. It is exactly the property
    // `ClassifiedFile.how` spends a paragraph documenting.
    expect(verdict.missingForm[0].files).toEqual([
      { path: "1.pdf", how: "none", said: "Contract de comodat", confidence: undefined },
      { path: "2.pdf", how: "name", said: "Contract de comodat", confidence: undefined },
      { path: "3.pdf", how: "key", said: "CONTRACT_COMODAT", confidence: undefined },
    ]);
    pinCountsMatchFiles(verdict);
  });

  it("⚠️ says HOW each file resolved, and carries that file's own key or label", () => {
    // Three answers, three sentences on the screen — and each has to name what
    // THIS file's answer was rather than the type's name, or five documents of
    // one type print one byte-identical italic line five times.
    const verdict = checkTypeForms({
      entries: [
        // Matched by key: the key is what did the matching, so the key is what
        // is carried.
        entry("byKey.pdf", { typeKey: "CONTRACT_VANZARE", label: "Ceva cu totul altfel" }),
        // Matched by name: no key at all, and the label's own spelling — which
        // `sameDocumentTypeName` folded onto the row, and which is not the row's
        // spelling of it.
        entry("byName.pdf", { typeKey: null, label: "contract de vanzare" }),
        // Matched nothing: a real label naming a type the archive does not hold.
        entry("none.pdf", { typeKey: "ACT_ADITIONAL", label: "Act adițional" }),
      ],
      catalogue: CATALOGUE,
    });
    const stored = verdict.types.find((t) => t.id === "id-vanzare");
    expect(stored?.files.map((f) => ({ how: f.how, said: f.said }))).toEqual([
      { how: "key", said: "CONTRACT_VANZARE" },
      { how: "name", said: "contract de vanzare" },
    ]);
    const created = verdict.types.find((t) => t.kind === "new");
    expect(created?.files.map((f) => ({ how: f.how, said: f.said }))).toEqual([
      { how: "none", said: "Act adițional" },
    ]);
    pinCountsMatchFiles(verdict);
  });

  it("⚠️ carries the scan's confidence, and carries its absence as absence", () => {
    // The whole cost of the justification: a field the wizard already holds.
    // An entry that arrived without one renders a sentence with no confidence
    // clause — never the word "undefined" on a screen.
    const verdict = checkTypeForms({
      entries: [
        entry("sure.pdf", { typeKey: "CONTRACT_VANZARE", label: "x" }, false, "high"),
        entry("unsure.pdf", { typeKey: "CONTRACT_VANZARE", label: "x" }, false, "low"),
        entry("silent.pdf", { typeKey: "CONTRACT_VANZARE", label: "x" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.missingForm[0].files.map((f) => f.confidence)).toEqual([
      "high",
      "low",
      undefined,
    ]);
    pinCountsMatchFiles(verdict);
  });

  it("⚠️ never counts an unclassified entry as a file of any type", () => {
    // The catch-all is reported and never counted against, and the same has to
    // be true of the list: a path that will land on NECLASIFICAT under a type
    // that needs a form would send the user to look for a document that is not
    // there.
    const verdict = checkTypeForms({
      entries: [
        entry("a.pdf", { typeKey: "CONTRACT_VANZARE", label: "Contract de vânzare" }),
        entry("b.tif", null),
        entry("c.pdf", { typeKey: null, label: "Document necunoscut" }),
      ],
      catalogue: CATALOGUE,
    });
    expect(verdict.unclassifiedCount).toBe(2);
    expect(verdict.types.flatMap((t) => t.files.map((f) => f.path))).toEqual(["a.pdf"]);
    pinCountsMatchFiles(verdict);
  });

  it("⚠️ keeps two catalogue rows that share a normalised name apart, files and all", () => {
    // Keying the fold on the ROW ID is what stops one row absorbing the other's
    // count; the files have to follow the same key, or the screen would list a
    // path under a type the run will not file it on.
    const a = type("id-1", "K1", "Contract de arendă", FORM);
    const b = type("id-2", "K2", "Contract de arenda");
    const verdict = checkTypeForms({
      entries: [
        entry("1.pdf", { typeKey: "K1", label: "x" }),
        entry("2.pdf", { typeKey: "K2", label: "x" }),
      ],
      catalogue: [CATCH_ALL, a, b],
    });
    expect(verdict.types.map((t) => t.files.map((f) => f.path))).toEqual([["1.pdf"], ["2.pdf"]]);
    pinCountsMatchFiles(verdict);
  });
});

describe("typesAreClean", () => {
  it("⚠️ refuses a run that was never asked, and one that got no answer", () => {
    // The under-claiming direction, and the whole promise of the gate: a run
    // that has not PROVED every type has a form has not earned the right to
    // write documents on them. Exported so the wizard holds no copy of it —
    // three call sites would be three chances to write `lookup?.ok` and forget
    // the verdict inside it.
    expect(typesAreClean(null)).toBe(false);
    expect(typesAreClean({ ok: false, reason: "unreadable" })).toBe(false);
    expect(typesAreClean({ ok: false, reason: "unusable" })).toBe(false);
    expect(typesAreClean({ ok: false, reason: "session" })).toBe(false);
  });

  it("reads the verdict's own `clean`, on both answers", () => {
    // Deliberately not asserted against a second computation of the same rule:
    // what can break here is the wrapper losing the `.verdict.clean` term, and
    // the two verdicts below differ in exactly that field.
    const clean = checkTypeForms({ entries: [], catalogue: CATALOGUE });
    expect(clean.clean).toBe(true);
    expect(typesAreClean({ ok: true, verdict: clean })).toBe(true);
    const blocked = checkTypeForms({
      entries: [entry("a.pdf", { typeKey: "CONTRACT_VANZARE", label: "x" })],
      catalogue: CATALOGUE,
    });
    expect(blocked.clean).toBe(false);
    expect(typesAreClean({ ok: true, verdict: blocked })).toBe(false);
  });
});
