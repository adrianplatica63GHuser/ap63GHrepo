"use client";

import { useState, useEffect } from "react";
import { ArrowDown, ArrowUp, History, PackagePlus, Pencil, RotateCcw, Route, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useNameOr } from "@/components/record/use-name-or";
import { OwnerSwatch, PreviewMap } from "./preview-map";
import { HelpHint } from "@/components/help/help-hint";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { screenBox, screenPanel, stepGridStyle, tableUnits, type ColumnName } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";
// Pure, and the same rule the server applies: a drop is a swap (Ask first 2).
import { swapped, type RoadRefusal, type RoadSide } from "@/lib/calculation/geometry";
import { ownerColor } from "@/lib/calculation/owner-colors";
import { checkSideRoadInput, type InputProblem } from "@/lib/calculation/side-road-input";
import { EMPTY_START, SideRoadStart, type StartProperty, type StartState } from "./side-road-start";

/**
 * „Calcul drum lateral", steps 1 to 4                       (Slices #38.23, #38.24, #39.79)
 *
 * Step 1 (#39.79; #38.23's data file until then): the property, its owners and
 * their shares, and the road's width — side-road-start.tsx; „Împarte
 * proprietatea" opens step 2 once every check passes. Step 2: the parcel drawn from its numbered corners, cut into one slice
 * per owner in a random order, which the user rearranges by dropping one slice
 * on another — or, from the keyboard, with ↑ ↓ in the owners' table. Step 3
 * (#38.24): a click on a corner, then on one of its two sides, lays the road
 * along that side; the slices turn to meet it, and the order can still be
 * changed with the road in place. The two select boxes under the prompt are
 * the same two clicks from the keyboard. Step 4 (#38.25): „Creează proprietățile"
 * sends the property, the owners, the width and the three choices — the server
 * recomputes and creates one property per owner, linked to its owner, and the
 * road; „Anulează" starts over.
 *
 * The geometry is the server's: every change posts the property, the owners,
 * the width, the order and the road's corner and side to
 * /api/calculation/preview and draws what comes back. A road that cannot be built comes back as a refusal and is never
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

/** Slice #37.35's commit form (3 units) and success panel (6), back with step 4 (#38.25). */
const COMMIT_UNITS = 3;
const COMMITTED_UNITS = 6;

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
  personId: string;
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

type CommitResult = {
  groupId:    string;
  groupCode:  string;
  runId:      string;
  runCode:    string;
  properties: { id: string; code: string; nickname: string | null }[];
};

type PreviewAnswer =
  | { kind: "ok"; computation: Computation }
  | { kind: "rejected"; problems: InputProblem[] }
  | { kind: "refused"; refusal: Refusal };

/** What every preview and the commit send (#39.79): the property, the owners and the width; a re-run's run. */
type SideRoadBody = {
  propertyId: string;
  owners: { personId: string; share: string }[];
  width: string;
  rerunOf?: string;
};

/** Where step 3 stands: choosing the corner, then the side; or the road is laid. */
type RoadStep =
  | { phase: "corner" }
  | { phase: "side"; corner: number }
  | { phase: "set"; corner: number; side: RoadSide };

// ---------------------------------------------------------------------------
// Re-run payload  (Slice #20.09)
// ---------------------------------------------------------------------------

/**
 * „Istoricul calculelor" → a run → „Re-rulează" puts the run's property, owners,
 * width and three choices here (#38.25; #39.79), and the screen opens on them:
 * the same corners as the run stored, the same order, the same road, the group
 * description and the road's nickname. Only a run made from a property offers
 * it; a run made from #38.23's file, and #18.10's, read a file this screen no
 * longer does.
 */
export type RerunPayload = {
  runId: string;
  property: { id: string; code: string; nickname: string | null };
  owners: { personId: string; name: string; code: string; type: "NATURAL" | "JUDICIAL"; share: string }[];
  width: string;
  order?: number[];
  road?: { corner: number; side: RoadSide };
  options?: { groupDescription?: string; roadNickname?: string };
};

