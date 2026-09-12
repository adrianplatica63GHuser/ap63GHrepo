/**
 * The pickers that do NOT create a document page offer one list each, written
 * once.                                                        (Slice #34.20)
 *
 * Three `<input type="file">` elements hand-wrote their own `accept` value —
 * `calculation-view.tsx` and the coordinate half of `add-property-dialog.tsx`
 * both offered a coordinate file, and the photo half of the same dialog offered
 * a picture. Two of the three were the same string in two files, which is one
 * copy past the point at which the habit says to centralise.
 *
 * ⚠️ **`file-kinds-single-source.test.ts` CANNOT SEE ANY OF THIS.** Its
 * detectors police a string naming two or more DIFFERENT extensions;
 * `".txt,text/plain"` names one and `"image/*"` names none. So widening either
 * of these to a second MIME type, or wiring the two constants to each other's
 * input, is invisible to every other suite in the repo. That is what this file
 * is for.
 *
 * ⚠️ **AND ONLY ONE OF THE TWO IS PINNED THERE, WHICH IS WORTH KNOWING BEFORE
 * TIGHTENING THAT GUARD.** `".txt,text/plain"` has an `EVASIONS` row —
 * `{ name: "one-extension accept", … catches: false }` — so a future tightening
 * that caught it would fail its own table and be reconsidered. `"image/*"` has
 * no row: it is exempt only by a prose aside on `MULTI_EXT_STRING`
 * ("Deliberately blind to `image/*`"). A slice that later polices MIME
 * wildcards would therefore break `PROPERTY_PHOTO_ACCEPT` with nothing in
 * `EVASIONS` to stop it, and `picker-accept.ts` is not on that suite's
 * two-entry `ALLOWED` list — whose own honesty test pins it at exactly two.
 * A fourth adversarial round found this paragraph claiming both were pinned.
 *
 * ⚠️ **WHAT IT DOES NOT ASSERT: that the values are RIGHT.** They are offers,
 * not checks — `isDeclaredCoordinateFile` is the rule that decides — and a
 * picker's offer is a product decision, not a derivable one. What is asserted
 * is that the decision is made in one place and that the three pickers read it
 * from there.
 *
 * ⚠️ **AND SINCE SLICE #34.23, THAT EACH PICKER SAYS OUT LOUD WHAT ITS WINDOW
 * WILL SHOW.** #34.20's header recorded the thing it had not fixed: a narrow
 * picker is a quiet one, and a user whose file the filter excludes meets a
 * dialog that simply does not list it. The sentence is now beside all three,
 * and the extensions it names are `offeredExtensions` — derived from the
 * `accept` value rather than typed into `messages/*.json` two files away, which
 * would be the same duplication #34.20 removed, one layer up. The guards below
 * tie each sentence to its own picker, for the same reason the `accept`
 * assertions are tied to an element rather than to a file.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { stripComments } from "@/lib/dev/strip-comments";
import {
  COORDINATE_FILE_ACCEPT,
  COORDINATE_FILE_OFFER,
  offeredExtensions,
  PROPERTY_PHOTO_ACCEPT,
} from "@/lib/files/picker-accept";
import { scanIcu } from "@/test-support/icu";

const SRC = join(process.cwd(), "src");
const LOCALES = ["ro-RO", "en-GB"] as const;

/** The `shared.filePicker` block of a message file. */
function filePickerMessages(locale: (typeof LOCALES)[number]): Record<string, string> {
  const root = JSON.parse(
    readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
  ) as { shared: { filePicker: Record<string, string> } };
  return root.shared.filePicker;
}

function codeOf(relPath: string): string {
  return stripComments(readFileSync(join(SRC, ...relPath.split("/")), "utf8"));
}

/**
 * The three pickers — each named by something INSIDE its own `<input>`, and
 * that is the point.
 *
 * ⚠️ **A FOURTH ADVERSARIAL ROUND TRANSPOSED THE TWO INPUTS IN
 * `add-property-dialog.tsx` AND THIS FILE PASSED.** The first draft asserted
 * only that each FILE contained `accept={CONSTANT}`, and that dialog contains
 * both — so the photo picker offering `.txt,text/plain` (an empty folder where
 * the user's photographs are) and the coordinate picker offering `image/*`
 * (the `.txt` the parser needs, hidden) satisfied every row. `anchor` is what
 * ties a constant to an element rather than to a file; the third row needs it
 * least and gets it anyway, so a second input in that file cannot repeat this.
 */
