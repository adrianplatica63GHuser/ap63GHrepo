"use client";

/**
 * PagesPanel — displays uploaded file pages for a Document record.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ PAGES                                   [+ Add Page]     │
 *   ├───────────────────────┬──────────────────────────────────┤
 *   │  Viewer  (lg: 60%)    │  Table  (lg: 40%)                │
 *   │  img / iframe /       │  #  Name  Notes  [View][Print]   │
 *   │  download prompt      │                  [Delete]        │
 *   └───────────────────────┴──────────────────────────────────┘
 *
 * On screens narrower than lg the table sits above the viewer.
 *
 * Rules:
 *  - In "create" mode (no documentId) the panel is never rendered.
 *  - In "view"   mode the Add Page and Delete buttons are hidden.
 *  - Clicking a table row or the View button loads the file into the viewer.
 *  - The Print button opens the file URL in a new browser tab.
 *  - The file is staged locally until Save is confirmed (no orphan uploads).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Page = {
  id:         string;
  documentId: string;
  pageNumber: number;
  pageName:   string | null;
  pageNotes:  string | null;
  fileName:   string;
  fileSize:   number | null;
  mimeType:   string | null;
  createdAt:  string;
  updatedAt:  string;
};

type ViewData = {
  url:      string;
  mimeType: string | null;
  fileName: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isImage(mimeType: string | null | undefined): boolean {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}

function isPdf(mimeType: string | null | undefined): boolean {
  return mimeType === "application/pdf";
}

const ACCEPTED_FILE_TYPES =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.xml,.html";

// ---------------------------------------------------------------------------
// PagesPanel
// ---------------------------------------------------------------------------

type Props = {
  documentId: string;
  mode:       "edit" | "view";
};

export function PagesPanel({ documentId, mode }: Props) {
  const t = useTranslations("document.pages");
  const queryClient = useQueryClient();

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [viewData,       setViewData]       = useState<ViewData | null>(null);
  const [viewLoading,    setViewLoading]    = useState(false);
  const [viewError,      setViewError]      = useState<string | null>(null);

  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);

  // ── Fetch page list ──────────────────────────────────────────────────────

  const {
    data: pages = [],
    isLoading,
    isError,
  } = useQuery<Page[]>({
    queryKey: ["document-pages", documentId],
    queryFn: async () => {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/pages`,
      );
      if (!res.ok) throw new Error("Failed to load pages");
      return res.json() as Promise<Page[]>;
    },
  });

  // ── Load view URL ────────────────────────────────────────────────────────

  const loadView = useCallback(
    async (page: Page) => {
      setSelectedPageId(page.id);
      setViewData(null);
      setViewError(null);
      setViewLoading(true);
      try {
        const res = await fetch(
          `/api/documents/${encodeURIComponent(documentId)}/pages/${encodeURIComponent(page.id)}/view`,
        );
        if (!res.ok) throw new Error("Failed to load file");
        const data = (await res.json()) as ViewData;
        setViewData(data);
      } catch (err) {
        setViewError(
          err instanceof Error ? err.message : t("viewer.error"),
        );
      } finally {
        setViewLoading(false);
      }
    },
    [documentId, t],
  );

  // ── Auto-display the first page on open ─────────────────────────────────
  // Runs once the page list resolves and nothing has been selected yet. The
  // effect body itself never calls setState synchronously — it only ever
  // schedules a microtask (`Promise.resolve().then(...)`) whose callback
  // calls the existing `loadView` handler. This mirrors the established
  // fix pattern for `react-hooks/set-state-in-effect` already used
  // elsewhere in this codebase (e.g. Slice #15.02's preview-loading effect):
  // any setState reachable from this effect happens after a promise
  // boundary, never directly in the effect's synchronous body.
  useEffect(() => {
    if (selectedPageId !== null || pages.length === 0) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadView(pages[0]);
    });
    return () => {
      active = false;
    };
  }, [pages, selectedPageId, loadView]);

  // ── Previous / Next navigation ───────────────────────────────────────────

  const currentIndex = pages.findIndex((p) => p.id === selectedPageId);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < pages.length - 1;

  const goToPage = useCallback(
    (delta: -1 | 1) => {
      const target = currentIndex + delta;
      if (target < 0 || target >= pages.length) return;
      loadView(pages[target]);
    },
    [currentIndex, pages, loadView],
  );

  // ── Print handler ────────────────────────────────────────────────────────

  const handlePrint = useCallback(
    async (page: Page) => {
      try {
        const res = await fetch(
          `/api/documents/${encodeURIComponent(documentId)}/pages/${encodeURIComponent(page.id)}/view`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as ViewData;
        window.open(data.url, "_blank", "noopener,noreferrer");
      } catch {
        // Silently fail — the user will try again.
      }
    },
    [documentId],
  );

  // ── Delete mutation ──────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/pages/${encodeURIComponent(pageId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({
        queryKey: ["document-pages", documentId],
      });
      setDeleteTarget(null);
      // Clear viewer if the deleted page was being viewed.
      if (selectedPageId === deletedId) {
        setSelectedPageId(null);
        setViewData(null);
      }
    },
  });

  // ── Compute next page number default ────────────────────────────────────

  const nextPageNumber =
    pages.length > 0
      ? Math.max(...pages.map((p) => p.pageNumber)) + 1
      : 1;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      aria-label={t("sectionTitle")}
    >
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
            {t("sectionTitle")}
          </h2>
          {pages.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToPage(-1)}
                disabled={!canGoPrev}
                aria-label={t("prevPage")}
                title={t("prevPage")}
                className="rounded-md border border-wire px-2 py-1 text-xs font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ‹ {t("prevPage")}
              </button>
              <span className="text-xs tabular-nums text-fade">
                {t("pageIndicator", {
                  current: currentIndex >= 0 ? currentIndex + 1 : 1,
                  total: pages.length,
                })}
              </span>
              <button
                type="button"
                onClick={() => goToPage(1)}
                disabled={!canGoNext}
                aria-label={t("nextPage")}
                title={t("nextPage")}
                className="rounded-md border border-wire px-2 py-1 text-xs font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {t("nextPage")} ›
              </button>
            </div>
          )}
        </div>
        {mode === "edit" && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1 rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-cta-d"
          >
            + {t("addPage")}
          </button>
        )}
      </div>

      {/* Loading / error states */}
      {isLoading && (
        <p className="text-sm text-fade">{t("viewer.loading")}</p>
      )}
      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400">{t("loadError")}</p>
      )}

      {/* Main body */}
      {!isLoading && !isError && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">

          {/* ── Viewer (left on lg, below on sm) ────────────────────────── */}
          <div className="order-2 min-h-[320px] flex-1 overflow-hidden rounded-md border border-wire bg-white dark:border-zinc-700 dark:bg-zinc-950 lg:order-1">
            {viewLoading && (
              <Centred>
                <span className="text-sm text-fade">{t("viewer.loading")}</span>
              </Centred>
            )}
            {!viewLoading && viewError && (
              <Centred>
                <span className="text-sm text-red-600 dark:text-red-400">
                  {t("viewer.error")}
                </span>
              </Centred>
            )}
            {!viewLoading && !viewError && !viewData && (
              <Centred>
                <span className="text-sm text-fade">{t("viewer.placeholder")}</span>
              </Centred>
            )}
            {!viewLoading && !viewError && viewData && (
              <PageViewer viewData={viewData} />
            )}
          </div>

          {/* ── Table (right on lg, above on sm) ────────────────────────── */}
          <div className="order-1 w-full lg:order-2 lg:w-[380px] lg:shrink-0">
            {pages.length === 0 ? (
              <p className="text-sm text-fade">{t("empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wire text-left text-xs font-medium uppercase text-fade dark:border-zinc-700">
                      <th className="pb-1.5 pr-2 font-medium">{t("colNum")}</th>
                      <th className="pb-1.5 pr-2 font-medium">{t("colName")}</th>
                      <th className="hidden pb-1.5 pr-2 font-medium sm:table-cell">
                        {t("colNotes")}
                      </th>
                      <th className="pb-1.5 font-medium">{t("colActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((page) => (
                      <tr
                        key={page.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selectedPageId === page.id}
                        onClick={() => loadView(page)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") loadView(page);
                        }}
                        className={[
                          "cursor-pointer border-b border-wire/50 transition-colors dark:border-zinc-800",
                          "hover:bg-canvas dark:hover:bg-zinc-800/50",
                          selectedPageId === page.id
                            ? "bg-cta-pale dark:bg-zinc-800"
                            : "",
                        ].join(" ")}
                      >
                        {/* # */}
                        <td className="py-1.5 pr-2 font-mono text-xs tabular-nums">
                          {page.pageNumber}
                        </td>

                        {/* Name / filename fallback */}
                        <td
                          className="max-w-[110px] truncate py-1.5 pr-2"
                          title={page.pageName ?? page.fileName}
                        >
                          {page.pageName ?? (
                            <span className="text-xs text-fade italic">
                              {page.fileName}
                            </span>
                          )}
                        </td>

                        {/* Notes */}
                        <td
                          className="hidden max-w-[110px] truncate py-1.5 pr-2 text-xs text-fade sm:table-cell"
                          title={page.pageNotes ?? ""}
                        >
                          {page.pageNotes ?? "—"}
                        </td>

                        {/* Action buttons */}
                        <td className="py-1.5">
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <ActionBtn
                              onClick={() => loadView(page)}
                              className="text-cta hover:bg-cta-pale dark:hover:bg-zinc-700"
                              title={t("view")}
                            >
                              {t("view")}
                            </ActionBtn>

                            <ActionBtn
                              onClick={() => handlePrint(page)}
                              className="text-ink hover:bg-canvas dark:text-zinc-300 dark:hover:bg-zinc-700"
                              title={t("print")}
                            >
                              {t("print")}
                            </ActionBtn>

                            {mode === "edit" && (
                              <ActionBtn
                                onClick={() => setDeleteTarget(page)}
                                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title={t("delete")}
                              >
                                {t("delete")}
                              </ActionBtn>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}

      {dialogOpen && (
        <AddPageDialog
          documentId={documentId}
          defaultPageNumber={nextPageNumber}
          onClose={() => setDialogOpen(false)}
          onSuccess={() => {
            setDialogOpen(false);
            queryClient.invalidateQueries({
              queryKey: ["document-pages", documentId],
            });
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          page={deleteTarget}
          busy={deleteMutation.isPending}
          error={deleteMutation.isError ? t("deleteError") : null}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => {
            setDeleteTarget(null);
            deleteMutation.reset();
          }}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// PageViewer — renders the file inline when possible, download link otherwise
// ---------------------------------------------------------------------------

function PageViewer({ viewData }: { viewData: ViewData }) {
  if (isImage(viewData.mimeType)) {
    return (
      <div className="flex min-h-[320px] items-center justify-center p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={viewData.url}
          alt={viewData.fileName}
          className="max-h-[600px] max-w-full object-contain"
        />
      </div>
    );
  }

  if (isPdf(viewData.mimeType)) {
    return (
      <iframe
        src={viewData.url}
        title={viewData.fileName}
        className="h-[600px] w-full"
        style={{ border: "none" }}
      />
    );
  }

  // Word, Excel, plain-text, and other types:
  // Browsers cannot render these natively inside an iframe or img.
  // Show a download prompt with the filename.
  return <DownloadPrompt viewData={viewData} />;
}

function DownloadPrompt({ viewData }: { viewData: ViewData }) {
  const t = useTranslations("document.pages");
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-6 text-center">
      <FileIcon mimeType={viewData.mimeType} />
      <div>
        <p className="text-sm font-medium text-ink dark:text-zinc-200">
          {viewData.fileName}
        </p>
        <p className="mt-1 text-xs text-fade">{t("viewer.downloadPrompt")}</p>
      </div>
      <a
        href={viewData.url}
        download={viewData.fileName}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d"
      >
        ↓ {t("viewer.download")}
      </a>
    </div>
  );
}

/** Generic file icon based on MIME type. */
function FileIcon({ mimeType }: { mimeType: string | null }) {
  const color =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
      ? "text-blue-600"
      : mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        mimeType === "application/vnd.ms-excel"
      ? "text-green-600"
      : "text-zinc-400";

  return (
    <svg
      className={`h-12 w-12 ${color}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// AddPageDialog
// ---------------------------------------------------------------------------

type AddPageDialogProps = {
  documentId:        string;
  defaultPageNumber: number;
  onClose:           () => void;
  onSuccess:         () => void;
};

function AddPageDialog({
  documentId,
  defaultPageNumber,
  onClose,
  onSuccess,
}: AddPageDialogProps) {
  const t = useTranslations("document.pages");

  const [pageNumber, setPageNumber] = useState(String(defaultPageNumber));
  const [pageName,   setPageName]   = useState("");
  const [pageNotes,  setPageNotes]  = useState("");
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 20 * 1024 * 1024) {
      setError(t("dialog.fileTooLarge"));
      setStagedFile(null);
      // Reset so the same file can be re-selected after error.
      e.target.value = "";
    } else {
      setStagedFile(file);
      setError(null);
    }
  };

  const handleSave = async () => {
    if (!stagedFile) {
      setError(t("dialog.fileRequired"));
      return;
    }
    const num = parseInt(pageNumber, 10);
    if (!num || num < 1) {
      setError(t("dialog.pageNumberRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("pageNumber", String(num));
      fd.append("pageName",   pageName.trim());
      fd.append("pageNotes",  pageNotes.trim());
      fd.append("file",       stagedFile);

      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/pages`,
        { method: "POST", body: fd },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string })?.error ?? t("dialog.uploadError"),
        );
      }
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("dialog.uploadError"),
      );
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-page-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3
          id="add-page-title"
          className="text-base font-semibold text-ink dark:text-zinc-100"
        >
          {t("dialog.title")}
        </h3>

        <div className="mt-4 flex flex-col gap-3">
          {/* Page number */}
          <DialogRow label={t("dialog.pageNumber")}>
            <input
              type="number"
              min={1}
              value={pageNumber}
              onChange={(e) => setPageNumber(e.target.value)}
              className="w-24 rounded-md border border-wire bg-white px-2 py-1 shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </DialogRow>

          {/* Page name */}
          <DialogRow label={t("dialog.pageName")}>
            <input
              type="text"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              className="flex-1 rounded-md border border-wire bg-white px-2 py-1 shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </DialogRow>

          {/* Page notes */}
          <DialogRow label={t("dialog.pageNotes")} alignTop>
            <textarea
              value={pageNotes}
              onChange={(e) => setPageNotes(e.target.value)}
              rows={2}
              className="flex-1 rounded-md border border-wire bg-white px-2 py-1 shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </DialogRow>

          {/* File upload */}
          <div className="flex items-center gap-2 text-sm">
            <span className="w-32 shrink-0" aria-hidden="true" />
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileChange}
              className="sr-only"
              aria-label={t("dialog.upload")}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-sm font-medium text-ink shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {t("dialog.upload")}
            </button>
            {stagedFile && (
              <span
                className="max-w-[180px] truncate text-sm text-ink dark:text-zinc-300"
                title={stagedFile.name}
              >
                ✓ {stagedFile.name}
              </span>
            )}
          </div>

          {error && (
            <p
              className="ml-32 text-xs text-red-600 dark:text-red-400"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {t("dialog.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !stagedFile}
            className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t("dialog.saving") : t("dialog.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeleteConfirmDialog
// ---------------------------------------------------------------------------

type DeleteConfirmProps = {
  page:      Page;
  busy:      boolean;
  error:     string | null;
  onConfirm: () => void;
  onCancel:  () => void;
};

function DeleteConfirmDialog({
  page,
  busy,
  error,
  onConfirm,
  onCancel,
}: DeleteConfirmProps) {
  const t = useTranslations("document.pages");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-page-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3
          id="delete-page-title"
          className="text-base font-semibold text-ink dark:text-zinc-100"
        >
          {t("deleteConfirm.title")}
        </h3>
        <p className="mt-2 text-sm text-fade dark:text-zinc-400">
          {t("deleteConfirm.body")}
        </p>
        <p className="mt-1 text-sm font-medium text-ink dark:text-zinc-200">
          {page.pageName ?? page.fileName}
        </p>
        {error && (
          <p
            className="mt-2 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {t("deleteConfirm.no")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {t("deleteConfirm.yes")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small layout helpers
// ---------------------------------------------------------------------------

/** Centred placeholder slot in the viewer area. */
function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center p-4 text-center">
      {children}
    </div>
  );
}

/** Inline-label row used in the Add Page dialog. */
function DialogRow({
  label,
  alignTop = false,
  children,
}: {
  label:     string;
  alignTop?: boolean;
  children:  React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex gap-2 text-sm",
        alignTop ? "items-start" : "items-center",
      ].join(" ")}
    >
      <span
        className={[
          "w-32 shrink-0 font-medium text-ink dark:text-zinc-300",
          alignTop ? "pt-1" : "",
        ].join(" ")}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** Compact text button used in the table action column. */
function ActionBtn({
  onClick,
  className,
  title,
  children,
}: {
  onClick:   () => void;
  className: string;
  title:     string;
  children:  React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        "rounded px-1.5 py-0.5 text-xs font-medium transition-colors",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
