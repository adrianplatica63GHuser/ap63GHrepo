"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/lib/ui/button-styles";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { NP_LIST_COLUMNS, type ColumnName } from "@/lib/ui/field-widths";
import { propertyRoleChip } from "@/lib/properties/relation-roles";
import Link from "next/link";
import { newTabIfAsked, openThroughGuard } from "@/lib/ui/row-link";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { PreviewButton } from "@/components/tiles/preview-tiles";

/** Slice #37.16: the tab's columns, each a fixed width from `COLUMN`; the table is as wide as they are. */
const COLUMNS: ColumnName[] = ["select", "propertyLabel", "role", "openPreview"];

type AssociatedProperty = {
  id:                  string;
  code:                string;
  label:               string;
  associatedAt:        string;
  relationshipRoleId:  string | null;
  relationshipRoleName: string | null;
  /** FU-220 (Slice #37.10): whether the role reads from THIS property. */
  roleReadsFromViewed: boolean;
};

type Props = {
  propertyId: string;
  /** Slice #37.30 — the Property's unit tile: the compact table that fills it, the two buttons stacked. */
  compact?: boolean;
};

async function fetchPropertyReferences(propertyId: string): Promise<AssociatedProperty[]> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/references`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedProperty[];
}

export function PropertyReferencesTab({ propertyId, compact = false }: Props) {
  const columns: readonly ColumnName[] = compact ? NP_LIST_COLUMNS.associations : COLUMNS;
  const [col1, col2, buttonsCol] = compact
    ? (["tileName", "tileRole", "openPreviewStacked"] as const)
    : (["propertyLabel", "role", "openPreview"] as const);
  const t           = useTranslations("property.references");
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const { guardedNavigate } = useUnsavedChanges();
  const queryClient = useQueryClient();

  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [dissociating,  setDissociating]  = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["property-references", propertyId],
    queryFn:  () => fetchPropertyReferences(propertyId),
  });

  const handleAssociate = () => {
    router.push(`/properties/${encodeURIComponent(propertyId)}/associate-reference`);
  };

  const handleDissociate = async () => {
    if (!selectedId) return;
    setDissociating(true);
    setDissociateErr(null);
    try {
      const res = await fetch(
        `/api/properties/${encodeURIComponent(propertyId)}/references/${encodeURIComponent(selectedId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["property-references", propertyId] });
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
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead(col1)}>{t("colLabel")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead(col2)}>{t("colRole")}</th>
                <th className="px-3 py-2" {...columnHead(buttonsCol)} aria-label="view" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  // Slice #37.21: Ctrl/⌘+click or a middle-click opens the record in a new tab.
                  onClick={(e) => {
                    if (newTabIfAsked(e, `/properties/${encodeURIComponent(item.id)}?readonly=true`)) return;
                    setSelectedId(item.id === selectedId ? null : item.id);
                  }}
                  onAuxClick={(e) => newTabIfAsked(e, `/properties/${encodeURIComponent(item.id)}?readonly=true`)}
                  onDoubleClick={() => guardedNavigate(`/properties/${encodeURIComponent(item.id)}?readonly=true`)}
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
                      aria-label={item.label}
                    />
                  </td>
                  <td className={`px-3 py-2 font-medium text-ink dark:text-zinc-100 ${WRAPS}`}>{item.label}</td>
                  <td className={`px-3 py-2 ${WRAPS}`}>
                    {(() => {
                      /*
                       * ⚠️ **A DIRECTIONAL ROLE IS A SENTENCE, NOT A LABEL.**
                       * (FU-220, Slice #37.10.) „Inclus în" between this
                       * property and that one says one thing read forwards and
                       * the opposite read backwards, and the pair is stored in
                       * uuid order, so a bare chip said the same words on both
                       * properties — the opposite of what was chosen on one of
                       * them. A directional role now reads „această proprietate
                       * «rol» PROP…" or „PROP… «rol» această proprietate", as
                       * documents have since #36.03; the four symmetric roles
                       * keep their bare chip (`propertyRoleChip`).
                       */
                      const chip = propertyRoleChip(item.relationshipRoleName, item.roleReadsFromViewed, item.code);
                      if (chip.kind === "none") return <span className="text-fade dark:text-zinc-500">—</span>;
                      return (
                        <span className="inline-flex items-center rounded-full bg-cta-pale px-2 py-0.5 text-xs font-medium text-cta dark:bg-cta/15 dark:text-cta-light">
                          {chip.kind === "bare"
                            ? chip.role
                            : chip.kind === "forward"
                              ? t("roleForward", { role: chip.role, other: chip.other })
                              : t("roleBackward", { role: chip.role, other: chip.other })}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    <div className={compact ? "flex flex-col items-start gap-1" : "flex gap-1"}>
                      <Link
                        href={`/properties/${encodeURIComponent(item.id)}?readonly=true`}
                        onClick={(e) => openThroughGuard(e, `/properties/${encodeURIComponent(item.id)}?readonly=true`, guardedNavigate)}
                        className={buttonClass({ variant: "secondary", size: "xs" })}
                      >
                        {t("view")}
                      </Link>
                      <PreviewButton target={{ kind: "property", id: item.id }} />
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
          <button
            type="button"
            onClick={handleAssociate}
            disabled={selectedId !== null}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("associate")}
          </button>
          <button
            type="button"
            onClick={handleDissociate}
            disabled={selectedId === null || dissociating}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {dissociating ? t("dissociating") : t("dissociate")}
          </button>
        </div>
        {dissociateErr && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{dissociateErr}</p>
        )}
      </div>
    </div>
  );
}
