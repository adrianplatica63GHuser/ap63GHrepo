"use client";

/**
 * „Se aplică la": the three chips of a role.                   (Slice #38.36)
 *
 * In the role's one panel, under its fields. See `RoleScope` below.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, FileText, Map as MapIcon, User as UserIcon, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { RequestFailedError } from "@/lib/admin/value-lists/failures";
import { removePair } from "@/lib/admin/doc-type-person-roles/client";
import { RoleDocTypes, usePairsOfRole } from "./role-doc-types";
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
    // Every cache: the association screens' role dropdowns read these rows (see `RoleDocTypes`).
    onSuccess: async () => {
      setConfirmOff(false);
      setActOpened(false);
      await qc.invalidateQueries();
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
