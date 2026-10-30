"use client";

/**
 * „Corelate" — everything a record is related to, in ONE tile.   (Slice #37.65)
 *
 * Adrian: „Under this we will have in order natural person juridical person
 * properties and documents; each row will have a radio button, an icon which
 * matches the type of row, a content area, and a few buttons as is applicable —
 * and all of this must take exactly one line".
 *
 * The screen hands it the rows of each kind (#37.64's one-line rows, built by
 * the screen's own hooks: the content, the share and relationship buttons,
 * „Vizualizare", „Previzualizare") and what each kind's link is removed with.
 * This component owns what is the same on every screen:
 *
 *  - **The order and the groups.** Natural persons, judicial persons,
 *    properties, documents; within a group, the order the screen gave. A group
 *    with no rows draws nothing. Slice 40.65 (Adrian's Option A, overturning
 *    #37.65's „no heading"): each group opens with a slim heading — the
 *    sidebar's name for the kind, and its count on the right — where a thin
 *    line used to stand between two groups. The icon still marks each row
 *    (`RELATED_ICON`), and its word is read to a screen reader.
 *  - **The role as a tag** (40.65): a row's role is a small neutral tag at the
 *    content's right edge, not „(Rol)" after the name, so the tags line up and a
 *    long name is cut before its role is. The brackets are still in the row's
 *    text, visually hidden, so a screen reader and a copy read „Nume (Rol)".
 *  - **One slot set.** `RELATED_SLOTS` for every group, so „Cotă", the
 *    relationship, „Vizualizare" and „Previzualizare" stand in the same place
 *    down the whole tile, across the four groups. Slice 41.09: of those, the
 *    ones a row fills (`usedSlots`) — an empty one's room is the names'.
 *  - **One selection.** One row selected at a time, whatever its kind; one
 *    „Dezasociază", which removes the selected row's link through what its
 *    kind's row gave (`dissociate`: the route that kind uses today). The
 *    „Asociază …" buttons are not offered while a row is selected, as before.
 *  - **The row's clicks**, as #37.21/#37.24 made them: a click selects, a
 *    double-click opens the record read-only through the unsaved-changes
 *    guard, a Ctrl/⌘+click or a middle-click opens it in a new tab.
 *
 * What stays under the rows (the share totals, each list's errors) and what
 * stands after the buttons („Înscrisuri citate") are the screen's, passed in.
 * #37.66 (the Property) and #37.67 (the two persons) use this same tile.
 *
 * Slice #38.76 — `readOnly`: the chain link on a list row shows this tile beside the list, A LOOK, NOT AN EDIT
 * (as an Incursiune, #38.72). The same rows, the same groups and icons, the same green — and none of what writes:
 * no radio and so no selection, no „Asociază …", no „Dezasociază", no share control (the `share` slot, whose
 * „Cotă" opens its values to edit), nothing under the rows or after the buttons (the totals, the lists' errors,
 * „Înscrisuri citate"). „Relația" stays: it is a bubble that shows a sentence and writes nothing. „Vizualizare"
 * and a double-click (Ask first #3) open the record read-only through the guard; „Previzualizare" is locked by
 * the open Incursiune (#38.72). The screen's own hooks still build the rows: no fork.
 *
 * Slice #39.25 — and no „Previzualizare" at all: it was drawn disabled, and Adrian asked for it gone, not greyed.
 * Read-only rows have the two slots they can fill (`RELATED_READONLY_SLOTS`): „Relația" and „Vizualizare".
 */

