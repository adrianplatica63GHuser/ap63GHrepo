/**
 * A Previzualizare tile's body: text, one link and one button.  (Slice #37.24)
 *
 * Kept apart from `preview-tiles.tsx`, which reads the record and needs
 * next-intl, so `preview-tiles.test.tsx` can render it under Jest (next-intl
 * is ESM-only there — `src/test-support/icu.ts`). Rendered with a record's
 * fields, it offers „Deschide" and „Închide" and nothing that could write.
 */
import type { CSSProperties } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/ui/button-styles";
import { PAGES_PANEL_STYLE, PANEL_STYLE } from "@/lib/ui/field-widths";

export function PreviewTileBody({
  title,
  code,
  fields,
  openHref,
  labels,
  onClose,
  image,
  width,
  tile,
  style,
}: {
  title: string;
  code: string;
  fields: { label: string; value: string | null }[];
  openHref: string;
  labels: { open: string; close: string; readonly: string; firstPage: string; noPage: string };
  onClose: () => void;
  image?: { url: string; mimeType: string | null } | null;
  width: "panel" | "pages";
  tile?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      data-tile={tile ? `preview:${tile}` : "preview"}
      data-preview
      aria-label={title}
      className="rounded-md border border-dashed border-cta/50 bg-card p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      style={{ ...(width === "pages" ? PAGES_PANEL_STYLE : PANEL_STYLE), ...style }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">{title}</h2>
        {code && <span className="font-mono text-xs text-fade dark:text-zinc-400">{code}</span>}
        <span className="rounded-full bg-cap px-2 py-0.5 text-xs text-fade dark:bg-zinc-800 dark:text-zinc-400">{labels.readonly}</span>
        <span className="ml-auto flex gap-2">
          <Link href={openHref} className={buttonClass({ variant: "secondary", size: "xs" })}>
            {labels.open}
          </Link>
          <button type="button" onClick={onClose} className={buttonClass({ variant: "secondary", size: "xs" })}>
            {labels.close}
          </button>
        </span>
      </div>
      <dl className="grid gap-x-3 gap-y-1 text-sm" style={{ gridTemplateColumns: "5.5rem 1fr" }}>
        {fields.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-fade dark:text-zinc-400">{f.label}</dt>
            <dd className="break-words text-ink dark:text-zinc-100">{f.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
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