/** Read + consume the calc_rerun sessionStorage entry on the client side. */
function consumeRerunPayload(isRerun: boolean): RerunPayload | null {
  if (!isRerun) return null;
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("calc_rerun");
  if (!raw) return null;
  sessionStorage.removeItem("calc_rerun");
  try {
    const parsed = JSON.parse(raw) as RerunPayload;
    return typeof parsed.runId === "string" && parsed.property && Array.isArray(parsed.owners) ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The screen's work, kept between visits  (2026-10-18)
// ---------------------------------------------------------------------------

/**
 * Adrian, 2026-10-18: „the screen should keep its value until a new button reset is pressed" — he goes to the persons
 * and properties lists to look up a code or a name and comes back. So everything typed and chosen, and how far the
 * steps went (the division, the road, the group's description, what was created), is written to this browser's
 * storage after every change and read back when the screen opens; „Resetează" (step 1), „Resetează" beside the
 * summary, „Anulează" and „Reia" empty it. A re-run's payload wins over it. Storage that throws (a private window, a
 * blocked site) only means the screen starts empty, as before.
 */
const DRAFT_KEY = "ga40.calculation.draft.v1";

type Draft = {
  start: StartState;
  sent: SideRoadBody | null;
  computation: Computation | null;
  roadStep: RoadStep;
  groupDescription: string;
  roadNickname: string;
  committed: CommitResult | null;
};

function readDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft> | null;
    return d && d.start && Array.isArray(d.start.owners) && d.roadStep ? (d as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft | null): void {
  try {
    if (d) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // storage unavailable: the screen simply does not remember
  }
}

/** The side a corner's road runs along, as an index into `sides`: side i joins corner i to i + 1. */
function sideIndex(corner: number, side: RoadSide, n: number): number {
  return side === "next" ? corner : (corner + n - 1) % n;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalculationView() {
  const t = useTranslations("calculation");
  const format = useFormatter();
  const nameOr = useNameOr(); // #37.57: a name, or words — never the system ID
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

  // 2026-10-18: what the screen held when it was left, unless a re-run brings its own.
  const [draft] = useState<Draft | null>(() => (rerunPayload ? null : readDraft()));

  // Step 1 (#39.79): what is typed, and what was last sent — every later preview and the commit send the same.
  const [start, setStart] = useState<StartState>(() =>
    rerunPayload
      ? { property: { ...rerunPayload.property, corners: null }, owners: rerunPayload.owners, width: rerunPayload.width }
      : draft?.start ?? EMPTY_START,
  );
  const [sent, setSent] = useState<SideRoadBody | null>(() =>
    rerunPayload
      ? {
          propertyId: rerunPayload.property.id,
          owners: rerunPayload.owners.map((o) => ({ personId: o.personId, share: o.share })),
          width: rerunPayload.width,
          rerunOf: rerunPayload.runId,
        }
      : draft?.sent ?? null,
  );

  const [computation, setComputation] = useState<Computation | null>(draft?.computation ?? null);
  /** What the server refused when step 1's checks had passed — the same codes, worded by step 1. */
  const [problems, setProblems] = useState<InputProblem[] | null>(null);
  const [previewing, setPreviewing] = useState(() => rerunPayload !== null);
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  /** What the last reorder did, for the screen reader (aria-live). */
  const [announcement, setAnnouncement] = useState("");
  const [roadStep, setRoadStep] = useState<RoadStep>(draft?.roadStep ?? { phase: "corner" });
  /** Why the last click or reorder was refused (#38.24). */
  const [roadMessage, setRoadMessage] = useState<string | null>(null);

  // Step 4 (#38.25).
  const [groupDescription, setGroupDescription] = useState(rerunPayload?.options?.groupDescription ?? draft?.groupDescription ?? "");
  const [roadNickname, setRoadNickname] = useState(rerunPayload?.options?.roadNickname ?? draft?.roadNickname ?? t("road.defaultNickname"));
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<CommitResult | null>(draft?.committed ?? null);

  // 2026-10-18: written after every change, so leaving the screen loses nothing; an empty screen keeps nothing.
  useEffect(() => {
    const empty = !start.property && start.owners.length === 0 && start.width.trim() === "" && !computation && !committed;
    writeDraft(empty ? null : { start, sent, computation, roadStep, groupDescription, roadNickname, committed });
  }, [start, sent, computation, roadStep, groupDescription, roadNickname, committed]);


  function resetAll() {
    writeDraft(null);
    setStart(EMPTY_START);
    setSent(null);
    setComputation(null);
    setProblems(null);
    setPreviewError(null);
    setAnnouncement("");
    setRoadStep({ phase: "corner" });
    setRoadMessage(null);
    setGroupDescription("");
    setRoadNickname(t("road.defaultNickname"));
    setCommitError(null);
    setCommitted(null);
  }

  async function preview(
    body: SideRoadBody,
    order?: number[],
    road?: { corner: number; side: RoadSide },
  ): Promise<PreviewAnswer> {
    const res = await fetch("/api/calculation/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...(order ? { order } : {}), ...(road ? { road } : {}) }),
    });
    if (res.redirected) throw new Error(t("errors.session"));
    const data = (await res.json().catch(() => ({}))) as {
      computation?: Computation;
      problems?: InputProblem[];
      refusal?: Refusal;
      error?: string;
    };
    if (res.ok && data.computation) return { kind: "ok", computation: data.computation };
    if (Array.isArray(data.problems)) return { kind: "rejected", problems: data.problems };
    if (data.refusal) return { kind: "refused", refusal: data.refusal };
    throw new Error(data.error ?? `Error ${res.status}`);
  }

  /** Step 1 → 2: „Împarte proprietatea"; the server reads the property and the persons, and picks the random first order. */
  async function divide() {
    if (!start.property) return;
    const body: SideRoadBody = {
      propertyId: start.property.id,
      owners: start.owners.map((o) => ({ personId: o.personId, share: o.share.trim() })),
      width: start.width.trim(),
    };
    setSent(body);
    setPreviewing(true);
    setPreviewError(null);
    setProblems(null);
    setComputation(null);
    setAnnouncement("");
    setRoadStep({ phase: "corner" });
    setRoadMessage(null);
    try {
      const answer = await preview(body);
      if (answer.kind === "ok") setComputation(answer.computation);
      else if (answer.kind === "rejected") setProblems(answer.problems);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  }

  /** Step 4: the server recomputes from what was sent and the three choices, and creates. */
  async function doCommit() {
    if (!sent || !computation || roadStep.phase !== "set") return;
    setCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch("/api/calculation/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sent,
          order: computation.order,
          road: { corner: roadStep.corner, side: roadStep.side },
          groupDescription: groupDescription.trim(),
          roadNickname: roadNickname.trim(),
        }),
      });
      if (res.redirected) throw new Error(t("errors.session"));
      const data = (await res.json().catch(() => ({}))) as Partial<CommitResult> & {
        error?: string;
        problems?: InputProblem[];
        refusal?: Refusal;
      };
      if (!res.ok) {
        if (Array.isArray(data.problems)) {
          // The archive changed under the screen (a person deleted, the corners edited): back to step 1, saying why.
          setProblems(data.problems);
          setComputation(null);
          return;
        }
        if (data.refusal) throw new Error(refusalText(data.refusal, { corner: roadStep.corner, side: roadStep.side }));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      setCommitted(data as CommitResult);
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommitting(false);
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
    if (!sent) return { ok: false };
    setBusy(true);
    setPreviewError(null);
    try {
      const answer = await preview(sent, order, road);
      if (answer.kind === "ok") {
        setComputation(answer.computation);
        return { ok: true, computation: answer.computation };
      }
      if (answer.kind === "rejected") {
        setProblems(answer.problems);
        setComputation(null);
      } else setRoadMessage(refusalText(answer.refusal, road));
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
    // Not held back while a recompute is in flight: choosing the corner asks
    // the server nothing, and a click dropped in silence reads as broken.
    if (roadStep.phase === "set") return;
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

  /** A property chosen (#39.79, Ask first 4): the group's description names it — „Diviz — PROP00123". */
  function propertyChosen(p: StartProperty) {
    setProblems(null);
    setGroupDescription(t("group.defaultDescription", { code: p.code }));
  }

  /** „Modifică datele": back to step 1 with everything typed kept; the order and the road start again. */
  function editStart() {
    setComputation(null);
    setProblems(null);
    setPreviewError(null);
    setRoadStep({ phase: "corner" });
    setRoadMessage(null);
    setAnnouncement("");
  }

  /** „121–122": side i, by the numbers of its two corners. */
  function sideName(i: number): string {
    const s = computation?.sides[i];
    return s ? `${s.from}–${s.to}` : "";
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

  /** A re-run (#38.25; #39.79): the run's corners, owners and width, its order and its road. */
  async function rerun(payload: RerunPayload) {
    if (!sent) return;
    // `previewing` starts true for a re-run (its useState), so nothing is set
    // before the first await — the effect below calls this, and a synchronous
    // setState in an effect is the cascade react-hooks/set-state-in-effect bans.
    try {
      const answer = await preview(sent, payload.order, payload.road);
      if (answer.kind === "ok") {
        setComputation(answer.computation);
        if (payload.road) setRoadStep({ phase: "set", corner: payload.road.corner, side: payload.road.side });
      } else if (answer.kind === "rejected") {
        setProblems(answer.problems);
      } else {
        // The road no longer fits (it should, for a stored run): show the parcel and say why.
        const plain = await preview(sent, payload.order);
        if (plain.kind === "ok") setComputation(plain.computation);
        setRoadMessage(refusalText(answer.refusal, payload.road));
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  }

  // Open a re-run on its file and choices (below the functions it calls: the React compiler's
  // declared-before-used rule) — the effect only calls the
  // async function; no setState calls in the effect body.
  useEffect(() => {
    // A microtask, so the effect body itself sets nothing (react-hooks/set-state-in-effect).
    if (rerunPayload) queueMicrotask(() => void rerun(rerunPayload));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 1's checks, as the server will apply them (#39.79). Shown as they become true of what has been typed: no
  // „at least two owners" before the first, no width complaint before anything is in the box.
  const checked = checkSideRoadInput({ corners: start.property?.corners ?? null, owners: start.owners, width: start.width });
  const shownProblems = checked.ok
    ? []
    : checked.problems.filter((p) =>
        p.code === "ownerCount" ? start.owners.length > 0
        : p.code === "widthFormat" ? start.width.trim().length > 0
        : p.code === "percentTotal" ? start.owners.every((o) => o.share.trim().length > 0)
        : p.code === "shareFormat" ? p.values.share.length > 0
        : true,
      );

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

  // ---- Created (success) — as #18.10's, with the run's history link ---------

  if (committed) {
    return (
      <div className="flex flex-col gap-4">
        <UnitRow units={[COMMITTED_UNITS]}>
        <div {...screenPanel("committed", COMMITTED_UNITS)} className="rounded-md border border-green-300 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950">
          <p className="font-semibold text-green-800 dark:text-green-300">
            {t("success.title", { code: committed.groupCode })}
          </p>
          <p className="mt-1 text-xs text-green-700 dark:text-green-400">
            {t("success.runCode", { code: committed.runCode })}
            {" · "}
            {/* #37.46 (A087): History, icon-only; „Vezi istoricul calculului"
                is its name and tooltip. */}
            <IconButton
              href={`/admin/calculation/history/${committed.runId}`}
              icon={History}
              label={t("success.viewRun")}
              variant="secondary"
              size="xs"
              className="ml-1 align-middle"
            />
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {committed.properties.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/properties/${p.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {/* #37.57: the property by its nickname, never its system ID. */}
                  {nameOr(p.nickname, "property")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        </UnitRow>
        <div>
          <IconButton
            icon={RotateCcw}
            label={t("buttons.startOver")}
            variant="primary"
            size="sm"
            onClick={resetAll}
          />
        </div>
      </div>
    );
  }

  return (
    <UnitRow units={[CALC_UNITS]}>
    <section {...screenPanel("calculation", CALC_UNITS)} className="flex flex-col gap-5 rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Step 1 (#39.79) — the property, its owners and their shares, the road; or, once divided, what was divided */}
      {!computation ? (
        <SideRoadStart
          state={start}
          onChange={(next) => {
            setStart(next);
            setProblems(null);
          }}
          problems={problems ?? shownProblems}
          canDivide={checked.ok && !previewing}
          dividing={previewing}
          onDivide={() => void divide()}
          onReset={resetAll}
          onPropertyChosen={propertyChosen}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink dark:text-zinc-200" data-calc-summary="">
          <span>
            {t("start.summary", {
              code: start.property?.code ?? "",
              owners: start.owners.length,
              width: start.width.trim(),
            })}
          </span>
          {!sent?.rerunOf && (
            <IconButton icon={Pencil} label={t("start.edit")} variant="secondary" size="sm" onClick={editStart} disabled={busy} />
          )}
          <IconButton icon={RotateCcw} label={t("buttons.reset")} variant="secondary" size="sm" onClick={resetAll} />
        </div>
      )}

      {previewing && (
        <p className="text-sm text-fade dark:text-zinc-400" role="status">{t("status.computing")}</p>
      )}
      {previewError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {previewError}
        </p>
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
            // The owner's colour, by the owner's line in the file — it travels with a swap (#38.27).
            owners={computation.slices.map((s) => ({ label: s.name, corners: s.corners, color: ownerColor(s.owner) }))}
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
                    <td className={`px-3 py-2 text-ink dark:text-zinc-200 ${WRAPS}`}>
                      <OwnerSwatch color={ownerColor(s.owner)} />
                      {s.name}
                    </td>
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

          {/* Step 4 — „Creează proprietățile", once the road is laid (#38.25) */}
          {roadStep.phase === "set" && computation.road && (
            <div {...screenPanel("commit", COMMIT_UNITS)} className="flex flex-col gap-3 rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
                {t("commit.title", { count: computation.slices.length + 1 })}
              </h3>

              {/* ⚠️ THE OWNER NAMES ARE TEXT (Slice #34.08, D-20a): each property's
                  nickname, no Person created, nobody linked. One sentence says so,
                  because the table above reads like ownership. Resolving them to
                  Persons is FU-053, a slice of its own. */}
              <p className="text-xs text-fade dark:text-zinc-400">
                {t("commit.ownersAreNicknames")}
              </p>

              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1 text-xs font-medium text-ink dark:text-zinc-400">
                  {t("commit.groupDescription")}
                  <span className="text-red-500">*</span>
                  <HelpHint hintKey="calc-group-description-autofill" />
                </label>
                <input
                  {...screenBox("calcGroupDescription")}
                  type="text"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  maxLength={500}
                  aria-label={t("commit.groupDescription")}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink dark:text-zinc-400">
                  {t("commit.roadNickname")}
                </label>
                <input
                  {...screenBox("calcRoadNickname")}
                  type="text"
                  value={roadNickname}
                  onChange={(e) => setRoadNickname(e.target.value)}
                  aria-label={t("commit.roadNickname")}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              {commitError && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                  {commitError}
                </p>
              )}

              <div className="flex items-center gap-2">
                {/* #37.46 (A089): PackagePlus, its words shown; working, „Se creează…". */}
                <IconButton
                  icon={PackagePlus}
                  label={committing ? t("buttons.creating") : t("buttons.confirm")}
                  busy={committing}
                  showLabel
                  variant="primary"
                  size="lg"
                  onClick={() => void doCommit()}
                  disabled={committing || busy || groupDescription.trim().length === 0}
                />
                {/* A022: X, „Anulează" its name and tooltip — starts over. */}
                <IconButton
                  icon={X}
                  label={t("buttons.cancel")}
                  variant="secondary"
                  size="lg"
                  onClick={resetAll}
                  disabled={committing}
                />
                <HelpHint hintKey="calc-preview-not-saved" />
              </div>
            </div>
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