import { Link as LinkIcon, Unlink, type LucideProps } from "lucide-react";
import { ENTITY_ICON } from "@/lib/ui/entity-icon";
import { useState, type ComponentType, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { OneLineRow, OneLineRows } from "@/components/tiles/one-line-rows";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { IconButton } from "@/lib/ui/icon-button";
import { RELATED_READONLY_SLOTS, RELATED_SLOTS, type RowSlot } from "@/lib/ui/field-widths";
import { newTabIfAsked } from "@/lib/ui/row-link";
import { RELATED_ROWS_SURFACE } from "@/lib/ui/tile-surface";
import { partyGroupOrder } from "@/lib/documents/sale-parties";

export type RelatedKind = "natural" | "judicial" | "property" | "document";

/** The groups, in Adrian's order. */
export const RELATED_KINDS: readonly RelatedKind[] = ["natural", "judicial", "property", "document"];

/** The record headings' icons (#37.49) — since 40.61 the one mark of each kind, `ENTITY_ICON` (src/lib/ui/entity-icon.ts). */
export const RELATED_ICON: Readonly<Record<RelatedKind, ComponentType<LucideProps>>> = ENTITY_ICON;

export interface RelatedRow {
  /** Unique across the tile: the kind and the LINK (a person may hold two roles). */
  key: string;
  kind: RelatedKind;
  radioLabel: string;
  /** The one content field, and the same as plain text for the hover. */
  content: ReactNode;
  title: string;
  buttons: Partial<Record<RowSlot, ReactNode>>;
  /** The record, read-only: a double-click opens it, a Ctrl/⌘+click or a middle-click in a new tab. */
  href: string;
  /** Slice #38.33: the row's group when the tile groups by role („Părți") — the role's name, or none. */
  group?: string | null;
  /** Slice 40.65: the row's role, drawn as a tag at the content's right edge (`RoleTag`); none, no tag. */
  role?: string | null;
  /** `data-*` marks for the specs (`data-share`). */
  data?: { [k: `data-${string}`]: string | undefined };
  /** Remove this row's link, through the route its kind uses; throws with the reason. */
  dissociate: () => Promise<void>;
}

export interface RelatedAssociate {
  label: string;
  /** Slice 40.96: the kind it associates — its icon (`ENTITY_ICON`) stands after the chain. */
  kind: RelatedKind;
  onClick: () => void;
}

/**
 * Slice 40.96: the record's name in a row, a link that opens it (Adrian: „the open button disappears and is replaced
 * by having the name of the object as a link"). A plain click opens it as „Vizualizare" did — read-only, through the
 * unsaved-changes guard — and does not select the row; Ctrl/⌘+click, Shift+click and a middle-click are the
 * browser's, a new tab (`RowNameLink`'s, 40.60). A click elsewhere on the row still selects it for „Dezasociază".
 */
function RelatedNameLink({ href, onOpen, children }: { href: string; onOpen: () => void; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onOpen();
      }}
      onAuxClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="rounded-sm text-inherit no-underline underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
      data-row-name-link=""
    >
      {children}
    </a>
  );
}

/** Every key a literal — the copy suites find a component's keys by reading its source. */
function groupLabel(t: (key: string) => string, kind: RelatedKind): string {
  switch (kind) {
    case "natural":  return t("group.natural");
    case "judicial": return t("group.judicial");
    case "property": return t("group.property");
    case "document": return t("group.document");
  }
}

function kindLabel(t: (key: string) => string, kind: RelatedKind): string {
  switch (kind) {
    case "natural":  return t("kind.natural");
    case "judicial": return t("kind.judicial");
    case "property": return t("kind.property");
    case "document": return t("kind.document");
  }
}

/**
 * Slice 40.65: the role, a small neutral tag. Its brackets are in the text but visually hidden, so the row reads
 * „Nume (Rol)" to a screen reader and to `textContent`, as it did when they were on screen.
 */
export function RoleTag({ role }: { role: string }) {
  return (
    <span
      data-row-role=""
      data-role-shown="role"
      className="ml-auto max-w-[10rem] shrink-0 truncate rounded-full border border-wire bg-card px-2 text-xs leading-5 text-ink dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
      title={role}
    >
      <span className="sr-only"> (</span>
      {role}
      <span className="sr-only">)</span>
    </span>
  );
}

/**
 * Slice 41.09 — the slots a tile's rows fill, in the list's order. Adrian, 2026-10-29: „I see some wasted space … between
 * the name of the object and the buttons … give more space to the name of the object so it fills the empty room". The
 * name was already the row's flexible part (`flex-1`); the room was a SLOT no row filled — „Cotă" (72 px) on every
 * person's and property's „Legături", where nothing holds a share, and „Relația" where no row has one — kept empty on
 * every row so the buttons line up (#37.64). A slot no row fills lines nothing up: it goes, and its room is the names'.
 * A slot one row fills stays on every row, so the buttons still stand in one column down the tile (#37.65). The tile's
 * units do not change (`RELATED_UNITS`, worked out for the fullest row).
 */
export function usedSlots(all: readonly RowSlot[], buttons: readonly RelatedRow["buttons"][]): RowSlot[] {
  return all.filter((slot) => buttons.some((b) => b[slot] !== undefined && b[slot] !== null && b[slot] !== false));
}

