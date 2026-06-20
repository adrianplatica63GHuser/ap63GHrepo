"use client";

/**
 * ImportBrowser — local-folder two-pane file browser for Slice #14.15.01,
 * extended in Slice #15.02 with: classified-file tracking (green filename +
 * Classify/Unclassify toggle), context preservation across navigation away
 * from /admin/import and back, a preview pane that fills all available
 * space while preserving aspect ratio, image rotation, a Word "open" link,
 * and a real text-file preview.
 *
 * Left pane: flat file list from a folder picked via the File System Access
 * API (window.showDirectoryPicker). Arrow keys move focus; click selects;
 * Ctrl/Cmd-click adds to a multi-selection, remembering click order (used by
 * the Document branch of the Classify dialog to order pages).
 *
 * Right pane: live preview of the focused file (image / PDF / text inline,
 * Word documents get a download-to-open link, other types show a generic
 * file icon) — reading the local File object directly via
 * URL.createObjectURL instead of fetching a server URL, since nothing has
 * been uploaded yet at this stage.
 *
 * "Classify" resolves the selected handles to real File objects and opens
 * ClassifyDialog. Once a branch's save flow succeeds, ClassifyDialog calls
 * onClassified() back up so the involved file name(s) render green in the
 * list; re-selecting a single already-classified file flips the action
 * button to "Unclassify".
 *
 * Context preservation: FileSystemHandle objects cannot be serialized into
 * sessionStorage/localStorage, so the folder handle, file list, selection,
 * classified-name set, and per-file rotation are mirrored into a
 * module-level singleton (`snapshot`) on every change. Navigating away from
 * /admin/import within the same SPA session unmounts this component, but
 * the module itself is not re-evaluated, so the singleton survives; the
 * lazy useState initializers below read it back on remount.
 */

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type FSDirectoryHandle,
  type FSFileHandle,
  isFileHandle,
} from "./file-system-types";
import { ClassifyDialog } from "./classify-dialog";

type Entry = { name: string; handle: FSFileHandle };

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function guessMimeFromExt(name: string): string {
  const ext = extOf(name);
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".pdf": return "application/pdf";
    case ".txt": return "text/plain";
    case ".doc": return "application/msword";
    case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default: return "";
  }
}

export function isImage(file: File): boolean {
  return (file.type || guessMimeFromExt(file.name)).startsWith("image/");
}

function isPdf(file: File): boolean {
  return (file.type || guessMimeFromExt(file.name)) === "application/pdf";
}

export function isTextFile(file: File): boolean {
  const mime = file.type || guessMimeFromExt(file.name);
  return mime === "text/plain" || extOf(file.name) === ".txt";
}

