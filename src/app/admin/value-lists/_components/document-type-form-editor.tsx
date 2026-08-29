"use client";

/**
 * Reference Data → Document Types → Formular.               (Slice #27.03)
 *
 * The editor for one document type's `template_fields` — the custom form its
 * documents get, and the field list its extraction prompt is built from. A
 * label can be renamed in both locales, a type changed, a field moved up or
 * down, put in a panel group, given an AI hint, added, or removed. Before this
 * slice all of that needed a hand-written API call.
 *
 * THIS FILE IS LAYOUT AND STATE ONLY. Every decision that could lose data —
 * which key a row is stored under, what counts as a duplicate, what a free-text
 * group writes to each locale, whether anything has changed — lives in
 * `@/lib/documents/template-editor-rows`, pure and tested. A review round moved
 * it there: those functions were module-private here, so the most dangerous
 * decision on the screen could not be asserted anywhere.
 *
 * THREE RULES IT IS BUILT AROUND
 * ------------------------------
 *
 * 1. **A key is permanent, so it is shown and never editable.** It is the JSON
 *    key under which every document of this type already holds its value in
 *    `document.custom_fields`. Renaming a LABEL is a caption change; rewriting
 *    a key orphans real data behind a form that can no longer see it. The one
 *    place a key is decided is when a field is ADDED, and even there nobody
 *    types it — `keysForRows` derives it from the Romanian label through the
 *    same `slugifyFieldKey` / `uniqueFieldKey` pair the AI-Discovery path uses,
 *    and shows it live, before the save.
 *
 * 2. **Removing a field never deletes a value.** It drops the field from the
 *    form and from the extraction prompt; the values already captured stay in
 *    `document.custom_fields`, invisible on every screen, and reappear the
 *    moment a field with the same key is put back — which is why a key removed
 *    in this session is held in `reclaimedKeys` and handed back to a row added
 *    afterwards. Without that the promise is unkeepable for any camelCase key:
 *    a removed `pretTotal` re-added from the label "Preț total" would mint
 *    `pret_total` and strand the values for good. Clearing the values from
 *    every document of the type is the one irreversible act this screen could
 *    perform, and it is deliberately not built.
 *
 * 3. **The three specially-laid-out groups are offered by name.**
 *    `document-form.tsx` matches Financiar / Taxe și onorarii / Certificate și
 *    referințe by EXACT TEXT, so a group typed with one diacritic missing would
 *    save cleanly and quietly cost the type its layout. The picker takes them
 *    from `TEMPLATE_FIELD_GROUPS` and shows both spellings, so what is being
 *    written is visible. Free text is still allowed — it renders as its own
 *    generic two-column panel, which is the documented fall-through — but it is
 *    a deliberate second choice, not the only one.
 *
 * WHY IT WRITES THROUGH THE VALUE-LISTS PUT
 * -----------------------------------------
 * `PUT /api/document-types/[id]/template-fields` (#26.11) is ADDITIVE by
 * construction: `mergeAcceptedFields(current, accepted)` keeps every existing
 * field and appends. It cannot rename, reorder or remove, which is this whole
 * screen. `PUT /api/admin/value-lists/document-types/[id]` is a full-row
 * replace that already accepts `templateFields`, and #27.03 gave it the same
 * sanitising choke point (`sanitizeDocumentTypeTemplateFields`) and stopped it
 * resetting `sortOrder` on a payload that does not mention it — the two reasons
 * #26.11 gave for not using it. So it is the right door now.
 *
 * ⚠️ **A full replace needs the 409 that door does not have.** #26.11's route
 * takes `knownKeys` and refuses when the stored template has moved on, and it
 * names this screen as the hazard. The value-lists PUT has no such check, so
 * the check is made here, in the same shape: the key list read at mount is
 * compared against the LIVE one at save time (`templateFields` is a prop off
 * the list query, not a snapshot), and a save whose ground has shifted is
 * refused with a message rather than silently deleting whatever arrived in
 * between. This is weaker than the server's version — it cannot see a change
 * that lands between the check and the write — and it is what this door allows
 * without a new route, which this slice's constraint rules out.
 *
 * ORDER IS ARRAY POSITION, not a number anyone types. The server renumbers
 * `order` 0..n-1 from the array it receives, so ↑/↓ moving a row IS the edit.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buttonClass } from "@/lib/ui/button-styles";
import {
  parseTemplateFields,
  type DocumentTemplateFieldType,
} from "@/lib/documents/template-fields";
import { MAX_TEMPLATE_FIELDS } from "@/lib/documents/discover-to-template";
import { TEMPLATE_FIELD_GROUPS } from "@/lib/documents/template-groups";
import {
  ID_CARD_FORM_CODE,
  ID_CARD_RENAME_CODE,
} from "@/lib/documents/id-card-form-guard";
import {
  GROUP_CUSTOM,
  GROUP_NONE,
  blankEditorRow,
  editorRowsEqual,
  fieldsFromEditorRows,
  keysForRows,
  rowFromStoredField,
  sameKeyList,
  validateEditorRows,
  type ReclaimableKey,
  type TemplateEditorRow,
} from "@/lib/documents/template-editor-rows";

const FIELD_TYPES: readonly DocumentTemplateFieldType[] = [
  "text",
  "textarea",
  "date",
  "number",
] as const;

/** Which confirmation is open, if any. Only one ever is. */
type Pending =
  | { kind: "remove"; rowId: string }
  | { kind: "discard" }
  | null;

