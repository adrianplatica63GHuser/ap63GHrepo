"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buttonClass } from "@/lib/ui/button-styles";
// Slice #29.13: one sentence, translated once. This panel had no `onError` on
// its delete at all — the exact state value-list-modal.tsx's own comment
// describes as fixed, one modal over — and rendered the server's English
// `err.message` on every save. See the module header for both.
import {
  RequestFailedError,
  throwRequestFailed,
} from "@/lib/admin/value-lists/failures";

// ── Types ─────────────────────────────────────────────────────────────────────

type AssocRow = {
  id: string;
  documentTypeId: string;
  personRoleId: string;
  documentTypeName: string;
  personRoleName: string;
};

type LookupItem = { id: string; name: string };

/**
 * A value-list row AS THE API SENDS IT — `id` and `name` plus whatever else
 * that list carries (`description`, `validForProperty`, … on person-roles).
 * Named so the cache's shape is legible at the `useQuery` below: what is stored
 * is the row, and `LookupItem` is only what this panel derives from it.
 */
type ValueListRow = LookupItem & Record<string, unknown>;

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchAssociations(): Promise<AssocRow[]> {
  const res = await fetch("/api/admin/doc-type-person-roles");
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  const data = await res.json();
  return data.items as AssocRow[];
}

/**
 * ⚠️ **THE CACHE ENTRY KEEPS THE API'S ROWS. THE PROJECTION IS A `select`, AND
 * AN ADVERSARIAL ROUND PROVED WHY.**                            (Slice #34.04)
 *
 * These two fetchers used to `.map()` each row down to `{ id, name }` and cache
 * THAT under `["value-list", "document-types"]` / `["value-list",
 * "person-roles"]` — keys the generic Reference Data modal
 * (`value-list-modal.tsx`) holds as the API's full `items` array, and which
 * `@/hooks/use-lookup-options` now reads too. React Query serves ONE ENTRY PER
 * KEY, so whichever component mounted first decided what the others got, and
 * this panel's projection is the lossy one.
 *
 * Measured, against a real `query-core` with the app's 30 s staleTime: open
 * „Persoană → Document", close it, open „Roluri Persoană" within 30 seconds,
 * and every role's `description`, `validForProperty` and `validForPerson`
 * render as „–" — because the cached rows do not have them. `startEdit` then
 * seeds the edit form from those rows and `updateValue` is a full-replace
 * `.set(data)`, so **renaming a role in that state unticks both flags and
 * blanks its description**, and the role drops out of all four association
 * dropdowns. The two flags are Slice #34.04's; the description half of this had
 * been reachable since #29.13.
 *
 * `select` transforms per observer and leaves the cache alone, which is the
 * whole point: one key, one shape, every reader deriving what it needs.
 */
async function fetchValueListRows(list: string): Promise<ValueListRow[]> {
  const res = await fetch(`/api/admin/value-lists/${list}`);
  // ⚠️ **`res.redirected` as well as `!res.ok`, and an adversarial round
  // measured why it matters HERE and not only in the fetcher that first had
  // it.** An expired session answers with a redirect to the login page, whose
  // HTML parses to `{}`; `data.items ?? []` then reads as "the archive holds
  // none" and React Query caches a SUCCESSFUL empty array. Since Slice #34.04
  // this entry is shared — `@/hooks/use-lookup-options` reads the same
  // `["value-list", …]` keys — so on a shared entry the WEAKEST queryFn defines
  // the failure semantics for every reader: the guarded hook would find a fresh
  // empty list, never refetch, and show a silently empty dropdown with no alert
  // for the 30 s staleTime. That is exactly what the guard exists to prevent,
  // re-entering through the key.
  if (res.redirected || !res.ok) throw new Error(`Failed to load ${list} (${res.status})`);
  const data = await res.json();
  return (data.items ?? []) as ValueListRow[];
}

const toLookupItems = (rows: ValueListRow[]): LookupItem[] =>
  rows.map((r) => ({ id: r.id, name: r.name }));

