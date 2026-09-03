"use client";

/**
 * AddPropertyDialog
 *
 * ⚠️ **WORK IN PROGRESS.** Reconnected by slice #32.20 after a period in which
 * nothing in the application imported this file: /properties/new was reachable
 * from the Properties list and the other three paths from nowhere at all. All
 * four are now exposed, and none of them was rebuilt — that was the explicit
 * boundary of #32.20 ("we shall return to it later", Adrian). In particular the
 * scan and folder paths do NOT write the tags and associations the Process
 * panel on a Document writes, and the Administration import wizard remains the
 * route for importing folders at scale.
 *
 * The reasoning, the open questions and what each path costs to bring forward
 * are in
 *   01.Slice.Inputs\Slices.32.nn.UAT\32.12\Answers.32.12.docx
 *   section 4 — "Item 19, the Add Property dialog"
 * Cite the SECTION, never a page number: section 4 began on page 7 in the copy
 * Adrian read and moved to page 6 one revision later.
 *
 * Multi-step modal triggered from the Properties list view.
 *
 * Steps:
 *  "choice"        – 4 entry-point cards
 *  "upload"        – image file picker  (→ OCR pipeline)
 *  "processing"    – spinner while OCR API works
 *  "select"        – (only when >1 property detected from image) choose how many to save
 *  "upload-text"   – single .txt file picker
 *  "upload-folder" – folder picker (webkitdirectory)
 *  "saving"        – spinner while POST /api/properties runs (all save paths)
 *
 * After all properties are saved the component navigates to each detail page.
 */

import { useEffect, useRef, useState } from "react";
import { useQueryClient }   from "@tanstack/react-query";
import { useTranslations }  from "next-intl";
import { useRouter }        from "next/navigation";
import Link                 from "next/link";
import { NavArrowIcon }      from "@/components/back-arrow";
import { ErrorBoundary, PanelError } from "@/components/error-boundary";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import type { ProvenanceSourceKind } from "@/lib/metadata/provenance-rules";
import { buttonClass } from "@/lib/ui/button-styles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Corner {
  lat: number;
  lon: number;
  originalIndex?: number | null;
}

interface ScannedProperty {
  corners: Corner[];
}

interface ScanResult {
  properties: ScannedProperty[];
  labels:     string[];
}

type Step =
  | "choice"
  | "upload"
  | "processing"
  | "select"
  | "upload-text"
  | "upload-folder"
  | "saving"
  | "done-text"
  | "done-folder";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/** Call the OCR scan-image API. */
async function callScanApi(file: File): Promise<ScanResult> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch("/api/properties/scan-image", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<ScanResult>;
}

/** Call the text-file parse API. Returns WGS84 corners. */
async function callParseTextApi(file: File): Promise<Corner[]> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/properties/parse-text", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as { corners: Corner[] };
  return data.corners ?? [];
}

/**
 * Create one property via the main properties API.
 *
 * `source` (Slice #21.07.Import) says where the corners came from, so the row
 * records an honest provenance: the OCR branch scans a graphics file, the two
 * text branches parse a cadastral coordinate file.
 */
