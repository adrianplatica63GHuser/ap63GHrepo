"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { buttonClass } from "@/lib/ui/button-styles";
import { associationFailureMessage } from "@/lib/ui/association-failure";
import { usePersonRoleOptions, useRoleOptionsWithCarried } from "@/hooks/use-lookup-options";

const PAGE_SIZE = 15;

type PersonSearchItem = { id: string; code: string; type: "NATURAL" | "JUDICIAL"; displayName: string };
type SearchResponse = { items: PersonSearchItem[]; total: number };
type Props = { personId: string; personName: string; backBase: string };

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

export function AssociatePersonView({ personId, personName, backBase }: Props) {
  const t           = useTranslations("shared.associatePersonReference");
  // One sentence shared by all four association screens (Slice #34.04).
  const tShared     = useTranslations("shared");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [nameInput,      setNameInput]      = useState("");
  const [codeInput,      setCodeInput]      = useState("");
  const [page,           setPage]           = useState(0);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [submitting,     setSubmitting]     = useState(false);
  const [submitError,    setSubmitError]    = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["person-search-ref", nameInput, codeInput, page],
    queryFn:  () => searchPersons(nameInput, codeInput, page),
  });

  // ⚠️ **Slice #34.04 fixed a live defect here, and it is worth naming.** This
  // was a `useQuery` on `["person-person-roles"]` whose `queryFn` re-mapped the
  // rows to `{ id: r.personRoleId, name: r.name }` — while
  // `person-person-modal.tsx` cached the SAME endpoint's RAW rows under the
  // SAME key. React Query serves one entry per key, so whichever mounted first
  // won for the 30 s staleTime: with the modal first, this screen rendered
  // blank `<option>` labels and submitted a `lookup_person_person_role.id`
  // where `person_person.relationship_role_id` expects a
  // `lookup_person_role.id` — a 23503. The endpoint, the modal and the key are
  // all gone; the hook reads `["value-list", "person-roles"]` and filters on
  // `validForPerson`, and the only id left is the right one.
  const { options: roleOptions, listState: roleListState } =
    usePersonRoleOptions("person");

  // Slice #34.05: plus any role this person's own reference rows already
  // carry that the list above no longer offers, marked „(nu mai este disponibil)". The display
  // path joins `lookup_person_role` directly and the picker starts from a
  // permission table, so a role whose tick was removed read correctly on the
  // row and was simply absent here, with nothing to explain it.
  const pickerOptions = useRoleOptionsWithCarried(
    roleOptions,
    "person-person",
    personId,
    // Only once the whitelist itself is readable: an unread list is not a
    // list of unticked roles, and marking one would contradict
    // `roleListUnavailable` on the same screen.
    roleListState === "loaded",
  );

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;

  // Exclude the person itself from the current page's results
  const displayList = useMemo(
    () => items.filter((p) => p.id !== personId),
    [items, personId],
  );

  const toggle = (id: string) => {
    if (id === personId) return; // can't link to itself
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
      const res = await fetch(`/api/people/${encodeURIComponent(personId)}/references`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          personIds:          Array.from(selectedIds),
          relationshipRoleId: selectedRoleId || null,
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
      await queryClient.invalidateQueries({ queryKey: ["person-references", personId] });
      router.push(`${backBase}/${encodeURIComponent(personId)}?tab=references`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleCancel = () =>
    router.push(`${backBase}/${encodeURIComponent(personId)}?tab=references`);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-fade dark:text-zinc-400">{personName}</p>
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
        ) : displayList.length === 0 ? (
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
              {displayList.map((item) => (
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

      {/* Role selector — only shown when at least one role is ticked
          „Persoană → Persoană" on the master list. Slice #34.04: gated on the
          OPTIONS rather than on the query result, so an unreadable list falls
          through to the sentence below instead of silently rendering as "no
          roles are ticked" — which is what this condition used to do. */}
      {pickerOptions.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-ink dark:text-zinc-300">
            {t("labelRole")}
          </label>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">{t("roleNone")}</option>
            {pickerOptions.map((r) => (
              // `disabled` on a carried-but-unoffered role — see
              // `carried-roles-merge.ts`: the picker says the state, it does
              // not hand back the eligibility an administrator removed.
              <option key={r.value} value={r.value} disabled={r.unavailable}>{r.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Slice #34.04. The role is optional on this screen
          (`relationshipRoleId: selectedRoleId || null`), so the sentence says
          the association can still be made. */}
      {roleListState === "failed" && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {tShared("roleListUnavailable")}
        </p>
      )}

      {submitError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{submitError}</p>}

      <div className="flex items-center gap-3 border-t border-crease pt-4 dark:border-zinc-800">
        <button type="button" onClick={handleAssociate} disabled={submitting || selectedIds.size === 0}
          className={buttonClass({ variant: "primary", size: "lg" })}>
          {submitting ? t("associating") : t("associate")}
        </button>
        <button type="button" onClick={handleCancel} disabled={submitting}
          className={buttonClass({ variant: "secondary", size: "lg" })}>
          {t("cancel")}
        </button>
        {selectedIds.size === 0 && !isLoading && displayList.length > 0 && (
          <span className="text-xs text-fade dark:text-zinc-500">{t("noSelection")}</span>
        )}
      </div>
    </div>
  );
}
