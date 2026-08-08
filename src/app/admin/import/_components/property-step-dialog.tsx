"use client";

/**
 * PropertyStepDialog — the properties of this run, created before anything else.
 *                      (Slice #23.00.Import, rebuilt in #26.07)
 *
 * WHAT CHANGED, AND WHY THE OLD SHAPE HAD TO GO
 * ─────────────────────────────────────────────
 * #23.00 made the chosen folder BE one Property: the user typed a nickname or
 * searched a list, once, and every document in the run was linked to whatever
 * came back. Two things about that are now wrong.
 *
 * The first is arithmetic. A chosen folder holds up to five property
 * subfolders (STR-02), so "the run's Property" is no longer a thing that
 * exists. Each subfolder has its own, and each document belongs to its own
 * folder's — which is what the brief means by "processing a property subfolder
 * creates its Property before any document is created, and every document from
 * that folder is then linked to it."
 *
 * The second is the search box, and this slice's brief names it outright:
 * "There is no automatic existence check today — only a manual search box using
 * a fuzzy LIKE across six columns, and `property-step-dialog.tsx` carries a
 * comment admitting the create path has nothing to deduplicate against." Asking
 * a user to find, by hand, a Property the system can identify exactly is not a
 * convenience — it is the system declining to answer a question it knows the
 * answer to, and being wrong whenever the user scrolls past the row. So the
 * search is gone. Matching is on parsed tarla and parcela, done by the server,
 * shown to the user, and confirmed by them.
 *
 * THE ORDER IS THE POINT: PLAN, CONFIRM, THEN WRITE
 * ────────────────────────────────────────────────
 *   1. group the walked entries by property subfolder     (pure, no I/O)
 *   2. parse each folder's ONE declared coordinate file   (POST parse-text)
 *   3. ask what would happen                              (POST property-plan)
 *   4. show all of it, collect every confirmation the plan asks for
 *   5. only then, create-or-link, one folder at a time    (POST property)
 *
 * Steps 1–4 write nothing. That matters because there are up to five folders:
 * asking about the first, acting on the answer, and only then finding that the
 * fourth needs a decision the user refuses would leave a Property created for
 * an import that never happened. Every question is on one screen before the
 * first write.
 *
 * WHAT THIS DIALOG NO LONGER DECIDES
 * ──────────────────────────────────
 * Replacing corners. The old dialog offered "Păstrează / Înlocuiește" when an
 * existing Property already had corners and a coordinate file was picked. The
 * brief asks for one case only — "if it exists WITHOUT corners and the folder
 * has a coordinate file, the user is told corners will be added" — and adding
 * to an empty Property destroys nothing, while replacing discards hand-fixed
 * corner order. So an existing Property with corners keeps them, the screen
 * says so rather than leaving the user to notice a count that did not move,
 * and the destructive path stays where it already lives: the per-document
 * "Aplică pe proprietate" action after the import, which asks the same question
 * about one file the user chose.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { FSEntry, FSFileEntry } from "@/lib/import/folder-utils";
import {
  assignEntryProperties,
  groupByPropertyFolder,
  type EntryAssignment,
  type PropertyFolderGroup,
} from "@/lib/import/property-folders";
import type {
  CadastralMatch,
  PropertyFolderPlan,
} from "@/lib/properties/import-property-plan";
import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One Property this run resolved, and the folder it came from. */
export type ResolvedProperty = {
  /** The subfolder whose documents link to this Property. */
  folderName: string;
  id: string;
  code: string;
  nickname: string | null;
  /** Rows in `property_corner`. Display only — the wizard's chip. */
  cornerCount: number;
};

/** Everything the wizard needs once the property step is done. */
export type ResolvedRun = {
  properties: ResolvedProperty[];
  /** Entry path → where it came from and which Properties it is linked to. */
  assignment: Map<string, EntryAssignment>;
  /**
   * Coordinate-file path → the Property its corners built.
   * (Slice #23.06.Import, per-folder since #26.07.)
   *
   * The import loop uses it to claim `property_corner_source` the moment that
   * file's Document is created; it cannot be claimed at this step, because the
   * file is still a local handle with no `document` row to point at.
   *
   * A coordinate file is ABSENT in three cases, all correct: the folder had
   * none; the file parsed to zero corners; or the Property's corners are not
   * this file's, so it did not build that Property and must stay free to build
   * another.
   */
  cornerSourceByPath: Map<string, string>;
};

type Corner = { lat: number; lon: number; originalIndex: number | null };

type ParsedCoordinates = {
  /** null while still parsing. */
  corners: Corner[] | null;
  /** Set when the file could not be read or the server rejected it. */
  error: string | null;
};

