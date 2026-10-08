"use client";

/**
 * A role's document types, inside the role's own panel.        (Slice #38.36)
 *
 * „Date de referință → Roluri": a role opens one panel holding all of it —
 * its name and converse, the chips saying where it applies (Act / Proprietate
 * / Persoană), and, for Act, this list: the document types it is offered on,
 * each with its own „Deține cotă" tick. It replaces the „Roluri pe Document"
 * grid, which showed every type × role pair in one table behind the document
 * types' toolbar.
 *
 * Every read and write goes through `@/lib/admin/doc-type-person-roles/client`,
 * the module #38.39's document-type tab uses too.
 *
 * TAKING A TYPE OFF (Ask first 1): what the grid did — the pair is removed and
 * the links that already use it stay as they are. What is new is that the
 * panel says, before the press, how many links use that pair.
 *
 * ⚠️ **The two value-list keys keep the API's rows.** `["value-list",
 * "document-types"]` is the key the generic list panel holds as full rows, so
 * this reads it with a fetcher that hands back what the API sent and projects
 * in a `select` — the rule #34.04 wrote for the grid this replaces.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, FileText, Map as MapIcon, Plus, Trash2, User as UserIcon, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { screenBox } from "@/lib/ui/field-widths";
import { RequestFailedError } from "@/lib/admin/value-lists/failures";
import {
  PAIRS_QUERY_KEY,
  addPair,
  fetchPairs,
  pairsOfRole,
  removePair,
  setPairHoldsShare,
  type DocTypePersonRolePair,
} from "@/lib/admin/doc-type-person-roles/client";

type LookupItem = { id: string; name: string };
/** A value-list row AS THE API SENDS IT — the cache keeps it whole. */
type ValueListRow = LookupItem & Record<string, unknown>;

async function fetchValueListRows(list: string): Promise<ValueListRow[]> {
  const res = await fetch(`/api/admin/value-lists/${list}`);
  // A redirect is an expired session answering with the login page: an error,
  // never a successful empty list (#34.04, on the grid this replaces).
  if (res.redirected || !res.ok) throw new Error(`Failed to load ${list} (${res.status})`);
  const data = await res.json();
  return (data.items ?? []) as ValueListRow[];
}

const toLookupItems = (rows: ValueListRow[]): LookupItem[] => rows.map((r) => ({ id: r.id, name: r.name }));

export function usePairsOfRole(roleId: string | null): { pairs: DocTypePersonRolePair[]; loading: boolean } {
  // The literal key, as every consumer of a bare key spells it (value-list-dependents reads it here).
  const query = useQuery({ queryKey: ["doc-type-person-roles"], queryFn: fetchPairs, enabled: roleId !== null });
  return { pairs: roleId ? pairsOfRole(query.data, roleId) : [], loading: query.isLoading };
}

