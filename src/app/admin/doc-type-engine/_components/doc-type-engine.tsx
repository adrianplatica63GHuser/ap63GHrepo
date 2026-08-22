"use client";

/**
 * DocTypeEngine — „Distilare Tipizate".                         (Slice #29.09)
 *
 * WHAT THIS SCREEN IS
 * -------------------
 * Point it at a folder of ten to twenty documents that are all of one type,
 * choose how much of them a field has to appear in, and it proposes the form
 * that type should have. The user renames the labels to something official,
 * rejects what does not belong, and approves having SEEN each field pick up a
 * real value out of each sample. When the form is saved the type is finished,
 * and an import that stopped at #29.08's gate can be started again.
 *
 * ⚠️ **IT IMPORTS NOTHING, CREATES NO DOCUMENT, AND WRITES ONLY
 * `template_fields`.** That sentence is load-bearing rather than descriptive.
 * `nav-config.ts` carries a comment from #24.02a saying a second nav entry
 * would have been "a second door to a picker that must have exactly one" — and
 * this slice adds a second picker. It does not break that rule, because that
 * rule is about the IMPORT: the files this screen reads are never written
 * anywhere, no `document` row is created, and there is no path from here into
 * the archive. The comment in `nav-config.ts` has been updated to say so, or
 * the next reader would correctly read it as forbidding this page.
 *
 * ⚠️ **FOUR OF THE FIVE VERBS ALREADY EXIST, IN TWO OTHER SCREENS, AND THIS
 * EXTENDS THE PROPOSAL ONE.** `discover-review-dialog.tsx` does accept, reject,
 * edit-label and edit-type on a machine proposal, and saves through the same
 * additive PUT with the same `knownKeys` concurrency check; that is the shape
 * followed here. `document-type-form-editor.tsx` does the same verbs plus
 * reorder and group on a STORED form, through the value-lists full-row PUT,
 * because the additive PUT "cannot rename, reorder or remove" — its own header
 * says so. This screen never edits a stored field, so the additive door is the
 * right one and the 409 is kept.
 *
 * ⚠️ **THE KEY IS SHOWN AND NEVER EDITABLE, AND THE SENTENCE IS REUSED RATHER
 * THAN REWRITTEN.** `valueList.templateFields.keyNote` already says it in
 * Romanian: the key is the name under which every document of this type already
 * keeps its value; renaming a label does not touch it. Rewriting a key orphans
 * real data behind a form that can no longer see it. One sentence, one place.
 *
 * ⚠️ **THE PERCENTAGE IS CHANGEABLE ON THE PROPOSAL SCREEN, AND NOTHING IS
 * RE-READ WHEN IT CHANGES.** The counting rule is a pure function over the
 * cluster table, so moving the line is arithmetic, not a call. This is what
 * makes the below-the-line list a saying rather than a feature: the user can
 * watch candidates cross the line and see, before approving anything, exactly
 * which ones will land in „Note extinse" instead.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { buttonClass } from "@/lib/ui/button-styles";
import { COST_NOTE_CLASS } from "@/lib/ui/cost-note";
import {
  fetchDocumentTypeCatalogue,
  type DocumentTypeCatalogueRow,
} from "@/lib/import/document-type-catalogue";
import { documentTypeHasForm } from "@/lib/documents/status";
import { parseTemplateFields, type DocumentTemplateFieldType } from "@/lib/documents/template-fields";
import { typeMayHoldAForm } from "@/lib/import/discover-run";
import { ID_CARD_TYPE_KEYS, isIdCardTypeName } from "@/lib/import/id-card";
import { UNCLASSIFIED_DOCUMENT_TYPE_KEY } from "@/lib/documents/document-type-match";
import {
  walkFolder,
  hasReadablePage,
  type FSDirectoryHandle,
  type FSEntry,
} from "@/lib/import/folder-utils";
import {
  clusterHarvest,
  harvestPairs,
  readSamples,
  MAX_SAMPLES_PER_RUN,
  type RunProgress,
  type SampleSource,
} from "@/lib/import/sample-read-run";
import { minimumRunMs, OCR_MAX_REQUESTS_ADMIN } from "@/lib/import/sample-read-pacing";
import {
  DEFAULT_MATCHING_PERCENT,
  distilFields,
  isMatchingPercent,
  readSampleCount,
  unreadSampleCount,
  MATCHING_PERCENTS,
  type Distillation,
  type FieldCluster,
  type MatchingPercent,
  type SampleRead,
} from "@/lib/documents/field-distillation";
import {
  MAX_TEMPLATE_FIELDS,
  normaliseKeyForComparison,
  slugifyFieldKey,
  uniqueFieldKey,
} from "@/lib/documents/discover-to-template";
import { isSessionLoss, servesHtml } from "@/lib/import/ai-interpret-run";

/*
 * ⚠️ **THERE IS DELIBERATELY NO MODULE-LEVEL `_dirHandle` HERE, AND THE FIRST
 * DRAFT HAD ONE.** The import wizard keeps its picked handle in a module
 * singleton because it READS it again — for the re-check path and for the
 * cancel that nulls it — and its own comment warns that the singleton "outlives
 * the component, so after an import, a route change and a return, it still
 * holds the previous visit's folder". This screen re-reads nothing: the walk
 * happens inside the picker's own user gesture and the Files are held in state
 * from then on. A copy of that singleton here was a leaked directory handle
 * with no consumer, justified by a comment that was not true of this file.
 */

type Step = "pick" | "reading" | "review" | "saved";

