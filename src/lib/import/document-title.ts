/**
 * The title a document keeps.   (Slice #29.12)
 *
 * WHAT THIS IS
 * ------------
 * Two producers offer a document a title during an import, and until this slice
 * the second one always won:
 *
 *   1. **The folder.** `folderNameToTitleHint` expands `CVC_Hascu_2005` into
 *      "Contract de Vânzare-Cumpărare Hascu 2005". That is the job Adrian
 *      assigned folder names — titles, nicknames and short descriptions of the
 *      thing inside — and `document.title` is described in the schema as the
 *      "Porecla equivalent for a document", which is the same job.
 *   2. **The model**, reading the document's printed heading. The route asks
 *      for "document title as printed" (`GENERIC_EXTRACT_FIELD_DESCRIPTIONS`),
 *      and that is what it returns: the heading, in whatever block capitals the
 *      scan has, with whatever diacritics the scan lost.
 *
 * ⚠️ **THE OBSERVED FAILURE (finding F11).** "Contract de Vânzare-Cumpărare
 * Hascu 2005" became "CONTRACT DE VANZARE - CUMPARARE (CU DEZMEMBRARE)". The
 * second is not wrong — it is the deed's own heading — but in gaining it the
 * document lost "Hascu 2005", the only part that told a human WHICH contract
 * this was. In a property archive holding thirty sale-purchase contracts, all
 * thirty then read the same, and the list they appear in is unusable.
 *
 * THE RULE, IN ONE SENTENCE
 * -------------------------
 * **When the folder name says both which KIND of document this is and which
 * ONE of them, and the stored title is still exactly what that folder name
 * produced, the folder's title stays and the model's reading is kept beside it.
 * Otherwise the model's reading wins, exactly as it did before.**
 *
 * That is deliberately the narrowest of the three options the slice offered
 * (keep / combine / offer the choice):
 *
 *   - **Not combined.** "Contract de Vânzare-Cumpărare Hascu 2005 — CONTRACT DE
 *     VANZARE - CUMPARARE (CU DEZMEMBRARE)" says the same thing twice, in two
 *     casings, and is not idempotent: the refill walk calls this a second time
 *     on a title the first call had already built.
 *   - **Not offered.** A choice per document is a question per document, and a
 *     folder of forty is forty questions to recover a value the folder already
 *     supplied correctly. `C:\dev\CLAUDE.md` → "Minimise human effort".
 *   - **Kept, not discarded — with one honest exception.** The heading carries
 *     qualifiers the folder name never has — "(CU DEZMEMBRARE)" is a real fact
 *     about that deed — so it is recorded on the document rather than thrown
 *     away. See `printedHeadingNote`. The exception is the `current-unknown`
 *     branch below: when the document's own state could not be read, its notes
 *     cannot be appended to either without destroying whatever is in them, so
 *     that one reading IS lost. `unresolved` says so and the caller reports a
 *     partial write, which offers the row a retry — a second billed call, and
 *     the honest price of not writing over a column we could not read.
 *
 * WHAT IT DOES NOT TOUCH
 * ----------------------
 * ⚠️ **The document's TYPE.** `fields.documentTypeId` travels its own path
 * through `runAiInterpret` — `wantsRetype` / `typeKnown` / `retyped` — and
 * nothing here reads or returns it. The 29.01 slice description warned against
 * letting the two blur, and the reason is concrete: the heading a folder
 * abbreviation expands to ("Contract de Vânzare-Cumpărare") is *also* the name
 * of a `lookup_document_type` row, so a rule written over "the title" that
 * reached for the type would re-type documents from their folder names. This
 * module is a pure function over three strings; it cannot.
 *
 * ⚠️ **A title that is neither the folder's nor empty is left to the old
 * behaviour** — the model still overwrites it. That is a human's edit, or an
 * earlier reading, and deciding between a human and the model is a different
 * rule than the one this slice was opened for. Recorded rather than smuggled in.
 */

