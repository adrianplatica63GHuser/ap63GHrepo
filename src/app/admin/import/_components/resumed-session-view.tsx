"use client";

/**
 * ResumedSessionView — Slice #21.01.Import (session-persistence fix)
 *
 * Displays the results of a PREVIOUS import session that was saved to
 * localStorage.  Shown when the user clicks "Resume last import" on the
 * wizard's Structure screen (the phase was called `idle` until Slice #26.04
 * renamed it, and the button has not moved).
 *
 * File System Access API handles are not available in a resumed session, so no
 * file-backed action is available here.  The "Open →" links open each
 * document in a new tab, which is the primary use-case (the user navigated
 * away to inspect a document and wants to come back to the list).
 *
 * The "New import" button clears the saved session and returns to the
 * Structure phase, where the rules and the folder picker are, so the user can
 * pick a fresh folder.
 *
 * ⚠️ **AND SINCE SLICE #29.11 IT SAYS WHICH OF ITS LINKS ARE DEAD.** A saved
 * report holds a `docId` per row and nothing else, and nothing checked those
 * ids against the archive — so after #29.04 gave Adrian a way to empty the
 * database, which he now does deliberately and often, this screen listed
 * PROP01429 and three DOC codes against a database that no longer held any of
 * them, each with a live "Deschide →" that 404s. The wizard audits the report
 * before it offers Resume and hands the answer down as `audit`; every state of
 * that answer, INCLUDING "we could not ask", is said out loud here rather than
 * defaulting to the reassuring one. This screen is read-only by design — File
 * System Access handles cannot be serialised (`session.ts`) — so saying so is
 * the only lever there is.
 */

import { useTranslations } from "next-intl";
import type { SavedImportEntry, SavedImportSession } from "@/lib/import/session";
import type { SavedSessionAudit } from "@/lib/import/session-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minutesAgo(isoString: string): number {
  return Math.round((Date.now() - new Date(isoString).getTime()) / 60_000);
}

/**
 * What a finished row says about itself, apart from where it points.
 *                                                            (Slice #26.08,
 *                                                             hoisted #29.11)
 *
 * Two branches of `StatusBadge` draw these — the row whose document is still in
 * the archive, and the row whose document is gone — and they must draw the same
 * thing, because both are reporting what this run did. A second copy of the
 * markup is a second place to edit for one badge, and the indigo `className`
 * below is exactly the sort of forty characters that drift apart unnoticed.
 */
function DoneBadges({ entry }: { entry: SavedImportEntry }) {
  const tD = useTranslations("adminImport.wizard.importDialog");
  return (
    <>
      {/* Slice #26.08 — this row created nothing. The link beside it still
          points at a real document (the archive's own), and without this badge
          the row is indistinguishable from one this run wrote. */}
      {entry.preexisting !== undefined && (
        <span className="text-[10px] font-medium text-sky-700 dark:text-sky-400">
          {entry.preexisting === "linked"
            ? tD("preexistingLinked")
            : tD("preexistingSkipped")}
        </span>
      )}
      {entry.aiProcessed && (
        <span
          className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
          title={tD("aiProcessedBadge")}
        >
          ✓ AI
        </span>
      )}
    </>
  );
}

