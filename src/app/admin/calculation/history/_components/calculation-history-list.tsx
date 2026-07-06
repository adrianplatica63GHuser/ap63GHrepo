"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";

type CalcRunListItem = {
  id:              string;
  code:            string;
  algorithmType:   string;
  status:          string;
  resultGroupId:   string | null;
  resultGroupCode: string | null;
  outputCount:     number;
  createdBy:       string | null;
  createdAt:       string;
};

async function fetchRuns(): Promise<CalcRunListItem[]> {
  const res = await fetch("/api/calculation/runs");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data as { items: CalcRunListItem[] }).items;
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("calculationHistory");
  const isActive = status === "active";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        isActive
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
      ].join(" ")}
    >
      {t(`status.${status}`)}
    </span>
  );
}

function AlgorithmBadge({ type }: { type: string }) {
  const t = useTranslations("calculationHistory");
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
      {t(`algorithmType.${type}`, { fallback: type })}
    </span>
  );
}

export function CalculationHistoryList() {
  const t = useTranslations("calculationHistory");

  const { data: items, isLoading, isError } = useQuery({
    queryKey:  ["calculation-runs"],
    queryFn:   fetchRuns,
    staleTime: 0,
  });

  if (isLoading) {
    return <p className="text-sm text-fade dark:text-zinc-400">{t("loading")}</p>;
  }
  if (isError) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        {t("error")}
      </p>
    );
  }
  if (!items || items.length === 0) {
    return <p className="text-sm text-fade dark:text-zinc-400">{t("empty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-fade dark:bg-zinc-800 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2">{t("col.code")}</th>
            <th className="px-3 py-2">{t("col.algorithm")}</th>
            <th className="px-3 py-2 text-center">{t("col.parcels")}</th>
            <th className="px-3 py-2">{t("col.group")}</th>
            <th className="px-3 py-2">{t("col.status")}</th>
            <th className="px-3 py-2">{t("col.createdBy")}</th>
            <th className="px-3 py-2">{t("col.date")}</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-crease dark:divide-zinc-800">
          {items.map((run) => (
            <tr
              key={run.id}
              className="hover:bg-canvas dark:hover:bg-zinc-800/50"
            >
              <td className="px-3 py-2 font-mono text-xs font-medium text-ink dark:text-zinc-100">
                {run.code}
              </td>
              <td className="px-3 py-2">
                <AlgorithmBadge type={run.algorithmType} />
              </td>
              <td className="px-3 py-2 text-center tabular-nums text-fade dark:text-zinc-400">
                {run.outputCount}
              </td>
              <td className="px-3 py-2">
                {run.resultGroupCode ? (
                  <span className="font-mono text-xs text-fade dark:text-zinc-400">
                    {run.resultGroupCode}
                  </span>
                ) : (
                  <span className="text-fade dark:text-zinc-600">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={run.status} />
              </td>
              <td className="px-3 py-2 text-xs text-fade dark:text-zinc-400">
                {run.createdBy ?? "—"}
              </td>
              <td className="px-3 py-2 text-xs tabular-nums text-fade dark:text-zinc-400">
                {new Date(run.createdAt).toLocaleDateString("ro-RO", {
                  day:   "2-digit",
                  month: "2-digit",
                  year:  "numeric",
                })}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/admin/calculation/history/${run.id}`}
                  className="text-xs font-medium text-cta hover:underline dark:text-cta-light"
                >
                  {t("viewDetail")} →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
