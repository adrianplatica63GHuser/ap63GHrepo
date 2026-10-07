"use client";

import { useState, useEffect } from "react";
import { ArrowDown, ArrowUp, RotateCcw, Route } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PreviewMap } from "./preview-map";
import { HelpHint } from "@/components/help/help-hint";
// Slice #34.20 — the coordinate picker's offer, named once for the two
// screens that make it. See `picker-accept.ts` for why it is not derived
// from the file-kind registry.
// Slice #34.23 — and the list the sentence beside it names, derived from that
// same value so the copy cannot outlive it.
import { COORDINATE_FILE_ACCEPT, COORDINATE_FILE_OFFER } from "@/lib/files/picker-accept";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { screenBox, screenPanel, stepGridStyle, tableUnits, type ColumnName } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";
// Pure, and the same rule the server applies: a drop is a swap (Ask first 2).
import { swapped, type RoadRefusal, type RoadSide } from "@/lib/calculation/geometry";
import type { FileProblem } from "@/lib/calculation/parse";

/**
 * „Calcul drum lateral", steps 1 to 3                       (Slices #38.23, #38.24)
 *
 * Step 1 is the file picker, with the text above it describing the three-section
 * file. Step 2: the parcel drawn from its numbered corners, cut into one slice
 * per owner in a random order, which the user rearranges by dropping one slice
 * on another — or, from the keyboard, with ↑ ↓ in the owners' table. Step 3
 * (#38.24): a click on a corner, then on one of its two sides, lays the road
 * along that side; the slices turn to meet it, and the order can still be
 * changed with the road in place. The two select boxes under the prompt are
 * the same two clicks from the keyboard. „Creează proprietățile" is #38.25.
 *
 * The geometry is the server's: every change posts the file's text, the order
 * and the road's corner and side to /api/calculation/preview and draws what
 * comes back. A road that cannot be built comes back as a refusal and is never
 * drawn.
 */

/**
 * The owners' figures (#38.24): order, name, share; then share × parcel, the
 * road share, the slice itself, the two together, and the difference from
 * share × parcel, which reads 0,00; and ↑ ↓.
 */
const OWNER_COLUMNS: readonly ColumnName[] = [
  "count",
  "personName",
  "percent",
  "area",
  "area",
  "area",
  "area",
  "percent",
  "feOrder",
];

/**
 * Slice #37.35: the calculation is one tile — the 6-unit map (rule 20), the
 * figures' grid and the owners' table. #38.24's table is the widest piece, so
 * the tile is as wide as it („a view is as wide as its widest fixed piece").
 */
const CALC_UNITS = Math.max(7, tableUnits(OWNER_COLUMNS));

// ---------------------------------------------------------------------------
// Types (mirror src/lib/calculation/compute.ts — redeclared so this client
// module never imports the server-only compute file)
// ---------------------------------------------------------------------------

type Corner = { lat: number; lon: number; north: number; east: number };

type Slice = {
  owner: number;
  name: string;
  percent: number;
  fraction: number;
  originalArea: number;
  roadShare: number;
  targetArea: number;
  area: number;
  corners: Corner[];
};

type Road = {
  corner: number;
  cornerNumber: string;
  side: RoadSide;
  from: string;
  to: string;
  width: number;
  length: number;
  area: number;
  corners: Corner[];
};

type Computation = {
  corners: (Corner & { number: string })[];
  sides: { from: string; to: string; length: number }[];
  parcelArea: number;
  roadWidth: number;
  percentTotal: number;
  remainderToLast: boolean;
  order: number[];
  road: Road | null;
  slices: Slice[];
};

type Refusal = RoadRefusal & { name?: string };

type PreviewAnswer =
  | { kind: "ok"; computation: Computation }
  | { kind: "rejected"; problems: FileProblem[] }
  | { kind: "refused"; refusal: Refusal };

/** Where step 3 stands: choosing the corner, then the side; or the road is laid. */
type RoadStep =
  | { phase: "corner" }
  | { phase: "side"; corner: number }
  | { phase: "set"; corner: number; side: RoadSide };

// ---------------------------------------------------------------------------
// Re-run payload  (Slice #20.09)
// ---------------------------------------------------------------------------

