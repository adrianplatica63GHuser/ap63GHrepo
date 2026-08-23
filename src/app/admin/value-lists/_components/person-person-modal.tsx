"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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

type PersonPersonRoleRow = {
  id:                    string;
  personRoleId:          string;
  personRoleName:        string;
  personRoleDescription: string | null;
};

type LookupItem = { id: string; name: string; description: string | null };

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchPersonPersonRoles(): Promise<PersonPersonRoleRow[]> {
  const res = await fetch("/api/admin/person-person-roles");
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return ((await res.json()).items as PersonPersonRoleRow[]);
}

async function fetchAllPersonRoles(): Promise<LookupItem[]> {
  const res = await fetch("/api/admin/value-lists/person-roles");
  if (!res.ok) throw new Error(`Failed to load person roles (${res.status})`);
  const data = await res.json();
  return (data.items as Array<{ id: string; name: string; description?: string | null }>).map(
    (r) => ({ id: r.id, name: r.name, description: r.description ?? null }),
  );
}

async function addPersonPersonRole(personRoleId: string): Promise<PersonPersonRoleRow> {
  const res = await fetch("/api/admin/person-person-roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personRoleId }),
  });
  // A 400 here is this form's own rejection and a 409 is "that row already
  // exists"; both arrive in English ("Invalid input", "This role is already in
  // the list"), so what crosses is a CODE and the sentence is chosen from
  // `valueList.confirm.errors` on this side.
  if (!res.ok) await throwRequestFailed(res, true);
  return res.json();
}

