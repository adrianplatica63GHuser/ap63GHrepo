"use client";

/**
 * The review step between AI Discovery and a document type's custom form.
 *                                                          (Slice #26.11)
 *
 * Discovery reads a document and reports the label -> value pairs it found.
 * This dialog turns that report into a decision: which of those labels become
 * fields on THIS DOCUMENT TYPE's form, what each one is called, and what kind
 * of value it holds. On "save", the accepted rows are appended to the type's
 * `template_fields` and every subsequent import of that type fills them
 * automatically — the type is not touched until then.
 *
 * WHY A REVIEW STEP AT ALL
 * ------------------------
 * Discovery is a read of ONE document by a model that was given no schema, so
 * its output is a good first draft and nothing more: it will report the page
 * header as a field, split one value across two labels, and read a date as a
 * number. Writing that straight onto the type would put those mistakes into
 * the extraction prompt for every future document of that type, where nobody
 * would ever see them again. The evidence column is the point of the screen —
 * each row is shown beside the value that produced it, so the decision is made
 * against what was actually on the page rather than against a field name.
 *
 * WHAT IT CANNOT DO, ON PURPOSE
 * -----------------------------
 * It cannot remove or edit a field the type already has. Those are listed,
 * greyed, as already captured so the user can see they are kept — a discovery
 * run on a type that already has a form is a normal thing to do (it is how you
 * find what is still unrecognised) and it must be additive. The same block
 * holds the rows the system captures some OTHER way: the four generic columns
 * every document has, and the type's person roles, which the import links to
 * real Person records rather than to free text.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui/button-styles";
import type { DiscoverConfidence } from "@/lib/documents/discover-log";
import {
  buildFieldHint,
  formValueForField,
  MAX_TEMPLATE_FIELDS,
  proposeTemplateFields,
  type DiscoveredFieldProposal,
} from "@/lib/documents/discover-to-template";
import {
  parseTemplateFields,
  type DocumentTemplateField,
  type DocumentTemplateFieldType,
} from "@/lib/documents/template-fields";

const FIELD_TYPES: DocumentTemplateFieldType[] = ["text", "textarea", "date", "number"];

/** What the dialog shows and edits — a proposal plus the user's decisions. */
type Row = DiscoveredFieldProposal & {
  /**
   * Identity for React and for `patchRow`, NOT the field key.
   *
   * Two discovered labels can legitimately resolve to one already-captured
   * field ("Nr." and "Număr" both mean the document's number; a curated field
   * is reachable both by its key and by the slug of its caption), so `key` is
   * unique among the rows that can be SAVED but not among all rows.
   */
  rowId:   string;
  include: boolean;
  label:   string;
};

export type DiscoverReviewPair = {
  name:       string;
  value:      string;
  confidence: DiscoverConfidence;
};

type Props = {
  /** The pairs discovery reported, in the model's own reading order. */
  pairs:        readonly DiscoverReviewPair[];
  /** The type these fields would be saved onto. */
  typeId:       string;
  typeName:     string;
  /** The type's current template — kept whole, shown as already captured. */
  existing:     readonly DocumentTemplateField[];
  /** The type's person roles — captured as linked Persons, never as text. */
  partyRoleNames: readonly string[];
  /** Pages discovery could not send, and whether it ran out of output budget. */
  skippedPages: number;
  truncated:    boolean;
  /**
   * Called after a successful save, with how many fields the SERVER added and
   * the values discovery read for them. The caller writes those into the form
   * it is standing on — see its own comment for why that is not optional.
   */
  onSaved:      (addedFieldCount: number, values: Record<string, string>) => void;
  /**
   * Called when the stored template turned out to have moved on under us, so
   * the caller can refresh its own copy. This dialog does NOT depend on that
   * refresh: it reseeds from the fields the 409 itself returned.
   */
  onTypesChanged: () => void;
  onClose:      () => void;
};