/** Slice 40.65: a kind group's heading — the kind's name, and its count on the right in tabular figures. */
export const RELATED_HEADING_CLASS =
  "flex items-baseline justify-between gap-2 px-3 pb-0.5 pt-2 font-colhead text-xs font-normal tracking-[0.02em] text-label";

export function RelatedTile({
  label,
  rows,
  loading,
  associate,
  aboveRows,
  belowRows,
  extraButtons,
  underButtons,
  groupByRole,
  emptyLabel,
  readOnly = false,
}: {
  /** The tile's title — the rows' accessible name. */
  label: string;
  /** Every row, any kind, each kind in the screen's own order. */
  rows: readonly RelatedRow[];
  /** A list has not arrived yet. */
  loading: boolean;
  /** The „Asociază …" buttons, in order. */
  associate: readonly RelatedAssociate[];
  /**
   * Slice #39.48: above the rows — on a document's „Legături", the line saying its
   * parties are in „Părți". Not drawn read-only.
   */
  aboveRows?: ReactNode;
  /** Under the rows, above the buttons: totals, each list's messages. */
  belowRows?: ReactNode;
  /** After the buttons, in their row („Înscrisuri citate"). */
  extraButtons?: ReactNode;
  /** Under the buttons (the panel „Înscrisuri citate" unfolds). */
  underButtons?: ReactNode;
  /**
   * Slice #38.33: group the rows by role, each group headed by its role's name,
   * in `partyGroupOrder` — „Părți" lists Vânzător, then Cumpărător. Absent, the
   * rows group by kind as they always have.
   */
  groupByRole?: boolean;
  /** What an empty tile says, in place of „Nimic corelat încă.". */
  emptyLabel?: string;
  /** Slice #38.76: a look, not an edit — see above. */
  readOnly?: boolean;
}) {
  const t = useTranslations("shared.related");
  const { guardedNavigate } = useUnsavedChanges();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dissociating, setDissociating] = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  // A row that has gone (removed here, or on another screen) is no longer selected.
  const selected = rows.find((r) => r.key === selectedKey) ?? null;
  const groups: { kind: string; heading: string | null; rows: RelatedRow[] }[] = groupByRole
    ? partyGroupOrder(rows.map((r) => r.group ?? null)).map((role) => ({
        kind: `role:${role ?? ""}`,
        heading: role ?? t("noRole"),
        rows: rows.filter((r) => (r.group ?? null) === role),
      }))
    : RELATED_KINDS
        .map((kind) => ({ kind: kind as string, heading: null, rows: rows.filter((r) => r.kind === kind) }))
        .filter((g) => g.rows.length > 0);
  // Slice 41.09: the slots the rows fill — one set for every group still, so the buttons line up down the tile.
  const slots = usedSlots(
    readOnly ? RELATED_READONLY_SLOTS : RELATED_SLOTS,
    rows.map((r) => (readOnly ? readOnlyButtons(r.buttons) : r.buttons)),
  );

  const handleDissociate = async () => {
    if (!selected) return;
    setDissociating(true);
    setDissociateErr(null);
    try {
      await selected.dissociate();
      setSelectedKey(null);
    } catch (err) {
      setDissociateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setDissociating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {readOnly ? null : aboveRows}
      {/* Slice #39.25: read-only, beside a list, the sentence is one line with no padding of its own — as
          „Interacțiuni"'s is — so an empty tile is its row's preview's height (`rowTileStyle`), not 26 px taller. */}
      {loading ? (
        <p className={readOnly ? "text-sm text-fade dark:text-zinc-400" : "py-6 text-sm text-fade dark:text-zinc-400"}>{t("loading")}</p>
      ) : groups.length === 0 ? (
        <p className={readOnly ? "text-sm text-fade dark:text-zinc-400" : "px-4 py-6 text-sm text-fade dark:text-zinc-400"} data-related-empty="">
          {emptyLabel ?? t("empty")}
        </p>
      ) : (
        <div
          role="group"
          aria-label={label}
          data-related-rows=""
          // Slice #38.15: the rows on their own, calmer green, inside the tile's stronger one.
          className={RELATED_ROWS_SURFACE}
        >
          {groups.map((g, i) => (
            <div
              key={g.kind}
              data-related-group={g.kind}
              // Slice 40.65: a kind group opens with its heading, so the thin line between groups is gone; „Părți"'s
              // role groups (#38.33) keep theirs.
              className={groupByRole && i > 0 ? "border-t border-wire dark:border-zinc-600" : undefined}
            >
              {/* Slice 40.65: a kind group's heading — the sidebar's name for the kind, and how many rows. */}
              {g.heading === null && (
                <h3 className={RELATED_HEADING_CLASS} data-related-heading={g.kind}>
                  <span>{groupLabel(t, g.kind as RelatedKind)}</span>
                  <span className="tabular-nums" data-related-count="">{g.rows.length}</span>
                </h3>
              )}
              {/* Slice #38.33: a role group is headed by its role. 40.95: in the header's navy, as the kind headings; the
                  rows, roles included, stay ink. */}
              {g.heading !== null && (
                <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-label" data-party-group-heading="">
                  {g.heading}
                </p>
              )}
              <OneLineRows slots={slots} label={g.heading ?? groupLabel(t, g.kind as RelatedKind)} bare>
                {g.rows.map((row) => {
                  const isSelected = row.key === selected?.key;
                  return (
                    <OneLineRow
                      key={row.key}
                      {...row.data}
                      data-kind={row.kind}
                      selected={isSelected}
                      onSelect={readOnly ? undefined : () => setSelectedKey(row.key)}
                      radioLabel={row.radioLabel}
                      icon={RELATED_ICON[row.kind]}
                      kindLabel={kindLabel(t, row.kind)}
                      content={<RelatedNameLink href={row.href} onOpen={() => guardedNavigate(row.href)}>{row.content}</RelatedNameLink>}
                      // 40.96: the row's buttons quiet at rest, full on the row under the mouse, as on the lists (40.60).
                      quiet
                      title={row.title}
                      tag={row.role ? <RoleTag role={row.role} /> : undefined}
                      buttons={readOnly ? readOnlyButtons(row.buttons) : row.buttons}
                      // Slice #37.21: Ctrl/⌘+click or a middle-click opens the record in a new tab.
                      onClick={(e) => {
                        if (newTabIfAsked(e, row.href)) return;
                        if (readOnly) return;
                        setSelectedKey(isSelected ? null : row.key);
                      }}
                      onAuxClick={(e) => newTabIfAsked(e, row.href)}
                      onDoubleClick={() => guardedNavigate(row.href)}
                    />
                  );
                })}
              </OneLineRows>
            </div>
          ))}
        </div>
      )}

      {readOnly ? null : (
        <>
          {belowRows}

          <div className="flex flex-col gap-2">
            {/* At `sm`: the three „Asociază …" and „Dezasociază" stand in one row in the
                tile's 4 units (563 px of the 610 inside, measured); at `lg` they took two rows. */}
            <div className="flex flex-wrap gap-2">
              {/* 40.96: icons only, the words their name and tooltip — the chain and the kind's own icon; „Dezasociază"
                  the chain and the broken chain. */}
              {associate.map((a) => (
                <IconButton
                  key={a.label}
                  icon={LinkIcon}
                  secondIcon={ENTITY_ICON[a.kind]}
                  label={a.label}
                  variant="primary"
                  size="sm"
                  onClick={a.onClick}
                  disabled={selected !== null}
                  data-associate={a.kind}
                />
              ))}
              <IconButton
                icon={LinkIcon}
                secondIcon={Unlink}
                label={t("dissociate")}
                busy={dissociating}
                busyLabel={t("dissociating")}
                variant="secondary"
                size="sm"
                onClick={handleDissociate}
                disabled={selected === null || dissociating}
              />
              {extraButtons}
            </div>
            {dissociateErr && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">{dissociateErr}</p>
            )}
          </div>

          {underButtons}
        </>
      )}
    </div>
  );
}

/**
 * Slice #38.76: a read-only row's buttons — every slot but `share`, whose „Cotă" opens its values to edit.
 * Slice #39.25: and but `preview`, which was only ever drawn disabled there (was `withoutShare`).
 */
// 40.96: no row has a „Vizualizare" any more — the name is the link — so a read-only row keeps „Relația" alone.
export function readOnlyButtons(buttons: RelatedRow["buttons"]): RelatedRow["buttons"] {
  const { share: _share, preview: _preview, view: _view, ...rest } = buttons;
  void _share;
  void _preview;
  void _view;
  return rest;
}
