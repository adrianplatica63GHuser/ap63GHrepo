"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, RotateCw } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useRouter } from "next/navigation";
import { OwnerSwatch, PreviewMap } from "@/app/admin/calculation/_components/preview-map";
import { ownerColor } from "@/lib/calculation/owner-colors";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { screenPanel, stepGridStyle, tableUnits, type ColumnName } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";
import { DeleteRunButton } from "@/app/admin/calculation/history/_components/delete-run";

/** The run's two tables, at #37.16's column widths (Slice #37.22). */
const OWNER_COLUMNS: readonly ColumnName[] = ["personName", "percent", "area", "area", "area", "area"];
/** A side-road run's owners (#38.25): the screen's figures, without ↑ ↓. */
const SIDE_ROAD_COLUMNS: readonly ColumnName[] = ["count", "personName", "percent", "area", "area", "area", "area", "percent"];

/**
 * Slice #37.35: one run is one tile of 7 units, as the calculation is — it
 * holds the 6-unit map and the figures' grid. A side-road run's table is wider
 * (#38.25), and the tile is as wide as its widest fixed piece.
 */
const RUN_UNITS = Math.max(7, tableUnits(SIDE_ROAD_COLUMNS));

/** #38.25: the algorithm „Creează proprietățile" records since #38.23–#38.25. */
const SIDE_ROAD = "SIDE_ROAD";
// Slice #37.57: no „Cod" — a parcel by its nickname; its system ID is on its own screen.
const PARCEL_COLUMNS: readonly ColumnName[] = ["propertyNickname", "outputRole", "viewLink"];

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

/** #18.10's figures, as 'PARCEL_DIVISION' runs stored them — read-only since #38.25. */
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

/** A 'SIDE_ROAD' run's figures (#38.25): what the screen showed, as compute.ts's SlicesComputation. */
type SideRoadComputation = {
  corners:         (Corner & { number: string })[];
  sides:           { from: string; to: string; length: number }[];
  parcelArea:      number;
  roadWidth:       number;
  percentTotal:    number;
  remainderToLast: boolean;
  order:           number[];
  road:            { corner: number; cornerNumber: string; side: "next" | "previous"; from: string; to: string; width: number; length: number; area: number; corners: Corner[] } | null;
  slices:          { owner: number; name: string; percent: number; originalArea: number; roadShare: number; area: number; corners: Corner[] }[];
};

type SideRoadInput = {
  text:    string;
  order:   number[];
  road:    { corner: number; side: "next" | "previous" };
  options: { groupDescription: string; roadNickname: string };
};

type OldInput = { text: string; options: { groupDescription: string; includeRoad: boolean; roadNickname: string } };

