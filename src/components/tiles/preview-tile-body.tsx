/**
 * A Previzualizare tile's body: text, one link and one button.  (Slice #37.24)
 *
 * Kept apart from `preview-tiles.tsx`, which reads the record and needs
 * next-intl, so `preview-tiles.test.tsx` can render it under Jest (next-intl
 * is ESM-only there — `src/test-support/icu.ts`). Rendered with a record's
 * fields, it offers „Deschide" and „Închide" and nothing that could write.
 */
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { buttonClass } from "@/lib/ui/button-styles";
import { IconButton } from "@/lib/ui/icon-button";
import {
  PREVIEW_FILL,
  PREVIEW_INNER_REM,
  PREVIEW_STYLE,
  stackedBoxStyle,
  type FieldWidth,
  type PreviewWidth,
} from "@/lib/ui/field-widths";
import { STACKED_FIELD_CLASS, STACKED_ROW_CLASS } from "@/lib/ui/stacked";

/** A stacked label (`self-end`, rule 16), quieter than the value it names: the value is what a preview is for. */
const PREVIEW_LABEL_CLASS = "self-end text-xs font-medium text-fade dark:text-zinc-400";

/**
 * One field of a preview.                                       (Slice #37.33)
 *
 * `width` is the field's width on its record's screen; without one it takes
 * the tile's whole inner width. Fields with the same `row` share a row, as on
 * the screen; a field without one is a row alone.
 */
export type PreviewField = { label: string; value: string | null; width?: FieldWidth; row?: number };

/** Consecutive fields with the same `row` together; a field without one alone. */
function rowsOf(fields: readonly PreviewField[]): PreviewField[][] {
  const rows: PreviewField[][] = [];
  for (const f of fields) {
    const last = rows[rows.length - 1];
    if (last && f.row !== undefined && last[0].row === f.row) last.push(f);
    else rows.push([f]);
  }
  return rows;
}

export function PreviewTileBody({
  title,
  code,
  fields,
  openHref,
  labels,
  onClose,
  onOpen,
  image,
  width,
  tile,
  style,
}: {
  title: string;
  code: string;
  fields: PreviewField[];
  openHref: string;
  labels: { open: string; close: string; readonly: string; firstPage: string; noPage: string };
  onClose: () => void;
  /**
   * „Deschide" on a plain click: the screen's guarded navigation, so an unsaved
   * edit beside the preview is asked about first (TC-TILES-05 step 9). A
   * Ctrl/⌘-click or a middle-click still opens the link in a new tab.
   */
  onOpen?: (href: string) => void;
  image?: { url: string; mimeType: string | null } | null;
  /** Slice #37.33: whole width units — 3 for a person, a company or a property, 4 for a document. */
  width: PreviewWidth;
  tile?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      data-tile={tile ? `preview:${tile}` : "preview"}
      data-preview
      aria-label={title}
      className="rounded-md border border-dashed border-cta/50 bg-card p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      style={{ ...PREVIEW_STYLE[width], ...style }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">{title}</h2>
        {code && <span className="font-mono text-xs text-fade dark:text-zinc-400">{code}</span>}
        <span className="rounded-full bg-cap px-2 py-0.5 text-xs text-fade dark:bg-zinc-800 dark:text-zinc-400">{labels.readonly}</span>
        <span className="ml-auto flex gap-2">
          {/* #37.42 (A016): ArrowRight, „Deschide" its name and tooltip. */}
          <IconButton
            href={openHref}
            icon={ArrowRight}
            label={labels.open}
            variant="secondary"
            size="xs"
            onClick={(e) => {
              if (!onOpen || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onOpen(openHref);
            }}
          />
          <button type="button" onClick={onClose} className={buttonClass({ variant: "secondary", size: "xs" })}>
            {labels.close}
          </button>
        </span>
      </div>
      {/* Slice #37.33: labels above their values, in the record's screen's rows and widths;
          a value wraps inside its field's width, an empty one is „—". */}
      <div className="flex flex-col gap-2 text-sm" data-preview-fields>
        {rowsOf(fields).map((row) => (
          <div key={row.map((f) => f.label).join("|")} className={STACKED_ROW_CLASS}>
            {row.map((f) => (
              <div key={f.label} className={STACKED_FIELD_CLASS} style={stackedBoxStyle(f.width ?? PREVIEW_FILL, PREVIEW_INNER_REM[width])}>
                <span className={PREVIEW_LABEL_CLASS}>{f.label}</span>
                <span className="break-words text-ink dark:text-zinc-100" data-preview-value>{f.value ?? "—"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {image !== undefined && (
        <figure className="mt-3">
          <figcaption className="mb-1 text-xs font-medium uppercase tracking-wide text-fade">{labels.firstPage}</figcaption>
          {image === null ? (
            <p className="text-sm text-fade">{labels.noPage}</p>
          ) : image.mimeType?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL, as the Pagini panel shows it
            <img src={image.url} alt={labels.firstPage} className="block max-w-full rounded border border-card-rim" />
          ) : (
            <iframe src={image.url} title={labels.firstPage} className="block w-full rounded border border-card-rim" style={{ height: "32rem" }} />
          )}
        </figure>
      )}
    </section>
  );
}
