/**
 * The `accept` values for the pickers that do NOT upload a document page.
 *                                                               (Slice #34.20)
 *
 * ⚠️ **THREE PICKERS EACH TYPED THEIR OWN LIST, AND TWO OF THEM TYPED THE SAME
 * ONE.** `admin/calculation/_components/calculation-view.tsx` and the
 * coordinate half of `properties/_components/add-property-dialog.tsx` both
 * offered a coordinate file; the photo half of the same dialog offered a
 * picture. Nothing joined any of them, so the answer to "what may a user hand
 * this screen?" was written three times in two files — which is one copy past
 * the point where the habit says to centralise, and exactly the shape
 * `UPLOAD_ACCEPT_ATTRIBUTE` exists to prevent on the page picker.
 *
 * ⚠️ **AND THEY ARE NOT DERIVED FROM THE REGISTRY, DELIBERATELY, WHICH IS WHY
 * THEY LIVE HERE AND NOT IN `file-kinds.ts`.** That file answers "what kind of
 * file is this, and may it enter the archive as a page?", and
 * `UPLOAD_ACCEPT_ATTRIBUTE` is computed from its answer. Neither of the values
 * below creates a document page: one names the single format the coordinate
 * parser reads, the other is a browser wildcard for a photograph that is
 * uploaded to a different route entirely. Deriving either from the uploadable
 * set would be wrong in the widening direction — it would offer a spreadsheet
 * to a coordinate parser.
 *
 * ⚠️ **A NARROW PICKER WAS A QUIET ONE UNTIL SLICE #34.23, AND THE SENTENCE IT
 * WROTE IS DRAWN FROM HERE.** What the browser's filter excludes is never
 * offered, and no screen said why — the user met a file dialog that simply did
 * not show their file and had to find "All files" to learn anything. #34.20
 * named the values here so that the sentence, when somebody wrote it, would
 * have one place to be true about; #34.23 wrote it. Each of the three pickers
 * now carries one line saying what its file window will and will not show, and
 * the list of extensions in that line is `offeredExtensions` below rather than
 * a second copy typed beside the copy — widen an `accept` value and the
 * sentence widens with it. Recorded in #34.06's handover and carried forward in
 * #34.20's.
 *
 * ⚠️ **AND THE SENTENCE IS WORDED AS AN OFFER, WHICH IS NOT A STYLE
 * PREFERENCE.** `accept` decides what a file DIALOG lists; it decides nothing
 * about what the screen behind it will take. Copy that says "only .txt files
 * are accepted" is false the first time somebody renames a file, and it talks a
 * user out of a file the parser would have read. So the copy says what the
 * window shows and where the switch is, and says nothing about what happens
 * next.
 */

/**
 * What the coordinate-file pickers offer.
 *
 * The extension AND the MIME type, because the two are not interchangeable:
 * some systems hand a `.txt` no MIME at all and some hand `text/plain` to a
 * file the user named something else. Offering both is what a picker is for —
 * it is an offer, never a check.
 *
 * ⚠️ **AND NOT BECAUSE `isDeclaredCoordinateFile` IS WIDER — IT IS NARROWER,
 * AND IT IS ABOUT A DIFFERENT SCREEN.** (Corrected in #34.23, by a third
 * adversarial round; #34.20 wrote the opposite here.) That rule is
 * `coordinateNameConfidence(name) === "strong"`: `.txt` AND a name folding to
 * `coord…`, so it admits a strict subset of what this offers, and its only
 * caller is `bulk-import-dialog.tsx`, where it is STR-08's folder rule. What
 * actually decides on the two screens that use THIS value is the parse:
 * `handleFile` reads `file.text()`, `handleImportText` posts the text to the
 * parse route, and neither looks at the file's name at all. That is why the
 * sentence beside these pickers says what the window lists and stops there.
 */
export const COORDINATE_FILE_ACCEPT = ".txt,text/plain";

/**
 * What the property-photograph picker offers.
 *
 * A wildcard rather than a list, and that is the honest value here: the photo
 * is a picture of a place, taken by whatever the user's phone or camera
 * produces, and the route that receives it is not the document-page route whose
 * registry decides what the archive may hold. The one cost of a wildcard is
 * recorded on `UPLOAD_ACCEPT_ATTRIBUTE`: every OS resolves `image/*` to include
 * HEIC, which belongs to no kind. That matters where a kind is looked up, and
 * here nothing looks one up.
 */
export const PROPERTY_PHOTO_ACCEPT = "image/*";

/**
 * The file-name patterns an `accept` value actually shows a user, in the order
 * it names them.                                                (Slice #34.23)
 *
 * ⚠️ **THIS IS WHAT THE COPY BESIDE A PICKER IS BUILT FROM, SO THAT THE TWO
 * CANNOT DRIFT.** The alternative is a sentence with ".txt" typed into it in
 * `messages/*.json`, two files away from the value it describes and in two
 * locales — which is the same shape #34.20 removed from the `accept` attributes
 * themselves, re-introduced one layer up.
 *
 * ⚠️ **A WILDCARD MIME TYPE NAMES NO EXTENSION, AND THE EMPTY ARRAY IS THE
 * ANSWER RATHER THAN A GAP.** `image/*` cannot be listed — every OS resolves it
 * differently, and #34.20's note on `PROPERTY_PHOTO_ACCEPT` records that HEIC
 * rides along with it — so the picker that carries it gets a sentence naming a
 * KIND of file instead of a list. `picker-accept.test.ts` pairs the two: a
 * picker with extensions must use the sentence that names them, one without
 * must use the sentence that does not. Widening `image/*` to a list of
 * extensions therefore fails that test rather than silently leaving the copy
 * behind.
 *
 * ⚠️ **MIME TYPES ARE DROPPED RATHER THAN SHOWN, AND THAT MAKES THE SENTENCE
 * SLIGHTLY NARROWER THAN THE WINDOW.** `text/plain` is not what a file dialog
 * puts in its filter box and not a thing a user can look for, so naming it
 * would help nobody — but the dialog's filter is the UNION of the clauses, so
 * it also lists whatever the platform maps to that MIME type. On Windows, which
 * is where this ships, that is `.txt`, so „arată doar fișiere .txt" is true
 * there; on another platform it could also list a `.log`. The error direction
 * is the safe one — a user told about `.txt` who finds more than `.txt` is not
 * misled into leaving a file behind — and the clause table in
 * `picker-accept.test.ts` is what stops it getting worse: every clause of every
 * `accept` value has to be named there with what covers it, so adding
 * `text/csv` fails until somebody decides what the copy says about it.
 */
export function offeredExtensions(accept: string): readonly string[] {
  return accept
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("."));
}

/**
 * What the coordinate-file sentence lists: `.txt`.
 *
 * There is deliberately no `PROPERTY_PHOTO_OFFER` beside it. `image/*` names no
 * extension, so the constant would be `""` and nothing would ever render it —
 * an exported value with no reader, which is the shape this repo keeps removing
 * rather than adding. The photo picker's sentence names a KIND of file instead,
 * and `picker-accept.test.ts` is what pairs the two.
 */
export const COORDINATE_FILE_OFFER = offeredExtensions(COORDINATE_FILE_ACCEPT).join(", ");