async function removePersonPersonRole(id: string): Promise<void> {
  const res = await fetch(`/api/admin/person-person-roles/${id}`, { method: "DELETE" });
  // ⚠️ **`false`, not `true`: a 400 from a DELETE is not a form.** There is no
  // body to be wrong here — the id is in the path — so a 400 falls through to
  // the generic sentence rather than telling the user to check fields that do
  // not exist on this screen.
  if (!res.ok && res.status !== 204) await throwRequestFailed(res);
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddForm({
  allRoles,
  alreadyAdded,
  onClose,
  onSaved,
}: {
  allRoles:     LookupItem[];
  alreadyAdded: Set<string>;
  onClose:      () => void;
  onSaved:      () => void;
}) {
  const t  = useTranslations("valueList.personPersonRoles");
  // The shared failure sentences. A second hook rather than a fourth copy
  // of the same six keys under this panel's own namespace.  (Slice #29.13)
  const tErr = useTranslations("valueList.confirm.errors");
  const qc = useQueryClient();
  const [roleId, setRoleId] = useState("");
  const [error,  setError]  = useState<string | null>(null);

  const available = allRoles.filter((r) => !alreadyAdded.has(r.id));

  const mutation = useMutation({
    mutationFn: () => addPersonPersonRole(roleId),
    onSuccess:  () => {
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
    if (!roleId) { setError(t("errorRequired")); return; }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="mb-4 rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">{t("addTitle")}</h3>
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-72 flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("colPersonRole")}<span className="ml-0.5 text-red-500">*</span>
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">{t("selectPersonRole")}</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-3 text-xs text-fade dark:text-zinc-400">ℹ {t("hintPersonRole")}</p>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending || available.length === 0}
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

export function PersonPersonModal({ onClose }: { onClose: () => void }) {
  const t      = useTranslations("valueList.personPersonRoles");
  // The shared failure sentences. A second hook rather than a fourth copy
  // of the same six keys under this panel's own namespace.  (Slice #29.13)
  const tErr = useTranslations("valueList.confirm.errors");
  const tModal = useTranslations("valueList.modal");
  const qc     = useQueryClient();

  const [showAdd,         setShowAdd]         = useState(false);
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
   * It does nothing on mount, deliberately: `wasOpenRef` is false until a
   * confirmation has really been opened, so the panel does not steal focus
   * from the page behind it.
   */
  useEffect(() => {
    if (confirmDeleteId) {
      wasOpenRef.current = true;
      confirmPanelRef.current?.focus();
      return;
    }
    if (!wasOpenRef.current) return;
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

  const listQuery = useQuery<PersonPersonRoleRow[]>({
    queryKey: ["person-person-roles"],
    queryFn:  fetchPersonPersonRoles,
  });

  const rolesQuery = useQuery<LookupItem[]>({
    queryKey: ["value-list", "person-roles"],
    queryFn:  fetchAllPersonRoles,
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
    mutationFn: (id: string) => removePersonPersonRole(id),
    onSuccess: () => {
      // ⚠️ **Everything, not just this panel's own key.** These rows ARE the
      // role dropdowns on the association screens, and those cache them under
      // their own keys — `property-person-roles-whitelist`,
      // `document-valid-roles`, `doc-distinct-roles`. With the global 30 s
      // staleTime, un-ticking a role here and walking straight to an associate
      // screen went on offering it. Same reasoning, and same cost, as the
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

  const alreadyAdded = new Set((listQuery.data ?? []).map((r) => r.personRoleId));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmDeleteId) {
        // ⚠️ **Not while the delete is in flight.** The mutation completes
        // regardless — TanStack keeps `onError` on the mutation, not on the
        // observer — so an Escape here unmounts the only place the refusal is
        // ever reported, and a delete that failed reads as one the user
        // cancelled.                                            (Slice #29.13)
        if (deleteMutation.isPending) return;
        closeConfirm();
        return;
      }
      if (showAdd)         { setShowAdd(false);        return; }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteId, showAdd, onClose, closeConfirm, deleteMutation.isPending]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

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
        className="fixed inset-x-4 top-[5%] z-50 mx-auto max-w-3xl rounded-xl border border-card-rim bg-card shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-800">
          <h2 id={listTitleId} className="text-base font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
          <button
            onClick={onClose}
            className={buttonClass({ variant: "bare", size: "md" })}
            aria-label={tModal("close")}
          >✕</button>
        </div>

        <div className="flex max-h-[80vh] flex-col overflow-hidden">
          <div className="overflow-y-auto p-5">
            {showAdd && rolesQuery.data && (
              <AddForm
                allRoles={rolesQuery.data}
                alreadyAdded={alreadyAdded}
                onClose={() => setShowAdd(false)}
                onSaved={() => setShowAdd(false)}
              />
            )}

            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => setShowAdd(true)}
                disabled={showAdd}
                className={buttonClass({ variant: "primary", size: "sm" })}
              >
                + {t("add")}
              </button>
              {listQuery.data && (
                <span className="text-xs text-fade dark:text-zinc-400">
                  {t("count", { count: listQuery.data.length })}
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded-md border border-card-rim dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-2">{t("colPersonRole")}</th>
                    <th className="px-4 py-2">{t("colDescription")}</th>
                    <th className="w-20 px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-crease bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                  {listQuery.isLoading && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-fade">{t("loading")}</td></tr>
                  )}
                  {listQuery.isError && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-red-600">{t("error")}</td></tr>
                  )}
                  {listQuery.data?.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-fade">{t("empty")}</td></tr>
                  )}
                  {listQuery.data?.map((row) => (
                    <tr key={row.id} className="hover:bg-cta-pale dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-2 font-medium text-ink dark:text-zinc-300">
                        {row.personRoleName}
                      </td>
                      <td className="max-w-xs px-4 py-2 text-fade dark:text-zinc-400">
                        <span className="block truncate" title={row.personRoleDescription ?? undefined}>
                          {row.personRoleDescription ?? "—"}
                        </span>
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

      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-60 bg-black/50" aria-hidden />
          <div
            ref={confirmPanelRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            className="fixed inset-x-4 top-1/3 z-60 mx-auto max-w-sm rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <p id={confirmTitleId} className="mb-4 text-sm text-ink dark:text-zinc-300">{t("confirmDelete")}</p>
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