export function isWordFile(file: File): boolean {
  const mime = file.type || guessMimeFromExt(file.name);
  const ext = extOf(file.name);
  return (
    ext === ".doc" ||
    ext === ".docx" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

// ---------------------------------------------------------------------------
// Module-level singleton — survives ImportBrowser unmount/remount caused by
// client-side navigation away from and back to /admin/import, as long as the
// browser tab itself isn't reloaded. See file header comment.
// ---------------------------------------------------------------------------

type BrowserSnapshot = {
  dirHandle: FSDirectoryHandle | null;
  folderName: string | null;
  entries: Entry[];
  activeName: string | null;
  selectedOrder: string[];
  classifiedNames: string[];
  rotations: Record<string, number>;
};

const snapshot: BrowserSnapshot = {
  dirHandle: null,
  folderName: null,
  entries: [],
  activeName: null,
  selectedOrder: [],
  classifiedNames: [],
  rotations: {},
};

export function ImportBrowser() {
  const t = useTranslations("adminImport.browser");

  const [supported] = useState<boolean>(
    () => typeof window !== "undefined" && typeof window.showDirectoryPicker === "function",
  );

  const [dirHandle, setDirHandle] = useState<FSDirectoryHandle | null>(() => snapshot.dirHandle);
  const [folderName, setFolderName] = useState<string | null>(() => snapshot.folderName);
  const [entries, setEntries] = useState<Entry[]>(() => snapshot.entries);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [activeName, setActiveName] = useState<string | null>(() => snapshot.activeName);
  const [selectedOrder, setSelectedOrder] = useState<string[]>(() => snapshot.selectedOrder);
  const [classifiedNames, setClassifiedNames] = useState<Set<string>>(
    () => new Set(snapshot.classifiedNames),
  );
  const [rotations, setRotations] = useState<Record<string, number>>(() => snapshot.rotations);

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [classifyOpen, setClassifyOpen] = useState(false);
  const [classifyFiles, setClassifyFiles] = useState<File[]>([]);
  const [resolving, setResolving] = useState(false);

  const listRef = useRef<HTMLUListElement>(null);

  const entryByName = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries) m.set(e.name, e);
    return m;
  }, [entries]);

  // Mirror the bits of state that need to survive a remount into the
  // module-level singleton. This effect never calls setState — it only
  // writes to a plain object — so it does not trip react-hooks/set-state-in-effect.
  useEffect(() => {
    snapshot.dirHandle = dirHandle;
    snapshot.folderName = folderName;
    snapshot.entries = entries;
    snapshot.activeName = activeName;
    snapshot.selectedOrder = selectedOrder;
    snapshot.classifiedNames = Array.from(classifiedNames);
    snapshot.rotations = rotations;
  }, [dirHandle, folderName, entries, activeName, selectedOrder, classifiedNames, rotations]);

  const pickFolder = useCallback(async () => {
    if (!window.showDirectoryPicker) return;
    setLoadError(null);
    try {
      const handle = await window.showDirectoryPicker();
      setDirHandle(handle);
      setFolderName(handle.name);
      setActiveName(null);
      setSelectedOrder([]);
      setPreviewFile(null);
      setLoading(true);
      const collected: Entry[] = [];
      for await (const child of handle.values()) {
        if (isFileHandle(child)) collected.push({ name: child.name, handle: child });
      }
      collected.sort((a, b) => a.name.localeCompare(b.name));
      setEntries(collected);
    } catch (err) {
      // AbortError = user cancelled the picker — not an error to surface.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Derived-state-during-render reset: whenever activeName changes, clear
  // the stale preview synchronously in render (not in an effect — avoids
  // react-hooks/set-state-in-effect, same pattern as sidebar-nav.tsx's
  // openSection sync, see CLAUDE.md Slice #4.5). previewLoading is set here
  // too (rather than at the top of the effect below) for the same reason —
  // ESLint's react-hooks/set-state-in-effect flags ANY setState call in an
  // effect body that runs before the first await/promise callback, even
  // one as innocuous as a loading flag.
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  if (resolvedFor !== activeName) {
    setResolvedFor(activeName);
    setPreviewFile(null);
    setPreviewText(null);
    setPreviewLoading(activeName !== null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  // Load preview whenever the active file changes. All setState calls here
  // happen inside the promise chain (deferred), not synchronously in the
  // effect body, so this doesn't trip react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    if (!activeName) return;
    const entry = entryByName.get(activeName);
    if (!entry) return;

    entry.handle
      .getFile()
      .then(async (file) => {
        if (cancelled) return;
        setPreviewFile(file);
        if (isImage(file) || isPdf(file) || isWordFile(file)) {
          setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return URL.createObjectURL(file);
          });
        }
        if (isTextFile(file)) {
          try {
            const text = await file.text();
            if (!cancelled) setPreviewText(text);
          } catch {
            if (!cancelled) setPreviewText(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewFile(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entryByName is derived from entries each render; only activeName should re-trigger
  }, [activeName]);

  const handleSelect = useCallback(
    (name: string, e: React.MouseEvent | React.KeyboardEvent) => {
      const multi = e.ctrlKey || e.metaKey;
      setActiveName(name);
      setSelectedOrder((prev) => {
        if (!multi) return [name];
        if (prev.includes(name)) return prev.filter((n) => n !== name);
        return [...prev, name];
      });
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (entries.length === 0) return;
      const idx = activeName ? entries.findIndex((en) => en.name === activeName) : -1;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = entries[Math.min(idx + 1, entries.length - 1)] ?? entries[0];
        setActiveName(next.name);
        setSelectedOrder([next.name]);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIdx = idx <= 0 ? 0 : idx - 1;
        const next = entries[prevIdx];
        setActiveName(next.name);
        setSelectedOrder([next.name]);
      }
    },
    [entries, activeName],
  );

  const openClassify = useCallback(async () => {
    setResolving(true);
    try {
      const files: File[] = [];
      for (const name of selectedOrder) {
        const entry = entryByName.get(name);
        if (!entry) continue;
        files.push(await entry.handle.getFile());
      }
      setClassifyFiles(files);
      setClassifyOpen(true);
    } finally {
      setResolving(false);
    }
  }, [selectedOrder, entryByName]);

  const markClassified = useCallback((names: string[]) => {
    setClassifiedNames((prev) => {
      const next = new Set(prev);
      for (const n of names) next.add(n);
      return next;
    });
  }, []);

  const singleSelected = selectedOrder.length === 1 ? selectedOrder[0] : null;
  const singleClassified = singleSelected !== null && classifiedNames.has(singleSelected);

  const handleUnclassify = useCallback(() => {
    if (!singleSelected) return;
    setClassifiedNames((prev) => {
      const next = new Set(prev);
      next.delete(singleSelected);
      return next;
    });
  }, [singleSelected]);

  const rotateBy = useCallback(
    (delta: number) => {
      if (!activeName) return;
      setRotations((prev) => {
        const current = prev[activeName] ?? 0;
        const next = ((current + delta) % 360 + 360) % 360;
        return { ...prev, [activeName]: next };
      });
    },
    [activeName],
  );

  const activeRotation = activeName ? rotations[activeName] ?? 0 : 0;
  const rotationIsQuarterTurn = activeRotation === 90 || activeRotation === 270;

  if (!supported) {
    return (
      <div className="rounded-md border border-card-rim bg-card p-6 text-sm text-fade shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {t("unsupported")}
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={pickFolder}
          className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d"
        >
          {dirHandle ? t("changeFolderButton") : t("chooseFolderButton")}
        </button>
        {folderName && (
          <span className="text-sm font-medium text-ink dark:text-zinc-300">📁 {folderName}</span>
        )}
      </div>

      {loadError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {loadError}
        </p>
      )}

      {dirHandle && (
        <p className="text-xs text-fade dark:text-zinc-500">{t("selectionHint")}</p>
      )}

      <div className="flex flex-1 min-h-0 gap-4 rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Left pane — file list */}
        <div className="flex w-72 shrink-0 min-h-0 flex-col border-r border-crease pr-3 dark:border-zinc-800">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fade">
            {t("fileListLabel")}
          </h2>
          {!dirHandle ? (
            <p className="text-sm text-fade dark:text-zinc-500">{t("noFolderChosen")}</p>
          ) : loading ? (
            <p className="text-sm text-fade dark:text-zinc-500">…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-fade dark:text-zinc-500">{t("emptyFolder")}</p>
          ) : (
            <ul
              ref={listRef}
              role="listbox"
              aria-multiselectable="true"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className="flex flex-1 min-h-0 flex-col gap-0.5 overflow-y-auto focus:outline-none"
            >
              {entries.map((entry) => {
                const active = entry.name === activeName;
                const selected = selectedOrder.includes(entry.name);
                const order = selectedOrder.indexOf(entry.name);
                const classified = classifiedNames.has(entry.name);
                return (
                  <li key={entry.name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={(e) => handleSelect(entry.name, e)}
                      className={[
                        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm",
                        active
                          ? "bg-cta-pale font-medium"
                          : selected
                            ? "bg-zinc-100 dark:bg-zinc-800"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                      ].join(" ")}
                    >
                      {selected && (
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cta text-[10px] font-semibold text-white">
                          {order + 1}
                        </span>
                      )}
                      <span
                        className={[
                          "truncate",
                          classified
                            ? "text-emerald-600 dark:text-emerald-400"
                            : active
                              ? "text-cta"
                              : "",
                        ].join(" ")}
                      >
                        {entry.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right pane — preview */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fade">
              {t("previewTitle")}
            </h2>
            {previewFile && isImage(previewFile) && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => rotateBy(-90)}
                  aria-label={t("rotateLeft")}
                  title={t("rotateLeft")}
                  className="rounded p-1 text-sm text-fade hover:bg-canvas dark:hover:bg-zinc-800"
                >
                  ↺
                </button>
                <button
                  type="button"
                  onClick={() => rotateBy(90)}
                  aria-label={t("rotateRight")}
                  title={t("rotateRight")}
                  className="rounded p-1 text-sm text-fade hover:bg-canvas dark:hover:bg-zinc-800"
                >
                  ↻
                </button>
                <button
                  type="button"
                  onClick={() => rotateBy(180)}
                  aria-label={t("rotate180")}
                  title={t("rotate180")}
                  className="rounded px-1.5 py-1 text-xs font-medium text-fade hover:bg-canvas dark:hover:bg-zinc-800"
                >
                  180°
                </button>
              </div>
            )}
          </div>
          <div
            className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-crease dark:border-zinc-800"
            style={{ containerType: "size" }}
          >
            {!activeName ? (
              <p className="p-6 text-sm text-fade dark:text-zinc-500">{t("noPreview")}</p>
            ) : previewLoading ? (
              <p className="p-6 text-sm text-fade dark:text-zinc-500">…</p>
            ) : previewUrl && previewFile && isImage(previewFile) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={previewFile.name}
                style={{ transform: `rotate(${activeRotation}deg)` }}
                className={
                  rotationIsQuarterTurn
                    ? "max-h-[100cqw] max-w-[100cqh] object-contain"
                    : "max-h-[100cqh] max-w-[100cqw] object-contain"
                }
              />
            ) : previewUrl && previewFile && isPdf(previewFile) ? (
              <iframe
                src={previewUrl}
                title={previewFile.name}
                className="h-full w-full"
                style={{ border: "none" }}
              />
            ) : previewFile && isWordFile(previewFile) ? (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <FileGlyph />
                <p className="text-sm font-medium text-ink dark:text-zinc-200">
                  {previewFile.name}
                </p>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    download={previewFile.name}
                    className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-cta-d"
                  >
                    {t("openInWord")}
                  </a>
                )}
                <p className="max-w-xs text-xs text-fade">{t("openInWordHint")}</p>
              </div>
            ) : previewFile && isTextFile(previewFile) ? (
              <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words p-4 text-left text-xs text-ink dark:text-zinc-300">
                {previewText ?? ""}
              </pre>
            ) : previewFile ? (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <FileGlyph />
                <p className="text-sm font-medium text-ink dark:text-zinc-200">{previewFile.name}</p>
                <p className="text-xs text-fade">{t("noPreviewType")}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {selectedOrder.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={singleClassified ? handleUnclassify : openClassify}
            disabled={resolving}
            className={[
              "inline-flex items-center rounded-md px-5 py-2 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
              singleClassified
                ? "border border-wire bg-white text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900"
                : "bg-cta text-white hover:bg-cta-d",
            ].join(" ")}
          >
            {singleClassified ? t("unclassifyButton") : t("classifyButton", { count: selectedOrder.length })}
          </button>
        </div>
      )}

      {classifyOpen && (
        <ClassifyDialog
          files={classifyFiles}
          onClassified={markClassified}
          onClose={() => setClassifyOpen(false)}
        />
      )}
    </div>
  );
}

function FileGlyph() {
  return (
    <svg
      className="h-12 w-12 text-zinc-400"
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
