"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { NoRolesForTypeNote } from "@/components/forms/no-roles-for-type-note";
import { buttonClass } from "@/lib/ui/button-styles";
import { associationFailureMessage } from "@/lib/ui/association-failure";
import { lookupListState, useRoleOptionsWithCarried } from "@/hooks/use-lookup-options";

const PAGE_SIZE = 15;

type PersonSearchItem = { id: string; code: string; type: "NATURAL" | "JUDICIAL"; displayName: string };
type SearchResponse = { items: PersonSearchItem[]; total: number };
type RoleItem = { id: string; name: string };

type Props = {
  documentId:   string;
  documentName: string;
  /**
   * May THIS reader open „Roluri pe Document" — Slice #34.16.
   *
   * Passed straight to `NoRolesForTypeNote`, which decides what to do with it.
   * Both halves of the argument live where they are acted on:
   * `src/lib/auth/can-configure-roles.ts` for why it is answered on the server
   * rather than by a second `queryFn` under the shared `["auth-me"]` key, and
   * the note component for why the LINK is gated on it and the sentence is not.
   */
  canConfigureRoles: boolean;
};

async function searchPersons(name: string, code: string, page: number): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (name.trim()) params.set("name", name.trim());
  if (code.trim()) params.set("code", code.trim());
  params.set("limit",  String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(`/api/people/search?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { items: data.items as PersonSearchItem[], total: data.total as number };
}

async function fetchValidRoles(documentId: string): Promise<RoleItem[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/valid-person-roles`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as RoleItem[];
}

export function AssociatePersonView({ documentId, documentName, canConfigureRoles }: Props) {
  const t           = useTranslations("document.associatePerson");
  // One sentence shared by every screen that hands out a role (Slice #34.15).
  const tShared     = useTranslations("shared");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [nameInput,     setNameInput]     = useState("");
  const [codeInput,     setCodeInput]     = useState("");
  const [page,          setPage]          = useState(0);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["person-search-doc", nameInput, codeInput, page],
    queryFn:  () => searchPersons(nameInput, codeInput, page),
  });

  const {
    data: roles,
    isPending: rolesPending,
    isLoadingError: rolesLoadingError,
    fetchStatus: rolesFetchStatus,
  } = useQuery({
    queryKey: ["document-valid-roles", documentId],
    queryFn:  () => fetchValidRoles(documentId),
  });

  /*
   * ⚠️ **THIS SCREEN COULD NOT SAY „the list could not be read" UNTIL SLICE
   * #34.15, AND ITS SILENCE WAS THE WORST OF THE FIVE.** The two screens that
   * already printed `shared.roleListUnavailable` gate their select on the
   * OPTIONS, so a failed read there showed no dropdown and one red line
   * explaining it. Here the gate is `pickerOptions.length > 0` over a list that
   * is `[]` while it is loading, `[]` when the type genuinely has no roles, and
   * `[]` when the GET failed — three states, one appearance, and no sentence.
   *
   * ⚠️ **Through the hook file's own function rather than a local
   * `isError`.** `lookupListState` is where „failed" is defined — see its
   * header for why `isLoadingError`, and why a query paused because the browser
   * is offline counts as failed rather than loading.
   */
  const roleListState = lookupListState(rolesPending, rolesLoadingError, rolesFetchStatus);

  // Slice #34.05: plus any role this document's own rows already carry
  // that the list above no longer offers, marked „(nu mai este disponibil)". The display
  // path joins `lookup_person_role` directly and the picker starts from a
  // permission table, so a role whose tick was removed read correctly on the
  // row and was simply absent here, with nothing to explain it.
  const pickerOptions = useRoleOptionsWithCarried(
    (roles ?? []).map((r) => ({ value: r.id, label: r.name })),
    "document-person",
    documentId,
    // `undefined` is „not read yet"; `[]` is „read, and it offers nothing".
    // Until it is read, this screen renders no select at all — as it did
    // before, when the gate was `roles && roles.length > 0`.
    roles !== undefined,
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAssociate = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/persons`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          personIds:    Array.from(selectedIds),
          personRoleId: selectedRoleId || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Slice #34.15. The route now has a 400 a user can reach — a role list
        // this screen loaded before an administrator unticked the role — and
        // its `error` is English by design. `associationFailureMessage`
        // recognises that one case by `code` and answers it in the user's own
        // language; everything else reads exactly as it did before.
        throw new Error(
          associationFailureMessage(body, res.status, tShared("roleNotOffered")),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["document-persons", documentId] });
      router.push(`/documents/${encodeURIComponent(documentId)}?tab=persons`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleCancel = () =>
    router.push(`/documents/${encodeURIComponent(documentId)}?tab=persons`);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-fade dark:text-zinc-400">{documentName}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 font-medium text-ink dark:text-zinc-300">{t("labelName")}</span>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => { setNameInput(e.target.value); setPage(0); setSelectedIds(new Set()); }}
            placeholder={t("namePlaceholder")}
            className="w-48 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 font-medium text-ink dark:text-zinc-300">{t("labelCode")}</span>
          <input
            type="text"
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value); setPage(0); setSelectedIds(new Set()); }}
            placeholder={t("codePlaceholder")}
            className="w-32 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div className="rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
        ) : isError ? (
          <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("resultsEmpty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="w-8 px-3 py-2" aria-label="select" />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colCode")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colName")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colType")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={[
                    "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                    selectedIds.has(item.id) ? "bg-cta-pale dark:bg-cta/10" : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                  ].join(" ")}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)}
                      onClick={(e) => e.stopPropagation()} className="accent-cta" aria-label={item.displayName} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-fade dark:text-zinc-400">{item.code}</td>
                  <td className="px-3 py-2 font-medium text-ink dark:text-zinc-100">{item.displayName}</td>
                  <td className="px-3 py-2 text-fade dark:text-zinc-400">
                    {item.type === "NATURAL" ? t("typeNatural") : t("typeJudicial")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PaginationControls
        page={page} total={total} pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      {/* Role dropdown — shown when the MERGED list has anything in it, which
          since Slice #34.05 is „the type's own ticked roles, plus whatever this
          document's rows already carry". Fixed in passing (#34.16): this line
          said „only shown when the document type has valid roles defined",
          which stopped being the gate when the carried union arrived and is now
          the condition of the sentence below rather than of this select. */}
      {pickerOptions.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 font-medium text-ink dark:text-zinc-300">{t("labelRole")}</span>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">{t("rolePlaceholder")}</option>
            {pickerOptions.map((r) => (
              // `disabled` on a carried-but-unoffered role — see
              // `carried-roles-merge.ts`: the picker says the state, it does
              // not hand back the eligibility an administrator removed.
              <option key={r.value} value={r.value} disabled={r.unavailable}>{r.label}</option>
            ))}
          </select>
        </label>
      )}

      {/* Slice #34.15. The role is optional on this screen
          (`personRoleId: selectedRoleId || null`), so the sentence — the same
          one the two person-side screens have printed since #34.04 — says the
          association can still be made. */}
      {roleListState === "failed" && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {tShared("roleListUnavailable")}
        </p>
      )}

      {/*
        ⚠️ **THE SENTENCE THAT PAYS FOR THE EMPTY SELECT — Slice #34.16, D-16(b).**
        `listPersonRolesForDocument` used to fall back to „every role ticked for
        SOME document type" when this document's type had none of its own, so
        this screen never showed nothing. One answer now, and an empty select
        with nothing said would be worse than the wide list it replaces.
        `NoRolesForTypeNote` carries the sentence and its link — the two
        person-side „Asociază document" screens read the same endpoint and print
        the same note, which is why it is a component and not three copies.

        ⚠️ **GATED ON `roles`, THE WHITELIST ANSWER — NOT ON `pickerOptions`.**
        They differ on exactly the case #34.05 is about: an unconfigured type
        whose rows carry a withdrawn role has a non-empty `pickerOptions` in
        which every entry is `disabled`. A gate on `pickerOptions.length` would
        go silent there, which is the one place the user most needs telling why
        nothing can be chosen. The two read correctly together: the select shows
        what the row already holds, struck out, and the note says the type has
        nothing configured.

        ⚠️ **`roleListState === "loaded"`, not `roles !== undefined`.** They
        agree today; „loaded" is this archive's one definition of „the list is
        really here" and it is the same function the failure sentence above
        reads, so the two notes can never both print. A list that could not be
        read is not a type with no roles.

        ⚠️ **THE CONDITION IS A PROP, NOT A `&&` AROUND THE ELEMENT.** The note
        owns an `aria-live` region and has to be mounted before its content
        appears, or a screen reader is not reliably told — the rule
        `value-list-modal.tsx` already follows for its own async sentences. The
        component's header carries the argument.
      */}
      <NoRolesForTypeNote
        show={roleListState === "loaded" && roles?.length === 0}
        canConfigureRoles={canConfigureRoles}
      />

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{submitError}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAssociate}
          disabled={selectedIds.size === 0 || submitting}
          className={buttonClass({ variant: "primary", size: "lg" })}
        >
          {submitting ? t("associating") : t("associate")}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className={buttonClass({ variant: "secondary", size: "lg" })}
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
