"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { unnamedKindOf } from "@/lib/ui/unnamed";
import { Fragment, useId, useState, useRef } from "react";
import { Calculator, Check, Link as LinkIcon, Plus, Save, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { AddToggleButton, MarkReviewedButton } from "@/components/metadata-buttons";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTimeFrames, tfDays } from "@/hooks/use-time-frames";
import { VersionNavControls } from "@/components/version-nav-controls";
import type { VersionNavView, VersionNavLabels } from "@/components/version-nav-controls";
import { highlightRingClass } from "@/lib/versioning/highlight-ring";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import type { MetadataSnapshot, MetadataVersionItem } from "@/lib/metadata/queries";
import { PROVENANCE_VALUES, provenanceI18nKey } from "@/lib/metadata/provenance";
import { buttonClass } from "@/lib/ui/button-styles";
import { screenBox } from "@/lib/ui/field-widths";
import { HintBubble } from "@/lib/ui/hint-bubble";
import { Divider } from "@/lib/ui/divider";
import { MAX_GROUPS_PER_ITEM, MAX_GROUPS_PER_PROPERTY } from "@/lib/groups/validation";
import { SHARED_LEFT_INSET, SHIFTED_SELECT_ROW, useSharedLeftLine } from "@/lib/ui/classification-left-line";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPORTANCE_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
const RELEVANCE_VALUES  = ["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"] as const;
// PROVENANCE_VALUES is imported from @/lib/metadata/provenance - the single
// source of truth shared with the API routes, the import wizard and the DB
// CHECK constraint (Slice #21.07.Import).

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GroupTag     = { id: string; code: string; position: number; description: string };
type StampTag     = { id: string; code: string; shortDescription: string };
type HistoryEntry = { method: string; date: string };
type AvailableGroup = { id: string; code: string; description: string };
type AvailableStamp = { id: string; code: string; shortDescription: string };

