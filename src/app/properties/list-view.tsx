"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PAGE_SIZE = 15;

type PropertyListItem = {
  id:              string;
  code:            string;
  nickname:        string | null;
  tarlaSola:       string | null;
  parcela:         string | null;
  cadastralNumber: string | null;
  carteFunciara:   string | null;
  useCategory:     string | null;
  surfaceAreaMp:   string | null;
  locality:        string | null;
  county:          string | null;
};

type ListResponse = {
  items:  PropertyListItem[];
  total:  number;
  limit:  number;
  offset: number;
};

async function fetchProperties(q: string, page: number): Promise<ListResponse> {
  const url = new URL("/api/properties", window.location.origin);
  if (q) url.searchParams.set("q", q);
  url.searchParams.set("limit",  String(PAGE_SIZE));
  url.searchParams.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function formatArea(raw: string | null): string {
  if (raw == null) return "";
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function PropertyListView() {
  const t    = useTranslations("property");
  const tPag = useTranslations("shared.pagination");
  const router = useRouter();

  const [searchInput,     setSearchInput]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage,     setCurrentPage]     = useState(0);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(0);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const query = useQuery<ListResponse>({
    queryKey: ["properties", "list", debouncedSearch, currentPage],
    queryFn:  () => fetchProperties(debouncedSearch, currentPage),
  });

  const total      = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginate   = total > PAGE_SIZE;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
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
          href="/properties/new"
          className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
        >
          {t("addNew")}
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-4 py-2">{t("table.code")}</th>
              <th className="px-4 py-2">{t("table.nickname")}</th>
              <th className="px-4 py-2">{t("table.cadastralNumber")}</th>
              <th className="px-4 py-2">{t("table.carteFunciara")}</th>
              <th className="px-4 py-2 text-right">{t("table.surfaceAreaMp")}</th>
              <th className="px-4 py-2">{t("table.locality")}</th>
              <th className="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-crease dark:divide-zinc-800">
            {query.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-fade">
                  {t("loading")}
                </td>
              </tr>
            )}
            {query.isError && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-red-600">
                  {t("error")}
                </td>
              </tr>
            )}
            {query.data && query.data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-fade">
                  {t("empty")}
                </td>
              </tr>
            )}
            {query.data?.items.map((item) => (
              <tr
                key={item.id}
                onDoubleClick={() => router.push(`/properties/${item.id}`)}
                className="whitespace-nowrap hover:bg-cta-pale dark:hover:bg-zinc-800/50 cursor-pointer"
              >
                <td className="px-4 py-2 font-mono text-xs text-fade">
                  {item.code}
                </td>
                <td className="px-4 py-2 font-medium">
                  {item.nickname ?? (
                    <span className="text-fade italic">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-fade dark:text-zinc-400">
                  {item.cadastralNumber ?? ""}
                </td>
                <td className="px-4 py-2 text-fade dark:text-zinc-400">
                  {item.carteFunciara ?? ""}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-fade dark:text-zinc-400">
                  {formatArea(item.surfaceAreaMp)}
                </td>
                <td className="px-4 py-2 text-fade dark:text-zinc-400">
                  {[item.locality, item.county].filter(Boolean).join(", ")}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/properties/${item.id}`}
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

      {/* Pagination */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-fade dark:text-zinc-400">
          {query.data
            ? t("counts", { shown: query.data.items.length, total })
            : null}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={!paginate || currentPage === 0}
            className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {tPag("previous")}
          </button>
          <span className="text-xs text-fade dark:text-zinc-400">
            {tPag("pageOf", { page: currentPage + 1, total: totalPages })}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!paginate || currentPage >= totalPages - 1}
            className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {tPag("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
