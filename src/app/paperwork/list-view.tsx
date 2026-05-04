"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type PaperworkType } from "@/lib/paperwork/validation";

type PaperworkListItem = {
  id:           string;
  code:         string;
  type:         PaperworkType;
  title:        string | null;
  nrDocument:   string | null;
  dateDocument: string | null;
  institution:  string | null;
};

type ListResponse = {
  items:  PaperworkListItem[];
  total:  number;
  limit:  number;
  offset: number;
};

async function fetchPaperwork(q: string, types: string[]): Promise<ListResponse> {
  const url = new URL("/api/paperwork", window.location.origin);
  if (q)            url.searchParams.set("q",     q);
  if (types.length) url.searchParams.set("types", types.join(","));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

// initialTypes:
//   undefined → no ?types param in URL → show all documents
//   []        → ?types= (empty) in URL  → no types selected → show message
//   [...]     → ?types=A,B,...          → show only those types

export function PaperworkListView({
  initialTypes,
}: {
  initialTypes?: string[];
}) {
  const t = useTranslations("paperwork");

  const [searchInput,     setSearchInput]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // typeFilters is derived directly from initialTypes (the URL ?types= param).
  // The sidebar checkboxes change the URL → page.tsx re-renders with new
  // initialTypes → this component re-renders with the correct value.
  // No local state copy is needed — using initialTypes directly avoids the
  // synchronous setState-in-effect pattern flagged by react-hooks/set-state-in-effect.

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // When initialTypes is an empty array, skip the API call and show a message.
  const noTypesSelected = initialTypes !== undefined && initialTypes.length === 0;

  const typeFiltersKey =
    initialTypes === undefined ? "__all__" : initialTypes.join(",");

  const query = useQuery<ListResponse>({
    queryKey: ["paperwork", "list", debouncedSearch, typeFiltersKey],
    queryFn:  () => fetchPaperwork(debouncedSearch, initialTypes ?? []),
    enabled:  !noTypesSelected,
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="flex-1 min-w-48 max-w-md rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
        <Link
          href="/paperwork/new"
          className="ml-auto inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
        >
          {t("addNew")}
        </Link>
      </div>

      {/* No types selected — prompt the user to pick at least one */}
      {noTypesSelected ? (
        <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-4 py-8 text-center text-sm text-fade">
            {t("noTypeSelected")}
          </div>
        </div>
      ) : (
        /* Results table */
        <>
          <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="px-4 py-2">{t("table.code")}</th>
                  <th className="px-4 py-2">{t("table.type")}</th>
                  <th className="px-4 py-2">{t("table.title")}</th>
                  <th className="px-4 py-2">{t("table.nrDocument")}</th>
                  <th className="px-4 py-2">{t("table.dateDocument")}</th>
                  <th className="px-4 py-2 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-crease dark:divide-zinc-800">
                {query.isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-fade">
                      {t("loading")}
                    </td>
                  </tr>
                )}
                {query.isError && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-red-600">
                      {t("error")}
                    </td>
                  </tr>
                )}
                {query.data && query.data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-fade">
                      {t("empty")}
                    </td>
                  </tr>
                )}
                {query.data?.items.map((item) => (
                  <tr
                    key={item.id}
                    className="whitespace-nowrap hover:bg-cta-pale dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-fade">
                      {item.code}
                    </td>
                    <td className="px-4 py-2 text-fade dark:text-zinc-400">
                      {t(`types.${item.type}`)}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {item.title ?? (
                        <span className="text-fade italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-fade dark:text-zinc-400">
                      {item.nrDocument ?? ""}
                    </td>
                    <td className="px-4 py-2 text-fade dark:text-zinc-400">
                      {item.dateDocument ?? ""}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/paperwork/${item.id}`}
                        className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      >
                        {t("open")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {query.data && (
            <div className="text-xs text-fade dark:text-zinc-400">
              {t("counts", {
                shown: query.data.items.length,
                total: query.data.total,
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
