"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/lib/ui/button-styles";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import type { ColumnName } from "@/lib/ui/field-widths";

/** Slice #37.16: the tab's columns, each a fixed width from `COLUMN`; the table is as wide as they are. */
const COLUMNS: ColumnName[] = ["select", "personName", "role", "open"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssociatedPerson = {
  id:          string;
  code:        string;
  type:        "NATURAL" | "JUDICIAL";
  displayName: string;
  roleName:    string | null;
  associatedAt: string;
};

type Props = {
  propertyId: string;
};

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchPropertyPersons(propertyId: string): Promise<AssociatedPerson[]> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/persons`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedPerson[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyPersonsTab({ propertyId }: Props) {
  const t           = useTranslations("property.persons");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [dissociating,  setDissociating]  = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  const { data: persons, isLoading, isError } = useQuery({
    queryKey: ["property-persons", propertyId],
    queryFn:  () => fetchPropertyPersons(propertyId),
  });

  const handleAssociate = () => {
    router.push(`/properties/${encodeURIComponent(propertyId)}/associate-person`);
  };

  const handleDissociate = async () => {
    if (!selectedId) return;
    setDissociating(true);
    setDissociateErr(null);
    try {
      const res = await fetch(
        `/api/properties/${encodeURIComponent(propertyId)}/persons/${encodeURIComponent(selectedId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["property-persons", propertyId] });
    } catch (err) {
      setDissociateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setDissociating(false);
    }
  };

  if (isLoading) {
    return (
      <p className="py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
    );
  }

  if (isError) {
    return (
      <p className="py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Person list */}
      <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}>
        {persons && persons.length > 0 ? (
          <table {...fixedTable(COLUMNS)}>
            <FixedColumns columns={COLUMNS} />
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="px-3 py-2" {...columnHead("select")} aria-label="select" />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead("personName")}>
                  {t("colName")}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead("role")}>
                  {t("colRole")}
                </th>
                <th className="px-3 py-2" {...columnHead("open")} aria-label="view" />
              </tr>
            </thead>
            <tbody>
              {persons.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                  onDoubleClick={() => {
                    const base = p.type === "NATURAL" ? "/natural-persons" : "/judicial-persons";
                    router.push(`${base}/${encodeURIComponent(p.id)}?readonly=true`);
                  }}
                  className={[
                    "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                    p.id === selectedId
                      ? "bg-cta-pale dark:bg-cta/10"
                      : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                  ].join(" ")}
                >
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      checked={p.id === selectedId}
                      onChange={() => setSelectedId(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-cta"
                      aria-label={p.displayName}
                    />
                  </td>
                  <td className={`px-3 py-2 font-medium text-ink dark:text-zinc-100 ${WRAPS}`}>
                    {p.displayName}
                  </td>
                  <td className={`px-3 py-2 text-fade dark:text-zinc-400 ${WRAPS}`}>
                    {p.roleName ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const base = p.type === "NATURAL" ? "/natural-persons" : "/judicial-persons";
                        router.push(`${base}/${encodeURIComponent(p.id)}?readonly=true`);
                      }}
                      className={buttonClass({ variant: "secondary", size: "xs" })}
                    >
                      {t("view")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">
            {t("empty")}
          </p>
        )}
      </div>

      {/* Action buttons */}
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
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {dissociateErr}
          </p>
        )}
      </div>
    </div>
  );
}
