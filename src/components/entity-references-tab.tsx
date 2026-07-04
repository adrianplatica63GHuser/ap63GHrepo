"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GroupTag  = { code: string; position: number; description: string };
type StampTag  = { code: string; shortDescription: string };
type RefsData  = { groups: GroupTag[]; stamps: StampTag[] };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  /** e.g. /api/properties/abc/entity-references */
  apiPath: string;
  /** Unique prefix for the TanStack Query cache key, e.g. "property-refs-abc" */
  queryKey: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityReferencesTab({ apiPath, queryKey }: Props) {
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
              <li key={g.code} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs rounded border border-card-rim bg-card px-1.5 py-0.5 text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  {g.code}&nbsp;[{String(g.position).padStart(2, "0")}]
                </span>
                <span className="text-ink dark:text-zinc-100">{g.description}</span>
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
              <li key={s.code} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs rounded border border-card-rim bg-card px-1.5 py-0.5 text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  {s.code}
                </span>
                <span className="text-ink dark:text-zinc-100">{s.shortDescription}</span>
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
