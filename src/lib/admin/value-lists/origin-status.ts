/**
 * Which reference rows a person vouched for.                    (Slice #34.02)
 *
 * `lookup_tarla` and `lookup_institution` gained `origin` in migration_077, and
 * an administrator opening "Indicative Tarla" or "Instituții" needs to see at a
 * glance which rows somebody chose and which arrived as a side effect of an
 * import, and to narrow the list to the second group. This is the derivation
 * behind that word, the colour beside it, and the "only those awaiting review"
 * checkbox, in one place, for the same reason `src/lib/documents/status.ts`
 * gives: a colour that could contradict the label next to it is a bug nobody
 * can see in a diff.
 *
 * ⚠️ **THERE IS NO "MARK AS REVIEWED" ACTION, AND #34.02 DOES NOT ADD ONE.**
 * The filter narrows; nothing moves a row out of the narrowed set, because
 * `origin` is write-once and says who CREATED the row, not who has looked at
 * it. So an imported code an administrator has curated — given a description,
 * put in order — still reads "Creat la import" and still sits inside the
 * filter. That is the honest state of the column and it is what the slice
 * asked for; a `reviewed_at` is a different column and a different slice. The
 * retention set in `value-list-modal.tsx` is where such an action would hook
 * in, and says so.
 *
 * ⚠️ **A SECOND MODULE, NOT A SECOND COPY OF THE FIRST.** Document types have
 * THREE statuses and they are not derived from `origin` alone — "AI completed"
 * is `template_fields` being non-empty, and it WINS over the origin, because a
 * type an import created and a person has since given a form to is finished.
 * These two lists have no form, no template and no third state: the only fact
 * is who chose the value. Folding them into `documentTypeStatus` would mean a
 * function whose answer depends on which table the row came from, which is the
 * shape that lets one list's rule quietly change another's.
 *
 * What the two DO share is the vocabulary an administrator reads —
 * "Adăugat manual" / "Creat la import" — the blue that marks a machine-made
 * row, and the modal component that prints both. That is deliberate: three
 * lists in one screen answering the same question with different words, or in
 * different colours, would read as three different questions. The colour is
 * shared by IMPORT rather than by copy (see `LOOKUP_ORIGIN_STATUS_CLASS`); the
 * two message keys are separate strings with a test binding them equal, because
 * `messages/*.json` has no imports.
 *
 * Client-safe: pure constants and pure functions, no DB and no React.
 */

import { DOCUMENT_TYPE_STATUS_CLASS } from "@/lib/documents/status";

/**
 * `manual` — a person typed this into the list.
 * `imported` — a machine put it there while doing something else.
 *
 * ⚠️ **The STATUS ids are not the COLUMN values**, and the difference is not an
 * oversight. The column stores `MANUAL` / `IMPORT` because that is what
 * `lookup_document_type.origin` stores and one vocabulary across three tables
 * is the whole argument for reusing the word; the status ids are lower-camel
 * because they index `messages/*.json`, exactly as `documentTypeStatus`'s do.
 * Mapping between them happens here and nowhere else.
 */
export const LOOKUP_ORIGIN_STATUSES = ["manual", "imported"] as const;
export type LookupOriginStatus = (typeof LOOKUP_ORIGIN_STATUSES)[number];

/** The shape any row with an `origin` column arrives in, off the wire. */
export type LookupOriginInput = { origin?: unknown };

/**
 * ⚠️ **AN UNRECOGNISED VALUE READS AS `manual`, the same direction
 * migration_077's DEFAULT chooses.** (Not its "backfill" — that file says in as
 * many words that there is no backfill; `NOT NULL DEFAULT 'MANUAL'` is what
 * every existing row gets, which is a different thing from repairing one.) The
 * column is `NOT NULL` with a CHECK, so in a healthy database there is nothing
 * else to see — but a row restored from an older dump, or a list rendered
 * against a database the migration has not reached, would otherwise have to
 * render something. `manual` is the value that cannot make a NEW claim about an
 * old row: it says "a person put this here", which is what the list implied
 * before this column existed. The alternative — showing an unreviewed-looking
 * row for a code an administrator typed himself — is the wrong direction to be
 * wrong in.
 */
export function lookupOriginStatus(row: LookupOriginInput): LookupOriginStatus {
  return row.origin === "IMPORT" ? "imported" : "manual";
}

/**
 * The list's colour coding, keyed by the SAME status the word comes from.
 *
 * `manual` is the table's own body colour, so a list where nothing was imported
 * looks exactly as it did before this slice — the same property
 * `DOCUMENT_TYPE_STATUS_CLASS` holds for its `new`. `imported` is the blue that
 * list already uses for a row a machine created, so an administrator who has
 * learned one screen has learned all three.
 */
export const LOOKUP_ORIGIN_STATUS_CLASS: Record<LookupOriginStatus, string> = {
  manual:   "text-ink dark:text-zinc-300",
  // ⚠️ **DERIVED, NOT RE-TYPED, and an adversarial round caught the copy.**
  // The first version spelled the class string out here, character for
  // character the same as `DOCUMENT_TYPE_STATUS_CLASS.aiScanned` — and
  // `document-type-origin-single-source.test.ts` asserts that string appears in
  // exactly ONE file. It went red, and it was right to: the paragraph above
  // claims this is "the blue that list already uses", and a copy makes that
  // claim true only until somebody tunes one of them. Now it cannot be false.
  // (Which is also why this comment describes the value instead of quoting it:
  // that guard reads comments too.)
  imported: DOCUMENT_TYPE_STATUS_CLASS.aiScanned,
};

/** The class for a row, without naming the status twice. */
export function lookupOriginNameClass(row: LookupOriginInput): string {
  return LOOKUP_ORIGIN_STATUS_CLASS[lookupOriginStatus(row)];
}

/**
 * Is this row still waiting for a person to look at it?
 *
 * ⚠️ **DERIVED FROM `lookupOriginStatus`, NOT FROM `row.origin`, and that is
 * the whole reason this exists rather than a comparison at the call site.** It
 * is the rule `documentTypeAwaitsForm` follows one module over, for the failure
 * it names: a filter written against the raw column and a colour written
 * against the status can drift, and when they do the list hides a row it paints
 * as reviewed — which reads as the filter being broken rather than as two rules
 * disagreeing.
 *
 * ⚠️ **"Awaiting review" is NOT "blocked".** An imported tarla code is
 * selectable the moment it exists and this slice changes nothing about that.
 * The filter narrows what is on screen and nothing else.
 */
export function lookupAwaitsReview(row: LookupOriginInput): boolean {
  return lookupOriginStatus(row) === "imported";
}
