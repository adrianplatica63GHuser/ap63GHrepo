"use client";

import { ArrowRight, Link as LinkIcon, Unlink } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { NP_LIST_COLUMNS, type ColumnName } from "@/lib/ui/field-widths";
import { newTabIfAsked, openThroughGuard } from "@/lib/ui/row-link";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { PreviewButton } from "@/components/tiles/preview-tiles";

/** Slice #37.16: the tab's columns, each a fixed width from `COLUMN`; the table is as wide as they are. */
const COLUMNS: ColumnName[] = ["select", "documentType", "documentTitle", "openPreview"];

type AssociatedDocument = {
  id:           string;
  code:         string;
  typeName:     string | null;
  title:        string | null;
  associatedAt: string;
};

type Props = {
  propertyId: string;
  /** Slice #37.30 — the Property's unit tile: the compact table that fills it, the two buttons stacked. */
  compact?: boolean;
};

async function fetchPropertyDocuments(propertyId: string): Promise<AssociatedDocument[]> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/documents`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedDocument[];
}

export function PropertyDocumentTab({ propertyId, compact = false }: Props) {
  const columns: readonly ColumnName[] = compact ? NP_LIST_COLUMNS.documentsWithoutRole : COLUMNS;
  const [col1, col2, buttonsCol] = compact
    ? (["tileDocType", "tileDocTitle", "openPreviewStacked"] as const)
    : (["documentType", "documentTitle", "openPreview"] as const);
  const t           = useTranslations("property.document");
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const { guardedNavigate } = useUnsavedChanges();
  const queryClient = useQueryClient();

  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [dissociating,  setDissociating]  = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["property-documents", propertyId],
    queryFn:  () => fetchPropertyDocuments(propertyId),
  });

  const handleAssociate = () => {
    router.push(`/properties/${encodeURIComponent(propertyId)}/associate-document`);
  };

  const handleDissociate = async () => {
    if (!selectedId) return;
    setDissociating(true);
    setDissociateErr(null);
    try {
      const res = await fetch(
        `/api/properties/${encodeURIComponent(propertyId)}/documents/${encodeURIComponent(selectedId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });
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
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead(col1)}>{t("colType")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead(col2)}>{t("colTitle")}</th>
                <th className="px-3 py-2" {...columnHead(buttonsCol)} aria-label="view" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  // Slice #37.21: Ctrl/⌘+click or a middle-click opens the record in a new tab.
                  onClick={(e) => {
                    if (newTabIfAsked(e, `/documents/${encodeURIComponent(item.id)}?readonly=true`)) return;
                    setSelectedId(item.id === selectedId ? null : item.id);
                  }}
                  onAuxClick={(e) => newTabIfAsked(e, `/documents/${encodeURIComponent(item.id)}?readonly=true`)}
                  onDoubleClick={() => guardedNavigate(`/documents/${encodeURIComponent(item.id)}?readonly=true`)}
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
                      aria-label={item.title ?? item.code}
                    />
                  </td>
                  <td className={`px-3 py-2 text-fade dark:text-zinc-400 ${WRAPS}`}>{item.typeName ?? "—"}</td>
                  <td className={`px-3 py-2 text-ink dark:text-zinc-100 ${WRAPS}`}>{item.title ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className={compact ? "flex flex-col items-start gap-1" : "flex gap-1"}>
                      <IconButton
                        href={`/documents/${encodeURIComponent(item.id)}?readonly=true`}
                        onClick={(e) => openThroughGuard(e, `/documents/${encodeURIComponent(item.id)}?readonly=true`, guardedNavigate)}
                        icon={ArrowRight}
                        label={t("view")}
                        variant="secondary"
                        size="xs"
                      />
                      <PreviewButton target={{ kind: "document", id: item.id }} />
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
