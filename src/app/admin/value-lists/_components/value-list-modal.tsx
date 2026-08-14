"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { LIST_META, type ListKey } from "@/lib/admin/value-lists/config";
import { buttonClass } from "@/lib/ui/button-styles";
import {
  documentTypeAwaitsForm,
  documentTypeNameClass,
  documentTypeStatus,
} from "@/lib/documents/status";
import { parseTemplateFields } from "@/lib/documents/template-fields";
import { ID_CARD_TYPE_KEYS, isIdCardTypeName } from "@/lib/import/id-card";
import { DocumentTypeFormEditor } from "./document-type-form-editor";

/**
 * The catch-all type's key, in the order `fetchDocTypes` falls through them.
 *                                                              (Slice #27.07)
 *
 * ⚠️ **Resolved to ONE row the way the import resolves it, not matched as a
 * SET, and an adversarial round found the difference.** `typeAwaitsForm`
 * excludes a single id — whatever `fetchDocTypes` settled on — so an archive
 * holding both an ALTUL and an OTHER row has the import naming the OTHER one in
 * its backlog while a set-match here would hide it, which is the "exclusion
 * undone one screen later" failure with the sign flipped.
 *
 * ⚠️ **The import's third clause — `items[0]`, an ordinary alphabetically-first
 * type when neither key exists — is knowingly NOT mirrored.** The two lists
 * come from different routes with different ordering, so "the first row" is not
 * the same row on both screens, and guessing would hide a type the sentence
 * named. Adrian's seeded data has ALTUL, so the case is out of reach; if it ever
 * is not, the honest failure is one extra row in a filter, not a missing one.
 */
const FALLBACK_TYPE_KEYS: readonly string[] = ["ALTUL", "OTHER"];

// ── API helpers ───────────────────────────────────────────────────────────────

type Row = Record<string, unknown> & { id: string };

async function fetchRows(listKey: ListKey): Promise<Row[]> {
  const res = await fetch(`/api/admin/value-lists/${listKey}`);
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  const data = await res.json();
  return data.items as Row[];
}

async function saveRow(
  listKey: ListKey,
  id: string | null,
  body: Record<string, unknown>,
): Promise<Row> {
  const url = id
    ? `/api/admin/value-lists/${listKey}/${id}`
    : `/api/admin/value-lists/${listKey}`;
  const method = id ? "PUT" : "POST";
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json();
}

async function removeRow(listKey: ListKey, id: string): Promise<void> {
  const res = await fetch(`/api/admin/value-lists/${listKey}/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed (${res.status})`);
  }
}

// ── Inline edit/add form ──────────────────────────────────────────────────────

// Slice #19.02: values are unknown (string for text fields, boolean for
// checkboxes) so we can serialize booleans correctly in JSON.
type FormState = {
  id: string | null; // null = adding
  values: Record<string, unknown>;
};