/**
 * „Istoricul calculelor" → a run → „Reia" puts the run's file here. A run
 * stored before #38.23 holds the five-section file, which this screen now
 * rejects with its reasons; #38.25 settles how the history treats old runs.
 */
type RerunPayload = { text: string };

/** Read + consume the calc_rerun sessionStorage entry on the client side. */
function consumeRerunPayload(isRerun: boolean): RerunPayload | null {
  if (!isRerun) return null;
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("calc_rerun");
  if (!raw) return null;
  sessionStorage.removeItem("calc_rerun");
  try {
    const parsed = JSON.parse(raw) as { text?: unknown };
    return typeof parsed.text === "string" ? { text: parsed.text } : null;
  } catch {
    return null;
  }
}

/** The side a corner's road runs along, as an index into `sides`: side i joins corner i to i + 1. */
function sideIndex(corner: number, side: RoadSide, n: number): number {
  return side === "next" ? corner : (corner + n - 1) % n;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The id joining this screen's picker to the sentence describing it.
 *                                                              (Slice #34.23)
 *
 * A constant rather than a literal in two places, for the ordinary reason: an
 * `aria-describedby` pointing at an id that no longer exists is silent, both to
 * the user and to every test that does not go looking for it.
 */
const COORDINATE_PICKER_OFFER_ID = "calculation-coordinate-picker-offer";

export function CalculationView() {
  const t = useTranslations("calculation");
  const format = useFormatter();
  // Slice #34.23 — the picker sentence is `shared` because two screens make the
  // same offer; see `picker-accept.ts`.
  const tShared = useTranslations("shared");
  // In the application's language, like the shares beside them (#38.23).
  const fmtArea = (n: number) => format.number(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtLen = (n: number) => format.number(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // „-0,00" is a rounding's sign, not a difference.
  const fmtDiff = (n: number) => fmtArea(Math.abs(n) < 0.005 ? 0 : n);
  const searchParams = useSearchParams();

  // Slice #20.09: parse a re-run payload from sessionStorage during the first
  // render (lazy initializer) — avoids calling setState synchronously inside
  // an effect, which triggers the react-hooks/set-state-in-effect lint error.
  const [rerunPayload] = useState<RerunPayload | null>(() =>
    consumeRerunPayload(searchParams.get("rerun") === "1"),
  );

  const [fileName, setFileName] = useState<string | null>(rerunPayload ? t("rerun.fileName") : null);
  const [fileText, setFileText] = useState<string | null>(rerunPayload?.text ?? null);

  const [computation, setComputation] = useState<Computation | null>(null);
  const [problems, setProblems] = useState<FileProblem[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  /** What the last reorder did, for the screen reader (aria-live). */
  const [announcement, setAnnouncement] = useState("");
  const [roadStep, setRoadStep] = useState<RoadStep>({ phase: "corner" });
  /** Why the last click or reorder was refused (#38.24). */
  const [roadMessage, setRoadMessage] = useState<string | null>(null);

  // Kick off preview automatically when re-running — the effect only calls the
  // async function; no setState calls in the effect body.
  useEffect(() => {
    if (rerunPayload) void readFile(rerunPayload.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetAll() {
    setFileName(null);
    setFileText(null);
    setComputation(null);
    setProblems(null);
    setPreviewError(null);
    setAnnouncement("");
    setRoadStep({ phase: "corner" });
    setRoadMessage(null);
  }

  async function preview(
    text: string,
    order?: number[],
    road?: { corner: number; side: RoadSide },
  ): Promise<PreviewAnswer> {
    const res = await fetch("/api/calculation/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...(order ? { order } : {}), ...(road ? { road } : {}) }),
    });
    if (res.redirected) throw new Error(t("errors.session"));
    const data = (await res.json().catch(() => ({}))) as {
      computation?: Computation;
      problems?: FileProblem[];
      refusal?: Refusal;
      error?: string;
    };
    if (res.ok && data.computation) return { kind: "ok", computation: data.computation };
    if (Array.isArray(data.problems)) return { kind: "rejected", problems: data.problems };
    if (data.refusal) return { kind: "refused", refusal: data.refusal };
    throw new Error(data.error ?? `Error ${res.status}`);
  }

  /** Step 1 → 2: read the file; the server picks the random first order. */
  async function readFile(text: string) {
    setPreviewing(true);
    setPreviewError(null);
    setProblems(null);
    setComputation(null);
    setAnnouncement("");
    setRoadStep({ phase: "corner" });
    setRoadMessage(null);
    try {
      const answer = await preview(text);
      if (answer.kind === "ok") setComputation(answer.computation);
      else if (answer.kind === "rejected") setProblems(answer.problems);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  }

  /**
   * Ask for an order and a road; draw it, or say why not. The map keeps the
   * last good drawing until the answer arrives — and when the answer is a
   * refusal, it keeps it for good.
   */
  async function recompute(
    order: number[],
    road: { corner: number; side: RoadSide } | undefined,
  ): Promise<{ ok: true; computation: Computation } | { ok: false }> {
    if (!fileText) return { ok: false };
    setBusy(true);
    setPreviewError(null);
    try {
      const answer = await preview(fileText, order, road);
      if (answer.kind === "ok") {
        setComputation(answer.computation);
        return { ok: true, computation: answer.computation };
      }
      if (answer.kind === "rejected") setProblems(answer.problems);
      else setRoadMessage(refusalText(answer.refusal, road));
      return { ok: false };
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  const laidRoad = roadStep.phase === "set" ? { corner: roadStep.corner, side: roadStep.side } : undefined;

  /** Swap the slices at positions a and b; with a road laid, it keeps its corner and side. */
  async function swap(a: number, b: number) {
    if (!computation || busy) return;
    if (a < 0 || b < 0 || a >= computation.order.length || b >= computation.order.length || a === b) return;
    const names = [computation.slices[a].name, computation.slices[b].name];
    setRoadMessage(null);
    const result = await recompute(swapped(computation.order, a, b), laidRoad);
    if (result.ok) setAnnouncement(t("map.swapped", { a: names[0], b: names[1] }));
  }

  /** Step 3, first click: the corner. Another corner may be picked until the side is. */
  function pickCorner(corner: number) {
    if (roadStep.phase === "set" || busy) return;
    setRoadMessage(null);
    setRoadStep({ phase: "side", corner });
  }

  /** Step 3, second click: side i of the parcel — it must be one of the chosen corner's two. */
  async function pickSide(side: number) {
    if (!computation || roadStep.phase !== "side" || busy) return;
    const n = computation.corners.length;
    const corner = roadStep.corner;
    const roadSide: RoadSide | null = side === corner ? "next" : (side + 1) % n === corner ? "previous" : null;
    if (!roadSide) {
      setRoadMessage(
        t("road.wrongSide", {
          side: sideName(side),
          corner: computation.corners[corner].number,
          a: sideName(sideIndex(corner, "next", n)),
          b: sideName(sideIndex(corner, "previous", n)),
        }),
      );
      return;
    }
    setRoadMessage(null);
    const result = await recompute(computation.order, { corner, side: roadSide });
    if (result.ok) setRoadStep({ phase: "set", corner, side: roadSide });
  }

  /** „Alege alt drum": back to choosing the corner, the order kept. */
  async function chooseAnotherRoad() {
    if (!computation || busy) return;
    setRoadMessage(null);
    setRoadStep({ phase: "corner" });
    await recompute(computation.order, undefined);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    setFileText(text);
    await readFile(text);
  }

  /** „121–122": side i, by the numbers of its two corners. */
  function sideName(i: number): string {
    const s = computation?.sides[i];
    return s ? `${s.from}–${s.to}` : "";
  }

  /** One rejection, in the screen's language. */
  function problemText(p: FileProblem): string {
    const pct = (n: number) => format.number(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const metres = (n: number) => format.number(n, { maximumFractionDigits: 2 });
    switch (p.code) {
      case "missingSection":
      case "repeatedSection":
        return t(`problems.${p.code}`, { section: t(`problems.section.${p.values.section}`) });
      case "cornerCount":
      case "ownerCount":
      case "widthCount":
        return t(`problems.${p.code}`, { count: p.values.count });
      case "repeatedCorner":
        return t("problems.repeatedCorner", { number: p.values.number });
      case "cornersCross":
        return t("problems.cornersCross");
      case "percentTotal":
        return t("problems.percentTotal", { total: pct(p.values.total) });
      case "roadWidth":
        return t("problems.roadWidth", { width: metres(p.values.width) });
      case "unreadableLine":
        return t("problems.unreadableLine", {
          lineNumber: p.values.lineNumber,
          line: p.values.line,
          expected: t(`problems.expected.${p.values.section}`),
        });
    }
  }

  /** Why a road cannot be built, in the screen's language (#38.24). */
  function refusalText(r: Refusal, road: { corner: number; side: RoadSide } | undefined): string {
    const n = computation?.corners.length ?? 4;
    const side = road ? sideName(sideIndex(road.corner, road.side, n)) : "";
    const width = fmtLen(computation?.roadWidth ?? 0);
    switch (r.code) {
      case "roadTooLong":
        return t("road.refusal.roadTooLong", { side, length: fmtLen(r.values.length), sideLength: fmtLen(r.values.side) });
      case "roadLeavesParcel":
        return t("road.refusal.roadLeavesParcel", { side, width });
      case "ownerMissesRoad":
        return t("road.refusal.ownerMissesRoad", { side, name: r.name ?? "" });
      case "noRoom":
        return t("road.refusal.noRoom", { side, width });
    }
  }

  const lastName = computation?.slices[computation.slices.length - 1]?.name ?? "";
  const n = computation?.corners.length ?? 4;
  const offeredSides =
    roadStep.phase === "side" ? [sideIndex(roadStep.corner, "next", n), sideIndex(roadStep.corner, "previous", n)] : [];

  const prompt = !computation
    ? ""
    : roadStep.phase === "corner"
      ? t("road.promptCorner")
      : roadStep.phase === "side"
        ? t("road.promptSide", {
            corner: computation.corners[roadStep.corner].number,
            a: sideName(offeredSides[0]),
            b: sideName(offeredSides[1]),
          })
        : t("road.promptSet", {
            corner: computation.corners[roadStep.corner].number,
            side: sideName(sideIndex(roadStep.corner, roadStep.side, n)),
          });

  const totals = computation
    ? computation.slices.reduce(
        (s, x) => ({
          percent: s.percent + x.percent,
          originalArea: s.originalArea + x.originalArea,
          roadShare: s.roadShare + x.roadShare,
          area: s.area + x.area,
        }),
        { percent: 0, originalArea: 0, roadShare: 0, area: 0 },
      )
    : null;

  return (
    <UnitRow units={[CALC_UNITS]}>
    <section {...screenPanel("calculation", CALC_UNITS)} className="flex flex-col gap-5 rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Step 1 — what the file is (#38.23: three sections, three rules) */}
      <div className="flex flex-col gap-1 text-sm text-fade dark:text-zinc-400">
        <p>{t("intro.lead")}</p>
        <ul className="list-disc pl-5">
          <li>{t("intro.corners")}</li>
          <li>{t("intro.owners")}</li>
          <li>{t("intro.width")}</li>
        </ul>
        <p>{t("intro.then")}</p>
      </div>

      {/* Upload */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d">
          {t("buttons.chooseFile")}
          <input
            type="file"
            accept={COORDINATE_FILE_ACCEPT}
            onChange={handleFile}
            className="sr-only"
            // Slice #34.23 — the input is `sr-only`, and its accessible name
            // is the button text of the `<label>` wrapping it and NOTHING
            // else; a paragraph sitting beside it is invisible to the one user
            // most likely to be lost in a file dialog. `aria-describedby` is
            // what makes the sentence part of the control. (In
            // `add-property-dialog.tsx` the name comes from an `aria-label`
            // instead, and the same argument applies — do NOT add one here,
            // where it would override the label text.)
            aria-describedby={COORDINATE_PICKER_OFFER_ID}
          />
        </label>
        <HelpHint hintKey="calc-file-format" />
        {fileName && (
          <span className="text-xs text-fade dark:text-zinc-400">{fileName}</span>
        )}
        {(computation || fileName) && (
          <IconButton
            icon={RotateCcw}
            label={t("buttons.reset")}
            variant="secondary"
            size="sm"
            onClick={resetAll}
          />
        )}
      </div>

      {/*
        Slice #34.23 — what the file window will and will not show. Worded as
        what the WINDOW shows, never as what this screen accepts: `accept`
        filters a dialog and decides nothing about the parse. See
        `picker-accept.ts`.
      */}
      <p
        id={COORDINATE_PICKER_OFFER_ID}
        className="text-xs text-fade dark:text-zinc-400"
        role="note"
      >
        {tShared("filePicker.offersExtensions", { list: COORDINATE_FILE_OFFER })}
      </p>

      {previewing && (
        <p className="text-sm text-fade dark:text-zinc-400" role="status">{t("status.computing")}</p>
      )}
      {previewError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {previewError}
        </p>
      )}

      {/* A rejected file: every reason at once (#38.23) */}
      {problems && (
        <div role="alert" data-panel="file-problems" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">{t("problems.title")}</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p, i) => (
              <li key={i}>{problemText(p)}</li>
            ))}
          </ul>
        </div>
      )}

      {computation && (
        <>
          {/* Step 3 — what the next click is, always (#38.24) */}
          <div data-panel="road-step" className="flex flex-col gap-2 rounded-md border border-card-rim bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-medium text-ink dark:text-zinc-100">{t("road.title")}</p>
            <p role="status" aria-live="polite" className="text-ink dark:text-zinc-200">{prompt}</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-fade dark:text-zinc-400">
                {t("road.cornerLabel")}
                <select
                  {...screenBox("calcRoadCorner")}
                  value={roadStep.phase === "corner" ? "" : String(roadStep.corner)}
                  onChange={(e) => e.target.value !== "" && pickCorner(Number(e.target.value))}
                  disabled={roadStep.phase === "set" || busy}
                  className="rounded-md border border-wire bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="" data-blank="">{t("road.choose")}</option>
                  {computation.corners.map((c, i) => (
                    <option key={c.number} value={String(i)}>{c.number}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-fade dark:text-zinc-400">
                {t("road.sideLabel")}
                <select
                  {...screenBox("calcRoadSide")}
                  value={roadStep.phase === "set" ? String(sideIndex(roadStep.corner, roadStep.side, n)) : ""}
                  onChange={(e) => e.target.value !== "" && void pickSide(Number(e.target.value))}
                  disabled={roadStep.phase !== "side" || busy}
                  className="rounded-md border border-wire bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="" data-blank="">{t("road.choose")}</option>
                  {(roadStep.phase === "set" ? [sideIndex(roadStep.corner, roadStep.side, n)] : offeredSides).map((i) => (
                    <option key={i} value={String(i)}>{sideName(i)}</option>
                  ))}
                </select>
              </label>
              {roadStep.phase === "set" && (
                <IconButton
                  icon={Route}
                  label={t("road.another")}
                  variant="secondary"
                  size="sm"
                  onClick={() => void chooseAnotherRoad()}
                  disabled={busy}
                />
              )}
            </div>
            {roadMessage && (
              <p role="alert" data-panel="road-refusal" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                {roadMessage}
              </p>
            )}
          </div>

          {/* The map: numbered corners, named slices, the road; drag to swap */}
          <PreviewMap
            bigPolygon={computation.corners}
            numberedCorners={computation.corners}
            owners={computation.slices.map((s) => ({ label: s.name, corners: s.corners }))}
            road={computation.road?.corners ?? []}
            // While the side is chosen, the slices leave the mouse to the map's click.
            onSwap={roadStep.phase === "side" ? undefined : (a, b) => void swap(a, b)}
            onCornerClick={roadStep.phase === "set" ? undefined : pickCorner}
            onSideClick={roadStep.phase === "side" ? (i) => void pickSide(i) : undefined}
            chosenCorner={roadStep.phase === "corner" ? null : roadStep.corner}
            offeredSides={offeredSides}
            label={t("map.label")}
          />
          <div className="flex items-center gap-2 text-xs text-fade dark:text-zinc-400">
            <span>{t("map.dragHint")}</span>
            <HelpHint hintKey="calc-preview-not-saved" />
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {busy ? t("status.recomputing") : announcement}
          </p>

          {/* The figures */}
          <div className="text-sm" style={stepGridStyle("L", 4)}>
            <Stat label={t("figures.parcelArea")} value={`${fmtArea(computation.parcelArea)} m²`} />
            <Stat label={t("figures.roadWidth")} value={`${fmtLen(computation.roadWidth)} m`} />
            {computation.sides.map((s) => (
              <Stat
                key={`${s.from}-${s.to}`}
                label={t("figures.side", { from: s.from, to: s.to })}
                value={`${fmtLen(s.length)} m`}
              />
            ))}
            {computation.road && (
              <>
                <Stat label={t("figures.roadCorner")} value={computation.road.cornerNumber} />
                <Stat label={t("figures.roadSide")} value={`${computation.road.from}–${computation.road.to}`} />
                <Stat label={t("figures.roadLength")} value={`${fmtLen(computation.road.length)} m`} />
                <Stat label={t("figures.roadArea")} value={`${fmtArea(computation.road.area)} m²`} />
              </>
            )}
          </div>

          {/* The owners' slices, in order — with the keyboard's reorder */}
          <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}>
            <table {...fixedTable(OWNER_COLUMNS)}>
              <FixedColumns columns={OWNER_COLUMNS} />
              <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-right" {...columnHead("count")}>{t("table.order")}</th>
                  <th className="px-3 py-2" {...columnHead("personName")}>{t("table.owner")}</th>
                  <th className="px-3 py-2 text-right" {...columnHead("percent")}>{t("table.percent")}</th>
                  <th className="px-3 py-2 text-right" {...columnHead("area")}>{t("table.originalArea")}</th>
                  <th className="px-3 py-2 text-right" {...columnHead("area")}>{t("table.roadShare")}</th>
                  <th className="px-3 py-2 text-right" {...columnHead("area")}>{t("table.ownArea")}</th>
                  <th className="px-3 py-2 text-right" {...columnHead("area")}>{t("table.sum")}</th>
                  <th className="px-3 py-2 text-right" {...columnHead("percent")}>{t("table.difference")}</th>
                  <th className="px-3 py-2" {...columnHead("feOrder")}>{t("table.move")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crease dark:divide-zinc-800">
                {computation.slices.map((s, i) => (
                  <tr key={s.owner}>
                    <td className="px-3 py-2 text-right tabular-nums">{i + 1}</td>
                    <td className={`px-3 py-2 text-ink dark:text-zinc-200 ${WRAPS}`}>{s.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {format.number(s.percent, { maximumFractionDigits: 3 })}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtArea(s.originalArea)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtArea(s.roadShare)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtArea(s.area)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtArea(s.area + s.roadShare)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtDiff(s.area + s.roadShare - s.originalArea)}</td>
                    <td className="px-2 py-1">
                      <span className="flex gap-1">
                        {/* #37.45 (A068)'s ArrowUp / ArrowDown, as in the form editor. */}
                        <IconButton
                          icon={ArrowUp}
                          label={t("table.moveUp", { name: s.name })}
                          variant="secondary"
                          size="xs"
                          onClick={() => void swap(i, i - 1)}
                          disabled={busy || i === 0}
                        />
                        <IconButton
                          icon={ArrowDown}
                          label={t("table.moveDown", { name: s.name })}
                          variant="secondary"
                          size="xs"
                          onClick={() => void swap(i, i + 1)}
                          disabled={busy || i === computation.slices.length - 1}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot className="border-t border-crease font-medium dark:border-zinc-800">
                  <tr>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-ink dark:text-zinc-200">{t("table.total")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {format.number(totals.percent, { maximumFractionDigits: 3 })}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtArea(totals.originalArea)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtArea(totals.roadShare)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtArea(totals.area)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtArea(totals.area + totals.roadShare)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtDiff(totals.area + totals.roadShare - totals.originalArea)}
                    </td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {computation.remainderToLast && (
            <p className="text-xs text-fade dark:text-zinc-400">{t("remainder", { name: lastName })}</p>
          )}
        </>
      )}
    </section>
    </UnitRow>
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
