"use client";

/**
 * PropertyStepDialog — Slice #23.00.Import
 *
 * The step that gives the import run its Property. It sits between "scan
 * complete" and the tag dialog, and the import cannot proceed past it.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Before this slice a picked folder was an arbitrary tree of documents, and
 * the link between those documents and a Property was made *indirectly*:
 * folder names became tags, a folder name starting with a digit was assumed to
 * be "<tarla>-<parcela>-<rest>", and later on `findEntitiesByTag` associated
 * everything in the system that happened to share the tag string. Both halves
 * were guesses that failed quietly — "3 Calea Victoriei" parsed as tarla "3",
 * and reusing a folder name across two unrelated imports cross-linked their
 * records.
 *
 * The folder now simply IS one Property. The user says which one, once, here;
 * every Document created by the run is linked to it directly. Tags survive,
 * but only as descriptive labels for browsing — they no longer link anything.
 *
 * WHAT THIS DIALOG DECIDES
 *   1. The Property — created now (nickname, and since Slice #23.07.Import
 *      tarla + parcela, pre-filled from the folder name) or picked from the
 *      existing ones (re-importing more documents into a property created by
 *      an earlier run).
 *   2. Optionally, which coordinate file in the folder defines its corners.
 *      Candidates are shortlisted by extension and then actually parsed, so
 *      the corner count shown is real, not a guess from the filename.
 *   3. When an existing property already has corners AND a coordinate file was
 *      chosen, whether to replace them. Never silently: replacing discards
 *      hand-fixed corner order (the bow-tie reorder case), so the user is
 *      shown both counts and asked.
 *
 * A newly created property receives its corners — and its tarla/parcela —
 * inside the POST that creates it, so they land in version 0 rather than as an
 * immediate v0 -> v1 edit.
 *
 * TARLA / PARCELA ARE A SUGGESTION, NOT AN INFERENCE  (Slice #23.07.Import)
 * ────────────────────────────────────────────────────────────────────────
 * The two inputs on the create-new branch are pre-filled from the folder name
 * via `cadastralSuggestionFromFolderName`, which composes the same
 * `parseFolderName` Slice #23.00.Import retired from this wizard. That is not
 * a regression and CLAUDE.md's standing "do not reintroduce `parseFolderName`
 * into the import wizard" rule still holds: what it forbids is a value the
 * system decides ALONE and writes without showing anyone. Here the value is
 * visible, labelled as a suggestion in Romanian, editable, and blank whenever
 * the name does not carry the "<tarla>-<parcela>" shape — the user confirms it
 * before the POST. Adrian asked for this because the OTHER path into a
 * Property (the Process panel on a document detail page) has always filled
 * these fields, and a Property born in the wizard arriving with them empty was
 * an asymmetry he could see.
 *
 * The inputs render unconditionally. `lookup_property_type.show_tarla_parcela`
 * governs the panel on the Property form, but this branch picks no property
 * type, so there is no flag to consult — Adrian's call, made knowing a
 * Property later typed with the flag off would hold values its own detail form
 * does not show.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { FSEntry, FSFileEntry } from "@/lib/import/folder-utils";
import {
  cadastralSuggestionFromFolderName,
  coordinateCandidates,
  coordinateNameConfidence,
  nicknameFromFolderName,
} from "@/lib/import/coordinate-file";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { buttonClass } from "@/lib/ui/button-styles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** What the wizard needs to know about the property once this step is done. */
export type ResolvedProperty = {
  id: string;
  code: string;
  nickname: string | null;
  principalObjectId: string;
  /** Corners the run ended up with — display only, for the wizard's chip. */
  cornerCount: number;
  /**
   * Slice #23.06.Import — the path of the coordinate file whose corners were
   * actually WRITTEN to this Property, or null if none were.
   *
   * The import loop uses it to claim `property_corner_source` the moment that
   * file's Document is created. It cannot be claimed here: at this point the
   * file is still a local file handle and there is no `document` row for the
   * link to point at.
   *
   * Null means "no file is the origin of this Property's geometry", which
   * covers three distinct cases, all of them correct:
   *   • no coordinate file was picked (or the folder had none);
   *   • the picked file parsed to zero corners;
   *   • the Property already had corners and the user chose "Păstrează" — the
   *     file was read, but its corners were REJECTED, so it did not build
   *     this Property and must stay free to build another.
   */
  cornerSourcePath: string | null;
};

type Corner = { lat: number; lon: number; originalIndex: number | null };

