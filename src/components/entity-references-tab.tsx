"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GroupTag  = { id: string; code: string; position: number; description: string };
type StampTag  = { id: string; code: string; shortDescription: string };
type RefsData  = { groups: GroupTag[]; stamps: StampTag[] };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  /** e.g. /api/properties/abc/entity-references */
  apiPath: string;
  /** Unique prefix for the TanStack Query cache key, e.g. "property-refs-abc" */
  queryKey: string;
  /**
   * The URL of the current entity page (e.g. /properties/abc).
   * Passed as ?from=… to the group/stamp admin pages so they can show
   * a "Back to <entity>" link instead of "Back to groups / stamps".
   */
  backHref: string;
  /**
   * Display name of the current entity (e.g. "Parcel P001").
   * Passed as ?fromLabel=… to the group/stamp admin pages.
   */
  backLabel: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityReferencesTab({ apiPath, queryKey, backHref, backLabel }: Props) {
  const t = useTranslations("shared.entityReferences");

  const { data, isLoading, isError } = useQuery<RefsData>({
    queryKey: [queryKey],
    queryFn: async () => {
      const res = await fetch(apiPath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<RefsData>;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  /** Appends ?from=…&fromLabel=… so the target page can render a contextual back link. */
  function withBack(href: string): string {
    return `${href}?from=${encodeURIComponent(backHref)}&fromLabel=${encodeURIComponent(backLabel)}`;
  }

  if (isLoading) {
    return (
      <p className="py-6 text-sm text-fade dark:text-zinc-400">
        {t("loading")}
      </p>
    );
  }

  if (isError) {
    return (
      <p className="py-6 text-sm text-red-600 dark:text-red-400">
        {t("error")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-2">

      {/* ── Groups ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-ink dark:text-zinc-100">
          {t("groups.title")}
        </h2>
        {!data?.groups.length ? (
          <p className="text-sm text-fade dark:text-zinc-400">{t("groups.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.groups.map((g) => (
              <li key={g.code}>
                <Link
                  href={withBack(`/admin/groups/${encodeURIComponent(g.id)}`)}
                  className="inline-flex items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-canvas dark:hover:bg-zinc-800"
                >
                  <span className="font-mono text-xs rounded border border-card-rim bg-card px-1.5 py-0.5 text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    {g.code}&nbsp;[{String(g.position).padStart(2, "0")}]
                  </span>
                  <span className="text-ink underline-offset-2 hover:underline dark:text-zinc-100">
                    {g.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Stamps ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-ink dark:text-zinc-100">
          {t("stamps.title")}
        </h2>
        {!data?.stamps.length ? (
          <p className="text-sm text-fade dark:text-zinc-400">{t("stamps.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.stamps.map((s) => (
              <li key={s.code}>
                <Link
                  href={withBack(`/admin/stamps/${encodeURIComponent(s.id)}`)}
                  className="inline-flex items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-canvas dark:hover:bg-zinc-800"
                >
                  <span className="font-mono text-xs rounded border border-card-rim bg-card px-1.5 py-0.5 text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    {s.code}
                  </span>
                  <span className="text-ink underline-offset-2 hover:underline dark:text-zinc-100">
                    {s.shortDescription}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Mentions ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-ink dark:text-zinc-100">
          {t("mentions.title")}
        </h2>
        <p className="text-sm text-fade dark:text-zinc-400">{t("mentions.wip")}</p>
      </section>

    </div>
  );
}
