"use client";

import { useState, useEffect } from "react";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
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
import { screenPanel, stepGridStyle, type ColumnName } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";
// Pure, and the same rule the server applies: a drop is a swap (Ask first 2).
import { swapped } from "@/lib/calculation/geometry";
import type { FileProblem } from "@/lib/calculation/parse";

/**
 * „Calcul drum lateral", steps 1 and 2                            (Slice #38.23)
 *
 * Step 1 is the file picker, with the text above it describing the three-section
 * file. Step 2: the parcel drawn from its numbered corners, cut into one slice
 * per owner in a random order, which the user rearranges by dropping one slice
 * on another — or, from the keyboard, with ↑ ↓ in the owners' table. The road
 * (step 3) is #38.24; „Creează proprietățile" is #38.25, so this screen offers
 * no commit until then (Ask first 1).
 *
 * The geometry is the server's: every change of order posts the file's text
 * and the new order to /api/calculation/preview and draws what comes back.
 *
 * Slice #37.35: the calculation is one tile of 7 units — it holds the 6-unit
 * map (rule 20), the figures' grid (four L) and the owners' table.
 */
const CALC_UNITS = 7;

/** The owners' slices: order, name, share, area, and ↑ ↓. 38.24 adds the road's columns. */
const OWNER_COLUMNS: readonly ColumnName[] = ["count", "personName", "percent", "area", "feOrder"];

// ---------------------------------------------------------------------------
// Types (mirror src/lib/calculation/compute.ts — redeclared so this client
// module never imports the server-only compute file)
// ---------------------------------------------------------------------------

type Corner = { lat: number; lon: number; north: number; east: number };

type Slice = {
  owner: number;
  name: string;
  percent: number;
  targetArea: number;
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
  slices: Slice[];
};

type PreviewAnswer =
  | { kind: "ok"; computation: Computation }
  | { kind: "rejected"; problems: FileProblem[] };

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
  const [reordering, setReordering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  /** What the last reorder did, for the screen reader (aria-live). */
  const [announcement, setAnnouncement] = useState("");

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
  }

  async function preview(text: string, order?: number[]): Promise<PreviewAnswer> {
    const res = await fetch("/api/calculation/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order ? { text, order } : { text }),
    });
    if (res.redirected) throw new Error(t("errors.session"));
    const data = (await res.json().catch(() => ({}))) as {
      computation?: Computation;
      problems?: FileProblem[];
      error?: string;
    };
    if (res.ok && data.computation) return { kind: "ok", computation: data.computation };
    if (Array.isArray(data.problems)) return { kind: "rejected", problems: data.problems };
    throw new Error(data.error ?? `Error ${res.status}`);
  }

  /** Step 1 → 2: read the file; the server picks the random first order. */
  async function readFile(text: string) {
    setPreviewing(true);
    setPreviewError(null);
    setProblems(null);
    setComputation(null);
    setAnnouncement("");
    try {
      const answer = await preview(text);
      if (answer.kind === "ok") setComputation(answer.computation);
      else setProblems(answer.problems);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  }

  /** Swap the slices at positions a and b; the map keeps showing the old cut until the new one arrives. */
  async function swap(a: number, b: number) {
    if (!fileText || !computation || reordering) return;
    if (a < 0 || b < 0 || a >= computation.order.length || b >= computation.order.length || a === b) return;
    const names = [computation.slices[a].name, computation.slices[b].name];
    setReordering(true);
    setPreviewError(null);
    try {
      const answer = await preview(fileText, swapped(computation.order, a, b));
      if (answer.kind === "ok") {
        setComputation(answer.computation);
        setAnnouncement(t("map.swapped", { a: names[0], b: names[1] }));
      } else {
        setProblems(answer.problems);
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setReordering(false);
    }
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

  const lastName = computation?.slices[computation.slices.length - 1]?.name ?? "";

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
          {/* Step 2 — the map: numbered corners, named slices, drag to swap */}
          <PreviewMap
            bigPolygon={computation.corners}
            numberedCorners={computation.corners}
            owners={computation.slices.map((s) => ({ label: s.name, corners: s.corners }))}
            onSwap={(a, b) => void swap(a, b)}
            label={t("map.label")}
          />
          <div className="flex items-center gap-2 text-xs text-fade dark:text-zinc-400">
            <span>{t("map.dragHint")}</span>
            <HelpHint hintKey="calc-preview-not-saved" />
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {reordering ? t("status.recomputing") : announcement}
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
                  <th className="px-3 py-2 text-right" {...columnHead("area")}>{t("table.area")}</th>
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
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtArea(s.area)}</td>
                    <td className="px-2 py-1">
                      <span className="flex gap-1">
                        {/* #37.45 (A068)'s ArrowUp / ArrowDown, as in the form editor. */}
                        <IconButton
                          icon={ArrowUp}
                          label={t("table.moveUp", { name: s.name })}
                          variant="secondary"
                          size="xs"
                          onClick={() => void swap(i, i - 1)}
                          disabled={reordering || i === 0}
                        />
                        <IconButton
                          icon={ArrowDown}
                          label={t("table.moveDown", { name: s.name })}
                          variant="secondary"
                          size="xs"
                          onClick={() => void swap(i, i + 1)}
                          disabled={reordering || i === computation.slices.length - 1}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
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