/** One coordinate-file candidate, after it has actually been parsed. */
type Candidate = {
  entry: FSFileEntry;
  /** null while still parsing. */
  corners: Corner[] | null;
  /** Set when the file could not be read or the server rejected it. */
  error: string | null;
};

type PropertySearchItem = {
  id: string;
  code: string;
  nickname: string | null;
  tarlaSola: string | null;
  parcela: string | null;
  locality: string | null;
};

type Mode = "new" | "existing";

type Props = {
  entries: FSEntry[];
  rootFolderName: string;
  onCancel: () => void;
  onResolved: (property: ResolvedProperty) => void;
};

const PAGE_SIZE = 10;
const NO_COORDINATE_FILE = "";

/**
 * Shared text-input classes for this dialog's three free-text fields
 * (nickname, tarla, parcela), so they cannot drift apart.
 *
 * A plain constant rather than a helper with options: unlike `buttonClass`
 * there is no variant or state to express here, and per the Tailwind
 * stylesheet-order gotcha in CLAUDE.md a caller must never be able to override
 * one of these utilities by appending a conflicting one anyway.
 */
const TEXT_INPUT_CLASS =
  "rounded-md border border-wire bg-white px-2 py-1.5 text-sm text-ink shadow-sm focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Every mutating call here goes through this guard.
 *
 * `res.redirected` is the expired-Supabase-session tell documented in
 * CLAUDE.md: the middleware redirects the request to /sign-in and fetch
 * follows it, so the response is a perfectly cheerful 200 full of sign-in
 * HTML. Without this check the dialog would report success and the wizard
 * would carry on importing into a property that was never created.
 */
async function assertNotRedirected(res: Response, sessionMsg: string): Promise<void> {
  if (res.redirected) throw new Error(sessionMsg);
}

async function parseCoordinateFile(file: File): Promise<Corner[]> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await fetch("/api/properties/parse-text", { method: "POST", body: fd });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { corners?: Corner[] };
  return body.corners ?? [];
}