function EditForm({
  listKey,
  state,
  onClose,
  onSaved,
}: {
  listKey: ListKey;
  state: FormState;
  onClose: () => void;
  onSaved: (row: Row) => void;
}) {
  const t = useTranslations("valueList");
  const meta = LIST_META[listKey];
  const [values, setValues] = useState<Record<string, unknown>>(state.values);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => saveRow(listKey, state.id, values),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["value-list", listKey] });
      // "document-types" is also fetched directly (bare key, no "value-list"
      // prefix) by several consumers elsewhere — the Document form's type
      // dropdown, the sidebar's dynamic Documents nav section, and the
      // Admin Import classify panels. Their cached results would otherwise
      // miss a just-added/edited/removed type until staleTime lapses or a
      // hard reload happens. Invalidate that key too so they refresh in step.
      if (listKey === "document-types") {
        qc.invalidateQueries({ queryKey: ["document-types"] });
      }
      // "property-types" is also fetched by the Property form's type dropdown.
      if (listKey === "property-types") {
        qc.invalidateQueries({ queryKey: ["property-types"] });
      }
      onSaved(row);
    },
    onError: (err: Error) => setError(err.message),
  });

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") mutation.mutate();
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="mb-4 rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">
        {state.id ? t("form.editTitle") : t("form.addTitle")}
      </h3>

      <div className="flex flex-wrap gap-3">
        {meta.fields.map((f, i) => {
          // Slice #19.02: checkbox field
          if (f.type === "checkbox") {
            return (
              <label
                key={f.key}
                className="flex items-center gap-2 text-sm text-ink dark:text-zinc-300 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-wire accent-cta"
                />
                <span className="font-medium">{f.labelText ?? t(`fields.${f.labelKey}`)}</span>
              </label>
            );
          }

          // Text / textarea field
          return (
            <div
              key={f.key}
              className={`flex flex-col gap-1 ${f.multiline ? "w-full" : "min-w-48"}`}
            >
              <label className="text-xs font-medium text-ink dark:text-zinc-400">
                {f.labelText ?? t(`fields.${f.labelKey}`)}
                {f.required && <span className="ml-0.5 text-red-500">*</span>}
              </label>
              {f.multiline ? (
                <textarea
                  rows={3}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    // Allow Enter inside textarea; only Escape closes
                    if (e.key === "Escape") onClose();
                  }}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 resize-y"
                />
              ) : (
                <input
                  ref={i === 0 ? firstInputRef : undefined}
                  type="text"
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  onKeyDown={handleKey}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className={buttonClass({ variant: "primary", size: "sm" })}
        >
          {mutation.isPending ? t("form.saving") : t("form.save")}
        </button>
        <button
          onClick={onClose}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          {t("form.cancel")}
        </button>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function ValueListModal({
  listKey,
  onClose,
}: {
  listKey: ListKey;
  onClose: () => void;
}) {
  const t = useTranslations("valueList");
  const meta = LIST_META[listKey];
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Slice #27.03: the id of the document type whose template-fields editor is
  // open, or null. Only ever set for listKey === "document-types".
  const [formEditorId, setFormEditorId] = useState<string | null>(null);
  // What to focus when the editor closes. Captured in the click handler, not in
  // an effect: the same commit marks this panel `inert`, and the HTML
  // focus-fixup rule blurs a focused element the moment it gains an inert
  // ancestor — so by effect time `document.activeElement` is already `body`.
  // (The lesson is written up in `cancel-import-dialog.tsx`.)
  const formEditorOpenerRef = useRef<HTMLElement | null>(null);

  const query = useQuery<Row[]>({
    queryKey: ["value-list", listKey],
    queryFn: () => fetchRows(listKey),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRow(listKey, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["value-list", listKey] });
      // See matching comment in EditForm's mutation above.
      if (listKey === "document-types") {
        qc.invalidateQueries({ queryKey: ["document-types"] });
      }
      if (listKey === "property-types") {
        qc.invalidateQueries({ queryKey: ["property-types"] });
      }
      setConfirmDeleteId(null);
    },
  });

  // Slice #27.03: the row whose form editor is open. Read out of the live query
  // rather than captured into state at click time, so a refetch that lands
  // while the editor is open cannot leave the button and the dialog disagreeing
  // about which row this is — and a row that has since been deleted simply
  // stops rendering the editor instead of editing a ghost.
  //
  // ⚠️ **Declared HERE, above the Escape handler that reads it, and not beside
  // `confirmDeleteRow` further down.** The handler must guard on what is
  // actually RENDERED, not on the id: if the row leaves `query.data` while the
  // editor is open, the editor unmounts but `formEditorId` stays set, and a
  // guard on the id would leave Escape a permanent no-op for the modal
  // underneath — closable only with the mouse. Declaring it below the effect
  // and adding it to the dep array is not an option: `const` in a function body
  // is not hoisted, so the render would throw a TDZ ReferenceError.
  const formEditorRow = formEditorId
    ? query.data?.find((r) => r.id === formEditorId)
    : null;

  /**
   * Hand focus back to the button that opened the form editor.
   *
   * ⚠️ **An effect, not a `queueMicrotask` inside `onClose`.** `focus()` on an
   * element inside an `inert` subtree is a spec-mandated no-op, so the restore
   * has to run AFTER React has removed the attribute. A microtask gets that
   * right only when the close came from a click: a discrete event flushes
   * synchronously in a microtask scheduled first. The SAVE path closes from
   * `mutation.onSuccess` — a promise callback, so DefaultLane, so the commit
   * runs in a Scheduler macrotask and the microtask fires while the panel is
   * still inert. Effects run after `commitMutationEffects` on every lane, which
   * is why `import-wizard.tsx` restores focus this way too.
   */
  useEffect(() => {
    if (formEditorRow) return;
    const opener = formEditorOpenerRef.current;
    formEditorOpenerRef.current = null;
    if (opener?.isConnected) opener.focus();
  }, [formEditorRow]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Slice #27.03: the form editor is a dialog ON TOP of this one and
        // handles its own Escape (its open confirmation first, then itself).
        // Without this early return both handlers fire on one keypress and the
        // list modal underneath closes too, so Escape out of the editor lands
        // the administrator back on Reference Data instead of on the list.
        if (formEditorRow) return;
        if (confirmDeleteId) { setConfirmDeleteId(null); return; }
        if (form) { setForm(null); return; }
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteId, form, formEditorRow, onClose]);

  function startAdd() {
    const blank: Record<string, unknown> = {};
    for (const f of meta.fields) {
      // Slice #19.02: checkbox fields start unchecked (false); text fields blank.
      blank[f.key] = f.type === "checkbox" ? false : "";
    }
    setForm({ id: null, values: blank });
  }

  function startEdit(row: Row) {
    const vals: Record<string, unknown> = {};
    for (const f of meta.fields) {
      if (f.type === "checkbox") {
        vals[f.key] = Boolean(row[f.key]);
      } else {
        vals[f.key] = String(row[f.key] ?? "");
      }
    }
    setForm({ id: row.id, values: vals });
  }

  // Slice #19.02: for property-types, surface a richer delete warning when
  // the type is referenced by existing properties. The list query already
  // includes a `usageCount` for property-types rows via a correlated subquery.
  const confirmDeleteRow = confirmDeleteId
    ? query.data?.find((r) => r.id === confirmDeleteId)
    : null;
  const deleteUsageCount =
    listKey === "property-types" && typeof confirmDeleteRow?.usageCount === "number"
      ? (confirmDeleteRow.usageCount as number)
      : 0;

  // Column headers — text fields only; checkbox fields appear inline in the
  // edit form but are shown as a ✓/– symbol in the row display.
  const displayFields = meta.fields;

  // ── Slice #26.12: the Document Types list, and only that one ───────────────
  //
  // A derived column and a derived colour, in the shape #19.02's `usageCount`
  // already set for property-types: the generic list stays generic, and the one
  // list with something extra to say says it here rather than in LIST_META.
  // LIST_META describes EDITABLE FIELDS — the add/edit form is built straight
  // from it — and a status nobody can type is not one of those. Putting it
  // there would have grown an input for a computed value.
  //
  // ⚠️ **The column exists so the colour is never the only carrier.** The brief
  // asks for black / blue / bold green, and colour alone fails anyone who
  // cannot distinguish them and every printout. The status word beside it says
  // the same thing in text, from the same function — `documentTypeStatus` and
  // `documentTypeNameClass` cannot disagree, because the second is the first
  // with a lookup on the end.
  const isDocumentTypes = listKey === "document-types";
  // One extra column for the status, plus the always-present actions column.
  const emptyStateColSpan = displayFields.length + (isDocumentTypes ? 2 : 1);

  // ── Slice #27.07: narrow the list to the types still without a form ────────
  //
  // The backlog an import reports by name is worked through here, and before
  // this it meant reading twenty-four rows looking for the ones that were not
  // green. One click instead.
  //
  // ⚠️ **`documentTypeAwaitsForm` is the SAME derivation `documentTypeStatus`
  // above paints the row with** — see its header. A predicate written here as
  // `parseTemplateFields(row.templateFields).length === 0` would be a second
  // home for the rule, and #26.12's single-source test exists because the
  // failure mode is silent: this list would then be able to hide a row it
  // paints green, or show one it paints black, and either reads as the filter
  // simply not working rather than as two rules disagreeing.
  //
  // ⚠️ **State, not a URL parameter or a stored preference.** It is a lens on
  // one visit — a filter that survived the modal closing would have the
  // administrator open Document Types next week, see nine rows where there are
  // twenty-four, and have no way to know why.
  const [onlyWithoutForm, setOnlyWithoutForm] = useState(false);
  /**
   * Types whose form editor has been opened during this visit.
   *
   * ⚠️ **The filter's own feedback loop, and without it the slice's headline
   * flow ends in silence.** Tick the box, press "Formular (0)" on a type, add a
   * field, save: the row stops satisfying `documentTypeAwaitsForm` and vanishes.
   * A row disappearing is the only confirmation the work landed — and it is a
   * bad one, because it is indistinguishable from a delete. Worse for the
   * keyboard: `formEditorOpenerRef` holds that row's own button, so by the time
   * the restore effect runs the element is gone, `isConnected` is false, and
   * focus falls to `<body>` with nothing announced.
   *
   * Keeping the row until the next visit fixes both at once. It flips to bold
   * green "Are formular" in place, which is the confirmation, and the button
   * inside it is still there to take focus back. The row is drawn by exactly
   * the same rule as always — this widens WHICH rows are shown, and changes
   * nothing about what any of them says.
   *
   * ⚠️ **Never cleared while the modal is open, deliberately.** Clearing it
   * when the filter is unticked and re-ticked would make the row vanish on the
   * second tick, which is the same silent disappearance one interaction later.
   * Closing the modal is what starts a fresh visit.
   */
  const [touchedTypeIds, setTouchedTypeIds] = useState<ReadonlySet<string>>(new Set());
  /**
   * Is this type WAITING for a form, as opposed to merely lacking one?
   *                                                              (Slice #27.07)
   *
   * ⚠️ **`documentTypeAwaitsForm` AND NOT AN IDENTITY CARD, and two adversarial
   * rounds converged on the second term.** The import's own backlog is decided
   * by `typeAwaitsForm` (`src/lib/import/discover-run.ts`), which excludes the
   * identity-card type for a reason `status.ts` states without qualification: a
   * form is the correct and PERMANENT absence there, because the card's data is
   * captured as real Person records and a custom form would put a second,
   * freely-editable copy of somebody's CNP on the document. This screen is
   * where the import's sentence sends the user, so listing "Carte de
   * identitate" here as unfinished work is that exclusion undone one screen
   * later — and the one form the code elsewhere says must never be built.
   *
   * It also made the list's own good news unreachable: `backlogEmpty` below
   * could never be true in any real archive, because the seeded card type is
   * permanently in the set.
   *
   * ⚠️ **This does NOT re-derive the status, which is what #27.07's constraint
   * forbids.** `documentTypeAwaitsForm` is still the only thing deciding
   * whether a type has a form, and every row still paints exactly what
   * `documentTypeStatus` says. What is added is an orthogonal fact about ONE
   * type, taken from the same two tests `enrichDiscoverSteps` uses — the seeded
   * key and `isIdCardTypeName` — rather than restated here.
   *
   * ⚠️ **The FALLBACK type is excluded too, resolved by ID rather than matched
   * by key — see `FALLBACK_TYPE_KEYS` — and the first draft of this function
   * argued it should not be excluded at all.** The argument was that ALTUL is an
   * ordinary type which could perfectly well be given a form. It is the wrong
   * way round: a form on the catch-all is not onboarding — a document that
   * lands on ALTUL is one whose TYPE is wrong, which is #27.04's remedy and not
   * this list's — and `typeAwaitsForm` excludes it for exactly that reason. Left
   * in, it also made this screen's own good news unreachable: `backlogEmpty`
   * below could never be true in any archive that has a fallback type, so the
   * green sentence and the `role="status"` region built to announce it were
   * dead code.
   *
   * ⚠️ **`isIdCardTypeName` is a NAME heuristic and it runs over the whole
   * archive here, not over a handful of queued types.** It is deliberately
   * narrow and it vetoes before it matches: "Buletin de analiză", "Copie CI"
   * and — an adversarial round corrected an earlier version of this very
   * comment — "Carte de identitate a vehiculului" are all left alone, the last
   * by an explicit `/vehicul/` veto, because a car's registration document is
   * exactly the phrase the positive pattern would otherwise catch. What it does
   * hide is a wording like "Acte de identitate ale asociaților": the same
   * answer the import already gives such a type, one unticked checkbox away
   * from being visible, and the row itself is never altered or relabelled.
   */
  const fallbackTypeId = isDocumentTypes
    ? FALLBACK_TYPE_KEYS.reduce<Row | undefined>(
        (found, key) => found ?? query.data?.find((r) => String(r.key ?? "") === key),
        undefined,
      )?.id
    : undefined;
  const awaitsFormRow = (row: Row): boolean =>
    documentTypeAwaitsForm({ origin: row.origin, templateFields: row.templateFields }) &&
    row.id !== fallbackTypeId &&
    !(ID_CARD_TYPE_KEYS as readonly string[]).includes(String(row.key ?? "")) &&
    !isIdCardTypeName(String(row.name ?? ""));
  // ⚠️ **`onlyWithoutForm && isDocumentTypes`, in that order and both terms.**
  // The checkbox is only rendered for document-types, but the state outlives a
  // `listKey` change in a component that is keyed on nothing: without the
  // second term, ticking it here and opening Institutions would filter that
  // list by a document-type rule, which for a row with no `templateFields` is
  // "true" for every row — a list that looks unfiltered until the day one of
  // its rows is not.
  const visibleRows =
    onlyWithoutForm && isDocumentTypes
      ? query.data?.filter((row) => awaitsFormRow(row) || touchedTypeIds.has(row.id))
      : query.data;
  /**
   * Is there any of the backlog left?                            (Slice #27.07)
   *
   * ⚠️ **Derived from the FILTER's own rule and not from `visibleRows`, and an
   * adversarial round found what the difference costs.** `visibleRows` retains
   * the rows the administrator has just worked on, deliberately — so a version
   * of this that tested `visibleRows.length === 0` could never fire in the one
   * flow it was written for: finish the last formless type, and the row that
   * proves you finished it is the row keeping the count above zero. The result
   * this whole slice is working towards would have been unreachable.
   */
  const backlogEmpty =
    onlyWithoutForm &&
    isDocumentTypes &&
    query.data !== undefined &&
    query.data.length > 0 &&
    !query.data.some(awaitsFormRow);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      {/* Slice #27.03: `inert` while the form editor is on top. Its Tab trap
          already keeps the keyboard out of here; this keeps a screen reader's
          virtual cursor out too. Nested `aria-modal` is undefined behaviour —
          AT picks one — and what a user could otherwise browse to and press
          from behind the overlay is this list's Delete button, whose z-60
          confirmation would then render UNDER the editor's z-70 backdrop. */}
      <div
        role="dialog"
        aria-modal="true"
        inert={!!formEditorRow}
        className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-2xl rounded-xl border border-card-rim bg-card shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-ink dark:text-zinc-100">
            {t(`lists.${meta.titleKey}`)}
          </h2>
          <button
            onClick={onClose}
            className={buttonClass({ variant: "bare", size: "md" })}
            aria-label={t("modal.close")}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex max-h-[70vh] flex-col overflow-hidden">
          <div className="overflow-y-auto p-5">
            {/* Add/Edit form */}
            {form && (
              <EditForm
                listKey={listKey}
                state={form}
                onClose={() => setForm(null)}
                onSaved={() => setForm(null)}
              />
            )}

            {/* Toolbar */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={startAdd}
                disabled={!!form}
                className={buttonClass({ variant: "primary", size: "sm" })}
              >
                + {t("toolbar.add")}
              </button>
              {/* Slice #27.07: the onboarding backlog, in one click.

                  ⚠️ **A checkbox rather than a third status column or a sort.**
                  The question is binary and the answer is a subset, and the row
                  already SAYS which it is — in a word and in a colour — so a
                  control that reorders or re-labels would be a third way of
                  stating the same fact. This one only chooses how many rows are
                  on screen.

                  ⚠️ **The count beside it counts what is SHOWN, and says so
                  when that is not everything.** A filter that leaves the total
                  standing tells the administrator there are twenty-four rows
                  above nine of them; a filter that silently rewrites the total
                  loses the one number that says how much of the list this is. */}
              {isDocumentTypes && (
                <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-ink dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={onlyWithoutForm}
                    onChange={(e) => setOnlyWithoutForm(e.target.checked)}
                    className="h-4 w-4 rounded border-wire accent-cta"
                  />
                  <span className="font-medium">{t("toolbar.onlyWithoutForm")}</span>
                </label>
              )}
              {query.data && (
                <span className="text-xs text-fade dark:text-zinc-400">
                  {visibleRows !== undefined && visibleRows.length !== query.data.length
                    ? t("toolbar.countFiltered", {
                        count: visibleRows.length,
                        total: query.data.length,
                      })
                    : t("toolbar.count", { count: query.data.length })}
                </span>
              )}
            </div>

            {/* Slice #27.07: the backlog is empty.

                ⚠️ **A banner above the table rather than an empty-state row,
                because the table is NOT empty.** The rows the administrator has
                just finished are still on it, in bold green — that is the
                filter's confirmation that the work landed. A message inside the
                tbody would be claiming there is nothing to show directly above
                the things it is showing.

                ⚠️ **Said in words rather than left as an absence.** This is the
                one result the whole slice is working towards, and the
                alternative — a list that quietly stops shrinking — is
                indistinguishable from a filter that has stopped working.

                `role="status"` because it appears in response to a save made in
                a dialog ON TOP of this one, so a screen-reader user is looking
                somewhere else when it arrives; rendered unconditionally under
                the filter so the region exists before its content does.

                ⚠️ **…and only while rows are still on screen.** With none left
                the table's own empty row carries the same sentence, in the
                place a reader is already looking. Drawing both would print it
                twice, six pixels apart. */}
            {onlyWithoutForm && isDocumentTypes && (
              <p
                role="status"
                className="mb-3 text-xs font-medium text-emerald-700 dark:text-emerald-400"
              >
                {backlogEmpty && (visibleRows?.length ?? 0) > 0 ? t("table.allHaveForm") : ""}
              </p>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-md border border-card-rim dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                  <tr>
                    {displayFields.map((f) => (
                      <th key={f.key} className="px-4 py-2">
                        {f.labelText ?? t(`fields.${f.labelKey}`)}
                      </th>
                    ))}
                    {/* w-32: the panel is max-w-2xl and this is a third column
                        where there were two, so without a width the type name
                        loses room and the modal grows a horizontal scrollbar.
                        Matches the w-28 already on the actions column. */}
                    {isDocumentTypes && (
                      <th className="w-32 px-4 py-2">{t("fields.status")}</th>
                    )}
                    <th className="w-28 px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-crease bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                  {query.isLoading && (
                    <tr>
                      <td
                        colSpan={emptyStateColSpan}
                        className="px-4 py-6 text-center text-fade"
                      >
                        {t("table.loading")}
                      </td>
                    </tr>
                  )}
                  {query.isError && (
                    <tr>
                      <td
                        colSpan={emptyStateColSpan}
                        className="px-4 py-6 text-center text-red-600"
                      >
                        {t("table.error")}
                      </td>
                    </tr>
                  )}
                  {/* ⚠️ **Keyed on what is RENDERED, not on what was fetched,
                      and an adversarial round found the shell it otherwise
                      leaves.** The day after the backlog is cleared, ticking the
                      filter on a fresh open matches no row and retains none —
                      so a test on `query.data.length` drew a bordered grey
                      header bar over an empty tbody with nothing said anywhere.
                      Which sentence it is depends on WHY it is empty: an archive
                      with no types at all is a different fact from a filter that
                      found nothing left to do, and the second is good news. */}
                  {visibleRows?.length === 0 && (
                    <tr>
                      <td
                        colSpan={emptyStateColSpan}
                        className={
                          query.data?.length === 0
                            ? "px-4 py-6 text-center text-fade"
                            : "px-4 py-6 text-center text-emerald-700 dark:text-emerald-400"
                        }
                      >
                        {query.data?.length === 0 ? t("table.empty") : t("table.allHaveForm")}
                      </td>
                    </tr>
                  )}
                  {visibleRows?.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-cta-pale dark:hover:bg-zinc-800/50"
                    >
                      {displayFields.map((f) => (
                        <td
                          key={f.key}
                          className={[
                            "px-4 py-2",
                            // Slice #26.12: the type's name carries the colour
                            // coding; every other cell keeps the table's body
                            // colour. `documentTypeNameClass` returns exactly
                            // that body colour for a hand-added type, so an
                            // untouched row looks as it always did.
                            isDocumentTypes && f.key === "name"
                              ? documentTypeNameClass({
                                  origin:         row.origin,
                                  templateFields: row.templateFields,
                                })
                              : "text-ink dark:text-zinc-300",
                            f.multiline ? "max-w-[240px] truncate" : "",
                          ].filter(Boolean).join(" ")}
                          title={f.multiline ? String(row[f.key] ?? "") : undefined}
                        >
                          {/* Slice #19.02: render checkboxes as ✓ / – symbols */}
                          {f.type === "checkbox"
                            ? (row[f.key] ? "✓" : "–")
                            : String(row[f.key] ?? "")}
                        </td>
                      ))}
                      {isDocumentTypes && (
                        <td className="px-4 py-2 text-ink dark:text-zinc-300">
                          {t(
                            `documentTypeStatus.${documentTypeStatus({
                              origin:         row.origin,
                              templateFields: row.templateFields,
                            })}` as Parameters<typeof t>[0],
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(row)}
                            disabled={!!form}
                            className={buttonClass({ variant: "secondary", size: "xs" })}
                          >
                            {t("table.edit")}
                          </button>
                          {/* Slice #27.03: the type's custom form. Document
                              types only — no other list has one. The count is
                              on the button rather than in a column of its own
                              because the panel is max-w-2xl and #26.12 already
                              spent the one spare column on the status. */}
                          {isDocumentTypes && (
                            <button
                              onClick={(e) => {
                                formEditorOpenerRef.current = e.currentTarget;
                                setFormEditorId(row.id);
                                // Slice #27.07 — remembered on OPEN rather than
                                // on save, because the editor reports nothing
                                // back and a row that left the list is a row
                                // whose opener has already unmounted. Marking a
                                // type the user opened and then cancelled costs
                                // one row staying visible until the modal is
                                // closed; the other way round costs the focus.
                                //
                                // ⚠️ **Only while the filter is ON, and an
                                // adversarial round found what the unguarded
                                // version leaks.** The set is never cleared
                                // while the modal is open, so a type opened
                                // with the filter OFF — to look at a form it
                                // already has — was retained, and ticking the
                                // box afterwards then listed it under "Doar
                                // cele care așteaptă un formular", in bold
                                // green, with the status cell reading "Are
                                // formular". That is
                                // precisely the outcome `documentTypeAwaitsForm`
                                // is written to make impossible, arriving
                                // through the retention set instead of through
                                // a second derivation. Retention exists to stop
                                // a row vanishing out of the FILTERED list;
                                // with the filter off there is nothing to keep.
                                if (onlyWithoutForm) {
                                  setTouchedTypeIds((prev) =>
                                    prev.has(row.id)
                                      ? prev
                                      : new Set(prev).add(row.id),
                                  );
                                }
                              }}
                              disabled={!!form}
                              className={buttonClass({ variant: "ghost", size: "xs" })}
                            >
                              {t("table.editForm", {
                                count: parseTemplateFields(row.templateFields).length,
                              })}
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmDeleteId(row.id)}
                            className={buttonClass({ variant: "danger", size: "xs" })}
                          >
                            {t("table.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Slice #27.03: the template-fields editor for one document type.
          Keyed on the row so reopening a different type remounts it with that
          type's fields rather than keeping the first one's local edits. */}
      {formEditorRow && (
        <DocumentTypeFormEditor
          key={formEditorRow.id}
          typeId={formEditorRow.id}
          typeName={String(formEditorRow.name ?? "")}
          templateFields={formEditorRow.templateFields}
          onClose={() => setFormEditorId(null)}
        />
      )}

      {/* Delete confirm dialog */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-60 bg-black/50" aria-hidden />
          <div
            role="alertdialog"
            className="fixed inset-x-4 top-1/3 z-60 mx-auto max-w-sm rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="mb-4 text-sm text-ink dark:text-zinc-300">
              {/* Slice #19.02: richer warning when the property type is in use */}
              {deleteUsageCount > 0
                ? t("confirm.deletePropertyTypeUsed", { count: deleteUsageCount })
                : t("confirm.deleteBody")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                disabled={deleteMutation.isPending}
                className={buttonClass({ variant: "danger", size: "sm" })}
              >
                {deleteMutation.isPending
                  ? t("confirm.deleting")
                  : t("confirm.delete")}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                {t("confirm.cancel")}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
