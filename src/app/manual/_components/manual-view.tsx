"use client";

/**
 * „Manual de utilizare” — the contents on the left, one chapter on the right.               (Slice #39.37)
 *
 * The address carries the section: `/manual?s=<id>` opens the chapter that holds it and scrolls to it; a chapter
 * id opens the chapter at its top. Every heading and figure carries its id as the element's id, and every link —
 * the contents, a cross-reference, the chapter arrows — is a `manualHref`, so the browser's own back and forward
 * walk through what was read. An unknown id opens chapter 1 and says so.
 *
 * „Descarcă (Word)” builds the .docx HERE, from the same model the chapter is drawn from: it fetches each
 * figure's PNG, reads its size, and saves what `renderManualDocx` returns (Ask first 3).
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { PROSE_STYLE, rem } from "@/lib/ui/field-widths";
import type { Block, Inline, Manual, ManualChapter } from "@/lib/manual/format";
import { figureUrl, getManual, manualHref, manualLocale } from "@/lib/manual/manual";
import { pngSize, renderManualDocx, type FigureImage } from "@/lib/manual/render-docx";

const CONTENTS_STYLE = { width: rem(18) };

function InlineRun({ inlines, manual }: { inlines: readonly Inline[]; manual: Manual }) {
  return (
    <>
      {inlines.map((x, i) => {
        if (x.kind === "bold") return <strong key={i}>{x.text}</strong>;
        if (x.kind === "text") return <Fragment key={i}>{x.text}</Fragment>;
        const target = manual.targets.get(x.id);
        return target ? (
          <Link key={i} href={manualHref(x.id)} className="font-medium text-cta underline-offset-2 hover:underline" data-manual-ref={x.id}>
            {target.number}
          </Link>
        ) : (
          <Fragment key={i}>{`[[${x.id}]]`}</Fragment>
        );
      })}
    </>
  );
}

function ChapterBody({ chapter, manual, figureLabel }: { chapter: ManualChapter; manual: Manual; figureLabel: string }) {
  const out: ReactNode[] = [];
  chapter.blocks.forEach((b: Block, i) => {
    switch (b.kind) {
      case "heading": {
        const text = `${b.number} ${b.title}`;
        const cls = "scroll-mt-4 font-bold text-ink dark:text-zinc-100";
        if (b.level === 1) out.push(<h2 key={i} id={b.id} className={`${cls} text-2xl`}>{text}</h2>);
        else if (b.level === 2) out.push(<h3 key={i} id={b.id} className={`${cls} mt-4 text-xl`}>{text}</h3>);
        else out.push(<h4 key={i} id={b.id} className={`${cls} mt-2 text-base`}>{text}</h4>);
        break;
      }
      case "paragraph":
        out.push(
          <p key={i}>
            <InlineRun inlines={b.inlines} manual={manual} />
          </p>,
        );
        break;
      case "list": {
        const items = b.items.map((it, j) => (
          <li key={j}>
            <InlineRun inlines={it} manual={manual} />
          </li>
        ));
        out.push(
          b.ordered ? (
            <ol key={i} className="list-decimal pl-6">{items}</ol>
          ) : (
            <ul key={i} className="list-disc pl-6">{items}</ul>
          ),
        );
        break;
      }
      case "table":
        out.push(
          <table key={i} className="border-collapse text-left text-sm">
            <thead>
              <tr>
                {b.header.map((h, j) => (
                  <th key={j} className="border border-wire bg-cap px-3 py-1.5 font-semibold dark:bg-zinc-800">
                    <InlineRun inlines={h} manual={manual} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j}>
                  {r.map((c, k) => (
                    <td key={k} className="border border-wire px-3 py-1.5 align-top">
                      <InlineRun inlines={c} manual={manual} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>,
        );
        break;
      case "figure":
        out.push(
          <figure key={i} id={b.id} className="scroll-mt-4 flex flex-col gap-2" data-manual-figure={b.file}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a static figure of the manual, at its own size */}
            <img src={figureUrl(b.file)} alt={b.caption} className="h-auto max-w-full rounded border border-wire" />
            <figcaption className="text-sm italic text-fade">{`${figureLabel} ${b.number} — ${b.caption}`}</figcaption>
          </figure>,
        );
        break;
    }
  });
  return <>{out}</>;
}