async function searchProperties(
  q: string,
  page: number,
): Promise<{ items: PropertySearchItem[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });
  if (q.trim()) params.set("q", q.trim());
  const res = await fetch(`/api/properties?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { items: PropertySearchItem[]; total: number };
}

type PropertyFullResponse = {
  property: { id: string; code: string; nickname: string | null; principalObjectId: string };
  corners: unknown[];
};

async function fetchPropertyDetail(id: string): Promise<PropertyFullResponse> {
  const res = await fetch(`/api/properties/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as PropertyFullResponse;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyStepDialog({
  entries,
  rootFolderName,
  onCancel,
  onResolved,
}: Props) {
  const t = useTranslations("adminImport.wizard.propertyStep");

  // ── Coordinate-file candidates ────────────────────────────────────────────
  //
  // Shortlisted by extension once; `entries` is stable for this dialog's life.
  const candidateEntries = useMemo(
    () => coordinateCandidates(entries),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    candidateEntries.map((entry) => ({ entry, corners: null, error: null })),
  );
  const [parsing, setParsing] = useState(candidateEntries.length > 0);

  // ── Selection state ───────────────────────────────────────────────────────

  const [mode, setMode] = useState<Mode>("new");
  const [nickname, setNickname] = useState(() => nicknameFromFolderName(rootFolderName));

  // Slice #23.07.Import — suggested cadastral identifiers. Computed once from
  // the folder name (stable for this dialog's life, exactly like `nickname`)
  // and then owned by the user: every later read comes from the input state,
  // never from the folder name again.
  const cadastralSuggestion = useMemo(
    () => cadastralSuggestionFromFolderName(rootFolderName),
    [rootFolderName],
  );
  const [tarlaSola, setTarlaSola] = useState(cadastralSuggestion.tarlaSola);
  const [parcela, setParcela] = useState(cadastralSuggestion.parcela);
  const hasCadastralSuggestion =
    cadastralSuggestion.tarlaSola !== "" || cadastralSuggestion.parcela !== "";

  const [selectedCoordPath, setSelectedCoordPath] = useState<string>(NO_COORDINATE_FILE);
  const [replaceCorners, setReplaceCorners] = useState(false);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Synchronous in-flight latch for the Confirm button (Slice #23.03.Import).
   *
   * `submitting` alone is not enough. Setting state does not disable the
   * button until React has re-rendered, so every click dispatched inside that
   * window still passes the `disabled={!canConfirm}` gate and still runs the
   * handler. On the "new property" branch each one of those is a separate
   * POST /api/properties, and the route has nothing to deduplicate them
   * against — a triple-click produces three real Properties with the same
   * nickname, and the wizard then attaches the run's documents to whichever
   * one answered last.
   *
   * A ref flips in the same synchronous turn as the click, so clicks two and
   * three return immediately. `submitting` is kept for the button's label and
   * disabled styling; this guards correctness.
   */
  const inFlightRef = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Parse every candidate on mount so the list can show REAL corner counts.
  // A ".csv" of phone numbers and a ".csv" of corners look identical until
  // parsed, and "0 corners" is exactly the signal that tells them apart.
  //
  // Every setState below runs in an async continuation, never synchronously in
  // the effect body — that is what react-hooks/set-state-in-effect forbids.
  useEffect(() => {
    if (candidateEntries.length === 0) return;
    let mounted = true;

    (async () => {
      const parsed: Candidate[] = [];

      for (const entry of candidateEntries) {
        let corners: Corner[] = [];
        let error: string | null = null;
        try {
          const file = await entry.handle.getFile();
          corners = await parseCoordinateFile(file);
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }
        if (!mounted) return;
        const done: Candidate = { entry, corners, error };
        parsed.push(done);
        setCandidates((prev) =>
          prev.map((c) => (c.entry.path === entry.path ? done : c)),
        );
      }
      if (!mounted) return;

      // Pre-select only when exactly ONE file actually yielded corners — that
      // is a fact, not a guess.
      //
      // Slice #23.07.Import adds the two-or-more case. #23.00 left it to the
      // user on the reasoning that "most corners wins" would let a stray CSV
      // take it silently — true, and a name-convention match is better
      // evidence than a corner count, because it is a statement the file's
      // author made on purpose. So exactly ONE candidate matching the "coord…"
      // convention is pre-selected; two or more matching it is a tie the name
      // cannot break, and the user chooses as before. Every candidate stays
      // visible and selectable in both cases — this only moves the radio.
      const usable = parsed.filter((c) => (c.corners?.length ?? 0) > 0);
      if (usable.length === 1) {
        setSelectedCoordPath(usable[0].entry.path);
      } else if (usable.length > 1) {
        const strong = usable.filter(
          (c) => coordinateNameConfidence(c.entry.name) === "strong",
        );
        if (strong.length === 1) setSelectedCoordPath(strong[0].entry.path);
      }

      setParsing(false);
    })();

    return () => { mounted = false; };
    // candidateEntries is derived from the stable `entries` prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchQuery = useQuery({
    queryKey: ["import-property-search", debouncedQuery, page],
    queryFn: () => searchProperties(debouncedQuery, page),
    enabled: mode === "existing",
    staleTime: 30_000,
  });

  const detailQuery = useQuery({
    queryKey: ["import-property-detail", selectedExistingId],
    queryFn: () => fetchPropertyDetail(selectedExistingId as string),
    enabled: mode === "existing" && selectedExistingId !== null,
    staleTime: 0,
  });

  const existingCornerCount = detailQuery.data?.corners.length ?? 0;

  const chosenCandidate =
    selectedCoordPath === NO_COORDINATE_FILE
      ? null
      : candidates.find((c) => c.entry.path === selectedCoordPath) ?? null;
  const chosenCorners = chosenCandidate?.corners ?? null;

  /**
   * Slice #23.07.Import — the file name of the ONE usable candidate when its
   * name breaks the "coord…" convention, or null when there is nothing to say.
   *
   * This is Adrian's "the creator of the file may have made a mistake" case:
   * the file parses, so it imports, and the note never blocks anything. It
   * only points out that the two signals disagree — a correctly-formed export
   * with an unconventional name is far more likely than the reverse, but it is
   * also exactly what a wrong file looks like from here.
   *
   * Derived from `candidates` at render time rather than copied into state
   * when the parse finishes, so there is no second copy to fall out of step
   * with the list the user is looking at.
   */
  const conventionNote = useMemo(() => {
    const usable = candidates.filter((c) => (c.corners?.length ?? 0) > 0);
    if (usable.length !== 1) return null;
    const only = usable[0];
    return coordinateNameConfidence(only.entry.name) === "strong"
      ? null
      : only.entry.name;
  }, [candidates]);

  /**
   * The conflict: an existing property that already has corners, and a
   * coordinate file that wants to define them. Both counts are shown and the
   * user picks — replacing is destructive (it discards any manual reordering)
   * and must never happen by default.
   */
  const cornerConflict =
    mode === "existing" &&
    selectedExistingId !== null &&
    existingCornerCount > 0 &&
    (chosenCorners?.length ?? 0) > 0;

  /**
   * Change what the conflict is ABOUT and the answer to it is void.
   *
   * Done in the two handlers rather than in an effect on purpose: a
   * synchronous setState inside a useEffect body is what
   * react-hooks/set-state-in-effect rejects (see Slice #4.5), and there are
   * exactly two places that can invalidate the answer, so resetting at the
   * source is also the clearer read.
   */
  const chooseExisting = useCallback((id: string) => {
    setSelectedExistingId(id);
    setReplaceCorners(false);
  }, []);

  const chooseCoordinateFile = useCallback((path: string) => {
    setSelectedCoordPath(path);
    setReplaceCorners(false);
  }, []);

  // ── Confirm ───────────────────────────────────────────────────────────────

  const canConfirm =
    !submitting &&
    !parsing &&
    (mode === "new"
      ? nickname.trim().length > 0
      : selectedExistingId !== null && !detailQuery.isLoading);

  const handleConfirm = useCallback(async () => {
    // See inFlightRef above — this must run before the first await.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setSubmitting(true);
    setSubmitError(null);

    try {
      if (mode === "new") {
        // Corners travel INSIDE the create call so they are part of version 0.
        // Creating first and patching after would make the property's history
        // open with an edit the user never made.
        const corners = chosenCorners ?? [];
        const res = await fetch("/api/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nickname: nickname.trim(),
            // Slice #23.07.Import — these travel in the SAME body as the
            // corners, for the same reason: creating the Property first and
            // patching the cadastral fields after would open its history with
            // a v0 -> v1 edit nobody made. `null` rather than "" for a blank
            // field, so an untouched suggestion leaves the column NULL instead
            // of storing an empty string.
            tarlaSola: tarlaSola.trim() || null,
            parcela: parcela.trim() || null,
            corners,
            // Where this property came from. A parsed cadastral file is
            // unambiguous; a hand-named empty property is a manual entry.
            provenance: inferProvenance(
              corners.length > 0 ? "COORDINATE_FILE" : "MANUAL_FORM",
            ),
          }),
        });
        await assertNotRedirected(res, t("errorSession"));
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const body = (await res.json()) as PropertyFullResponse;
        onResolved({
          id: body.property.id,
          code: body.property.code,
          nickname: body.property.nickname,
          principalObjectId: body.property.principalObjectId,
          cornerCount: corners.length,
          // The corners travelled inside the create body, so on this branch
          // "written" and "parsed" are the same thing — but only if there were
          // any. An empty file is not the origin of an empty polygon.
          cornerSourcePath:
            corners.length > 0 ? chosenCandidate?.entry.path ?? null : null,
        });
        return;
      }

      // ── Existing property ──────────────────────────────────────────────
      const detail = detailQuery.data;
      if (!detail) throw new Error(t("errorNoDetail"));

      let finalCornerCount = existingCornerCount;

      // Write corners only when they were actually chosen AND either the
      // property has none yet, or the user explicitly asked to replace.
      const shouldWriteCorners =
        (chosenCorners?.length ?? 0) > 0 && (!cornerConflict || replaceCorners);

      if (shouldWriteCorners && chosenCorners) {
        const res = await fetch(`/api/properties/${detail.property.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ corners: chosenCorners }),
        });
        await assertNotRedirected(res, t("errorSession"));
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        finalCornerCount = chosenCorners.length;
      }

      onResolved({
        id: detail.property.id,
        code: detail.property.code,
        nickname: detail.property.nickname,
        principalObjectId: detail.property.principalObjectId,
        cornerCount: finalCornerCount,
        // Keyed on shouldWriteCorners, NOT on "a file was selected". If the
        // Property already had corners and the user chose Păstrează, this file
        // was parsed and then discarded — claiming it would lock a document to
        // a Property whose geometry came from somewhere else entirely.
        cornerSourcePath:
          shouldWriteCorners && chosenCandidate
            ? chosenCandidate.entry.path
            : null,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      // Release the latch ONLY on failure, so the user can correct and retry.
      // On success the dialog is unmounted by onResolved and the latch stays
      // closed, which is what keeps a late duplicate click from firing.
      inFlightRef.current = false;
    }
  }, [
    mode,
    nickname,
    // Slice #23.07.Import — read inside the create branch's POST body.
    tarlaSola,
    parcela,
    chosenCorners,
    // Slice #23.06.Import — the handler now reads the candidate itself (for
    // its path), not just its corners.
    chosenCandidate,
    detailQuery.data,
    existingCornerCount,
    cornerConflict,
    replaceCorners,
    onResolved,
    t,
  ]);

  // ESC cancels, but never mid-write.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  const items = searchQuery.data?.items ?? [];
  const total = searchQuery.data?.total ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-property-step-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <h2
            id="import-property-step-title"
            className="text-base font-semibold text-ink dark:text-zinc-100"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-fade dark:text-zinc-400">
            {t("intro", { folder: rootFolderName })}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* ── Section 1: which property ─────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink dark:text-zinc-200">
              {t("sectionProperty")}
            </h3>

            <div
              className="flex gap-2"
              role="radiogroup"
              aria-label={t("sectionProperty")}
            >
              <ModeButton
                active={mode === "new"}
                onClick={() => setMode("new")}
                label={t("modeNew")}
              />
              <ModeButton
                active={mode === "existing"}
                onClick={() => setMode("existing")}
                label={t("modeExisting")}
              />
            </div>

            {mode === "new" ? (
              <div className="space-y-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-ink dark:text-zinc-300">
                  {t("nicknameLabel")}
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    spellCheck={false}
                    className={TEXT_INPUT_CLASS}
                  />
                  <span className="font-normal text-fade dark:text-zinc-500">
                    {t("nicknameHint")}
                  </span>
                </label>

                {/*
                  Slice #23.07.Import — the cadastral suggestion. Labelled as a
                  suggestion in the hint below, editable, and blank when the
                  folder name carries no "<tarla>-<parcela>" shape. See the
                  header docblock for why this is not the retired heuristic.
                */}
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-ink dark:text-zinc-300">
                      {t("tarlaLabel")}
                      <input
                        type="text"
                        value={tarlaSola}
                        onChange={(e) => setTarlaSola(e.target.value)}
                        spellCheck={false}
                        className={TEXT_INPUT_CLASS}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-ink dark:text-zinc-300">
                      {t("parcelaLabel")}
                      <input
                        type="text"
                        value={parcela}
                        onChange={(e) => setParcela(e.target.value)}
                        spellCheck={false}
                        className={TEXT_INPUT_CLASS}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-fade dark:text-zinc-500">
                    {hasCadastralSuggestion
                      ? t("cadastralHint")
                      : t("cadastralHintEmpty")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-ink dark:text-zinc-300">
                  {t("searchLabel")}
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                    placeholder={t("searchPlaceholder")}
                    spellCheck={false}
                    className="rounded-md border border-wire bg-white px-2 py-1.5 text-sm text-ink shadow-sm focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>

                <div className="max-h-56 overflow-y-auto rounded-md border border-wire dark:border-zinc-700">
                  {searchQuery.isLoading ? (
                    <p className="p-3 text-sm text-fade">{t("searchLoading")}</p>
                  ) : searchQuery.isError ? (
                    <p className="p-3 text-sm text-red-600 dark:text-red-400">
                      {t("searchError")}
                    </p>
                  ) : items.length === 0 ? (
                    <p className="p-3 text-sm text-fade">{t("searchEmpty")}</p>
                  ) : (
                    <ul>
                      {items.map((item) => {
                        const selected = item.id === selectedExistingId;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => chooseExisting(item.id)}
                              aria-pressed={selected}
                              className={[
                                "flex w-full items-baseline gap-2 border-b border-crease px-3 py-2 text-left last:border-b-0 dark:border-zinc-800",
                                selected
                                  ? "bg-cta-pale dark:bg-cta/15"
                                  : "hover:bg-canvas dark:hover:bg-zinc-800",
                              ].join(" ")}
                            >
                              <span className="font-mono text-xs text-fade">
                                {item.code}
                              </span>
                              <span className="flex-1 truncate text-sm text-ink dark:text-zinc-200">
                                {item.nickname ?? t("noNickname")}
                              </span>
                              {item.locality && (
                                <span className="text-xs text-fade">{item.locality}</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {total > PAGE_SIZE && (
                  <div className="flex items-center justify-between text-xs text-fade">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className={buttonClass({ variant: "secondary", size: "xs" })}
                    >
                      {t("prevPage")}
                    </button>
                    <span>
                      {t("pageOf", {
                        page: page + 1,
                        pages: Math.ceil(total / PAGE_SIZE),
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={(page + 1) * PAGE_SIZE >= total}
                      className={buttonClass({ variant: "secondary", size: "xs" })}
                    >
                      {t("nextPage")}
                    </button>
                  </div>
                )}

                {selectedExistingId && (
                  <p className="text-xs text-fade dark:text-zinc-400">
                    {detailQuery.isLoading
                      ? t("detailLoading")
                      : detailQuery.isError
                      ? t("detailError")
                      : t("existingCorners", { count: existingCornerCount })}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── Section 2: coordinate file ────────────────────────────────── */}
          <section className="space-y-3 border-t border-crease pt-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-ink dark:text-zinc-200">
              {t("sectionCoordinates")}
            </h3>

            {candidateEntries.length === 0 ? (
              <p className="text-sm text-fade dark:text-zinc-400">{t("noCandidates")}</p>
            ) : (
              <>
                {parsing && (
                  <p className="text-sm text-fade animate-pulse">{t("parsing")}</p>
                )}
                <ul
                  className="space-y-1"
                  role="radiogroup"
                  aria-label={t("sectionCoordinates")}
                >
                  {candidates.map((c) => {
                    const count = c.corners?.length ?? 0;
                    const usable = count > 0;
                    return (
                      <li key={c.entry.path}>
                        <label
                          className={[
                            "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                            usable
                              ? "cursor-pointer border-wire hover:bg-canvas dark:border-zinc-700 dark:hover:bg-zinc-800"
                              : "border-crease opacity-60 dark:border-zinc-800",
                          ].join(" ")}
                        >
                          <input
                            type="radio"
                            name="coordinate-file"
                            value={c.entry.path}
                            checked={selectedCoordPath === c.entry.path}
                            disabled={!usable}
                            onChange={() => chooseCoordinateFile(c.entry.path)}
                          />
                          <span className="flex-1 truncate font-mono text-xs text-ink dark:text-zinc-200">
                            {c.entry.path}
                          </span>
                          <span className="text-xs text-fade">
                            {c.corners === null && !c.error
                              ? t("candidateParsing")
                              : c.error
                              ? t("candidateError")
                              : usable
                              ? t("candidateCorners", { count })
                              : t("candidateNotCoordinates")}
                          </span>
                        </label>
                      </li>
                    );
                  })}

                  <li>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-wire px-3 py-2 text-sm hover:bg-canvas dark:border-zinc-700 dark:hover:bg-zinc-800">
                      <input
                        type="radio"
                        name="coordinate-file"
                        value={NO_COORDINATE_FILE}
                        checked={selectedCoordPath === NO_COORDINATE_FILE}
                        onChange={() => chooseCoordinateFile(NO_COORDINATE_FILE)}
                      />
                      <span className="text-ink dark:text-zinc-200">{t("noCoordinateFile")}</span>
                    </label>
                  </li>
                </ul>

                {!parsing && conventionNote !== null && (
                  <p
                    role="status"
                    className="text-xs text-amber-700 dark:text-amber-400"
                  >
                    {t("coordinateNameNote", { name: conventionNote })}
                  </p>
                )}
              </>
            )}
          </section>

          {/* ── Section 3: corner conflict ────────────────────────────────── */}
          {cornerConflict && (
            <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {t("conflictTitle")}
              </h3>
              <p className="text-sm text-amber-900 dark:text-amber-200">
                {t("conflictBody", {
                  existing: existingCornerCount,
                  parsed: chosenCorners?.length ?? 0,
                })}
              </p>
              <div className="space-y-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
                  <input
                    type="radio"
                    name="corner-conflict"
                    checked={!replaceCorners}
                    onChange={() => setReplaceCorners(false)}
                  />
                  {t("conflictKeep")}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
                  <input
                    type="radio"
                    name="corner-conflict"
                    checked={replaceCorners}
                    onChange={() => setReplaceCorners(true)}
                  />
                  {t("conflictReplace")}
                </label>
              </div>
            </section>
          )}

          {submitError && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {submitError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-card-rim px-5 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {t("cancelButton")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {submitting ? t("confirmBusy") : t("confirmButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModeButton — "create new" / "pick existing" toggle
// ---------------------------------------------------------------------------

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={[
        "flex-1 rounded-md border px-4 py-2 text-sm font-medium shadow-sm",
        active
          ? "border-cta bg-cta-pale text-cta dark:bg-cta/15"
          : "border-wire bg-white text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