import {
  folderNameTitleEvidence,
  type FSEntry,
} from "@/lib/import/folder-utils";
// ⚠️ **The expression that WROTE the stored title, not a second copy of it.**
// `titleForEntry` is what `bulk-import-dialog.tsx` POSTs as `title` at import
// time, and #26.08's own note on that line says the two must be one expression:
// they had already diverged once, and the document was stored untitled. This
// module compares against the stored value, so it has to ask the same function
// what that value was — recomputing it here is how the comparison comes to fail
// on the empty-hint fallback and the rule quietly stops protecting anything.
import { titleForEntry } from "@/lib/import/preexisting-check";

/**
 * Compare two titles as TITLES — case-sensitive, diacritic-sensitive, and
 * Unicode-normalised.
 *
 * ⚠️ **THE INSENSITIVE VERSION OF THIS IS THE BUG, NOT THE FIX**, and it is the
 * one thing in this module most likely to be "simplified" later. Everywhere
 * else in the import code a Romanian comparison is deliberately blind to
 * diacritics and case — `abbrPattern` in `folder-utils.ts`, `foldRomanian` in
 * `id-card.ts` — because those are matching a name a human typed against a name
 * a human typed differently. This one is not. The two strings being compared
 * here are *the folder's title* and *the scan's reading of the printed
 * heading*, and the scan's reading differs from the folder's title precisely BY
 * being upper-cased and stripped of its diacritics. Fold them together and
 * "CONTRACT DE VANZARE - CUMPARARE" tests equal to "Contract de
 * Vânzare-Cumpărare", the stored title is read as "still what the folder
 * produced" when the model has already overwritten it, and the rule silently
 * stops firing on the second read of every document it was written for.
 *
 * `normalize("NFC")` is not a loosening: ș spelled as `s` + U+0326 and ș spelled
 * as U+0219 are the same letter with the same diacritic, and a JSON round trip
 * through the API is entitled to hand either back. Case and accents are
 * untouched.
 */
function sameTitle(a: string, b: string): boolean {
  const norm = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
}

const filled = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.trim() !== "";

/**
 * The part of an entry's name that the user chose.
 *
 * A page group's name is all theirs. A file's carries an extension the scanner
 * or the camera put there, and "PAD lot 3 Ratiu.jpg" says exactly as much about
 * which document this is as the folder "PAD lot 3 Ratiu" would — so the
 * extension is dropped before the name is read for evidence, and only for that.
 * The last dot only, and not a leading one: ".gitkeep" is not an extension.
 */
function evidenceName(entry: FSEntry): string {
  if (entry.kind === "page-group") return entry.name;
  // ⚠️ **Extension-SHAPED, not merely "after the last dot".** `TP.2005` is a
  // document number, not a file type, and a blind strip left it as "TP" — which
  // names the kind, distinguishes nothing, and loses the protection the name
  // was asking for. A leading dot is not an extension either (".gitkeep").
  //
  // Four characters at most, which covers every extension this archive holds
  // (measured: `jpg` 554, `docx` 34, `txt` 21, `doc` 20, `pdf` 20, `rtf` 12,
  // `png` 4, `ps1` 1, `tif` 1 — `docx` is the longest) and stops the strip
  // eating a dot-separated WORD: `CVC.Hascu` keeps "Hascu", where a longer
  // bound left "CVC" and lost the protection.
  return entry.name.replace(/(?!^)\.[A-Za-z][A-Za-z0-9]{0,3}$/, "");
}

/** Why the decision came out the way it did — for tests and for the handover. */
export type TitleDecisionReason =
  /** The model returned no title. Nothing to decide. */
  | "no-reading"
  /** The document has no title at all, so the reading is strictly better than nothing. */
  | "no-stored-title"
  /** The folder named the kind AND the one, and its title is still there. It stays. */
  | "folder-names-this-document"
  /** The folder named nothing useful, or the title is no longer the folder's. */
  | "ai-reading"
  /**
   * The folder named this document, but the stored title could not be read, so
   * we cannot prove the model would be overwriting the folder's value rather
   * than its own. Nothing is written and the caller reports a partial write.
   */
  | "current-unknown";

