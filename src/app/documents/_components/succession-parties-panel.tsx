"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PartyItem = {
  id:          string;
  code:        string;
  type:        "NATURAL" | "JUDICIAL";
  displayName: string;
  quality:     string | null;
};

type Props = {
  documentId: string;
  mode:       "edit" | "view";
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchParties(documentId: string): Promise<PartyItem[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/persons`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as PartyItem[];
}

// ---------------------------------------------------------------------------
// Quality badge
// ---------------------------------------------------------------------------

function QualityBadge({ quality, t }: { quality: string | null; t: ReturnType<typeof useTranslations> }) {
  if (quality === "DEFUNCT") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
        {t("qualityDefunct")}
      </span>
    );
  }
  if (quality === "MOSTENITOR") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
        {t("qualityMostenitor")}
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SuccessionPartiesPanel({ documentId, mode }: Props) {
  const t           = useTranslations("document.successionParties");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [removingId,  setRemovingId]  = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["document-persons", documentId],
    queryFn:  () => fetchParties(documentId),
  });

  const handleAddParty = () => {
    router.push(`/documents/${encodeURIComponent(documentId)}/associate-party`);
  };

  const handleRemove = async (personId: string) => {
    setRemovingId(personId);
    setRemoveError(null);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/persons/${encodeURIComponent(personId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["document-persons", documentId] });
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : t("removeError"));
    } finally {
      setRemovingId(null);
    }
  };

  const personHref = (item: PartyItem) => {
    const base = item.type === "NATURAL" ? "/natural-persons" : "/judicial-persons";
    return `${base}/${encodeURIComponent(item.id)}?readonly=true`;
  };

  return (
    <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
        {t("sectionTitle")}
      </h2>

      {isLoading ? (
        <p className="py-2 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
      ) : isError ? (
        <p className="py-2 text-sm text-red-600 dark:text-red-400">{t("error")}</p>
      ) : !items || items.length === 0 ? (
        <p className="py-2 text-sm text-fade dark:text-zinc-400">{t("empty")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-rim dark:border-zinc-800">
              <th className="px-2 py-1.5 text-left font-semibold text-fade dark:text-zinc-400">{t("colName")}</th>
              <th className="px-2 py-1.5 text-left font-semibold text-fade dark:text-zinc-400">{t("colQuality")}</th>
              {mode === "edit" && <th className="w-20 px-2 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-card-rim last:border-0 dark:border-zinc-800"
              >
                <td className="px-2 py-1.5 font-medium text-ink dark:text-zinc-100">
                  <a
                    href={personHref(item)}
                    className="text-cta hover:underline dark:text-cta"
                    onClick={(e) => { e.preventDefault(); router.push(personHref(item)); }}
                  >
                    {item.displayName}
                  </a>
                </td>
                <td className="px-2 py-1.5">
                  <QualityBadge quality={item.quality} t={t} />
                </td>
                {mode === "edit" && (
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      disabled={removingId === item.id}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                    >
                      {removingId === item.id ? t("removing") : t("remove")}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {removeError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{removeError}</p>
      )}

      {mode === "edit" && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleAddParty}
            className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            + {t("addButton")}
          </button>
        </div>
      )}
    </section>
  );
}
