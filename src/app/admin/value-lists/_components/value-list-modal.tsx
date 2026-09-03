"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { LIST_META, type ListKey } from "@/lib/admin/value-lists/config";
import {
  isInUseBody,
  type InUseBody,
} from "@/lib/admin/value-lists/responses";
import {
  failureFromResponse,
  throwRequestFailed,
  RequestFailedError,
  type FailureCode,
} from "@/lib/admin/value-lists/failures";
import { buttonClass } from "@/lib/ui/button-styles";
import {
  documentTypeAwaitsForm,
  documentTypeNameClass,
  documentTypeStatus,
} from "@/lib/documents/status";
import { parseTemplateFields } from "@/lib/documents/template-fields";
import { documentTypeIsIdCard } from "@/lib/import/id-card";
import { documentTypeIsCatchAll } from "@/lib/documents/document-type-match";
import { DocumentTypeFormEditor } from "./document-type-form-editor";

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
  // A 400 here is this form's own rejection — it arrives as
  // `{ error: "Validation failed", details }`, English, with Zod field paths in
  // the details, so neither half is showable. What the user can act on is "a
  // required field is missing or wrong". That is what the `true` says, and it
  // is per-DOOR rather than global because a 400 from the DELETE or the move is
  // not a form at all.
  if (!res.ok) await throwRequestFailed(res, true);
  return res.json();
}

/**
 * A delete the server refused because something still depends on the row.
 *                                                              (Slice #29.05)
 *
 * ⚠️ **An error SUBCLASS carrying the parsed body, not a message string.** The
 * body is `{ labelKey, count }` pairs — deliberately, so the sentence is built
 * in Romanian on this side (see responses.ts) — which means the refusal cannot
 * survive as `err.message`. Before this slice `removeRow` threw
 * `Delete failed (${res.status})` and discarded the body, and the delete
 * mutation had no `onError` at all: a refused delete left the confirmation
 * dialog sitting there with its button re-enabled and nothing said anywhere.
 */
class DeleteRefusedError extends Error {
  constructor(readonly body: InUseBody) {
    super("Reference data value is in use");
    this.name = "DeleteRefusedError";
  }
}

/**
 * ⚠️ **`FailureCode`, `RequestFailedError` and `failureFromResponse` MOVED —
 * they now live in `@/lib/admin/value-lists/failures`.**        (Slice #29.13)
 *
 * They were written here, for this dialog, and they fixed this screen and no
 * other: the three whitelist panels beside it were still rendering the
 * server's English `err.message` on every save and had no `onError` at all on
 * their deletes. Three more copies of a pattern is how one sentence comes to
 * be translated three ways, so the pattern is one module and this file is one
 * of its four readers. Everything it argues for — a code on the wire, the
 * sentence chosen in Romanian on this side — is argued there.
 */

async function removeRow(listKey: ListKey, id: string): Promise<void> {
  const res = await fetch(`/api/admin/value-lists/${listKey}/${id}`, {
    method: "DELETE",
  });
  if (res.ok || res.status === 204) return;
  const body: unknown = await res.json().catch(() => null);
  if (res.status === 409 && isInUseBody(body)) throw new DeleteRefusedError(body);
  throw new RequestFailedError(failureFromResponse(res.status, body));
}

/** What depends on one row, counted at the moment the dialog opens. */
type DependentsReportWire = {
  total: number;
  dependents: { labelKey: string; count: number }[];
  /** Configuration that goes with the row when it is deleted. Never blocks. */
  removedWithRow: { labelKey: string; count: number }[];
  notes: string[];
};

async function fetchDependents(
  listKey: ListKey,
  id: string,
): Promise<DependentsReportWire> {
  const res = await fetch(`/api/admin/value-lists/${listKey}/${id}/dependents`);
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return res.json();
}

/** The 200 body of POST .../reassign. `granted` arrived with Slice #29.13. */
type ReassignResult = {
  moved: { labelKey: string; count: number }[];
  total: number;
  /**
   * Whitelist ticks the target gained so the moved rows stay selectable.
   *
   * ⚠️ **Optional on the WIRE type even though the server always sends it.**
   * A browser holding the previous bundle against the new server is not the
   * case that matters; the case that matters is the reverse — this dialog is
   * inside a modal a user may have had open across a deploy — and
   * `granted.map` on an undefined is a blank screen where a move has just
   * succeeded.
   */
  granted?: { labelKey: string; count: number }[];
  /**
   * i18n keys under `valueList.confirm` for repairs the grant could NOT make.
   * Optional for the same reason `granted` is — a dialog left open across a
   * deploy must not blank the screen on a move that succeeded.
   */
  warnings?: string[];
};