const PICKERS: {
  file: string;
  anchor: string;
  constant: string;
  accept: string;
  /** The `shared.filePicker` key the sentence beside this picker must use. */
  messageKey: string;
  /** The id constant joining the input to that sentence. */
  offerId: string;
  /**
   * The `role="button"` wrapper that is the REAL control, where the picker has
   * one. Anchored on its `onKeyDown`, which names the same ref the input does,
   * so a wrapper cannot borrow its neighbour's row.
   */
  wrapperAnchor?: string;
  /**
   * The FORMAT hint's id, where the picker has one — the line that says which
   * image formats the route takes, or which columns the coordinate parser
   * reads.
   *
   * ⚠️ **IT IS IN THE ROWS BECAUSE A FOURTH ADVERSARIAL ROUND FOUND IT
   * UNGUARDED IN BOTH DIRECTIONS.** #34.23 added these ids after round 3 showed
   * the hints were announced by nothing; nothing then asserted them, so
   * dropping the hint from the description list, or deleting the `id` and
   * leaving the list pointing at nothing, both left the suite green. The
   * calculation screen has no format hint — its `HelpHint` is a popover, not a
   * line of text — so its row leaves this undefined and the assertions skip it.
   */
  hintId?: string;
}[] = [
  {
    file: "app/admin/calculation/_components/calculation-view.tsx",
    anchor: "onChange={handleFile}",
    constant: "COORDINATE_FILE_ACCEPT",
    accept: COORDINATE_FILE_ACCEPT,
    messageKey: "offersExtensions",
    offerId: "COORDINATE_PICKER_OFFER_ID",
  },
  {
    file: "app/properties/_components/add-property-dialog.tsx",
    anchor: "ref={textInputRef}",
    constant: "COORDINATE_FILE_ACCEPT",
    accept: COORDINATE_FILE_ACCEPT,
    messageKey: "offersExtensions",
    offerId: "COORDINATE_PICKER_OFFER_ID",
    wrapperAnchor:
      'onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") textInputRef.current?.click(); }}',
    hintId: "COORDINATE_PICKER_HINT_ID",
  },
  {
    file: "app/properties/_components/add-property-dialog.tsx",
    anchor: "ref={imageInputRef}",
    constant: "PROPERTY_PHOTO_ACCEPT",
    accept: PROPERTY_PHOTO_ACCEPT,
    messageKey: "offersImages",
    offerId: "PHOTO_PICKER_OFFER_ID",
    wrapperAnchor:
      'onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") imageInputRef.current?.click(); }}',
    hintId: "PHOTO_PICKER_HINT_ID",
  },
];

/**
 * How far after its `<input>` a picker's sentence may sit.   (Slice #34.23)
 *
 * Measured rather than guessed, and re-measured after the review rounds moved
 * the copy: the widest is `calculation-view.tsx` at ~800 characters, the two in
 * `add-property-dialog.tsx` at ~530 and ~570. The two anchors in that dialog
 * are ~5 600 apart — so 1 500 is wide enough that another block comment between
 * an input and its paragraph does not trip it, and far too narrow for one
 * picker's sentence to satisfy the other's assertion, which is the
 * transposition this file already fights over the `accept` values themselves.
 *
 * ⚠️ Note what makes this number move: `stripComments` keeps a comment's
 * NEWLINES, so a fourteen-line docblock added between the input and the
 * paragraph costs fourteen characters, not four hundred. The gap grew by ~190
 * across this slice for that reason alone.
 */
const MAX_GAP = 1500;

/** The one `<input …/>` element that carries `anchor`. */
function inputCarrying(code: string, anchor: string): string {
  const at = code.indexOf(anchor);
  if (at < 0) throw new Error(`no \`${anchor}\` to find an <input> around`);
  const open = code.lastIndexOf("<input", at);
  const close = code.indexOf("/>", at);
  if (open < 0 || close < 0) throw new Error(`no <input …/> around \`${anchor}\``);
  return code.slice(open, close + 2);
}

