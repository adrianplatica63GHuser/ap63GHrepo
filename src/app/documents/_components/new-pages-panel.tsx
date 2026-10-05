"use client";

/**
 * „Pagini" on a new document — the files chosen before its first save.
 *                                                               (Slice #37.93)
 *
 * The create form has no id to upload to, so this panel only HOLDS the files:
 * each with a thumbnail (an image's own picture, otherwise the file's icon),
 * in an order the user sets with „Mută mai sus" / „Mută mai jos", and removable.
 * A file is refused here, as „+ Adaugă pagină" refuses it on a saved document
 * (#34.06: the same accept list, the same type and size checks, the same
 * words). The form's Save creates the document and then uploads these in
 * order (`saveNewDocument`); until then nothing leaves the browser.
 *
 * It stands where „Pagini" stands on a saved document — the right-hand
 * column, purple — so the screen does not change shape on the first save.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, FilePlus, FileText, Trash2 } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { UPLOAD_ACCEPT_ATTRIBUTE } from "@/lib/files/file-kinds";
import { contentTypeOf } from "@/lib/files/file-mime";
import { MAX_UPLOAD_MB } from "@/lib/import/constraint-rules";
import { movePage, pageRefusal, type StagedPage } from "@/lib/documents/new-document-pages";

type Props = {
  pages:    StagedPage[];
  onChange: (next: StagedPage[]) => void;
  /** The tile's look — the pinned (purple) surface, as on a saved document. */
  surface:  string;
  disabled?: boolean;
};

/** An image's own picture, from a URL made for it and revoked with it. */
function Thumbnail({ file }: { file: File }) {
  const type = file.type || contentTypeOf(file.name) || "";
  const image = type.startsWith("image/");
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!image) return;
    const made = URL.createObjectURL(file);
    const id = setTimeout(() => setUrl(made), 0);
    return () => {
      clearTimeout(id);
      URL.revokeObjectURL(made);
    };
  }, [file, image]);
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-card-rim bg-white dark:border-zinc-700 dark:bg-zinc-950">
      {image && url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local object URL; next/image cannot optimise it
        <img src={url} alt="" className="h-full w-full object-cover" data-staged-thumb="image" />
      ) : (
        <FileText className="h-7 w-7 text-fade" aria-hidden="true" data-staged-thumb="file" />
      )}
    </span>
  );
}

export function NewPagesPanel({ pages, onChange, surface, disabled = false }: Props) {
  const t = useTranslations("document.pages");
  const inputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const [refused, setRefused] = useState<string[]>([]);

  const choose = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    const kept: StagedPage[] = [];
    const lines: string[] = [];
    for (const file of files) {
      const reason = pageRefusal(file);
      if (reason === null) kept.push({ key: `staged-${nextKey.current++}`, file });
      else lines.push(t("staged.refused", { name: file.name, reason: t(`dialog.${reason}`, { limitMb: MAX_UPLOAD_MB }) }));
    }
    setRefused(lines);
    if (kept.length > 0) onChange([...pages, ...kept]);
  };

  return (
    <section className={`${surface} flex h-full flex-col`} aria-label={t("sectionTitle")} data-new-pages>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">{t("sectionTitle")}</h2>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT_ATTRIBUTE}
          className="sr-only"
          aria-label={t("staged.choose")}
          disabled={disabled}
          onChange={(e) => {
            choose(e.target.files);
            // The same file can be chosen again after a refusal or a removal.
            e.target.value = "";
          }}
        />
        {/* The name keeps its „+": the saved document's button is found by „+ Adaugă pagină". */}
        <IconButton
          icon={FilePlus}
          label={`+ ${t("addPage")}`}
          variant="primary"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        />
      </div>

      <p className="mb-3 text-xs text-fade">{t("staged.hint")}</p>

      {refused.length > 0 && (
        <ul role="alert" className="mb-3 flex flex-col gap-1 text-xs text-red-600 dark:text-red-400">
          {refused.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {pages.length === 0 ? (
        <p className="text-sm text-fade">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-2" aria-label={t("staged.listLabel")}>
          {pages.map((page, i) => (
            <li key={page.key} className="flex items-center gap-3" data-staged-page={page.file.name}>
              <span className="w-6 shrink-0 text-right text-sm tabular-nums text-fade">{i + 1}</span>
              <Thumbnail file={page.file} />
              <span className="min-w-0 flex-1 truncate text-sm text-ink dark:text-zinc-200" title={page.file.name}>
                {page.file.name}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <IconButton
                  icon={ArrowUp}
                  label={t("staged.moveUp")}
                  variant="secondary"
                  size="xs"
                  disabled={disabled || i === 0}
                  onClick={() => onChange(movePage(pages, i, -1))}
                />
                <IconButton
                  icon={ArrowDown}
                  label={t("staged.moveDown")}
                  variant="secondary"
                  size="xs"
                  disabled={disabled || i === pages.length - 1}
                  onClick={() => onChange(movePage(pages, i, 1))}
                />
                <IconButton
                  icon={Trash2}
                  label={t("staged.remove")}
                  variant="danger"
                  size="xs"
                  disabled={disabled}
                  onClick={() => onChange(pages.filter((p) => p.key !== page.key))}
                />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
