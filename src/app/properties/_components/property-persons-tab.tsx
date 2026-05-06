"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssociatedPerson = {
  id:          string;
  code:        string;
  type:        "NATURAL" | "JUDICIAL";
  displayName: string;
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
  const t      = useTranslations("property.persons");
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: persons, isLoading, isError } = useQuery({
    queryKey: ["property-persons", propertyId],
    queryFn:  () => fetchPropertyPersons(propertyId),
  });

  const handleAssociate = () => {
    router.push(`/properties/${encodeURIComponent(propertyId)}/associate-person`);
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
      <div className="rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {persons && persons.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="w-8 px-3 py-2" aria-label="select" />
                <th className="px-3 py-2 text-left font-medium text-fade dark:text-zinc-400">
                  {t("colCode")}
                </th>
                <th className="px-3 py-2 text-left font-medium text-fade dark:text-zinc-400">
                  {t("colName")}
                </th>
                <th className="px-3 py-2 text-left font-medium text-fade dark:text-zinc-400">
                  {t("colType")}
                </th>
              </tr>
            </thead>
            <tbody>
              {persons.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
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
                  <td className="px-3 py-2 font-mono text-xs text-fade dark:text-zinc-400">
                    {p.code}
                  </td>
                  <td className="px-3 py-2 font-medium text-ink dark:text-zinc-100">
                    {p.displayName}
                  </td>
                  <td className="px-3 py-2 text-fade dark:text-zinc-400">
                    {p.type === "NATURAL" ? t("typeNatural") : t("typeJudicial")}
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAssociate}
          className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
        >
          {t("associate")}
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {t("dissociate")}
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {t("view")}
        </button>
      </div>
    </div>
  );
}