type CalcRunDetail = {
  id:              string;
  code:            string;
  algorithmType:   string;
  status:          string;
  /** By algorithmType: SideRoadInput for 'SIDE_ROAD', OldInput for 'PARCEL_DIVISION'. */
  inputParams:     SideRoadInput | OldInput;
  stepsLog:        SideRoadComputation | DivisionComputation;
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
  const tc     = useTranslations("calculation");
  const nameOr = useNameOr(); // #37.57: a name, or words — never the system ID
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

  const isSideRoad = run.algorithmType === SIDE_ROAD;

  /** Only a side-road run re-runs (#38.25): its file, its order, its road, its options. */
  function handleRerun() {
    if (!run || !isSideRoad) return;
    const input = run.inputParams as SideRoadInput;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "calc_rerun",
        JSON.stringify({ text: input.text, order: input.order, road: input.road, options: input.options }),
      );
    }
    router.push("/admin/calculation?rerun=1");
  }

  return (
    <UnitRow units={[RUN_UNITS]}>
    <section {...screenPanel("calculation-run", RUN_UNITS)} className="flex flex-col gap-6 rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">

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
        <div className="ml-auto flex items-center gap-2">
          {isSideRoad && (
            // #37.46 (A088): RotateCw + „Re-rulează cu acești parametri", on
            // buttonClass's primary rather than a hand-written cta class.
            <IconButton
              icon={RotateCw}
              label={t("detail.rerun")}
              showLabel
              variant="primary"
              size="sm"
              onClick={handleRerun}
            />
          )}
          {/* Slice #38.43: deleted, the page goes back to the history it belongs to. */}
          <DeleteRunButton
            run={{ id: run.id, code: run.code, outputCount: run.outputs.filter((o) => o.propertyId !== null).length, resultGroupCode: run.resultGroupCode }}
            size="sm"
            onDeleted={() => router.push("/admin/calculation/history")}
          />
        </div>
      </div>
      {!isSideRoad && (
        <p data-old-run="" className="text-xs text-fade dark:text-zinc-400">{t("detail.oldRunNoRerun")}</p>
      )}

      {isSideRoad ? (
        <SideRoadRunBody comp={run.stepsLog as SideRoadComputation} input={run.inputParams as SideRoadInput} t={t} tc={tc} />
      ) : (
        <OldRunBody comp={run.stepsLog as DivisionComputation} input={run.inputParams as OldInput} t={t} />
      )}

      {/* ── Created parcels ────────────────────────────────────────── */}
      <SectionCard title={t("detail.parcelsTitle")}>
        {run.outputs.length === 0 ? (
          <p className="text-sm text-fade dark:text-zinc-400">{t("detail.parcelsEmpty")}</p>
        ) : (
          <div className={TABLE_FRAME}>
            <table {...fixedTable(PARCEL_COLUMNS)}>
              <FixedColumns columns={PARCEL_COLUMNS} />
              <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-fade dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2" {...columnHead("propertyNickname")}>{t("detail.parcelsCol.nickname")}</th>
                  <th className="px-3 py-2" {...columnHead("outputRole")}>{t("detail.parcelsCol.role")}</th>
                  <th className="px-3 py-2" {...columnHead("viewLink")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-crease dark:divide-zinc-800">
                {run.outputs.map((o) => (
                  <tr key={o.principalObjectId}>
                    <td className={`px-3 py-2 text-ink dark:text-zinc-200 ${WRAPS}`}>
                      {nameOr(o.propertyNickname, "property")}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                        {t(`outputRole.${o.outputRole}`, { fallback: o.outputRole })}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {o.propertyId ? (
                        // #37.42 (A016): ArrowRight; „Vezi proprietatea" its name and tooltip.
                        <IconButton
                          href={`/properties/${encodeURIComponent(o.propertyId)}`}
                          icon={ArrowRight}
                          label={t("detail.viewProperty")}
                          variant="secondary"
                          size="xs"
                        />
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

    </section>
    </UnitRow>
  );
}

type T = ReturnType<typeof useTranslations>;

/** A #18.10 run, read-only (#38.25): its five-section figures as they were stored. */
function OldRunBody({ comp, input, t }: { comp: DivisionComputation; input: OldInput; t: T }) {
  return (
    <>
      {/* ── Input parameters ───────────────────────────────────────── */}
      <SectionCard title={t("detail.paramsTitle")}>
        <div className="text-sm" style={stepGridStyle("L", 4)}>
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
        {input.options.groupDescription && (
          <p className="mt-3 text-xs text-fade dark:text-zinc-400">
            {t("detail.groupDesc")}: <span className="text-ink dark:text-zinc-200">{input.options.groupDescription}</span>
          </p>
        )}
      </SectionCard>

      {/* ── Steps log — owner breakdown ────────────────────────────── */}
      <SectionCard title={t("detail.stepsTitle")}>
        <div className={TABLE_FRAME}>
          <table {...fixedTable(OWNER_COLUMNS)}>
            <FixedColumns columns={OWNER_COLUMNS} />
            <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-fade dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2" {...columnHead("personName")}>{t("detail.stepsCol.owner")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("percent")}>{t("detail.stepsCol.percent")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("area")}>{t("detail.stepsCol.originalArea")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("area")}>{t("detail.stepsCol.roadParticipation")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("area")}>{t("detail.stepsCol.finalArea")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("area")}>{t("detail.stepsCol.computedArea")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-crease dark:divide-zinc-800">
              {comp.owners.map((o, i) => (
                <tr key={i}>
                  <td className={`px-3 py-2 text-ink dark:text-zinc-200 ${WRAPS}`}>
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
          // A run made before #38.23 has no file order of owners: its slices keep
          // the colour of their place in the run's output, as before (#38.27).
          owners={comp.owners.map((o) => ({ label: o.name, corners: o.corners }))}
          road={comp.road.corners}
        />
      </SectionCard>

    </>
  );
}

/** A side-road run (#38.25): the figures the screen showed when it was created. */
function SideRoadRunBody({ comp, input, t, tc }: { comp: SideRoadComputation; input: SideRoadInput; t: T; tc: T }) {
  const road = comp.road;
  const totals = comp.slices.reduce(
    (s, x) => ({ originalArea: s.originalArea + x.originalArea, roadShare: s.roadShare + x.roadShare, area: s.area + x.area }),
    { originalArea: 0, roadShare: 0, area: 0 },
  );
  const diff = (n: number) => fmtArea(Math.abs(n) < 0.005 ? 0 : n);
  return (
    <>
      <SectionCard title={t("detail.paramsTitle")}>
        <div className="text-sm" style={stepGridStyle("L", 4)}>
          <Stat label={tc("figures.parcelArea")} value={`${fmtArea(comp.parcelArea)} m²`} />
          <Stat label={tc("figures.roadWidth")}  value={`${fmtLen(comp.roadWidth)} m`} />
          {comp.sides.map((s) => (
            <Stat key={`${s.from}-${s.to}`} label={tc("figures.side", { from: s.from, to: s.to })} value={`${fmtLen(s.length)} m`} />
          ))}
          {road && (
            <>
              <Stat label={tc("figures.roadCorner")} value={road.cornerNumber} />
              <Stat label={tc("figures.roadSide")}   value={`${road.from}–${road.to}`} />
              <Stat label={tc("figures.roadLength")} value={`${fmtLen(road.length)} m`} />
              <Stat label={tc("figures.roadArea")}   value={`${fmtArea(road.area)} m²`} />
            </>
          )}
        </div>
        {input.options.groupDescription && (
          <p className="mt-3 text-xs text-fade dark:text-zinc-400">
            {t("detail.groupDesc")}: <span className="text-ink dark:text-zinc-200">{input.options.groupDescription}</span>
          </p>
        )}
      </SectionCard>

      <SectionCard title={t("detail.stepsTitle")}>
        <div className={TABLE_FRAME}>
          <table {...fixedTable(SIDE_ROAD_COLUMNS)}>
            <FixedColumns columns={SIDE_ROAD_COLUMNS} />
            <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-fade dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-right" {...columnHead("count")}>{tc("table.order")}</th>
                <th className="px-3 py-2" {...columnHead("personName")}>{tc("table.owner")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("percent")}>{tc("table.percent")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("area")}>{tc("table.originalArea")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("area")}>{tc("table.roadShare")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("area")}>{tc("table.ownArea")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("area")}>{tc("table.sum")}</th>
                <th className="px-3 py-2 text-right" {...columnHead("percent")}>{tc("table.difference")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-crease dark:divide-zinc-800">
              {comp.slices.map((s, i) => (
                <tr key={s.owner}>
                  <td className="px-3 py-2 text-right tabular-nums">{i + 1}</td>
                  <td className={`px-3 py-2 text-ink dark:text-zinc-200 ${WRAPS}`}>
                    <OwnerSwatch color={ownerColor(s.owner)} />
                    {s.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.percent.toLocaleString("ro-RO", { maximumFractionDigits: 3 })}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtArea(s.originalArea)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtArea(s.roadShare)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtArea(s.area)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtArea(s.area + s.roadShare)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{diff(s.area + s.roadShare - s.originalArea)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-crease font-medium dark:border-zinc-800">
              <tr>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-ink dark:text-zinc-200">{tc("table.total")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{comp.percentTotal.toLocaleString("ro-RO", { maximumFractionDigits: 3 })}%</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtArea(totals.originalArea)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtArea(totals.roadShare)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtArea(totals.area)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtArea(totals.area + totals.roadShare)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{diff(totals.area + totals.roadShare - totals.originalArea)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>

      <SectionCard title={t("detail.mapTitle")}>
        <PreviewMap
          bigPolygon={comp.corners}
          numberedCorners={comp.corners}
          // The same owner, the same colour as on the screen that made the run (#38.27).
          owners={comp.slices.map((s) => ({ label: s.name, corners: s.corners, color: ownerColor(s.owner) }))}
          road={road?.corners ?? []}
        />
      </SectionCard>
    </>
  );
}