type MetaData = {
  principalObjectId:    string | null;
  groups:               GroupTag[];
  stamps:               StampTag[];
  importance:           string | null;
  relevance:            string | null;
  provenance:           string | null;
  provenanceHistory:    HistoryEntry[];
  importanceUpdatedAt:  string | null;
  relevanceUpdatedAt:   string | null;
  provenanceUpdatedAt:  string | null;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  apiPath:        string;
  queryKey:       string;
  backHref:       string;
  backEntityName: string;
  /**
   * Slice #20.09 — optional API path to fetch provenance source details when
   * provenance = 'ALGORITHM'. For properties, pass
   * `/api/properties/{id}/calculation-source`. When provided and provenance
   * is ALGORITHM, the tab fetches this path and displays a link to the run.
   */
  calculationSourcePath?: string;
  /**
   * Slice #37.63 — which of the two tiles this is. META INFO became two tiles:
   * „Clasificări" (Importanță, Relevanță, Proveniență — with their
   * versions and the Save button) and „Conexiuni" (Etichete, Grupuri, Ștampile,
   * Vezi și). Both read the record's metadata through the same query key, so it
   * is fetched once. Omitted, both parts are drawn, one under the other.
   */
  part?: "classification" | "connections";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Days since an ISO timestamp, or null if no timestamp. */
function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Compute green/red highlight for one metadata field (prev vs curr). */
function fieldHighlight(
  prev: string | null,
  curr: string | null,
): HighlightColor | undefined {
  if (prev === curr) return undefined;
  if (prev === null) return "green";
  return "red";
}

/** Compute all field highlights by diffing two snapshots. */
function computeHighlights(
  prev: MetadataSnapshot,
  curr: MetadataSnapshot,
): Record<"importance" | "relevance" | "provenance", HighlightColor | undefined> {
  return {
    importance: fieldHighlight(prev.importance, curr.importance),
    relevance:  fieldHighlight(prev.relevance,  curr.relevance),
    provenance: fieldHighlight(prev.provenance, curr.provenance),
  };
}

/** Label colour: green for v0 or additions-only; red if any field modified/deleted. */
function versionLabelColor(
  prev: MetadataSnapshot,
  curr: MetadataSnapshot,
): HighlightColor {
  const h = computeHighlights(prev, curr);
  const hasRed = Object.values(h).some((c) => c === "red");
  return hasRed ? "red" : "green";
}

// ---------------------------------------------------------------------------
// MetaSelect — thin styled select
// ---------------------------------------------------------------------------

function MetaSelect({
  value,
  onChange,
  disabled,
  placeholder,
  options,
  highlight,
  describedBy,
}: {
  value:       string;
  onChange:    (v: string) => void;
  disabled?:   boolean;
  placeholder: string;
  options:     { value: string; label: string }[];
  highlight?:  HighlightColor | undefined;
  /** The ids of what explains it — the item's note and the chosen value's statement (#37.63). */
  describedBy?: string;
}) {
  return (
    <select
      value={value}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={[
        "rounded border border-slate-300 dark:border-slate-600",
        "bg-white dark:bg-slate-800 text-ink dark:text-zinc-100",
        "text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500",
        "disabled:opacity-50",
        highlightRingClass(highlight, false),
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <option value="" data-blank="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// ItemTitle — an item's title, its explanation in a bubble      (Slice #37.63)
// ---------------------------------------------------------------------------

/**
 * Adrian: the explanation „should show up only as a hint, a bubble on hover;
 * it should not take up space" — and the same for every item in both tiles.
 * So the paragraph that sat under each title is a HintBubble on the title: the
 * mouse resting on it opens it, and the ⓘ beside it opens it for a finger or a
 * keyboard (#37.50). The text stays in the document (`sr-only` while closed),
 * so the control it explains can point `aria-describedby` at it.
 */
const ITEM_TITLE = "text-sm font-semibold text-ink dark:text-zinc-100";

/** Slice #37.81: Importanță | the vertical divider | Relevanță — two equal cells. */
const CLASSIFICATION_PAIR_GRID: React.CSSProperties = { gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)" };

function ItemTitle({ id, title, note, about }: { id: string; title: string; note?: string; about: string }) {
  if (!note) return <h3 className={ITEM_TITLE}>{title}</h3>;
  return (
    <HintBubble id={id} text={note} triggerLabel={about}>
      <h3 className={`${ITEM_TITLE} mt-0.5`}>{title}</h3>
    </HintBubble>
  );
}

// ---------------------------------------------------------------------------
// The remove „×" shows only under the pointer, or with focus   (Slice #37.69)
// ---------------------------------------------------------------------------

/**
 * Every remove „×" in „Conexiuni" — a tag's, a group's, a stamp's, a „Vezi și"
 * link's — is drawn only while the pointer is over its chip or row, or the chip
 * or row has keyboard focus (`focus-within`), so a tag can still be removed
 * without a mouse. It is transparent the rest of the time, never removed: it
 * keeps its place, its accessible name and its tab stop, so nothing moves when
 * it appears. Where there is no hover at all (a touch screen) it is always
 * drawn. The chip or row carries `group`.
 */
const REMOVE_REVEAL =
  "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";

/**
 * A tag's „×" overlays the chip's top-right corner, on its own small backing,
 * rather than widening the chip — so hovering a chip never shifts a line of
 * chips (Slice #37.69).
 */
const CHIP_REMOVE_PLACE =
  "absolute -right-2.5 -top-2.5 z-10 rounded-md bg-white shadow-sm ring-1 ring-card-rim dark:bg-zinc-900 dark:ring-zinc-600";

/** A tag chip: it only wraps its text — 4 px above and below, 8 px a side (Slice #37.69). */
const TAG_CHIP =
  "group relative inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-sm leading-tight text-ink dark:border-slate-600 dark:bg-zinc-800 dark:text-zinc-100";

// ---------------------------------------------------------------------------
// MetadataSection — one editable section (controlled select + review button)
// ---------------------------------------------------------------------------

function MetadataSection({
  title,
  note,
  value,
  onChange,
  options,
  statementMap,
  placeholder,
  labelMarkReviewed,
  labelMarkingReviewed,
  labelMarkedReviewed,
  daysText,
  reviewWarning,
  onMarkReviewed,
  readOnly,
  highlight,
  about,
  centred = false,
  alignedLeft = false,
  children,
}: {
  title:                 string;
  note:                  string;
  /** Controlled value — empty string means "no selection". */
  value:                 string;
  onChange:              (v: string) => void;
  options:               { value: string; label: string }[];
  statementMap:          Record<string, string>;
  placeholder:           string;
  labelMarkReviewed:     string;
  labelMarkingReviewed:  string;
  labelMarkedReviewed:   string;
  /** Pre-formatted "Updated X days ago" text, or null if never saved. */
  daysText:              string | null;
  /** Non-null when >90 days — shown in red. */
  reviewWarning:         string | null;
  onMarkReviewed:        () => Promise<void>;
  /** When true: dropdown is disabled. */
  readOnly?:             boolean;
  /** Version-diff highlight colour for this field. */
  highlight?:            HighlightColor | undefined;
  /** The ⓘ's name: „Despre „{title}"" (#37.63). */
  about:                 string;
  /** Slice #37.81: everything centred across, in its own cell — the select row shifted left (#38.01). */
  centred?:              boolean;
  /** Slice #38.01: inset to the shared left line — Importanță's select's left edge. */
  alignedLeft?:          boolean;
  children?:             React.ReactNode;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [reviewed,  setReviewed]  = useState(false);

  async function handleMarkReviewed() {
    setReviewing(true);
    try {
      await onMarkReviewed();
      setReviewed(true);
      setTimeout(() => setReviewed(false), 2000);
    } finally {
      setReviewing(false);
    }
  }

  const statement = value ? statementMap[value] : null;
  const uid = useId();
  const noteId = `${uid}-note`;
  const statementId = `${uid}-statement`;

  const select = (
    <MetaSelect
      value={value}
      onChange={onChange}
      disabled={readOnly}
      placeholder={placeholder}
      options={options}
      highlight={highlight}
      describedBy={statement ? `${noteId} ${statementId}` : noteId}
    />
  );

  return (
    <section
      className={centred ? "flex flex-col items-center gap-1 text-center" : "flex flex-col gap-1"}
      data-centred={centred ? "" : undefined}
      data-aligned-left={alignedLeft ? "" : undefined}
      style={alignedLeft ? SHARED_LEFT_INSET : undefined}
    >
      <ItemTitle id={noteId} title={title} note={note} about={about} />

      {/* Slice #38.01: centred, the row is the cell's width — an empty track, the
          SELECT, and the review button's track, the free width shared 0.75 : 1.25,
          so the select stands 0.75 × its centred gap from the cell's left edge
          (classification-left-line.ts). The title and the notes stay centred. */}
      <div
        className={centred ? "grid w-full items-center" : "flex flex-wrap items-center gap-2"}
        style={centred ? SHIFTED_SELECT_ROW : undefined}
        data-select-row={centred ? "shifted" : undefined}
      >
        {centred && <span aria-hidden="true" />}
        {/* Slice #37.63 — what the chosen value means is a bubble ON the value:
            the mouse resting on it, or the keyboard reaching it, opens it. It
            was a paragraph (and, for Proveniență, „Ce înseamnă asta?") under it. */}
        {statement ? (
          <HintBubble id={statementId} text={statement}>
            {select}
          </HintBubble>
        ) : (
          select
        )}
        {!readOnly && centred && (
          <span className="ml-1" style={{ justifySelf: "start" }}>
            <MarkReviewedButton
              reviewed={reviewed}
              reviewing={reviewing}
              labels={{ mark: labelMarkReviewed, marking: labelMarkingReviewed, marked: labelMarkedReviewed }}
              onClick={handleMarkReviewed}
            />
          </span>
        )}
        {!readOnly && !centred && (
          // #37.44 (A031): BadgeCheck, filled once reviewed.
          <MarkReviewedButton
            reviewed={reviewed}
            reviewing={reviewing}
            labels={{ mark: labelMarkReviewed, marking: labelMarkingReviewed, marked: labelMarkedReviewed }}
            onClick={handleMarkReviewed}
          />
        )}
      </div>

      {/* What says something about THIS record stays visible: when it last
          changed, and the review warning (hidden on historical read-only views). */}
      {!readOnly && (daysText || reviewWarning) && (
        <div className="flex flex-col gap-0.5">
          {daysText && (
            <p className="text-xs text-fade dark:text-zinc-500">{daysText}</p>
          )}
          {reviewWarning && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{reviewWarning}</p>
          )}
        </div>
      )}

      {children && <div className="mt-1">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// TagsSection — text input + chip display
// ---------------------------------------------------------------------------

function TagsSection({
  principalObjectId,
  queryKey,
  labelTitle,
  labelNote,
  labelAbout,
  labelPlaceholder,
  labelAdd,
  labelAdding,
  labelRemove,
  labelEmpty,
}: {
  principalObjectId: string;
  queryKey:          string;
  labelTitle:        string;
  labelNote:         string;
  labelAbout:        string;
  labelPlaceholder:  string;
  labelAdd:          string;
  labelAdding:       string;
  labelRemove:       string;
  labelEmpty:        string;
}) {
  const queryClient = useQueryClient();
  const tagsKey     = `${queryKey}-tags`;
  const apiBase     = `/api/metadata/${principalObjectId}/tags`;
  const datalistId  = `tag-suggestions-${principalObjectId}`;

  const { data } = useQuery<{ tags: string[] }>({
    queryKey:             [tagsKey],
    queryFn:              async () => {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime:            0,
    refetchOnWindowFocus: false,
  });

  // Fetch the global tag corpus for autocomplete suggestions.
  const { data: allTagsData } = useQuery<{ tags: { tag: string; count: number }[] }>({
    queryKey:             ["all-tags-autocomplete"],
    queryFn:              async () => {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime:            60_000,   // re-fetch at most once per minute
    refetchOnWindowFocus: false,
  });

  const tags    = data?.tags ?? [];
  const allTags = allTagsData?.tags ?? [];

  const [input,    setInput]    = useState("");
  const [adding,   setAdding]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleAdd() {
    // Normalise to lowercase before sending — mirrors server-side normalisation.
    const tag = input.trim().toLowerCase();
    if (!tag) return;
    setAdding(true);
    try {
      const res = await fetch(apiBase, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tag }),
      });
      if (res.ok) {
        setInput("");
        await queryClient.invalidateQueries({ queryKey: [tagsKey] });
        // Invalidate the global corpus so autocomplete stays fresh.
        await queryClient.invalidateQueries({ queryKey: ["all-tags-autocomplete"] });
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(tag: string) {
    setRemoving(tag);
    try {
      const res = await fetch(apiBase, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tag }),
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: [tagsKey] });
      }
    } finally {
      setRemoving(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); void handleAdd(); }
  }

  // Filter out tags already applied so autocomplete doesn't suggest duplicates.
  const tagSet = new Set(tags);
  const noteId = `${useId()}-note`;
  const suggestions = allTags.filter((t) => !tagSet.has(t.tag));

  return (
    <section className="flex flex-col gap-1">
      <ItemTitle id={noteId} title={labelTitle} note={labelNote} about={labelAbout} />

      {/* Autocomplete suggestions list — native HTML5, zero deps */}
      <datalist id={datalistId}>
        {suggestions.map((t) => (
          <option key={t.tag} value={t.tag} />
        ))}
      </datalist>

      {/* Input row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-describedby={noteId}
          list={datalistId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={adding}
          placeholder={labelPlaceholder}
          {...screenBox("metaTag")}
          className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
        {/* #37.44 (A032): Plus; „Se adaugă…" its name while it works. */}
        <IconButton
          icon={Plus}
          label={labelAdd}
          busy={adding}
          busyLabel={labelAdding}
          variant="primary"
          size="md"
          onClick={handleAdd}
          disabled={adding || !input.trim()}
        />
      </div>

      {/* Chip display */}
      {tags.length === 0 ? (
        <p className="text-sm text-fade dark:text-zinc-400">{labelEmpty}</p>
      ) : (
        // Slice #37.69: small chips, closer together, the „×" over the corner on hover.
        <div className="flex flex-wrap gap-1.5 pt-1" data-tag-chips="">
          {tags.map((tag) => (
            <span key={tag} className={TAG_CHIP} data-tag-chip="">
              {tag}
              <IconButton
                icon={X}
                label={`${labelRemove} ${tag}`}
                variant="bare-danger"
                size="xs"
                className={`${CHIP_REMOVE_PLACE} ${REMOVE_REVEAL}`}
                onClick={() => handleRemove(tag)}
                disabled={removing === tag}
              />
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// InlineGroupsSection — groups with add/remove
// ---------------------------------------------------------------------------

function InlineGroupsSection({
  principalObjectId,
  currentGroups,
  mainQueryKey,
  isOnLatest,
  labelTitle,
  labelEmpty,
  labelAdd,
  labelHideAdd,
  labelAddPlaceholder,
  labelRemove,
  withBack,
  cap,
  labelLimit,
  labelLimitReached,
  labelNoneAvailable,
}: {
  principalObjectId: string;
  currentGroups:     GroupTag[];
  mainQueryKey:      string;
  isOnLatest:        boolean;
  labelTitle:        string;
  labelEmpty:        string;
  labelAdd:          string;
  /** The name of the open picker, which showed a bare up-triangle (#37.44). */
  labelHideAdd:      string;
  labelAddPlaceholder: string;
  labelRemove:       string;
  withBack:          (href: string) => string;
  /**
   * Slice #38.10: how many groups this record may belong to — the server's own
   * limit (`MAX_GROUPS_PER_PROPERTY` / `MAX_GROUPS_PER_ITEM`, validation.ts),
   * never a second number written here.
   */
  cap:               number;
  /** The italic line under the list at the cap. */
  labelLimit:        string;
  /** The disabled „+"'s name and tooltip at the cap. */
  labelLimitReached: string;
  /** The picker's placeholder when no group is left to join under the cap. */
  labelNoneAvailable: string;
}) {
  const queryClient  = useQueryClient();
  const availKey     = `${mainQueryKey}-avail-groups`;
  const groupsApiBase = `/api/metadata/${principalObjectId}/groups`;

  const [showAdd,   setShowAdd]   = useState(false);
  const [adding,    setAdding]    = useState(false);
  const [removing,  setRemoving]  = useState<string | null>(null);
  const selectRef   = useRef<HTMLSelectElement>(null);

  const { data: availData, isLoading: availLoading } = useQuery<{ groups: AvailableGroup[] }>({
    queryKey:             [availKey],
    queryFn:              async () => {
      const res = await fetch(groupsApiBase);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled:              showAdd && !!principalObjectId,
    staleTime:            0,
    refetchOnWindowFocus: false,
  });

  const available = availData?.groups ?? [];
  // Slice #38.10: at the cap the „+" is disabled and a line says why; a picker
  // open when the cap is reached closes (it is drawn only under the cap).
  const atCap = currentGroups.length >= cap;
  const pickerOpen = showAdd && !atCap;

  async function handleAdd(groupId: string) {
    if (!groupId) return;
    setAdding(true);
    try {
      const res = await fetch(groupsApiBase, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ groupId }),
      });
      if (res.ok) {
        setShowAdd(false);
        await queryClient.invalidateQueries({ queryKey: [mainQueryKey] });
        await queryClient.invalidateQueries({ queryKey: [availKey] });
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(groupId: string) {
    setRemoving(groupId);
    try {
      const res = await fetch(`${groupsApiBase}/${groupId}`, { method: "DELETE" });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: [mainQueryKey] });
        await queryClient.invalidateQueries({ queryKey: [availKey] });
      }
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h3 className={ITEM_TITLE}>{labelTitle}</h3>
        {isOnLatest && (
          // #37.44 (A032): Plus while closed, ChevronUp while open („▲" before).
          <AddToggleButton
            open={pickerOpen}
            icon={Plus}
            labelAdd={labelAdd}
            labelHide={labelHideAdd}
            onClick={() => setShowAdd(!pickerOpen)}
            disabled={atCap}
            labelDisabled={labelLimitReached}
          />
        )}
      </div>

      {/* Add group dropdown (lazy) */}
      {pickerOpen && isOnLatest && (
        <div className="flex items-center gap-2">
          <select
            ref={selectRef}
            defaultValue=""
            disabled={adding || availLoading}
            onChange={(e) => { void handleAdd(e.target.value); }}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
          >
            <option value="" disabled data-blank="">
              {availLoading ? "…" : available.length === 0 ? labelNoneAvailable : labelAddPlaceholder}
            </option>
            {available.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {!currentGroups.length ? (
        <p className="text-sm text-fade dark:text-zinc-400">{labelEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {currentGroups.map((g) => (
            <li key={g.code} className="group flex items-center gap-2">
              <Link
                href={withBack(`/admin/groups/${encodeURIComponent(g.id)}`)}
                className="inline-flex items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-canvas dark:hover:bg-zinc-800"
              >
                <span className="font-mono text-xs rounded border border-card-rim bg-card px-1.5 py-0.5 text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  {g.code}&nbsp;[{String(g.position).padStart(2, "0")}]
                </span>
                <span className="text-ink underline-offset-2 hover:underline dark:text-zinc-100">
                  {g.description}
                </span>
              </Link>
              {isOnLatest && (
                <IconButton
                  icon={X}
                  label={`${labelRemove} ${g.code}`}
                  variant="bare-danger"
                  size="xs"
                  className={`ml-auto ${REMOVE_REVEAL}`}
                  onClick={() => handleRemove(g.id)}
                  disabled={removing === g.id}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Slice #38.10: at the cap, said in words — a disabled „+" cannot be pressed to explain itself. */}
      {atCap && isOnLatest && (
        <p className="text-xs italic text-fade dark:text-zinc-400" data-groups-limit="">
          {labelLimit}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// InlineStampsSection — stamps with add/remove
// ---------------------------------------------------------------------------

function InlineStampsSection({
  principalObjectId,
  currentStamps,
  mainQueryKey,
  isOnLatest,
  labelTitle,
  labelEmpty,
  labelAdd,
  labelHideAdd,
  labelAddPlaceholder,
  labelRemove,
  withBack,
}: {
  principalObjectId: string;
  currentStamps:     StampTag[];
  mainQueryKey:      string;
  isOnLatest:        boolean;
  labelTitle:        string;
  labelEmpty:        string;
  labelAdd:          string;
  /** The name of the open picker, which showed a bare up-triangle (#37.44). */
  labelHideAdd:      string;
  labelAddPlaceholder: string;
  labelRemove:       string;
  withBack:          (href: string) => string;
}) {
  const queryClient   = useQueryClient();
  const availKey      = `${mainQueryKey}-avail-stamps`;
  const stampsApiBase = `/api/metadata/${principalObjectId}/stamps`;

  const [showAdd,  setShowAdd]  = useState(false);
  const [adding,   setAdding]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const { data: availData, isLoading: availLoading } = useQuery<{ stamps: AvailableStamp[] }>({
    queryKey:             [availKey],
    queryFn:              async () => {
      const res = await fetch(stampsApiBase);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled:              showAdd && !!principalObjectId,
    staleTime:            0,
    refetchOnWindowFocus: false,
  });

  const available = availData?.stamps ?? [];

  async function handleAdd(stampId: string) {
    if (!stampId) return;
    setAdding(true);
    try {
      const res = await fetch(stampsApiBase, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ stampId }),
      });
      if (res.ok) {
        setShowAdd(false);
        await queryClient.invalidateQueries({ queryKey: [mainQueryKey] });
        await queryClient.invalidateQueries({ queryKey: [availKey] });
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(stampId: string) {
    setRemoving(stampId);
    try {
      const res = await fetch(`${stampsApiBase}/${stampId}`, { method: "DELETE" });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: [mainQueryKey] });
        await queryClient.invalidateQueries({ queryKey: [availKey] });
      }
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h3 className={ITEM_TITLE}>{labelTitle}</h3>
        {isOnLatest && (
          // #37.44 (A032): Plus while closed, ChevronUp while open („▲" before).
          <AddToggleButton
            open={showAdd}
            icon={Plus}
            labelAdd={labelAdd}
            labelHide={labelHideAdd}
            onClick={() => setShowAdd((v) => !v)}
          />
        )}
      </div>

      {/* Add stamp dropdown (lazy) */}
      {showAdd && isOnLatest && (
        <div className="flex items-center gap-2">
          <select
            defaultValue=""
            disabled={adding || availLoading}
            onChange={(e) => { void handleAdd(e.target.value); }}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
          >
            <option value="" disabled data-blank="">
              {availLoading ? "…" : labelAddPlaceholder}
            </option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.shortDescription}
              </option>
            ))}
          </select>
        </div>
      )}

      {!currentStamps.length ? (
        <p className="text-sm text-fade dark:text-zinc-400">{labelEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {currentStamps.map((s) => (
            <li key={s.code} className="group flex items-center gap-2">
              <Link
                href={withBack(`/admin/stamps/${encodeURIComponent(s.id)}`)}
                className="inline-flex items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-canvas dark:hover:bg-zinc-800"
              >
                <span className="font-mono text-xs rounded border border-card-rim bg-card px-1.5 py-0.5 text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  {s.code}
                </span>
                <span className="text-ink underline-offset-2 hover:underline dark:text-zinc-100">
                  {s.shortDescription}
                </span>
              </Link>
              {isOnLatest && (
                <IconButton
                  icon={X}
                  label={`${labelRemove} ${s.code}`}
                  variant="bare-danger"
                  size="xs"
                  className={`ml-auto ${REMOVE_REVEAL}`}
                  onClick={() => handleRemove(s.id)}
                  disabled={removing === s.id}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CrossRefsSection — "See Also / Related to" informal links
// ---------------------------------------------------------------------------

type CrossRefItem = {
  id:                    string;
  peerPrincipalObjectId: string;
  peerCode:              string;
  peerType:              string;
  peerName:              string | null;
  peerEntityId:          string;
  note:                  string | null;
  isOwner:               boolean;
  createdAt:             string;
};

/** Derive the detail-page href from the peer entity type + id. */
function peerHref(peerType: string, peerEntityId: string): string {
  if (peerType === "PROPERTY") return `/properties/${peerEntityId}`;
  if (peerType === "DOCUMENT") return `/documents/${peerEntityId}`;
  return `/persons/${peerEntityId}`;
}

/** Short type badge label. */
function peerTypeBadge(peerType: string, t: (k: string) => string): string {
  if (peerType === "PROPERTY") return t("crossRef.typeProp");
  if (peerType === "DOCUMENT") return t("crossRef.typeDoc");
  return t("crossRef.typePerson");
}

function CrossRefsSection({
  principalObjectId,
  mainQueryKey,
  isOnLatest,
  t,
  withBack,
}: {
  principalObjectId: string;
  mainQueryKey:      string;
  isOnLatest:        boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t:                 (key: string, opts?: any) => string;
  withBack:          (href: string) => string;
}) {
  const nameOr      = useNameOr(); // #37.57: a peer by its name, or words — never its system ID
  const queryClient = useQueryClient();
  const crossRefKey = `${mainQueryKey}-cross-refs`;
  const noteId      = `${useId()}-note`;
  const apiBase     = `/api/metadata/${principalObjectId}/cross-refs`;

  const { data, isLoading } = useQuery<{ crossRefs: CrossRefItem[] }>({
    queryKey:             [crossRefKey],
    queryFn:              async () => {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime:            0,
    refetchOnWindowFocus: false,
  });

  const crossRefs = data?.crossRefs ?? [];

  // Add form state
  const [showAdd,   setShowAdd]   = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [adding,    setAdding]    = useState(false);
  const [addError,  setAddError]  = useState<string | null>(null);
  const [removing,  setRemoving]  = useState<string | null>(null);

  async function handleAdd() {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(apiBase, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ targetCode: code, note: noteInput.trim() || undefined }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setAddError(json.error ?? "Unknown error");
      } else {
        setCodeInput("");
        setNoteInput("");
        setShowAdd(false);
        await queryClient.invalidateQueries({ queryKey: [crossRefKey] });
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(crossRefId: string) {
    setRemoving(crossRefId);
    try {
      const res = await fetch(`${apiBase}/${crossRefId}`, { method: "DELETE" });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: [crossRefKey] });
      }
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <ItemTitle
          id={noteId}
          title={t("crossRef.title")}
          note={t("crossRef.note")}
          about={t("about", { title: t("crossRef.title") })}
        />
        {isOnLatest && (
          // #37.44 (A039): Link while closed, ChevronUp while open („▲" before).
          <AddToggleButton
            open={showAdd}
            icon={LinkIcon}
            labelAdd={t("crossRef.add")}
            labelHide={t("hideAdd")}
            onClick={() => { setShowAdd((v) => !v); setAddError(null); }}
          />
        )}
      </div>

      {/* Add form (inline, no modal) */}
      {showAdd && isOnLatest && (
        <div className="rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAdd(); } }}
              placeholder={t("crossRef.codePlaceholder")}
              disabled={adding}
              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500 w-36 font-mono uppercase"
            />
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAdd(); } }}
              placeholder={t("crossRef.notePlaceholder")}
              disabled={adding}
              maxLength={500}
              {...screenBox("metaCrossRefNote")}
              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <IconButton
              icon={LinkIcon}
              label={t("crossRef.addConfirm")}
              busy={adding}
              busyLabel={t("crossRef.adding")}
              variant="primary"
              size="md"
              onClick={handleAdd}
              disabled={adding || !codeInput.trim()}
            />
          </div>
          {addError && (
            <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>
          )}
          <p className="text-xs text-fade dark:text-zinc-500">{t("crossRef.codeHint")}</p>
        </div>
      )}

      {/* Cross-ref list */}
      {isLoading ? (
        <p className="text-sm text-fade dark:text-zinc-400">…</p>
      ) : crossRefs.length === 0 ? (
        <p className="text-sm text-fade dark:text-zinc-400">{t("crossRef.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {crossRefs.map((ref) => (
            <li key={ref.id} className="group flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Slice #37.57: no system-ID badge — the peer by its type and name. */}
                  <span className="inline-block text-xs text-fade dark:text-zinc-500 border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5">
                    {peerTypeBadge(ref.peerType, t)}
                  </span>
                  {/* Name / link */}
                  {ref.peerEntityId ? (
                    <Link
                      href={withBack(peerHref(ref.peerType, ref.peerEntityId))}
                      className="text-sm text-ink dark:text-zinc-100 underline-offset-2 hover:underline"
                    >
                      {nameOr(ref.peerName, unnamedKindOf(ref.peerType))}
                    </Link>
                  ) : (
                    <span className="text-sm text-ink dark:text-zinc-100">
                      {nameOr(ref.peerName, unnamedKindOf(ref.peerType))}
                    </span>
                  )}
                  {/* "referenced by" indicator */}
                  {!ref.isOwner && (
                    <span className="text-xs text-fade dark:text-zinc-500 italic">
                      ({t("crossRef.referencedBy")})
                    </span>
                  )}
                </div>
                {ref.note && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400 italic pl-0.5">
                    {ref.note}
                  </p>
                )}
              </div>
              {/* Delete — only the owner may remove */}
              {ref.isOwner && isOnLatest && (
                <IconButton
                  icon={X}
                  label={t("crossRef.remove")}
                  variant="bare-danger"
                  size="xs"
                  className={`shrink-0 ${REMOVE_REVEAL}`}
                  onClick={() => handleRemove(ref.id)}
                  disabled={removing === ref.id}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog — "Make current?"
// ---------------------------------------------------------------------------

function MakeCurrentDialog({
  title,
  body,
  labelOk,
  labelCancel,
  onOk,
  onCancel,
}: {
  title:       string;
  body:        string;
  labelOk:     string;
  labelCancel: string;
  onOk:        () => void;
  onCancel:    () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 shadow-xl p-6">
        <h3 className="mb-3 text-lg font-semibold text-ink dark:text-zinc-100">{title}</h3>
        <p className="mb-6 text-sm text-fade dark:text-zinc-400">{body}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {labelCancel}
          </button>
          <button
            type="button"
            onClick={onOk}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {labelOk}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalculationSourceLink  (Slice #20.09)
// ---------------------------------------------------------------------------
//
// Fetches /api/properties/[id]/calculation-source and renders a link to the
// calculation run history page. Only mounted when provenance = 'ALGORITHM'
// AND the parent passes a calculationSourcePath prop.

type CalcSource = { runId: string; runCode: string; status: string } | null;

function CalculationSourceLink({
  apiPath,
  queryKey,
  labelSource,
  labelView,
  labelNotFound,
}: {
  apiPath:      string;
  queryKey:     string;
  labelSource:  string;
  labelView:    string;
  labelNotFound: string;
}) {
  const { data, isLoading } = useQuery<{ source: CalcSource }>({
    queryKey:             [queryKey],
    queryFn:              async () => {
      const res = await fetch(apiPath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime:            60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) return null;
  const src = data.source;
  if (!src) {
    return (
      <p className="mb-3 text-xs text-fade dark:text-zinc-500">{labelNotFound}</p>
    );
  }
  return (
    <div className="mb-3 flex items-center gap-2 rounded-md border border-card-rim bg-canvas px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
      <span className="text-xs text-fade dark:text-zinc-400">{labelSource}:</span>
      <span className="font-mono text-xs font-medium text-ink dark:text-zinc-100">{src.runCode}</span>
      {src.status === "superseded" && (
        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
          superseded
        </span>
      )}
      {/* #37.44 (A033): Calculator; „Vezi calculul" its name and tooltip. */}
      <IconButton
        href={`/admin/calculation/history/${encodeURIComponent(src.runId)}`}
        icon={Calculator}
        label={labelView}
        variant="secondary"
        size="xs"
        className="ml-auto"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EntityMetadataTab({ apiPath, queryKey, backHref, backEntityName, calculationSourcePath, part }: Props) {
  const showClassification = part !== "connections";
  const showConnections    = part !== "classification";
  const t = useTranslations("shared.entityMetadata");
  const queryClient = useQueryClient();
  // Slice #38.10: the server's own limit — a property's, or a person's and a document's.
  const groupCap = apiPath.startsWith("/api/properties/") ? MAX_GROUPS_PER_PROPERTY : MAX_GROUPS_PER_ITEM;
  // Slice #38.01: Proveniență's left line is Importanță's select's, measured.
  const sharedLeftLine = useSharedLeftLine();
  const { data: tf } = useTimeFrames();

  const backLabel = t("backTo", { name: backEntityName });

  // Viewing state: null = latest (editable), N = historical version (read-only)
  const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null);
  const [showConfirm,          setShowConfirm]          = useState(false);
  const [restoring,            setRestoring]            = useState(false);

  // ── Lifted classification-field state (Task #20) ──────────────────────────
  // Controlled values for the three metadata dropdowns.  Initialised from live
  // data on load; reset whenever server data changes (e.g. after a save).
  const [localImportance, setLocalImportance] = useState<string>("");
  const [localRelevance,  setLocalRelevance]  = useState<string>("");
  const [localProvenance, setLocalProvenance] = useState<string>("");
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  // Tracks the last server-data key so we can sync state during rendering
  // instead of in a useEffect (React "adjusting state during rendering" pattern).
  const [lastFetchedKey, setLastFetchedKey] = useState<string>("");

  // ── Data loading ──────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery<MetaData>({
    queryKey: [queryKey],
    queryFn:  async () => {
      const res = await fetch(apiPath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<MetaData>;
    },
    staleTime:            0,
    refetchOnWindowFocus: false,
  });

  const versionsQueryKey = data?.principalObjectId
    ? `${queryKey}-metadata-versions`
    : null;

  const { data: versionsData } = useQuery<{ items: MetadataVersionItem[] }>({
    queryKey: [versionsQueryKey],
    queryFn:  async () => {
      const res = await fetch(
        `/api/metadata/${data!.principalObjectId}/versions`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    // Slice #37.63: the versions are the three classification values', so only
    // that tile asks for them.
    enabled:              showClassification && !!data?.principalObjectId,
    staleTime:            0,
    refetchOnWindowFocus: false,
  });

  const versions    = versionsData?.items ?? [];
  const totalVer    = versions.length;
  const latestIndex = totalVer - 1;

  // Sync local classification state from server data (on load and after save refetch).
  // Using the "adjusting state during rendering" pattern (React docs) instead of
  // useEffect to avoid the react-hooks/set-state-in-effect lint error.
  // React discards the current render and immediately re-renders when setState is
  // called during rendering, so there is no extra paint / cascade.
  const currentDataKey = data
    ? `${data.importance ?? ""}|${data.relevance ?? ""}|${data.provenance ?? ""}`
    : "";
  if (data && currentDataKey !== lastFetchedKey) {
    setLastFetchedKey(currentDataKey);
    setLocalImportance(data.importance ?? "");
    setLocalRelevance(data.relevance   ?? "");
    setLocalProvenance(data.provenance ?? "");
  }

  // Which version is currently displayed in the UI
  const viewedVersion =
    viewingVersionNumber !== null
      ? versions.find((v) => v.versionNumber === viewingVersionNumber) ?? null
      : null;

  // The snapshot to show in the dropdowns (historical or live data)
  const displayedSnapshot: MetadataSnapshot = viewedVersion
    ? viewedVersion.snapshot
    : {
        importance: data?.importance ?? null,
        relevance:  data?.relevance  ?? null,
        provenance: data?.provenance ?? null,
      };

  // Compute highlights: diff viewed version vs the one before it
  const prevVersion =
    viewedVersion && viewedVersion.versionNumber > 0
      ? versions.find((v) => v.versionNumber === viewedVersion.versionNumber - 1) ?? null
      : null;

  const highlights =
    viewedVersion && prevVersion
      ? computeHighlights(prevVersion.snapshot, viewedVersion.snapshot)
      : { importance: undefined, relevance: undefined, provenance: undefined };

  // ── Version nav helpers ───────────────────────────────────────────────────

  const isOnLatest = viewingVersionNumber === null;

  function goToPrev() {
    if (viewingVersionNumber === null) {
      if (latestIndex > 0) setViewingVersionNumber(versions[latestIndex - 1].versionNumber);
    } else {
      const idx = versions.findIndex((v) => v.versionNumber === viewingVersionNumber);
      if (idx > 0) setViewingVersionNumber(versions[idx - 1].versionNumber);
    }
  }

  function goToNext() {
    if (viewingVersionNumber === null) return;
    const idx = versions.findIndex((v) => v.versionNumber === viewingVersionNumber);
    if (idx < latestIndex - 1) {
      setViewingVersionNumber(versions[idx + 1].versionNumber);
    } else {
      setViewingVersionNumber(null);
    }
  }

  const navColor: HighlightColor =
    viewedVersion && prevVersion
      ? versionLabelColor(prevVersion.snapshot, viewedVersion.snapshot)
      : "green";

  const displayedVersionNumber =
    viewingVersionNumber !== null
      ? viewingVersionNumber
      : latestIndex >= 0
      ? versions[latestIndex]?.versionNumber ?? 0
      : 0;

  const navView: VersionNavView = {
    current:        displayedVersionNumber,
    color:          navColor,
    canPrev:        totalVer > 1 && (isOnLatest ? latestIndex > 0 : viewingVersionNumber! > versions[0].versionNumber),
    canNext:        !isOnLatest,
    canMakeCurrent: !isOnLatest,
    onPrev:         goToPrev,
    onNext:         goToNext,
    onMakeCurrent:  () => setShowConfirm(true),
  };

  const navLabels: VersionNavLabels = {
    versionLabel:    t("version.label", { n: displayedVersionNumber }),
    prevVersion:     t("version.prev"),
    nextVersion:     t("version.next"),
    makeCurrent:     t("version.makeCurrent"),
    makeCurrentHint: t("version.makeCurrentHint"),
  };

  // ── Dirty detection ───────────────────────────────────────────────────────

  const isDirty = isOnLatest && (
    localImportance !== (data?.importance ?? "") ||
    localRelevance  !== (data?.relevance  ?? "") ||
    localProvenance !== (data?.provenance ?? "")
  );

  // ── Unified save (all three fields) ───────────────────────────────────────

  async function saveAll() {
    if (!data?.principalObjectId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/metadata/${data.principalObjectId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          importance: localImportance || null,
          relevance:  localRelevance  || null,
          provenance: localProvenance || null,
        }),
      });
      if (res.redirected) throw new Error(t("saveErrorSession"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      if (versionsQueryKey) {
        await queryClient.invalidateQueries({ queryKey: [versionsQueryKey] });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  // ── Display values (local on latest; snapshot on historical) ─────────────

  const displayImportance = isOnLatest ? localImportance : (displayedSnapshot.importance ?? "");
  const displayRelevance  = isOnLatest ? localRelevance  : (displayedSnapshot.relevance  ?? "");
  const displayProvenance = isOnLatest ? localProvenance : (displayedSnapshot.provenance ?? "");

  // ── Mark as reviewed helper ───────────────────────────────────────────────

  async function touchField(field: "importance" | "relevance" | "provenance") {
    const res = await fetch(apiPath, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ field, action: "touch" }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await queryClient.invalidateQueries({ queryKey: [queryKey] });
  }

  // ── Make current ─────────────────────────────────────────────────────────

  async function handleMakeCurrent() {
    if (!viewedVersion) return;
    setRestoring(true);
    try {
      const res = await fetch(apiPath, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ snapshot: viewedVersion.snapshot }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      if (versionsQueryKey) {
        await queryClient.invalidateQueries({ queryKey: [versionsQueryKey] });
      }
      setViewingVersionNumber(null);
    } finally {
      setRestoring(false);
      setShowConfirm(false);
    }
  }

  // ── Back-link helper ──────────────────────────────────────────────────────

  function withBack(href: string): string {
    return `${href}?from=${encodeURIComponent(backHref)}&fromLabel=${encodeURIComponent(backLabel)}`;
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (isLoading) {
    return <p className="py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>;
  }
  if (isError || !data) {
    return <p className="py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>;
  }

  // ── Option arrays ─────────────────────────────────────────────────────────

  const importanceOptions = IMPORTANCE_VALUES.map((v) => ({
    value: v,
    label: t(`importance.${v.toLowerCase()}` as Parameters<typeof t>[0]),
  }));

  const relevanceOptions = RELEVANCE_VALUES.map((v) => ({
    value: v,
    label: t(`relevance.${v.toLowerCase()}` as Parameters<typeof t>[0]),
  }));

  const provenanceOptions = PROVENANCE_VALUES.map((v) => ({
    value: v,
    label: t(`provenance.${provenanceI18nKey(v)}` as Parameters<typeof t>[0]),
  }));

  // ── Statement maps ────────────────────────────────────────────────────────

  const importanceStatements: Record<string, string> = {
    LOW:    t("importance.statementLow"),
    MEDIUM: t("importance.statementMedium"),
    HIGH:   t("importance.statementHigh"),
  };

  const relevanceStatements: Record<string, string> = {
    INACTIVE:   t("relevance.statementInactive"),
    HISTORICAL: t("relevance.statementHistorical"),
    CURRENT:    t("relevance.statementCurrent"),
    FUTURE:     t("relevance.statementFuture"),
  };

  // Derived from PROVENANCE_VALUES rather than hand-listed, so adding a value
  // to the shared list cannot leave a code without its explanatory sentence.
  // "DOC_FILE" -> i18n key "statementDocFile".
  const provenanceStatements: Record<string, string> = {};
  for (const v of PROVENANCE_VALUES) {
    const key = provenanceI18nKey(v);
    provenanceStatements[v] = t(
      `provenance.statement${key.charAt(0).toUpperCase()}${key.slice(1)}` as Parameters<typeof t>[0],
    );
  }

  const provenanceLabelMap: Record<string, string> = {};
  for (const v of PROVENANCE_VALUES) {
    provenanceLabelMap[v] = t(`provenance.${provenanceI18nKey(v)}` as Parameters<typeof t>[0]);
  }

  // ── Days-since helpers ────────────────────────────────────────────────────

  function buildDaysText(isoDate: string | null): string | null {
    const d = daysSince(isoDate);
    if (d === null) return null;
    if (d === 0) return t("lastChangedToday");
    if (d === 1) return t("lastChangedYesterday");
    return t("lastChangedDays", { days: d });
  }

  function buildReviewWarning(isoDate: string | null): string | null {
    const d = daysSince(isoDate);
    const threshold = tfDays(tf, "metadata_review_warning");
    if (d === null || d <= threshold) return null;
    return t("reviewWarning", { days: d });
  }

  // ── Next version number for the confirm dialog body ───────────────────────

  const nextVersionNumber =
    versions.length > 0
      ? versions[versions.length - 1].versionNumber + 1
      : 1;

  // ── Render ────────────────────────────────────────────────────────────────

  const about = (title: string) => t("about", { title });

  // Slice #37.82: „Conexiuni"'s groups that are drawn, in order — the lines go between them.
  const connectionGroups: { key: string; node: React.ReactNode }[] = [];
  if (showConnections && data) {
    // ── 4. Etichete / Tags
    if (data.principalObjectId && isOnLatest) connectionGroups.push({ key: "tags", node: (
        <TagsSection
          principalObjectId={data.principalObjectId}
          queryKey={queryKey}
          labelTitle={t("tags.title")}
          labelNote={t("tags.note")}
          labelAbout={about(t("tags.title"))}
          labelPlaceholder={t("tags.placeholder")}
          labelAdd={t("tags.add")}
          labelAdding={t("tags.adding")}
          labelRemove={t("tags.remove")}
          labelEmpty={t("tags.empty")}
        />
    ) });
    // ── 5. Grupuri / Groups
    connectionGroups.push({ key: "groups", node: data.principalObjectId ? (
        <InlineGroupsSection
          principalObjectId={data.principalObjectId}
          currentGroups={data.groups}
          mainQueryKey={queryKey}
          isOnLatest={isOnLatest}
          labelTitle={t("groups.title")}
          labelEmpty={t("groups.empty")}
          labelAdd={t("groups.add")}
          labelHideAdd={t("hideAdd")}
          labelAddPlaceholder={t("groups.addPlaceholder")}
          labelRemove={t("groups.remove")}
          withBack={withBack}
          cap={groupCap}
          labelLimit={t("groups.limit", { max: groupCap })}
          labelLimitReached={t("groups.limitReached", { max: groupCap })}
          labelNoneAvailable={t("groups.noneAvailable")}
        />
    ) : (
        <section className="flex flex-col gap-1">
          <h3 className={ITEM_TITLE}>{t("groups.title")}</h3>
          <p className="text-sm text-fade dark:text-zinc-400">{t("groups.empty")}</p>
        </section>
    ) });
    // ── 6. Ștampile / Stamps
    connectionGroups.push({ key: "stamps", node: data.principalObjectId ? (
        <InlineStampsSection
          principalObjectId={data.principalObjectId}
          currentStamps={data.stamps}
          mainQueryKey={queryKey}
          isOnLatest={isOnLatest}
          labelTitle={t("stamps.title")}
          labelEmpty={t("stamps.empty")}
          labelAdd={t("stamps.add")}
          labelHideAdd={t("hideAdd")}
          labelAddPlaceholder={t("stamps.addPlaceholder")}
          labelRemove={t("stamps.remove")}
          withBack={withBack}
        />
    ) : (
        <section className="flex flex-col gap-1">
          <h3 className={ITEM_TITLE}>{t("stamps.title")}</h3>
          <p className="text-sm text-fade dark:text-zinc-400">{t("stamps.empty")}</p>
        </section>
    ) });
    // ── 7. Trimiteri / See Also
    if (data.principalObjectId) connectionGroups.push({ key: "crossRefs", node: (
        <CrossRefsSection
          principalObjectId={data.principalObjectId}
          mainQueryKey={queryKey}
          isOnLatest={isOnLatest}
          t={(key, opts) => t(key as Parameters<typeof t>[0], opts)}
          withBack={withBack}
        />
    ) });
  }

  return (
    <>
      {/* "Make current" confirmation dialog */}
      {showConfirm && viewedVersion && (
        <MakeCurrentDialog
          title={t("version.makeCurrentTitle")}
          body={t("version.makeCurrentBody", {
            viewed: viewedVersion.versionNumber,
            next:   nextVersionNumber,
          })}
          labelOk={restoring ? "…" : t("version.makeCurrentOk")}
          labelCancel={t("version.makeCurrentCancel")}
          onOk={handleMakeCurrent}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Slice #37.63 — one column of items, each a title (its explanation a
          bubble), its control and what is true of this record; no paragraphs
          of help, no empty lines. With `part` the tile's own title names the
          section; without it both sections are drawn under their subheaders. */}
      <div className="flex flex-col gap-4" data-metadata-part={part ?? "both"} ref={sharedLeftLine}>

        {showClassification && (<>
        {/* ── Version nav (only when there are multiple versions) ──────────── */}
        {/* Slice #37.81: the line under it is the shared divider, as the tile's other two are. */}
        {totalVer > 1 && (<>
          <div className="flex items-center gap-2">
            <VersionNavControls nav={navView} labels={navLabels} />
          </div>
          <Divider />
        </>)}

        {!part && (
          <h3 className="border-b border-card-rim pb-1 text-xs font-semibold uppercase tracking-wide text-fade dark:border-zinc-700 dark:text-zinc-500">
            {t("sectionClassification")}
          </h3>
        )}

        {/* Slice #37.68 — Importanță and Relevanță are two columns of one row,
            each with its title and bubble, its select and review button, and
            its „Actualizat …" and warning under its own select. Proveniență,
            the wider select, keeps a row of its own under them.
            Slice #37.81 — two equal cells with the vertical divider between
            them; each one's content centred across, the shorter centred down
            against the taller. */}
        <div className="grid items-center gap-4" style={CLASSIFICATION_PAIR_GRID} data-classification-pair="">
        {/* ── 1. Importanță / Importance ──────────────────────────────────── */}
        <MetadataSection
          title={t("importance.title")}
          note={t("importance.note")}
          about={about(t("importance.title"))}
          value={displayImportance}
          onChange={setLocalImportance}
          options={importanceOptions}
          statementMap={importanceStatements}
          placeholder={t("importance.placeholder")}
          labelMarkReviewed={t("markReviewed.button")}
          labelMarkingReviewed={t("markReviewed.marking")}
          labelMarkedReviewed={t("markReviewed.marked")}
          daysText={buildDaysText(data.importanceUpdatedAt)}
          reviewWarning={buildReviewWarning(data.importanceUpdatedAt)}
          onMarkReviewed={() => touchField("importance")}
          readOnly={!isOnLatest}
          highlight={highlights.importance}
          centred
        />

        <Divider vertical />

        {/* ── 2. Relevanță / Relevance ─────────────────────────────────────── */}
        <MetadataSection
          title={t("relevance.title")}
          note={t("relevance.note")}
          about={about(t("relevance.title"))}
          value={displayRelevance}
          onChange={setLocalRelevance}
          options={relevanceOptions}
          statementMap={relevanceStatements}
          placeholder={t("relevance.placeholder")}
          labelMarkReviewed={t("markReviewed.button")}
          labelMarkingReviewed={t("markReviewed.marking")}
          labelMarkedReviewed={t("markReviewed.marked")}
          daysText={buildDaysText(data.relevanceUpdatedAt)}
          reviewWarning={buildReviewWarning(data.relevanceUpdatedAt)}
          onMarkReviewed={() => touchField("relevance")}
          readOnly={!isOnLatest}
          highlight={highlights.relevance}
          centred
        />
        </div>

        {/* Slice #37.81: the line between the pair and Proveniență. */}
        <Divider />

        {/* ── 3. Proveniență / Provenience, with its history ───────────────── */}
        {/* Slice #38.01: its title, select and „Istoric" start on Importanță's
            select's left edge — measured by `sharedLeftLine`, on the column above. */}
        <MetadataSection
          title={t("provenance.title")}
          note={t("provenance.note")}
          about={about(t("provenance.title"))}
          value={displayProvenance}
          onChange={setLocalProvenance}
          options={provenanceOptions}
          statementMap={provenanceStatements}
          placeholder={t("provenance.placeholder")}
          labelMarkReviewed={t("markReviewed.button")}
          labelMarkingReviewed={t("markReviewed.marking")}
          labelMarkedReviewed={t("markReviewed.marked")}
          daysText={buildDaysText(data.provenanceUpdatedAt)}
          reviewWarning={buildReviewWarning(data.provenanceUpdatedAt)}
          onMarkReviewed={() => touchField("provenance")}
          readOnly={!isOnLatest}
          highlight={highlights.provenance}
          alignedLeft
        >
          {/* Slice #20.09: calculation source link (shown when provenance = ALGORITHM) */}
          {calculationSourcePath && displayProvenance === "ALGORITHM" && (
            <CalculationSourceLink
              apiPath={calculationSourcePath}
              queryKey={`calc-source-${queryKey}`}
              labelSource={t("provenance.algorithmSource")}
              labelView={t("provenance.algorithmViewRun")}
              labelNotFound={t("provenance.algorithmNotFound")}
            />
          )}

          {/* History — sourced from entity_provenance_log via the main query.
              It says something about THIS record, so it stays visible (#37.63). */}
          {/* Slice #37.68 — the save button stands on „Istoric"'s line, against
              the tile's right edge; on a version that is not the latest there
              is no save button and „Istoric" is alone on its line. */}
          <div className="flex items-center justify-between gap-3" data-history-line="">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-500">
              {t("provenance.historyTitle")}
            </h4>
            {isOnLatest && (
              // #37.42/#37.43 (A022): Save; while „✓ Salvat" shows, a Check in its
              // place, then Save again — the after-save confirmation stays.
              <IconButton
                icon={saved ? Check : Save}
                label={saved ? t("saved") : t("save")}
                busy={saving}
                busyLabel={t("saving")}
                variant="primary"
                size="lg"
                onClick={saveAll}
                disabled={saving || saved || !isDirty}
              />
            )}
          </div>
          {data.provenanceHistory.length === 0 ? (
            <p className="text-xs text-fade dark:text-zinc-500">{t("provenance.historyEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {data.provenanceHistory.map((entry, i) => (
                <li key={i} className="flex items-center gap-3 text-xs text-fade dark:text-zinc-400">
                  <span className="font-mono tabular-nums">{entry.date}</span>
                  <span>{provenanceLabelMap[entry.method] ?? entry.method}</span>
                </li>
              ))}
            </ul>
          )}
        </MetadataSection>

        </>)}

        {showConnections && (<>
        {!part && (
          <h3 className="border-b border-card-rim pb-1 text-xs font-semibold uppercase tracking-wide text-fade dark:border-zinc-700 dark:text-zinc-500">
            {t("sectionConnections")}
          </h3>
        )}

        {/* Slice #37.82 — a line between every two groups that are drawn, with
            #37.81's divider: never first, never last, never two together (on an
            older version „Etichete" is not drawn, and „Grupuri" comes first with
            no line above it). The groups stand 0.5rem from each line, so two
            groups are the 1rem they were apart plus the line. */}
        <div className="flex flex-col gap-2" data-connections-groups="">
          {connectionGroups.map((group, i) => (
            <Fragment key={group.key}>
              {i > 0 && <Divider />}
              {group.node}
            </Fragment>
          ))}
        </div>
        </>)}
      </div>
    </>
  );
}