export function DiscoverReviewDialog({
  pairs,
  typeId,
  typeName,
  existing,
  partyRoleNames,
  skippedPages,
  truncated,
  onSaved,
  onTypesChanged,
  onClose,
}: Props) {
  const t = useTranslations("document.discoverReview");

  // Computed once from the props this dialog was opened with. It must NOT
  // recompute into `rows` while the user is editing: `rows` seeds from it, and
  // a reseed would throw away every tick and rename made so far. (The one
  // deliberate reseed is the 409 path in handleSave.)
  const proposals = useMemo(
    () => proposeTemplateFields(pairs, existing, partyRoleNames),
    [pairs, existing, partyRoleNames],
  );

  /**
   * The template as it stood when this dialog opened, frozen.
   *
   * It must NOT be re-read from the `existing` prop at save time. That prop
   * comes from a react-query cache with `refetchOnWindowFocus`, so alt-tabbing
   * to check the scan can refresh it mid-review — and then `knownKeys` would
   * describe a template the reviewer never saw, the route's 409 would pass
   * exactly when it should fire, and the field that arrived in between would be
   * silently swallowed by the merge. Freezing it is what makes the concurrency
   * check a check on what was ACTUALLY reviewed.
   *
   * STATE, not a ref, for two reasons that are really one. The footer reads its
   * length during render (the field-count ceiling), and `react-hooks/refs`
   * rightly bans that — a ref's value is not something a render may depend on.
   * And the one thing that does change it, the 409 reseed, has to repaint the
   * counts it feeds. `useState(existing)` captures the prop exactly once, which
   * is the freezing this needs; later prop changes do not touch it.
   */
  const [baseline, setBaseline] = useState<readonly DocumentTemplateField[]>(existing);

  /**
   * Seed the editable rows from a proposal list.
   *
   * Pre-ticking is deliberate in all three of its rules. A row already
   * captured is never ticked (it cannot be saved). A row the model was unsure
   * about starts unticked, so a guess needs a click to become a permanent
   * field on the type. And ticking STOPS at the ceiling: a dense notarial
   * contract legitimately yields more pairs than a type may hold, and pre-
   * ticking all of them would open the dialog on a disabled Save and a red
   * "untick some", which is a puzzle rather than a screen.
   */
  const seedRows = (list: readonly DiscoveredFieldProposal[], baseCount: number): Row[] => {
    let ticked = baseCount;
    return list.map((p, i) => {
      const include =
        !p.alreadyInForm && p.confidence === "high" && ticked < MAX_TEMPLATE_FIELDS;
      if (include) ticked += 1;
      return { ...p, rowId: String(i), include, label: p.labelRo };
    });
  };

  const [rows, setRows] = useState<Row[]>(() => seedRows(proposals, existing.length));
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Escape closes — but never mid-save, where the dialog is the only thing
  // telling the user a write is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  /**
   * Keep Tab inside the panel.
   *
   * `aria-modal="true"` is a promise, and nothing else in this app keeps it —
   * the backdrop stops the mouse and nothing stops the keyboard. Here it is
   * not merely an accessibility nicety: the document form's TYPE dropdown sits
   * directly under this overlay, and changing it while the review is open
   * changes the dialog's React `key`, which unmounts it and takes every tick
   * and rename with it. Trapping Tab is what makes that unreachable.
   *
   * Deliberately narrow: it moves focus, it does not manage anything else, and
   * it never fights the browser on Escape (handled above) or on typing.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Focus outside the panel entirely (it was never moved in, or something
      // stole it) — pull it back rather than letting Tab walk the page.
      if (!active || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const newRows     = rows.filter((r) => !r.alreadyInForm);
  const presentRows = rows.filter((r) => r.alreadyInForm);
  const selected    = newRows.filter((r) => r.include);
  // Counted against the SAME ceiling the route enforces, so the user is stopped
  // before the click rather than rejected after it — and never by an English
  // sentence built on the server.
  const storedCount = baseline.length;
  const wouldTotal  = storedCount + selected.length;
  const typeFull    = storedCount >= MAX_TEMPLATE_FIELDS;
  const overLimit   = wouldTotal > MAX_TEMPLATE_FIELDS;
  // Every row discovery found is already captured — the normal outcome of
  // re-running discovery to see what is still unrecognised. Nothing to save, so
  // the screen offers Close rather than a Save that can never fire. A type
  // already at the ceiling is the same dead end reached from the other side.
  const nothingToAdd = newRows.length === 0 || typeFull;
  const canSave      = selected.length > 0 && !saving && !overLimit && !typeFull;
  // Two labels can resolve to one captured field, so count the FIELDS.
  const presentCount = new Set(presentRows.map((r) => r.key)).size;

  const patchRow = (rowId: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // `order` is sent as the position within the accepted set; the server
      // renumbers the merged list from scratch (mergeAcceptedFields), so this
      // only has to carry the user's ordering, not a global one.
      const fields: DocumentTemplateField[] = selected.map((r, index) => {
        const label = r.label.trim() || r.labelRo;
        return {
          key:     r.key,
          labelRo: label,
          labelEn: label,
          type:    r.type,
          order:   index,
          // Built from the row's final type, which the user may have changed
          // in the select beside it — the hint and the format instruction on
          // the same prompt line have to agree about what kind of value this is.
          aiHint:  buildFieldHint({ sampleValue: r.sampleValue, type: r.type }),
          groupRo: null,
          groupEn: null,
        };
      });

      const res = await fetch(
        `/api/document-types/${encodeURIComponent(typeId)}/template-fields`,
        {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            knownKeys: baseline.map((f) => f.key),
            fields,
          }),
        },
      );
      // An expired session is redirected to /login and followed silently by
      // fetch, which would otherwise look like a successful save.
      if (res.redirected) {
        setError(t("errorSession"));
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          code?:   string;
          max?:    number;
          fields?: unknown;
        };
        // The route's messages are English — it serves an API, not a screen.
        // Every one of them is mapped to copy from this namespace; none is
        // shown verbatim, because the reader is a Romanian business user.
        if (res.status === 409 && body.code === "template_changed") {
          // Recovered HERE, from the fields the 409 itself carries, rather than
          // by asking the caller to refetch and remount us. A refetch can fail
          // — `invalidateQueries` resolves either way and react-query keeps the
          // stale data — and a dialog that answers a failure by rebuilding
          // itself from the same stale cache reproduces the failure for ever,
          // with Cancel (which discards the whole run) as the only exit.
          const fresh = parseTemplateFields(body.fields);
          setBaseline(fresh);
          const reproposed = proposeTemplateFields(pairs, fresh, partyRoleNames);
          setRows((prev) => {
            // Carry the user's decisions across on the printed label, which is
            // the one thing a reseed cannot change: it comes from the pair.
            const before = new Map(prev.map((r) => [r.labelRo, r]));
            return seedRows(reproposed, fresh.length).map((seeded) => {
              const old = before.get(seeded.labelRo);
              if (!old || seeded.alreadyInForm) return seeded;
              return { ...seeded, include: old.include, label: old.label, type: old.type };
            });
          });
          setError(t("errorChanged"));
          // The form behind this dialog renders from the caller's cache, so it
          // is now out of date too. Not awaited, and nothing here depends on it.
          onTypesChanged();
        } else if (body.code === "too_many_fields") {
          setError(t("errorTooMany", { max: body.max ?? MAX_TEMPLATE_FIELDS }));
        } else if (res.status === 404) {
          setError(t("errorNotFound"));
        } else {
          setError(t("errorSave"));
        }
        return;
      }
      // How many fields the type ACTUALLY gained, from the server's own answer.
      // `fields.length` would be what we asked for, and the merge legitimately
      // drops a row whose key the template already had — reporting the request
      // would let the dialog claim three fields were added when one was.
      const saved = (await res.json().catch(() => ({}))) as { fields?: unknown };
      const savedFields = parseTemplateFields(saved.fields);
      const savedKeys = new Set(savedFields.map((f) => f.key));
      const added = savedFields.length > 0
        ? savedFields.length - baseline.length
        : fields.length;
      // The values discovery read, for the fields that actually landed. The
      // caller fills the form it is standing on with them: the user has just
      // confirmed each one against the page, and without this the document
      // that produced the discovery is the one document of its type nothing
      // can fill — the per-document AI-Interpret button went in #26.09, and
      // `runAiInterpret` only runs inside an import.
      // Through formValueForField, never raw: a date input holds only ISO and
      // a number input only a dot-decimal, and a value they cannot hold is
      // stored invisibly rather than shown. See that function's own comment.
      const values: Record<string, string> = {};
      for (const r of selected) {
        if (!savedKeys.has(r.key)) continue;
        const value = formValueForField(r.sampleValue, r.type);
        if (value !== null) values[r.key] = value;
      }
      onSaved(Math.max(0, added), values);
    } catch {
      setError(t("errorSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discover-review-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
    >
      {/* Capped and internally scrolled, like every other dialog in this repo
          (person-resolution, property-step, the value-list modals). Without
          the cap a dense contract's forty rows push the footer, the error
          banner and the over-limit warning below the fold — so the controls
          are off-screen at the moment they have something to say. */}
      <div
        ref={panelRef}
        className="my-8 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900"
      >
        <h3
          id="discover-review-title"
          className="text-base font-semibold text-ink dark:text-zinc-100"
        >
          {t("title", { type: typeName })}
        </h3>
        <p className="mt-2 text-sm text-fade dark:text-zinc-400">{t("intro")}</p>

        {(skippedPages > 0 || truncated) && (
          <div
            role="status"
            className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          >
            {skippedPages > 0 && <p>{t("warnSkipped", { count: skippedPages })}</p>}
            {truncated && <p>{t("warnTruncated")}</p>}
          </div>
        )}

        {/* Everything between the heading and the footer scrolls; the footer
            and the error banner stay put. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* ── The proposals ───────────────────────────────────────────── */}
          {typeFull ? (
            <p className="mt-4 rounded-md border border-dashed border-wire px-4 py-6 text-center text-sm text-fade dark:border-zinc-700 dark:text-zinc-400">
              {t("typeFull", { max: MAX_TEMPLATE_FIELDS })}
            </p>
          ) : newRows.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-wire px-4 py-6 text-center text-sm text-fade dark:border-zinc-700 dark:text-zinc-400">
              {t("nothingNew")}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t("tableCaption")}</caption>
                <thead>
                  <tr className="border-b border-crease text-left text-xs uppercase tracking-wide text-fade dark:border-zinc-700 dark:text-zinc-400">
                    <th scope="col" className="w-10 py-2 pr-2">
                      <span className="sr-only">{t("colInclude")}</span>
                    </th>
                    <th scope="col" className="py-2 pr-3">{t("colLabel")}</th>
                    <th scope="col" className="py-2 pr-3">{t("colType")}</th>
                    <th scope="col" className="py-2">{t("colSample")}</th>
                  </tr>
                </thead>
                <tbody>
                  {newRows.map((row) => (
                    <tr
                      key={row.rowId}
                      className="border-b border-crease/60 align-top dark:border-zinc-800"
                    >
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={row.include}
                          disabled={saving}
                          onChange={(e) => patchRow(row.rowId, { include: e.target.checked })}
                          aria-label={t("includeAria", { label: row.label || row.key })}
                          className="mt-2 h-4 w-4 shrink-0 rounded border-wire accent-cta"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          value={row.label}
                          disabled={saving}
                          onChange={(e) => patchRow(row.rowId, { label: e.target.value })}
                          aria-label={t("labelAria", { label: row.labelRo })}
                          className="w-full rounded-md border border-wire bg-transparent px-2 py-1.5 text-ink dark:border-zinc-700 dark:text-zinc-100"
                        />
                        <span className="mt-1 block font-mono text-xs text-fade dark:text-zinc-500">
                          {row.key}
                          {row.confidence !== "high" && (
                            <span className="ml-2 rounded bg-amber-100 px-1 py-0.5 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                              {t("lowConfidence")}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={row.type}
                          disabled={saving}
                          onChange={(e) =>
                            patchRow(row.rowId, {
                              type: e.target.value as DocumentTemplateFieldType,
                            })
                          }
                          aria-label={t("typeAria", { label: row.label || row.key })}
                          className="rounded-md border border-wire bg-transparent px-2 py-1.5 text-ink dark:border-zinc-700 dark:text-zinc-100"
                        >
                          {FIELD_TYPES.map((ft) => (
                            <option key={ft} value={ft}>
                              {t(`types.${ft}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-fade dark:text-zinc-400">
                        <span className="block max-h-24 overflow-y-auto whitespace-pre-wrap break-words">
                          {row.sampleValue || t("sampleEmpty")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Already captured ────────────────────────────────────────── */}
          {presentRows.length > 0 && (
            <div className="mt-5 rounded-md border border-wire bg-cta-pale px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
              <p className="font-medium text-ink dark:text-zinc-200">
                {t("alreadyTitle", { count: presentCount })}
              </p>
              <p className="mt-1 text-fade dark:text-zinc-400">{t("alreadyBody")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {presentRows.map((row) => (
                  <li
                    key={row.rowId}
                    className="rounded bg-card px-2 py-1 font-mono text-xs text-fade dark:bg-zinc-900 dark:text-zinc-400"
                  >
                    {row.labelRo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
            <span className="mt-0.5 shrink-0 font-bold">!</span>
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fade dark:text-zinc-400">
            {/* A disabled primary button with nothing beside it reads as a
                broken screen. Every way of reaching one is answered here:
                nothing new to add, the type already full, and nothing ticked —
                the last is easy to land in, because a row the model was unsure
                about starts unticked and an unsure run leaves every box
                empty. */}
            {nothingToAdd ? (
              t("nothingToAddFooter")
            ) : (
              <>
                {t("selectedCount", { count: selected.length })}
                {selected.length === 0 && (
                  <span className="mt-1 block">{t("needSelection")}</span>
                )}
              </>
            )}
            {overLimit && !typeFull && (
              <span className="mt-1 block text-red-700 dark:text-red-400">
                {t("overLimit", { max: MAX_TEMPLATE_FIELDS, total: wouldTotal })}
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={saving}
              className={buttonClass({
                variant: nothingToAdd ? "primary" : "secondary",
                size: "lg",
              })}
            >
              {nothingToAdd ? t("close") : t("cancel")}
            </button>
            {!nothingToAdd && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className={buttonClass({ variant: "primary", size: "lg" })}
              >
                {saving ? t("saving") : t("save")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
