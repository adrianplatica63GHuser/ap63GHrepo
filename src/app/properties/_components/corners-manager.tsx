"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatDMS } from "@/lib/geo/dms";
import type { Corner } from "./form-schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DisplayFormat = "DD" | "DMS";
type InputMode    = "DD" | "STEREO70";

type Props = {
  corners:  Corner[];
  onChange: (next: Corner[]) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDD(v: number, decimals = 7): string {
  return v.toFixed(decimals);
}

async function stereo70ToWgs84(
  north: number,
  east:  number,
): Promise<Corner> {
  const res = await fetch("/api/geo/convert", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      direction: "stereo70ToWgs84",
      points:    [{ north, east }],
    }),
  });
  if (!res.ok) throw new Error("Conversion failed");
  const data = await res.json();
  const pt = data.points?.[0];
  if (!pt) throw new Error("No point returned");
  return { lat: pt.lat, lon: pt.lon };
}

// ---------------------------------------------------------------------------
// Inline add/edit row
// ---------------------------------------------------------------------------

function CornerInputRow({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Corner;
  onSave:   (c: Corner) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("property.corners");

  const [mode,        setMode]        = useState<InputMode>("DD");
  const [lat,         setLat]         = useState(initial ? String(initial.lat) : "");
  const [lon,         setLon]         = useState(initial ? String(initial.lon) : "");
  const [north,       setNorth]       = useState("");
  const [east,        setEast]        = useState("");
  const [converting,  setConverting]  = useState(false);
  const [convertErr,  setConvertErr]  = useState<string | null>(null);

  const inputCls =
    "rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950 focus:outline-none focus:border-zinc-500 w-full";

  const handleSave = async () => {
    setConvertErr(null);

    if (mode === "DD") {
      const latN = parseFloat(lat);
      const lonN = parseFloat(lon);
      if (isNaN(latN) || isNaN(lonN)) {
        setConvertErr("Enter valid decimal degree values");
        return;
      }
      onSave({ lat: latN, lon: lonN });
      return;
    }

    // Stereo70 → WGS84 via API
    const northN = parseFloat(north);
    const eastN  = parseFloat(east);
    if (isNaN(northN) || isNaN(eastN)) {
      setConvertErr("Enter valid Stereo 70 values (metres)");
      return;
    }
    setConverting(true);
    try {
      const corner = await stereo70ToWgs84(northN, eastN);
      onSave(corner);
    } catch {
      setConvertErr(t("convertError"));
    } finally {
      setConverting(false);
    }
  };

  return (
    <tr className="bg-blue-50 dark:bg-blue-950/30">
      <td className="px-3 py-2 text-zinc-400 text-xs">—</td>

      {/* Mode tabs + inputs */}
      <td colSpan={2} className="px-3 py-2">
        <div className="flex flex-col gap-2">
          {/* Tab bar */}
          <div className="flex gap-1 text-xs">
            {(["DD", "STEREO70"] as InputMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setConvertErr(null); }}
                className={[
                  "rounded px-2 py-0.5 font-medium transition-colors",
                  mode === m
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
                ].join(" ")}
              >
                {m === "DD" ? t("inputDD") : t("inputStereo70")}
              </button>
            ))}
          </div>

          {mode === "DD" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5 text-xs">
                <span className="text-zinc-500">{t("lat")}</span>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="44.3756"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-0.5 text-xs">
                <span className="text-zinc-500">{t("lon")}</span>
                <input
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="25.9801"
                  className={inputCls}
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5 text-xs">
                <span className="text-zinc-500">{t("stereoN")}</span>
                <input
                  type="number"
                  step="any"
                  value={north}
                  onChange={(e) => setNorth(e.target.value)}
                  placeholder="332500"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-0.5 text-xs">
                <span className="text-zinc-500">{t("stereoE")}</span>
                <input
                  type="number"
                  step="any"
                  value={east}
                  onChange={(e) => setEast(e.target.value)}
                  placeholder="426200"
                  className={inputCls}
                />
              </label>
            </div>
          )}

          {convertErr && (
            <p className="text-xs text-red-600 dark:text-red-400">{convertErr}</p>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={converting}
            className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {converting ? t("converting") : t("save")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={converting}
            className="rounded border border-zinc-300 bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {t("cancel")}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main manager
// ---------------------------------------------------------------------------

export function CornersManager({ corners, onChange }: Props) {
  const t = useTranslations("property.corners");

  const [displayFmt,  setDisplayFmt]  = useState<DisplayFormat>("DD");
  const [adding,      setAdding]      = useState(false);
  const [editingIdx,  setEditingIdx]  = useState<number | null>(null);

  const handleAdd = (c: Corner) => {
    onChange([...corners, c]);
    setAdding(false);
  };

  const handleEdit = (idx: number, c: Corner) => {
    const next = corners.map((old, i) => (i === idx ? c : old));
    onChange(next);
    setEditingIdx(null);
  };

  const handleDelete = (idx: number) => {
    onChange(corners.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...corners];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };

  const moveDown = (idx: number) => {
    if (idx === corners.length - 1) return;
    const next = [...corners];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  };

  const cellCls = "px-3 py-2 text-sm";
  const monoLight = "font-mono text-xs text-zinc-600 dark:text-zinc-400";

  return (
    <div className="flex flex-col gap-2">
      {/* Display format toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Display:</span>
        {(["DD", "DMS"] as DisplayFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setDisplayFmt(f)}
            className={[
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              displayFmt === f
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
            ].join(" ")}
          >
            {f === "DD" ? t("formatDD") : t("formatDMS")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-2 w-10">{t("seq")}</th>
              <th className="px-3 py-2">{t("lat")}</th>
              <th className="px-3 py-2">{t("lon")}</th>
              <th className="px-3 py-2 w-40" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {corners.length === 0 && !adding && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-xs text-zinc-400">
                  {t("empty")}
                </td>
              </tr>
            )}

            {corners.map((c, idx) =>
              editingIdx === idx ? (
                <CornerInputRow
                  key={`edit-${idx}`}
                  initial={c}
                  onSave={(updated) => handleEdit(idx, updated)}
                  onCancel={() => setEditingIdx(null)}
                />
              ) : (
                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className={`${cellCls} text-zinc-400 tabular-nums`}>{idx + 1}</td>
                  <td className={`${cellCls} ${monoLight}`}>
                    {displayFmt === "DMS"
                      ? formatDMS(c.lat, true)
                      : fmtDD(c.lat)}
                  </td>
                  <td className={`${cellCls} ${monoLight}`}>
                    {displayFmt === "DMS"
                      ? formatDMS(c.lon, false)
                      : fmtDD(c.lon)}
                  </td>
                  <td className={`${cellCls} whitespace-nowrap`}>
                    <div className="flex gap-1 items-center">
                      <button
                        type="button"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        title="Move up"
                        className="px-1.5 py-0.5 text-xs rounded border border-zinc-200 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(idx)}
                        disabled={idx === corners.length - 1}
                        title="Move down"
                        className="px-1.5 py-0.5 text-xs rounded border border-zinc-200 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingIdx(idx); setAdding(false); }}
                        className="px-2 py-0.5 text-xs rounded border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(idx)}
                        className="px-2 py-0.5 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}

            {adding && (
              <CornerInputRow
                onSave={handleAdd}
                onCancel={() => setAdding(false)}
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Add button */}
      {!adding && editingIdx === null && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          + {t("add")}
        </button>
      )}
    </div>
  );
}
