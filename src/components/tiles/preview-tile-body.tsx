/**
 * A Previzualizare tile's body: text, one link and one button.  (Slice #37.24)
 *
 * Kept apart from `preview-tiles.tsx`, which reads the record and needs
 * next-intl, so `preview-tiles.test.tsx` can render it under Jest (next-intl
 * is ESM-only there — `src/test-support/icu.ts`). Rendered with a record's
 * fields, it offers „Deschide" and „Închide" and nothing that could write.
 */
import type { CSSProperties } from "react";
import { ArrowRight, X } from "lucide-react";
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
import { RotatedImage } from "@/components/documents/rotated-image";
import { rotationOf, type PageRotation } from "@/lib/documents/page-rotation";

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

/**
 * One value of a compact line (Slice #37.60): its label is read aloud and shown
 * on hover, not printed — the line is the values one after the other.
 */
export type PreviewLineValue = {
  label: string;
  value: string | null;
  /**
   * Words printed before the value, part of the line (Slice #37.70): a
   * person's date of birth reads „născut: 12.03.1960". Dropped with an empty
   * value, like the value itself.
   */
  prefix?: string;
};

/** The lines to draw: each its non-empty values; a line with none is dropped. */
export function compactLines(lines: readonly (readonly PreviewLineValue[])[]): PreviewLineValue[][] {
  return lines.map((line) => line.filter((v) => v.value !== null && v.value.trim() !== "")).filter((line) => line.length > 0);
}

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
  fields,
  openHref,
  labels,
  onClose,
  onOpen,
  image,
  width,
  tile,
  style,
  anchor,
  lines,
  titleNote,
}: {
  title: string;
  /**
   * Slice #37.70: words after the heading's name, in the labels' quieter
   * colour — a company's „(2 contacte)". Not part of the heading itself, so the
   * tile and its heading keep the record's name as theirs.
   */
  titleNote?: string;
  fields: PreviewField[];
  /**
   * Slice #37.60: a person's or a company's preview — the heading is line 1,
   * these are lines 2 and 3, and the tile is as wide as its widest line needs
   * (no panel units). `fields` is ignored when these are given.
   */
  lines?: readonly (readonly PreviewLineValue[])[];
  openHref: string;
  labels: { open: string; close: string; readonly: string; firstPage: string; noPage: string };
  onClose: () => void;
  /**
   * „Deschide" on a plain click: the screen's guarded navigation, so an unsaved
   * edit beside the preview is asked about first (TC-TILES-05 step 9). A
   * Ctrl/⌘-click or a middle-click still opens the link in a new tab.
   */
  onOpen?: (href: string) => void;
  image?: { url: string; mimeType: string | null; rotation?: PageRotation } | null;
  /** Slice #37.33: whole width units — 3 for a person, a company or a property, 4 for a document. */
  width: PreviewWidth;
  tile?: string;
  style?: CSSProperties;
  /** Slice #37.75: the tile its „Previzualizare" was pressed in — the row places it right under that tile. */
  anchor?: string;
}) {
  return (
    <section
      data-tile={tile ? `preview:${tile}` : "preview"}
      data-preview
      data-preview-anchor={anchor}
      aria-label={title}
      data-preview-compact={lines ? "" : undefined}
      // Slice #37.88: „Corelate"'s light green — a preview is what „Corelate" opens. The dashed
      // rim still says it is a look, not the record's own tile.
      className={`rounded-md border border-dashed border-card-related-rim bg-card-related p-3 shadow-sm dark:border-card-related-rim-dark dark:bg-card-related-dark${lines ? " w-max max-w-full" : ""}`}
      style={lines ? style : { ...PREVIEW_STYLE[width], ...style }}
    >
      {/* Slice #37.70: one row, whatever the name's length — a long name wraps inside it and
          „Numai citire" and the two buttons stay at its right. */}
      <div className="mb-2 flex items-start gap-2" data-preview-head>
        <div className="min-w-0 flex-1 break-words">
          <h2 className="inline text-sm font-semibold text-ink dark:text-zinc-100">{title}</h2>
          {titleNote && (
            <span className="ml-1 text-sm text-fade dark:text-zinc-400" data-preview-title-note>{titleNote}</span>
          )}
        </div>
        {/* Slice #37.57: no system ID — the record's own screen shows it, in its first panel's corner. */}
        <span className="shrink-0 rounded-full bg-cap px-2 py-0.5 text-xs text-fade dark:bg-zinc-800 dark:text-zinc-400">{labels.readonly}</span>
        <span className="flex shrink-0 gap-2">
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
          {/* #37.43 (A025): X, „Închide" its name and tooltip. */}
          <IconButton icon={X} label={labels.close} variant="secondary" size="xs" onClick={onClose} />
        </span>
      </div>
      {lines ? (
        // Slice #37.60: two compact lines under the name — values only, „, " between them.
        <div className="flex flex-col gap-0.5 text-sm text-ink dark:text-zinc-100" data-preview-lines>
          {compactLines(lines).map((line) => (
            <p key={line.map((v) => v.label).join("|")} className="whitespace-nowrap" data-preview-line>
              {line.map((v, i) => (
                <span key={v.label} title={v.label} data-preview-value>
                  <span className="sr-only">{v.label}: </span>
                  {v.prefix ? `${v.prefix} ` : ""}
                  {v.value}
                  {i < line.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          ))}
        </div>
      ) : (
      /* Slice #37.33: labels above their values, in the record's screen's rows and widths;
          a value wraps inside its field's width, an empty one is „—". */
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
      )}
      {image !== undefined && (
        <figure className="mt-3">
          <figcaption className="mb-1 text-xs font-medium uppercase tracking-wide text-fade">{labels.firstPage}</figcaption>
          {image === null ? (
            <p className="text-sm text-fade">{labels.noPage}</p>
          ) : image.mimeType?.startsWith("image/") ? (
            // Slice #38.17: with the page's stored turn, fitted to the preview's width.
            <RotatedImage
              src={image.url}
              alt={labels.firstPage}
              rotation={rotationOf(image.rotation)}
              className="block max-w-full rounded border border-card-rim"
              frameClassName="rounded border border-card-rim"
            />
          ) : (
            <iframe src={image.url} title={labels.firstPage} className="block w-full rounded border border-card-rim" style={{ height: "32rem" }} />
          )}
        </figure>
      )}
    </section>
  );
}
