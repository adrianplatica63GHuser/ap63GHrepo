"use client";

import type React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { screenPanel, tableUnits, type ColumnName } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";
import { DeleteRunButton } from "./delete-run";

/** The runs, at #37.16's column widths (Slice #37.22). */
// Slice #38.43: „rowActions" — „Detalii" and „Șterge calculul" — where „open" held „Detalii" alone.
const COLUMNS: readonly ColumnName[] = ["code", "algorithm", "count", "groupCode", "runStatus", "updatedBy", "date", "rowActions"];

/** Slice #37.35: one tile, the fewest units that hold the runs' columns; „De către" takes the rest. */
const LIST_UNITS = tableUnits(COLUMNS);
const LIST_FILL = { units: LIST_UNITS, column: "updatedBy" } as const;

/** Every state of the list in the same tile, on the screen's unit row. */
function ListTile({ children }: { children: React.ReactNode }) {
  return (
    <UnitRow units={[LIST_UNITS]}>
      <section {...screenPanel("calculation-runs", LIST_UNITS)} className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {children}
      </section>
    </UnitRow>
  );
}

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
    return <ListTile><p className="text-sm text-fade dark:text-zinc-400">{t("loading")}</p></ListTile>;
  }
  if (isError) {
    return (
      <ListTile>
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {t("error")}
        </p>
      </ListTile>
    );
  }
  if (!items || items.length === 0) {
    return <ListTile><p className="text-sm text-fade dark:text-zinc-400">{t("empty")}</p></ListTile>;
  }

  return (
    <ListTile>
    <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-white dark:border-zinc-800 dark:bg-zinc-900`}>
      <table {...fixedTable(COLUMNS, undefined, LIST_FILL)}>
        <FixedColumns columns={COLUMNS} fill={LIST_FILL} />
        <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-fade dark:bg-zinc-800 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2" {...columnHead("code")}>{t("col.code")}</th>
            <th className="px-3 py-2" {...columnHead("algorithm")}>{t("col.algorithm")}</th>
            <th className="px-3 py-2 text-center" {...columnHead("count")}>{t("col.parcels")}</th>
            <th className="px-3 py-2" {...columnHead("groupCode")}>{t("col.group")}</th>
            <th className="px-3 py-2" {...columnHead("runStatus")}>{t("col.status")}</th>
            <th className="px-3 py-2" {...columnHead("updatedBy")}>{t("col.createdBy")}</th>
            <th className="px-3 py-2" {...columnHead("date")}>{t("col.date")}</th>
            <th className="px-3 py-2" {...columnHead("rowActions")} />
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
              <td className={`px-3 py-2 text-xs text-fade dark:text-zinc-400 ${WRAPS}`}>
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
                <div className="flex justify-end gap-1">
                  {/* #37.42 (A016): ArrowRight; „Detalii" its name and tooltip. */}
                  <IconButton
                    href={`/admin/calculation/history/${run.id}`}
                    icon={ArrowRight}
                    label={t("viewDetail")}
                    variant="secondary"
                    size="xs"
                  />
                  {/* Slice #38.43: the run goes; what it created stays, and the confirmation says so. */}
                  <DeleteRunButton run={run} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </ListTile>
  );
}