/**
 * The plan and the row shape come from the server module that DEFINES them.
 *
 * They were hand copies for a round, on the reasoning that the server module
 * "reaches for `@/db`" — true of `import-property.ts` and false of
 * `import-property-plan.ts`, which this slice split out precisely so the pure
 * half could be imported from anywhere. `import type` is erased at compile
 * time, so nothing from it reaches the browser bundle, and the sibling
 * `bulk-import-dialog.tsx` already imports `EntryAssignment` this way. Two
 * hand-maintained copies of a wire shape is a drift waiting for a field.
 */
type PropertyMatch = CadastralMatch;
type FolderPlan = PropertyFolderPlan;

/**
 * The four answers `POST /api/admin/import/property` can give. A structural
 * copy of `EnsurePropertyResult` rather than an import of it, because that
 * module reaches for `@/db` and this one runs in the browser.
 *
 * `cornersMatchOffered` is on both write outcomes on purpose: it says whether
 * the Property's corners ARE this folder's, which is not the same as whether
 * this call wrote them. See the note beside it in `import-property.ts`.
 */
type EnsureResult =
  | { outcome: "created"; property: PropertyMatch; cornersMatchOffered: boolean }
  | { outcome: "needs-confirmation"; matches: PropertyMatch[]; offeredCornerCount: number }
  | {
      outcome: "linked";
      property: PropertyMatch;
      cornersAdded: number;
      cornersMatchOffered: boolean;
    }
  | { outcome: "stale"; matches: PropertyMatch[] };

