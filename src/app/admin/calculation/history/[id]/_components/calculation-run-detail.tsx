"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PreviewMap } from "@/app/admin/calculation/_components/preview-map";

// ---------------------------------------------------------------------------
// Types  (mirror src/lib/calculation/runs.ts — no server import in client)
// ---------------------------------------------------------------------------

type Corner = { lat: number; lon: number; north: number; east: number };

type ComputedOwner = {
  name:              string;
  rawLabel:          string;
  percent:           number;
  originalArea:      number;
  roadParticipation: number;
  finalArea:         number;
  computedArea:      number;
  corners:           Corner[];
};

type DivisionComputation = {
  orientation:         "HORIZONTAL" | "VERTICAL";
  roadCorner:          string;
  roadWidth:           number;
  totalArea:           number;
  lengthSide:          number;
  widthSide:           number;
  percentTotal:        number;
  bigPolygon:          Corner[];
  owners:              ComputedOwner[];
  road:                { area: number; length: number; corners: Corner[] };
};

type CalcRunOutput = {
  principalObjectId: string;
  outputRole:        string;
  propertyId:        string | null;
  propertyCode:      string | null;
  propertyNickname:  string | null;
};

type CalcRunDetail = {
  id:              string;
  code:            string;
  algorithmType:   string;
  status:          string;
  inputParams:     { text: string; options: { groupDescription: string; includeRoad: boolean; roadNickname: string } };
  stepsLog:        DivisionComputation;
  resultGroupId:   string | null;
  resultGroupCode: string | null;
  outputs:         CalcRunOutput[];
  createdBy:       string | null;
  createdAt:       string;
  notes:           string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtArea(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtLen(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

async function fetchRun(id: string): Promise<CalcRunDetail> {
  const res = await fetch(`/api/calculation/runs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data as { run: CalcRunDetail }).run;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-card-rim px-4 py-2 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-card-rim bg-canvas px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="text-[11px] uppercase tracking-wide text-fade dark:text-zinc-500">{label}</div>
      <div className="text-sm font-medium text-ink dark:text-zinc-100">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("calculationHistory");
  const isActive = status === "active";
  return (
    <span className={[
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
      isActive
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    ].join(" ")}>
      {t(`status.${status}`)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CalculationRunDetail({ runId }: { runId: string }) {
  const t      = useTranslations("calculationHistory");
  const router = useRouter();

  const { data: run, isLoading, isError } = useQuery({
    queryKey:  ["calculation-run", runId],
    queryFn:   () => fetchRun(runId),
    staleTime: 0,
  });

  if (isLoading) {
    return <p className="text-sm text-fade dark:text-zinc-400">{t("loading")}</p>;
  }
  if (isError || !run) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        {t("error")}
      </p>
    );
  }

  const comp = run.stepsLog;

  function handleRerun() {
    // Encode the stored input text into sessionStorage so the calculation page
    // can pick it up and pre-fill the form.
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "calc_rerun",
        JSON.stringify({
          text:    run.inputParams.text,
          options: run.inputParams.options,
        }),
      );
    }
    router.push("/admin/calculation?rerun=1");
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header info bar ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-mono text-base font-semibold text-ink dark:text-zinc-100">
          {run.code}
        </span>
        <StatusBadge status={run.status} />
        <span className="text-xs text-fade dark:text-zinc-400">
          {new Date(run.createdAt).toLocaleString("ro-RO")}
        </span>
        {run.createdBy && (
          <span className="text-xs text-fade dark:text-zinc-400">{run.createdBy}</span>
        )}
        {run.resultGroupCode && (
          <span className="text-xs text-fade dark:text-zinc-400">
            {t("detail.group")}: <span className="font-mono">{run.resultGroupCode}</span>
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleRerun}
            className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-cta-d"
          >
            {t("detail.rerun")}
          </button>
        </div>
      </div>

      {/* ── Input parameters ───────────────────────────────────────── */}
      <SectionCard title={t("detail.paramsTitle")}>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Stat label={t("detail.orientation")} value={
            comp.orientation === "HORIZONTAL" ? "Orizontal" : "Vertical"
          } />
          <Stat label={t("detail.totalArea")}   value={`${fmtArea(comp.totalArea)} m²`} />
          <Stat label={t("detail.roadCorner")}  value={comp.roadCorner} />
          <Stat label={t("detail.roadWidth")}   value={`${fmtLen(comp.roadWidth)} m`} />
          <Stat label={t("detail.lengthSide")}  value={`${fmtLen(comp.lengthSide)} m`} />
          <Stat label={t("detail.widthSide")}   value={`${fmtLen(comp.widthSide)} m`} />
          <Stat label={t("detail.roadLength")}  value={`${fmtLen(comp.road.length)} m`} />
          <Stat label={t("detail.roadArea")}    value={`${fmtArea(comp.road.area)} m²`} />
        </div>
        {run.inputParams.options.groupDescription && (
          <p className="mt-3 text-xs text-fade dark:text-zinc-400">
            {t("detail.groupDesc")}: <span className="text-ink dark:text-zinc-200">{run.inputParams.options.groupDescription}</span>
          </p>
        )}
      </SectionCard>

      {/* ── Steps log — owner breakdown ────────────────────────────── */}
      <SectionCard title={t("detail.stepsTitle")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-fade dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">{t("detail.stepsCol.owner")}</th>
                <th className="px-3 py-2 text-right">{t("detail.stepsCol.percent")}</th>
                <th className="px-3 py-2 text-right">{t("detail.stepsCol.originalArea")}</th>
                <th className="px-3 py-2 text-right">{t("detail.stepsCol.roadParticipation")}</th>
                <th className="px-3 py-2 text-right">{t("detail.stepsCol.finalArea")}</th>
                <th className="px-3 py-2 text-right">{t("detail.stepsCol.computedArea")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-crease dark:divide-zinc-800">
              {comp.owners.map((o, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-ink dark:text-zinc-200">
                    {o.name}
                    {o.rawLabel !== o.name && (
                      <span className="ml-1 text-xs text-fade dark:text-zinc-500">({o.rawLabel})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{o.percent}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtArea(o.originalArea)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtArea(o.roadParticipation)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtArea(o.finalArea)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtArea(o.computedArea)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* PDF notice — Phase C placeholder */}
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          {t("detail.pdfNotice")}
        </p>
      </SectionCard>

      {/* ── Map preview ────────────────────────────────────────────── */}
      <SectionCard title={t("detail.mapTitle")}>
        <PreviewMap
          bigPolygon={comp.bigPolygon}
          owners={comp.owners.map((o) => ({ label: o.name, corners: o.corners }))}
          road={comp.road.corners}
        />
      </SectionCard>

      {/* ── Created parcels ────────────────────────────────────────── */}
      <SectionCard title={t("detail.parcelsTitle")}>
        {run.outputs.length === 0 ? (
          <p className="text-sm text-fade dark:text-zinc-400">{t("detail.parcelsEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-fade dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">{t("detail.parcelsCol.code")}</th>
                  <th className="px-3 py-2">{t("detail.parcelsCol.nickname")}</th>
                  <th className="px-3 py-2">{t("detail.parcelsCol.role")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-crease dark:divide-zinc-800">
                {run.outputs.map((o) => (
                  <tr key={o.principalObjectId}>
                    <td className="px-3 py-2 font-mono text-xs text-fade dark:text-zinc-400">
                      {o.propertyCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-ink dark:text-zinc-200">
                      {o.propertyNickname ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                        {t(`outputRole.${o.outputRole}`, { fallback: o.outputRole })}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {o.propertyId ? (
                        <Link
                          href={`/properties/${encodeURIComponent(o.propertyId)}`}
                          className="text-xs font-medium text-cta hover:underline dark:text-cta-light"
                        >
                          {t("detail.viewProperty")} →
                        </Link>
                      ) : (
                        <span className="text-xs text-fade dark:text-zinc-500">{t("detail.deleted")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

    </div>
  );
}
