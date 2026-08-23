/**
 * The title a document keeps.   (Slice #29.12)
 *
 * The defect this rule exists for is finding F11, and it is worth restating in
 * full because every test below is a way of getting it wrong again:
 *
 *   "Contract de Vânzare-Cumpărare Hascu 2005" became
 *   "CONTRACT DE VANZARE - CUMPARARE (CU DEZMEMBRARE)".
 *
 * The second string is not a mistake — it is the deed's own printed heading, in
 * the block capitals the scan has, with the diacritics the scan dropped. But in
 * gaining it the document lost "Hascu 2005", the only part of the title that
 * told a human WHICH contract this was, and in an archive of thirty sale-
 * purchase contracts all thirty then read the same.
 *
 * What is pinned here:
 *   - the rule itself, over the observed case and over each shape that must NOT
 *     trigger it (a bare file name, a folder that names only the kind, a title
 *     somebody has since edited);
 *   - that the comparison is diacritic- and case-SENSITIVE, because the scan's
 *     reading differs from the folder's title BY case and diacritics, and a
 *     folded comparison makes the rule stop firing on the second read;
 *   - that the reading the title did not take is kept, once, however many times
 *     the document is re-read.
 */

import type { FSEntry } from "@/lib/import/folder-utils";
import { folderNameToTitleHint } from "@/lib/import/folder-utils";
import {
  hasPrintedHeadingLine,
  notesWithPrintedHeading,
  printedHeadingNote,
  resolveImportedTitle,
} from "@/lib/import/document-title";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const pageGroup = (name: string): FSEntry => ({
  kind: "page-group",
  name,
  path: `Acte/${name}`,
  pathParts: ["Acte", name],
  handles: [],
  titleHint: folderNameToTitleHint(name),
});

// The handle is never touched by this module, so the fixture says so with a
// cast rather than inventing a File System Access object.
const file = (name: string): FSEntry =>
  ({ kind: "file", name, path: `Acte/${name}`, pathParts: ["Acte"] } as unknown as FSEntry);

/** The observed case, end to end. */
const HASCU = pageGroup("CVC Hascu 2005");
const HASCU_TITLE = "Contract de Vânzare-Cumpărare Hascu 2005";
const PRINTED = "CONTRACT DE VANZARE - CUMPARARE (CU DEZMEMBRARE)";

describe("resolveImportedTitle — the observed case (F11)", () => {
  it("⚠️ keeps 'Hascu 2005' rather than the printed heading", () => {
    // The whole slice in one assertion. `write: null` is what leaves the column
    // out of the patch; anything else here is the defect back.
    expect(
      resolveImportedTitle({
        entry: HASCU,
        storedTitle: HASCU_TITLE,
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }),
    ).toEqual({
      write: null,
      keepReading: PRINTED,
      unresolved: false,
      reason: "folder-names-this-document",
    });
  });

  it("the folder title still contains both the kind and the distinguishing part", () => {
    // The other half of the promise: the title that survives is worth
    // surviving. A rule that protected an empty or truncated folder title would
    // pass the assertion above and still leave thirty identical rows.
    expect(HASCU_TITLE).toContain("Contract de Vânzare-Cumpărare");
    expect(HASCU_TITLE).toContain("Hascu 2005");
    expect(folderNameToTitleHint("CVC Hascu 2005")).toBe(HASCU_TITLE);
  });

  it("⚠️ the reading is KEPT, not discarded — '(CU DEZMEMBRARE)' is a real fact", () => {
    const decision = resolveImportedTitle({
      entry: HASCU,
      storedTitle: HASCU_TITLE,
      storedTitleKnown: true,
      aiTitle: PRINTED,
    });
    expect(notesWithPrintedHeading(null, decision.keepReading)).toBe(
      `Titlul tipărit pe document: ${PRINTED}`,
    );
  });
});