async function fetchFigures(manual: Manual): Promise<Map<string, FigureImage>> {
  const files = [...new Set(manual.chapters.flatMap((c) => c.blocks.flatMap((b) => (b.kind === "figure" ? [b.file] : []))))];
  const figures = new Map<string, FigureImage>();
  await Promise.all(
    files.map(async (file) => {
      try {
        const res = await fetch(figureUrl(file));
        if (!res.ok) return;
        const data = new Uint8Array(await res.arrayBuffer());
        const size = pngSize(data);
        if (size) figures.set(file, { data, ...size });
      } catch {
        // A figure that does not arrive is drawn as its caption and „Figura lipsește” — never a failed download.
      }
    }),
  );
  return figures;
}

export function ManualView() {
  const t = useTranslations("manual");
  const locale = manualLocale(useLocale());
  const manual = useMemo(() => getManual(locale), [locale]);
  const asked = useSearchParams().get("s") ?? "";
  const target = asked ? manual.targets.get(asked) : undefined;
  const chapterIndex = Math.max(0, target ? manual.chapters.findIndex((c) => c.id === target.chapterId) : 0);
  const chapter = manual.chapters[chapterIndex];
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // The router can keep the page before this one mounted, hidden — with the same ids in it. So an id is looked
  // up inside THIS screen, never with document.getElementById.
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target || target.kind === "chapter") {
      root.current?.scrollIntoView({ block: "start" });
      return;
    }
    root.current?.querySelector(`[id="${target.id}"]`)?.scrollIntoView({ block: "start" });
  }, [target]);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const figures = await fetchFigures(manual);
      const bytes = renderManualDocx({
        manual,
        figures,
        labels: { title: t("title"), contents: t("contents"), figure: t("figure"), missingFigure: t("missingFigure") },
      });
      const blob = new Blob([bytes as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${t("fileName")}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const prev = manual.chapters[chapterIndex - 1];
  const next = manual.chapters[chapterIndex + 1];

  return (
    <div ref={root} className="flex scroll-mt-4 flex-col gap-4" data-manual-screen>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-ink dark:text-zinc-100">{t("title")}</h1>
        <IconButton
          icon={Download}
          label={t("download")}
          busy={busy}
          busyLabel={t("downloading")}
          showLabel
          variant="secondary"
          size="sm"
          onClick={download}
        />
      </div>
      {failed && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t("downloadFailed")}
        </p>
      )}
      {asked && !target && (
        <p role="status" className="text-sm text-fade">
          {t("notFound", { id: asked })}
        </p>
      )}
      <div className="flex items-start gap-8">
        <nav aria-label={t("chapterNav")} style={CONTENTS_STYLE} className="sticky top-4 shrink-0 text-sm">
          <h2 className="mb-2 font-semibold text-ink dark:text-zinc-100">{t("contents")}</h2>
          <ol className="flex flex-col gap-1">
            {manual.chapters.map((c) => {
              const open = c.id === chapter.id;
              return (
                <li key={c.id}>
                  <Link
                    href={manualHref(c.id)}
                    aria-current={open ? "page" : undefined}
                    className={open ? "font-semibold text-ink dark:text-zinc-100" : "text-cta hover:underline"}
                  >
                    {`${c.number} ${c.title}`}
                  </Link>
                  {open && (
                    <ol className="mt-1 flex flex-col gap-0.5 pl-4">
                      {c.blocks
                        .filter((b) => b.kind === "heading" && b.level === 2)
                        .map((b) =>
                          b.kind === "heading" ? (
                            <li key={b.id}>
                              <Link
                                href={manualHref(b.id)}
                                aria-current={target?.id === b.id ? "location" : undefined}
                                className="text-cta hover:underline"
                              >
                                {`${b.number} ${b.title}`}
                              </Link>
                            </li>
                          ) : null,
                        )}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <article
          className="flex flex-col gap-3 text-sm leading-relaxed text-ink dark:text-zinc-200"
          style={PROSE_STYLE}
          data-manual-chapter={chapter.id}
          lang={locale === "ro-RO" ? "ro" : "en"}
        >
          <ChapterBody chapter={chapter} manual={manual} figureLabel={t("figure")} />
          <div className="mt-6 flex flex-wrap justify-between gap-4 border-t border-wire pt-4">
            {prev ? (
              <Link href={manualHref(prev.id)} className="inline-flex items-center gap-1 text-cta hover:underline">
                <ChevronLeft size={16} aria-hidden="true" />
                {`${t("previous")}: ${prev.number} ${prev.title}`}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={manualHref(next.id)} className="inline-flex items-center gap-1 text-cta hover:underline">
                {`${t("next")}: ${next.number} ${next.title}`}
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
