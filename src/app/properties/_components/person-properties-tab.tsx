"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/lib/ui/button-styles";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { NP_LIST_COLUMNS, type ColumnName } from "@/lib/ui/field-widths";
import Link from "next/link";
import { newTabIfAsked } from "@/lib/ui/row-link";
import { PreviewButton } from "@/components/tiles/preview-tiles";

/** Slice #37.16: the tab's columns, each a fixed width from `COLUMN`; the table is as wide as they are. */
const COLUMNS: ColumnName[] = ["select", "propertyLabel", "role", "openPreview"];

type AssociatedProperty = {
  id:           string;
  code:         string;
  label:        string;
  roleName:     string | null;
  associatedAt: string;
};

type Props = {
  personId: string;
  backBase: string;   // e.g. "/natural-persons" or "/judicial-persons"
  /**
   * Slice #37.27 — the Natural Person's unit tile: the table fills it
   * (`NP_LIST_COLUMNS`), and „Vizualizare" sits above „Previzualizare".
   */
  compact?: boolean;
};

async function fetchPersonProperties(personId: string): Promise<AssociatedProperty[]> {
  const res = await fetch(`/api/people/${encodeURIComponent(personId)}/properties`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedProperty[];
}

export function PersonPropertiesTab({ personId, backBase, compact = false }: Props) {
  const columns: readonly ColumnName[] = compact ? NP_LIST_COLUMNS.properties : COLUMNS;
  const [labelCol, roleCol, buttonsCol] = compact
    ? (["tileName", "tileRole", "openPreviewStacked"] as const)
    : (["propertyLabel", "role", "openPreview"] as const);
  const t           = useTranslations("shared.properties");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [dissociating,  setDissociating]  = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["person-properties", personId],
    queryFn:  () => fetchPersonProperties(personId),
  });

  const handleAssociate = () => {
    router.push(`${backBase}/${encodeURIComponent(personId)}/associate-property`);
  };

  const handleDissociate = async () => {
    if (!selectedId) return;
    setDissociating(true);
    setDissociateErr(null);
    try {
      const res = await fetch(
        `/api/people/${encodeURIComponent(personId)}/properties/${encodeURIComponent(selectedId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["person-properties", personId] });
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
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead(labelCol)}>{t("colLabel")}</th>
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
                    if (newTabIfAsked(e, `/properties/${encodeURIComponent(item.id)}?readonly=true`)) return;
                    setSelectedId(item.id === selectedId ? null : item.id);
                  }}
                  onAuxClick={(e) => newTabIfAsked(e, `/properties/${encodeURIComponent(item.id)}?readonly=true`)}
                  onDoubleClick={() => router.push(`/properties/${encodeURIComponent(item.id)}?readonly=true`)}
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
                  <td className={`px-3 py-2 text-fade dark:text-zinc-400 ${WRAPS}`}>{item.roleName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className={compact ? "flex flex-col items-start gap-1" : "flex gap-1"}>
                      <Link
                        href={`/properties/${encodeURIComponent(item.id)}?readonly=true`}
                        onClick={(e) => e.stopPropagation()}
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