type Props = {
  entries: FSEntry[];
  rootFolderName: string;
  /**
   * The folders the walk saw directly inside the chosen folder.
   *
   * Needed because a property subfolder holding no importable file produces no
   * ENTRIES, and would otherwise be invisible here while STR-02 counts it — so
   * the Structure stage would say five properties and this screen would show
   * four, with no mention of the fifth anywhere. See `groupByPropertyFolder`.
   */
  topLevelDirNames?: readonly string[];
  onCancel: () => void;
  onResolved: (run: ResolvedRun) => void;
  /**
   * Fired after EACH Property is created or linked, not once at the end.
   *
   * The step writes one folder at a time, so a failure on folder four leaves
   * three real Properties in the archive. Reporting only on success would make
   * those invisible — and, worse, would leave the wizard's Cancel telling the
   * user that nothing of theirs is in the system, in exactly the case where
   * something is. Cancelling still leaves them behind; the confirmation has to
   * say so.
   */
  onPropertyResolved?: (property: ResolvedProperty) => void;
  /**
   * Fired once, BEFORE the first request of an attempt.
   *
   * `onPropertyResolved` fires after an `await` resolves, so a request that
   * commits and then loses its response — dropped wifi, a proxy timeout —
   * never reports, and the Cancel goes back to claiming nothing of the user's
   * is in the archive while a Property sits in it. What the Cancel needs to say
   * is "a write may have landed", and the only moment that becomes true is
   * before the request, not after it.
   */
  onWriteStarted?: () => void;
  /**
   * Folders whose corners an EARLIER visit to this step wrote.
   *
   * The memory has to outlive the dialog, because cancelling mid-write and
   * coming back is the ordinary way to fix the folder that failed — and a
   * fresh mount forgot, so the card went back to telling the user their
   * coordinate file had been ignored and sending them to edit corners that
   * came from that exact file two minutes earlier.
   */
  cornersWrittenBefore?: ReadonlySet<string>;
  /** Announced as it happens, so the wizard can hand it back on the next visit. */
  onCornersWritten?: (folderName: string) => void;
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * `res.redirected` is the expired-Supabase-session tell documented in
 * CLAUDE.md: the middleware redirects to /sign-in and fetch follows it, so the
 * response is a cheerful 200 full of sign-in HTML. Without this check the
 * dialog would report success and the wizard would carry on importing into
 * Properties that were never created.
 */
function assertNotRedirected(res: Response, sessionMsg: string): void {
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

async function fetchPlan(
  folders: { folderName: string; tarlaSola: string; parcela: string; offeredCornerCount: number }[],
  sessionMsg: string,
): Promise<FolderPlan[]> {
  const res = await fetch("/api/admin/import/property-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folders }),
  });
  assertNotRedirected(res, sessionMsg);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { plans?: FolderPlan[] };
  return body.plans ?? [];
}

async function ensureProperty(
  payload: {
    tarlaSola: string;
    parcela: string;
    nickname: string | null;
    corners: Corner[];
    confirm?: { existingId: string; addCorners: boolean };
  },
  sessionMsg: string,
  signal: AbortSignal,
): Promise<EnsureResult> {
  const res = await fetch("/api/admin/import/property", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  assertNotRedirected(res, sessionMsg);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as EnsureResult;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyStepDialog({
  entries,
  rootFolderName,
  topLevelDirNames,
  onCancel,
  onResolved,
  onPropertyResolved,
  onWriteStarted,
  cornersWrittenBefore,
  onCornersWritten,
}: Props) {
  const t = useTranslations("adminImport.wizard.propertyStep");

  // `entries` is stable for this dialog's life — the wizard cannot re-walk
  // while it is open — so the grouping is computed once.
  const grouping = useMemo(
    () => groupByPropertyFolder(entries, topLevelDirNames ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [coordinates, setCoordinates] = useState<Map<string, ParsedCoordinates>>(new Map());
  const [plans, setPlans] = useState<FolderPlan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Bumped to re-run the load — the retry after a failed plan, and after a `stale`. */
  const [reloadKey, setReloadKey] = useState(0);

  /** folderName → the user ticked "link my documents to this Property". */
  const [linkConfirmed, setLinkConfirmed] = useState<Record<string, boolean>>({});
  /** folderName → the user ticked "and give it this folder's corners". */
  const [cornersConfirmed, setCornersConfirmed] = useState<Record<string, boolean>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  /**
   * Synchronous in-flight latch for Confirm (kept from Slice #23.03.Import).
   *
   * `submitting` alone is not enough: setting state does not disable the button
   * until React has re-rendered, so every click dispatched inside that window
   * still passes the `disabled` gate and still runs the handler.
   *
   * ⚠️ **This is no longer what stops a duplicate Property**, and it never
   * really was — it stops the clicks this tab can see, not a second tab, a
   * retried request or the same archive imported again next month. Since
   * #26.07 the create is idempotent on the server, under an advisory lock on
   * the parcel's identity (`src/lib/properties/import-property.ts`). The latch
   * survives because firing the same five-request sequence twice is still
   * pointless and still confusing to watch.
   */
  const inFlightRef = useRef(false);

  /**
   * The write loop's abort handle.   (Slice #26.07, adversarial round 4)
   *
   * ⚠️ **Cancel used to be `disabled={submitting}`, and so did Escape and the
   * retry — which meant that while the loop was running EVERY control in this
   * dialog was dead, with no timeout on any of its three fetches.** Before this
   * slice that guarded one POST. It now guards up to five, and each one opens
   * with `pg_advisory_xact_lock` on the parcel's identity: a second tab holding
   * that lock, or a saturated connection pool, and the request never returns,
   * `submitting` never clears, and the only way out is reloading the browser —
   * losing the walk, the scan spend and the metadata pass with it. That is the
   * unfixable-screen class this codebase already shipped once.
   *
   * Aborting is safe precisely because of what the lock buys: every write is
   * idempotent on the parcel's identity, so a folder that landed stays landed
   * and a folder that did not is created by the next attempt. Nothing is left
   * half-written by giving up.
   */
  const abortRef = useRef<AbortController | null>(null);

  /**
   * How many Properties THIS DIALOG has actually written, across every attempt.
   *
   * State rather than a ref, and rendered as its OWN line rather than appended
   * to `submitError`, because it is not an error and it must not be dismissed
   * with one: when a re-plan also fails, the only enabled control on screen is
   * the retry button, and that button clearing the one sentence saying two
   * Properties are already in the archive is how a user goes hunting for
   * duplicates to delete.
   *
   * ⚠️ **A ref, and accumulated across attempts, and both halves were bugs.**
   * `resolved.length` counted folders ANSWERED, so a re-import of an archive
   * whose Properties all exist reported "2 proprietăți au fost deja create sau
   * actualizate" having written nothing — sending the user hunting for
   * duplicates among rows that predate the run. Counting per attempt was the
   * mirror image: after a re-plan, folders written by the FIRST attempt come
   * back `linked` with nothing to add, so a second failure reported zero while
   * two real Properties sat in the archive. The number a user is given here has
   * to be true of the whole visit, which is what this dialog's lifetime is.
   */
  const [writtenEver, setWrittenEver] = useState(0);

  /**
   * Folders whose corners THIS DIALOG wrote, across every attempt.
   *
   * After a partial failure the re-plan sees those Properties with corners, so
   * `planForMatches` reports `cornersKept` and the card said "Colțurile
   * existente rămân neschimbate. Dacă vreți să le înlocuiți… modificați
   * colțurile acolo" — about the very corners this dialog had just written from
   * that very file, thirty seconds earlier. The user was told their coordinate
   * file had been ignored and sent to fix something already correct, on the
   * recovery path, which is when they are least sure what happened.
   *
   * The server could answer this (`cornersMatchOffered` is computed there), but
   * the PLAN does not carry it and the client already knows: it did the write.
   */
  const [cornersWrittenFor, setCornersWrittenFor] = useState<ReadonlySet<string>>(
    () => new Set(cornersWrittenBefore),
  );

  // ── Load: parse the coordinate files, then ask for the plan ───────────────
  //
  // Every setState below runs in an async continuation, never synchronously in
  // the effect body — that is what react-hooks/set-state-in-effect forbids.
  useEffect(() => {
    let mounted = true;

    (async () => {
      const parsed = new Map<string, ParsedCoordinates>();

      for (const group of grouping.properties) {
        if (group.coordinateFile === null) {
          parsed.set(group.folderName, { corners: [], error: null });
          continue;
        }
        let corners: Corner[] = [];
        let error: string | null = null;
        try {
          const file = await group.coordinateFile.handle.getFile();
          corners = await parseCoordinateFile(file);
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }
        if (!mounted) return;
        parsed.set(group.folderName, { corners, error });
        setCoordinates(new Map(parsed));
      }
      if (!mounted) return;
      setCoordinates(new Map(parsed));

      try {
        const next = await fetchPlan(
          grouping.properties.map((group) => ({
            folderName: group.folderName,
            tarlaSola: group.tarlaSola,
            parcela: group.parcela,
            offeredCornerCount: parsed.get(group.folderName)?.corners?.length ?? 0,
          })),
          t("errorSession"),
        );
        if (!mounted) return;
        // A fresh plan invalidates every answer given against the previous one.
        // Not a nicety: after a `stale` outcome the whole point of re-planning
        // is that what the user agreed to is no longer what is there.
        setLinkConfirmed({});
        setCornersConfirmed({});
        setPlans(next);
        setLoadError(null);
      } catch (err) {
        if (!mounted) return;
        setLoadError(err instanceof Error ? err.message : String(err));
        setPlans(null);
      }
    })();

    return () => {
      mounted = false;
    };
    // `grouping` is derived from the stable `entries` prop; `t` is stable for
    // a locale. `reloadKey` is the only real dependency — see the retry button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  // ── What the screen is allowed to do ──────────────────────────────────────

  const loading = plans === null && loadError === null;

  /**
   * Known from the folder alone, before any request. `introNoProperties` says
   * it in the header, so the body no longer repeats it — the second sentence
   * used to sit forty pixels under the first, saying the same thing twice.
   */
  const hasNoPropertyFolders = grouping.properties.length === 0;

  /**
   * Read the folders and the database again, and throw away every answer given
   * against the previous reading. The one action behind both the load-failure
   * retry and the ambiguous block's "Încearcă din nou" — the user has been in
   * the properties list resolving a duplicate, and the point of the button is
   * that this screen no longer believes what it said before they went.
   */
  /**
   * Read the folders and the database again. Leaves any write error ON SCREEN.
   *
   * ⚠️ **The split between this and `recheck` below is load-bearing, and it
   * exists because merging them silently deleted the one message the user
   * needed.** A `stale` outcome sets `submitError` and then re-plans; when both
   * were the same function, the clear ran in the same continuation as the set,
   * the last write won, and every `stale` blanked the screen — ticks gone, no
   * explanation, and no word of the Properties the attempt had already created.
   */
  const reload = useCallback(() => {
    setLoadError(null);
    setPlans(null);
    setReloadKey((k) => k + 1);
  }, []);

  /**
   * What the "Încearcă din nou" button does: reload, AND drop the error the
   * user has finished reading. Pressing it is the acknowledgement — which is
   * exactly what the `stale` path does not have, and why it uses `reload`.
   */
  const recheck = useCallback(() => {
    setSubmitError(null);
    reload();
  }, [reload]);

  /**
   * Folders whose plan the user has not answered.
   *
   * ⚠️ **The corner tick is deliberately NOT in here.** An earlier version of
   * this slice required it too, which made it a toll gate wearing a
   * confirmation's clothes: a user who wanted to link the documents but not
   * push a stale coordinate export onto a Property had exactly one option,
   * abandon the import. Leaving it unticked now means what it says — the
   * corners are not added — and `ensurePropertyForFolder` writes none.
   *
   * `ambiguous` can never be answered from this screen at all, which is the
   * point: two Properties for one parcel is a state only the user can resolve,
   * in the properties list, before this import can continue.
   */
  const unanswered = useMemo(() => {
    if (plans === null) return [];
    return plans.filter((plan) => {
      if (plan.action === "create") return false;
      if (plan.action === "ambiguous") return true;
      return !linkConfirmed[plan.folderName];
    });
  }, [plans, linkConfirmed]);

  const hasAmbiguous = (plans ?? []).some((p) => p.action === "ambiguous");
  /** Will this run end up with at least one Property for `common` to attach to? */
  const willResolveAnyProperty = (plans ?? []).some((p) => p.action !== "ambiguous");
  const canConfirm = !submitting && !loading && plans !== null && unanswered.length === 0;

  // ── Confirm: create or link, one folder at a time ─────────────────────────

  const handleConfirm = useCallback(async () => {
    // See inFlightRef above — this must run before the first await.
    if (inFlightRef.current) return;
    if (plans === null) return;
    inFlightRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    setSubmitting(true);
    setSubmitError(null);
    setProgress({ done: 0, total: plans.length });

    // The other direction of the contradiction the loop's `throw` catches: a
    // property folder the plan never mentioned would get no card, no Property
    // and no write, and every document under it would import linked to nothing.
    // Unreachable today — `planPropertyFolders` answers one plan per folder —
    // but the comment inside the loop claims this whole class fails loudly, and
    // half of it did not.
    const unplanned = grouping.properties
      .filter((group) => !plans.some((plan) => plan.folderName === group.folderName))
      .map((group) => group.folderName);
    if (unplanned.length > 0) {
      // ⚠️ Named by the SUBFOLDERS that are missing, not by `rootFolderName`.
      // The sentence is "Folderul „{folder}" nu mai poate fi găsit în lista
      // citită la început" — pointed at the chosen folder it told the user
      // their whole archive had vanished, when the chosen folder is fine.
      setSubmitError(t("errorFolderMissing", { folder: unplanned.join(", ") }));
      setSubmitting(false);
      inFlightRef.current = false;
      abortRef.current = null;
      return;
    }

    // ⚠️ AFTER the guard above, and only when there is something to write.
    // Announced before it, the mismatch path — which sends no request at all —
    // latched `propertiesTouched` in the wizard, and the Cancel then asserted
    // that properties stay behind on a run that made none: the same false
    // statement this guard's own `plans.length > 0` test was added to remove,
    // one door along.
    if (plans.length > 0) onWriteStarted?.();

    let wroteThisAttempt = 0;
    const resolved: ResolvedProperty[] = [];
    const resolvedByFolder = new Map<string, string>();
    const cornerSourceByPath = new Map<string, string>();


    try {
      for (const plan of plans) {
        const group = grouping.properties.find((g) => g.folderName === plan.folderName);
        if (group === undefined) {
          // The plan and the grouping disagree about which folders exist, which
          // is a contradiction inside this component rather than a state of the
          // world. An earlier version skipped the folder silently: its Property
          // was never resolved, its documents imported linked to nothing, and
          // the progress line finished at "4 din 5" while the run reported
          // success. Failing loudly is the only honest option left here.
          throw new Error(t("errorFolderMissing", { folder: plan.folderName }));
        }
        const corners = coordinates.get(plan.folderName)?.corners ?? [];

        const result = await ensureProperty(
          {
            tarlaSola: group.tarlaSola,
            parcela: group.parcela,
            // The folder name IS the nickname — it is what the user will
            // recognise in a list, and #26.01 made it a name they chose on
            // purpose rather than one the system decoded.
            nickname: group.folderName,
            corners,
            confirm:
              plan.action === "link" && plan.matches.length === 1
                ? {
                    existingId: plan.matches[0].id,
                    addCorners: cornersConfirmed[plan.folderName] === true,
                  }
                : undefined,
          },
          t("errorSession"),
          controller.signal,
        );

        if (result.outcome === "stale" || result.outcome === "needs-confirmation") {
          // The world moved between the plan and the write. Nothing was
          // written for this folder, and every folder before it was written
          // exactly once and is idempotent on a retry — so re-planning and
          // asking again is safe, and is the only honest thing to do.
          throw new StalePlanError(t("errorStale", { folder: plan.folderName }));
        }

        const property = result.property;
        // ⚠️ Keyed on "are this Property's corners the ones this folder
        // offered", NOT on "did this call write them" — see the note beside
        // `cornersMatchOffered` in `import-property.ts`. On a retry after a
        // half-finished run the earlier folders write nothing and would
        // otherwise lose the coordinate-source claim they had earned.
        const sourcePath =
          result.cornersMatchOffered && group.coordinateFile !== null
            ? group.coordinateFile.path
            : null;

        const entry: ResolvedProperty = {
          folderName: plan.folderName,
          id: property.id,
          code: property.code,
          nickname: property.nickname,
          cornerCount: property.cornerCount,
        };
        resolved.push(entry);
        if (result.outcome === "created" || result.cornersAdded > 0) {
          wroteThisAttempt += 1;
          setWrittenEver((n) => n + 1);
          if (result.cornersMatchOffered) {
            setCornersWrittenFor((prev) => new Set(prev).add(plan.folderName));
            onCornersWritten?.(plan.folderName);
          }
        }
        resolvedByFolder.set(plan.folderName, property.id);
        if (sourcePath !== null) cornerSourceByPath.set(sourcePath, property.id);
        // Announced now rather than at the end: if the NEXT folder fails, this
        // one is already in the archive and the Cancel has to know.
        onPropertyResolved?.(entry);

        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }

      onResolved({
        properties: resolved,
        assignment: assignEntryProperties(grouping, resolvedByFolder),
        cornerSourceByPath,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        // The user pressed Cancel or Escape. The dialog is unmounting, so there
        // is nobody to tell — and a raw `AbortError` is an untranslated English
        // DOMException, which is exactly what must never reach a Romanian
        // screen if `onCancel` ever stops unmounting synchronously.
        inFlightRef.current = false;
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      // The count is part of the error, not a footnote: three Properties may
      // already exist, and a user who does not know that goes looking for a
      // duplicate to delete the next time the archive is imported.
      // The partial-write note is NOT appended here — it is its own line, and
      // it outlives this message. See `writtenEver`.
      setSubmitError(message);
      setSubmitting(false);
      // Released on failure only, so the user can correct and retry. On
      // success the dialog is unmounted by onResolved and the latch stays shut.
      inFlightRef.current = false;
      // `reload`, not `recheck`: the message set three lines up is the whole
      // point of this branch.
      //
      // ⚠️ …and on ANY failure that already wrote something, not only on a
      // `stale`. A partial attempt has changed the very facts the plan was
      // built from — a folder that took its corners this attempt now HAS
      // corners — so re-sending the same confirmations makes the server answer
      // `stale` about a change this dialog made itself thirty seconds earlier,
      // and the user reads "no longer what you were shown" about their own
      // click. Re-planning converges in one attempt instead of two and never
      // says that sentence.
      if (err instanceof StalePlanError || wroteThisAttempt > 0) reload();
    } finally {
      abortRef.current = null;
    }
  }, [
    plans,
    grouping,
    coordinates,
    cornersConfirmed,
    onResolved,
    onPropertyResolved,
    onWriteStarted,
    onCornersWritten,
    reload,
    t,
  ]);

  /**
   * Give up: stop whatever request is in flight, then leave.
   *
   * Not `disabled={submitting}` — see `abortRef`. Whatever has already been
   * written stays written and the wizard has been told about it one Property at
   * a time, so leaving mid-loop loses nothing but the rest of the queue.
   */
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    onCancel();
  }, [onCancel]);

  // ESC cancels, at any point — including mid-write, which is the one moment
  // there is something to escape from.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCancel]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-property-step-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <h2
            id="import-property-step-title"
            className="text-base font-semibold text-ink dark:text-zinc-100"
          >
            {t("title")}
          </h2>
          {/* ⚠️ Two intros, for the reason `commonNoteUnlinked` exists one
              element down: the single sentence asserted that the folder "holds
              one subfolder per property" and sat forty pixels above the body
              saying it holds none. The same lie, in the header, added by the
              fix for the lie in the body. */}
          <p className="mt-1 text-sm text-fade dark:text-zinc-400">
            {/* Keyed on the GROUPING, not on the plan: the folders are known
                the moment this dialog mounts, so the honest sentence is
                available while the plan is still loading and while it has
                failed. Keyed on `plans` it showed "holds one subfolder per
                property" for the whole load of a folder that holds none. */}
            {hasNoPropertyFolders
              ? t("introNoProperties", { folder: rootFolderName })
              : t("intro", { folder: rootFolderName })}
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {loading && <ActivityCue>{t("loading")}</ActivityCue>}

          {loadError !== null && (
            <div
              role="alert"
              className="space-y-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              <p>{t("planFailed", { error: loadError })}</p>
              <RecheckButton onClick={recheck} disabled={submitting} t={t} />
            </div>
          )}

          {plans?.map((plan) => (
            <PropertyPlanCard
              key={plan.folderName}
              plan={plan}
              group={grouping.properties.find((g) => g.folderName === plan.folderName)}
              parsed={coordinates.get(plan.folderName)}
              linkConfirmed={linkConfirmed[plan.folderName] === true}
              cornersConfirmed={cornersConfirmed[plan.folderName] === true}
              cornersAlreadyOurs={cornersWrittenFor.has(plan.folderName)}
              onLinkConfirmed={(value) =>
                setLinkConfirmed((prev) => ({ ...prev, [plan.folderName]: value }))
              }
              onCornersConfirmed={(value) =>
                setCornersConfirmed((prev) => ({ ...prev, [plan.folderName]: value }))
              }
              disabled={submitting}
              t={t}
            />
          ))}

          {plans !== null &&
            grouping.common.length +
              grouping.floating.length +
              grouping.unassigned.length >
              0 && (
            <div className="space-y-1 border-t border-crease pt-3 text-xs text-fade dark:border-zinc-800 dark:text-zinc-400">
              {/* ⚠️ Two sentences, because one of them would be a lie half the
                  time. "vor fi legate de toate proprietățile de mai sus" was
                  printed unconditionally, including under `noProperties` — so a
                  chosen folder holding nothing but `common` promised a business
                  user that sixty documents would be linked to a list of
                  properties that was empty three lines above. A folder is only
                  going to produce a Property if its plan is not `ambiguous`. */}
              {/* Only when the folder is actually there. The ordinary import —
                  five property subfolders and neither shared folder — was
                  printing two sentences about two folders that do not exist,
                  which reads as "the system expected something I have not
                  given it". The `> 0` gate on `unassigned` below was always
                  right; these two are now the same. */}
              {grouping.common.length > 0 && (
                <p>
                  {willResolveAnyProperty
                    ? t("commonNote", { count: grouping.common.length })
                    : t("commonNoteUnlinked", { count: grouping.common.length })}
                </p>
              )}
              {grouping.floating.length > 0 && (
                <p>{t("floatingNote", { count: grouping.floating.length })}</p>
              )}
              {grouping.unassigned.length > 0 && (
                <p className="text-amber-700 dark:text-amber-400">
                  {t("unassignedNote", { count: grouping.unassigned.length })}
                </p>
              )}
            </div>
          )}

          {/* ⚠️ The button the `ambiguousBlocks` sentence NAMES.
              An adversarial round found it rendered only inside the
              load-failure block above — so a user told "keep one, then come
              back and press Încearcă din nou" was looking at a screen whose
              only enabled control was Anulează, with Continuă permanently dead.
              That is the #26.02 unfixable-message failure rebuilt: an
              instruction the user cannot carry out where they are standing. */}
          {hasAmbiguous && (
            <div
              role="status"
              className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <p>{t("ambiguousBlocks")}</p>
              <RecheckButton onClick={recheck} disabled={submitting} t={t} />
            </div>
          )}

          {submitting && progress.total > 0 && (
            <ActivityCue>
              {t("progress", { done: progress.done, total: progress.total })}
            </ActivityCue>
          )}

          {submitError && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {submitError}
            </p>
          )}

          {/* A fact about this visit, not a failure — so it survives the retry
              button, which dismisses the message above it. Nothing else on the
              screen would tell a user that Properties from an abandoned attempt
              are already in the archive, and not telling them is how they end
              up deleting one. */}
          {/* ⚠️ `!submitting`. As a ref this could not render; made state in the
              round-4 fix it started appearing mid-loop on every ordinary
              import — "O proprietate a fost deja creată… și rămâne în sistem"
              climbing to four under the progress cue, in amber, on a run that
              was going perfectly. So it is shown only once the loop has
              stopped, which is the only moment it is information rather than
              an alarm. It is NOT covered by `progress` in the meantime —
              `progress` counts folders answered THIS attempt and resets to zero
              on each one, which is exactly the distinction `writtenEver` exists
              to make. During a retry the number is simply not on screen. */}
          {!submitting && writtenEver > 0 && (
            <p
              role="status"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
            >
              {t("errorPartial", { count: writtenEver })}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-card-rim px-5 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={handleCancel}
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

function RecheckButton({
  onClick,
  disabled,
  t,
}: {
  onClick: () => void;
  disabled: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClass({ variant: "secondary", size: "xs" })}
    >
      {t("retry")}
    </button>
  );
}

/**
 * Thrown when the plan the user answered is no longer the plan the server
 * sees. Its own class so the handler can tell it from a network failure and
 * re-plan instead of merely reporting.
 */
class StalePlanError extends Error {}

// ---------------------------------------------------------------------------
// One property folder
// ---------------------------------------------------------------------------

function PropertyPlanCard({
  plan,
  group,
  parsed,
  linkConfirmed,
  cornersConfirmed,
  cornersAlreadyOurs,
  onLinkConfirmed,
  onCornersConfirmed,
  disabled,
  t,
}: {
  plan: FolderPlan;
  group: PropertyFolderGroup | undefined;
  parsed: ParsedCoordinates | undefined;
  linkConfirmed: boolean;
  cornersConfirmed: boolean;
  /** Did THIS dialog write the corners the match now has? See `cornersWrittenFor`. */
  cornersAlreadyOurs: boolean;
  onLinkConfirmed: (value: boolean) => void;
  onCornersConfirmed: (value: boolean) => void;
  disabled: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const coordinateFile: FSFileEntry | null = group?.coordinateFile ?? null;
  const documentCount = group?.entries.length ?? 0;
  const existing = plan.matches.length === 1 ? plan.matches[0] : null;

  return (
    <section className="space-y-2 rounded-lg border border-card-rim px-4 py-3 dark:border-zinc-700">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate font-mono text-sm font-semibold text-ink dark:text-zinc-100">
          {plan.folderName}
        </h3>
        <span className="shrink-0 text-xs text-fade">
          {t("documentCount", { count: documentCount })}
        </span>
      </div>

      {/* The identifiers as they will be WRITTEN — decoded, not as on disk.
          `47per2` on the folder and `47/2` in the field is the one difference
          a user must be able to see before agreeing to it. */}
      <p className="text-xs text-fade dark:text-zinc-400">
        {/* `plan.tarlaSola` arrives DECODED — the server ran `cadastralValue`
            over it, which is exactly what is about to be written. Decoding it
            again here was a no-op that implied the opposite. */}
        {t("cadastral", { tarla: plan.tarlaSola, parcela: plan.parcela })}
      </p>

      {/* ── What file was found ────────────────────────────────────────────
          ⚠️ Two sentences, and the split is the whole fix. These used to end
          "— proprietatea rămâne fără colțuri", which is a statement about the
          OUTCOME and was printed from the file alone. On a `link` card whose
          match already holds eight corners it said the property would have
          none: the one screen whose job is to say what happens to an existing
          Property, saying the opposite. The outcome sentence is below and
          reads the plan. */}
      {coordinateFile === null ? (
        <p className="text-xs text-fade dark:text-zinc-400">{t("coordinateNone")}</p>
      ) : parsed?.error ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t("coordinateUnreadable", { name: coordinateFile.name })}
        </p>
      ) : parsed?.corners == null ? (
        // Unreachable through the normal flow — the cards render only once
        // `plans` is set, and `plans` is set only after every coordinate file
        // has been parsed. Kept as the honest answer rather than a message,
        // because a sentence for a state that cannot occur is copy nobody can
        // ever check. (`coordinateParsing` was such a sentence; it is gone.)
        <p className="text-xs text-fade dark:text-zinc-400">{t("coordinateNone")}</p>
      ) : (
        <p className="text-xs text-fade dark:text-zinc-400">
          {t("coordinateFound", {
            name: coordinateFile.name,
            count: parsed.corners.length,
          })}
        </p>
      )}

      {/* ── …and what the property will end up with ───────────────────────
          ⚠️ `action === "link"`, NOT `!== "ambiguous"`. `planForMatches` sets
          `cornersToAdd: 0` on every create — deliberately, because a create's
          corners travel inside the create itself — so the looser gate was true
          of every new property regardless of what its file held, and every card
          in an ordinary five-folder import carried "Proprietatea va rămâne fără
          colțuri" forty pixels above "Se va crea o proprietate nouă, cu 6
          colțuri". The outcome of a CREATE is `willCreate`'s job and it already
          states it, corners and all; this sentence exists for the link case the
          split was made for, where nothing else says it. */}
      {plan.action === "link" && plan.cornersKept === 0 && plan.cornersToAdd === 0 && (
        <p className="text-xs text-fade dark:text-zinc-400">{t("cornersNone")}</p>
      )}

      {/* What will happen */}
      {plan.action === "create" && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("willCreate", { corners: plan.offeredCornerCount })}
        </p>
      )}

      {plan.action === "ambiguous" && (
        <div className="space-y-1 text-sm text-red-700 dark:text-red-400">
          <p>{t("ambiguous", { count: plan.matches.length })}</p>
          {/* Codes alone were all this said until an adversarial round pointed
              out that this is the ONE card where the user has to choose which
              Property survives — and `PROP-00041, PROP-00107` is not enough to
              choose with. The nickname and the corner count are what tell them
              apart, and the `link` card next door already shows the first. */}
          <ul className="space-y-0.5">
            {plan.matches.map((m) => (
              <li key={m.id} className="flex items-baseline gap-2">
                <span className="font-mono text-xs">{m.code}</span>
                <span className="flex-1 truncate">{m.nickname ?? t("noNickname")}</span>
                <span className="text-xs">
                  {t("chipCorners", { count: m.cornerCount })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.action === "link" && existing !== null && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {t("alreadyExists", {
              code: existing.code,
              nickname: existing.nickname ?? t("noNickname"),
            })}
          </p>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={linkConfirmed}
              disabled={disabled}
              onChange={(e) => onLinkConfirmed(e.target.checked)}
            />
            {/* The count is IN the sentence, not merely passed to it. An
                adversarial round found it computed, handed over and never
                rendered — so the one number a user needs before agreeing to
                attach documents to an existing property was the one the
                sentence omitted, sitting instead in the card header above. */}
            {t("confirmLink", { count: documentCount, code: existing.code })}
          </label>

          {plan.cornersToAdd > 0 && (
            <label className="flex cursor-pointer items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={cornersConfirmed}
                disabled={disabled}
                onChange={(e) => onCornersConfirmed(e.target.checked)}
              />
              {t("confirmCorners", { count: plan.cornersToAdd, code: existing.code })}
            </label>
          )}

          {/* ⚠️ No `offeredCornerCount > 0` conjunct. With it, a match holding
              eight corners in a subfolder with no coordinate file said nothing
              here at all — and the only corner sentence on the card was the
              file one above, which used to claim the property would have none. */}
          {plan.cornersKept > 0 && (
            <p className="text-xs text-amber-900 dark:text-amber-200">
              {cornersAlreadyOurs
                ? t("cornersAlreadyApplied", { count: plan.cornersKept })
                : plan.offeredCornerCount > 0
                  ? t("cornersKept", {
                      existing: plan.cornersKept,
                      offered: plan.offeredCornerCount,
                    })
                  : t("cornersKeptNoFile", { existing: plan.cornersKept })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