function StatusBadge({
  entry,
  gone,
}: {
  entry: SavedImportEntry;
  /**
   * The archive was asked, and it no longer holds this row's document.
   *                                                            (Slice #29.11)
   *
   * ⚠️ **`false` MEANS "not known to be gone", WHICH IS NOT THE SAME AS "still
   * there", and an adversarial round made this say so.** It is `false` both for
   * a row the archive confirmed and for every row when the lookup could not be
   * made at all — in the second case the links stay live. That is deliberate
   * and it is where the honesty is carried instead: the banner above the table
   * says the check failed and that the report may no longer match, which is the
   * remedy #29.01's F12 asks for when validation is impossible ("or the resumed
   * view says plainly that it may no longer match the archive"). Striking every
   * link off a report that is very probably fine, because one request did not
   * arrive, would be the opposite overclaim.
   */
  gone: boolean;
}) {
  // Reuse the same i18n keys as BulkImportDialog's ResultRow so the labels
  // stay consistent.
  const tD = useTranslations("adminImport.wizard.importDialog");
  const t = useTranslations("adminImport.wizard");

  // ⚠️ Before the `done` branch, not inside it: a row whose document is gone is
  // still `status: "done"` — it WAS imported — so the link is what has to go,
  // not the row.
  //
  // ⚠️ **AND THE BADGES SURVIVE.** An adversarial round found the first version
  // replacing the whole cell: a row that was `linked` to an existing archive
  // document, or that had been AI-processed, lost that fact the moment the
  // document was deleted. This is a report of what HAPPENED, and what happened
  // does not change because the archive was emptied afterwards. What stops
  // being true is the link — which is why `DoneBadges` is a component and not a
  // second copy of the same forty characters of Tailwind in each branch.
  if (entry.status === "done" && entry.docId && gone) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <DoneBadges entry={entry} />
        <span className="text-xs text-amber-700 dark:text-amber-400">
          {t("resumedRowGone")}
        </span>
      </span>
    );
  }

  if (entry.status === "done" && entry.docId) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <DoneBadges entry={entry} />
        <a
          href={`/documents/${entry.docId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          {tD("viewLink")}
        </a>
      </span>
    );
  }
  if (entry.status === "error") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-red-600 dark:text-red-400" title={entry.errorMsg}>
          {tD("errorShort")}
        </span>
        {/* ⚠️ **WHAT THE RUN LEFT BEHIND, and this is the artefact that has to
            carry it.** (Slice #32.05.) The screen and the saved HTML page both
            say a page group landed three of its five pages, or that a scanless
            Document is in the archive under this row's name; the resumed view
            is the only one of the three that survives a reload, and it showed a
            bare "eroare". Same keys as the live row, so the three cannot word it
            differently. The `"left"` row carries a `docId` on purpose — it is
            the one error row that names something worth opening — and it is
            drawn as its own link rather than through the `done` branch above,
            which means "this file was imported". */}
        {entry.pagesUploaded !== undefined && (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {tD("pagesPartial", {
              uploaded: entry.pagesUploaded,
              total: entry.pagesExpected ?? 0,
            })}
          </span>
        )}
        {entry.emptyDocument !== undefined && (
          <span
            className={
              entry.emptyDocument === "removed"
                ? "text-xs font-medium text-fade dark:text-zinc-400"
                : "text-xs font-medium text-amber-700 dark:text-amber-400"
            }
          >
            {entry.emptyDocument === "removed"
              ? tD("emptyDocumentRemoved")
              : tD("emptyDocumentLeft")}
          </span>
        )}
        {/* ⚠️ **AND THE `gone` CASE IS ANSWERED RATHER THAN LEFT BLANK, which
            the `done` branch above already does.** A user who did what
            `emptyDocumentLeft` told them — delete the scanless document — comes
            back to a row still instructing them to delete it, and the first
            draft simply removed the link, leaving an instruction with nothing
            to act on. `resumedRowGone` is the same sentence the imported rows
            use for the same fact. */}
        {(entry.emptyDocument === "left" || entry.pagesUploaded !== undefined) &&
          entry.docId !== undefined &&
          (gone ? (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {t("resumedRowGone")}
            </span>
          ) : (
            <a
              href={`/documents/${entry.docId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-amber-700 underline hover:no-underline dark:text-amber-400"
            >
              {entry.emptyDocument === "left" ? tD("emptyDocumentOpen") : tD("viewLink")}
            </a>
          ))}
        {entry.cornerClaimLost === true && (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {tD("cornerClaimLost")}
          </span>
        )}
      </span>
    );
  }
  return <span className="text-xs text-fade">—</span>;
}