export function DocumentTypeFormEditor({
  typeId,
  typeName,
  templateFields,
  onClose,
}: {
  typeId: string;
  typeName: string;
  /** The raw `template_fields` jsonb off the list row. LIVE — see the 409 note. */
  templateFields: unknown;
  onClose: () => void;
}) {
  const t = useTranslations("valueList.templateFields");
  const qc = useQueryClient();

  /**
   * The rows as they were when this dialog opened.
   *
   * Mount-time snapshot on purpose: a background refetch must not throw away
   * edits in progress, and divergence is caught at save time instead (see the
   * 409 note). **`useState` with an initialiser, not `useMemo(…, [])`** —
   * React documents `useMemo` as a hint it may discard and recompute, and a
   * recomputed baseline would silently start comparing `dirty` against a
   * template that has moved on, so Escape would close without a prompt.
   */
  const [initialRows] = useState<TemplateEditorRow[]>(() =>
    parseTemplateFields(templateFields).map(rowFromStoredField),
  );
  const [rows, setRows] = useState<TemplateEditorRow[]>(initialRows);
  const [newRowSeq, setNewRowSeq] = useState(0);
  /** Stored rows removed in this session — see rule 2. */
  const [reclaimable, setReclaimable] = useState<ReclaimableKey[]>([]);
  /** Announced to a screen reader after a move: nothing else says one happened. */
  const [liveMessage, setLiveMessage] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  /** The key list as it was when this dialog opened. The 409's `knownKeys`. */
  const loadedKeys = useRef(initialRows.map((r) => r.key));

  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const confirmPanelRef = useRef<HTMLDivElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  /**
   * What to focus when a confirmation closes.
   *
   * ⚠️ **Captured in the CLICK handler, not in the effect**, and
   * `cancel-import-dialog.tsx` already paid for this lesson: the commit that
   * opens the confirmation also marks the panel `inert`, and the HTML
   * focus-fixup rule blurs a focused element the moment it gains an inert
   * ancestor — so by the time an effect runs, `document.activeElement` is
   * already `body`.
   */
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = `doc-type-form-editor-${typeId}`;

  const mutation = useMutation({
    mutationFn: async (fields: ReturnType<typeof fieldsFromEditorRows>) => {
      const res = await fetch(`/api/admin/value-lists/document-types/${typeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // `name` because the PUT is a full-row replace and its schema requires
        // it; it is the live value off the list row, not a copy taken at mount.
        // `sortOrder` is deliberately NOT sent: since #27.03 the update schema
        // leaves the column alone when the payload does not name it, and this
        // screen has no business reordering the admin list.
        body: JSON.stringify({ name: typeName, templateFields: fields }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const code = (body as { code?: string }).code;
        // ⚠️ **The identity-card refusal gets a Romanian sentence; everything
        // else still renders the server's own string.** (Slice #32.07.) That
        // fallback is English by construction and this screen has always shown
        // it — a real wart, and not this slice's to fix wholesale. What this
        // slice must not do is ADD to it: a new refusal that only a Romanian
        // administrator can act on, stated in English, is a worse screen than
        // the one it replaced.
        //
        // Only the `form` half is reachable from here — this editor sends the
        // live stored `typeName` and cannot rename — but both codes map to the
        // one sentence, because a screen that answers a refusal it did not
        // expect with a stack-shaped English string is the thing being fixed.
        if (code === ID_CARD_FORM_CODE || code === ID_CARD_RENAME_CODE) {
          throw new Error(t("errorIdCardType"));
        }
        throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["value-list", "document-types"] });
      // The same bare key the list modal invalidates — the document form's type
      // dropdown, the sidebar's Documents section and the import classify
      // panels all read it, and all three show whether a type has a form.
      qc.invalidateQueries({ queryKey: ["document-types"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const saving = mutation.isPending;
  const dirty = !editorRowsEqual(rows, initialRows);

  /** Close, but ask first if there is anything to lose. */
  const requestClose = useCallback((opener?: HTMLElement | null) => {
    if (saving) return;
    if (dirty) {
      restoreRef.current = opener ?? null;
      setPending({ kind: "discard" });
      return;
    }
    onClose();
  }, [dirty, onClose, saving]);

  // Escape closes the open confirmation first, then the editor. The list modal
  // underneath early-returns on Escape while this dialog is mounted, so exactly
  // one of the two handlers acts on any keypress.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (saving) return;
      if (pending) { setPending(null); return; }
      requestClose(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, requestClose, saving]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // An `alertdialog` is announced by being focused, not by appearing. Focus the
  // non-destructive button: the confirmation is a safety gate, so the default
  // target is the way out of it. On the way back, focus returns to whatever
  // opened it — without this, dismissing the confirmation on row 14 of a long
  // list drops focus to `body`, and the next Tab lands on the ✕ at the top.
  useEffect(() => {
    if (pending) { confirmCancelRef.current?.focus(); return; }
    const opener = restoreRef.current;
    restoreRef.current = null;
    // A confirmed removal unmounts its own opener, so fall back to the header.
    if (opener?.isConnected) opener.focus();
    else if (opener) closeRef.current?.focus();
  }, [pending]);

  /**
   * Keep Tab inside whichever panel is on top.
   *
   * Copied from `discover-review-dialog.tsx`, whose docblock states the rule
   * this app otherwise breaks: `aria-modal="true"` is a promise, the backdrop
   * stops the mouse and nothing stops the keyboard. **This dialog needs it more
   * than that one does, because it is the only one in the app that stacks on
   * another modal.** Without the trap, one Shift+Tab from the opening focus
   * lands on the value-list modal's Delete button — invisible behind this
   * backdrop — and pressing it opens a z-60 confirmation underneath a z-70
   * overlay, unclickable and unreachable by Escape.
   *
   * The confirmation, when open, is the panel that gets trapped: it renders in
   * its own container above everything else, so trapping the editor behind it
   * would put focus back under a backdrop.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const panel = pending ? confirmPanelRef.current : panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      // ⚠️ **`preventDefault` even with nothing to focus.** Every control in
      // the panel carries `disabled={saving}`, so during a save the selector
      // matches NOTHING — and a bare `return` here let Tab walk out of the
      // dialog into the value-list modal behind, onto the one button the trap
      // exists to make unreachable: Delete, whose z-60 confirmation would then
      // open UNDERNEATH this z-70 backdrop, invisible and immune to Escape.
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
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
  }, [pending]);

  const keys = useMemo(() => keysForRows(rows, reclaimable), [rows, reclaimable]);
  const atCapacity = rows.length >= MAX_TEMPLATE_FIELDS;
  /**
   * The type each stored row had when the dialog opened.
   *
   * ⚠️ **Changing a stored field's type is the quietest way to lose data on
   * this screen, and until round two it said nothing.** A field holding
   * "12.04.2021" switched from Text to Date renders an empty `<input
   * type="date">` on every document that has one — the value is still in
   * `custom_fields`, invisible and untypeable, and the next save of that
   * document writes over it. Remove, which loses nothing, gets a whole dialog;
   * this got silence. It is a warning rather than a block because re-typing a
   * field is a legitimate correction — the point is that it is a choice, made
   * knowingly.
   */
  const initialTypes = useMemo(
    () => new Map(initialRows.map((r) => [r.rowId, r.type])),
    [initialRows],
  );
  const removingRow = pending?.kind === "remove"
    ? rows.find((r) => r.rowId === pending.rowId) ?? null
    : null;
  const removingKey = removingRow?.key ?? "";

  function patch(rowId: string, changes: Partial<TemplateEditorRow>) {
    setError(null);
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...changes } : r)));
  }

  function move(index: number, delta: number, label: string) {
    const target = index + delta;
    // Bounds live here, not on the buttons' `disabled`: a button that becomes
    // disabled under the user's finger is blurred by every browser, so walking
    // a row to the top with the keyboard dropped focus to <body> on the last
    // press. The buttons stay enabled (marked `aria-disabled` at the ends so
    // the boundary is still announced) and the ends are simply no-ops.
    if (target < 0 || target >= rows.length) return;

    setError(null);
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });

    // Nothing else on screen changes in a way a screen reader reports: the
    // button's own accessible name is identical before and after, so without
    // this a move and a no-op at the end of the list are indistinguishable.
    //
    // ⚠️ **Outside the `setRows` updater, and never byte-identical twice.** An
    // updater must be pure — StrictMode double-invokes it — and an `aria-live`
    // region only announces when its text actually MUTATES. Nudging a row down
    // and back up produces the same sentence on the third press, React bails
    // out on `Object.is`, the text node is untouched and nothing is spoken —
    // which is the exact failure this line exists to fix, on the most ordinary
    // way there is to use ↑/↓. The zero-width space forces the mutation and is
    // silent in every screen reader.
    const message = t("movedTo", { label, position: target + 1, total: rows.length });
    setLiveMessage((prev) => (prev === message ? `${message}\u200B` : message));
  }

  function addRow() {
    if (atCapacity) return;
    setError(null);
    setRows((prev) => [...prev, blankEditorRow(`new-${newRowSeq}`)]);
    setNewRowSeq((n) => n + 1);
  }

  function dropRow(rowId: string) {
    setError(null);
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  /**
   * Remove, with the confirmation only where there is something to confirm.
   *
   * ⚠️ **A row added in this session gets no dialog, and that is a correctness
   * fix rather than a shortcut.** The confirmation's whole text is about values
   * already captured under a key — and a row that has never been saved has
   * neither. Round two caught it rendering "…the values already captured stay
   * in the database under the key “(key set from the label)”" for a blank new
   * row: a hint string shown as data, promising an undo for nothing.
   */
  function requestRemove(row: TemplateEditorRow, opener: HTMLElement | null) {
    if (!row.key) { dropRow(row.rowId); return; }
    restoreRef.current = opener;
    setPending({ kind: "remove", rowId: row.rowId });
  }

  function removeConfirmed() {
    if (!removingRow) return;
    const { rowId, key, labelRo, labelEn } = removingRow;
    setPending(null);
    dropRow(rowId);
    // Only a STORED key is worth holding: a row added and removed in the same
    // session has no captured values behind it — and `requestRemove` never
    // routes one here anyway. The LABELS travel with it so the key can be
    // reclaimed from what the field was called, not only from what it was keyed.
    if (key) {
      setReclaimable((prev) =>
        prev.some((r) => r.key === key) ? prev : [...prev, { key, labelRo, labelEn }],
      );
    }
  }

  function handleSave() {
    const problem = validateEditorRows(rows, keys);
    if (problem) {
      setError(
        problem.code === "duplicateKey"
          ? t("errorDuplicateKey", { key: problem.key })
          : problem.code === "groupNameRequired"
            ? t("errorGroupNameRequired")
            : t("errorLabelRequired"),
      );
      // The message names what is wrong; this names WHERE. On a twenty-field
      // type the offending row is very likely scrolled out of view, and an
      // error the administrator has to hunt for is one he will read as the
      // screen being broken.
      const row = panelRef.current?.querySelectorAll("tbody tr")[problem.index];
      row?.scrollIntoView({ block: "center" });
      // …and the control the message is about. "input, select" resolves to the
      // Romanian label, which is right for a missing label and for a duplicate
      // key, and wrong for a missing panel name — that one is the free-text
      // input in the fifth column, and focusing a field that is already correct
      // reads as the screen not knowing what it just complained about.
      row?.querySelector<HTMLElement>(
        problem.code === "groupNameRequired" ? "td:nth-child(5) input" : "input, select",
      )?.focus();
      return;
    }

    // ── The 409, made client-side. See the header. ─────────────────────────
    if (!sameKeyList(loadedKeys.current, parseTemplateFields(templateFields).map((f) => f.key))) {
      setError(t("errorChangedElsewhere"));
      return;
    }

    setError(null);
    mutation.mutate(fieldsFromEditorRows(rows, keys));
  }

  const inputClass =
    "w-full rounded-md border border-wire bg-white px-2 py-1.5 text-sm text-ink " +
    "shadow-sm focus:border-focus focus:outline-none " +
    "disabled:bg-cap disabled:text-fade " +
    "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-800";

  return (
    <>
      {/* z-70: this opens on top of the value-list modal (z-50) and its own
          delete dialog (z-60). No backdrop click handler, deliberately — a
          stray click must not discard an editing session. */}
      <div className="fixed inset-0 z-70 bg-black/50 backdrop-blur-sm" aria-hidden />

      <div className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto p-4">
        {/* `inert` while a confirmation is open: the Tab trap keeps the
            keyboard in, and this keeps a screen reader's virtual cursor in
            too — nested `aria-modal` is undefined behaviour and AT picks one.
            Same mechanism `import-wizard.tsx` already uses. */}
        <div
          ref={panelRef}
          inert={pending !== null}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="my-8 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id={titleId}
                className="text-base font-semibold text-ink dark:text-zinc-100"
              >
                {t("title", { type: typeName })}
              </h2>
              <p className="mt-1 text-sm text-fade dark:text-zinc-400">{t("intro")}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={(e) => requestClose(e.currentTarget)}
              disabled={saving}
              className={buttonClass({ variant: "bare", size: "md" })}
              aria-label={t("close")}
            >
              ✕
            </button>
          </div>

          {/* ── The fields ──────────────────────────────────────────────── */}
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {rows.length === 0 ? (
              <p className="rounded-md border border-dashed border-wire px-4 py-8 text-center text-sm text-fade dark:border-zinc-700 dark:text-zinc-400">
                {t("empty")}
              </p>
            ) : (
              <div>
                {/* No `overflow-x-auto` wrapper, deliberately: the table is
                    `w-full` with four fixed-width columns so it does not scroll
                    sideways — and a wrapper with `overflow-x-auto` computes
                    `overflow-y` to `auto` as well, which would make IT the
                    sticky containing block instead of the dialog body, and the
                    header below would stick to a box that never scrolls. */}
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">{t("tableCaption", { type: typeName })}</caption>
                  <thead>
                    {/* Sticky: seven columns of near-identical text inputs, and
                        past about eight rows there is nothing left to tell
                        "Etichetă (EN)" from "Indiciu AI". The border and the
                        background sit on the cells rather than the row, because
                        a `<tr>` cannot carry either under `border-collapse`
                        once its cells are positioned. */}
                    <tr className="text-left text-xs uppercase tracking-wide text-fade dark:text-zinc-400">
                      {[
                        ["colOrder", "w-20 pr-2"],
                        ["colLabelRo", "pr-3"],
                        ["colLabelEn", "pr-3"],
                        ["colType", "w-32 pr-3"],
                        ["colGroup", "w-56 pr-3"],
                        ["colHint", "pr-3"],
                      ].map(([id, width]) => (
                        <th
                          key={id}
                          scope="col"
                          className={`sticky top-0 z-10 border-b border-crease bg-card py-2 dark:border-zinc-700 dark:bg-zinc-900 ${width}`}
                        >
                          {t(id as "colOrder")}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="sticky top-0 z-10 w-24 border-b border-crease bg-card py-2 dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <span className="sr-only">{t("colActions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const key = keys[index];
                      const label = row.labelRo.trim() || row.labelEn.trim() || key;
                      return (
                        <tr
                          key={row.rowId}
                          className="border-b border-crease/60 align-top dark:border-zinc-800"
                        >
                          <td className="py-2 pr-2">
                            <div className="flex gap-1">
                              {/* `aria-disabled`, not `disabled`: the boundary
                                  is still announced, but the button keeps focus
                                  when a row reaches the end of the list. */}
                              <button
                                type="button"
                                onClick={() => move(index, -1, label)}
                                disabled={saving}
                                aria-disabled={index === 0}
                                aria-label={t("moveUpAria", { label })}
                                className={buttonClass({ variant: "secondary", size: "xs" })}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => move(index, 1, label)}
                                disabled={saving}
                                aria-disabled={index === rows.length - 1}
                                aria-label={t("moveDownAria", { label })}
                                className={buttonClass({ variant: "secondary", size: "xs" })}
                              >
                                ↓
                              </button>
                            </div>
                          </td>

                          <td className="py-2 pr-3">
                            <input
                              type="text"
                              value={row.labelRo}
                              disabled={saving}
                              onChange={(e) => patch(row.rowId, { labelRo: e.target.value })}
                              aria-label={t("labelRoAria", { key: key || t("keyPending") })}
                              className={inputClass}
                            />
                            {/* Rule 1, on every row: the key, shown and inert. */}
                            <span className="mt-1 block font-mono text-xs text-fade dark:text-zinc-500">
                              {key || t("keyPending")}
                              {/* Not on a RECLAIMED key: that is the old key
                                  coming back to the values behind it, and
                                  labelling it "new" says the opposite. */}
                              {!row.key && key && !reclaimable.some((r) => r.key === key) && (
                                <span className="ml-2 font-sans">{t("keyNew")}</span>
                              )}
                            </span>
                          </td>

                          <td className="py-2 pr-3">
                            <input
                              type="text"
                              value={row.labelEn}
                              disabled={saving}
                              onChange={(e) => patch(row.rowId, { labelEn: e.target.value })}
                              aria-label={t("labelEnAria", { key: key || t("keyPending") })}
                              className={inputClass}
                            />
                          </td>

                          <td className="py-2 pr-3">
                            <select
                              value={row.type}
                              disabled={saving}
                              onChange={(e) =>
                                patch(row.rowId, {
                                  type: e.target.value as DocumentTemplateFieldType,
                                })
                              }
                              aria-label={t("typeAria", { label })}
                              className={inputClass}
                            >
                              {FIELD_TYPES.map((ft) => (
                                <option key={ft} value={ft}>
                                  {t(`types.${ft}` as "types.text")}
                                </option>
                              ))}
                            </select>
                            {initialTypes.has(row.rowId) && initialTypes.get(row.rowId) !== row.type && (
                              <p className="mt-1 text-xs leading-snug text-amber-700 dark:text-amber-400">
                                {t("typeChangedWarning")}
                              </p>
                            )}
                          </td>

                          <td className="py-2 pr-3">
                            <select
                              value={row.groupChoice}
                              disabled={saving}
                              onChange={(e) => patch(row.rowId, { groupChoice: e.target.value })}
                              aria-label={t("groupAria", { label })}
                              className={inputClass}
                            >
                              <option value={GROUP_NONE}>{t("groupNone")}</option>
                              {/* Both spellings shown: these strings are the
                                  data, and an exact-text match is what earns
                                  the type its special layout. */}
                              {TEMPLATE_FIELD_GROUPS.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.ro} / {g.en}
                                </option>
                              ))}
                              <option value={GROUP_CUSTOM}>{t("groupCustom")}</option>
                            </select>
                            {row.groupChoice === GROUP_CUSTOM && (
                              <input
                                type="text"
                                value={row.groupCustom}
                                disabled={saving}
                                onChange={(e) => patch(row.rowId, { groupCustom: e.target.value })}
                                placeholder={t("groupCustomPlaceholder")}
                                aria-label={t("groupCustomAria", { label })}
                                className={`${inputClass} mt-1`}
                              />
                            )}
                          </td>

                          <td className="py-2 pr-3">
                            <input
                              type="text"
                              value={row.aiHint}
                              disabled={saving}
                              onChange={(e) => patch(row.rowId, { aiHint: e.target.value })}
                              aria-label={t("hintAria", { label })}
                              className={inputClass}
                            />
                          </td>

                          <td className="py-2">
                            <button
                              type="button"
                              onClick={(e) => requestRemove(row, e.currentTarget)}
                              disabled={saving}
                              className={buttonClass({ variant: "danger", size: "xs" })}
                            >
                              {t("remove")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={addRow}
                disabled={saving || atCapacity}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                + {t("add")}
              </button>
              <span className="text-xs text-fade dark:text-zinc-400">
                {atCapacity
                  ? t("atCapacity", { max: MAX_TEMPLATE_FIELDS })
                  : t("count", { count: rows.length, max: MAX_TEMPLATE_FIELDS })}
              </span>
            </div>

            {/* Rule 1, said once in words rather than only implied by a
                disabled input that does not exist. */}
            <p className="mt-4 rounded-md border border-wire bg-cta-pale px-4 py-3 text-xs leading-relaxed text-ink dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
              {t("keyNote")}
            </p>
          </div>

          {/* Reordering changes nothing a screen reader reports on its own —
              the buttons' accessible names are identical before and after. */}
          <p role="status" aria-live="polite" className="sr-only">
            {liveMessage}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
            >
              <span className="mt-0.5 shrink-0 font-bold">!</span>
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={buttonClass({ variant: "primary", size: "sm" })}
            >
              {saving ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              onClick={(e) => requestClose(e.currentTarget)}
              disabled={saving}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Confirmations: remove a field, or discard the session ───────── */}
      {pending && (
        <>
          <div className="fixed inset-0 z-80 bg-black/50" aria-hidden />
          <div
            ref={confirmPanelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="editor-confirm-title"
            aria-describedby="editor-confirm-body"
            className="fixed inset-x-4 top-1/4 z-80 mx-auto max-w-md rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3
              id="editor-confirm-title"
              className="text-sm font-semibold text-ink dark:text-zinc-100"
            >
              {pending.kind === "discard"
                ? t("confirmDiscardTitle")
                : t("confirmRemoveTitle", {
                    label:
                      removingRow?.labelRo.trim() ||
                      removingRow?.labelEn.trim() ||
                      removingKey,
                  })}
            </h3>
            {/* The remove text says plainly what happens to the values already
                captured — the whole point of the Ask-first this slice settled.
                The key is in the sentence because it is what makes the undo
                possible, and `reclaimedKeys` is what makes the undo real. */}
            <p
              id="editor-confirm-body"
              className="mt-3 text-sm leading-relaxed text-ink dark:text-zinc-300"
            >
              {pending.kind === "discard"
                ? t("confirmDiscardBody")
                /* `removingKey` is the STORED key, never a derived one: this
                   dialog only opens for a row that has one. */
                : t("confirmRemoveBody", { key: removingKey })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={pending.kind === "discard" ? onClose : removeConfirmed}
                className={buttonClass({ variant: "danger", size: "sm" })}
              >
                {pending.kind === "discard" ? t("confirmDiscard") : t("confirmRemove")}
              </button>
              <button
                ref={confirmCancelRef}
                type="button"
                onClick={() => setPending(null)}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
