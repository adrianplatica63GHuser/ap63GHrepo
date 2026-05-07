"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type AssociatedPaperwork = {
  id:           string;
  code:         string;
  type:         string;
  title:        string | null;
  associatedAt: string;
};

type Props = {
  personId: string;
  /** "/natural-persons" or "/judicial-persons" — used for the Associate button route */
  backBase: string;
};

async function fetchPersonPaperwork(personId: string): Promise<AssociatedPaperwork[]> {
  const res = await fetch(`/api/people/${encodeURIComponent(personId)}/paperwork`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedPaperwork[];
}

export function PersonPaperworkTab({ personId, backBase }: Props) {
  const t           = useTranslations("shared.paperwork");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [dissociating,  setDissociating]  = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["person-paperwork", personId],
    queryFn:  () => fetchPersonPaperwork(personId),
  });

  const handleAssociate = () => {
    router.push(`${backBase}/${encodeURIComponent(personId)}/associate-paperwork`);
  };

  const handleDissociate = async () => {
    if (!selectedId) return;
    setDissociating(true);
    setDissociateErr(null);
    try {
      const res = await fetch(
        `/api/people/${encodeURIComponent(personId)}/paperwork/${encodeURIComponent(selectedId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["person-paperwork", personId] });
    } catch (err) {
      setDissociateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setDissociating(false);
    }
  };

  const handleView = () => {
    if (!selectedId) return;
    router.push(`/paperwork/${encodeURIComponent(selectedId)}`);
  };

  if (isLoading) return <p className="py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>;
  if (isError)   return <p className="py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {items && items.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="w-8 px-3 py-2" aria-label="select" />
                <th className="px-3 py-2 text-left font-medium text-fade dark:text-zinc-400">{t("colCode")}</th>
                <th className="px-3 py-2 text-left font-medium text-fade dark:text-zinc-400">{t("colType")}</th>
                <th className="px-3 py-2 text-left font-medium text-fade dark:text-zinc-400">{t("colTitle")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
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
                  <td className="px-3 py-2 font-mono text-xs text-fade dark:text-zinc-400">{item.code}</td>
                  <td className="px-3 py-2 text-fade dark:text-zinc-400">{item.type}</td>
                  <td className="px-3 py-2 text-ink dark:text-zinc-100">{item.title ?? "—"}</td>
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
            className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("associate")}
          </button>
          <button
            type="button"
            onClick={handleDissociate}
            disabled={selectedId === null || dissociating}
            className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {dissociating ? t("dissociating") : t("dissociate")}
          </button>
          <button
            type="button"
            onClick={handleView}
            disabled={selectedId === null}
            className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {t("view")}
          </button>
        </div>
        {dissociateErr && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{dissociateErr}</p>
        )}
      </div>
    </div>
  );
}