async function createProperty(
  corners:  Corner[],
  notes:    string | null,
  nickname: string | null,
  source:   ProvenanceSourceKind,
): Promise<string> {
  const payload: Record<string, unknown> = {
    corners: corners.map((c) => ({ lat: c.lat, lon: c.lon, originalIndex: c.originalIndex ?? null })),
    provenance: inferProvenance(source),
  };
  if (notes)    payload.notes    = notes;
  if (nickname) payload.nickname = nickname;

  const res = await fetch("/api/properties", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as { property?: { id?: string } };
  if (!data.property?.id) throw new Error("No id returned from API");
  return data.property.id;
}

/** Strip the file extension from a filename to use as a nickname. */
function nicknameFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

/** Filter a FileList to only .txt files. */
function extractTxtFiles(files: FileList): File[] {
  return Array.from(files).filter((f) =>
    f.name.toLowerCase().endsWith(".txt")
  );
}

// ---------------------------------------------------------------------------
// Dialog component
// ---------------------------------------------------------------------------

/**
 * The four entry-point cards on the "choice" step.
 *
 * ⚠️ **NOT `buttonClass()`, and that is the fix, not an oversight** (#32.20
 * review round 1). Three of these four were migrated to
 * `buttonClass({ variant: "secondary", size: "lg" })` during the button sweep,
 * while nothing imported this file and so nobody looked at the result. That
 * helper's BASE is `inline-flex items-center justify-center`: each card holds a
 * title span and a description span, so the three lost their `flex-col` and
 * laid the two out side by side, centred, with `secondary`'s
 * `enabled:hover:**:text-white` turning the fade-grey description the same
 * colour as the title on hover. One proper card followed by three malformed
 * rows is what the entry point this slice adds would otherwise have opened
 * onto. Appending `flex-col items-start` to the helper's output is not a fix
 * either: Tailwind resolves competing utilities by stylesheet order, not class
 * order (see the warning in button-styles.ts), and `items-center` /
 * `justify-center` are exactly such a competition. A card is not a button
 * variant, so it carries the card's own classes — the ones card 1 has always
 * had — and all four now match.
 */
const CHOICE_CARD =
  "flex flex-col cursor-pointer rounded-lg border-2 border-wire bg-white px-4 py-3 " +
  "transition-colors hover:border-cta hover:bg-cta-pale " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-cta dark:hover:bg-zinc-700";

interface Props {
  onClose: () => void;
}

export function AddPropertyDialog({ onClose }: Props) {
  const t           = useTranslations("property.addDialog");
  const tShared     = useTranslations("shared");
  const router      = useRouter();
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────

  const [step,          setStep]          = useState<Step>("choice");
  const [error,         setError]         = useState<string | null>(null);

  // Image (OCR) flow
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const [scanResult,    setScanResult]    = useState<ScanResult | null>(null);
  const [saveCount,     setSaveCount]     = useState(1);

  // Text file flow
  const [textFile,      setTextFile]      = useState<File | null>(null);

  // Folder flow
  const [folderFiles,   setFolderFiles]   = useState<File[]>([]);
  const [folderHadFiles, setFolderHadFiles] = useState(false);

  // Saving progress (shared across all save paths)
  const [savingLabel,   setSavingLabel]   = useState("");

  const imageInputRef   = useRef<HTMLInputElement>(null);
  const textInputRef    = useRef<HTMLInputElement>(null);
  const folderInputRef  = useRef<HTMLInputElement>(null);
  // Prevents double-click / concurrent invocations of import handlers.
  /**
   * `isImportingRef` is the SYNCHRONOUS re-entry guard and stays a ref — state
   * would not be updated in time to stop a second click. `importing` is the
   * same fact made renderable, because #32.20 review round 3 found that keying
   * "is something in flight" off `step` alone leaves a hole: both import
   * handlers set the ref, then read every selected file, and only THEN call
   * setStep("saving"). For a folder off a network share that read is seconds
   * long, and throughout it `step` is still "upload-folder" — so Escape, the
   * backdrop, the ✕ and Back were all live over a run that was already
   * committed to creating properties. Set the two together, always.
   */
  const isImportingRef  = useRef(false);
  const [importing, setImporting] = useState(false);
  const markImporting = (v: boolean) => { isImportingRef.current = v; setImporting(v); };

  // ── Navigation helpers ────────────────────────────────────────────────────

  /**
   * Escape closes — but never mid-flight, and never via the element's own
   * onKeyDown (#32.20 review rounds 1 and 2).
   *
   * Round 1 put the handler on the overlay div and focused that div on mount.
   * That works on the "choice" step and nowhere else: every step transition is
   * fired by clicking a button which the transition then unmounts, at which
   * point focus falls back to document.body — outside the React root — and a
   * synthetic onKeyDown never reaches the overlay again. So Escape died the
   * moment the user chose one of the four paths, which is exactly when they
   * might want out. A window listener is focus-independent, and it is what the
   * five other dialogs in this app already do (discover-review-dialog,
   * tag-dialog, property-step-dialog, cancel-import-dialog, value-list-modal).
   *
   * `!isBusy` matches discover-review-dialog's rule and its reason: during
   * "processing" and "saving" this dialog is the only thing telling the user a
   * read or a write is in flight. Dismissing it does not cancel the loop in
   * handleImportFolder — that keeps creating properties against an unmounted
   * component — and it leaves isImportingRef behind with it, so a reopened
   * dialog would happily import the same folder a second time and duplicate
   * everything the first run saved.
   */
  const isBusy = importing || step === "processing" || step === "saving";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isBusy]);

  // Focus moves into the dialog on open, which is what `aria-modal="true"`
  // already promised a screen reader: without it, assistive tech is told to
  // ignore everything outside a dialog the user's focus is still outside of.
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => { overlayRef.current?.focus(); }, []);

  /**
   * The backdrop closes on click — with two guards.
   *
   * `!isBusy`, for the reason above: the panel is `max-w-md`, so most of the
   * screen is backdrop and a misclick during a folder import would abandon it.
   *
   * And BOTH the mousedown and the mouseup must have landed on the backdrop.
   * A `click` is dispatched at the nearest common ancestor of the two, so
   * either direction of a drag across the panel edge otherwise reports the
   * overlay as its target: a text-selection drag that starts on the list of
   * found filenames and releases outside (round 2 caught this one), and a drag
   * that starts on the backdrop and releases inside the panel (round 3 caught
   * that one, and it is the worse of the two — the gesture ends inside the
   * dialog and dismisses it anyway).
   */
  const downOnBackdrop = useRef(false);

  /** Navigate to all saved property pages in sequence, then close. */
  const navigateToSaved = async (ids: string[]) => {
    // #32.20 review round 1 — the two text paths each invalidate before they
    // get here; the OCR path did not, and it is the one path with no successor
    // elsewhere in the application. staleTime is 30s (query-provider.tsx), so
    // without this a user who photographs a coordinate table, lands on the new
    // property and presses Back inside half a minute is served the cached list
    // page — without the property they just created on it. Invalidating on the
    // shared "properties" prefix here covers all three paths; the two that
    // already do it are harmless repeats.
    // NOT awaited (#32.20 review round 2). The Properties list is mounted
    // directly behind this dialog, so its query has an active observer and v5's
    // invalidateQueries awaits the refetch that follows — with the default
    // three retries and backoff. Awaiting it held the "Saving…" spinner open
    // for seconds, on a flaky connection, for work already committed. The cache
    // is marked stale synchronously either way, which is all this needs.
    void queryClient.invalidateQueries({ queryKey: ["properties"] });
    onClose();
    for (let i = 0; i < ids.length; i++) {
      if (i === 0) {
        router.push(`/properties/${ids[i]}`);
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 1_500 * i));
        router.push(`/properties/${ids[i]}`);
      }
    }
  };

  // ── Image (OCR) handlers ──────────────────────────────────────────────────

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null);
    setError(null);
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    setError(null);
    setStep("processing");

    let result: ScanResult;
    try {
      result = await callScanApi(selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ocrError"));
      setStep("upload");
      return;
    }

    setScanResult(result);

    if (result.properties.length === 0) {
      setError(t("noPropertiesFound"));
      setStep("upload");
      return;
    }

    if (result.properties.length === 1) {
      setSaveCount(1);
      await handleScanSave(result, 1);
    } else {
      setSaveCount(result.properties.length);
      setStep("select");
    }
  };

  const handleScanSave = async (result: ScanResult, count: number) => {
    setStep("saving");
    const notesText = result.labels.join("   ") || null;
    const savedIds: string[] = [];

    for (let i = 0; i < count; i++) {
      setSavingLabel(t("savingProperties", { count }));
      try {
        const id = await createProperty(result.properties[i].corners, notesText, null, "IMAGE_FILE");
        savedIds.push(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        setStep("select");
        return;
      }
    }
    await navigateToSaved(savedIds);
  };

  const handleConfirmSave = () => {
    if (!scanResult) return;
    void handleScanSave(scanResult, saveCount);
  };

  // ── Text file handlers ────────────────────────────────────────────────────

  const handleTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextFile(e.target.files?.[0] ?? null);
    setError(null);
  };

  const handleImportText = async () => {
    if (!textFile || isImportingRef.current) return;
    markImporting(true);
    setError(null);

    // Read content BEFORE setStep("saving") unmounts the <input> element.
    // File objects from a file input can become unreadable once the input
    // is removed from the DOM; reading upfront avoids stale-file data.
    let fileText: string;
    const fileName = textFile.name;
    try {
      fileText = await textFile.text();
    } catch {
      setError(t("noCoordinatesFound"));
      markImporting(false);
      return;
    }

    setStep("saving");
    setSavingLabel(t("processingText"));

    // Re-wrap as a File so callParseTextApi can build FormData normally.
    const fileBlob = new File([fileText], fileName, { type: "text/plain" });

    let corners: Corner[];
    try {
      corners = await callParseTextApi(fileBlob);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("noCoordinatesFound"));
      setStep("upload-text");
      markImporting(false);
      return;
    }

    if (corners.length === 0) {
      setError(t("noCoordinatesFound"));
      setStep("upload-text");
      markImporting(false);
      return;
    }

    const nickname = nicknameFromFilename(fileName);
    setSavingLabel(t("savingProperties", { count: 1 }));

    try {
      await createProperty(corners, null, nickname, "COORDINATE_FILE");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStep("upload-text");
      markImporting(false);
      return;
    }

    // Invalidate the property list so it refreshes when the dialog closes.
    await queryClient.invalidateQueries({ queryKey: ["properties"] });

    // Show acknowledgement screen — user closes manually to return to list.
    setSavingLabel(t("textImportDone"));
    setStep("done-text");
    markImporting(false);
  };

  // ── Folder handlers ───────────────────────────────────────────────────────

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? extractTxtFiles(e.target.files) : [];
    setFolderFiles(files);
    setFolderHadFiles((e.target.files?.length ?? 0) > 0);
    setError(null);
  };

  const handleImportFolder = async () => {
    if (folderFiles.length === 0 || isImportingRef.current) return;
    markImporting(true);
    setError(null);

    // Read ALL file contents BEFORE setStep("saving") unmounts the <input>.
    // File objects from a webkitdirectory input become unreadable once the
    // input is removed from the DOM, which is why every fetch was previously
    // returning the same stale bytes (the first file's data).
    const fileData: { name: string; text: string }[] = [];
    for (const file of folderFiles) {
      try {
        const text = await file.text();
        fileData.push({ name: file.name, text });
      } catch {
        // unreadable — skip silently
      }
    }

    setStep("saving");

    const total     = fileData.length;
    const savedIds: string[] = [];

    for (let i = 0; i < total; i++) {
      const { name, text } = fileData[i];
      setSavingLabel(t("processingFolder", { done: i + 1, total }));

      // Re-wrap the captured text as a File so callParseTextApi can build
      // FormData normally — the actual bytes come from our in-memory copy.
      const fileBlob = new File([text], name, { type: "text/plain" });

      let corners: Corner[];
      try {
        corners = await callParseTextApi(fileBlob);
      } catch {
        continue; // skip files we can't parse
      }

      if (corners.length === 0) {
        continue; // skip files with no coordinates
      }

      const nickname = nicknameFromFilename(name);
      try {
        const id = await createProperty(corners, null, nickname, "COORDINATE_FILE");
        savedIds.push(id);
      } catch {
        // skip files that fail to save
      }
    }

    if (savedIds.length === 0) {
      setError(t("noCoordinatesFound"));
      setStep("upload-folder");
      markImporting(false);
      return;
    }

    // Invalidate the property list so it refreshes when the dialog closes.
    await queryClient.invalidateQueries({ queryKey: ["properties"] });

    // Show acknowledgement screen — user closes manually to return to list.
    setSavingLabel(
      t("folderImportDone", { success: savedIds.length, total })
    );
    setStep("done-folder");
    markImporting(false);
  };

  // ── Shared reset ──────────────────────────────────────────────────────────

  const resetToChoice = () => {
    setStep("choice");
    setError(null);
    setSelectedFile(null);
    setScanResult(null);
    setTextFile(null);
    setFolderFiles([]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    /*
      #32.20 — Escape, the backdrop and focus were all DECLARED here and none of
      them worked, and none of it could bite while nothing imported this file.
      Escape and the backdrop guards now live beside the handlers above, where
      their reasons are written out; this div carries `tabIndex={-1}` only so
      that it can be focused on open, and `outline-none` because it is a
      container, not a control — every real control inside it keeps its own
      focus ring.
    */
    <div
      ref={overlayRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (e.target !== e.currentTarget) downOnBackdrop.current = false; }}
      onClick={(e) => {
        if (!isBusy && downOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-md rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          {/*
            `disabled={isBusy}` — #32.20 review round 3. Escape and the backdrop
            were gated in round 2 and this, the most obvious way out of the
            dialog and the one visible throughout the "Saving…" spinner, was
            not. Every consequence the round-2 guards exist to prevent was still
            reachable through it. discover-review-dialog does the same thing for
            the same reason. Genuinely disabled rather than a no-op handler:
            buttonClass paints the inert state, and a control that invites a
            click it will not honour is the lying button #23.05.UX removed.
          */}
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label={t("cancel")}
            className={buttonClass({ variant: "bare", size: "md" })}
          >
            ✕
          </button>
        </div>

        {/*
          Body.

          ⚠️ **The <ErrorBoundary> wraps THIS, not the overlay** (#32.20 review
          rounds 2 and 3). It used to wrap the whole `fixed inset-0` overlay, so
          when it did fire it replaced the backdrop, the panel, the ✕ and the
          Escape target with a PanelError box rendered inline at the bottom of
          the Properties list — while `addOpen` in that list stayed true, and
          with no way out but a page reload. Wrapping the body leaves the
          header's ✕, the backdrop and the Escape handler alive.

          ⚠️ **And be precise about what it can fire ON, because round 2's
          version of this comment was not.** A boundary catches throws from the
          render of its DESCENDANT COMPONENTS — Spinner, the icon SVGs,
          ErrorBanner, BackButton, Link. It does NOT catch a throw from the JSX
          below, because all of that is evaluated during AddPropertyDialog's own
          render, before this boundary mounts, and propagates past it to an
          ancestor: a missing `t(...)` key in a step is not caught here and
          never was, in either placement. Nor is anything thrown by the async
          handlers, which no error boundary sees. The `fallback` prop is
          evaluated outside the boundary too, so a failure to resolve
          `errorBoundary.ocr` itself cannot produce the fallback.
        */}
        <div className="px-5 py-5">
          <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.ocr")}</PanelError>}>

          {/* ── CHOICE ── */}
          {step === "choice" && (
            <div className="flex flex-col gap-3">
              {/* 1. Manual entry */}
              <Link
                href="/properties/new"
                onClick={onClose}
                className={CHOICE_CARD}
              >
                <span className="font-medium">{t("choiceManual")}</span>
                <span className="mt-0.5 text-xs text-fade">{t("choiceManualDesc")}</span>
              </Link>

              {/* 2. From scanned image */}
              <button
                type="button"
                onClick={() => setStep("upload")}
                className={`${CHOICE_CARD} text-left`}
              >
                <span className="font-medium">{t("choiceScan")}</span>
                <span className="mt-0.5 text-xs text-fade">{t("choiceScanDesc")}</span>
              </button>

              {/* 3. From a text file */}
              <button
                type="button"
                onClick={() => setStep("upload-text")}
                className={`${CHOICE_CARD} text-left`}
              >
                <span className="font-medium">{t("choiceTextFile")}</span>
                <span className="mt-0.5 text-xs text-fade">{t("choiceTextFileDesc")}</span>
              </button>

              {/* 4. From a text folder */}
              <button
                type="button"
                onClick={() => setStep("upload-folder")}
                className={`${CHOICE_CARD} text-left`}
              >
                <span className="font-medium">{t("choiceTextFolder")}</span>
                <span className="mt-0.5 text-xs text-fade">{t("choiceTextFolderDesc")}</span>
              </button>

              {/*
                Slice #32.20 — the work-in-progress note Adrian asked for, in
                the only form that belongs on a shipped screen. Deliberately no
                file path: Ciprian sees this dialog, and a C:\dev.docs\ path in
                the interface is noise to him. The pointer proper — to
                Answers.32.12.docx section 4 — is in this file's header, where a
                developer looks and where it cannot be shipped to anybody.
              */}
              <p className="mt-1 text-xs text-fade" role="note">
                {t("wipNote")}
              </p>
            </div>
          )}

          {/* ── IMAGE UPLOAD ── */}
          {step === "upload" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium">{t("uploadTitle")}</p>

              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-wire bg-canvas px-4 py-8 transition-colors hover:border-cta dark:border-zinc-600 dark:bg-zinc-800"
                onClick={() => imageInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") imageInputRef.current?.click(); }}
                aria-label={t("uploadLabel")}
              >
                <UploadIcon />
                <span className="text-sm font-medium text-ink dark:text-zinc-200">
                  {selectedFile ? selectedFile.name : t("uploadLabel")}
                </span>
                <span className="mt-1 text-xs text-fade">{t("uploadHint")}</span>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImageChange}
                  aria-label={t("uploadLabel")}
                />
              </div>

              {error && <ErrorBanner message={error} />}

              <div className="flex justify-end gap-2">
                <BackButton onClick={() => { setStep("choice"); setError(null); setSelectedFile(null); }} disabled={isBusy} label={t("back")} />
                <button
                  type="button"
                  onClick={() => { void handleProcess(); }}
                  disabled={!selectedFile}
                  className={buttonClass({ variant: "primary", size: "lg" })}
                >
                  {t("processButton")}
                </button>
              </div>
            </div>
          )}

          {/* ── IMAGE PROCESSING ── */}
          {step === "processing" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner />
              <p className="text-sm text-fade">{t("processing")}</p>
            </div>
          )}

          {/* ── IMAGE SELECT COUNT ── */}
          {step === "select" && scanResult && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium">{t("selectCountTitle")}</p>
                <p className="mt-1 text-sm text-fade">
                  {scanResult.properties.length === 1
                    ? t("selectCountDesc",       { count: scanResult.properties.length })
                    : t("selectCountDescPlural", { count: scanResult.properties.length })}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {Array.from({ length: scanResult.properties.length }, (_, i) => i + 1).map((n) => (
                  <label
                    key={n}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors ${
                      saveCount === n
                        ? "border-cta bg-cta-pale dark:border-cta dark:bg-cta/10"
                        : "border-wire bg-white hover:border-cta/50 dark:border-zinc-700 dark:bg-zinc-900"
                    }`}
                  >
                    <input
                      type="radio"
                      name="saveCount"
                      value={n}
                      checked={saveCount === n}
                      onChange={() => setSaveCount(n)}
                      className="accent-cta"
                    />
                    <span className="text-sm font-medium">
                      {n === 1
                        ? t("saveCount1")
                        : t("savingProperties", { count: n })}
                    </span>
                    <span className="ml-auto text-xs text-fade">
                      {scanResult.properties[n - 1]?.corners.length ?? 0} corners
                    </span>
                  </label>
                ))}
              </div>

              {scanResult.labels.length > 0 && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  {t("labelsNote")}
                </p>
              )}

              {error && <ErrorBanner message={error} />}

              <div className="flex justify-end gap-2">
                <BackButton onClick={() => { setStep("upload"); setError(null); }} disabled={isBusy} label={t("back")} />
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className={buttonClass({ variant: "primary", size: "lg" })}
                >
                  {saveCount === 1
                    ? t("saveCount1")
                    : t("savingProperties", { count: saveCount })}
                </button>
              </div>
            </div>
          )}

          {/* ── TEXT FILE UPLOAD ── */}
          {step === "upload-text" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium">{t("uploadTextTitle")}</p>

              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-wire bg-canvas px-4 py-8 transition-colors hover:border-cta dark:border-zinc-600 dark:bg-zinc-800"
                onClick={() => textInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") textInputRef.current?.click(); }}
                aria-label={t("uploadTextLabel")}
              >
                <TextFileIcon />
                <span className="text-sm font-medium text-ink dark:text-zinc-200">
                  {textFile ? textFile.name : t("uploadTextLabel")}
                </span>
                <span className="mt-1 text-xs text-fade">{t("uploadTextHint")}</span>
                <input
                  ref={textInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="sr-only"
                  onChange={handleTextFileChange}
                  aria-label={t("uploadTextLabel")}
                />
              </div>

              {error && <ErrorBanner message={error} />}

              <div className="flex justify-end gap-2">
                <BackButton onClick={() => { resetToChoice(); }} disabled={isBusy} label={t("back")} />
                <button
                  type="button"
                  onClick={() => { void handleImportText(); }}
                  disabled={!textFile}
                  className={buttonClass({ variant: "primary", size: "lg" })}
                >
                  {t("importButton")}
                </button>
              </div>
            </div>
          )}

          {/* ── FOLDER UPLOAD ── */}
          {step === "upload-folder" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium">{t("uploadFolderTitle")}</p>

              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-wire bg-canvas px-4 py-8 transition-colors hover:border-cta dark:border-zinc-600 dark:bg-zinc-800"
                onClick={() => folderInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") folderInputRef.current?.click(); }}
                aria-label={t("uploadFolderLabel")}
              >
                <FolderIcon />
                <span className="text-sm font-medium text-ink dark:text-zinc-200">
                  {folderFiles.length > 0
                    ? t("uploadFolderFilesFound", { count: folderFiles.length })
                    : t("uploadFolderLabel")}
                </span>
                <span className="mt-1 text-xs text-fade">{t("uploadFolderHint")}</span>
                {/* webkitdirectory lets the user pick a folder in supporting browsers */}
                <input
                  ref={folderInputRef}
                  type="file"
                  // @ts-expect-error webkitdirectory is not in React's HTMLInputElement types
                  webkitdirectory=""
                  multiple
                  className="sr-only"
                  onChange={handleFolderChange}
                  aria-label={t("uploadFolderLabel")}
                />
              </div>

              {/* Show found .txt file names */}
              {folderFiles.length > 0 && (
                <ul className="max-h-32 overflow-y-auto rounded-md border border-wire bg-canvas px-3 py-2 text-xs text-fade dark:border-zinc-700 dark:bg-zinc-800">
                  {folderFiles.map((f) => (
                    // webkitdirectory recurses, so two plan.txt in different
                    // subfolders collide on name alone (#32.20 review round 3).
                    <li key={f.webkitRelativePath || f.name} className="truncate">{f.name}</li>
                  ))}
                </ul>
              )}

              {/* No .txt files warning */}
              {folderFiles.length === 0 && folderHadFiles && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  {t("uploadFolderNoFiles")}
                </p>
              )}

              {error && <ErrorBanner message={error} />}

              <div className="flex justify-end gap-2">
                <BackButton onClick={() => { resetToChoice(); }} disabled={isBusy} label={t("back")} />
                <button
                  type="button"
                  onClick={() => { void handleImportFolder(); }}
                  disabled={folderFiles.length === 0}
                  className={buttonClass({ variant: "primary", size: "lg" })}
                >
                  {t("importAllButton")}
                </button>
              </div>
            </div>
          )}

          {/* ── SAVING (all paths) ── */}
          {step === "saving" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner />
              <p className="text-sm text-fade">{savingLabel}</p>
            </div>
          )}

          {/* ── TEXT FILE IMPORT DONE ── */}
          {step === "done-text" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircleIcon />
              <p className="text-sm text-center text-ink dark:text-zinc-200">
                {savingLabel}
              </p>
              <button
                type="button"
                onClick={onClose}
                className={buttonClass({ variant: "primary", size: "lg" })}
              >
                {t("close")}
              </button>
            </div>
          )}

          {/* ── FOLDER IMPORT DONE ── */}
          {step === "done-folder" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircleIcon />
              <p className="text-sm text-center text-ink dark:text-zinc-200">
                {savingLabel}
              </p>
              <button
                type="button"
                onClick={onClose}
                className={buttonClass({ variant: "primary", size: "lg" })}
              >
                {t("close")}
              </button>
            </div>
          )}

          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="h-8 w-8 animate-spin text-cta"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="mb-2 h-8 w-8 text-fade" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function TextFileIcon() {
  return (
    <svg className="mb-2 h-8 w-8 text-fade" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="mb-2 h-8 w-8 text-fade" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
      {message}
    </p>
  );
}

function BackButton(
  { onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean },
) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClass({ variant: "secondary", size: "lg", className: "gap-1.5" })}
    >
      <NavArrowIcon dir="left" />
      <span>{label}</span>
    </button>
  );
}