export type TitleDecision = {
  /** The value to PATCH onto `title`, or `null` to leave the stored value alone. */
  write: string | null;
  /** The model's reading when it did NOT win — kept, not discarded. `null` otherwise. */
  keepReading: string | null;
  /** True when the decision could not be made because the current state is unknown. */
  unresolved: boolean;
  reason: TitleDecisionReason;
};

/**
 * Decide one document's title. The ONLY place that decides it.
 *
 * @param entry the folder entry this document was imported from, or `null` when
 *        the caller has none (a document reached from outside the import walk).
 *        `null` is the pre-29.12 behaviour in full: the model's reading wins.
 * @param storedTitle the title the document holds right now, as read back from
 *        `GET /api/documents/[id]`.
 * @param storedTitleKnown whether that GET actually answered. When it did not,
 *        `storedTitle` says nothing and must not be reasoned from.
 * @param aiTitle the model's `fields.title` — the printed heading.
 */
export function resolveImportedTitle(input: {
  entry: FSEntry | null;
  storedTitle: string | null | undefined;
  storedTitleKnown: boolean;
  aiTitle: string | null | undefined;
}): TitleDecision {
  const { entry, storedTitle, storedTitleKnown, aiTitle } = input;

  if (!filled(aiTitle)) {
    return { write: null, keepReading: null, unresolved: false, reason: "no-reading" };
  }
  const reading = aiTitle.trim();

  // ⚠️ **A plain FILE is asked the same question as a page group, and an
  // adversarial round measured why.** The first draft gated on
  // `kind === "page-group"`, reasoning that a file's title is only ever
  // "scan001.pdf". Run over Adrian's own archive (`C:\dev\TEST.DATA`, 448
  // documents: 345 files and 103 page groups) that reasoning was false for
  // **71 of the 345 file-documents — 21%** — and the largest collapse among
  // them was one this rule was refusing to look at: **33 files named
  // `PAD lot 3 Ratiu.jpg`, `PAD lot 5per3.jpg`, `PAD lot 4 Hascu.jpg` …, every
  // one of which the model titles `PLAN DE AMPLASAMENT ȘI DELIMITARE A
  // IMOBILULUI`.** (The largest collapse in the archive overall is the 48
  // CVC-named documents this slice was opened for; 39 of those are page groups
  // the gate already covered, which is why the file half went unnoticed.)
  //
  // Of the fourteen ABBR keys, `PAD` (33 files, 0 folders) and `Plan Parcelar`
  // (10 files, 0 folders) fire on file names in that archive and on no folder
  // at all; `Inch Intab` fires on 13 files and a single folder.
  //
  // The evidence is read off the name without its extension — ".jpg" is not
  // something the user said — while the comparison below is against
  // `titleForEntry`, which stores a file's name WITH it. Those are two
  // different strings on purpose: one is what the name means, the other is what
  // is in the column.
  //
  // "scan001.pdf" and "IMG_0042.jpg" are still unprotected, and by the rule
  // itself rather than by a gate: they expand no abbreviation, so
  // `namesTheKind` is false and the printed heading wins.
  const supplied = entry === null ? null : titleForEntry(entry);
  const evidence = entry === null ? null : folderNameTitleEvidence(evidenceName(entry));
  const namesThisDocument =
    evidence !== null && evidence.namesTheKind && evidence.distinguishes !== "";

  if (!namesThisDocument || supplied === null) {
    return { write: reading, keepReading: null, unresolved: false, reason: "ai-reading" };
  }

  // Everything below needs to know what is stored. Order matters: the
  // unreadable case is asked BEFORE the empty case, because an unread GET
  // leaves `storedTitle` empty for a reason that has nothing to do with the
  // document. Reading them the other way round turns every failed GET into
  // "this document has no title", which is the assumption this module's whole
  // caller is built to refuse.
  if (!storedTitleKnown) {
    return { write: null, keepReading: null, unresolved: true, reason: "current-unknown" };
  }
  if (!filled(storedTitle)) {
    return { write: reading, keepReading: null, unresolved: false, reason: "no-stored-title" };
  }

  if (sameTitle(storedTitle, supplied)) {
    return {
      write: null,
      // ⚠️ **Nothing is kept when the model read back the title we already
      // have.** Recording it would put a copy of `title` into `notes`, plus a
      // `document_version` row, and say "the printed heading is …" about a
      // string that is now on the document twice. The two agreeing is the
      // commonest case for a well-named folder, not an edge one.
      keepReading: sameTitle(reading, supplied) ? null : reading,
      unresolved: false,
      reason: "folder-names-this-document",
    };
  }

  return { write: reading, keepReading: null, unresolved: false, reason: "ai-reading" };
}

