"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

type ListItem = {
  id: string;
  code: string;
  type: "NATURAL" | "JUDICIAL";
  displayName: string;
  email: string | null;
  phone: string | null;
};

type ListResponse = {
  items: ListItem[];
  total: number;
  limit: number;
  offset: number;
};

async function fetchPeople(q: string): Promise<ListResponse> {
  const url = new URL("/api/people", window.location.origin);
  if (q) url.searchParams.set("q", q);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export function NaturalPersonListView() {
  const t = useTranslations("naturalPerson");

  // Search input is uncontrolled-feel; the actual API query is debounced.
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const query = useQuery<ListResponse>({
    queryKey: ["people", "list", debouncedSearch],
    queryFn: () => fetchPeople(debouncedSearch),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="flex-1 max-w-md rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />

        <Link
          href="/natural-persons/new"
          className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
        >
          {t("addNew")}
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-4 py-2">{t("table.name")}</th>
              <th className="px-4 py-2">{t("table.email")}</th>
              <th className="px-4 py-2">{t("table.phone")}</th>
              <th className="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-crease dark:divide-zinc-800">
            {query.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-fade">
                  {t("loading")}
                </td>
              </tr>
            )}
            {query.isError && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-red-600">
                  {t("error")}
                </td>
              </tr>
            )}
            {query.data && query.data.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-fade">
                  {t("empty")}
                </td>
              </tr>
            )}
            {query.data?.items.map((item) => (
              <tr key={item.id} className="hover:bg-cta-pale dark:hover:bg-zinc-800/50">
                <td className="px-4 py-2 font-medium">{item.displayName}</td>
                <td className="px-4 py-2 text-fade dark:text-zinc-400">
                  {item.email ?? ""}
                </td>
                <td className="px-4 py-2 text-fade dark:text-zinc-400">
                  {item.phone ?? ""}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/natural-persons/${item.id}`}
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
    </div>
  );
}
