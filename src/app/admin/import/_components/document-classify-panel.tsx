"use client";

/**
 * DocumentClassifyPanel — Classify dialog, Document branch.
 *
 * Always enabled when >=1 file is selected. Creates one new Document
 * (POST /api/paperwork) of the chosen type, then uploads every selected
 * file as a page (POST /api/paperwork/[id]/pages) in selection order
 * (the order the files were clicked in ImportBrowser — preserved in the
 * `files` array passed down from ClassifyDialog).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PAPERWORK_TYPES, type PaperworkType } from "@/lib/paperwork/validation";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";

type Props = {
  files: File[];
  onBack: () => void;
  onClassified: () => void;
  onClose: () => void;
};

async function callCreatePaperwork(type: PaperworkType, title: string | null): Promise<string> {
  const res = await fetch("/api/paperwork", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, title }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const row = (await res.json()) as { id?: string };
  if (!row.id) throw new Error("No id returned from API");
  return row.id;
}

async function callUploadPage(
  paperworkId: string,
  pageNumber: number,
  file: File,
): Promise<void> {
  const fd = new FormData();
  fd.append("pageNumber", String(pageNumber));
  fd.append("pageName", file.name);
  fd.append("file", file);
  const res = await fetch(`/api/paperwork/${encodeURIComponent(paperworkId)}/pages`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

export function DocumentClassifyPanel({ files, onBack, onClassified, onClose }: Props) {
  const t = useTranslations("adminImport.classify");
  const td = useTranslations("adminImport.classify.document");
  const tTypes = useTranslations("paperwork");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [type, setType] = useState<PaperworkType>("UNCLASSIFIED");
  const [title, setTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Creates the Document + uploads every page — no navigation or
  // dialog-close side effects. Shared by the explicit Create button and by
  // the unsaved-changes guard's Save action.
  const createDocument = async (): Promise<string | null> => {
    setImporting(true);
    setError(null);
    setProgress(0);
    try {
      const id = await callCreatePaperwork(type, title.trim() || null);
      for (let i = 0; i < files.length; i++) {
        await callUploadPage(id, i + 1, files[i]);
        setProgress(i + 1);
      }
      await queryClient.invalidateQueries({ queryKey: ["paperwork"] });
      onClassified();
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : td("error"));
      return null;
    } finally {
      setImporting(false);
    }
  };

  const handleCreate = async () => {
    const id = await createDocument();
    if (id) {
      onClose();
      router.push(`/paperwork/${id}`);
    }
  };

  // Files are staged for classification the whole time this panel is
  // mounted — navigating away without saving would lose them.
  useUnsavedChangesGuard({
    isDirty: true,
    onSave: async () => {
      const id = await createDocument();
      if (!id) return false;
      onClose();
      return true;
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <span className="w-28 shrink-0 font-medium text-ink dark:text-zinc-300">
          {td("typeLabel")}
        </span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as PaperworkType)}
          disabled={importing}
          className="w-full min-w-0 flex-1 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none disabled:bg-canvas dark:border-zinc-700 dark:bg-zinc-950"
        >
          {PAPERWORK_TYPES.map((v) => (
            <option key={v} value={v}>
              {tTypes(`types.${v}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="w-28 shrink-0 font-medium text-ink dark:text-zinc-300">
          {td("titleLabel")}
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={importing}
          className="w-full min-w-0 flex-1 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none disabled:bg-canvas dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fade">
          {td("filesLabel")}
        </p>
        <ul className="flex flex-col gap-0.5 rounded-md border border-wire bg-canvas px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-800/50">
          {files.map((f, i) => (
            <li key={f.name + i} className="flex items-center gap-2 text-sm">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cta text-[10px] font-semibold text-white">
                {i + 1}
              </span>
              <span className="truncate">{f.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={importing}
          className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {t("back")}
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={importing}
          className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? `${td("importing")} (${progress}/${files.length})` : td("importButton")}
        </button>
      </div>
    </div>
  );
}