export function RoleDocTypes({ roleId, roleName }: { roleId: string; roleName: string }) {
  const t = useTranslations("valueList.roleEditor");
  const tErr = useTranslations("valueList.confirm.errors");
  const qc = useQueryClient();
  const { pairs, loading } = usePairsOfRole(roleId);
  const docTypesQuery = useQuery({
    queryKey: ["value-list", "document-types"],
    queryFn: () => fetchValueListRows("document-types"),
    select: toLookupItems,
  });
  const [typeToAdd, setTypeToAdd] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<DocTypePersonRolePair | null>(null);
  const [error, setError] = useState<string | null>(null);
  // „Deține cotă" shows the click at once, before the PATCH and the refetch land (#37.59's lesson).
  const [pendingShare, setPendingShare] = useState<Record<string, boolean>>({});

  const failed = (err: Error) =>
    setError(tErr(err instanceof RequestFailedError ? err.code : "generic", { code: "", collisions: 0 }));
  const refresh = () => qc.invalidateQueries({ queryKey: PAIRS_QUERY_KEY });

  const add = useMutation({
    mutationFn: () => addPair({ documentTypeId: typeToAdd, personRoleId: roleId }),
    onSuccess: async () => {
      setTypeToAdd("");
      setError(null);
      await refresh();
    },
    onError: failed,
  });
  const share = useMutation({
    mutationFn: ({ id, holdsShare }: { id: string; holdsShare: boolean }) => setPairHoldsShare(id, holdsShare),
    onMutate: ({ id, holdsShare }) => setPendingShare((p) => ({ ...p, [id]: holdsShare })),
    onSettled: async (_d, _e, { id }) => {
      await refresh();
      setPendingShare((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    },
    onError: () => setError(t("holdsShareError")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removePair(id),
    onSuccess: async () => {
      setConfirmRemove(null);
      setError(null);
      await refresh();
    },
    onError: failed,
  });

  const listed = new Set(pairs.map((p) => p.documentTypeId));
  const offered = (docTypesQuery.data ?? []).filter((d) => !listed.has(d.id));

  return (
    <section className="flex flex-col gap-2" aria-label={t("docTypesTitle", { role: roleName })} data-role-doc-types="">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink dark:text-zinc-300">{t("docTypes")}</h4>
      {loading ? (
        <p className="text-sm text-fade">{t("loading")}</p>
      ) : pairs.length === 0 ? (
        <p className="text-sm text-fade dark:text-zinc-400">{t("noDocTypes")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-crease rounded-md border border-card-rim dark:divide-zinc-700 dark:border-zinc-700">
          {pairs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-1.5 text-sm" data-pair={p.documentTypeName}>
              <span className="min-w-0 flex-1 text-ink dark:text-zinc-200">{p.documentTypeName}</span>
              <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-ink dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={pendingShare[p.id] ?? p.holdsShare}
                  aria-label={t("holdsShareLabel", { docType: p.documentTypeName, role: roleName })}
                  onChange={(e) => share.mutate({ id: p.id, holdsShare: e.target.checked })}
                  className="h-4 w-4 rounded border-wire accent-cta"
                />
                <span>{t("holdsShare")}</span>
              </label>
              <span className="text-xs text-fade dark:text-zinc-400">{t("links", { count: p.linkCount })}</span>
              <IconButton
                type="button"
                icon={Trash2}
                label={t("removeType", { docType: p.documentTypeName })}
                variant="danger"
                size="xs"
                onClick={() => setConfirmRemove(p)}
              />
            </li>
          ))}
        </ul>
      )}

      {confirmRemove && (
        <div role="alertdialog" aria-label={t("removeTitle", { docType: confirmRemove.documentTypeName })} className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950">
          <p className="text-ink dark:text-zinc-200">
            {confirmRemove.linkCount > 0
              ? t("removeWithLinks", { docType: confirmRemove.documentTypeName, count: confirmRemove.linkCount })
              : t("removeNoLinks", { docType: confirmRemove.documentTypeName })}
          </p>
          <div className="flex gap-2">
            <IconButton type="button" icon={Check} label={t("removeConfirm")} showLabel variant="danger" size="sm" busy={remove.isPending} onClick={() => remove.mutate(confirmRemove.id)} />
            <IconButton type="button" icon={X} label={t("cancel")} showLabel variant="secondary" size="sm" onClick={() => setConfirmRemove(null)} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-ink dark:text-zinc-400">
          {t("addLabel")}
          <select
            {...screenBox("docPersonsType")}
            value={typeToAdd}
            onChange={(e) => setTypeToAdd(e.target.value)}
            disabled={docTypesQuery.isLoading || docTypesQuery.isError}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">{docTypesQuery.isError ? t("docTypesError") : t("selectDocType")}</option>
            {offered.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <IconButton type="button" icon={Plus} label={t("addType")} showLabel variant="secondary" size="sm" busy={add.isPending} disabled={!typeToAdd || add.isPending} onClick={() => add.mutate()} />
      </div>

      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}

/**
 * „Se aplică la": the three chips of a role.                   (Slice #38.36)
 *
 * THE CHIPS ARE THE EXISTING COLUMNS. Proprietate is `valid_for_property` and
 * Persoană is `valid_for_person` — saved with the role's form, as the two
 * checkboxes were. Act is "the role has at least one document type": pressing
 * it opens the list of types; turning it off while types are listed asks first,
 * naming them, and then takes every one off (the links stay, as when one type is
 * taken off).
 */
export function RoleScope({
  roleId,
  roleName,
  validForProperty,
  validForPerson,
  onToggle,
}: {
  /** null while the role is being created: its types are chosen once it is saved. */
  roleId: string | null;
  roleName: string;
  validForProperty: boolean;
  validForPerson: boolean;
  onToggle: (key: "validForProperty" | "validForPerson", on: boolean) => void;
}) {
  const t = useTranslations("valueList.roleEditor");
  const tErr = useTranslations("valueList.confirm.errors");
  const qc = useQueryClient();
  const { pairs } = usePairsOfRole(roleId);
  const [actOpened, setActOpened] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actOn = pairs.length > 0 || actOpened;

  const clearAll = useMutation({
    mutationFn: async () => {
      for (const p of pairs) await removePair(p.id);
    },
    onSuccess: async () => {
      setConfirmOff(false);
      setActOpened(false);
      await qc.invalidateQueries({ queryKey: PAIRS_QUERY_KEY });
    },
    onError: (err: Error) =>
      setError(tErr(err instanceof RequestFailedError ? err.code : "generic", { code: "", collisions: 0 })),
  });

  const chip = (label: string, on: boolean, icon: typeof FileText, press: () => void, key: string) => (
    <IconButton
      key={key}
      type="button"
      icon={icon}
      label={label}
      showLabel
      pill
      aria-pressed={on}
      data-chip={key}
      variant={on ? "primary" : "secondary"}
      size="sm"
      onClick={press}
    />
  );

  return (
    <div className="flex basis-full flex-col gap-3" data-role-scope="">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink dark:text-zinc-400">{t("appliesTo")}</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("appliesTo")}>
          {chip(t("chipAct"), actOn, FileText, () => (actOn ? (pairs.length > 0 ? setConfirmOff(true) : setActOpened(false)) : setActOpened(true)), "act")}
          {chip(t("chipProperty"), validForProperty, MapIcon, () => onToggle("validForProperty", !validForProperty), "property")}
          {chip(t("chipPerson"), validForPerson, UserIcon, () => onToggle("validForPerson", !validForPerson), "person")}
        </div>
      </div>

      {confirmOff && (
        <div role="alertdialog" aria-label={t("actOffTitle")} className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950">
          <p className="text-ink dark:text-zinc-200">
            {t("actOff", { types: pairs.map((p) => `„${p.documentTypeName}”`).join(", ") })}
          </p>
          <div className="flex gap-2">
            <IconButton type="button" icon={Check} label={t("actOffConfirm")} showLabel variant="danger" size="sm" busy={clearAll.isPending} onClick={() => clearAll.mutate()} />
            <IconButton type="button" icon={X} label={t("cancel")} showLabel variant="secondary" size="sm" onClick={() => setConfirmOff(false)} />
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {actOn && (roleId ? <RoleDocTypes roleId={roleId} roleName={roleName} /> : <p className="text-sm text-fade dark:text-zinc-400">{t("saveFirst")}</p>)}
    </div>
  );
}
