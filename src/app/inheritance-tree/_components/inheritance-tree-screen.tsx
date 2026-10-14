"use client";

/**
 * „Arbori de moștenire" — the whole inheritance tree (A), the whole page.             (Slices #39.11, #39.12)
 *
 * In the app's maximised frame („Hartă extinsă", „Pagini extinse": a panel over the page, inset 1 rem, a header and
 * „Restrânge"). Every natural person with a family tie is a node, every tie a line, generations top to bottom
 * (`layoutTree`); the drawing, its three levels, the hover card and the side card are `TreeCanvas`
 * (src/components/inheritance/tree-canvas.tsx), shared with a person's tile (#39.12). VIEW ONLY: nothing here writes.
 *
 * „Caută o persoană…" centres the tree on a person at the near level and opens their card; `?focus=<id>` does the
 * same on arrival — the person tile's „Deschide arborele întreg" (#39.12). A name opens the person's screen with the
 * tree's action panel expanded (`personTreeHref`).
 *
 * #39.13, time and documents: „Anul" — a slider from the earliest birth year to today — fades whoever was born after
 * the chosen year; each person carries a badge with how many documents they are on (`TreeCanvas`); „Acte comune", OFF
 * by default and never remembered, puts on each line how many documents the two are both on.
 *
 * What the genealogy tools gave this screen (the handover says it at length): the descendancy chart's „generations
 * in rows, couples side by side, children under the couple" (FamilySearch, Gramps); the far view as dots with first
 * names only (MyHeritage's „family view" zoomed out); the hover card and the side card rather than a dialog
 * (Ancestry's tree); a search that centres the tree on a person (all four).
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Minimize, Search } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { layoutTree, type TreeLevel } from "@/lib/inheritance/layout";
import { indexDocuments, yearSpan } from "@/lib/inheritance/documents";
import { foldForSearch } from "@/lib/inheritance/search";
import { TreeCanvas, type TreeData, type TreeFocus } from "@/components/inheritance/tree-canvas";

export async function fetchTree(): Promise<TreeData> {
  const res = await fetch("/api/inheritance-tree");
  if (!res.ok) throw new Error(`GET /api/inheritance-tree ${res.status}`);
  return (await res.json()) as TreeData;
}

export function InheritanceTreeScreen() {
  const t = useTranslations("inheritance");
  const router = useRouter();
  const params = useSearchParams();
  const q = useQuery({ queryKey: ["inheritance-tree"], queryFn: fetchTree });
  const layout = useMemo(() => (q.data ? layoutTree(q.data.persons, q.data.ties) : null), [q.data]);
  const [level, setLevel] = useState<TreeLevel>(1);
  // #39.13: the documents, the year (null is today: nobody faded) and „Acte comune" (off).
  const docs = useMemo(() => (q.data ? indexDocuments(q.data.documents ?? [], q.data.appearances ?? []) : null), [q.data]);
  const span = useMemo(() => (q.data ? yearSpan(q.data.persons) : null), [q.data]);
  const [year, setYear] = useState<number | null>(null);
  const [shared, setShared] = useState(false);
  const [search, setSearch] = useState("");
  const [notFound, setNotFound] = useState(false);
  // `?focus=<id>` (#39.12) is the first focus; a search is each one after.
  const [focus, setFocus] = useState<TreeFocus>(() => {
    const id = params?.get("focus");
    return id ? { id, n: 1 } : null;
  });

  // #39.34, fixed in passing: a search pressed before the tree has arrived was dropped without a word — measured,
  // a search typed the moment the screen opened from a person's screen. It waits for the tree now, and runs then.
  const [pending, setPending] = useState<string | null>(null);
  const runSearch = (needle: string) => {
    if (!q.data || !layout) return;
    const drawn = new Set(layout.nodes.map((n) => n.id));
    const hit = q.data.persons
      .filter((p) => drawn.has(p.id))
      .find((p) => foldForSearch([p.displayName, p.nickname ?? ""].join(" ")).includes(needle));
    setNotFound(!hit);
    if (hit) setFocus((f) => ({ id: hit.id, n: (f?.n ?? 0) + 1 }));
  };
  if (pending !== null && q.data && layout) {
    setPending(null);
    runSearch(pending);
  }
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const needle = foldForSearch(search);
    if (!needle) return;
    if (!q.data || !layout) setPending(needle);
    else runSearch(needle);
  };

  const close = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="inheritance-tree-title" data-inheritance-tree="">
      <div className="fixed inset-0 z-50 bg-black/50" aria-hidden="true" onClick={close} />
      <div
        className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-xl border border-card-rim bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        style={{ animation: "ga-theater-in 180ms ease" }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-crease bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          <h1 id="inheritance-tree-title" className="text-sm font-semibold text-ink dark:text-zinc-200">
            {t("title")}
          </h1>
          {layout && (
            <span className="text-xs text-fade dark:text-zinc-400" data-tree-count="">
              {t("count", { persons: layout.nodes.length, families: layout.clusters.length })}
            </span>
          )}
          <form onSubmit={onSearch} className="flex items-center gap-2" role="search">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setNotFound(false);
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="w-56 rounded-md border border-wire bg-white px-3 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            />
            <IconButton type="submit" icon={Search} label={t("searchButton")} variant="secondary" size="sm" />
          </form>
          {notFound && (
            <span role="status" className="text-xs text-amber-700 dark:text-amber-300">
              {t("notFound")}
            </span>
          )}
          {span && (
            <label className="flex items-center gap-2 text-xs text-ink dark:text-zinc-200" data-tree-time="">
              <span>{t("time.label")}</span>
              <input
                type="range"
                min={span.min}
                max={span.max}
                step={1}
                value={year ?? span.max}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setYear(y >= span.max ? null : y);
                }}
                aria-label={t("time.label")}
                aria-valuetext={year === null ? t("time.today") : String(year)}
                title={t("time.hint")}
                className="w-40 accent-teal-700"
              />
              <span className="w-10 tabular-nums" data-tree-year="">
                {year === null ? t("time.today") : year}
              </span>
            </label>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink dark:text-zinc-200" title={t("sharedHint")}>
            <input
              type="checkbox"
              role="switch"
              aria-checked={shared}
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="peer sr-only"
              data-tree-shared-switch=""
            />
            <span
              aria-hidden="true"
              className="relative inline-block h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-teal-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4 dark:bg-zinc-600 dark:peer-checked:bg-teal-500"
            />
            {t("shared")}
          </label>
          <span className="ml-auto text-xs text-fade dark:text-zinc-400" data-tree-level-note="">
            {t("level", { level })}
          </span>
          <IconButton icon={Minimize} label={t("close")} variant="secondary" size="sm" onClick={close} />
        </div>

        <div className="relative min-h-0 flex-1 bg-sky-50/40 dark:bg-zinc-950">
          {q.isLoading && <p className="p-6 text-sm text-fade">{t("loading")}</p>}
          {q.isError && <p role="alert" className="p-6 text-sm text-red-600">{t("error")}</p>}
          {layout && layout.nodes.length === 0 && <p className="p-6 text-sm text-fade">{t("empty")}</p>}
          {q.data && layout && layout.nodes.length > 0 && (
            <TreeCanvas
              data={q.data}
              layout={layout}
              focus={focus}
              withCard
              onLevel={setLevel}
              docs={docs}
              year={year}
              shared={shared}
              className="absolute inset-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
