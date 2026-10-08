"use client";

/**
 * A document type's roles, on the type's own page.               (Slice #38.39)
 *
 * „Date de referință → Tipuri de Document → the type → Roluri": the roles a
 * party may hold on a document of this type, each with its „Deține cotă" tick.
 * It is the TYPE's side of the same `lookup_doc_type_person_role` rows the role
 * panel edits from the ROLE's side (#38.36, ./role-doc-types.tsx), written
 * through the same module, `@/lib/admin/doc-type-person-roles/client` — so a
 * role ticked here is on that role's panel, and the other way round.
 *
 * Taking a role off does what the role panel does: the pair goes, the links
 * that already use it stay, and the confirmation says how many there are.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, Plus, Trash2, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { screenBox } from "@/lib/ui/field-widths";
import { RequestFailedError } from "@/lib/admin/value-lists/failures";
import {
  PAIRS_QUERY_KEY,
  addPair,
  fetchPairs,
  pairsOfType,
  removePair,
  setPairHoldsShare,
  type DocTypePersonRolePair,
} from "@/lib/admin/doc-type-person-roles/client";
import { fetchValueListRows, toLookupItems } from "./role-doc-types";

export function TypeRoles({ typeId, typeName }: { typeId: string; typeName: string }) {
  const t = useTranslations("valueList.typePage.roles");
  const tRole = useTranslations("valueList.roleEditor");
  const tErr = useTranslations("valueList.confirm.errors");
  const qc = useQueryClient();
  // The literal key, as every consumer of a bare key spells it (value-list-dependents reads it here).
  const pairsQuery = useQuery({ queryKey: ["doc-type-person-roles"], queryFn: fetchPairs });
  const pairs = pairsOfType(pairsQuery.data, typeId);
  const rolesQuery = useQuery({
    queryKey: ["value-list", "person-roles"],
    queryFn: () => fetchValueListRows("person-roles"),
    select: toLookupItems,
  });
  const [roleToAdd, setRoleToAdd] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<DocTypePersonRolePair | null>(null);
  const [error, setError] = useState<string | null>(null);
  // „Deține cotă" shows the click at once, before the PATCH and the refetch land (#37.59's lesson).
  const [pendingShare, setPendingShare] = useState<Record<string, boolean>>({});

  const failed = (err: Error) =>
    setError(tErr(err instanceof RequestFailedError ? err.code : "generic", { code: "", collisions: 0 }));

  // ⚠️ **Every cache, on an add and on a remove** — the role panel's rule
  // (#38.36): these rows ARE the association screens' role dropdowns, which
  // cache them under keys of their own.
  const add = useMutation({
    mutationFn: () => addPair({ documentTypeId: typeId, personRoleId: roleToAdd }),
    onSuccess: async () => {
      setRoleToAdd("");
      setError(null);
      await qc.invalidateQueries();
    },
    onError: failed,
  });
  const share = useMutation({
    mutationFn: ({ id, holdsShare }: { id: string; holdsShare: boolean }) => setPairHoldsShare(id, holdsShare),
    onMutate: ({ id, holdsShare }) => setPendingShare((p) => ({ ...p, [id]: holdsShare })),
    onSettled: async (_d, _e, { id }) => {
      await qc.invalidateQueries({ queryKey: PAIRS_QUERY_KEY });
      setPendingShare((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    },
    onError: () => setError(tRole("holdsShareError")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removePair(id),
    onSuccess: async () => {
      setConfirmRemove(null);
      setError(null);
      await qc.invalidateQueries();
    },
    onError: failed,
  });

  const listed = new Set(pairs.map((p) => p.personRoleId));
  const offered = (rolesQuery.data ?? []).filter((r) => !listed.has(r.id));

  return (
    <section className="flex flex-col gap-3" aria-label={t("title", { type: typeName })} data-type-roles="">
      <p className="text-sm text-fade dark:text-zinc-400">{t("intro")}</p>
      {pairsQuery.isLoading ? (
        <p className="text-sm text-fade">{tRole("loading")}</p>
      ) : pairsQuery.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t("loadError")}</p>
      ) : pairs.length === 0 ? (
        <p className="text-sm text-fade dark:text-zinc-400">{t("none")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-crease rounded-md border border-card-rim dark:divide-zinc-700 dark:border-zinc-700">
          {pairs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-1.5 text-sm" data-pair={p.personRoleName}>
              <span className="min-w-0 flex-1 text-ink dark:text-zinc-200">{p.personRoleName}</span>
              <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-ink dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={pendingShare[p.id] ?? p.holdsShare}
                  aria-label={tRole("holdsShareLabel", { docType: typeName, role: p.personRoleName })}
                  onChange={(e) => share.mutate({ id: p.id, holdsShare: e.target.checked })}
                  className="h-4 w-4 rounded border-wire accent-cta"
                />
                <span>{tRole("holdsShare")}</span>
              </label>
              <span className="text-xs text-fade dark:text-zinc-400">{tRole("links", { count: p.linkCount })}</span>
              <IconButton
                type="button"
                icon={Trash2}
                label={t("remove", { role: p.personRoleName })}
                variant="danger"
                size="xs"
                // Not while a confirmation is open: it names one role, and a second press must not re-aim it.
                disabled={confirmRemove !== null || remove.isPending}
                onClick={() => setConfirmRemove(p)}
              />
            </li>
          ))}
        </ul>
      )}

      {confirmRemove && (
        <div
          role="alertdialog"
          aria-label={t("removeTitle", { role: confirmRemove.personRoleName })}
          className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950"
        >
          <p className="text-ink dark:text-zinc-200">
            {confirmRemove.linkCount > 0
              ? t("removeWithLinks", { role: confirmRemove.personRoleName, count: confirmRemove.linkCount })
              : t("removeNoLinks", { role: confirmRemove.personRoleName })}
          </p>
          <div className="flex gap-2">
            <IconButton type="button" icon={Check} label={t("removeConfirm")} showLabel variant="danger" size="sm" busy={remove.isPending} onClick={() => remove.mutate(confirmRemove.id)} />
            {/* Not while the remove is in flight: closing would hide the only place a refusal is said. */}
            <IconButton type="button" icon={X} label={tRole("cancel")} showLabel variant="secondary" size="sm" disabled={remove.isPending} onClick={() => setConfirmRemove(null)} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-ink dark:text-zinc-400">
          {t("addLabel")}
          <select
            {...screenBox("docPersonsType")}
            value={roleToAdd}
            onChange={(e) => setRoleToAdd(e.target.value)}
            disabled={rolesQuery.isLoading || rolesQuery.isError}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">{rolesQuery.isError ? t("rolesError") : t("selectRole")}</option>
            {offered.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <IconButton type="button" icon={Plus} label={t("add")} showLabel variant="secondary" size="sm" busy={add.isPending} disabled={!roleToAdd || add.isPending} onClick={() => add.mutate()} />
      </div>

      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
