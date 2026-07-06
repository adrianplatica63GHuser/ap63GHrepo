"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { VersionNavControls } from "@/components/version-nav-controls";
import type { VersionNavView, VersionNavLabels } from "@/components/version-nav-controls";
import { highlightRingClass } from "@/lib/versioning/highlight-ring";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import type { MetadataSnapshot, MetadataVersionItem } from "@/lib/metadata/queries";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPORTANCE_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
const RELEVANCE_VALUES  = ["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"] as const;
const PROVENANCE_VALUES = [
  "MANUAL",
  "IMAGE_UPLOAD",
  "TEXT_FILE",
  "ALGORITHM",
  "AI_INTERPRETED",
  "EXTERNAL_IMPORT",
] as const;

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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a DB key like IMAGE_UPLOAD → imageUpload for i18n lookups. */
function camel(s: string) {
  return s.toLowerCase().replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
}

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
}: {
  value:       string;
  onChange:    (v: string) => void;
  disabled?:   boolean;
  placeholder: string;
  options:     { value: string; label: string }[];
  highlight?:  HighlightColor | undefined;
}) {
  return (
    <select
      value={value}
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
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

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
  /** When true: wraps the qualifying statement in a collapsible <details> element. */
  collapsibleStatement,
  /** Summary text for the collapsible, e.g. "Ce înseamnă asta?" */
  labelWhatMeansThis,
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
  collapsibleStatement?: boolean;
  labelWhatMeansThis?:   string;
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

  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold text-ink dark:text-zinc-100">{title}</h2>
      <p className="mb-3 text-sm text-fade dark:text-zinc-400">{note}</p>

      <div className="flex flex-wrap items-center gap-3">
        <MetaSelect
          value={value}
          onChange={onChange}
          disabled={readOnly}
          placeholder={placeholder}
          options={options}
          highlight={highlight}
        />
        {!readOnly && (
          <button
            type="button"
            onClick={handleMarkReviewed}
            disabled={reviewing || reviewed}
            className="rounded px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-60 transition-colors"
          >
            {reviewed ? labelMarkedReviewed : reviewing ? labelMarkingReviewed : labelMarkReviewed}
          </button>
        )}
      </div>

      {/* Qualifying statement shown once a value is selected */}
      {statement && (
        collapsibleStatement ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors select-none">
              {labelWhatMeansThis}
            </summary>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 italic pl-1">{statement}</p>
          </details>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 italic">{statement}</p>
        )
      )}

      {/* Days-since indicator (hidden on historical read-only views) */}
      {!readOnly && (daysText || reviewWarning) && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {daysText && (
            <p className="text-sm text-fade dark:text-zinc-500">{daysText}</p>
          )}
          {reviewWarning && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{reviewWarning}</p>
          )}
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}
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
  labelPlaceholder:  string;
  labelAdd:          string;
  labelAdding:       string;
  labelRemove:       string;
  labelEmpty:        string;
}) {
  const queryClient = useQueryClient();
  const tagsKey     = `${queryKey}-tags`;
  const apiBase     = `/api/metadata/${principalObjectId}/tags`;

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

  const tags = data?.tags ?? [];

  const [input,   setInput]   = useState("");
  const [adding,  setAdding]  = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleAdd() {
    const tag = input.trim();
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

  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold text-ink dark:text-zinc-100">{labelTitle}</h2>
      <p className="mb-3 text-sm text-fade dark:text-zinc-400">{labelNote}</p>

      {/* Input row */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={adding}
          placeholder={labelPlaceholder}
          className="flex-1 max-w-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="rounded px-3 py-1.5 text-sm font-medium bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white disabled:opacity-60 transition-colors"
        >
          {adding ? labelAdding : labelAdd}
        </button>
      </div>

      {/* Chip display */}
      {tags.length === 0 ? (
        <p className="text-sm text-fade dark:text-zinc-400">{labelEmpty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-zinc-800 px-3 py-1 text-sm text-ink dark:text-zinc-100"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                disabled={removing === tag}
                aria-label={`${labelRemove} ${tag}`}
                className="text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors leading-none disabled:opacity-50"
              >
                ×
              </button>
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
  labelAddPlaceholder,
  labelRemove,
  withBack,
}: {
  principalObjectId: string;
  currentGroups:     GroupTag[];
  mainQueryKey:      string;
  isOnLatest:        boolean;
  labelTitle:        string;
  labelEmpty:        string;
  labelAdd:          string;
  labelAddPlaceholder: string;
  labelRemove:       string;
  withBack:          (href: string) => string;
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
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-ink dark:text-zinc-100">{labelTitle}</h2>
        {isOnLatest && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
          >
            {showAdd ? "▲" : labelAdd}
          </button>
        )}
      </div>

      {/* Add group dropdown (lazy) */}
      {showAdd && isOnLatest && (
        <div className="mb-3 flex items-center gap-2">
          <select
            ref={selectRef}
            defaultValue=""
            disabled={adding || availLoading}
            onChange={(e) => { void handleAdd(e.target.value); }}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
          >
            <option value="" disabled>
              {availLoading ? "…" : labelAddPlaceholder}
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
            <li key={g.code} className="flex items-center gap-2">
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
                <button
                  type="button"
                  onClick={() => handleRemove(g.id)}
                  disabled={removing === g.id}
                  aria-label={`${labelRemove} ${g.code}`}
                  className="ml-auto text-xs text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors disabled:opacity-50 px-1"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
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
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-ink dark:text-zinc-100">{labelTitle}</h2>
        {isOnLatest && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
          >
            {showAdd ? "▲" : labelAdd}
          </button>
        )}
      </div>

      {/* Add stamp dropdown (lazy) */}
      {showAdd && isOnLatest && (
        <div className="mb-3 flex items-center gap-2">
          <select
            defaultValue=""
            disabled={adding || availLoading}
            onChange={(e) => { void handleAdd(e.target.value); }}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
          >
            <option value="" disabled>
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
            <li key={s.code} className="flex items-center gap-2">
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
                <button
                  type="button"
                  onClick={() => handleRemove(s.id)}
                  disabled={removing === s.id}
                  aria-label={`${labelRemove} ${s.code}`}
                  className="ml-auto text-xs text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors disabled:opacity-50 px-1"
                >
                  ×
                </button>
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
  const queryClient = useQueryClient();
  const crossRefKey = `${mainQueryKey}-cross-refs`;
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
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-ink dark:text-zinc-100">
          {t("crossRef.title")}
        </h2>
        {isOnLatest && (
          <button
            type="button"
            onClick={() => { setShowAdd((v) => !v); setAddError(null); }}
            className="text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
          >
            {showAdd ? "▲" : t("crossRef.add")}
          </button>
        )}
      </div>

      {/* Clarifying note — always visible so the purpose is self-documenting */}
      <p className="mb-3 text-sm text-fade dark:text-zinc-400 italic">
        {t("crossRef.note")}
      </p>

      {/* Add form (inline, no modal) */}
      {showAdd && isOnLatest && (
        <div className="mb-4 rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 p-3 flex flex-col gap-2">
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
              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500 flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !codeInput.trim()}
              className="rounded px-3 py-1.5 text-sm font-medium bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white disabled:opacity-60 transition-colors"
            >
              {adding ? t("crossRef.adding") : t("crossRef.addConfirm")}
            </button>
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
            <li key={ref.id} className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Type badge */}
                  <span className="inline-block font-mono text-xs rounded border border-card-rim bg-card px-1.5 py-0.5 text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    {ref.peerCode}
                  </span>
                  <span className="inline-block text-xs text-fade dark:text-zinc-500 border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5">
                    {peerTypeBadge(ref.peerType, t)}
                  </span>
                  {/* Name / link */}
                  {ref.peerEntityId ? (
                    <Link
                      href={withBack(peerHref(ref.peerType, ref.peerEntityId))}
                      className="text-sm text-ink dark:text-zinc-100 underline-offset-2 hover:underline"
                    >
                      {ref.peerName ?? ref.peerCode}
                    </Link>
                  ) : (
                    <span className="text-sm text-ink dark:text-zinc-100">
                      {ref.peerName ?? ref.peerCode}
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
                <button
                  type="button"
                  onClick={() => handleRemove(ref.id)}
                  disabled={removing === ref.id}
                  aria-label={t("crossRef.remove")}
                  className="text-xs text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors disabled:opacity-50 shrink-0 px-1 pt-0.5"
                >
                  ×
                </button>
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
            className="rounded px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 text-ink dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800"
          >
            {labelCancel}
          </button>
          <button
            type="button"
            onClick={onOk}
            className="rounded px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white"
          >
            {labelOk}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EntityMetadataTab({ apiPath, queryKey, backHref, backEntityName }: Props) {
  const t = useTranslations("shared.entityMetadata");
  const queryClient = useQueryClient();

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
    enabled:              !!data?.principalObjectId,
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
    label: t(`provenance.${camel(v)}` as Parameters<typeof t>[0]),
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

  const provenanceStatements: Record<string, string> = {
    MANUAL:          t("provenance.statementManual"),
    IMAGE_UPLOAD:    t("provenance.statementImageUpload"),
    TEXT_FILE:       t("provenance.statementTextFile"),
    ALGORITHM:       t("provenance.statementAlgorithm"),
    AI_INTERPRETED:  t("provenance.statementAiInterpreted"),
    EXTERNAL_IMPORT: t("provenance.statementExternalImport"),
  };

  const provenanceLabelMap: Record<string, string> = {};
  for (const v of PROVENANCE_VALUES) {
    provenanceLabelMap[v] = t(`provenance.${camel(v)}` as Parameters<typeof t>[0]);
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
    if (d === null || d <= 90) return null;
    return t("reviewWarning", { days: d });
  }

  // ── Next version number for the confirm dialog body ───────────────────────

  const nextVersionNumber =
    versions.length > 0
      ? versions[versions.length - 1].versionNumber + 1
      : 1;

  // ── Render ────────────────────────────────────────────────────────────────

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

      <div className="flex flex-col gap-8 py-2">

        {/* ── Version nav (only when there are multiple versions) ──────────── */}
        {totalVer > 1 && (
          <div className="flex items-center gap-2 pb-2 border-b border-card-rim dark:border-zinc-700">
            <VersionNavControls nav={navView} labels={navLabels} />
          </div>
        )}

        {/* ── Section subheader: Clasificare subiectivă / Subjective Classification ── */}
        <div className="pb-1 border-b border-card-rim dark:border-zinc-700">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-500">
            {t("sectionClassification")}
          </h3>
        </div>

        {/* ── 1. Importanță / Importance ──────────────────────────────────── */}
        <MetadataSection
          title={t("importance.title")}
          note={t("importance.note")}
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
        />

        {/* ── 2. Relevanță / Relevance ─────────────────────────────────────── */}
        <MetadataSection
          title={t("relevance.title")}
          note={t("relevance.note")}
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
        />

        {/* ── 3. Proveniență / Provenience (with history + collapsible statement) ── */}
        <MetadataSection
          title={t("provenance.title")}
          note={t("provenance.note")}
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
          collapsibleStatement
          labelWhatMeansThis={t("whatDoesThisMean")}
        >
          {/* History — sourced from entity_provenance_log via the main query */}
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-500">
            {t("provenance.historyTitle")}
          </h3>
          {data.provenanceHistory.length === 0 ? (
            <p className="text-xs text-fade dark:text-zinc-500">{t("provenance.historyEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data.provenanceHistory.map((entry, i) => (
                <li key={i} className="flex items-center gap-3 text-xs text-fade dark:text-zinc-400">
                  <span className="font-mono tabular-nums">{entry.date}</span>
                  <span>{provenanceLabelMap[entry.method] ?? entry.method}</span>
                </li>
              ))}
            </ul>
          )}
        </MetadataSection>

        {/* ── Unified Save button (Task #20) ───────────────────────────────── */}
        {isOnLatest && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || saved || !isDirty}
              className="rounded px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white disabled:opacity-50 transition-colors"
            >
              {saved ? t("saved") : saving ? t("saving") : t("save")}
            </button>
          </div>
        )}

        {/* ── Section subheader: Conexiuni / Connections ────────────────────── */}
        <div className="pb-1 border-b border-card-rim dark:border-zinc-700">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-500">
            {t("sectionConnections")}
          </h3>
        </div>

        {/* ── 4. Etichete / Tags ───────────────────────────────────────────── */}
        {data.principalObjectId && isOnLatest && (
          <TagsSection
            principalObjectId={data.principalObjectId}
            queryKey={queryKey}
            labelTitle={t("tags.title")}
            labelNote={t("tags.note")}
            labelPlaceholder={t("tags.placeholder")}
            labelAdd={t("tags.add")}
            labelAdding={t("tags.adding")}
            labelRemove={t("tags.remove")}
            labelEmpty={t("tags.empty")}
          />
        )}

        {/* ── 5. Grupuri / Groups ──────────────────────────────────────────── */}
        {data.principalObjectId ? (
          <InlineGroupsSection
            principalObjectId={data.principalObjectId}
            currentGroups={data.groups}
            mainQueryKey={queryKey}
            isOnLatest={isOnLatest}
            labelTitle={t("groups.title")}
            labelEmpty={t("groups.empty")}
            labelAdd={t("groups.add")}
            labelAddPlaceholder={t("groups.addPlaceholder")}
            labelRemove={t("groups.remove")}
            withBack={withBack}
          />
        ) : (
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ink dark:text-zinc-100">{t("groups.title")}</h2>
            <p className="text-sm text-fade dark:text-zinc-400">{t("groups.empty")}</p>
          </section>
        )}

        {/* ── 6. Ștampile / Stamps ─────────────────────────────────────────── */}
        {data.principalObjectId ? (
          <InlineStampsSection
            principalObjectId={data.principalObjectId}
            currentStamps={data.stamps}
            mainQueryKey={queryKey}
            isOnLatest={isOnLatest}
            labelTitle={t("stamps.title")}
            labelEmpty={t("stamps.empty")}
            labelAdd={t("stamps.add")}
            labelAddPlaceholder={t("stamps.addPlaceholder")}
            labelRemove={t("stamps.remove")}
            withBack={withBack}
          />
        ) : (
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ink dark:text-zinc-100">{t("stamps.title")}</h2>
            <p className="text-sm text-fade dark:text-zinc-400">{t("stamps.empty")}</p>
          </section>
        )}

        {/* ── 7. Trimiteri / See Also ──────────────────────────────────────── */}
        {data.principalObjectId && (
          <CrossRefsSection
            principalObjectId={data.principalObjectId}
            mainQueryKey={queryKey}
            isOnLatest={isOnLatest}
            t={(key, opts) => t(key as Parameters<typeof t>[0], opts)}
            withBack={withBack}
          />
        )}

        {/* ── 8. Mențiuni / Mentions ───────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-ink dark:text-zinc-100">
            {t("mentions.title")}
          </h2>
          <p className="text-sm text-fade dark:text-zinc-400">{t("mentions.description")}</p>
        </section>

      </div>
    </>
  );
}
