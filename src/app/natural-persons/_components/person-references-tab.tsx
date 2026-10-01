"use client";

import { ArrowRight, Link as LinkIcon, Unlink } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { NP_LIST_COLUMNS, type ColumnName } from "@/lib/ui/field-widths";
import { newTabIfAsked, openThroughGuard, personPath } from "@/lib/ui/row-link";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { PreviewButton } from "@/components/tiles/preview-tiles";
import { personPreview } from "@/lib/ui/previews";
import type { PersonRoleShown } from "@/lib/persons/relation-roles";

/** Slice #37.16: the tab's columns, each a fixed width from `COLUMN`; the table is as wide as they are. */
const COLUMNS: ColumnName[] = ["select", "personName", "personType", "role", "openPreview"];

type AssociatedPerson = {
  id:                  string;
  code:                string;
  type:                "NATURAL" | "JUDICIAL";
  displayName:         string;
  associatedAt:        string;
  relationshipRoleId:  string | null;
  relationshipRoleName: string | null;
  /** Slice #37.28: the word for THIS person — their role, or its converse. */
  roleShown:           PersonRoleShown;
};

type Props = {
  personId: string;
  /** "/natural-persons" or "/judicial-persons" */
  backBase: string;
  /**
   * Slice #37.27 — the Natural Person's unit tile: the table fills it
   * (`NP_LIST_COLUMNS`), and „Tip" (Fizică / Juridică) is dropped, and „Vizualizare" sits above „Previzualizare".
   */
  compact?: boolean;
};

async function fetchPersonReferences(personId: string): Promise<AssociatedPerson[]> {
  const res = await fetch(`/api/people/${encodeURIComponent(personId)}/references`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedPerson[];
}

export function PersonReferencesTab({ personId, backBase, compact = false }: Props) {
  const columns: readonly ColumnName[] = compact ? NP_LIST_COLUMNS.associations : COLUMNS;
  const [nameCol, roleCol, buttonsCol] = compact
    ? (["tileName", "tileRole", "openPreviewStacked"] as const)
    : (["personName", "role", "openPreview"] as const);
  const t           = useTranslations("shared.personReferences");
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const { guardedNavigate } = useUnsavedChanges();
  const queryClient = useQueryClient();

  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [dissociating,  setDissociating]  = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["person-references", personId],
    queryFn:  () => fetchPersonReferences(personId),
  });

  const handleAssociate = () => {
    router.push(`${backBase}/${encodeURIComponent(personId)}/associate-person`);
  };

  const handleDissociate = async () => {
    if (!selectedId) return;
    setDissociating(true);
    setDissociateErr(null);
    try {
      const res = await fetch(
        `/api/people/${encodeURIComponent(personId)}/references/${encodeURIComponent(selectedId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["person-references", personId] });
    } catch (err) {
      setDissociateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setDissociating(false);
    }
  };

  if (isLoading) return <p className="py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>;
  if (isError)   return <p className="py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}>
        {items && items.length > 0 ? (
          <table {...fixedTable(columns)}>
            <FixedColumns columns={columns} />
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="px-3 py-2" {...columnHead("select")} aria-label="select" />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead(nameCol)}>{t("colName")}</th>
                {!compact && (
                  <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead("personType")}>{t("colType")}</th>
                )}
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead(roleCol)}>{t("colRole")}</th>
                <th className="px-3 py-2" {...columnHead(buttonsCol)} aria-label="view" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  // Slice #37.21: Ctrl/⌘+click or a middle-click opens the record in a new tab.
                  onClick={(e) => {
                    if (newTabIfAsked(e, `${personPath(item.type, item.id)}?readonly=true`)) return;
                    setSelectedId(item.id === selectedId ? null : item.id);
                  }}
                  onAuxClick={(e) => newTabIfAsked(e, `${personPath(item.type, item.id)}?readonly=true`)}
                  onDoubleClick={() => guardedNavigate(`${personPath(item.type, item.id)}?readonly=true`)}
                  className={[
                    "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                    item.id === selectedId
                      ? "bg-cta-pale dark:bg-cta/10"
                      : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                  ].join(" ")}
                >
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      checked={item.id === selectedId}
                      onChange={() => setSelectedId(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-cta"
                      aria-label={item.displayName}
                    />
                  </td>
                  <td className={`px-3 py-2 font-medium text-ink dark:text-zinc-100 ${WRAPS}`}>{item.displayName}</td>
                  {!compact && (
                    <td className="px-3 py-2 text-fade dark:text-zinc-400">
                      {item.type === "NATURAL" ? t("typeNatural") : t("typeJudicial")}
                    </td>
                  )}
                  <td className={`px-3 py-2 ${WRAPS}`}>
                    {/* Slice #37.28: the listed person's own word — „Fiu" on
                        the parent's tile, „Părinte" on the son's — resolved by
                        `personRoleShown` from the stored direction and the
                        role's converse. A role with no converse, held by the
                        person viewed, is said as a sentence rather than shown
                        as a chip that would read backwards. */}
                    {item.roleShown.kind !== "none" ? (
                      <span
                        className="inline-flex items-center rounded-full bg-cta-pale px-2 py-0.5 text-xs font-medium text-cta dark:bg-cta/15 dark:text-cta-light"
                        data-role-shown={item.roleShown.kind}
                      >
                        {item.roleShown.kind === "role"
                          ? item.roleShown.name
                          : t("roleHeldByViewed", { role: item.roleShown.name })}
                      </span>
                    ) : (
                      <span className="text-fade dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className={compact ? "flex flex-col items-start gap-1" : "flex gap-1"}>
                      <IconButton
                        href={`${personPath(item.type, item.id)}?readonly=true`}
                        onClick={(e) => openThroughGuard(e, `${personPath(item.type, item.id)}?readonly=true`, guardedNavigate)}
                        icon={ArrowRight}
                        label={t("view")}
                        variant="secondary"
                        size="xs"
                      />
                      <PreviewButton target={personPreview(item.type, item.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("empty")}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <IconButton
            icon={LinkIcon}
            label={t("associate")}
            showLabel
            variant="primary"
            size="lg"
            onClick={handleAssociate}
            disabled={selectedId !== null}
          />
          <IconButton
            icon={Unlink}
            label={t("dissociate")}
            busy={dissociating}
            busyLabel={t("dissociating")}
            showLabel
            variant="secondary"
            size="lg"
            onClick={handleDissociate}
            disabled={selectedId === null || dissociating}
          />
        </div>
        {dissociateErr && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{dissociateErr}</p>
        )}
      </div>
    </div>
  );
}