async function createAssociation(data: {
  documentTypeId: string;
  personRoleId: string;
}): Promise<AssocRow> {
  const res = await fetch("/api/admin/doc-type-person-roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  // A 400 here is this form's own rejection and a 409 is "that row already
  // exists"; both arrive in English ("Invalid input", "This role is already in
  // the list"), so what crosses is a CODE and the sentence is chosen from
  // `valueList.confirm.errors` on this side.
  if (!res.ok) await throwRequestFailed(res, true);
  return res.json();
}

async function removeAssociation(id: string): Promise<void> {
  const res = await fetch(`/api/admin/doc-type-person-roles/${id}`, {
    method: "DELETE",
  });
  // ⚠️ **`false`, not `true`: a 400 from a DELETE is not a form.** There is no
  // body to be wrong here — the id is in the path — so a 400 falls through to
  // the generic sentence rather than telling the user to check fields that do
  // not exist on this screen.
  if (!res.ok && res.status !== 204) await throwRequestFailed(res);
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddForm({
  docTypes,
  personRoles,
  onClose,
  onSaved,
}: {
  docTypes: LookupItem[];
  personRoles: LookupItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("valueList.documentPersons");
  // The shared failure sentences. A second hook rather than a fourth copy
  // of the same six keys under this panel's own namespace.  (Slice #29.13)
  const tErr = useTranslations("valueList.confirm.errors");
  const qc = useQueryClient();
  const [docTypeId, setDocTypeId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createAssociation({ documentTypeId: docTypeId, personRoleId: roleId }),
    onSuccess: () => {
      // The same broad invalidation the delete does, and for the same reason:
      // a role ticked here is a role the association screens' dropdowns must
      // offer, and they cache it under keys of their own. (Slice #29.13)
      qc.invalidateQueries();
      onSaved();
    },
    // ⚠️ **Never `err.message`.** That is the server's English — "Invalid
    // input", "Failed to create", "This association already exists" — on a
    // screen CLAUDE.md's first rule says must never show any. The code chooses
    // the Romanian sentence; anything unrecognised becomes the generic one
    // rather than leaking.                                     (Slice #29.13)
    onError: (err: Error) =>
      setError(tErr(err instanceof RequestFailedError ? err.code : "generic")),
  });

  function handleSubmit() {
    if (!docTypeId || !roleId) {
      setError(t("errorBothRequired"));
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="mb-4 rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">
        {t("addTitle")}
      </h3>

      <div className="flex flex-wrap gap-3">
        {/* Document Type dropdown */}
        <div className="flex min-w-56 flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("colDocType")}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <select
            value={docTypeId}
            onChange={(e) => setDocTypeId(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">{t("selectDocType")}</option>
            {docTypes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Person Role dropdown */}
        <div className="flex min-w-56 flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("colPersonRole")}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">{t("selectPersonRole")}</option>
            {personRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hint text */}
      <div className="mt-3 space-y-1">
        <p className="text-xs text-fade dark:text-zinc-400">
          ℹ {t("hintDocType")}
        </p>
        <p className="text-xs text-fade dark:text-zinc-400">
          ℹ {t("hintPersonRole")}
        </p>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className={buttonClass({ variant: "primary", size: "sm" })}
        >
          {mutation.isPending ? t("saving") : t("save")}
        </button>
        <button
          onClick={onClose}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function DocumentPersonsModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("valueList.documentPersons");
  // The shared failure sentences. A second hook rather than a fourth copy
  // of the same six keys under this panel's own namespace.  (Slice #29.13)
  const tErr = useTranslations("valueList.confirm.errors");
  const tModal = useTranslations("valueList.modal");
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  /** The refusal, in Romanian. Cleared whenever the dialog opens or closes. */
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * ⚠️ **THE CONFIRMATION COULD BE RE-TARGETED ONTO A DIFFERENT ROW WITHOUT
   * ANYTHING ON SCREEN CHANGING.**                             (Slice #29.13)
   *
   * Its backdrop hid the list and did not disable it, the panel had no focus
   * trap, and `confirmDelete` names no row — so Tab walked through the overlay
   * to ANOTHER row's Șterge, Enter re-keyed this dialog onto it, and the next
   * press deleted a row the user never chose. That is the adversarial finding
   * value-list-modal.tsx:699 records for the list beside this one, still live
   * here; `inert` on the list panel is what actually stops the Tab, and it
   * needs the panel to be a ref.
   *
   * The rest is what `aria-modal` costs once it is honest: the panel is
   * focused on open (an `alertdialog` nobody focuses announces nothing), it is
   * named by the question it asks, and focus goes back to the button that
   * opened it — captured in the CLICK handler, because the same commit marks
   * the list `inert` and the HTML focus-fixup rule has already blurred that
   * button by effect time.
   */
  const listPanelRef    = useRef<HTMLDivElement>(null);
  const confirmPanelRef = useRef<HTMLDivElement>(null);
  const deleteOpenerRef = useRef<HTMLElement | null>(null);
  /** Has a confirmation actually been open? Guards the restore on mount. */
  const wasOpenRef      = useRef(false);
  const listTitleId     = useId();
  const confirmTitleId  = useId();

  /**
   * Hand focus back when the confirmation closes.
   *
   * ⚠️ **AN EFFECT, NOT A `focus()` INSIDE THE CLICK HANDLER, AND AN
   * ADVERSARIAL ROUND IS WHY.** The first version of this fix called
   * `opener.focus()` straight after `setConfirmDeleteId(null)` — synchronously,
   * so the list panel still carried `inert`, and `focus()` on an element inside
   * an inert subtree is a spec-mandated no-op. Focus ended on `<body>`, outside
   * both dialogs, which is the state the whole rework exists to prevent; the
   * comment claiming otherwise was simply false. Effects run after React has
   * removed the attribute, on every lane — including the delete's `onSuccess`,
   * which is a promise callback and would defeat a `queueMicrotask` too. This
   * is the pattern value-list-modal.tsx:441 spells out at length.
   *
   * ⚠️ **The `else` is not a fallback for the delete case alone.** A third
   * round asked what happens when the row leaves the list under an OPEN
   * confirmation — a refetch on window focus, or the broad invalidation after
   * the role was cascaded away: the opener is then detached and no delete
   * happened, so a restore keyed on "was it a delete" fires neither branch and
   * leaves focus on `<body>`, outside a modal with no Tab trap. Whatever the
   * reason the opener is unreachable, the list panel is where focus belongs.
   *
   * ⚠️ **IT USED TO DO NOTHING ON MOUNT, AND SLICE #34.10 MADE THAT WRONG.**
   * The sentence here read: "`wasOpenRef` is false until a confirmation has
   * really been opened, so the panel does not steal focus from the page behind
   * it." That was right while this panel was mounted by `value-list-hub.tsx`,
   * over a live page. It is now mounted by `value-list-modal.tsx`, which makes
   * its own panel `inert` while this one is open — and the button that opened
   * this panel is INSIDE that panel. So in the commit that opens the grid the
   * focused element becomes inert, the UA runs the unfocusing steps, and focus
   * goes to `<body>`: "not stealing focus from the page behind" became "focus
   * lands nowhere". The next Tab then starts at the top of the document and
   * walks the sidebar and the breadcrumb, which are not inert and now sit under
   * a z-80 backdrop — focusable, invisible, and unreachable by mouse. Found by
   * an adversarial round; it is the same visible-but-inert failure that round
   * fixed on the paint axis, arriving on the focus axis.
   *
   * The mount focus below is the same target the delete path already falls back
   * to, and `listPanelRef` is already `tabIndex={-1}` for exactly this.
   */
  useEffect(() => {
    if (confirmDeleteId) {
      wasOpenRef.current = true;
      confirmPanelRef.current?.focus();
      return;
    }
    if (!wasOpenRef.current) {
      // Slice #34.10 — the mount case. See above for why it is no longer a
      // steal. Runs once: after any confirmation `wasOpenRef` is true and the
      // opener restore below takes over.
      listPanelRef.current?.focus();
      return;
    }
    wasOpenRef.current = false;
    const opener = deleteOpenerRef.current;
    deleteOpenerRef.current = null;
    if (opener?.isConnected) opener.focus();
    else listPanelRef.current?.focus();
  }, [confirmDeleteId]);

  /**
   * Close the confirmation without deleting, and put focus back.
   *
   * `useCallback` with no dependencies — it touches only setters and refs,
   * both stable — so the Escape effect below can depend on it honestly
   * instead of closing over a stale copy or silencing the lint rule.
   */
  const closeConfirm = useCallback(() => {
    setDeleteError(null);
    setConfirmDeleteId(null);
    // Focus is restored by the effect above, not here — see its header.
  }, []);

  const assocQuery = useQuery<AssocRow[]>({
    queryKey: ["doc-type-person-roles"],
    queryFn: fetchAssociations,
  });

  const docTypesQuery = useQuery({
    queryKey: ["value-list", "document-types"],
    queryFn: () => fetchValueListRows("document-types"),
    select: toLookupItems,
  });

  const rolesQuery = useQuery({
    queryKey: ["value-list", "person-roles"],
    queryFn: () => fetchValueListRows("person-roles"),
    select: toLookupItems,
  });

  /**
   * ⚠️ **`onError` — this mutation had none.**                 (Slice #29.13)
   *
   * A failed delete left the confirmation dialog sitting there with its button
   * re-enabled and nothing said anywhere, which is word for word what
   * value-list-modal.tsx's own comment describes as the state #29.05 fixed on
   * the list beside this one. The dialog stays OPEN on a failure — closing it
   * would take the sentence with it — and the row's own Șterge is still there
   * to try again.
   */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeAssociation(id),
    onSuccess: () => {
      // ⚠️ **Everything, not just this panel's own key.** These rows ARE the
      // role dropdowns on the association screens, and those cache them under
      // their own keys — `document-valid-roles` and `doc-distinct-roles`
      // (`property-person-roles-whitelist` was a third until Slice #34.04
      // deleted the endpoint behind it). With the global 30 s staleTime,
      // un-ticking a role here and walking straight to an associate screen went
      // on offering it. Same reasoning, and same cost, as the
      // delete in value-list-modal.tsx: an administrator action taken a
      // handful of times in the life of an archive.
      qc.invalidateQueries();
      setDeleteError(null);
      // Not the opener: it was that row's Șterge and it is going with the row.
      // The effect above then falls through to the list panel.
      deleteOpenerRef.current = null;
      setConfirmDeleteId(null);
    },
    onError: (err: Error) =>
      setDeleteError(tErr(err instanceof RequestFailedError ? err.code : "generic")),
  });

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (confirmDeleteId) {
          // ⚠️ **Not while the delete is in flight.** The mutation completes
          // regardless — TanStack keeps `onError` on the mutation, not on the
          // observer — so an Escape here unmounts the only place the refusal
          // is ever reported, and a delete that failed reads as one the user
          // cancelled.                                          (Slice #29.13)
          if (deleteMutation.isPending) return;
          closeConfirm();
          return;
        }
        // ⚠️ **Guarded on what is RENDERED, not on the flag alone — Slice
        // #34.10.** `AddForm` draws only once BOTH lookups have landed
        // (`showAdd && docTypesQuery.data && rolesQuery.data`), so between the
        // press of „Adaugă" and the second response `showAdd` is true with
        // nothing on screen, and Escape was swallowed. `value-list-modal.tsx`
        // records the identical trap for its delete confirmation and guards it
        // the same way. Pre-existing, and it costs more since this panel moved:
        // it is two modals deep now, so the key the user is pressing is the one
        // that gets them out of both.
        if (showAdd && docTypesQuery.data && rolesQuery.data) { setShowAdd(false); return; }
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    confirmDeleteId,
    showAdd,
    docTypesQuery.data,
    rolesQuery.data,
    onClose,
    closeConfirm,
    deleteMutation.isPending,
  ]);

  return (
    <>
      {/* Overlay */}
      <div
        // ⚠️ **z-80, RAISED FROM z-40 BY SLICE #34.10 BECAUSE THIS PANEL
        // MOVED INTO A STACK.** It used to be mounted by `value-list-hub.tsx`,
        // a plain page with no other dialog on it, so z-40/z-50 competed with
        // nothing. It is now a SIBLING of the Document Types list panel inside
        // the same fragment and the same stacking context, and that list is
        // z-50 — so at z-40 this backdrop painted UNDER it: the lower part of
        // the list, wherever this shorter panel did not cover it, stayed fully
        // lit while being `inert`, so it was neither dimmed nor clickable nor a
        // backdrop-click that closes. The ladder the two siblings already keep
        // is list overlay 40 / list panel 50 / its delete confirm 60 / form
        // editor 70 / **the form editor's own delete confirm 80**; this pair
        // takes 80 and its own confirmation 90.
        //
        // ⚠️ **80 IS SHARED WITH THAT LAST ONE, DELIBERATELY, AND THE REASON IS
        // WHY IT IS SAFE RATHER THAN LUCKY.** The two can never be on screen
        // together: the form editor opens from a row's "Formular" button and
        // this grid from the toolbar, and both buttons live inside the list
        // panel that each of them makes `inert`, so opening either takes the
        // other's door away. Reaching for 100 instead would have collided with
        // `unsaved-changes-provider.tsx`'s `z-[100]`, which is correctly
        // topmost. An adversarial round checked the whole ladder — a first
        // draft of this comment stopped one rung below the rung it claimed,
        // which is exactly the omission that produced the bug it documents.
        //
        // Found by an adversarial round, which also noted that #34.10's first
        // draft fixed only the keyboard half of this move.
        className="fixed inset-0 z-80 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={listPanelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        // Focus lands here after a delete, and an `aria-modal` container with no
        // accessible name announces itself as "dialog" and nothing else — the
        // reason value-list-modal.tsx:365 added the same id.  (Slice #29.13)
        aria-labelledby={listTitleId}
        // Slice #29.13: the backdrop hides this panel, it does not disable it —
        // see the comment on `listPanelRef` for the row the Tab reached.
        inert={!!confirmDeleteId}
        className="fixed inset-x-4 top-[5%] z-80 mx-auto max-w-3xl rounded-xl border border-card-rim bg-card shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-800">
          <h2
            id={listTitleId}
            className="text-base font-semibold text-ink dark:text-zinc-100"
          >
            {t("title")}
          </h2>
          <button
            onClick={onClose}
            className={buttonClass({ variant: "bare", size: "md" })}
            aria-label={tModal("close")}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex max-h-[80vh] flex-col overflow-hidden">
          <div className="overflow-y-auto p-5">
            {/* Add form */}
            {showAdd && docTypesQuery.data && rolesQuery.data && (
              <AddForm
                docTypes={docTypesQuery.data}
                personRoles={rolesQuery.data}
                onClose={() => setShowAdd(false)}
                onSaved={() => setShowAdd(false)}
              />
            )}

            {/* Toolbar */}
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => setShowAdd(true)}
                disabled={showAdd}
                className={buttonClass({ variant: "primary", size: "sm" })}
              >
                + {t("add")}
              </button>
              {assocQuery.data && (
                <span className="text-xs text-fade dark:text-zinc-400">
                  {t("count", { count: assocQuery.data.length })}
                </span>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-md border border-card-rim dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-2">{t("colDocType")}</th>
                    <th className="px-4 py-2">{t("colPersonRole")}</th>
                    <th className="w-20 px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-crease bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                  {assocQuery.isLoading && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-fade">
                        {t("loading")}
                      </td>
                    </tr>
                  )}
                  {assocQuery.isError && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-red-600">
                        {t("error")}
                      </td>
                    </tr>
                  )}
                  {assocQuery.data?.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-fade">
                        {t("empty")}
                      </td>
                    </tr>
                  )}
                  {assocQuery.data?.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-cta-pale dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-2 text-ink dark:text-zinc-300">
                        {row.documentTypeName}
                      </td>
                      <td className="px-4 py-2 text-ink dark:text-zinc-300">
                        {row.personRoleName}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={(e) => {
                              deleteOpenerRef.current = e.currentTarget;
                              setDeleteError(null);
                              setConfirmDeleteId(row.id);
                            }}
                          className={buttonClass({ variant: "danger", size: "xs" })}
                        >
                          {t("delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm dialog */}
      {confirmDeleteId && (
        <>
          {/* z-90 — above this panel's own z-80, for the reason the overlay
              above states. At z-60 it opened UNDERNEATH its own parent. */}
          <div className="fixed inset-0 z-90 bg-black/50" aria-hidden />
          <div
            ref={confirmPanelRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            className="fixed inset-x-4 top-1/3 z-90 mx-auto max-w-sm rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p
              id={confirmTitleId}
              className="mb-4 text-sm text-ink dark:text-zinc-300"
            >
              {t("confirmDelete")}
            </p>
            {/* ⚠️ **Rendered unconditionally, and BELOW the question.** A live
                region mounted together with its text is not reliably
                announced, and the reason a press failed belongs where the
                press happened rather than behind the closing dialog. Before
                this slice there was nothing here at all: the button simply
                re-enabled itself.                              (Slice #29.13) */}
            <p
              role="alert"
              className="mb-3 text-xs text-red-600 empty:mb-0 dark:text-red-400"
            >
              {deleteError ?? ""}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                disabled={deleteMutation.isPending}
                className={buttonClass({ variant: "danger", size: "sm" })}
              >
                {deleteMutation.isPending ? t("deleting") : t("delete")}
              </button>
              <button
                onClick={closeConfirm}
                // Same reason as the Escape guard above: closing mid-delete
                // throws away the sentence the failure is about to produce.
                disabled={deleteMutation.isPending}
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