function ConfidenceDot({ confidence }: { confidence?: "high" | "medium" | "low" }) {
  if (!confidence) return null;
  const cls =
    confidence === "high"   ? "bg-emerald-500" :
    confidence === "medium" ? "bg-amber-400"   :
                              "bg-red-500";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${cls} mr-1 flex-shrink-0`}
      title={confidence}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  session:  SavedImportSession;
  /**
   * What the archive said about this report's documents.   (Slice #29.11)
   *
   * `null` while the question is still in flight, `{ ok: false }` when it could
   * not be asked at all. Three states and not two, because the difference
   * between "everything is still there" and "we do not know" is the whole
   * complaint F12 records — and a boolean would have collapsed them.
   */
  audit:    SavedSessionAudit | null;
  onClear:  () => void;
};

export function ResumedSessionView({ session, audit, onClear }: Props) {
  const t = useTranslations("adminImport.wizard");
  const mins = minutesAgo(session.savedAt);

  // Slice #26.08 — rows the archive already held are `done` and created
  // nothing, so counting them here reported them as imported. See
  // `SavedImportEntry.preexisting`, which exists for exactly this line.
  const doneCount = session.entries.filter(
    (e) => e.status === "done" && e.preexisting === undefined,
  ).length;
  const preexistingCount = session.entries.filter((e) => e.preexisting !== undefined).length;
  const errorCount = session.entries.filter((e) => e.status === "error").length;

  /**
   * Is this row's document gone?
   *
   * Answers `false` for every row until the lookup comes back, which is the
   * under-claiming direction: the row keeps its link for a moment and the
   * banner above already says the check is running. The opposite default would
   * strike every link off a report that is perfectly fine.
   *
   * ⚠️ **FOLDED, because `missing` is.** `document.id` is a Postgres `uuid` and
   * always comes back lower-case, so `auditSavedSession` normalises the ids it
   * asks about to the same form; a row whose saved `docId` is upper-case would
   * otherwise never match its own entry in the set. See that function's note.
   */
  const isGone = (entry: SavedImportEntry): boolean =>
    audit !== null &&
    audit.ok &&
    entry.docId !== undefined &&
    audit.missing.has(entry.docId.toLowerCase());

  /**
   * The one sentence about whether this report still matches the archive.
   *
   * ⚠️ **`null` IS A STATE, and the `<p>` is not rendered for it.** Returning an
   * empty paragraph left a mounted node inside a `space-y-3` list, so the gap
   * above the hint doubled for no reason a reader could see.
   */
  const archiveLine: string | null =
    audit === null
      ? t("resumedChecking")
      : !audit.ok
        ? t("resumedCheckFailed")
        : audit.missing.size > 0
          ? t("resumedGone", { count: audit.missing.size, total: audit.linked })
          : // ⚠️ `linked > 0`, and an adversarial round added it. A run that died
            // on document one, or whose every row errored, saves a report in
            // which no row carries a `docId` at all — so the audit answers
            // `{ ok: true, missing: ∅, linked: 0 }`, honestly, and the all-clear
            // branch then reassured the user that every document in the report
            // was still in the archive, over a table of nothing but errors. An
            // answer about an empty set is not a sentence.
            audit.linked > 0
            ? t("resumedStillThere")
            : null;

  const archiveTone =
    audit !== null && (!audit.ok || audit.missing.size > 0)
      ? "text-amber-700 dark:text-amber-400"
      : "text-fade";

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t("resumedTitle", { folder: session.rootFolderName })}
          </p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            {t("resumedAge", { minutes: mins })}
            {" · "}
            {doneCount} {t("resumedDone")}
            {preexistingCount > 0 && ` · ${t("resumedPreexisting", { count: preexistingCount })}`}
            {errorCount > 0 && ` · ${errorCount} ${t("resumedErrors")}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900/30"
        >
          {t("resumedNewImport")}
        </button>
      </div>

      {/* ── Does this report still match the archive?   (Slice #29.11) ────

          Four states, all four said out loud. The two that matter most are the
          ones a boolean would have merged: "we could not ask" is not "it is
          fine", and it is the state a signed-out session or a route that is
          down produces. The all-clear is deliberately quiet: it is one line of
          ordinary body text, not a green card, and it is not said at all for a
          report that links to no documents — the report matching the archive is
          the state the user assumed anyway, and a reassurance about an empty set
          is worse than silence.

          ⚠️ **NO `role="status"`, and an adversarial round removed the one the
          first draft had.** The audit is started when the WIZARD mounts, and
          this view is not mounted until the user presses Resume some seconds
          later — so the answer is almost always already in state and the
          paragraph enters the DOM together with its final text. A live region
          created with its content is not reliably announced; `import-wizard.tsx`
          and `import-step-gate.tsx` both record that, and both solve it with a
          permanently-mounted region instead. This sentence sits in ordinary
          document order directly under the header bar and above the table it is
          about, which is where a reader meets it anyway. */}
      {archiveLine !== null && (
        <p className={`text-xs ${archiveTone}`}>{archiveLine}</p>
      )}

      {/* Hint */}
      <p className="text-xs text-fade">
        {t("resumedHint")}
      </p>

      {/* Results table */}
      <div className="overflow-x-auto rounded-xl border border-card-rim bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-crease text-left text-xs font-semibold uppercase tracking-wide text-fade dark:border-zinc-700">
              <th className="px-4 py-2 pr-3">{t("colPath")}</th>
              <th className="px-4 py-2 pr-3">{t("colDescription")}</th>
              <th className="w-24 px-4 py-2">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {session.entries.map((entry) => (
              <tr
                key={entry.path}
                className={[
                  "border-b border-crease dark:border-zinc-800",
                  entry.status === "error" ? "bg-red-50/40 dark:bg-red-950/20" : "",
                ].join(" ")}
              >
                {/* Name + path */}
                <td className="px-4 py-2 pr-3 min-w-0">
                  <span
                    className="block truncate font-mono text-xs text-ink dark:text-zinc-200"
                    title={entry.path}
                  >
                    {entry.displayName}
                  </span>
                  <span className="text-[10px] text-fade">{entry.path}</span>
                </td>

                {/* AI scan description */}
                <td className="px-4 py-2 pr-3 min-w-0 max-w-xs">
                  {entry.scanDescription ? (
                    <span className="flex items-start gap-1 text-xs text-ink dark:text-zinc-300">
                      <ConfidenceDot confidence={entry.confidence} />
                      <span className="line-clamp-2">{entry.scanDescription}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-fade">—</span>
                  )}
                </td>

                {/* Status / link */}
                <td className="px-4 py-2">
                  <StatusBadge entry={entry} gone={isGone(entry)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
