"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PreviewMap } from "./preview-map";

// ---------------------------------------------------------------------------
// Types (mirror src/lib/calculation/compute.ts — redeclared so this client
// module never imports the server-only compute file)
// ---------------------------------------------------------------------------

type Corner = { lat: number; lon: number; north: number; east: number };

type ComputedOwner = {
  name: string;
  rawLabel: string;
  percent: number;
  fraction: number;
  originalArea: number;
  roadParticipation: number;
  finalArea: number;
  computedArea: number;
  corners: Corner[];
};

type Computation = {
  orientation: "HORIZONTAL" | "VERTICAL";
  declaredOrientation: "HORIZONTAL" | "VERTICAL";
  roadCorner: string;
  roadWidth: number;
  totalArea: number;
  lengthSide: number;
  widthSide: number;
  percentTotal: number;
  bigPolygon: Corner[];
  owners: ComputedOwner[];
  road: { area: number; length: number; corners: Corner[] };
};

type CommitResult = {
  groupId: string;
  groupCode: string;
  properties: { id: string; code: string; nickname: string | null }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtArea(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtLen(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalculationView() {
  const t = useTranslations("calculation");

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);

  const [computation, setComputation] = useState<Computation | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [groupDescription, setGroupDescription] = useState("");
  const [includeRoad, setIncludeRoad] = useState(true);
  const [roadNickname, setRoadNickname] = useState(t("road.defaultNickname"));

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<CommitResult | null>(null);

  function resetAll() {
    setFileName(null);
    setFileText(null);
    setComputation(null);
    setPreviewError(null);
    setGroupDescription("");
    setIncludeRoad(true);
    setRoadNickname(t("road.defaultNickname"));
    setCommitError(null);
    setCommitted(null);
  }

  async function doPreview(text: string, name: string) {
    setPreviewing(true);
    setPreviewError(null);
    setComputation(null);
    setCommitted(null);
    try {
      const res = await fetch("/api/calculation/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.redirected) throw new Error(t("errors.session"));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
      setComputation((data as { computation: Computation }).computation);
      setGroupDescription(t("group.defaultDescription", { file: name }));
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    setFileText(text);
    await doPreview(text, file.name);
  }

  async function doCommit() {
    if (!fileText) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch("/api/calculation/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fileText,
          groupDescription: groupDescription.trim(),
          includeRoad,
          roadNickname: roadNickname.trim(),
        }),
      });
      if (res.redirected) throw new Error(t("errors.session"));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
      setCommitted(data as CommitResult);
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommitting(false);
    }
  }

  // ---- Committed (success) -------------------------------------------------

  if (committed) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950">
          <p className="font-semibold text-green-800 dark:text-green-300">
            {t("success.title", { code: committed.groupCode })}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {committed.properties.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/properties/${p.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {p.code}
                  {p.nickname ? ` — ${p.nickname}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <button
            onClick={resetAll}
            className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d"
          >
            {t("buttons.startOver")}
          </button>
        </div>
      </div>
    );
  }

  const percentOff = computation
    ? Math.abs(computation.percentTotal - 100) > 0.001
    : false;

  // ---- Main ----------------------------------------------------------------

  return (
    <div className="flex flex-col gap-5">
      {/* Intro / reasoning */}
      <p className="text-sm text-fade dark:text-zinc-400">{t("intro")}</p>

      {/* Upload */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d">
          {t("buttons.chooseFile")}
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={handleFile}
            className="sr-only"
          />
        </label>
        {fileName && (
          <span className="text-xs text-fade dark:text-zinc-400">{fileName}</span>
        )}
        {(computation || fileName) && (
          <button
            onClick={resetAll}
            className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {t("buttons.reset")}
          </button>
        )}
      </div>

      {previewing && (
        <p className="text-sm text-fade dark:text-zinc-400">{t("status.computing")}</p>
      )}
      {previewError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {previewError}
        </p>
      )}

      {computation && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Stat label={t("summary.orientation")} value={t(`orientation.${computation.orientation}`)} />
            <Stat label={t("summary.totalArea")} value={`${fmtArea(computation.totalArea)} m²`} />
            <Stat label={t("summary.roadCorner")} value={computation.roadCorner} />
            <Stat label={t("summary.roadWidth")} value={`${fmtLen(computation.roadWidth)} m`} />
            <Stat label={t("summary.lengthSide")} value={`${fmtLen(computation.lengthSide)} m`} />
            <Stat label={t("summary.widthSide")} value={`${fmtLen(computation.widthSide)} m`} />
            <Stat label={t("summary.roadLength")} value={`${fmtLen(computation.road.length)} m`} />
            <Stat label={t("summary.roadArea")} value={`${fmtArea(computation.road.area)} m²`} />
          </div>

          {percentOff && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              {t("summary.percentWarning", {
                total: computation.percentTotal.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                }),
              })}
            </p>
          )}

          {/* Owners table */}
          <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">{t("table.owner")}</th>
                  <th className="px-3 py-2 text-right">{t("table.percent")}</th>
                  <th className="px-3 py-2 text-right">{t("table.originalArea")}</th>
                  <th className="px-3 py-2 text-right">{t("table.roadParticipation")}</th>
                  <th className="px-3 py-2 text-right">{t("table.finalArea")}</th>
                  <th className="px-3 py-2 text-right">{t("table.computedArea")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crease dark:divide-zinc-800">
                {computation.owners.map((o, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-ink dark:text-zinc-200">
                      {o.name}
                      {o.rawLabel !== o.name && (
                        <span className="ml-1 text-xs text-fade dark:text-zinc-500">
                          ({o.rawLabel})
                        </span>
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

          {/* Map */}
          <PreviewMap
            bigPolygon={computation.bigPolygon}
            owners={computation.owners.map((o) => ({ label: o.name, corners: o.corners }))}
            road={computation.road.corners}
          />

          {/* Commit form */}
          <div className="flex flex-col gap-3 rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
              {t("commit.title", { count: computation.owners.length })}
            </h3>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink dark:text-zinc-400">
                {t("commit.groupDescription")}
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                type="text"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                maxLength={500}
                className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-ink dark:text-zinc-300">
              <input
                type="checkbox"
                checked={includeRoad}
                onChange={(e) => setIncludeRoad(e.target.checked)}
                className="h-4 w-4 rounded border-wire accent-cta"
              />
              {t("commit.includeRoad")}
            </label>

            {includeRoad && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink dark:text-zinc-400">
                  {t("commit.roadNickname")}
                </label>
                <input
                  type="text"
                  value={roadNickname}
                  onChange={(e) => setRoadNickname(e.target.value)}
                  className="max-w-xs rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            )}

            {commitError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {commitError}
              </p>
            )}

            <div>
              <button
                onClick={doCommit}
                disabled={committing || groupDescription.trim().length === 0}
                className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white hover:bg-cta-d disabled:opacity-50"
              >
                {committing ? t("buttons.creating") : t("buttons.confirm")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-card-rim bg-card px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="text-[11px] uppercase tracking-wide text-fade dark:text-zinc-500">
        {label}
      </div>
      <div className="text-sm font-medium text-ink dark:text-zinc-100">{value}</div>
    </div>
  );
}