/**
 * One editable row on the proposal screen.
 *
 * ⚠️ **NO `key` HERE, AND AN ADVERSARIAL ROUND IS WHY.** The first draft minted
 * the key when the proposal was built, from the machine's own label — so a run
 * whose caption rules could not find a clean wording („Notar Public MARIA
 * IONESCU", twenty deeds from two notaries) wrote a person's name into a key
 * the user is told is permanent, and renaming the label afterwards could not
 * take it back. `document-type-form-editor.tsx`'s first rule already says where
 * a key is decided: "The one place a key is decided is when a field is ADDED,
 * and even there nobody types it — `keysForRows` derives it from the Romanian
 * label." A field is added HERE when the user approves it, so the key is
 * derived from the label they approved, and shown live under it while they
 * type. Renaming the label before saving therefore fixes the key too, which is
 * the only place a user can fix it at all.
 */
type ProposalRow = {
  clusterId: string;
  labelRo: string;
  labelEn: string;
  type: DocumentTemplateFieldType;
  aiHint: string;
  include: boolean;
};

export function DocTypeEngine() {
  const t = useTranslations("docTypeEngine");
  // ⚠️ Reused, not rewritten. `valueList.templateFields.keyNote` already says in
  // Romanian that the key is the name every document of this type keeps its
  // value under, and that renaming a label does not touch it. A third round
  // found this file CLAIMING to reuse the sentence and never rendering it.
  const tKey = useTranslations("valueList.templateFields");

  const [step, setStep] = useState<Step>("pick");
  const [types, setTypes] = useState<DocumentTypeCatalogueRow[] | null>(null);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [typeId, setTypeId] = useState("");
  const [percent, setPercent] = useState<MatchingPercent>(DEFAULT_MATCHING_PERCENT);

  const [folderName, setFolderName] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleSource[]>([]);
  const [walkError, setWalkError] = useState<string | null>(null);
  const [overflow, setOverflow] = useState(0);

  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [reads, setReads] = useState<SampleRead[]>([]);
  const [clusters, setClusters] = useState<FieldCluster[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  /**
   * ⚠️ **Everything on this line was computed, returned, typed — and shown
   * nowhere, until an adversarial round grepped for it.** Pages the route did
   * not send, readings cut off at the model's output limit, and pairs the
   * clustering call never saw are each a way in which the proposal is a
   * partial answer, and two route headers claim the screen says so. It does
   * now.
   */
  const [partial, setPartial] = useState<{
    skippedPages: number;
    truncatedReads: number;
    uncompared: number;
    clusterTruncated: boolean;
  }>({ skippedPages: 0, truncatedReads: 0, uncompared: 0, clusterTruncated: false });
  const [cancelling, setCancelling] = useState(false);
  const [clustering, setClustering] = useState(false);
  /**
   * ⚠️ Remembered, because a round found `run.cancelled` reachable only when
   * NOTHING was read — so cancelling after five of twenty showed a proposal
   * and „15 mostre nu au putut fi citite", which is not what happened.
   */
  const [wasCancelled, setWasCancelled] = useState(false);

  /**
   * ⚠️ **EVERY EDIT THE USER HAS MADE, KEPT APART FROM THE ROWS — the shape
   * `discover-review-dialog.tsx` uses, and a round showed why it is not
   * optional here either.** `rows` only ever holds the fields currently above
   * the line, so raising the Matching % and lowering it back rebuilt a
   * dropped field from scratch: the rename gone, the type change gone, and — the
   * one that writes — a field the user had deliberately UNTICKED came back
   * ticked and would have been saved onto the type. Moving the line is the
   * interaction this screen advertises, so the destructive round trip was the
   * encouraged one.
   */
  const decisionsRef = useRef(new Map<string, ProposalRow>());
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /**
   * What a 409 told us the stored keys REALLY are, and for which type.
   *
   * ⚠️ **DERIVED, NOT SYNCHRONISED — and `react-hooks/set-state-in-effect` is
   * right about why.** This was an effect calling `setBaselineKeys` whenever
   * `existingFields` changed, which is a cascading render and, worse, was the
   * second version of a bug: an earlier effect keyed on `step` threw the 409's
   * answer away every time „Ia de la capăt" returned to the pick step. The
   * baseline is simply the type's stored keys, with one override — the list a
   * conflict handed back — and the override carries the type id it belongs to,
   * so choosing a different type discards it without anything having to watch
   * for that.
   */
  const [conflictBaseline, setConflictBaseline] = useState<
    { typeId: string; keys: string[] } | null
  >(null);

  const abortRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // ── The archive's type list ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetchDocumentTypeCatalogue()
      .then((rows) => {
        if (!cancelled) setTypes(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // The catalogue throws the sentinel `session-expired` rather than a
        // sentence — the protocol #29.08 recorded. Mapped here, not shown raw.
        setTypesError(
          err instanceof Error && err.message === "session-expired"
            ? t("types.sessionLost")
            : t("types.loadFailed"),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  /**
   * ⚠️ **The catch-all's id, and the reason this is looked up rather than
   * assumed.** `typeMayHoldAForm` takes `fallbackTypeId` because the refusal is
   * about the ROW, not about a key spelled in this file. A screen that tested
   * `key === "UNCLASSIFIED"` by hand would be a second opinion about which
   * types may hold a form, which is the shape #29.06 deleted.
   */
  const fallbackTypeId = useMemo(
    () => types?.find((r) => r.key === UNCLASSIFIED_DOCUMENT_TYPE_KEY)?.id ?? null,
    [types],
  );

  const refusalFor = useCallback(
    (row: DocumentTypeCatalogueRow): "idCard" | "fallback" | null => {
      const typeIsIdCard =
        (ID_CARD_TYPE_KEYS as readonly string[]).includes(row.key) || isIdCardTypeName(row.name);
      if (typeMayHoldAForm({ typeId: row.id, fallbackTypeId, typeIsIdCard })) return null;
      return typeIsIdCard ? "idCard" : "fallback";
    },
    [fallbackTypeId],
  );

  const selectedType = useMemo(
    () => types?.find((r) => r.id === typeId) ?? null,
    [types, typeId],
  );
  const existingFields = useMemo(
    () => (selectedType ? parseTemplateFields(selectedType.templateFields) : []),
    [selectedType],
  );

  // ── Step 1: the folder ────────────────────────────────────────────────────
  const handlePickFolder = useCallback(async () => {
    if (typeof window === "undefined" || !("showDirectoryPicker" in window)) {
      setWalkError(t("folder.unsupported"));
      return;
    }
    let handle: FSDirectoryHandle;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handle = (await (window as any).showDirectoryPicker({ mode: "read" })) as FSDirectoryHandle;
    } catch {
      return; // cancelled — no-op, exactly as the import wizard treats it
    }

    setFolderName(handle.name);
    setWalkError(null);
    setSamples([]);
    setOverflow(0);

    // A lapsed grant can only be recovered inside a user gesture, and this is
    // one. The same hygiene the wizard's re-check does.
    try {
      if (typeof handle.queryPermission === "function") {
        let state = await handle.queryPermission({ mode: "read" });
        if (state === "prompt" && typeof handle.requestPermission === "function") {
          state = await handle.requestPermission({ mode: "read" });
        }
        if (state === "denied") {
          setWalkError(t("folder.walkFailed"));
          return;
        }
      }
    } catch {
      /* fall through — the walk below reports the failure properly */
    }

    let entries: FSEntry[];
    try {
      entries = await walkFolder(handle);
    } catch {
      setWalkError(t("folder.walkFailed"));
      return;
    }
    const found = await samplesFromEntries(entries);
    // ⚠️ Capped BEFORE anything is billed, and the overflow is named on screen.
    // The first draft read all of them and then failed validation on the last
    // request of the run — see MAX_SAMPLES_PER_RUN.
    setSamples(found.slice(0, MAX_SAMPLES_PER_RUN));
    setOverflow(Math.max(0, found.length - MAX_SAMPLES_PER_RUN));
  }, [t]);

  // ── Step 2: the run ───────────────────────────────────────────────────────
  const startRun = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStep("reading");
    setRunError(null);
    setProgress(null);
    setCancelling(false);
    setWasCancelled(false);
    setClustering(false);
    setPartial({ skippedPages: 0, truncatedReads: 0, uncompared: 0, clusterTruncated: false });

    // ⚠️ Wrapped, because `clustering` hides the Cancel button and `reading` is
    // then the one state on this screen with no control at all. Every fetch
    // below is already guarded, so this is a backstop rather than a path — but
    // an unguarded throw would strand the user with a reload as the only exit,
    // and a reload discards the readings they have paid for.
    try {
    const result = await readSamples({
      samples,
      signal: controller.signal,
      onProgress: setProgress,
    });
    setReads(result.reads);
    const skippedPages = result.reads.reduce(
      (total, r) => total + (r.read ? r.skippedPages : 0),
      0,
    );
    setPartial((prev) => ({ ...prev, skippedPages, truncatedReads: result.truncated }));

    // ⚠️ `readSampleCount`, not `.filter().length` — the module's rule is that
    // every count of samples de-duplicates by id, and this is the one that is
    // SENT, as the clustering brief's `sampleCount`.
    const readCount = readSampleCount(result.reads);
    if (readCount === 0) {
      // Nothing was read, so there is nothing to cluster and no denominator.
      // Said plainly rather than shown as an empty proposal, which would read
      // as "these documents have nothing in common".
      setRunError(
        result.sessionLost
          ? t("run.sessionLost")
          : controller.signal.aborted
            ? t("run.cancelledNothing")
            : t("run.nothingRead"),
      );
      setClusters([]);
      setStep("review");
      return;
    }

    // ⚠️ The comparison call runs even after a cancel — it is what turns the
    // readings already paid for into a proposal — and it takes its pacing wait
    // in full, so the screen has to stop saying „se opreşte" and start saying
    // what it is actually doing. A round found this window showing a disabled
    // „Se opreşte…" over a live „Se aşteaptă 63 secunde", for up to minutes.
    setClustering(true);
    const clustered = await clusterHarvest({
      pairs: harvestPairs(result.reads),
      sampleCount: readCount,
      // ⚠️ The clustering call is the request one past the allowance, so it is
      // paced against the slots the reads took — otherwise it is refused, and
      // refusing it discards every one of those paid-for readings.
      slotStarts: result.slotStarts,
      onWait: (ms) =>
        setProgress((prev) =>
          prev ? { ...prev, waitingMs: ms, current: null } : prev,
        ),
    });

    if (!clustered.ok) {
      setRunError(
        clustered.reason === "session"
          ? t("run.sessionLost")
          : clustered.reason === "empty"
            ? t("run.noPairs")
            : clustered.reason === "rateLimited"
              ? t("run.clusterRateLimited")
              : t("run.clusterFailed"),
      );
      setClusters([]);
      setStep("review");
      return;
    }

    setPartial((prev) => ({
      ...prev,
      uncompared: clustered.droppedPairIds.length,
      clusterTruncated: clustered.truncated,
    }));
    setClusters(clustered.clusters);
    setStep("review");
    } catch {
      setRunError(t("run.clusterFailed"));
      setStep("review");
    } finally {
      setClustering(false);
    }
  }, [samples, t]);

  /**
   * Stop the run.
   *
   * ⚠️ **A round found the first draft creating an `AbortController`, storing
   * it, and never calling `.abort()` — with no button anywhere to call it
   * from.** A twenty-sample run is two minutes the user could not get out of.
   * What it stops is the WAITING and everything not yet attempted; a model call
   * already in flight is left to finish, because aborting it would still have
   * been billed and would report a sample as unread that was in fact read.
   */
  const cancelRun = useCallback(() => {
    setCancelling(true);
    setWasCancelled(true);
    abortRef.current?.abort();
  }, []);

  /**
   * Back to the beginning, without a page reload.
   *
   * ⚠️ **A round found there was NO edge back to `pick`, and five error strings
   * that instruct the user to „reluaţi".** The only exit from a failed run was
   * a browser reload, which is also the only thing that discards the reads
   * already paid for. Nothing here is billed: the type list is already loaded,
   * the folder handle is still granted, and the samples are still in memory —
   * so starting again costs the reads again and nothing else, which is what the
   * copy has always said.
   */
  const startOver = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setCancelling(false);
    setWasCancelled(false);
    setClustering(false);
    setStep("pick");
    setProgress(null);
    setReads([]);
    setClusters([]);
    setRunError(null);
    setSaveError(null);
    setRows([]);
    decisionsRef.current = new Map();
    setPartial({ skippedPages: 0, truncatedReads: 0, uncompared: 0, clusterTruncated: false });
  }, []);

  // ── The proposal, recomputed whenever the line moves ──────────────────────
  const distillation: Distillation = useMemo(
    () => distilFields({ samples: reads, clusters, percent, existing: existingFields }),
    [reads, clusters, percent, existingFields],
  );

  /**
   * The editable rows follow the distillation, and a user's edits survive a
   * change of percentage for any field that is still above the line — keyed by
   * cluster, so moving the line does not silently discard a rename.
   */
  useEffect(() => {
    setRows(
      distillation.fields.map(
        (f) =>
          decisionsRef.current.get(f.clusterId) ?? {
            clusterId: f.clusterId,
            labelRo: f.labelRo,
            labelEn: f.labelEn,
            type: f.type,
            aiHint: f.aiHint ?? "",
            include: true,
          },
      ),
    );
  }, [distillation]);

  useEffect(() => {
    if (step === "review" || step === "saved") headingRef.current?.focus();
  }, [step]);

  /**
   * The ordered key list the 409 check compares against: what the type was
   * holding when this review was drawn, or what a conflict has since corrected
   * it to.
   */
  const baselineKeys = useMemo(
    () =>
      conflictBaseline?.typeId === typeId
        ? conflictBaseline.keys
        : existingFields.map((f) => f.key),
    [conflictBaseline, typeId, existingFields],
  );

  const accepted = useMemo(() => rows.filter((r) => r.include), [rows]);

  /**
   * The key each row would be stored under, derived from the label as it stands.
   *
   * One shared `taken` set walked left to right, seeded with the type's stored
   * keys — the same discipline `keysForRows` uses, and for the same reason: a
   * key minted for an earlier row must be unavailable to a later one. Only the
   * TICKED rows are keyed, because an unticked row is not being added and must
   * not reserve a name.
   */
  const acceptedKeys = useMemo(() => {
    const taken = new Set<string>();
    for (const f of existingFields) if (f.key) taken.add(normaliseKeyForComparison(f.key));
    return accepted.map((row) =>
      uniqueFieldKey(slugifyFieldKey(row.labelRo.trim() || row.labelEn.trim()), taken),
    );
  }, [accepted, existingFields]);

  const keyForRow = (clusterId: string): string => {
    const index = accepted.findIndex((r) => r.clusterId === clusterId);
    return index === -1 ? "" : acceptedKeys[index];
  };

  /**
   * ⚠️ **Computed over the TICKED rows, not over every field above the line —
   * and a round found the first version made its own advice impossible.** The
   * banner says "raise the Matching % or take some fields out"; with the count
   * taken from `distillation.fields` the second remedy did nothing, and the
   * Save button stayed disabled however many boxes the user cleared. The
   * shipped review dialog computes exactly this, for exactly this reason.
   */
  const wouldBeFieldCount = existingFields.length + accepted.length;
  const overCapacity = wouldBeFieldCount > MAX_TEMPLATE_FIELDS;

  /**
   * ⚠️ **A TICKED ROW WITH AN EMPTY LABEL IS REFUSED, AND A THIRD ROUND SHOWED
   * WHY THE LIBRARY'S GUARD IS NOT ENOUGH.** `distilFields` drops a cluster it
   * cannot name, precisely so no row reaches the screen keyed `camp` — but a
   * user can empty the label box afterwards, and `slugifyFieldKey("")` is
   * `camp`. Two emptied labels save as `camp` and `camp_2`, with „camp" as the
   * visible label, permanently. `validateEditorRows` refuses the same thing on
   * the admin editor for the same reason.
   */
  const unnamedRow = accepted.some((r) => !r.labelRo.trim() && !r.labelEn.trim());

  /**
   * ⚠️ **A ROW RENAMED ONTO A FIELD THE TYPE ALREADY HAS IS REFUSED, NOT
   * SUFFIXED — and a round produced the `_2` column through this exact door.**
   * `distilFields` withholds a cluster whose key normalises onto a stored one,
   * precisely so the save route can collapse it; but the user can type that
   * name in afterwards, and `uniqueFieldKey` — seeded with the stored keys —
   * politely mints `pret_total_2`. Two columns, identical labels, one meaning.
   * The screen says so instead.
   */
  const storedNormalised = useMemo(() => {
    const set = new Set<string>();
    for (const f of existingFields) if (f.key) set.add(normaliseKeyForComparison(f.key));
    return set;
  }, [existingFields]);
  const duplicateRow = useMemo(() => {
    const seen = new Set<string>();
    for (const row of accepted) {
      const norm = normaliseKeyForComparison(
        slugifyFieldKey(row.labelRo.trim() || row.labelEn.trim()),
      );
      // ⚠️ Against the stored keys AND against each other. A round found the
      // first version catching only the stored half, so two rows renamed to the
      // same NEW name sailed through as `pret_total` and `pret_total_2` — the
      // pair the guard's own comment says it prevents.
      if (storedNormalised.has(norm) || seen.has(norm)) return true;
      seen.add(norm);
    }
    return false;
  }, [accepted, storedNormalised]);

  // ── Step 3: the save ──────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!selectedType) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/document-types/${encodeURIComponent(selectedType.id)}/template-fields`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // The ordered key list the reviewer saw. If the stored template has
            // moved on since — another tab, the admin screen — the route
            // answers 409 rather than dropping whatever arrived in between.
            knownKeys: baselineKeys,
            fields: accepted.map((row, index) => ({
              key: acceptedKeys[index],
              labelRo: row.labelRo.trim() || row.labelEn.trim() || acceptedKeys[index],
              labelEn: row.labelEn.trim() || row.labelRo.trim() || acceptedKeys[index],
              type: row.type,
              order: index,
              aiHint: row.aiHint.trim() || null,
              groupRo: null,
              groupEn: null,
            })),
          }),
        },
      );

      // ⚠️ **THE SESSION CHECK IS FIRST, AND ITS ABSENCE WAS THE WORST DEFECT IN
      // THE SLICE.** Middleware answers an unauthenticated request — API routes
      // included — with a redirect to /login, `fetch` follows it silently, and
      // the login page returns 200 HTML. Without this the ladder fell straight
      // through to `setStep("saved")` and the screen said „Tipul „X" are acum N
      // câmpuri în plus." over a type that had not been touched, discarding a
      // run of up to fifty billed readings. Every other call in this slice
      // already asked `isSessionLoss(res) || (res.ok && servesHtml(res))`; the
      // one that WRITES was the one that did not.
      if (isSessionLoss(res) || (res.ok && servesHtml(res))) {
        setSaveError(t("save.sessionLost"));
        return;
      }

      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as {
          fields?: { key: string }[];
        };
        const current = Array.isArray(body.fields) ? body.fields.map((f) => f.key) : null;
        // ⚠️ **A 409 that already holds every key we asked for is OUR OWN write
        // coming back.** The PUT landed and its response was lost — a dropped
        // connection, a retry after `save.failed` — so the stored template is
        // exactly what this screen sent. Reporting a concurrent editor there
        // would tell the user to reload and lose the run over a save that
        // succeeded. The shipped review dialog documents this same case.
        // ⚠️ **NOT "contains every key we sent" — a third round showed that is
        // true of somebody ELSE's identical write.** Two administrators running
        // this engine against the same document type produce the same slugs by
        // construction; that is what the distillation is for. The test is that
        // the stored list is EXACTLY the baseline this screen reviewed followed
        // by exactly what it sent — which is what an additive PUT of ours
        // produces and what a stranger's write does not.
        const oursLanded =
          current !== null &&
          current.length === baselineKeys.length + acceptedKeys.length &&
          baselineKeys.every((key, i) => current[i] === key) &&
          acceptedKeys.every((key, i) => current[baselineKeys.length + i] === key);
        if (oursLanded) {
          setStep("saved");
          return;
        }
        // Otherwise the template really has moved on. Reseed the baseline from
        // the fields the 409 itself carries, so pressing Save again can work —
        // a static message over a stale `knownKeys` meant every retry answered
        // 409 for ever.
        if (current !== null) setConflictBaseline({ typeId: selectedType.id, keys: current });
        setSaveError(t("save.conflict"));
        return;
      }

      if (res.status === 404) {
        setSaveError(t("save.typeGone"));
        return;
      }

      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { code?: string; max?: number };
        setSaveError(
          body.code === "too_many_fields"
            ? t("save.tooMany", { max: body.max ?? MAX_TEMPLATE_FIELDS })
            : t("save.failed"),
        );
        return;
      }
      if (!res.ok) {
        setSaveError(t("save.failed"));
        return;
      }
      setStep("saved");
    } catch {
      setSaveError(t("save.failed"));
    } finally {
      setSaving(false);
    }
  }, [accepted, acceptedKeys, baselineKeys, selectedType, t]);

  /** What the permanently-mounted live region is saying right now. */
  const liveMessage =
    step === "reading"
      ? progress
        ? progress.waitingMs > 0
          ? t("run.waiting", {
              seconds: Math.ceil(progress.waitingMs / 1000),
              perMinute: OCR_MAX_REQUESTS_ADMIN,
            })
          : t("run.progress", { done: progress.settled, total: progress.total })
        : t("run.starting")
      : step === "review"
        ? t("review.aboveTitle", { count: distillation.fields.length })
        : step === "saved"
          ? t("saved.title")
          : "";

  const inputClass =
    "w-full rounded-md border border-wire bg-white px-2 py-1.5 text-sm text-ink " +
    "shadow-sm focus:border-focus focus:outline-none " +
    "disabled:bg-cap disabled:text-fade " +
    "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-800";

  const patch = (clusterId: string, change: Partial<ProposalRow>) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.clusterId !== clusterId) return r;
        const next = { ...r, ...change };
        // Remembered outside the list, so a change of Matching % cannot walk
        // over it. See `decisionsRef`.
        decisionsRef.current.set(clusterId, next);
        return next;
      }),
    );

  const canStart =
    !!selectedType && refusalFor(selectedType) === null && samples.length > 0;

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      {/* ⚠️ **MOUNTED ONCE, FOR THE WHOLE SCREEN, AND `import-types-blocked-stage.tsx`
          RECORDS WHY.** "A live region inserted into the DOM together with its
          text is not reliably announced — the region has to exist before its
          content changes." The first draft put `role="status"` inside the
          reading step, which mounts together with the first progress line, so
          the only feedback during a two-minute paid run was silent for a screen
          reader. This paragraph exists from first paint and its content changes
          under it. */}
      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-ink dark:text-zinc-100"
      >
        {step === "saved" ? t("saved.title") : step === "review" ? t("review.title") : t("pick.title")}
      </h2>

      {/* ══ Step 1 — the type, the folder, the line ═══════════════════════════ */}
      {step === "pick" && (
        <>
          <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">{t("pick.intro")}</p>

          {typesError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
            >
              {typesError}
            </div>
          )}

          <div className="mt-5">
            <label
              htmlFor="dte-type"
              className="block text-sm font-medium text-ink dark:text-zinc-200"
            >
              {t("types.label")}
            </label>
            <select
              id="dte-type"
              value={typeId}
              disabled={types === null}
              onChange={(e) => setTypeId(e.target.value)}
              className={`${inputClass} mt-1 max-w-lg`}
            >
              <option value="">{t("types.placeholder")}</option>
              {(types ?? []).map((row) => {
                const refusal = refusalFor(row);
                return (
                  <option key={row.id} value={row.id} disabled={refusal !== null}>
                    {row.name}
                    {refusal === "idCard"
                      ? ` — ${t("types.refusedIdCard")}`
                      : refusal === "fallback"
                        ? ` — ${t("types.refusedFallback")}`
                        : documentTypeHasForm(row.templateFields)
                          ? ` — ${t("types.alreadyHasForm")}`
                          : ""}
                  </option>
                );
              })}
            </select>
            {selectedType && documentTypeHasForm(selectedType.templateFields) && (
              <p className="mt-1.5 max-w-lg text-xs text-fade dark:text-zinc-400">
                {t("types.additiveNote", { count: existingFields.length })}
              </p>
            )}
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={handlePickFolder}
              className={buttonClass({ variant: "secondary", size: "md" })}
            >
              {t("folder.pick")}
            </button>
            {folderName && (
              <p className="mt-2 text-sm text-ink dark:text-zinc-300">
                {t("folder.picked", { folder: folderName, count: samples.length })}
              </p>
            )}
            {overflow > 0 && (
              <p className="mt-1 text-sm text-ink dark:text-zinc-300">
                {t("folder.overflow", { count: overflow, max: MAX_SAMPLES_PER_RUN })}
              </p>
            )}
            {folderName && samples.length === 0 && !walkError && (
              <p className="mt-1 text-sm text-ink dark:text-zinc-300">{t("folder.noSamples")}</p>
            )}
            {walkError && (
              <div
                role="alert"
                className="mt-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                {walkError}
              </div>
            )}
          </div>

          <div className="mt-5">
            <label
              htmlFor="dte-percent"
              className="block text-sm font-medium text-ink dark:text-zinc-200"
            >
              {t("matching.label")}
            </label>
            <select
              id="dte-percent"
              value={percent}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (isMatchingPercent(next)) setPercent(next);
              }}
              className={`${inputClass} mt-1 max-w-[10rem]`}
            >
              {MATCHING_PERCENTS.map((p) => (
                <option key={p} value={p}>
                  {p}%
                </option>
              ))}
            </select>
            <p className="mt-1.5 max-w-lg text-xs text-fade dark:text-zinc-400">
              {t("matching.hint")}
            </p>
          </div>

          {/* The cost sentence, in the treatment every billed press in this
              product uses — and it states BOTH numbers, because a run of more
              samples than one window allows has a floor the user should not
              discover. */}
          <p className={`mt-6 ${COST_NOTE_CLASS}`}>
            {t("cost.note", { count: samples.length })}
            {/* ⚠️ A separate sentence rather than a clause inside the plural,
                because `minimumRunMs` is 0 for anything that fits in one
                window and the first draft printed „so it takes at least 0
                minutes". */}
            {minimumRunMs(samples.length + 1) > 0 && (
              <>
                {" "}
                {t("cost.pace", {
                  minutes: Math.ceil(minimumRunMs(samples.length + 1) / 60_000),
                  perMinute: OCR_MAX_REQUESTS_ADMIN,
                })}
              </>
            )}
          </p>

          <div className="mt-3">
            <button
              type="button"
              disabled={!canStart}
              onClick={startRun}
              className={buttonClass({ variant: "primary", size: "lg" })}
            >
              {t("run.start")}
            </button>
          </div>
        </>
      )}

      {/* ══ Step 2 — reading ═════════════════════════════════════════════════ */}
      {step === "reading" && (
        <div className="mt-4">
          <p className="text-sm text-ink dark:text-zinc-300">
            {progress
              ? t("run.progress", { done: progress.settled, total: progress.total })
              : t("run.starting")}
          </p>
          {progress?.current && (
            <p className="mt-1 text-sm text-fade dark:text-zinc-400">
              {t("run.current", { file: progress.current })}
            </p>
          )}
          {progress && progress.waitingMs > 0 && (
            <p className={`mt-2 ${COST_NOTE_CLASS}`}>
              {t("run.waiting", {
                seconds: Math.ceil(progress.waitingMs / 1000),
                perMinute: OCR_MAX_REQUESTS_ADMIN,
              })}
            </p>
          )}
          {clustering ? (
            <p className="mt-4 text-sm text-ink dark:text-zinc-300">
              {wasCancelled ? t("run.comparingAfterCancel") : t("run.comparing")}
            </p>
          ) : (
            <div className="mt-4">
              <button
                type="button"
                disabled={cancelling}
                onClick={cancelRun}
                className={buttonClass({ variant: "secondary", size: "md" })}
              >
                {cancelling ? t("run.cancelling") : t("run.cancel")}
              </button>
              <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("run.cancelNote")}</p>
            </div>
          )}
        </div>
      )}

      {/* ══ Step 3 — the proposal ════════════════════════════════════════════ */}
      {step === "review" && (
        <>
          {/* ⚠️ The denominator, in words, first — before any percentage on the
              screen means anything. Never "70%" over an unknown N. */}
          <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">
            {t("review.forType", { type: selectedType?.name ?? "" })}
          </p>
          <p className="mt-1 text-sm font-medium text-ink dark:text-zinc-200">
            {t("review.denominator", {
              read: distillation.samplesRead,
              picked: distillation.samplesPicked,
            })}
          </p>
          {distillation.samplesRead < distillation.samplesPicked && (
            <p className="mt-1 text-sm text-fade dark:text-zinc-400">
              {t("review.unread", { count: unreadSampleCount(reads) })}
            </p>
          )}

          {/* ⚠️ Three different ways this proposal can be a PARTIAL answer, each
              named rather than implied by a tidy list. Two route headers promise
              the screen says these; an adversarial round found it did not. */}
          {wasCancelled && distillation.samplesRead > 0 && (
            <p className="mt-1 text-sm text-fade dark:text-zinc-400">{t("run.cancelled")}</p>
          )}
          {partial.skippedPages > 0 && (
            <p className="mt-1 text-sm text-fade dark:text-zinc-400">
              {t("review.skippedPages", { count: partial.skippedPages })}
            </p>
          )}
          {partial.truncatedReads > 0 && (
            <p className="mt-1 text-sm text-fade dark:text-zinc-400">
              {t("review.truncatedReads", { count: partial.truncatedReads })}
            </p>
          )}
          {(partial.uncompared > 0 || partial.clusterTruncated) && (
            <p className="mt-1 text-sm text-fade dark:text-zinc-400">
              {t("review.partialComparison", { count: partial.uncompared })}
            </p>
          )}

          {runError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
            >
              {runError}
            </div>
          )}

          {/* The line is still movable here, and moving it re-reads nothing. */}
          <div className="mt-5 flex items-center gap-3">
            <label htmlFor="dte-percent-review" className="text-sm font-medium text-ink dark:text-zinc-200">
              {t("matching.label")}
            </label>
            <select
              id="dte-percent-review"
              value={percent}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (isMatchingPercent(next)) setPercent(next);
              }}
              className={`${inputClass} max-w-[8rem]`}
            >
              {MATCHING_PERCENTS.map((p) => (
                <option key={p} value={p}>
                  {p}%
                </option>
              ))}
            </select>
            <span className="text-xs text-fade dark:text-zinc-400">{t("matching.freeToChange")}</span>
          </div>

          {overCapacity && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
            >
              {t("review.overCapacity", { would: wouldBeFieldCount, max: MAX_TEMPLATE_FIELDS })}
            </div>
          )}

          <h3 className="mt-6 text-sm font-semibold text-ink dark:text-zinc-100">
            {t("review.aboveTitle", { count: distillation.fields.length })}
          </h3>

          {distillation.fields.length > 0 && (
            <p className="mt-2 rounded-md border border-wire bg-cta-pale px-4 py-3 text-xs leading-relaxed text-ink dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
              {tKey("keyNote")}{" "}
              {/* The screen-specific half, which the reused sentence cannot
                  carry: on THIS screen the field is being added, so the key is
                  still being decided and follows the label as it is typed. */}
              {t("review.keyNow")}
            </p>
          )}

          {distillation.fields.length === 0 && !runError && (
            <p className="mt-2 text-sm text-ink dark:text-zinc-300">
              {/* Lowering the line only helps if there IS something under it. */}
              {distillation.below.length > 0 ? t("review.aboveEmpty") : t("review.nothingFound")}
            </p>
          )}

          <ul className="mt-3 space-y-4">
            {distillation.fields.map((field) => {
              const row = rows.find((r) => r.clusterId === field.clusterId);
              if (!row) return null;
              return (
                <li
                  key={field.clusterId}
                  className="rounded-lg border border-wire p-4 dark:border-zinc-700"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={row.include}
                      disabled={saving}
                      onChange={(e) => patch(field.clusterId, { include: e.target.checked })}
                      aria-label={t("review.includeAria", {
                        label: row.labelRo.trim() || field.clusterId,
                      })}
                      className="mt-2"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-0 flex-1">
                          <label className="block text-xs font-medium text-fade dark:text-zinc-400">
                            {t("review.label")}
                          </label>
                          <input
                            type="text"
                            value={row.labelRo}
                            aria-label={t("review.labelAria", {
                              label: row.labelRo.trim() || field.clusterId,
                            })}
                            onChange={(e) =>
                              patch(field.clusterId, {
                                labelRo: e.target.value,
                                labelEn: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-fade dark:text-zinc-400">
                            {t("review.type")}
                          </label>
                          <select
                            value={row.type}
                            aria-label={t("review.typeAria", {
                              label: row.labelRo.trim() || field.clusterId,
                            })}
                            onChange={(e) =>
                              patch(field.clusterId, {
                                type: e.target.value as DocumentTemplateFieldType,
                              })
                            }
                            className={inputClass}
                          >
                            <option value="text">{t("review.typeText")}</option>
                            <option value="textarea">{t("review.typeTextarea")}</option>
                            <option value="date">{t("review.typeDate")}</option>
                            <option value="number">{t("review.typeNumber")}</option>
                          </select>
                        </div>
                        <p className="text-xs text-fade dark:text-zinc-400">
                          {t("review.foundIn", {
                            count: field.foundIn,
                            read: distillation.samplesRead,
                            percent: field.sharePercent,
                          })}
                        </p>
                      </div>

                      {/* The key this row would be stored under, derived from the
                          label as it stands and shown live — so renaming the
                          label before saving is the one moment at which the key
                          can be fixed, and the user can see it happen. Shown,
                          never editable: `valueList.templateFields.keyNote` says
                          why, and this screen does not repeat it in its own
                          words. */}
                      <p className="mt-1 font-mono text-xs text-fade dark:text-zinc-400">
                        {row.include ? keyForRow(field.clusterId) : t("review.keyPending")}
                      </p>

                      {field.variants.length > 0 && (
                        <p className="mt-1 text-xs text-fade dark:text-zinc-400">
                          {t("review.variants", { wordings: field.variants.join(" / ") })}
                        </p>
                      )}

                      {/* ⚠️ The hint box is pre-filled with the caption wordings
                          observed across the samples, so that renaming the label
                          never LOOKS like erasing the evidence — the model keeps
                          the prose, the human gets a clean official label, both
                          on the same prompt line. */}
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-fade dark:text-zinc-400">
                          {t("review.hint")}
                        </label>
                        <input
                          type="text"
                          value={row.aiHint}
                          aria-label={t("review.hintAria", {
                            label: row.labelRo.trim() || field.clusterId,
                          })}
                          onChange={(e) => patch(field.clusterId, { aiHint: e.target.value })}
                          className={inputClass}
                        />
                        <p className="mt-1 text-xs text-fade dark:text-zinc-400">
                          {t("review.hintNote")}
                        </p>
                      </div>

                      {/* The mapping: what this field picked up out of each
                          sample, so it is approved having been seen to work. */}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-fade dark:text-zinc-400">
                          {t("review.evidence", { count: field.evidence.length })}
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {field.evidence.map((member) => (
                            <li
                              key={`${field.clusterId}-${member.sampleId}`}
                              className="flex gap-2 text-xs"
                            >
                              <span className="shrink-0 text-fade dark:text-zinc-400">
                                {sampleName(reads, member.sampleId)}
                              </span>
                              <span className="min-w-0 break-words text-ink dark:text-zinc-200">
                                {member.value}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ── Below the line ──────────────────────────────────────────────
              ⚠️ Nothing is built for these. `document.fields.notes` is „Note
              extinse", the ai-interpret route defines it as `unmappedRaw`
              rendered as readable text, and a value matching no template field
              already goes there. This list is the SAYING of that, shown while
              the percentage is still changeable. A second overflow path written
              by hand would be a second writer of one rule. */}
          {distillation.below.length > 0 && (
            <div className="mt-6 border-t border-crease pt-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
                {t("review.belowTitle", { count: distillation.below.length })}
              </h3>
              <p className="mt-1 text-sm text-ink dark:text-zinc-300">{t("review.belowNote")}</p>
              <ul className="mt-2 space-y-1">
                {distillation.below.map((candidate) => (
                  <li key={candidate.clusterId} className="text-xs text-fade dark:text-zinc-400">
                    <span className="text-ink dark:text-zinc-200">{candidate.labelRo}</span>
                    {" — "}
                    {t("review.foundIn", {
                      count: candidate.foundIn,
                      read: distillation.samplesRead,
                      percent: candidate.sharePercent,
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Above the line, but the type already stores a field under that key.
              Listed rather than dropped: a candidate that simply vanished would
              read as a field the run failed to find. */}
          {distillation.alreadyCaptured.length > 0 && (
            <div className="mt-6 border-t border-crease pt-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
                {t("review.alreadyTitle", { count: distillation.alreadyCaptured.length })}
              </h3>
              <p className="mt-1 text-sm text-ink dark:text-zinc-300">{t("review.alreadyNote")}</p>
              <ul className="mt-2 space-y-1">
                {distillation.alreadyCaptured.map((candidate) => (
                  <li key={candidate.clusterId} className="text-xs text-fade dark:text-zinc-400">
                    <span className="text-ink dark:text-zinc-200">{candidate.labelRo}</span>
                    {" — "}
                    {t("review.foundIn", {
                      count: candidate.foundIn,
                      read: distillation.samplesRead,
                      percent: candidate.sharePercent,
                    })}
                    {candidate.sampleValue
                      ? ` — ${t("review.exampleValue", { value: candidate.sampleValue })}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {unnamedRow && (
            <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">
              {t("review.labelRequired")}
            </p>
          )}
          {duplicateRow && (
            <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">
              {t("review.labelDuplicate")}
            </p>
          )}

          {saveError && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
            >
              {saveError}
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              disabled={
                saving || accepted.length === 0 || overCapacity || unnamedRow || duplicateRow
              }
              onClick={save}
              className={buttonClass({ variant: "primary", size: "lg" })}
            >
              {saving ? t("save.saving") : t("save.button", { count: accepted.length })}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={startOver}
              className={buttonClass({ variant: "secondary", size: "md" })}
            >
              {t("review.startOver")}
            </button>
            <span className="text-xs text-fade dark:text-zinc-400">{t("save.note")}</span>
          </div>
        </>
      )}

      {/* ══ Done ═════════════════════════════════════════════════════════════ */}
      {step === "saved" && (
        <>
          <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">
            {t("saved.body", { type: selectedType?.name ?? "", count: accepted.length })}
          </p>
          <p className="mt-3 text-sm text-ink dark:text-zinc-300">{t("saved.whatNext")}</p>
          <a href="/admin/import" className={`mt-4 inline-block ${buttonClass({ variant: "secondary", size: "md" })}`}>
            {t("saved.toImport")}
          </a>
        </>
      )}
    </section>
  );
}

/** The file name behind a sample id, for the evidence column. */
function sampleName(reads: readonly SampleRead[], sampleId: string): string {
  return reads.find((r) => r.sampleId === sampleId)?.fileName ?? sampleId;
}

/**
 * One sample per document, which is not one sample per file.
 *
 * `walkFolder` already collapses a subfolder of numbered images into a single
 * `page-group` entry — the archive's own convention for a multi-page scan — so
 * a folder of ten documents, three of them scanned a page at a time, is ten
 * samples and not thirty. `hasReadablePage` is the same test the import applies
 * before it spends anything on an entry, asked here for the same reason.
 */
async function samplesFromEntries(entries: readonly FSEntry[]): Promise<SampleSource[]> {
  const out: SampleSource[] = [];
  for (const [index, entry] of entries.entries()) {
    if (!hasReadablePage(entry)) continue;
    const handles = entry.kind === "page-group" ? entry.handles : [entry.handle];
    const files: File[] = [];
    for (const handle of handles) {
      try {
        files.push(await handle.getFile());
      } catch {
        /* one unreadable page does not discard the document */
      }
    }
    if (files.length === 0) continue;
    out.push({ sampleId: `s${index}`, fileName: entry.name, files });
  }
  return out;
}