/**
 * The line that keeps a reading the title did not take.
 *
 * Romanian, and hardcoded on purpose: this is a DATA value written into
 * `document.notes`, not a UI string. `ga40prj/CLAUDE.md` → "hardcoded Romanian
 * in a *data* value is not an i18n violation". `notes` is where this module's
 * caller already appends the model's Enhanced Notes, in the same single patch,
 * so the reading lands on a field the user can see, edit and delete — and needs
 * no migration to reach.
 *
 * ⚠️ **The reading is flattened to ONE line.** A printed heading that spans two
 * lines on the deed comes back from the model with the newline in it, and a
 * record that silently becomes two lines in a free-text column is one the
 * marker no longer describes — the second line carries no marker, reads as a
 * stray sentence, and a user tidying it deletes half the record.
 *
 * ⚠️ **The prefix is a marker, not decoration** — but it is only ever read as
 * "there is already one of these here, leave the column alone". It is NOT a
 * licence to overwrite the line it finds; see `notesWithPrintedHeading` for the
 * round that established the difference.
 */
export const PRINTED_HEADING_PREFIX = "Titlul tipărit pe document:";

export function printedHeadingNote(reading: string): string | null {
  const flat = reading.replace(/\s+/gu, " ").trim();
  // ⚠️ **A reading with no letter and no digit is not a reading.** A lone
  // zero-width space passes `filled()` — it is not `\s` — and wrote
  // "Titlul tipărit pe document: ​" into a user's notes, a marker over nothing
  // that then suppressed the real record for the life of the document.
  return /[\p{L}\p{N}]/u.test(flat) ? `${PRINTED_HEADING_PREFIX} ${flat}` : null;
}

/**
 * Put the kept reading into a document's notes — ONCE, and never over anything.
 *
 * Returns the notes column's new value, or `null` when there is nothing to
 * write. `null` means "do not put `notes` in the patch", which matters on a
 * versioned entity: writing an unchanged column is a `document_version` row for
 * an action that changed nothing.
 *
 * ⚠️ **WRITE-ONCE. If a line already carries the marker, this writes nothing at
 * all** — it does not append a second, and it does not replace the first. Both
 * of the other two shapes were written and both were broken by an adversarial
 * round, in opposite directions, and the pair of failures is the argument for
 * this one:
 *
 *   - **Append when the composed line is not already present** grew without
 *     bound. A heading printed over two lines never equalled itself, and a
 *     vision model is not byte-stable across calls — one stray space in
 *     "VANZARE- CUMPARARE", one recovered diacritic, one trailing full stop —
 *     so the refill walk, which this module's caller re-runs BY DESIGN, added a
 *     fourth copy of the same sentence on the fourth pass, with a
 *     `document_version` row each time.
 *   - **Find the marker and replace that line** fixed the growth and destroyed
 *     the user. `notes` is free text this app invites the user to edit — the
 *     second round drove the real `runAiInterpret` over a document whose note
 *     read "Titlul tipărit pe document: Contract de vânzare-cumpărare (cu
 *     dezmembrare) — corectat de Adrian, OCR-ul a greșit" and the refill walk
 *     deleted the correction, permanently, in a version row stamped with
 *     Adrian's own email. `C:\dev\CLAUDE.md` states the general form of that
 *     mistake: **a display value must never double as a lock.** A marker meant
 *     to identify our line cannot also be the licence to overwrite it, because
 *     the moment a human edits the line the marker is no longer ours.
 *
 * Write-once has neither failure. What it gives up is real and small: a later,
 * better reading is not recorded, and a note left behind on a document whose
 * title has since changed is never tidied away. Both are user data by then, and
 * the user can edit or delete the line — which is the whole reason the reading
 * went to a column they own rather than to one they do not.
 *
 * ⚠️ **The marker must START the line.** A human's own sentence quoting the
 * heading mid-paragraph is not this line, and would otherwise suppress the
 * record on the very document the record exists for.
 */