async function reassignRows(
  listKey: ListKey,
  id: string,
  targetId: string,
): Promise<ReassignResult> {
  const res = await fetch(
    `/api/admin/value-lists/${listKey}/${id}/reassign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId }),
    },
  );
  if (!res.ok) await throwRequestFailed(res);
  return res.json();
}

/**
 * The caches that go stale when a row of `listKey` is added or renamed.
 *
 * ⚠️ **The narrow invalidation, and the only one of the three that stays
 * narrow.** A save changes one row of one list; a DELETE cascades whitelist
 * rows into three other panels, and a MOVE rewrites documents, properties and
 * associations across the app — so both of those call `qc.invalidateQueries()`
 * with no key at all, and say why where they do it.
 *
 * The rule these keys encode is not obvious: "document-types" and
 * "property-types" are also fetched under a BARE key by consumers outside this
 * screen — the Document form's type dropdown, the sidebar's dynamic Documents
 * section, the Admin Import classify panels, the Property form's type dropdown
 * — whose cached results would otherwise miss the change until staleTime
 * lapsed or the page was reloaded. Two copies drifting is how one of those
 * screens ends up offering a type that no longer exists.
 */
function invalidateListCaches(
  qc: ReturnType<typeof useQueryClient>,
  listKey: ListKey,
): void {
  qc.invalidateQueries({ queryKey: ["value-list", listKey] });
  if (listKey === "document-types") {
    qc.invalidateQueries({ queryKey: ["document-types"] });
  }
  if (listKey === "property-types") {
    qc.invalidateQueries({ queryKey: ["property-types"] });
  }
  // Slice #29.13: the two lists that arrived with this slice are the same case
  // — the Associate-reference screens on both sides fetch them under the bare
  // key, and their own modals invalidated it on every save until this slice
  // deleted them. Missing it left a renamed role still on offer under its old
  // name for the length of the 30 s staleTime. An adversarial round found it.
  if (listKey === "property-property-roles") {
    qc.invalidateQueries({ queryKey: ["property-property-roles"] });
  }
  if (listKey === "document-document-roles") {
    qc.invalidateQueries({ queryKey: ["document-document-roles"] });
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
  // A CODE, not the server's message: those are English ("Validation failed",
  // "Internal server error") and this form is on a Romanian-only screen. Fixed
  // in passing with the delete dialog, which had the same leak.
  const [error, setError] = useState<FailureCode | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => saveRow(listKey, state.id, values),
    onSuccess: (row) => {
      invalidateListCaches(qc, listKey);
      onSaved(row);
    },
    onError: (err: Error) =>
      setError(err instanceof RequestFailedError ? err.code : "generic"),
  });

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  function handleKey(e: React.KeyboardEvent) {
    // ⚠️ **`isPending` here as well as on the button.** The form stays open
    // until `onSuccess`, so nothing on screen changes between the first Enter
    // and the second — and two POSTs to `tarla` produce two rows with the same
    // indicativ, which is exactly the twin state that makes a value-matched
    // row unmovable (see `siblingsSharingValue` in the value-lists queries).
    if (e.key === "Enter" && !mutation.isPending) mutation.mutate();
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

      {/* ⚠️ **`role="alert"`, and Slice #32.07 is what made its absence
          matter.** Every other refusal this codebase renders announces itself —
          doc-type-engine, the form editor, the review dialog, the document form
          and the import dialog all carry one. This slot did not, and the
          sentences it used to carry all pointed at the field the user was
          standing in ("a required field is missing or wrong"), so silence cost
          little. `idCardRename` is forty words whose remedy is on a DIFFERENT
          screen — close this window, press „Formular" on the row — and a
          screen-reader user renaming a type otherwise gets a refused save and
          nothing at all. */}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {t(`confirm.errors.${error}` as Parameters<typeof t>[0])}
        </p>
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
  // Names the panel for assistive technology — and it has to, now that focus
  // can LAND here (after a delete, when the button that opened the dialog has
  // gone with the row): an `aria-modal` container with no accessible name
  // announces itself as "dialog" and nothing else.
  const listTitleId = useId();

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
  // Same trick for the delete confirmation (Slice #29.05): captured in the
  // click handler, because the same commit marks this panel `inert` and the
  // HTML focus-fixup rule has already blurred the button by effect time.
  const deleteOpenerRef = useRef<HTMLElement | null>(null);
  /** The list panel, so focus has somewhere to land when a row is deleted. */
  const listPanelRef = useRef<HTMLDivElement>(null);
  /**
   * Set by `onDeleted`, read once by the restore effect.
   *
   * Without it that effect also fires on the modal's own first render — where
   * `confirmDeleteRow` is null and the opener ref is empty — and would move
   * focus into the panel every time a list is opened. Harmless, arguably nice,
   * and NOT what the effect is for: an effect that quietly does something its
   * comment does not describe is the next reader's trap.
   */
  const deletedRef = useRef(false);

  const query = useQuery<Row[]>({
    queryKey: ["value-list", listKey],
    queryFn: () => fetchRows(listKey),
  });

  // Slice #27.03: the row whose form editor is open. Read out of the live query
  // rather than captured into state at click time, so a refetch that lands
  // while the editor is open cannot leave the button and the dialog disagreeing
  // about which row this is — and a row that has since been deleted simply
  // stops rendering the editor instead of editing a ghost.
  //
  // ⚠️ **Declared HERE, above the Escape handler that reads it** — as is
  // `confirmDeleteRow` below, for the same reason. The handler must guard on what is
  // actually RENDERED, not on the id: if the row leaves `query.data` while the
  // editor is open, the editor unmounts but `formEditorId` stays set, and a
  // guard on the id would leave Escape a permanent no-op for the modal
  // underneath — closable only with the mouse. Declaring it below the effect
  // and adding it to the dep array is not an option: `const` in a function body
  // is not hoisted, so the render would throw a TDZ ReferenceError.
  const formEditorRow = formEditorId
    ? query.data?.find((r) => r.id === formEditorId)
    : null;

  // The row the delete confirmation is about — same derivation, same reason,
  // and DECLARED HERE for the same one: the Escape handler below reads it, and
  // a `const` declared after the effect is a TDZ ReferenceError at render.
  //
  // Slice #29.05 removed the `deleteUsageCount` that used to sit further down —
  // a property-types-only number, read off the LIST query, that decided which
  // of two sentences the dialog showed. What depends on a row is now counted
  // live for every list, by the dialog itself.
  const confirmDeleteRow = confirmDeleteId
    ? query.data?.find((r) => r.id === confirmDeleteId)
    : null;

  // A row that leaves the list while its confirmation is open leaves
  // `confirmDeleteId` behind as a ghost. NOT cleared in an effect: an effect
  // that calls setState synchronously is a cascading render and `npm run lint`
  // refuses it (react-hooks/set-state-in-effect), correctly — nothing here
  // needs a second render pass. Everything that reads this state already reads
  // the ROW instead: the dialog renders on `confirmDeleteRow`, so it is gone
  // from screen, and the Escape handler below guards on it, so the key still
  // reaches the modal underneath on the first press. What is left is a stale
  // id that only matters if the same row reappears in a later refetch, and
  // then reopening its confirmation is at worst one Escape.

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

  /**
   * The same restore for the delete confirmation — with one difference.
   *
   * After a DELETE the opener is gone (see `onDeleted` below, which clears the
   * ref), so focus goes to the list panel itself rather than to `<body>`. The
   * panel is `tabIndex={-1}` for exactly this, and it is what keeps the next
   * Tab inside the modal.
   */
  useEffect(() => {
    if (confirmDeleteRow) return;
    const opener = deleteOpenerRef.current;
    deleteOpenerRef.current = null;
    const deleted = deletedRef.current;
    deletedRef.current = false;
    if (opener?.isConnected) opener.focus();
    else if (deleted) listPanelRef.current?.focus();
  }, [confirmDeleteRow]);

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
        // The delete dialog handles its own Escape — it has to, because it
        // must ignore the key while a move is in flight, and this handler
        // cannot see that. Guarded on what is RENDERED (`confirmDeleteRow`),
        // for the reason spelled out above it: an id whose row has left the
        // list would otherwise swallow one keypress with nothing on screen.
        if (confirmDeleteRow) return;
        if (form) { setForm(null); return; }
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteRow, form, formEditorRow, onClose]);

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
   * type, taken from the same one function `enrichDiscoverSteps` uses —
   * `documentTypeIsIdCard`, the seeded key or the NAME test — rather than
   * restated here.                                    (one answer since #32.07)
   *
   * ⚠️ **The FALLBACK type is excluded too, and the first draft of this
   * function argued it should not be.** The argument was that the catch-all is
   * an ordinary type which could perfectly well be given a form. It is the
   * wrong way round: a form on the catch-all is not onboarding — a document
   * that lands there is one whose TYPE is wrong, which is #27.04's remedy and
   * not this list's — and `typeAwaitsForm` excludes it for exactly that reason.
   * Left in, it also made this screen's own good news unreachable:
   * `backlogEmpty` below could never be true in any archive that has a fallback
   * type, so the green sentence and the `role="status"` region built to
   * announce it were dead code.
   *
   * ⚠️ **AND UNTIL SLICE #29.07 IT WAS LEFT IN, BECAUSE THIS SCREEN LOOKED FOR
   * THE WRONG KEY.** It resolved the fallback through a local
   * `FALLBACK_TYPE_KEYS = ["ALTUL", "OTHER"]`, whose own comment asserted
   * "Adrian's seeded data has ALTUL". It does not — no migration and no seed has
   * ever written either key into `lookup_document_type` — so the id it resolved
   * was `undefined` on every real archive and NECLASIFICAT sat in the backlog
   * asking to be given a form. #29.07 replaced that with a plain test for
   * `catchAllType`'s key, resolved to the row's ID.
   *
   * ⚠️ **SLICE #32.19 REPLACED THAT IN TURN, WITH `documentTypeIsCatchAll`, AND
   * AN ADVERSARIAL ROUND IS WHY.** The id test resolves the catch-all by the key
   * `UNCLASSIFIED` alone, which is NARROWER than the rule that slice put on the
   * Form button and on the write itself. Leaving the two different rebuilt the
   * same failure this comment already records twice: on an archive holding the
   * second row keyed `NECLASIFICAT` — the row `document-type-match.ts` records
   * as existing — that row satisfied `awaitsFormRow` and was listed as
   * unfinished work with no Form button beside it, because the button asks the
   * wider question; and `backlogEmpty` below could never become true, so the
   * green sentence and its `role="status"` region were dead code again. One
   * rule for the filter, the button and the write, and the loop closes. The row
   * is `Record<string, unknown>` off the admin route, so the two columns are
   * read off it exactly as `documentTypeIsIdCard`'s are on the line below.
   *
   * ⚠️ **`documentTypeIsIdCard`'s NAME arm is a heuristic and it runs over
   * the whole archive here, not over a handful of queued types.** It is deliberately
   * narrow and it vetoes before it matches: "Buletin de analiză", "Copie CI"
   * and — an adversarial round corrected an earlier version of this very
   * comment — "Carte de identitate a vehiculului" are all left alone, the last
   * by an explicit `/vehicul/` veto, because a car's registration document is
   * exactly the phrase the positive pattern would otherwise catch. What it does
   * hide is a wording like "Acte de identitate ale asociaților": the same
   * answer the import already gives such a type, one unticked checkbox away
   * from being visible, and the row itself is never altered or relabelled.
   */
  const awaitsFormRow = (row: Row): boolean =>
    documentTypeAwaitsForm({ origin: row.origin, templateFields: row.templateFields }) &&
    !documentTypeIsCatchAll({ key: String(row.key ?? ""), name: String(row.name ?? "") }) &&
    !documentTypeIsIdCard({ key: String(row.key ?? ""), name: String(row.name ?? "") });
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
        ref={listPanelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={listTitleId}
        // Slice #29.05: the delete dialog counts here too, and an adversarial
        // round showed what it costs when it does not. Its backdrop hides the
        // list but does not disable it, so Tab reached the Delete button of a
        // DIFFERENT row behind the overlay; pressing it re-keyed the dialog
        // onto that row, with only the name in the title changing. (The same
        // path reached "Formular", which mounts the z-70 editor over the z-60
        // confirmation — the exact stack `document-type-form-editor.tsx`
        // documents as unreachable by Escape.)
        inert={!!formEditorRow || !!confirmDeleteRow}
        className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-2xl rounded-xl border border-card-rim bg-card shadow-2xl focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-800">
          <h2
            id={listTitleId}
            className="text-base font-semibold text-ink dark:text-zinc-100"
          >
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
                          {/* Slice #19.02: render checkboxes as ✓ / – symbols.
                              Slice #29.13: a dash for an empty text cell.
                              A blank cell is indistinguishable from a render
                              that failed or a value that was truncated away —
                              the two bespoke modals this slice deleted printed
                              a dash and were right to. It is the EN dash the
                              checkbox column beside it already prints, so one
                              table does not carry two different ones. */}
                          {f.type === "checkbox"
                            ? (row[f.key] ? "✓" : "–")
                            : (String(row[f.key] ?? "").trim() || "–")}
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
                          {/* ⚠️ **Slice #32.19, finding S-02: NOT on the
                              catch-all row — unless that row already carries a
                              form.** The server refuses a form on the catch-all
                              now (`catchAllFormRefusal`), and a button whose
                              only outcome is a refusal is a button that teaches
                              the rule by failing. Drawing nothing says the same
                              thing before the click.

                              The second term is the grandfather clause, and
                              without it this button would be the thing that
                              strands the row: this editor is the ONLY screen in
                              the application that can clear a form, so hiding it
                              on a NECLASIFICAT row that already has one would
                              leave the person who saved it no way to take it
                              off. The server allows exactly that write — a
                              shrink or a clear — and refuses every other one, so
                              the button and the guard agree.

                              ⚠️ **An IDENTITY-CARD row still gets this button,
                              and that asymmetry is older than this slice.** The
                              same argument applies to it and #32.07 did not make
                              it; it is in the handover rather than widened here,
                              because on a card row the button is also the only
                              way to clear the 24-field form migration_073 exists
                              to remove.

                              `documentTypeIsCatchAll` is the same predicate the
                              backlog filter and the server-side guard use. It is
                              wider than `catchAllType`'s key lookup, which this
                              screen used until #32.19 and which misses the
                              second row an archive can hold keyed NECLASIFICAT.
                              The two columns are read off the row exactly the
                              way `awaitsFormRow` reads them for
                              `documentTypeIsIdCard`. */}
                          {isDocumentTypes &&
                            (!documentTypeIsCatchAll({
                              key:  String(row.key ?? ""),
                              name: String(row.name ?? ""),
                            }) ||
                              parseTemplateFields(row.templateFields).length > 0) && (
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
                            onClick={(e) => {
                              deleteOpenerRef.current = e.currentTarget;
                              setConfirmDeleteId(row.id);
                            }}
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

      {/* Slice #29.05: deleting a value that is in use is a conversation.
          Keyed on the row so reopening a different one starts from a fresh
          count rather than from the previous row's answer. */}
      {confirmDeleteRow && (
        <DeleteDialog
          key={confirmDeleteRow.id}
          listKey={listKey}
          row={confirmDeleteRow}
          rows={query.data ?? []}
          labelField={meta.fields[0].key}
          onClose={() => setConfirmDeleteId(null)}
          onDeleted={() => {
            // The opener is that row's Șterge button, which the refetch is
            // about to remove — so drop it and let the restore effect focus
            // the list panel instead.
            deleteOpenerRef.current = null;
            deletedRef.current = true;
            setConfirmDeleteId(null);
          }}
        />
      )}
    </>
  );
}

// ── Delete: the conversation ─────────────────────────────────────────────────

/**
 * The delete confirmation — refuse, name, offer.                (Slice #29.05)
 *
 * Adrian's instruction is the whole specification and it is short: if we want
 * to delete a value-list element that other documents depend on, the system
 * should say so and should suggest changing the association on the objects
 * that depend on it. So: the count is fetched when this dialog opens, and what
 * the dialog offers follows from it.
 *
 *   nothing depends on the row → the delete, stated as permanent.
 *   something does            → what it is and how many, a list to move it
 *                               onto, and NO delete button at all.
 *
 * ⚠️ **The delete button is not rendered while anything depends on the row,
 * rather than rendered disabled.** A disabled danger button reads as "this
 * will work once you tick something on this screen"; there is nothing to tick.
 * The move is the action here, and it is the only one offered.
 *
 * ⚠️ **The move and the delete are two presses, not one.** A single "move and
 * delete" button would put a bulk rewrite and a permanent delete behind one
 * click, and the delete is permanent — #29.04 removed the tombstone that used
 * to make it recoverable.
 *
 * ⚠️ **The count is fetched here rather than read off the list query.** It is
 * being used to decide whether a permanent delete is offered, so it has to be
 * true at the moment it is read, not at the moment the list was loaded. The
 * same reasoning is why the 409 the server may still return is folded back
 * into this query instead of shown as a stray message — see the delete
 * mutation's `onError`.
 */
function DeleteDialog({
  listKey,
  row,
  rows,
  labelField,
  onClose,
  onDeleted,
}: {
  listKey: ListKey;
  row: Row;
  /** Every row of this list — the candidates to move onto are these minus `row`. */
  rows: Row[];
  /** The field that names a row to a human: `name` on ten lists, `indicativ` on tarla. */
  labelField: string;
  onClose: () => void;
  /**
   * Closed because the row was deleted, as opposed to cancelled.
   *
   * The two differ only in where focus goes, and the difference is real: the
   * button that opened this dialog is that row's own Șterge, which is still
   * mounted at the moment the restore effect runs and gone a refetch later —
   * so restoring to it drops focus onto `<body>`, outside a modal with no Tab
   * trap. An adversarial round walked out of the modal that way.
   */
  onDeleted: () => void;
}) {
  const t = useTranslations("valueList");
  const qc = useQueryClient();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [targetId, setTargetId] = useState("");
  const [failure, setFailure] = useState<FailureCode | null>(null);
  const [movedTotal, setMovedTotal] = useState<number | null>(null);
  /**
   * Whitelist ticks the move granted the target.               (Slice #29.13)
   *
   * ⚠️ **Unlike `movedTotal`, this is CLEARED when the target changes** — see
   * the `<select>`'s `onChange`. Both whitelist sentences are written about
   * "rolul ales", the role in that dropdown, so one left standing from a move
   * onto B tells the administrator, after they pick C, that C was ticked
   * automatically. `movedTotal` survives because "5 înregistrări au fost
   * mutate" names no role and is still a fact. An adversarial round found the
   * version of this comment that claimed the two behaved alike.
   */
  const [granted, setGranted] = useState<{ labelKey: string; count: number }[]>([]);
  /** i18n keys under `confirm` — what the move could not repair by itself. */
  const [warnings, setWarnings] = useState<string[]>([]);

  const dependentsKey = ["value-list-dependents", listKey, row.id];

  const dependents = useQuery<DependentsReportWire>({
    queryKey: dependentsKey,
    queryFn: () => fetchDependents(listKey, row.id),
    // Never served from cache: this number gates a permanent delete.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const reassignMutation = useMutation({
    mutationFn: () => reassignRows(listKey, row.id, targetId),
    onSuccess: (res) => {
      setFailure(null);
      setMovedTotal(res.total);
      setGranted(res.granted ?? []);
      setWarnings(res.warnings ?? []);
      // ⚠️ **Everything, not just this list.** A re-point rewrote rows in
      // `document`, `property`, `natural_person` or the association tables —
      // whichever this list feeds — so every cached list and detail screen
      // showing one of those objects is now displaying the old value. This is
      // an administrator action taken a handful of times in the life of an
      // archive; a broad invalidation costs a few refetches and is the only
      // version of this that cannot leave a stale label on screen.
      qc.invalidateQueries();
      dependents.refetch();
    },
    onError: (err: Error) =>
      setFailure(err instanceof RequestFailedError ? err.code : "generic"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeRow(listKey, row.id),
    onSuccess: () => {
      // ⚠️ **Everything, not just this list — the same reason the move does
      // it.** The delete cascades the whitelist rows the dialog has just
      // listed under "La ștergere se elimină și:", and those are displayed by
      // three other panels under their own query keys
      // (`property-person-roles`, `doc-type-person-roles`,
      // `person-person-roles`). With the global 30 s staleTime, opening one of
      // them straight afterwards showed a cascaded row still on screen, with a
      // Șterge button that 404s. An adversarial round found it.
      qc.invalidateQueries();
      onDeleted();
    },
    onError: (err: Error) => {
      // The race: something started depending on this row between the count
      // and the press. The server refused and said what with — so the dialog
      // becomes the refusal it would have shown had the count been that number
      // in the first place, rather than showing an error beside a stale zero.
      //
      // `movedTotal` is deliberately LEFT standing: "5 records were moved" is
      // still true, and it is the fact the user needs in order to make sense
      // of what just happened.
      if (err instanceof DeleteRefusedError) {
        setFailure(null);
        qc.setQueryData<DependentsReportWire>(dependentsKey, {
          total:          err.body.total,
          dependents:     err.body.dependents,
          removedWithRow: err.body.removedWithRow,
          notes:          err.body.notes,
        });
        return;
      }
      setFailure(err instanceof RequestFailedError ? err.code : "generic");
    },
  });

  const report  = dependents.data;
  const blocked = report !== undefined && report.total > 0;
  const free    = report !== undefined && report.total === 0;
  const targets = rows.filter((r) => r.id !== row.id);
  const busy    = reassignMutation.isPending || deleteMutation.isPending;
  // The recount after a move is in flight: the report on screen is the OLD one,
  // so the Move button would still be enabled and would move nothing — and its
  // "nothing was moved" answer would overwrite the message saying five things
  // moved a moment ago.
  const settling = dependents.isFetching;

  /**
   * Focus into the dialog on open.
   *
   * ⚠️ **`aria-modal="true"` without this is worse than neither.** It tells
   * assistive technology that everything outside is inert while the user's
   * focus is still on the button they pressed, behind the backdrop — an
   * adversarial round walked from there to another row's Delete button and
   * re-keyed this dialog onto a different row, with only the title changing.
   * The panel is now focused (so an `alertdialog` announces itself) and the
   * list behind it is `inert`, which is what actually stops the Tab.
   */
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  /**
   * Escape closes the dialog — but not mid-move.
   *
   * Owned here rather than by the parent because the parent cannot see
   * `busy`, and an Escape during a re-point unmounts the only place the result
   * is ever reported: the mutation completes regardless (TanStack keeps
   * `onSuccess` on the mutation, not the observer), so a bulk rewrite would
   * land with nothing said anywhere and the user believing they cancelled it.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (busy) return;
      // ⚠️ **`stopImmediatePropagation`, not `stopPropagation`.** Both
      // handlers are registered on `document`, and propagation-stopping only
      // affects OTHER nodes — the parent's listener is on the same target and
      // would still run. It happens to be harmless today, because the parent
      // guards on `confirmDeleteRow` and its closure is still truthy during
      // this dispatch, but relying on that is relying on a stale closure.
      e.stopImmediatePropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-60 bg-black/50" aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-4 top-1/4 z-60 mx-auto max-w-md rounded-xl border border-card-rim bg-card p-6 shadow-2xl focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3
          id={titleId}
          className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100"
        >
          {t("confirm.title", { name: String(row[labelField] ?? "") })}
        </h3>

        {/* The answer arrives after the dialog does, and a screen-reader user
            is not looking at it — so the region is here before its content is,
            the same rule the backlog banner above follows. */}
        <div aria-live="polite">
          {dependents.isPending && (
            <p className="text-sm text-fade dark:text-zinc-400">
              {t("confirm.checking")}
            </p>
          )}

          {dependents.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {t("confirm.checkFailed")}
            </p>
          )}

          {blocked && report && (
            <>
              <p className="mb-2 text-sm text-ink dark:text-zinc-300">
                {t("confirm.inUse", { count: report.total })}
              </p>
              <ul className="mb-3 list-disc pl-5 text-sm text-ink dark:text-zinc-300">
                {report.dependents.map((d) => (
                  <li key={d.labelKey}>
                    {t(
                      `dependents.classes.${d.labelKey}` as Parameters<typeof t>[0],
                      { count: d.count },
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {free && (
            <p className="mb-3 text-sm text-ink dark:text-zinc-300">
              {t("confirm.deleteBody")}
            </p>
          )}

          {/* What the count does NOT cover, said in words. Shown in both
              states: it is as true of a row nothing depends on as of one in
              use, and it is the honest half of "the count never claims more
              than it knows". */}
          {report?.notes.map((n) => (
            <p key={n} className="mb-2 text-xs text-fade dark:text-zinc-400">
              {t(`dependents.notes.${n}` as Parameters<typeof t>[0])}
            </p>
          ))}
        </div>

        {blocked && (
          <div className="mb-3">
            {targets.length === 0 ? (
              <p className="text-sm text-ink dark:text-zinc-300">
                {t("confirm.noTarget")}
              </p>
            ) : (
              <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink dark:text-zinc-400">
                  {t("confirm.moveTo")}
                </span>
                <select
                  value={targetId}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    // "That value is the one you are deleting" stops being
                    // true the moment a different one is picked.
                    setFailure(null);
                    // ⚠️ **And so do both whitelist sentences.**  (#29.13)
                    // They are written about "rolul ales" — the role in this
                    // dropdown — so a `granted` list or a `roleWhitelistPending`
                    // left over from a move onto B would, after picking C, tell
                    // the administrator that C was ticked automatically, or send
                    // them to Roluri pe Document to tick C. Neither is true. A
                    // third adversarial round found it.
                    //
                    // `movedTotal` deliberately survives, as it has since
                    // #29.05: "5 înregistrări au fost mutate" names no role and
                    // is still a fact.
                    setGranted([]);
                    setWarnings([]);
                  }}
                  disabled={busy}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">{t("confirm.selectTarget")}</option>
                  {targets.map((r) => (
                    <option key={r.id} value={r.id}>
                      {String(r[labelField] ?? "")}
                    </option>
                  ))}
                </select>
              </label>
              {/* ⚠️ **The warning that used to live here is GONE, and its
                  absence is the slice.**                       (#29.13)

                  `confirm.roleWhitelistNote` told the administrator that the
                  ticks do not travel with the associations, and asked them to
                  go and re-tick the target in up to three other panels
                  afterwards — a sentence standing in for a filter. The move
                  now grants the target the ticks the moved rows actually need
                  (src/lib/admin/value-lists/role-whitelists.ts), so there is
                  nothing left to warn about and what IS said is said AFTER the
                  move, in `granted` below, because by then it is a fact rather
                  than a caution. */}
              </>
            )}
          </div>
        )}

        {/* ⚠️ **Below the move control, not above it.** Read in the other
            order, the nearest antecedent of "Mutați-le pe:" was this list —
            the whitelist ticks, which are the one thing the move never
            touches. An adversarial round read the screen out loud and caught
            it. `aria-live` because it arrives with the count, after the
            dialog. */}
        <div aria-live="polite">
          {/* Configuration that goes WITH the row — whitelist ticks in the
              Roluri panels, which the database cascades away. Never a reason to
              refuse, and never something to move onto another value (that would
              hand a different role an eligibility nobody asked for), but always
              said out loud: it disappears without anyone requesting it. */}
          {report && report.removedWithRow.length > 0 && (
            <>
              <p className="mb-1 text-xs font-medium text-ink dark:text-zinc-400">
                {t("confirm.removedWithRow")}
              </p>
              <ul className="mb-3 list-disc pl-5 text-xs text-fade dark:text-zinc-400">
                {report.removedWithRow.map((d) => (
                  <li key={d.labelKey}>
                    {t(
                      `dependents.classes.${d.labelKey}` as Parameters<typeof t>[0],
                      { count: d.count },
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Rendered unconditionally so the region exists before the sentence
            does — a `role="status"` mounted together with its text is not
            reliably announced. */}
        <p
          role="status"
          className="mb-2 text-xs font-medium text-emerald-700 empty:mb-0 dark:text-emerald-400"
        >
          {movedTotal !== null ? t("confirm.moved", { count: movedTotal }) : ""}
        </p>

        {/* What the move changed BESIDES re-pointing the rows.   (#29.13)

            ⚠️ **Said out loud rather than done quietly, and it is the same
            rule "La ștergere se elimină și:" above follows.** A tick in Roluri
            pe Proprietate / Roluri pe Document / Persoană → Persoană is
            configuration the user did not ask for by name; granting it
            silently would be a change to a panel they were not looking at.
            Shown only when something was actually created — a target that was
            already ticked everywhere the moved rows needed produces an empty
            array and no sentence, which is the honest answer.

            The class labels are the EXISTING `dependents.classes.*` plurals,
            not a second vocabulary.

            ⚠️ **Its own `aria-live` wrapper, rendered unconditionally.** The
            `role="status"` paragraph above cannot hold a list, and a live
            region that mounts together with its content is not reliably
            announced — the same rule the dependents region at the top of this
            dialog follows. So the region exists from the first render and only
            the sentence arrives late. */}
        <div aria-live="polite">
          {granted.length > 0 && (
            <>
              <p className="mb-1 text-xs font-medium text-ink dark:text-zinc-400">
                {t("confirm.roleWhitelistGranted")}
              </p>
              <ul className="mb-2 list-disc pl-5 text-xs text-fade dark:text-zinc-400">
                {granted.map((g) => (
                  <li key={g.labelKey}>
                    {t(
                      `dependents.classes.${g.labelKey}` as Parameters<typeof t>[0],
                      { count: g.count },
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* ⚠️ **What the move could NOT repair.** The grant is deliberately a
              top-up of a whitelist that already exists — see
              src/lib/admin/value-lists/role-whitelists.ts — and there is one
              state where that leaves the target role in neither document
              picker and nothing safe can change it. Saying so here is the
              narrowed descendant of `confirm.roleWhitelistNote`, which said it
              to every user of the move whether or not it was true. */}
          {warnings.map((w) => (
            <p
              key={w}
              className="mb-2 text-xs text-amber-700 dark:text-amber-400"
            >
              {t(`confirm.${w}` as Parameters<typeof t>[0])}
            </p>
          ))}
        </div>

        {/* Chosen on this side from a code, never echoed from the server: the
            server's own `error` strings are English. */}
        {failure && (
          <p role="alert" className="mb-2 text-xs text-red-600 dark:text-red-400">
            {t(`confirm.errors.${failure}` as Parameters<typeof t>[0])}
          </p>
        )}

        <div className="flex justify-end gap-2">
          {blocked && targets.length > 0 && (
            <button
              onClick={() => reassignMutation.mutate()}
              disabled={busy || settling || targetId === ""}
              className={buttonClass({ variant: "primary", size: "sm" })}
            >
              {reassignMutation.isPending
                ? t("confirm.moving")
                : t("confirm.move")}
            </button>
          )}
          {free && (
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={busy || settling}
              className={buttonClass({ variant: "danger", size: "sm" })}
            >
              {deleteMutation.isPending
                ? t("confirm.deleting")
                : t("confirm.delete")}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={busy}
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            {t("confirm.cancel")}
          </button>
        </div>
      </div>
    </>
  );
}
