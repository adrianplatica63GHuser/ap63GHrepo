"use client";

/**
 * AddPropertyDialog
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

import { useRef, useState } from "react";
import { useQueryClient }   from "@tanstack/react-query";
import { useTranslations }  from "next-intl";
import { useRouter }        from "next/navigation";
import Link                 from "next/link";
import { NavArrowIcon }      from "@/components/back-arrow";

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

/** Create one property via the main properties API. */
async function createProperty(
  corners:  Corner[],
  notes:    string | null,
  nickname: string | null,
): Promise<string> {
  const payload: Record<string, unknown> = {
    corners: corners.map((c) => ({ lat: c.lat, lon: c.lon, originalIndex: c.originalIndex ?? null })),
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

interface Props {
  onClose: () => void;
}

export function AddPropertyDialog({ onClose }: Props) {
  const t           = useTranslations("property.addDialog");
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
  const isImportingRef  = useRef(false);

  // ── Navigation helpers ────────────────────────────────────────────────────

  /** Navigate to all saved property pages in sequence, then close. */
  const navigateToSaved = async (ids: string[]) => {
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
        const id = await createProperty(result.properties[i].corners, notesText, null);
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
    isImportingRef.current = true;
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
      isImportingRef.current = false;
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
      isImportingRef.current = false;
      return;
    }

    if (corners.length === 0) {
      setError(t("noCoordinatesFound"));
      setStep("upload-text");
      isImportingRef.current = false;
      return;
    }

    const nickname = nicknameFromFilename(fileName);
    setSavingLabel(t("savingProperties", { count: 1 }));

    try {
      await createProperty(corners, null, nickname);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStep("upload-text");
      isImportingRef.current = false;
      return;
    }

    // Invalidate the property list so it refreshes when the dialog closes.
    await queryClient.invalidateQueries({ queryKey: ["properties"] });

    // Show acknowledgement screen — user closes manually to return to list.
    setSavingLabel(t("textImportDone"));
    setStep("done-text");
    isImportingRef.current = false;
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
    isImportingRef.current = true;
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
    let   skipped   = 0;

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
        skipped++;
        continue;
      }

      if (corners.length === 0) {
        skipped++;
        continue;
      }

      const nickname = nicknameFromFilename(name);
      try {
        const id = await createProperty(corners, null, nickname);
        savedIds.push(id);
      } catch {
        skipped++;
      }
    }

    if (savedIds.length === 0) {
      setError(t("noCoordinatesFound"));
      setStep("upload-folder");
      isImportingRef.current = false;
      return;
    }

    // Invalidate the property list so it refreshes when the dialog closes.
    await queryClient.invalidateQueries({ queryKey: ["properties"] });

    // Show acknowledgement screen — user closes manually to return to list.
    setSavingLabel(
      t("folderImportDone", { success: savedIds.length, total })
    );
    setStep("done-folder");
    isImportingRef.current = false;
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-md rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="rounded p-1 text-fade hover:bg-canvas dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">

          {/* ── CHOICE ── */}
          {step === "choice" && (
            <div className="flex flex-col gap-3">
              {/* 1. Manual entry */}
              <Link
                href="/properties/new"
                onClick={onClose}
                className="flex flex-col rounded-lg border-2 border-wire bg-white px-4 py-3 transition-colors hover:border-cta hover:bg-cta-pale dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-cta"
              >
                <span className="font-medium">{t("choiceManual")}</span>
                <span className="mt-0.5 text-xs text-fade">{t("choiceManualDesc")}</span>
              </Link>

              {/* 2. From scanned image */}
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="flex flex-col rounded-lg border-2 border-wire bg-white px-4 py-3 text-left transition-colors hover:border-cta hover:bg-cta-pale dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-cta"
              >
                <span className="font-medium">{t("choiceScan")}</span>
                <span className="mt-0.5 text-xs text-fade">{t("choiceScanDesc")}</span>
              </button>

              {/* 3. From a text file */}
              <button
                type="button"
                onClick={() => setStep("upload-text")}
                className="flex flex-col rounded-lg border-2 border-wire bg-white px-4 py-3 text-left transition-colors hover:border-cta hover:bg-cta-pale dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-cta"
              >
                <span className="font-medium">{t("choiceTextFile")}</span>
                <span className="mt-0.5 text-xs text-fade">{t("choiceTextFileDesc")}</span>
              </button>

              {/* 4. From a text folder */}
              <button
                type="button"
                onClick={() => setStep("upload-folder")}
                className="flex flex-col rounded-lg border-2 border-wire bg-white px-4 py-3 text-left transition-colors hover:border-cta hover:bg-cta-pale dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-cta"
              >
                <span className="font-medium">{t("choiceTextFolder")}</span>
                <span className="mt-0.5 text-xs text-fade">{t("choiceTextFolderDesc")}</span>
              </button>
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
                <BackButton onClick={() => { setStep("choice"); setError(null); setSelectedFile(null); }} label={t("back")} />
                <button
                  type="button"
                  onClick={() => { void handleProcess(); }}
                  disabled={!selectedFile}
                  className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-40"
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
                <BackButton onClick={() => { setStep("upload"); setError(null); }} label={t("back")} />
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
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
                <BackButton onClick={() => { resetToChoice(); }} label={t("back")} />
                <button
                  type="button"
                  onClick={() => { void handleImportText(); }}
                  disabled={!textFile}
                  className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-40"
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
                    <li key={f.name} className="truncate">{f.name}</li>
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
                <BackButton onClick={() => { resetToChoice(); }} label={t("back")} />
                <button
                  type="button"
                  onClick={() => { void handleImportFolder(); }}
                  disabled={folderFiles.length === 0}
                  className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-40"
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
                className="rounded-md bg-cta px-6 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
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
                className="rounded-md bg-cta px-6 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
              >
                {t("close")}
              </button>
            </div>
          )}

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

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-4 py-2 text-[0.9375rem] font-semibold text-navy shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-zinc-800"
    >
      <NavArrowIcon dir="left" />
      <span>{label}</span>
    </button>
  );
}