describe("resolveImportedTitle — the comparison is diacritic- and case-sensitive", () => {
  it("⚠️ the scan's stripped, upper-cased heading is NOT the folder's title", () => {
    // The trap the slice named explicitly. Fold case and diacritics here and
    // "CONTRACT DE VANZARE-CUMPARARE" tests equal to the folder's title, the
    // stored value reads as "still the folder's" after the model has already
    // overwritten it, and the rule quietly stops firing on every re-read.
    //
    // Stored value here is what a FIRST, unprotected read would have left.
    expect(
      resolveImportedTitle({
        entry: pageGroup("CVC Hascu 2005"),
        storedTitle: "CONTRACT DE VANZARE - CUMPARARE",
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("ai-reading");
  });

  it("tolerates NFD/NFC spelling of the same diacritic, which is not a loosening", () => {
    // ș as s + U+0326 is the same letter as ș at U+0219. A JSON round trip
    // through the API may hand back either, and treating them as different
    // titles would break the rule on encoding rather than on meaning.
    const nfd = HASCU_TITLE.normalize("NFD");
    expect(nfd).not.toBe(HASCU_TITLE);
    expect(
      resolveImportedTitle({
        entry: HASCU,
        storedTitle: nfd,
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("folder-names-this-document");
  });

  it("tolerates collapsed whitespace", () => {
    expect(
      resolveImportedTitle({
        entry: HASCU,
        storedTitle: `  ${HASCU_TITLE.replace(" Hascu", "  Hascu")}  `,
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("folder-names-this-document");
  });
});

describe("resolveImportedTitle — what must NOT trigger the rule", () => {
  it("a file name that names neither the kind nor the one is not protected", () => {
    // "scan001.pdf" expands no abbreviation, so `namesTheKind` is false and the
    // printed heading is strictly better. Unprotected by the RULE, note, not by
    // a gate on the entry kind — see the file test in the block below.
    for (const name of ["scan001.pdf", "IMG_0042.jpg", "001.jpg", ".gitkeep"]) {
      expect(
        resolveImportedTitle({
          entry: file(name),
          storedTitle: name,
          storedTitleKnown: true,
          aiTitle: PRINTED,
        }),
      ).toEqual({
        write: PRINTED,
        keepReading: null,
        unresolved: false,
        reason: "ai-reading",
      });
    }
  });

  it("⚠️ a folder that names only the KIND is not protected", () => {
    // "CVC" expands to "Contract de Vânzare-Cumpărare" and distinguishes
    // nothing — thirty such folders produce thirty identical titles with or
    // without this rule, and the printed heading at least carries the
    // qualifier. So the reading wins.
    expect(
      resolveImportedTitle({
        entry: pageGroup("CVC"),
        storedTitle: "Contract de Vânzare-Cumpărare",
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("ai-reading");
  });

  it("a folder that names no kind at all is not protected", () => {
    // "Hascu 2005" distinguishes, but expands nothing: the folder never said
    // which document this is, which is the half the printed heading supplies.
    expect(
      resolveImportedTitle({
        entry: pageGroup("Hascu 2005"),
        storedTitle: "Hascu 2005",
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("ai-reading");
  });

  it("punctuation left after the expansion does not count as distinguishing", () => {
    expect(
      resolveImportedTitle({
        entry: pageGroup("CVC -"),
        storedTitle: folderNameToTitleHint("CVC -"),
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("ai-reading");
  });

  it("no entry at all is the pre-29.12 behaviour, unchanged", () => {
    // Every existing caller that passes nothing, and every test written before
    // the parameter existed, must land exactly here.
    expect(
      resolveImportedTitle({
        entry: null,
        storedTitle: HASCU_TITLE,
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }),
    ).toEqual({
      write: PRINTED,
      keepReading: null,
      unresolved: false,
      reason: "ai-reading",
    });
  });

  it("⚠️ a title that is neither the folder's nor empty is left to the old behaviour", () => {
    // A human's edit, or an earlier reading. Deciding between a human and the
    // model is a different rule than this slice's, and inventing it here would
    // be a second rule in the one place that is meant to hold one. Recorded in
    // `document-title.ts` and in the handover rather than smuggled in.
    expect(
      resolveImportedTitle({
        entry: HASCU,
        storedTitle: "Vânzarea de la unchiul Ion",
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("ai-reading");
  });

  it("an empty stored title takes the reading", () => {
    expect(
      resolveImportedTitle({
        entry: HASCU,
        storedTitle: "   ",
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("no-stored-title");
  });

  it("no reading means no decision and no write", () => {
    for (const aiTitle of [null, undefined, "", "   "]) {
      expect(
        resolveImportedTitle({
          entry: HASCU,
          storedTitle: HASCU_TITLE,
          storedTitleKnown: true,
          aiTitle,
        }),
      ).toEqual({ write: null, keepReading: null, unresolved: false, reason: "no-reading" });
    }
  });
});

describe("resolveImportedTitle — when the current state cannot be read", () => {
  it("⚠️ writes nothing and says so, rather than assuming the column is empty", () => {
    // The module's own doctrine: "I could not read it" is not "there was
    // nothing there". Asked the other way round, every failed GET would read as
    // "this document has no title" and overwrite the folder's value on exactly
    // the documents the rule protects.
    expect(
      resolveImportedTitle({
        entry: HASCU,
        storedTitle: null,
        storedTitleKnown: false,
        aiTitle: PRINTED,
      }),
    ).toEqual({
      write: null,
      keepReading: null,
      unresolved: true,
      reason: "current-unknown",
    });
  });

  it("an unreadable GET on an UNPROTECTED entry still takes the reading", () => {
    // The unresolved branch is scoped to the documents the folder named. A file
    // entry has nothing to protect, so a failed GET must not start suppressing
    // titles that were always the model's to write.
    expect(
      resolveImportedTitle({
        entry: file("scan001.pdf"),
        storedTitle: null,
        storedTitleKnown: false,
        aiTitle: PRINTED,
      }).write,
    ).toBe(PRINTED);
  });
});

describe("resolveImportedTitle — a FILE name can name a document too", () => {
  /**
   * ⚠️ The first draft of this rule gated on `kind === "page-group"`, arguing a
   * file's title is only ever "scan001.pdf". Measured over Adrian's own archive
   * (C:\dev\TEST.DATA, 448 documents) that was false for 71 of the 345
   * file-documents — and the single largest title collapse in the whole archive
   * was one the gate refused to look at: 33 files named `PAD lot 3 Ratiu.jpg`,
   * `PAD lot 5per3.jpg`, `PAD lot 4 Hascu.jpg` …, every one of which the model
   * titles `PLAN DE AMPLASAMENT ȘI DELIMITARE A IMOBILULUI`. Three ABBR keys
   * (`PAD`, `Inch Intab`, `Plan Parcelar`) fire on file names in that archive
   * and on no folder at all.
   */
  const PAD_PRINTED = "PLAN DE AMPLASAMENT SI DELIMITARE A IMOBILULUI";

  it("⚠️ keeps 'lot 3 Ratiu' on a PAD scan filed as a single file", () => {
    expect(
      resolveImportedTitle({
        entry: file("PAD lot 3 Ratiu.jpg"),
        // What `titleForEntry` stores for a file — the name, extension and all.
        storedTitle: "PAD lot 3 Ratiu.jpg",
        storedTitleKnown: true,
        aiTitle: PAD_PRINTED,
      }),
    ).toEqual({
      write: null,
      keepReading: PAD_PRINTED,
      unresolved: false,
      reason: "folder-names-this-document",
    });
  });

  it("thirty-three PAD scans keep thirty-three distinct titles", () => {
    // The measured shape, asserted rather than described. Before the rule all
    // of these read `PLAN DE AMPLASAMENT …`; the assertion is that what
    // survives still tells them apart.
    const names = ["PAD lot 3 Ratiu.jpg", "PAD lot 5per3.jpg", "PAD lot 4 Hascu.jpg", "PAD gresit  lot 5per2.jpg"];
    const kept = names.filter(
      (n) =>
        resolveImportedTitle({
          entry: file(n),
          storedTitle: n,
          storedTitleKnown: true,
          aiTitle: PAD_PRINTED,
        }).write === null,
    );
    expect(kept).toEqual(names);
    expect(new Set(names).size).toBe(names.length);
  });

  it("⚠️ the evidence ignores the extension; the comparison does not", () => {
    // Two different strings on purpose. ".jpg" is not something the user said,
    // so it must not stop `PAD` from being recognised — but it IS what
    // `titleForEntry` put in the column, so the stored-title comparison has to
    // expect it. Getting these the same way round is how the rule stops firing.
    expect(
      resolveImportedTitle({
        entry: file("PAD lot 3 Ratiu.jpg"),
        storedTitle: "PAD lot 3 Ratiu", // the extension stripped — NOT what is stored
        storedTitleKnown: true,
        aiTitle: PAD_PRINTED,
      }).reason,
    ).toBe("ai-reading");
  });

  it("a page group with an empty hint falls back to the folder name, as titleForEntry does", () => {
    // `titleForEntry`'s empty-hint fallback. The rule must compare against what
    // that function stored, not against a recomputed hint — the two diverged
    // once already (#26.08) and the document was stored untitled.
    const entry = pageGroup("___");
    expect(entry.kind === "page-group" && entry.titleHint).toBe("");
    expect(
      resolveImportedTitle({
        entry,
        storedTitle: "___",
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("ai-reading");
  });
});

describe("notesWithPrintedHeading — write-once, never over anything", () => {
  it("appends to existing notes with a blank line between", () => {
    expect(notesWithPrintedHeading("Nota lui Adrian", PRINTED)).toBe(
      `Nota lui Adrian\n\n${printedHeadingNote(PRINTED)}`,
    );
  });

  it("does not append a second copy of the same line", () => {
    const once = notesWithPrintedHeading(null, PRINTED)!;
    expect(notesWithPrintedHeading(once, PRINTED)).toBeNull();
    expect(notesWithPrintedHeading(`Ceva\n\n${once}`, PRINTED)).toBeNull();
  });

  it("⚠️ a heading printed over TWO lines is recorded as one line, once", () => {
    // A record that silently becomes two lines is one the marker no longer
    // describes: the second line reads as a stray sentence and a user tidying
    // it deletes half the record.
    const twoLine = "CONTRACT DE VANZARE - CUMPARARE\n(CU DEZMEMBRARE)";
    const once = notesWithPrintedHeading(null, twoLine)!;
    expect(once).toBe(
      "Titlul tipărit pe document: CONTRACT DE VANZARE - CUMPARARE (CU DEZMEMBRARE)",
    );
    expect(notesWithPrintedHeading(once, twoLine)).toBeNull();
  });

  it("⚠️ OCR drift on a re-read writes NOTHING — it does not add and does not overwrite", () => {
    // Both halves matter, and each is a failure that shipped in a draft.
    // Appending grew the column for ever, because a vision model is not
    // byte-stable across calls and the refill walk re-reads by design.
    const first = notesWithPrintedHeading("Nota", "CONTRACT DE VANZARE - CUMPARARE")!;
    expect(notesWithPrintedHeading(first, "CONTRACT DE VANZARE-CUMPARARE")).toBeNull();
    expect(notesWithPrintedHeading(first, "cu totul altceva")).toBeNull();
  });

  it("⚠️ a HUMAN'S EDIT of our own line survives every later read", () => {
    // The failure the replace-the-marker draft shipped: `notes` is free text
    // this app invites the user to edit, and the refill walk deleted Adrian's
    // correction of a bad reading — permanently, in a version row stamped with
    // his own email. A display value must never double as a lock.
    const corrected =
      "Titlul tipărit pe document: Contract de vânzare-cumpărare (cu dezmembrare)" +
      " — corectat de Adrian, OCR-ul a greșit";
    expect(notesWithPrintedHeading(corrected, PRINTED)).toBeNull();
    expect(notesWithPrintedHeading(`Nota\n${corrected}\nAlta notă`, PRINTED)).toBeNull();
  });

  it("⚠️ Windows line endings are left exactly as the user has them", () => {
    // `split(/\r?\n/).join("\n")` rewrote every line ending in the column, so
    // the version diff a user consults to see what the read did showed the
    // whole note as changed.
    const crlf = "Nota A\r\nTitlul tipărit pe document: VECHI\r\nNota B";
    expect(notesWithPrintedHeading(crlf, PRINTED)).toBeNull();
    const noMarker = "Nota A\r\nNota B";
    expect(notesWithPrintedHeading(noMarker, PRINTED)).toBe(
      `${noMarker}\n\n${printedHeadingNote(PRINTED)}`,
    );
  });

  it("⚠️ a human's sentence that merely quotes the heading is not our line", () => {
    // The marker has to START the line, or the record is suppressed on exactly
    // the document it exists for.
    const human = `Ion spune că scrie "${PRINTED}" pe prima pagină.`;
    expect(notesWithPrintedHeading(human, PRINTED)).toBe(
      `${human}\n\n${printedHeadingNote(PRINTED)}`,
    );
  });

  it("returns null when there is no reading to keep", () => {
    expect(notesWithPrintedHeading("Nota", null)).toBeNull();
    expect(notesWithPrintedHeading("Nota", "   ")).toBeNull();
  });

  it("the marker is Romanian and is a data value, not a UI string", () => {
    expect(printedHeadingNote(PRINTED)).toBe(
      "Titlul tipărit pe document: CONTRACT DE VANZARE - CUMPARARE (CU DEZMEMBRARE)",
    );
  });
});

describe("resolveImportedTitle — nothing is kept that is already the title", () => {
  it("⚠️ the model reading back the title we kept records nothing", () => {
    // The commonest case for a well-named folder, not an edge one. Recording it
    // would put a copy of `title` into `notes`, plus a `document_version` row,
    // and describe the document's own title as its printed heading.
    expect(
      resolveImportedTitle({
        entry: HASCU,
        storedTitle: HASCU_TITLE,
        storedTitleKnown: true,
        aiTitle: `  ${HASCU_TITLE}  `,
      }),
    ).toEqual({
      write: null,
      keepReading: null,
      unresolved: false,
      reason: "folder-names-this-document",
    });
  });

  it("⚠️ but a reading that differs only in case and diacritics IS kept", () => {
    // The scan's stripped, upper-cased form is a different string from the
    // folder's title and says something the title does not — that this is what
    // the page actually reads. Folding the comparison here would discard it.
    expect(
      resolveImportedTitle({
        entry: HASCU,
        storedTitle: HASCU_TITLE,
        storedTitleKnown: true,
        aiTitle: "CONTRACT DE VANZARE-CUMPARARE HASCU 2005",
      }).keepReading,
    ).toBe("CONTRACT DE VANZARE-CUMPARARE HASCU 2005");
  });
});

describe("evidenceName — an extension is dropped, a document number is not", () => {
  it("⚠️ 'TP.2005' keeps its number", () => {
    // A blind "everything after the last dot" strip left "TP" — which names the
    // kind, distinguishes nothing, and loses the protection the name asked for.
    expect(
      resolveImportedTitle({
        entry: file("TP.2005"),
        storedTitle: "TP.2005",
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("folder-names-this-document");
  });

  it("an ordinary extension is still dropped", () => {
    for (const name of ["PAD lot 3 Ratiu.jpg", "PAD lot 3 Ratiu.JPEG", "PAD lot 3 Ratiu.pdf"]) {
      expect(
        resolveImportedTitle({
          entry: file(name),
          storedTitle: name,
          storedTitleKnown: true,
          aiTitle: PRINTED,
        }).reason,
      ).toBe("folder-names-this-document");
    }
  });
});

describe("hasPrintedHeadingLine — finding our own line however it comes back", () => {
  const line = printedHeadingNote(PRINTED)!;

  it("⚠️ recognises the line when the column comes back NFD", () => {
    // The marker holds "ă" and "î". `sameTitle` in this same module normalises
    // because "a JSON round trip through the API is entitled to hand either
    // spelling back" — and the one comparison where failing means the write-once
    // rule appends was not doing it. Measured at five copies over four refill
    // passes, one `document_version` row each.
    const nfd = line.normalize("NFD");
    expect(nfd).not.toBe(line);
    expect(hasPrintedHeadingLine(nfd)).toBe(true);
    expect(notesWithPrintedHeading(nfd, PRINTED)).toBeNull();
  });

  it("⚠️ sees a line behind an old-style \\r break", () => {
    // This app runs on Windows against text a user pastes, and `split(/\r?\n/)`
    // cannot see a lone `\r`.
    expect(hasPrintedHeadingLine(`prima notă\r${line}`)).toBe(true);
    expect(hasPrintedHeadingLine(`prima notă\r\n${line}`)).toBe(true);
    expect(hasPrintedHeadingLine(`prima notă\n${line}`)).toBe(true);
  });

  it("⚠️ sees a line the user has formatted, or pasted an invisible into", () => {
    // `notes` is a column this app invites the user to edit. `trimStart`
    // removes neither a zero-width space nor a BOM — and the harder half is
    // ordinary tidying: our line comes back bulleted or numbered the moment
    // somebody turns their notes into a list, and behind a pasted
    // right-to-left mark or soft hyphen, which are invisible. Every one of
    // these made the line unrecognisable, and an unrecognised line is appended
    // to — the unbounded growth this rule exists to stop, reached by a user
    // formatting their own notes.
    // `a)`, `b.` and `(1)` are the ordinary Romanian legal enumeration forms,
    // in a Romanian property archive; a digits-only marker that had to start
    // the line recognised none of them.
    for (const lead of [
      "\u200B", "\uFEFF", "\u00A0", "  \t", "\u200E", "\u00AD",
      "- ", "* ", "• ", "> ", "## ", "– ",
      "1. ", "2) ", "a) ", "b. ", "i) ", "A. ", "(1) ", "- 1. ",
    ]) {
      expect(hasPrintedHeadingLine(`${lead}${line}`)).toBe(true);
      expect(notesWithPrintedHeading(`${lead}${line}`, PRINTED)).toBeNull();
    }
  });

  it("⚠️ a formatted line does not grow a second one, pass after pass", () => {
    for (const lead of ["- ", "a) ", "(1) ", "A. ", "\u00AD"]) {
      let notes = `${lead}${printedHeadingNote("VECHI")!}`;
      for (let i = 0; i < 5; i++) {
        const next = notesWithPrintedHeading(notes, PRINTED);
        if (next !== null) notes = next;
      }
      expect(notes.split("\n").filter((l) => l.includes("Titlul tipărit")).length).toBe(1);
    }
  });

  it("⚠️ the strip is bounded, so a long punctuation line cannot blow up", () => {
    // Two adjacent unbounded negated classes over the same characters is how a
    // leading strip becomes quadratic.
    const started = Date.now();
    expect(hasPrintedHeadingLine("(".repeat(30_000) + "x")).toBe(false);
    expect(hasPrintedHeadingLine(" ".repeat(30_000) + "1".repeat(30_000) + "x")).toBe(false);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("⚠️ is false for notes that merely mention the words mid-line", () => {
    // What the leading strip must NOT do. A human writing about the heading is
    // not our record, and treating it as one suppresses the record on exactly
    // the document it is for.
    for (const prose of ["Ion zice că ", "Documentul are ", "Nota despre "]) {
      expect(hasPrintedHeadingLine(`${prose}${line}`)).toBe(false);
    }
    expect(hasPrintedHeadingLine("")).toBe(false);
    expect(hasPrintedHeadingLine(null)).toBe(false);
  });

  it("never rewrites the column it is asked about", () => {
    // Normalisation is applied to the TEST only: the CRLF value goes back
    // untouched, because nothing is written at all.
    const crlf = `Nota A\r\n${line}\r\nNota B`;
    expect(notesWithPrintedHeading(crlf, PRINTED)).toBeNull();
  });
});

describe("printedHeadingNote — a reading with nothing in it is not a reading", () => {
  it("⚠️ refuses a lone zero-width space", () => {
    // It is not `\s`, so it passes an emptiness test written with `trim()` —
    // and wrote a marker over nothing, which then suppressed the real record
    // for the life of the document under write-once.
    expect(printedHeadingNote("\u200B")).toBeNull();
    expect(printedHeadingNote("  \u00A0 ")).toBeNull();
    expect(printedHeadingNote(" — · ")).toBeNull();
    expect(notesWithPrintedHeading("Nota", "\u200B")).toBeNull();
  });

  it("flattens tabs and odd spaces into single spaces", () => {
    expect(printedHeadingNote("CONTRACT\tDE\u00A0VANZARE")).toBe(
      "Titlul tipărit pe document: CONTRACT DE VANZARE",
    );
  });
});

describe("evidenceName — four characters of extension, and no more", () => {
  it("⚠️ 'CVC.Hascu' keeps 'Hascu'", () => {
    // An eight-character bound ate a dot-separated WORD and left "CVC", which
    // names the kind, distinguishes nothing, and loses the protection.
    expect(
      resolveImportedTitle({
        entry: file("CVC.Hascu"),
        storedTitle: "CVC.Hascu",
        storedTitleKnown: true,
        aiTitle: PRINTED,
      }).reason,
    ).toBe("folder-names-this-document");
  });

  it("still drops every extension this archive actually holds", () => {
    for (const ext of ["jpg", "JPG", "jpeg", "png", "tif", "tiff", "pdf", "doc", "docx"]) {
      expect(
        resolveImportedTitle({
          entry: file(`PAD lot 3 Ratiu.${ext}`),
          storedTitle: `PAD lot 3 Ratiu.${ext}`,
          storedTitleKnown: true,
          aiTitle: PRINTED,
        }).reason,
      ).toBe("folder-names-this-document");
    }
  });
});
