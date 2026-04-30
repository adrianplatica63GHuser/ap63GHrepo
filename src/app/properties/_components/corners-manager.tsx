"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { decimalToDMS, dmsToDecimal, formatDMS } from "@/lib/geo/dms";
import type { Corner } from "./form-schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DisplayFormat = "DD" | "DMS" | "S70";
type InputMode    = "DD" | "DMS" | "STEREO70";

type Stereo70Point = { north: number; east: number };

type S70State = {
  loading: boolean;
  error:   boolean;
  values:  Stereo70Point[];
};

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

function fmtS70(v: number): string {
  return v.toFixed(2);
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

/** Stable string key derived from corner coordinates. */
function cornersToKey(corners: Corner[]): string {
  return corners.map((c) => c.lat + "," + c.lon).join("|");
}

async function wgs84ToStereo70Batch(corners: Corner[]): Promise<Stereo70Point[]> {
  const res = await fetch("/api/geo/convert", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      direction: "wgs84ToStereo70",
      points:    corners.map((c) => ({ lat: c.lat, lon: c.lon })),
    }),
  });
  if (!res.ok) throw new Error("Conversion failed");
  const data = await res.json();
  return data.points as Stereo70Point[];
}

// ---------------------------------------------------------------------------
// Inline add/edit row
// ---------------------------------------------------------------------------

