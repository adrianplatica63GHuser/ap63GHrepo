"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TagRow = { tag: string; count: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps a usage count to a font-size class for the tag cloud.
 * Scale: 1 use → text-sm; 2–4 → text-base; 5–9 → text-lg; 10+ → text-xl
 */
function cloudFontClass(count: number): string {
  if (count >= 10) return "text-xl font-semibold";
  if (count >= 5)  return "text-lg font-medium";
  if (count >= 2)  return "text-base";
  return "text-sm";
}

/**
 * Maps a usage count to a colour intensity for the cloud chip.
 * Low usage → lighter; high usage → more vivid slate.
 */
function cloudColorClass(count: number): string {
  if (count >= 10) return "border-slate-500 bg-slate-100 dark:border-slate-400 dark:bg-zinc-700 text-ink dark:text-zinc-100";
  if (count >= 5)  return "border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-zinc-800 text-ink dark:text-zinc-200";
  if (count >= 2)  return "border-slate-300 bg-white dark:border-zinc-600 dark:bg-zinc-800 text-ink dark:text-zinc-300";
  return "border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 text-fade dark:text-zinc-400";
}

// ---------------------------------------------------------------------------
// Rename / Merge modal
// ---------------------------------------------------------------------------

function RenameModal({
  initialFrom,
  onClose,
  onSave,
}: {
  initialFrom: string;
  onClose:     () => void;
  onSave:      (from: string, to: string) => Promise<void>;
}) {
  const t       = useTranslations("adminTags");
  const [from]  = useState(initialFrom);
  const [to,    setTo]    = useState(initialFrom);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    const toNorm = to.trim().toLowerCase();
    if (!toNorm || toNorm === from) {
      setError(t("rename.errorSame"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(from, toNorm);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("rename.errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-modal-title"
        className="fixed inset-x-4 top-1/3 z-50 mx-auto max-w-sm rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2
          id="rename-modal-title"
          className="mb-4 text-lg font-semibold text-ink dark:text-zinc-100"
        >
          {t("rename.title")}
        </h2>

        <div className="mb-4 flex flex-col gap-3">
          {/* From (read-only) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-fade dark:text-zinc-400">
              {t("rename.labelFrom")}
            </label>
            <div className="rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-2 py-1.5 text-sm font-mono text-ink dark:text-zinc-100">
              {from}
            </div>
          </div>

          {/* To (editable) */}
          <div>
            <label
              htmlFor="rename-to"
              className="mb-1 block text-xs font-medium text-fade dark:text-zinc-400"
            >
              {t("rename.labelTo")}
            </label>
            <input
              id="rename-to"
              ref={inputRef}
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value.toLowerCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSave(); } }}
              disabled={saving}
              autoFocus
              className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <p className="mt-1 text-xs text-fade dark:text-zinc-500">
              {t("rename.hint")}
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 text-ink dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-60"
          >
            {t("rename.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !to.trim() || to.trim().toLowerCase() === from}
            className="rounded px-3 py-1.5 text-sm font-medium bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white disabled:opacity-60 transition-colors"
          >
            {saving ? t("rename.saving") : t("rename.save")}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Merge modal
// ---------------------------------------------------------------------------

function MergeModal({
  tags,
  initialSources,
  onClose,
  onSave,
}: {
  tags:           TagRow[];
  initialSources: string[];
  onClose:        () => void;
  onSave:         (sources: string[], target: string) => Promise<void>;
}) {
  const t = useTranslations("adminTags");

  const [sources, setSources] = useState<Set<string>>(new Set(initialSources));
  const [target,  setTarget]  = useState<string>("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function toggleSource(tag: string) {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
    // If the deselected tag was also the target, clear target.
    if (tag === target && sources.has(tag)) setTarget("");
  }

  async function handleSave() {
    if (sources.size < 1 || !target) {
      setError(t("merge.errorRequirements"));
      return;
    }
    const sourcesWithoutTarget = [...sources].filter((s) => s !== target);
    if (sourcesWithoutTarget.length === 0) {
      setError(t("merge.errorNothingToMerge"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(sourcesWithoutTarget, target);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("merge.errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-modal-title"
        className="fixed inset-x-4 top-1/4 z-50 mx-auto max-w-lg rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[70vh] flex flex-col"
      >
        <h2
          id="merge-modal-title"
          className="mb-1 text-lg font-semibold text-ink dark:text-zinc-100"
        >
          {t("merge.title")}
        </h2>
        <p className="mb-4 text-sm text-fade dark:text-zinc-400">
          {t("merge.note")}
        </p>

        {/* Scrollable tag picker */}
        <div className="flex-1 overflow-y-auto mb-4 flex flex-col gap-2 min-h-0">
          {tags.map((row) => {
            const isSource   = sources.has(row.tag);
            const isTarget   = target === row.tag;
            return (
              <label
                key={row.tag}
                className={[
                  "flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer border text-sm transition-colors",
                  isTarget
                    ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30"
                    : isSource
                    ? "border-slate-400 bg-slate-50 dark:border-zinc-500 dark:bg-zinc-800"
                    : "border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 text-fade dark:text-zinc-400",
                ].join(" ")}
              >
                {/* Source checkbox */}
                <input
                  type="checkbox"
                  checked={isSource}
                  onChange={() => toggleSource(row.tag)}
                  disabled={saving}
                  className="accent-slate-600"
                />
                <span className="flex-1 font-mono text-ink dark:text-zinc-100">{row.tag}</span>
                <span className="text-xs text-fade dark:text-zinc-500">×{row.count}</span>

                {/* Target radio — only visible when this tag is selected as a source */}
                {isSource && (
                  <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400 ml-auto cursor-pointer">
                    <input
                      type="radio"
                      name="merge-target"
                      value={row.tag}
                      checked={isTarget}
                      onChange={() => setTarget(row.tag)}
                      disabled={saving}
                      className="accent-blue-600"
                    />
                    {t("merge.keepThis")}
                  </label>
                )}
              </label>
            );
          })}
        </div>

        {error && (
          <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {target && (
          <p className="mb-3 text-xs text-blue-600 dark:text-blue-400">
            {t("merge.preview", {
              sources: [...sources].filter((s) => s !== target).join(", "),
              target,
            })}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 text-ink dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-60"
          >
            {t("merge.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || sources.size < 2 || !target}
            className="rounded px-3 py-1.5 text-sm font-medium bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-60 transition-colors"
          >
            {saving ? t("merge.saving") : t("merge.save")}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TagManager() {
  const t           = useTranslations("adminTags");
  const queryClient = useQueryClient();
  const listRef     = useRef<HTMLTableSectionElement>(null);

  const { data, isLoading, isError } = useQuery<{ tags: TagRow[] }>({
    queryKey:             ["admin-tags"],
    queryFn:              async () => {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime:            0,
    refetchOnWindowFocus: false,
  });

  const tags = data?.tags ?? [];

  const [renameTarget,  setRenameTarget]  = useState<string | null>(null);
  const [showMerge,     setShowMerge]     = useState(false);
  const [mergeInit,     setMergeInit]     = useState<string[]>([]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const doRename = useCallback(async (from: string, to: string) => {
    const res = await fetch("/api/tags", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ from, to }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
    await queryClient.invalidateQueries({ queryKey: ["all-tags-autocomplete"] });
  }, [queryClient]);

  const doMerge = useCallback(async (sources: string[], target: string) => {
    // Rename each source into the target sequentially.
    for (const src of sources) {
      const res = await fetch("/api/tags", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ from: src, to: target }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }
    await queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
    await queryClient.invalidateQueries({ queryKey: ["all-tags-autocomplete"] });
  }, [queryClient]);

  // ── Scroll tag row into view from cloud click ─────────────────────────────

  function scrollToTag(tag: string) {
    if (!listRef.current) return;
    const row = listRef.current.querySelector(`[data-tag="${CSS.escape(tag)}"]`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      (row as HTMLElement).classList.add("bg-yellow-50", "dark:bg-yellow-900/20");
      setTimeout(() => {
        (row as HTMLElement).classList.remove("bg-yellow-50", "dark:bg-yellow-900/20");
      }, 1500);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <p className="text-sm text-fade dark:text-zinc-400">{t("loading")}</p>;
  }
  if (isError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{t("error")}</p>;
  }
  if (tags.length === 0) {
    return <p className="text-sm text-fade dark:text-zinc-400">{t("empty")}</p>;
  }

  return (
    <>
      {/* ── Tag Cloud ──────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-ink dark:text-zinc-100">
            {t("cloud.title")}
          </h2>
          <span className="text-xs text-fade dark:text-zinc-500">
            {t("cloud.count", { count: tags.length })}
          </span>
        </div>
        <p className="mb-4 text-sm text-fade dark:text-zinc-400">{t("cloud.note")}</p>

        <div className="flex flex-wrap gap-2 p-4 rounded-lg border border-card-rim bg-card dark:border-zinc-800 dark:bg-zinc-900">
          {tags.map((row) => (
            <button
              key={row.tag}
              type="button"
              onClick={() => scrollToTag(row.tag)}
              title={t("cloud.usageHint", { count: row.count })}
              className={[
                "rounded-full border px-3 py-1 transition-colors hover:opacity-80 active:scale-95",
                cloudFontClass(row.count),
                cloudColorClass(row.count),
              ].join(" ")}
            >
              {row.tag}
              <span className="ml-1.5 text-xs opacity-60">×{row.count}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Management table ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-ink dark:text-zinc-100">
            {t("list.title")}
          </h2>
          <button
            type="button"
            onClick={() => { setMergeInit([]); setShowMerge(true); }}
            className="rounded px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 text-ink dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {t("merge.open")}
          </button>
        </div>

        <div className="rounded-lg border border-card-rim overflow-hidden dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-800 text-xs uppercase tracking-wide text-fade dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">{t("list.colTag")}</th>
                <th className="px-4 py-2 text-right font-semibold w-24">{t("list.colUsage")}</th>
                <th className="px-4 py-2 text-right font-semibold w-32">{t("list.colActions")}</th>
              </tr>
            </thead>
            <tbody
              ref={listRef}
              className="divide-y divide-card-rim dark:divide-zinc-800"
            >
              {tags.map((row) => (
                <tr
                  key={row.tag}
                  data-tag={row.tag}
                  className="transition-colors"
                >
                  <td className="px-4 py-2 font-mono text-ink dark:text-zinc-100">
                    {row.tag}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-fade dark:text-zinc-400">
                    {row.count}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setRenameTarget(row.tag)}
                      className="text-xs text-slate-500 dark:text-zinc-400 hover:text-ink dark:hover:text-zinc-100 transition-colors px-1"
                    >
                      {t("list.rename")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {renameTarget !== null && (
        <RenameModal
          initialFrom={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSave={doRename}
        />
      )}

      {showMerge && (
        <MergeModal
          tags={tags}
          initialSources={mergeInit}
          onClose={() => setShowMerge(false)}
          onSave={doMerge}
        />
      )}
    </>
  );
}
