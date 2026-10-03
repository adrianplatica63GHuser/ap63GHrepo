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
 *    with no rows draws nothing; a thin line between two groups; no heading
 *    over them — the icon tells the kind (`RELATED_ICON`, the record
 *    headings' icons, #37.49), and its word is read to a screen reader.
 *  - **One slot set.** `RELATED_SLOTS` for every group, so „Cotă", the
 *    relationship, „Vizualizare" and „Previzualizare" stand in the same place
 *    down the whole tile, across the four groups.
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
 */

import { Building2, FileText, Link as LinkIcon, Map as MapIcon, Unlink, User, type LucideProps } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { OneLineRow, OneLineRows } from "@/components/tiles/one-line-rows";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { IconButton } from "@/lib/ui/icon-button";
import { RELATED_SLOTS, type RowSlot } from "@/lib/ui/field-widths";
import { newTabIfAsked } from "@/lib/ui/row-link";

export type RelatedKind = "natural" | "judicial" | "property" | "document";

/** The groups, in Adrian's order. */
export const RELATED_KINDS: readonly RelatedKind[] = ["natural", "judicial", "property", "document"];

/** The record headings' icons (#37.49, `src/lib/ui/record-heading.tsx`). */
export const RELATED_ICON: Record<RelatedKind, ComponentType<LucideProps>> = {
  natural: User,
  judicial: Building2,
  property: MapIcon,
  document: FileText,
};

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
  /** `data-*` marks for the specs (`data-share`). */
  data?: { [k: `data-${string}`]: string | undefined };
  /** Remove this row's link, through the route its kind uses; throws with the reason. */
  dissociate: () => Promise<void>;
}

export interface RelatedAssociate {
  label: string;
  onClick: () => void;
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

export function RelatedTile({
  label,
  rows,
  loading,
  associate,
  belowRows,
  extraButtons,
  underButtons,
}: {
  /** The tile's title — the rows' accessible name. */
  label: string;
  /** Every row, any kind, each kind in the screen's own order. */
  rows: readonly RelatedRow[];
  /** A list has not arrived yet. */
  loading: boolean;
  /** The „Asociază …" buttons, in order. */
  associate: readonly RelatedAssociate[];
  /** Under the rows, above the buttons: totals, each list's messages. */
  belowRows?: ReactNode;
  /** After the buttons, in their row („Înscrisuri citate"). */
  extraButtons?: ReactNode;
  /** Under the buttons (the panel „Înscrisuri citate" unfolds). */
  underButtons?: ReactNode;
}) {
  const t = useTranslations("shared.related");
  const { guardedNavigate } = useUnsavedChanges();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dissociating, setDissociating] = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  // A row that has gone (removed here, or on another screen) is no longer selected.
  const selected = rows.find((r) => r.key === selectedKey) ?? null;
  const groups = RELATED_KINDS
    .map((kind) => ({ kind, rows: rows.filter((r) => r.kind === kind) }))
    .filter((g) => g.rows.length > 0);

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
      {loading ? (
        <p className="py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
      ) : groups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("empty")}</p>
      ) : (
        <div
          role="group"
          aria-label={label}
          data-related-rows=""
          className="rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          {groups.map((g, i) => (
            <div
              key={g.kind}
              data-related-group={g.kind}
              // The thin line between two groups — no heading: the icon tells the kind.
              className={i > 0 ? "border-t border-wire dark:border-zinc-600" : undefined}
            >
              <OneLineRows slots={RELATED_SLOTS} label={groupLabel(t, g.kind)} bare>
                {g.rows.map((row) => {
                  const isSelected = row.key === selected?.key;
                  return (
                    <OneLineRow
                      key={row.key}
                      {...row.data}
                      data-kind={row.kind}
                      selected={isSelected}
                      onSelect={() => setSelectedKey(row.key)}
                      radioLabel={row.radioLabel}
                      icon={RELATED_ICON[row.kind]}
                      kindLabel={kindLabel(t, row.kind)}
                      content={row.content}
                      title={row.title}
                      buttons={row.buttons}
                      // Slice #37.21: Ctrl/⌘+click or a middle-click opens the record in a new tab.
                      onClick={(e) => {
                        if (newTabIfAsked(e, row.href)) return;
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

      {belowRows}

      <div className="flex flex-col gap-2">
        {/* At `sm`: the three „Asociază …" and „Dezasociază" stand in one row in the
            tile's 4 units (563 px of the 610 inside, measured); at `lg` they took two rows. */}
        <div className="flex flex-wrap gap-2">
          {associate.map((a) => (
            <IconButton
              key={a.label}
              icon={LinkIcon}
              label={a.label}
              showLabel
              variant="primary"
              size="sm"
              onClick={a.onClick}
              disabled={selected !== null}
            />
          ))}
          <IconButton
            icon={Unlink}
            label={t("dissociate")}
            busy={dissociating}
            busyLabel={t("dissociating")}
            showLabel
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
    </div>
  );
}
