"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { groupFromRecordHref, peerHref, stampFromRecordHref, type PersonKind } from "@/lib/metadata/peer-href";
import { unnamedKindOf } from "@/lib/ui/unnamed";
import { Fragment, useCallback, useEffect, useId, useState, useRef } from "react";
import { Calculator, Check, Link as LinkIcon, Plus, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { AddToggleButton } from "@/components/metadata-buttons";
import { ClassificationConfirm, ClassificationReviewLine } from "@/components/classification-review";
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
import { SCALE, boxRem, rem, screenBox } from "@/lib/ui/field-widths";
import { daysSince, oldestStamp, updatedToday as isUpdatedToday } from "@/lib/metadata/updated-days";
import { HintBubble } from "@/lib/ui/hint-bubble";
import { TextTooltip } from "@/lib/ui/text-tooltip";
import { pickerOptionText, usePickerDismiss } from "@/lib/ui/picker-dismiss";
import { Divider } from "@/lib/ui/divider";
import { MAX_GROUPS_PER_ITEM, MAX_GROUPS_PER_PROPERTY } from "@/lib/groups/validation";
import { ReadValue, TileEditBar, TileEditButton, onTileKeyDown } from "@/components/tiles/read-edit-tile";
import { EmptyTileLine, focusFirstField } from "@/components/tiles/empty-tile";
import { TileAction, TileHint, useTileChrome } from "@/components/tiles/list-tile";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 41.27: the tag box — what is left beside „Adaugă", at least M (136 px). */
const TAG_BOX_STYLE: React.CSSProperties = { minWidth: rem(boxRem({ step: "M", kind: "input" })) };
const IMPORTANCE_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
const RELEVANCE_VALUES  = ["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"] as const;
// PROVENANCE_VALUES is imported from @/lib/metadata/provenance - the single
// source of truth shared with the API routes, the import wizard and the DB
// CHECK constraint (Slice #21.07.Import).

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GroupTag     = { id: string; code: string; position: number; description: string; memberCount: number };
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

/**
 * Slice 41.94 — Adrian: „Make the drop downs for these fields: Importance, Relevance, Provenance - to be size M and place
 * them inline with the fields". A dropdown in „Editează" is an M box (8.5rem, 136 px) on its label's line. It filled the
 * 2-unit tile inside (228 px) under its label since 41.10.
 */
export const CLASSIFICATION_SELECT_STYLE: React.CSSProperties = { width: rem(SCALE.M) };

function MetaSelect({
  value,
  onChange,
  disabled,
  placeholder,
  options,
  highlight,
  describedBy,
  label,
}: {
  value:       string;
  onChange:    (v: string) => void;
  disabled?:   boolean;
  /** Slice 41.10: its name — the item's title, which is a heading, not a <label>. */
  label?:      string;
  placeholder: string;
  options:     { value: string; label: string }[];
  highlight?:  HighlightColor | undefined;
  /** The ids of what explains it — the item's note and the chosen value's statement (#37.63). */
  describedBy?: string;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      // Slice 41.94: an M box on its label's line — a fixed width (#37.23).
      style={CLASSIFICATION_SELECT_STYLE}
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
/**
 * Slice 41.10: an item's title is a field's label, as on the gray tiles — 12 px Roboto Condensed (40.95's `FIELD_LABEL`).
 * Slice 41.94 — Adrian: „Tiles “Classification” and “Tags and groups” The navy blue strings should become color #C00000".
 * Every item title in the rose tiles takes Administrare's red (`text-admin-title`, #C00000; #F87171 in dark); the values,
 * the notes and the tile titles keep theirs, and `FIELD_LABEL` stays navy everywhere else.
 */
export const ROSE_ITEM_TITLE = "font-colhead text-xs font-normal tracking-[0.02em] text-admin-title";
const ITEM_TITLE = ROSE_ITEM_TITLE;

function ItemTitle({ id, title, note, about }: { id: string; title: string; note?: string; about: string }) {
  if (!note) return <h3 className={ITEM_TITLE}>{title}</h3>;
  return (
    <HintBubble id={id} text={note} triggerLabel={about}>
      <h3 className={ITEM_TITLE}>{title}</h3>
    </HintBubble>
  );
}

/**
 * Slice 41.94: the line between two of „Clasificare"'s items — the version line's `Divider`, across both of the edit
 * grid's columns.
 */
function ItemLine() {
  return (
    <div className="col-span-2" data-classification-line-between="">
      <Divider />
    </div>
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

/**
 * A tag chip: it only wraps its text (Slice #37.69). Slice 41.95 — Adrian: „The “Tags / Keywords” bubbles should have
 * their smaller, for example from size 12 to size 10, and the bubble should be smaller as well": 12 px (`text-xs`, was
 * 14), 2 px above and below and 6 a side (was 4 and 8) — two px down, as his 12 → 10. Its „×" keeps CHIP_REMOVE_PLACE,
 * still on the corner.
 */
export const TAG_CHIP =
  "group relative inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs leading-tight text-ink dark:border-slate-600 dark:bg-zinc-800 dark:text-zinc-100";

/** Slice 41.95: the grey rectangle a group's or a stamp's code stands in (41.96: a reference's kind too). */
export const CODE_RECT =
  "inline-flex items-center gap-1 rounded border border-card-rim bg-card px-1.5 py-0.5 font-mono text-xs text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";

/**
 * Slice 41.95 — a group's or a stamp's code in its grey rectangle, its remove „×" on the rectangle's top-right corner,
 * drawn under the pointer or with the focus, as a tag's. Adrian: „when hovering over the Grey rectangle that contains
 * the ID of the group the system should display the remove button in the top right corner of the rectangle - in the same
 * way it does that for the tags; therefore, the remove button disappears from the right side of the group description".
 * The rectangle is its own `group relative` box, not inside the description's link — a button cannot be.
 */
export function CodeChip({
  children,
  remove,
  className,
  ...rest
}: {
  children: React.ReactNode;
  /** The „×": only where the record can be changed. */
  remove?: { label: string; onClick: () => void; disabled?: boolean };
  /** The rectangle's own classes, when not CODE_RECT. */
  className?: string;
  [data: `data-${string}`]: string | undefined;
}) {
  return (
    <span className="group relative inline-flex shrink-0" data-code-chip="" {...rest}>
      <span className={className ?? CODE_RECT}>{children}</span>
      {remove && (
        <IconButton
          icon={X}
          label={remove.label}
          variant="bare-danger"
          size="xs"
          className={`${CHIP_REMOVE_PLACE} ${REMOVE_REVEAL}`}
          onClick={remove.onClick}
          disabled={remove.disabled}
        />
      )}
    </span>
  );
}

/**
 * Slice 41.95 — a group's or a stamp's description beside its code, to the tile's inner edge, cut with „…" after
 * `lines` lines (three for a group, two for a stamp) and whole in the app's bubble under the pointer and on focus — so
 * the rows below never move. When it is not cut there is no bubble (TextTooltip measures). Still the link to the group
 * or the stamp. Adrian: „the description of the group will only display a maximum of three rows and …; it will display
 * the entire description when the mouse hovers over the description; the description keeps being a link, as now".
 */
const DESCRIPTION_CLAMP = { 2: "line-clamp-2", 3: "line-clamp-3" } as const;

function RowDescription({ href, text, lines }: { href: string; text: string | null | undefined; lines: 2 | 3 }) {
  return (
    <TextTooltip
      as={Link}
      href={href}
      text={text ?? undefined}
      className={`min-w-0 flex-1 break-words text-sm text-ink underline-offset-2 hover:underline dark:text-zinc-100 ${DESCRIPTION_CLAMP[lines]}`}
      data-row-description={lines}
    >
      {text}
    </TextTooltip>
  );
}

// ---------------------------------------------------------------------------
// ClassificationItem — one value, read as text or edited     (Slice 41.10)
// ---------------------------------------------------------------------------

/**
 * Slice 41.10 — „Clasificare" as a gray tile (Ask first 2). Read: the label, the value as text under it (its meaning a
 * bubble on it, #37.63), „Marchează ca verificat" beside it as an icon, and when it last changed under it. „Editează"
 * turns the three values into their selects, saved together by „Salvează" — they no longer save as they change.
 * One to a row, so the tile is 2 units (Ask first 3). Was #37.68's MetadataSection: Importanță and Relevanță side by
 * side, centred, with a divider between them (#37.81, #38.01), the selects always open.
 */
function ClassificationItem({
  item,
  title,
  describedBy,
  value,
  valueText,
  editing,
  onChange,
  options,
  statementMap,
  placeholder,
  highlight,
  children,
}: {
  item:          "importance" | "relevance" | "provenance";
  title:         string;
  /** 41.28: the tile's one „i" bubble — what describes the select (its per-item note was its own „i" until then). */
  describedBy:   string;
  /** The value's code — empty string means none. */
  value:         string;
  /** The value's words, read. */
  valueText:     string;
  /** The select, not the text. */
  editing:       boolean;
  onChange:      (v: string) => void;
  options:       { value: string; label: string }[];
  statementMap:  Record<string, string>;
  placeholder:   string;
  /** Version-diff highlight colour for this field. */
  highlight?:    HighlightColor | undefined;
  children?:     React.ReactNode;
}) {
  const statement = value ? statementMap[value] : null;
  const uid = useId();
  const statementId = `${uid}-statement`;

  /* Slice 41.94: in „Editează" the item is ONE line — its label, then its select — on the items' shared two columns
     (`grid-cols-subgrid`), so the three selects start at one column, after the longest label. Read keeps the label
     over the value. */
  const control = editing ? (
    <MetaSelect
      value={value}
      onChange={onChange}
      label={title}
      placeholder={placeholder}
      options={options}
      highlight={highlight}
      describedBy={statement ? `${describedBy} ${statementId}` : describedBy}
    />
  ) : (
    <ReadValue
      name={`classification.${item}`}
      kind="select"
      text={valueText}
      className={highlightRingClass(highlight, false)}
    />
  );

  return (
    <section
      className={editing ? "col-span-2 grid grid-cols-subgrid items-center gap-y-0.5" : "flex flex-col gap-0.5"}
      data-classification-item={item}
    >
      {/* 41.28: the title alone — the tile's one „i" explains the three (it was each item's own). */}
      <ItemTitle id={`${uid}-title`} title={title} about="" />
      {/* 41.28 (Ask first 2): one line — the value. 41.59: its „(actualizat …)" and „Marchează ca verificat" are the
          block's, one line under the three (`ClassificationReviewLine`). In edit the select fills the line. */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5" data-classification-line="">
          {/* Slice #37.63 — what the chosen value means is a bubble ON the value. */}
          {statement ? (
            <HintBubble id={statementId} text={statement}>
              {control}
            </HintBubble>
          ) : (
            control
          )}
        </div>
      </div>

      {children && <div className="col-span-2 mt-1 flex flex-col gap-1 px-2">{children}</div>}
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
  labelBox,
  labelAdd,
  labelAdding,
  labelRemove,
  labelEmpty,
  editing = true,
}: {
  principalObjectId: string;
  queryKey:          string;
  /** Slice 41.40: the tag box, „Adaugă" and each „×" only in edit; at rest the chips alone. */
  editing?:          boolean;
  labelTitle:        string;
  labelNote:         string;
  labelAbout:        string;
  labelPlaceholder:  string;
  /** 41.27: the tag box's accessible name, „Etichetă nouă". */
  labelBox:          string;
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
      {editing && (<>
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
          // 41.27 — Adrian: „Why I cannot make this tile to be two units; It gives me a message about <metatag>!" The box
          // takes what is left beside „Adaugă" (at least M, 136 px), so the tile fits 2 units and the box grows on 3;
          // it was `metaTag` (XL, 272 px), wider than 2 units' 228 inside. Named for a screen reader, and so for the
          // width bubble (`labelOf`).
          aria-label={labelBox}
          style={TAG_BOX_STYLE}
          data-tag-input=""
          className="min-w-0 flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500"
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
      </>)}

      {/* Chip display */}
      {tags.length === 0 ? (
        <p className="text-sm text-fade dark:text-zinc-400">{labelEmpty}</p>
      ) : (
        // Slice #37.69: small chips, closer together, the „×" over the corner on hover.
        <div className="flex flex-wrap gap-1.5 pt-1" data-tag-chips="">
          {tags.map((tag) => (
            <span key={tag} className={TAG_CHIP} data-tag-chip="">
              {tag}
              {editing && (
                <IconButton
                  icon={X}
                  label={`${labelRemove} ${tag}`}
                  variant="bare-danger"
                  size="xs"
                  className={`${CHIP_REMOVE_PLACE} ${REMOVE_REVEAL}`}
                  onClick={() => handleRemove(tag)}
                  disabled={removing === tag}
                />
              )}
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
  // 41.39: the picker closes on a press outside this section and on Esc, the focus back on its „+".
  const sectionRef  = useRef<HTMLElement>(null);
  const closePicker = useCallback(() => setShowAdd(false), []);
  const pickerToggle = useCallback(() => sectionRef.current?.querySelector<HTMLElement>("[data-picker-toggle] button, button"), []);
  usePickerDismiss(showAdd, closePicker, sectionRef, pickerToggle);

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
    <section ref={sectionRef} className="flex flex-col gap-1" data-groups-picker-section="">
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
            // 41.39: what is left of its row (`flex-1 min-w-0`, as the tag box since 41.27) — never wider than the tile.
            className="min-w-0 flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
            data-groups-picker=""
          >
            <option value="" disabled data-blank="">
              {availLoading ? "…" : available.length === 0 ? labelNoneAvailable : labelAddPlaceholder}
            </option>
            {available.map((g) => (
              // 41.39: the description cut to about 60 characters, whole on hover.
              <option key={g.id} value={g.id} title={g.description ?? undefined}>
                {pickerOptionText(g.code, g.description)}
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
            // Slice 41.95 (Ask first 2, 3): the code alone in its rectangle — no member count, no tooltip (Adrian:
            // „should not display the numbers of items in the group") — its „×" on the rectangle's corner, and the
            // description, the link, to the tile's inner edge, cut after three lines.
            <li key={g.code} className="flex items-baseline gap-2" data-group-row="">
              <CodeChip
                data-group-code={g.code}
                remove={isOnLatest ? { label: `${labelRemove} ${g.code}`, onClick: () => void handleRemove(g.id), disabled: removing === g.id } : undefined}
              >
                {g.code}
              </CodeChip>
              <RowDescription href={groupFromRecordHref(g.id, withBack)} text={g.description} lines={3} />
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
  // 41.39: as the group picker — closed by a press outside or Esc, the focus back on its „+".
  const sectionRef  = useRef<HTMLElement>(null);
  const closePicker = useCallback(() => setShowAdd(false), []);
  const pickerToggle = useCallback(() => sectionRef.current?.querySelector<HTMLElement>("button"), []);
  usePickerDismiss(showAdd, closePicker, sectionRef, pickerToggle);
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
    <section ref={sectionRef} className="flex flex-col gap-1" data-stamps-picker-section="">
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
            className="min-w-0 flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
            data-stamps-picker=""
          >
            <option value="" disabled data-blank="">
              {availLoading ? "…" : labelAddPlaceholder}
            </option>
            {available.map((s) => (
              <option key={s.id} value={s.id} title={s.shortDescription ?? undefined}>
                {pickerOptionText(s.code, s.shortDescription)}
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
            // Slice 41.95: as a group's row — the „×" on the code's rectangle, the description cut after two lines.
            <li key={s.code} className="flex items-baseline gap-2" data-stamp-row="">
              <CodeChip
                data-stamp-code={s.code}
                remove={isOnLatest ? { label: `${labelRemove} ${s.code}`, onClick: () => void handleRemove(s.id), disabled: removing === s.id } : undefined}
              >
                {s.code}
              </CodeChip>
              <RowDescription href={stampFromRecordHref(s.id, withBack)} text={s.shortDescription} lines={2} />
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
  /** 41.45: a person's kind, so the link opens its own screen (peer-href.ts). */
  peerPersonKind?:       PersonKind | null;
  note:                  string | null;
  isOwner:               boolean;
  createdAt:             string;
};


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
                      href={withBack(peerHref(ref.peerType, ref.peerEntityId, ref.peerPersonKind))}
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
        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
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
  // Slice 41.10: „Clasificare" reads and edits as a gray tile, inside a `readEdit` ListTile (its chrome).
  const chrome = useTileChrome();
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const itemsId = useId();
  /** 41.28: the tile's one „i" bubble — each select's description too. */
  const aboutId = `${itemsId}-about`;
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
  // Slice 41.59: the confirmation open — before „Marchează ca verificat" or „Salvează" takes effect.
  const [confirming,      setConfirming]      = useState<"review" | "save" | null>(null);
  const [reviewing,       setReviewing]       = useState(false);
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
    setSaveError(null);
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
      // Slice 41.10: saved, the tile reads again.
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
      setConfirming(null);
    }
  }

  // Slice 41.10: „Editează" opens the three selects on the values as saved; „Renunță" (or Esc) puts them back.
  function startEdit() {
    setLocalImportance(data?.importance ?? "");
    setLocalRelevance(data?.relevance ?? "");
    setLocalProvenance(data?.provenance ?? "");
    setSaveError(null);
    setEditing(true);
    focusFirstField(`[data-classification-items="${itemsId}"]`);
  }
  function cancelEdit() {
    setLocalImportance(data?.importance ?? "");
    setLocalRelevance(data?.relevance ?? "");
    setLocalProvenance(data?.provenance ?? "");
    setSaveError(null);
    setConfirming(null);
    setEditing(false);
  }

  // Slice 41.10 (Ask first 5): with no value at all, on the latest version, the tile folds to one line — as an empty
  // gray tile does (40.64) — „necompletat" and „Adaugă", which opens it. Only inside its frame, which draws the fold.
  const folded =
    showClassification && !!chrome && !!data && isOnLatest && !editing &&
    !data.importance && !data.relevance && !data.provenance;
  const setChromeFolded = chrome?.setFolded;
  const setChromeEditing = chrome?.setEditing;
  // Slice 41.40 — Adrian: „On the “tags and groups” tile we should have the edit functionality triggered by the “pen”
  // button … While the tile is in calm mode … we only have the items". Etichete și grupuri reads at rest — no tag box,
  // no „+", no „×", no „Leagă" — and its pen opens it in edit, where adding and removing still save at once, so the bar
  // is one „Gata" (and Esc). Without a tile around it (both sections drawn on one page) it stays editable as before.
  const [connEditing, setConnEditing] = useState(false);
  const canChange = isOnLatest && (connEditing || !chrome);
  useEffect(() => {
    setChromeFolded?.(folded);
  }, [setChromeFolded, folded]);
  useEffect(() => {
    setChromeEditing?.(editing || connEditing);
  }, [setChromeEditing, editing, connEditing]);

  // ── Display values (local on latest; snapshot on historical) ─────────────

  const displayImportance = isOnLatest ? localImportance : (displayedSnapshot.importance ?? "");
  const displayRelevance  = isOnLatest ? localRelevance  : (displayedSnapshot.relevance  ?? "");
  const displayProvenance = isOnLatest ? localProvenance : (displayedSnapshot.provenance ?? "");

  // ── Mark as reviewed helper ───────────────────────────────────────────────

  // Slice 41.59: the three reviewed as one block — one call stamps all three (was `touchField(field)`, one each).
  async function touchAll() {
    setReviewing(true);
    setSaveError(null);
    try {
      const res = await fetch(apiPath, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "touch-all" }),
      });
      if (res.redirected) throw new Error(t("saveErrorSession"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      setConfirming(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setConfirming(null);
    } finally {
      setReviewing(false);
    }
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
  const markLabels = { mark: t("markReviewed.button"), marking: t("markReviewed.marking"), marked: t("markReviewed.marked"), today: t("markReviewed.today") };
  // Slice 41.59: the block's stamp is the oldest of the three — one never stamped, and it reads as not reviewed.
  const reviewStamp = data ? oldestStamp([data.importanceUpdatedAt, data.relevanceUpdatedAt, data.provenanceUpdatedAt]) : null;
  // What the confirmation lists: the three as they will stand — in edit the chosen ones, a changed one marked.
  const confirmItems = data
    ? [
        { key: "importance", label: t("importance.title"), value: importanceOptions.find((o) => o.value === localImportance)?.label ?? "", changed: editing && localImportance !== (data.importance ?? "") },
        { key: "relevance", label: t("relevance.title"), value: relevanceOptions.find((o) => o.value === localRelevance)?.label ?? "", changed: editing && localRelevance !== (data.relevance ?? "") },
        { key: "provenance", label: t("provenance.title"), value: provenanceLabelMap[localProvenance] ?? "", changed: editing && localProvenance !== (data.provenance ?? "") },
      ]
    : [];

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
          labelBox={t("tags.box")}
          labelAdd={t("tags.add")}
          labelAdding={t("tags.adding")}
          labelRemove={t("tags.remove")}
          labelEmpty={t("tags.empty")}
          editing={canChange}
        />
    ) });
    // ── 5. Grupuri / Groups
    connectionGroups.push({ key: "groups", node: data.principalObjectId ? (
        <InlineGroupsSection
          principalObjectId={data.principalObjectId}
          currentGroups={data.groups}
          mainQueryKey={queryKey}
          isOnLatest={canChange}
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
          isOnLatest={canChange}
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
          isOnLatest={canChange}
          t={(key, opts) => t(key as Parameters<typeof t>[0], opts)}
          withBack={withBack}
        />
    ) });
  }

  // Slice 41.37: Clasificare's one „i" — the three items and the review timeline („Revizuire"), its day counts the
  // settings' own (`tfDays`, as `buildReviewWarning`), never written into the text. Slice 41.94: „Istoric" went from the
  // tile — Adrian: „Remove the History section at the bottom" — and its paragraph from the bubble with it.
  const reviewWarnDays = tfDays(tf, "metadata_review_warning");
  const reviewStaleDays = tfDays(tf, "dashboard_stale_metadata");
  const aboutBubble = (
    <HintBubble
      id={aboutId}
      text={
        <>
          {(["importance", "relevance", "provenance"] as const).map((k) => (
            <span key={k} className="mb-1.5 block">
              <strong className="block font-semibold">{t(`${k}.title`)}</strong>
              {t(`${k}.note`)}
            </span>
          ))}
          <span className="block" data-review-note="">
            <strong className="block font-semibold">{t("review.title")}</strong>
            {t("review.note", { warn: reviewWarnDays, stale: reviewStaleDays })}
          </span>
        </>
      }
      triggerLabel={about(chrome?.title ?? t("sectionClassification"))}
      align={chrome ? "start" : "end"}
    >
      {null}
    </HintBubble>
  );
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
      <div className="flex flex-col gap-4" data-metadata-part={part ?? "both"}>

        {showClassification && (<>
        {/* ── Version nav (only when there are multiple versions) ──────────── */}
        {/* Slice #37.81: the line under it is the shared divider, as the tile's other two are. */}
        {/* Slice 41.28 (Ask first 3, 4): a top line, always drawn — the version controls at its left when there is more
            than one version — and at its right end the tile's ONE „i": Importanță, Relevanță, Proveniență and Istoric,
            each a short headed paragraph. It replaced an „i" on each item's title. The divider stays the version
            line's only. */}
        {/* Slice 41.37 — Adrian: „move the “i” button right after the title of the tile; add to the information message
            some clarification on the timeline for metadata reviews". The one „i" sits on the tile's title line, right
            after „Clasificare" (`TileHint`); its bubble adds „Revizuire", the day counts read from Setări through the
            helper the red warning uses. The top line is the version controls' alone again, drawn only with several
            versions (as before 41.28); without a tile around it (both sections drawn), the „i" stays on that line. */}
        {!folded && chrome && <TileHint>{aboutBubble}</TileHint>}
        {!folded && (totalVer > 1 || !chrome) && (
          <div className="flex items-center gap-2" data-classification-top="">
            {totalVer > 1 && <VersionNavControls nav={navView} labels={navLabels} />}
            {!chrome && <span className="ml-auto">{aboutBubble}</span>}
          </div>
        )}
        {totalVer > 1 && !folded && <Divider />}

        {!part && (
          <h3 className="border-b border-card-rim pb-1 text-xs font-semibold uppercase tracking-wide text-fade dark:border-zinc-700 dark:text-zinc-500">
            {t("sectionClassification")}
          </h3>
        )}

        {/* Slice 41.10: „Editează" in the tile's corner, as on a gray tile — on the latest version, while reading. */}
        {isOnLatest && !editing && !folded && (
          <TileAction>
            <TileEditButton tile="classification" title={chrome?.title ?? t("sectionClassification")} onEdit={startEdit} />
          </TileAction>
        )}

        {folded ? (
          <EmptyTileLine title={chrome!.title} tile="classification" onAdd={startEdit} />
        ) : (
        // Slice 41.10 (Ask first 2): the three values one to a row, label above value; „Editează" turns them into
        // their selects, saved together by „Salvează" under them; Esc is „Renunță". Slice 41.94: in „Editează" a grid
        // of two columns — the labels', the selects' — each item one line across both.
        // Slice 41.94 (Ask first 4) — Adrian: „Place dividers between Importance, Relevance, Provenance and the line
        // with “when it was updated” and the Update button; these dividers are similar to the one above Importance".
        // The version line's Divider between every two items, and under Proveniență when the review line follows it —
        // three in read, two in „Editează" (none above „Salvează").
        <div
          role="group"
          aria-label={chrome?.title ?? t("sectionClassification")}
          className={editing ? "grid grid-cols-[max-content_max-content] gap-x-2 gap-y-2" : "flex flex-col gap-2"}
          data-classification-items={itemsId}
          data-classification-editing={editing ? "" : undefined}
          onKeyDown={onTileKeyDown(editing, cancelEdit)}
        >
        {/* ── 1. Importanță / Importance ──────────────────────────────────── */}
        <ClassificationItem
          item="importance"
          title={t("importance.title")}
          describedBy={aboutId}
          value={displayImportance}
          valueText={importanceOptions.find((o) => o.value === displayImportance)?.label ?? ""}
          editing={editing}
          onChange={setLocalImportance}
          options={importanceOptions}
          statementMap={importanceStatements}
          placeholder={t("importance.placeholder")}
          highlight={highlights.importance}
        />
        <ItemLine />

        {/* ── 2. Relevanță / Relevance ─────────────────────────────────────── */}
        <ClassificationItem
          item="relevance"
          title={t("relevance.title")}
          describedBy={aboutId}
          value={displayRelevance}
          valueText={relevanceOptions.find((o) => o.value === displayRelevance)?.label ?? ""}
          editing={editing}
          onChange={setLocalRelevance}
          options={relevanceOptions}
          statementMap={relevanceStatements}
          placeholder={t("relevance.placeholder")}
          highlight={highlights.relevance}
        />
        <ItemLine />

        {/* ── 3. Proveniență / Provenience ─────────────────────────────────── */}
        <ClassificationItem
          item="provenance"
          title={t("provenance.title")}
          describedBy={aboutId}
          value={displayProvenance}
          valueText={provenanceLabelMap[displayProvenance] ?? ""}
          editing={editing}
          onChange={setLocalProvenance}
          options={provenanceOptions}
          statementMap={provenanceStatements}
          placeholder={t("provenance.placeholder")}
          highlight={highlights.provenance}
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

        </ClassificationItem>

        {/* Slice 41.59 (Ask first 2) — Adrian: „I need to treat all three as one metadata item". One line under the
            three: the oldest stamp's „(actualizat …)" and one „Marchează ca verificat" at its right end, the red
            warning under it. Its press opens the confirmation; the review is its „Confirmă". */}
        {isOnLatest && !editing && <ItemLine />}
        {isOnLatest && !editing && (
          <ClassificationReviewLine
            daysText={buildDaysText(reviewStamp)}
            warning={buildReviewWarning(reviewStamp)}
            today={isUpdatedToday(reviewStamp)}
            labels={markLabels}
            onReview={() => setConfirming("review")}
            confirm={confirming === "review" && (
              <ClassificationConfirm
                heading={t("confirmReview.heading")}
                items={confirmItems}
                changedLabel={t("confirmReview.changed")}
                labelOk={reviewing ? t("markReviewed.marking") : t("confirmReview.ok")}
                labelBack={t("confirmReview.back")}
                busy={reviewing}
                onOk={() => void touchAll()}
                onBack={() => setConfirming(null)}
              />
            )}
          />
        )}
        {isOnLatest && !editing && saveError && (
          <p role="alert" className="px-2 text-xs text-alert">{saveError}</p>
        )}

        {/* Slice 41.94 (Ask first 2): „Istoric" is gone from the tile. entity_provenance_log is still written and the
            API still returns `provenanceHistory`; only its display went. */}

        {editing && (
          // 41.59 (Ask first 3): „Salvează" opens the same confirmation — the save also confirms the three as checked
          // today, the changed ones marked; „Înapoi" keeps the edit open.
          <div className="relative col-span-2">
            <TileEditBar
              tile="classification"
              onSave={() => setConfirming("save")}
              onCancel={cancelEdit}
              saving={saving}
              canSave={isDirty}
              error={saveError}
            />
            {confirming === "save" && (
              <ClassificationConfirm
                placement="above"
                heading={t("confirmReview.heading")}
                note={t("confirmReview.saveNote")}
                items={confirmItems}
                changedLabel={t("confirmReview.changed")}
                labelOk={saving ? t("saving") : t("confirmReview.ok")}
                labelBack={t("confirmReview.back")}
                busy={saving}
                onOk={() => void saveAll()}
                onBack={() => setConfirming(null)}
              />
            )}
          </div>
        )}
        </div>
        )}

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
        {/* 41.40: the pen in the tile's corner at rest; in edit, Esc or „Gata" puts it back at rest. */}
        {chrome && isOnLatest && !connEditing && (
          <TileAction>
            <TileEditButton tile="connections" title={chrome.title} onEdit={() => setConnEditing(true)} />
          </TileAction>
        )}
        <div
          className="flex flex-col gap-2"
          data-connections-groups=""
          data-connections-calm={chrome && !connEditing ? "" : undefined}
          onKeyDown={onTileKeyDown(connEditing, () => setConnEditing(false))}
        >
          {connectionGroups.map((group, i) => (
            <Fragment key={group.key}>
              {i > 0 && <Divider />}
              {group.node}
            </Fragment>
          ))}
        </div>
        {chrome && connEditing && (
          <div className="flex justify-end pt-1" data-tile-edit-bar="connections">
            <IconButton icon={Check} label={t("done")} showLabel variant="secondary" size="sm" onClick={() => setConnEditing(false)} data-tile-done="connections" />
          </div>
        )}
        </>)}
      </div>
    </>
  );
}
