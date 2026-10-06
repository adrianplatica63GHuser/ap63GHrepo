"use client";

/**
 * Administrare → Etichete: the tag cloud alone.                (Slice #38.14)
 *
 * Adrian: the page shows only „Nor de etichete". A DOUBLE CLICK selects or
 * deselects a tag (a press from the keyboard — Enter or Space on the chip —
 * does the same, since a keyboard has no double click); a selected chip is
 * drawn pressed (`aria-pressed`, a ring). At the cloud's top right:
 *   - „Redenumește etichetă" (the pencil before its words) — active with ONE
 *     tag selected: that chip becomes a text box holding its name, renamed ON
 *     THE SPOT — Enter, or leaving the box with a changed name, saves through
 *     `doRename`; Escape cancels; a refusal shows under the cloud;
 *   - „Fuzionează etichete" — active with TWO OR MORE: the merge dialog of
 *     #37.46, opened with the selected tags ticked (`initialSources`).
 * None selected, both are inactive. After a rename or a merge the selection
 * clears. The table „Toate etichetele", its scroll-to and the rename dialog
 * went with it (#38.14's salvage: the merge and `doRename`/`doMerge` stay).
 */
import { useState, useRef, useCallback } from "react";
import { Merge, PencilLine, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { screenBox, screenPanel } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";
import { useFitToWindow } from "@/lib/ui/use-fit-to-window";

/** Slice #37.35: the cloud is 6 units (#37.22's two panels). */
const CLOUD_UNITS = 6;

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
          <IconButton
            icon={X}
            label={t("merge.cancel")}
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={saving}
          />
          {/* #37.46 (A076): Merge + „Fuzionează"; working, „Se fuzionează…"
              with the spinner in the icon's place. */}
          <IconButton
            icon={Merge}
            label={saving ? t("merge.saving") : t("merge.save")}
            busy={saving}
            showLabel
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={saving || sources.size < 2 || !target}
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/** What the cloud's two buttons may do with `n` tags selected (#38.14). */
export function cloudActions(n: number): { rename: boolean; merge: boolean } {
  return { rename: n === 1, merge: n >= 2 };
}

export function TagManager() {
  const t           = useTranslations("adminTags");
  const queryClient = useQueryClient();

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

  // ── Selection and the rename on the spot (#38.14) ─────────────────────────
  const [selected,    setSelected]    = useState<ReadonlySet<string>>(() => new Set());
  const [editing,     setEditing]     = useState<string | null>(null);
  const [draft,       setDraft]       = useState("");
  const [renaming,    setRenaming]    = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [showMerge,   setShowMerge]   = useState(false);
  // Escape unmounts the box: the blur that may follow is not „leaving it".
  const cancelled = useRef(false);

  // Slice #38.19: only the chips scroll. Their box takes the height the window leaves under the
  // header and the explanation and over the refusal line, so the page itself never scrolls and
  // „Redenumește etichetă" and „Fuzionează etichete" stay in sight however many tags there are.
  const cloudRef = useRef<HTMLDivElement>(null);
  const cloudHeight = useFitToWindow(cloudRef, [renameError !== null, tags.length > 0]);

  // Only tags still in the cloud count (a refetch may have taken one away).
  const chosen  = tags.filter((r) => selected.has(r.tag)).map((r) => r.tag);
  const actions = cloudActions(chosen.length);

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

  function toggle(tag: string) {
    if (editing !== null) return;
    setRenameError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function startRename() {
    if (!actions.rename) return;
    cancelled.current = false;
    setRenameError(null);
    setDraft(chosen[0]);
    setEditing(chosen[0]);
  }

  function cancelRename() {
    cancelled.current = true;
    setEditing(null);
    setRenameError(null);
  }

  async function saveRename(from: string) {
    if (renaming) return;
    const to = draft.trim().toLowerCase();
    if (!to || to === from) {
      setRenameError(t("rename.errorSame"));
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      await doRename(from, to);
      setEditing(null);
      setSelected(new Set());
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : t("rename.errorGeneric"));
    } finally {
      setRenaming(false);
    }
  }

  /** Leaving the box saves a changed name; an unchanged one is left as it was. */
  function leaveRename(from: string) {
    if (cancelled.current) return;
    if (draft.trim().toLowerCase() === from) {
      setEditing(null);
      setRenameError(null);
      return;
    }
    void saveRename(from);
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
      <UnitRow units={[CLOUD_UNITS]}>
      {/* ── Tag Cloud ──────────────────────────────────────────────────────── */}
      {/* Slice #37.22: the cloud is two panels wide and wraps downward. Slice
          #38.14: it is the page; its two buttons stand at its top right. Slice
          #38.19: the header and the explanation stay put; only the chips' box
          under them scrolls (`data-tag-cloud-scroll`). */}
      <section {...screenPanel("tag-cloud", CLOUD_UNITS)} className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold text-ink dark:text-zinc-100">
              {t("cloud.title")}
            </h2>
            <span className="text-xs text-fade dark:text-zinc-500">
              {t("cloud.count", { count: tags.length })}
            </span>
          </div>
          <div className="flex items-center gap-2" data-tag-actions>
            {/* #38.14: PencilLine + „Redenumește etichetă" — one tag selected. */}
            <IconButton
              icon={PencilLine}
              label={t("cloud.rename")}
              showLabel
              variant="secondary"
              size="md"
              onClick={startRename}
              disabled={!actions.rename || editing !== null}
            />
            {/* #37.46 (A076): Merge + „Fuzionează etichete" — #38.14: two or more selected. */}
            <IconButton
              icon={Merge}
              label={t("merge.open")}
              showLabel
              variant="secondary"
              size="md"
              onClick={() => setShowMerge(true)}
              disabled={!actions.merge || editing !== null}
            />
          </div>
        </div>
        <p className="mb-4 text-sm text-fade dark:text-zinc-400">{t("cloud.note")}</p>

        {/* #38.19: the chips' own box, the cloud's only scroller — the chips stay in tab order,
            and a chip focused from the keyboard is scrolled into view by the browser. */}
        <div
          ref={cloudRef}
          data-tag-cloud-scroll
          className="-m-1 flex flex-wrap content-start gap-2 overflow-y-auto p-1"
          style={cloudHeight !== null ? { maxHeight: `${cloudHeight}px` } : undefined}
        >
          {tags.map((row) =>
            editing === row.tag ? (
              <input
                key={row.tag}
                type="text"
                data-tag-chip={row.tag}
                aria-label={t("cloud.renameBox", { tag: row.tag })}
                title={t("rename.hint")}
                value={draft}
                autoFocus
                // #38.19: the chip being renamed is brought into the box's view.
                ref={(el) => el?.scrollIntoView({ block: "nearest" })}
                disabled={renaming}
                onChange={(e) => setDraft(e.target.value.toLowerCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); void saveRename(row.tag); }
                  if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                }}
                onBlur={() => leaveRename(row.tag)}
                {...screenBox("metaTag")}
                className={[
                  "rounded-full border px-3 py-1 ring-2 ring-cta focus:outline-none",
                  cloudFontClass(row.count),
                  "border-slate-400 bg-white text-ink dark:bg-zinc-950 dark:text-zinc-100",
                ].join(" ")}
              />
            ) : (
              <button
                key={row.tag}
                type="button"
                data-tag-chip={row.tag}
                aria-pressed={selected.has(row.tag)}
                // A mouse selects with a double click; Enter or Space (a click
                // with no pointer, `detail` 0) selects from the keyboard.
                onClick={(e) => { if (e.detail === 0) toggle(row.tag); }}
                onDoubleClick={() => toggle(row.tag)}
                title={t("cloud.usageHint", { count: row.count })}
                className={[
                  "select-none rounded-full border px-3 py-1 transition-colors hover:opacity-80",
                  cloudFontClass(row.count),
                  cloudColorClass(row.count),
                  selected.has(row.tag) ? "ring-2 ring-cta ring-offset-1 dark:ring-offset-zinc-900" : "",
                ].join(" ")}
              >
                {row.tag}
                <span className="ml-1.5 text-xs opacity-60">×{row.count}</span>
              </button>
            ),
          )}
        </div>
        {renameError && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400" data-tag-rename-error>
            {renameError}
          </p>
        )}
      </section>
      </UnitRow>

      {/* ── Merge ──────────────────────────────────────────────────────────── */}
      {showMerge && (
        <MergeModal
          tags={tags}
          initialSources={chosen}
          onClose={() => setShowMerge(false)}
          onSave={async (sources, target) => {
            await doMerge(sources, target);
            setSelected(new Set());
          }}
        />
      )}
    </>
  );
}