describe("the non-page pickers read their accept value from one module", () => {
  it("holds the values the three pickers were shipping", () => {
    // Pinned, so a widening is a deliberate edit to a test rather than a
    // one-word change nobody reviews. `.txt` AND the MIME type, because some
    // systems hand a text file no MIME and some hand `text/plain` to a file
    // named something else — a picker offers, it never checks.
    expect(COORDINATE_FILE_ACCEPT).toBe(".txt,text/plain");
    expect(PROPERTY_PHOTO_ACCEPT).toBe("image/*");
  });

  it("gives the two offers different values", () => {
    // The failure this catches is the transposition: a photo picker offering
    // `.txt` shows the user an empty folder and says nothing about why.
    expect(COORDINATE_FILE_ACCEPT).not.toBe(PROPERTY_PHOTO_ACCEPT);
  });

  it.each(PICKERS)("the input at $anchor reads $constant", ({ file, anchor, constant }) => {
    const input = inputCarrying(codeOf(file), anchor);
    expect(input).toContain(`accept={${constant}}`);
  });

  /**
   * ⚠️ The half that rots: an import added and the literal left behind, or a
   * FOURTH picker typing its own. A literal `accept="…"` in either file is the
   * shape this slice removed.
   */
  it.each([...new Set(PICKERS.map((p) => p.file))])("%s writes no literal accept value", (file) => {
    expect(codeOf(file)).not.toMatch(/accept\s*=\s*["'`]/);
  });
});

// ---------------------------------------------------------------------------
// The sentence beside each picker   (Slice #34.23)
// ---------------------------------------------------------------------------

describe("offeredExtensions", () => {
  /**
   * The one thing the copy needs and the `accept` value does not spell: the
   * file-name patterns a dialog will actually list. MIME types are dropped
   * because `text/plain` is not what a filter box shows and not a thing a user
   * can look for.
   */
  it("keeps the extensions and drops the MIME types", () => {
    expect(offeredExtensions(".txt,text/plain")).toEqual([".txt"]);
    expect(offeredExtensions(".pdf, .jpg ,image/jpeg")).toEqual([".pdf", ".jpg"]);
  });

  /**
   * ⚠️ **THE EMPTY ARRAY IS AN ANSWER, NOT A GAP.** `image/*` names no
   * extension, so the picker carrying it gets a sentence that names a KIND of
   * file. The pairing below is what makes that a rule rather than a habit.
   */
  it("answers nothing for a wildcard", () => {
    expect(offeredExtensions("image/*")).toEqual([]);
    expect(offeredExtensions("")).toEqual([]);
  });

  it("holds the one list a shipped picker names", () => {
    expect(COORDINATE_FILE_OFFER).toBe(".txt");
    expect(offeredExtensions(PROPERTY_PHOTO_ACCEPT)).toEqual([]);
  });

  /**
   * ⚠️ **EVERY CLAUSE OF EVERY `accept` VALUE HAS TO BE COVERED BY THE SENTENCE
   * BESIDE ITS PICKER, AND THIS IS WHERE THAT IS WRITTEN DOWN.** The dialog's
   * filter is the UNION of the clauses, so a clause the copy does not account
   * for is a window showing more than the sentence admits. `offeredExtensions`
   * cannot notice this by itself: it drops MIME types, so adding `text/csv` to
   * `COORDINATE_FILE_ACCEPT` changes neither `COORDINATE_FILE_OFFER` nor the
   * pairing check below, and the copy would quietly stop describing the window.
   * Adding a clause therefore fails HERE, and the fix is a decision about the
   * copy rather than a new entry added to make the red go away.
   */
  const CLAUSE_COVER: Record<string, string> = {
    ".txt": "listed by offeredExtensions, so `offersExtensions` names it",
    "text/plain":
      "the same files as `.txt` on Windows, which is where this ships — see `offeredExtensions`",
    "image/*": "the word „imagini”/„pictures” in `offersImages`",
  };

  it("names what covers every clause of every picker's accept value", () => {
    const clauses = new Set(
      PICKERS.flatMap((p) => p.accept.split(",").map((c) => c.trim())).filter((c) => c !== ""),
    );
    expect([...clauses].sort()).toEqual(Object.keys(CLAUSE_COVER).sort());
  });
});

describe("the copy beside each picker", () => {
  it.each(LOCALES)("%s carries both sentences", (locale) => {
    const block = filePickerMessages(locale);
    for (const key of ["offersExtensions", "offersImages"]) {
      expect(typeof block[key]).toBe("string");
      expect(block[key].trim()).not.toBe("");
    }
  });

  /**
   * Exactly one placeholder on the sentence that lists, and none on the one
   * that does not. A `{list}` that went missing would print "arată doar
   * fișiere ." at a user.
   */
  it.each(LOCALES)("%s names the list once and only where there is one", (locale) => {
    const block = filePickerMessages(locale);
    expect([...scanIcu(block.offersExtensions).args]).toEqual(["list"]);
    expect([...scanIcu(block.offersImages).args]).toEqual([]);
  });

  /**
   * ⚠️ **THE COPY IS AN OFFER AND MUST NOT READ AS A CHECK, WHICH IS THE ONE
   * THING ABOUT IT THAT CAN GO QUIETLY WRONG.** `accept` filters a file dialog;
   * it decides nothing about what the screen behind it will take. On all three
   * of these screens the handler reads the file's CONTENT and never looks at
   * its name — `handleFile` in `calculation-view.tsx` calls `file.text()`,
   * `handleImportText` posts the text to the parse route, `handleProcess` posts
   * the image — so a correctly-formed export named anything at all still works.
   * "Only .txt files are accepted" is therefore false the first time somebody
   * renames a file, and it talks a user out of a file the parser would have
   * read. The word list is small on purpose: it catches the natural rewrite,
   * not every possible one.
   *
   * ⚠️ Not `isDeclaredCoordinateFile`, which an earlier draft cited here and a
   * third adversarial round corrected: that rule is STR-08's, it is NARROWER
   * than this `accept` value (`.txt` AND a `coord…` name), and its only caller
   * is the bulk-import dialog — a different screen entirely.
   */
  it.each(LOCALES)("%s says what the window shows, not what is accepted", (locale) => {
    const forbidden = locale === "ro-RO"
      ? [/accept/i, /permis/i, /sunt admise/i]
      : [/accepted/i, /allowed/i, /supported/i];
    for (const sentence of Object.values(filePickerMessages(locale))) {
      for (const pattern of forbidden) expect(sentence).not.toMatch(pattern);
    }
  });
});

describe("each picker carries its own sentence", () => {
  /**
   * ⚠️ **THE PAIRING IS DERIVED FROM THE `accept` VALUE, NOT DECLARED BESIDE
   * IT.** A picker that names extensions must use the sentence that lists them.
   * So widening `PROPERTY_PHOTO_ACCEPT` from `image/*` to a list of extensions
   * fails HERE, with the copy still saying „doar imagini” — rather than
   * shipping a sentence that has quietly stopped describing the window.
   *
   * ⚠️ **AND THE OTHER ARM IS `image/*`, NOT "NO EXTENSIONS", WHICH A SECOND
   * ADVERSARIAL ROUND CHANGED.** Written as an else, this rule REQUIRES
   * „Fereastra de fișiere arată doar imagini” of a future picker whose `accept`
   * is `application/pdf` — no dotted clause and no pictures — and goes red on
   * any correct sentence for it. A rule that fails toward wrong copy is worse
   * than no rule, so the wildcard is named: a third shape has to be a copy
   * decision, taken here, not a sentence inherited by default.
   */
  it.each(PICKERS)("$anchor uses the sentence its accept value calls for", ({ accept, messageKey }) => {
    if (offeredExtensions(accept).length > 0) {
      expect(messageKey).toBe("offersExtensions");
    } else {
      // Reaching here with anything else means a new picker shape with no
      // sentence written for it — add the key and the copy, then this row.
      expect(accept).toBe(PROPERTY_PHOTO_ACCEPT);
      expect(messageKey).toBe("offersImages");
    }
  });

  it.each(PICKERS)("$file: the sentence at $anchor is $messageKey", ({ file, anchor, messageKey }) => {
    const code = codeOf(file);
    const at = code.indexOf(anchor);
    expect(at).toBeGreaterThan(-1);
    const sentence = code.indexOf(`filePicker.${messageKey}`, at);
    expect(sentence).toBeGreaterThan(at);
    expect(sentence - at).toBeLessThan(MAX_GAP);
  });

  /**
   * And the list it interpolates comes from the module rather than from a
   * literal — the whole reason `COORDINATE_FILE_OFFER` exists.
   */
  it.each(PICKERS.filter((p) => p.messageKey === "offersExtensions"))(
    "$file: the sentence at $anchor interpolates COORDINATE_FILE_OFFER",
    ({ file, anchor }) => {
      const code = codeOf(file);
      const at = code.indexOf(anchor);
      const call = code.slice(at, at + MAX_GAP);
      // Whitespace-tolerant: a formatter that emits `{list: …}` is not a defect.
      expect(call).toMatch(/\{\s*list:\s*COORDINATE_FILE_OFFER\s*\}/);
    },
  );

  /**
   * ⚠️ **AND THE INPUT POINTS AT ITS OWN SENTENCE, WHICH IS THE ONLY REASON THE
   * SENTENCE REACHES THE USER MOST LIKELY TO NEED IT.** All three inputs are
   * `sr-only`, and their accessible name is the button text and nothing else —
   * from the wrapping `<label>` in `calculation-view.tsx`, from an `aria-label`
   * in `add-property-dialog.tsx`. A paragraph that is merely adjacent is
   * announced by nothing. `aria-describedby` is what attaches it — and this is
   * tied to the ELEMENT through `inputCarrying`, for the same reason the
   * `accept` assertions above are: a file-wide `toContain` is satisfied by the
   * other picker's wiring.
   *
   * ⚠️ **IN `add-property-dialog.tsx` THE WRAPPER CARRIES IT TOO, AND THAT IS
   * THE HALF THAT ACTUALLY REACHES THE USER.** There the control is a
   * `<div role="button">` with its own name and click handler; the `sr-only`
   * input is a second tab stop. A description on the input alone is never heard
   * by somebody who reaches the button. The wrapper is anchored by its
   * `onKeyDown`, which names the same ref as the input does.
   */
  /**
   * ⚠️ **THE ATTRIBUTE'S VALUE IS A LIST, SO THIS MATCHES INSIDE IT.**
   * `add-property-dialog.tsx` describes its pickers with the format hint AND
   * this sentence — `aria-describedby={\`${HINT} ${OFFER}\`}` — because a third
   * adversarial round found the hints had never been announced either. What has
   * to hold is that the offer id is in the list, not that it is the whole list.
   */
  it.each(PICKERS)("$file: the input at $anchor is described by $offerId", ({ file, anchor, offerId, hintId }) => {
    const code = codeOf(file);
    // One balanced `{…}` level, so a list of any length matches. The earlier
    // `[^}]*\}?[^}]*` admitted exactly two closing braces and would have gone
    // RED on a correct three-id list — a guard failing toward blocking right
    // copy, which is the standard this file sets one describe-block above.
    const describedBy = inputCarrying(code, anchor).match(
      /aria-describedby=\{(?:[^{}]|\{[^{}]*\})*\}/,
    );
    expect(describedBy).not.toBeNull();
    for (const id of [hintId, offerId].filter((x): x is string => x !== undefined)) {
      expect(describedBy?.[0]).toContain(id);
      // …and something in the file actually carries that id.
      expect(code).toContain(`id={${id}}`);
    }
  });

  /**
   * The wrapper, where there is one. `calculation-view.tsx`'s picker is an
   * `<input>` inside a `<label>` — one control, already covered above — so it
   * has no row here; the two drop zones in `add-property-dialog.tsx` do.
   */
  it.each(PICKERS.filter((p) => p.wrapperAnchor !== undefined))(
    "$file: the drop zone at $wrapperAnchor is described by $offerId",
    ({ file, wrapperAnchor, offerId, hintId }) => {
      const code = codeOf(file);
      const at = code.indexOf(wrapperAnchor as string);
      expect(at).toBeGreaterThan(-1);
      // The rest of this element's opening tag. Cut at the next `<` — the
      // element's first child — and NOT at the next `>`, which the arrow
      // function inside the anchor itself would supply.
      const rest = code.slice(at, code.indexOf("<", at));
      expect(rest).toContain("aria-describedby=");
      for (const id of [hintId, offerId].filter((x): x is string => x !== undefined)) {
        expect(rest).toContain(id);
      }
    },
  );

  /**
   * ⚠️ The half that rots here: a fourth picker, or an extension typed into the
   * copy. Neither component may write an extension of its own beside a
   * sentence the module is supposed to be building.
   */
  it.each([...new Set(PICKERS.map((p) => p.file))])("%s writes no extension into its copy", (file) => {
    expect(codeOf(file)).not.toMatch(/list:\s*["'`]/);
  });
});
