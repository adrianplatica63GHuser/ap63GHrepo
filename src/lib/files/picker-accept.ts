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
 * ⚠️ **A NARROW PICKER IS STILL A QUIET ONE, AND THIS SLICE DID NOT FIX
 * THAT.** What the browser's filter excludes is never offered, and no screen
 * says why — the user meets a file dialog that simply does not show their file
 * and has to find "All files" to learn anything. Naming the values here does
 * not change that; it makes the three sites one site, so the sentence — when
 * some later slice writes it — has one place to be true about. Recorded in
 * #34.06's handover and carried forward in #34.20's.
 */

/**
 * What the coordinate-file pickers offer.
 *
 * The extension AND the MIME type, because the two are not interchangeable:
 * some systems hand a `.txt` no MIME at all and some hand `text/plain` to a
 * file the user named something else. Offering both is what a picker is for —
 * it is an offer, never a check. `isDeclaredCoordinateFile` in
 * `@/lib/import/structure-rules` is the rule that actually decides, and it is
 * deliberately wider than this.
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