export function notesWithPrintedHeading(
  existingNotes: string | null | undefined,
  keptReading: string | null,
): string | null {
  const line = printedHeadingNote(keptReading ?? "");
  if (line === null) return null;
  if (!filled(existingNotes)) return line;
  return hasPrintedHeadingLine(existingNotes) ? null : `${existingNotes}\n\n${line}`;
}

/**
 * Does this notes column already carry one of our lines?
 *
 * ⚠️ **NFC, and the round that found this had already seen the argument for
 * it.** `sameTitle` above normalises because "a JSON round trip through the API
 * is entitled to hand either spelling back" — and the marker contains "ă", so a
 * column returned NFD makes `startsWith` false on our own line. The write-once
 * rule then appends: measured at five copies over four refill passes, one
 * `document_version` row each, which is precisely the growth write-once exists
 * to stop. Normalisation is applied to the TEST only; the column is never
 * rewritten.
 *
 * ⚠️ **`\r` alone is a line separator here.** This app runs on Windows against
 * text a user pastes, and `split(/\r?\n/)` cannot see an old-style `\r`-only
 * break — a marker line hidden behind one was invisible and duplicated.
 *
 * ⚠️ **The leading strip covers punctuation and a list marker.** `trimStart`
 * removes neither a zero-width space nor a BOM, and a fourth round then found
 * the harder half: `notes` is a column this app invites the user to edit, so our
 * line comes back as `- Titlul tipărit …` the moment somebody tidies their
 * notes into a list — and behind a pasted right-to-left mark or soft hyphen,
 * which are invisible. Every one of those made the line unrecognisable, and an
 * unrecognised line is appended to: the growth this rule exists to stop,
 * reached by a user formatting their own notes.
 *
 * ⚠️ **The list marker is `[\p{L}\p{N}]{1,3}[.)]`, not `\d+[.)]`, and the
 * punctuation run comes FIRST.** `a)`, `b.` and `(1)` are the ordinary Romanian
 * legal enumeration forms — in a Romanian property archive — and a digits-only
 * marker that had to start the line recognised none of them.
 *
 * ⚠️ **Both runs are BOUNDED.** Two adjacent unbounded negated classes over the
 * same characters is how a leading strip becomes quadratic on a long line of
 * punctuation; eight is far more than any real prefix and the pattern cannot
 * blow up.
 *
 * What the strip does not do is find the marker in the middle of a sentence: a
 * human writing "Ion zice că Titlul tipărit pe document este altul" is not our
 * line. It is not a perfect fence — a line that OPENS with a quote mark, or
 * with a short word and a full stop, is read as ours — and the failure there is
 * a record not written on a line that already quotes the heading, which is the
 * cheap direction to be wrong in.
 *
 * Exported because `runAiInterpret` has to answer the same question about the
 * value it is about to send, to decide whether the row may tell the user the
 * heading is in Notes. Two expressions for that would be a screen explaining a
 * decision the code did not make.
 */
export function hasPrintedHeadingLine(notes: string | null | undefined): boolean {
  if (!filled(notes)) return false;
  return notes
    .normalize("NFC")
    .split(/\r\n|\r|\n/)
    .some((l) =>
      l
        .replace(/^\s*[^\p{L}\p{N}]{0,8}(?:[\p{L}\p{N}]{1,3}[.)]\s*)?[^\p{L}\p{N}]{0,8}/u, "")
        .startsWith(PRINTED_HEADING_PREFIX),
    );
}