function CornerInputRow({
  initial,
  initialMode = "DD",
  onSave,
  onCancel,
}: {
  initial?:     Corner;
  initialMode?: InputMode;
  onSave:       (c: Corner) => void;
  onCancel:     () => void;
}) {
  const t = useTranslations("property.corners");

  const [mode,       setMode]       = useState<InputMode>(initialMode);
  const [converting, setConverting] = useState(false);
  const [convertErr, setConvertErr] = useState<string | null>(null);

  // ── DD state ──────────────────────────────────────────────────────────────
  const [lat, setLat] = useState(initial ? String(initial.lat) : "");
  const [lon, setLon] = useState(initial ? String(initial.lon) : "");

  // ── DMS state — initialised from `initial` when opening in DMS mode ──────
  const initLatDms = initial ? decimalToDMS(initial.lat, true)  : null;
  const initLonDms = initial ? decimalToDMS(initial.lon, false) : null;
  const [latDeg, setLatDeg] = useState(initLatDms ? String(initLatDms.deg)              : "");
  const [latMin, setLatMin] = useState(initLatDms ? String(initLatDms.min)              : "");
  const [latSec, setLatSec] = useState(initLatDms ? initLatDms.sec.toFixed(2)           : "");
  const [latDir, setLatDir] = useState<"N" | "S">(initLatDms ? initLatDms.dir as "N" | "S" : "N");
  const [lonDeg, setLonDeg] = useState(initLonDms ? String(initLonDms.deg)              : "");
  const [lonMin, setLonMin] = useState(initLonDms ? String(initLonDms.min)              : "");
  const [lonSec, setLonSec] = useState(initLonDms ? initLonDms.sec.toFixed(2)           : "");
  const [lonDir, setLonDir] = useState<"E" | "W">(initLonDms ? initLonDms.dir as "E" | "W" : "E");

  // ── Stereo 70 state ───────────────────────────────────────────────────────
  const [north,          setNorth]          = useState("");
  const [east,           setEast]           = useState("");
  const [s70InitLoading, setS70InitLoading] = useState(
    // true only when editing an existing corner in S70 mode (values must be fetched)
    initialMode === "STEREO70" && !!initial,
  );

  // When editing an existing corner in S70 mode, convert the stored WGS84
  // values to Stereo 70 once on mount so the fields are pre-populated.
  useEffect(() => {
    if (initialMode !== "STEREO70" || !initial) return;
    let cancelled = false;
    wgs84ToStereo70Batch([initial])
      .then((pts) => {
        if (cancelled) return;
        const pt = pts[0];
        if (pt) {
          setNorth(pt.north.toFixed(2));
          setEast(pt.east.toFixed(2));
        }
      })
      .catch(() => { /* leave empty; user will see blank fields and can type */ })
      .finally(() => { if (!cancelled) setS70InitLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  const inputCls =
    "rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950 focus:outline-none focus:border-zinc-500 w-full";

  const dirBtn = (active: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded px-1.5 py-0.5 text-xs font-semibold border transition-colors",
        active
          ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
          : "bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:border-zinc-700 dark:hover:bg-zinc-800",
      ].join(" ")}
    >
      {label}
    </button>
  );

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

    if (mode === "DMS") {
      const dN = parseInt(latDeg), mN = parseInt(latMin), sN = parseFloat(latSec);
      const dE = parseInt(lonDeg), mE = parseInt(lonMin), sE = parseFloat(lonSec);
      if ([dN, mN, sN, dE, mE, sE].some(isNaN)) {
        setConvertErr("Enter valid degrees, minutes, and seconds");
        return;
      }
      const latDD = dmsToDecimal({ deg: dN, min: mN, sec: sN });
      const lonDD = dmsToDecimal({ deg: dE, min: mE, sec: sE });
      onSave({
        lat: latDir === "N" ? latDD : -latDD,
        lon: lonDir === "E" ? lonDD : -lonDD,
      });
      return;
    }

    // STEREO70
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

      <td colSpan={2} className="px-3 py-2">
        <div className="flex flex-col gap-2">
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
          ) : mode === "DMS" ? (
            <div className="flex flex-col gap-1.5">
              {/* Latitude row */}
              <div className="flex items-center gap-1 text-xs">
                <span className="w-16 shrink-0 text-zinc-500">{t("lat")}</span>
                <input type="number" min={0} max={90}     step={1}   value={latDeg} onChange={(e) => setLatDeg(e.target.value)} placeholder="44"    className={inputCls + " w-10"} />
                <span className="text-zinc-400">°</span>
                <input type="number" min={0} max={59}     step={1}   value={latMin} onChange={(e) => setLatMin(e.target.value)} placeholder="24"    className={inputCls + " w-10"} />
                <span className="text-zinc-400">′</span>
                <input type="number" min={0} max={59.999} step="any" value={latSec} onChange={(e) => setLatSec(e.target.value)} placeholder="59.40" className={inputCls + " w-16"} />
                <span className="text-zinc-400">″</span>
                <div className="flex gap-0.5 ml-1">
                  {dirBtn(latDir === "N", () => setLatDir("N"), "N")}
                  {dirBtn(latDir === "S", () => setLatDir("S"), "S")}
                </div>
              </div>
              {/* Longitude row */}
              <div className="flex items-center gap-1 text-xs">
                <span className="w-16 shrink-0 text-zinc-500">{t("lon")}</span>
                <input type="number" min={0} max={180}    step={1}   value={lonDeg} onChange={(e) => setLonDeg(e.target.value)} placeholder="25"    className={inputCls + " w-10"} />
                <span className="text-zinc-400">°</span>
                <input type="number" min={0} max={59}     step={1}   value={lonMin} onChange={(e) => setLonMin(e.target.value)} placeholder="57"    className={inputCls + " w-10"} />
                <span className="text-zinc-400">′</span>
                <input type="number" min={0} max={59.999} step="any" value={lonSec} onChange={(e) => setLonSec(e.target.value)} placeholder="52.20" className={inputCls + " w-16"} />
                <span className="text-zinc-400">″</span>
                <div className="flex gap-0.5 ml-1">
                  {dirBtn(lonDir === "E", () => setLonDir("E"), "E")}
                  {dirBtn(lonDir === "W", () => setLonDir("W"), "W")}
                </div>
              </div>
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
                  placeholder={s70InitLoading ? t("converting") : "332500"}
                  disabled={s70InitLoading}
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
                  placeholder={s70InitLoading ? t("converting") : "426200"}
                  disabled={s70InitLoading}
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
// Helpers
// ---------------------------------------------------------------------------

/** Map the list's current display format to the matching input mode. */
function displayFmtToInputMode(fmt: DisplayFormat): InputMode {
  if (fmt === "S70")  return "STEREO70";
  if (fmt === "DMS")  return "DMS";
  return "DD";
}

// ---------------------------------------------------------------------------
// Main manager
// ---------------------------------------------------------------------------

export function CornersManager({ corners, onChange }: Props) {
  const t = useTranslations("property.corners");

  const [displayFmt,  setDisplayFmt]  = useState<DisplayFormat>("DD");
  const [adding,      setAdding]      = useState(false);
  const [editingIdx,  setEditingIdx]  = useState<number | null>(null);
  const [s70State,    setS70State]    = useState<S70State>({ loading: false, error: false, values: [] });

  const cornersKey = cornersToKey(corners);

  useEffect(() => {
    if (displayFmt !== "S70") return;
    if (corners.length === 0) {
      setS70State({ loading: false, error: false, values: [] });
      return;
    }

    let cancelled = false;
    setS70State({ loading: true, error: false, values: [] });

    wgs84ToStereo70Batch(corners)
      .then((values) => {
        if (!cancelled) setS70State({ loading: false, error: false, values });
      })
      .catch(() => {
        if (!cancelled) setS70State({ loading: false, error: true, values: [] });
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayFmt, cornersKey]);

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

  const cellCls   = "px-3 py-2 text-sm";
  const monoLight = "font-mono text-xs text-zinc-600 dark:text-zinc-400";

  const col1Label = displayFmt === "S70" ? t("stereoN") : t("lat");
  const col2Label = displayFmt === "S70" ? t("stereoE") : t("lon");

  const fmtLabel: Record<DisplayFormat, string> = {
    DD:  t("formatDD"),
    DMS: t("formatDMS"),
    S70: t("formatStereo70"),
  };

  const showS70Loading = displayFmt === "S70" && s70State.loading;
  const showS70Error   = displayFmt === "S70" && s70State.error;

  const col1Values = corners.map((c, idx) => {
    if (displayFmt === "DD")  return fmtDD(c.lat);
    if (displayFmt === "DMS") return formatDMS(c.lat, true);
    if (s70State.loading)     return "…";
    if (s70State.error)       return "—";
    return fmtS70(s70State.values[idx]?.north ?? 0);
  });
  const col2Values = corners.map((c, idx) => {
    if (displayFmt === "DD")  return fmtDD(c.lon);
    if (displayFmt === "DMS") return formatDMS(c.lon, false);
    if (s70State.loading)     return "…";
    if (s70State.error)       return "—";
    return fmtS70(s70State.values[idx]?.east ?? 0);
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Display:</span>
        {(["DD", "DMS", "S70"] as DisplayFormat[]).map((f) => (
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
            {fmtLabel[f]}
          </button>
        ))}
        {showS70Loading && <span className="text-xs text-zinc-400 animate-pulse">Converting...</span>}
        {showS70Error   && <span className="text-xs text-red-500">{t("convertError")}</span>}
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-2 w-10">{t("seq")}</th>
              <th className="px-3 py-2">{col1Label}</th>
              <th className="px-3 py-2">{col2Label}</th>
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
                  key={"edit-" + idx}
                  initial={c}
                  initialMode={displayFmtToInputMode(displayFmt)}
                  onSave={(updated) => handleEdit(idx, updated)}
                  onCancel={() => setEditingIdx(null)}
                />
              ) : (
                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className={cellCls + " text-zinc-400 tabular-nums"}>{idx + 1}</td>
                  <td className={cellCls + " " + monoLight}>{col1Values[idx]}</td>
                  <td className={cellCls + " " + monoLight}>{col2Values[idx]}</td>
                  <td className={cellCls + " whitespace-nowrap"}>
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
                initialMode={displayFmtToInputMode(displayFmt)}
                onSave={handleAdd}
                onCancel={() => setAdding(false)}
              />
            )}
          </tbody>
        </table>
      </div>

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
