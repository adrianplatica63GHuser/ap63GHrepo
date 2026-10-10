"use client";

/**
 * One line a row.                                                  (Slice #37.64)
 *
 * Adrian: „the intent is to keep each row in any of these tiles to one line
 * only". A row is a radio button, one content field and its buttons, side by
 * side, never wrapping:
 *
 *   ◉  Popescu Ion (Vânzător)…                 [Cotă] [→] [👁]
 *   ○  Ionescu Maria (Proiectant / Consultant)        [→] [👁]
 *
 *  - **The content is cut with „…" and shown whole on hover** (`title`), as
 *    #37.58 did for a property's name. It is ONE field: the caller decides what
 *    it reads („Nume (Rol)", a property's name, „Etichetă scurtă (Tip)").
 *  - **Every button sits in a slot of a fixed width** (`ROW_SLOT_REM`), and the
 *    LIST decides the slots, not the row: a row without a button leaves that
 *    slot empty, so the buttons stand in the same place on every row and line
 *    up down the tile. #37.65's merged tile is one list of four kinds of row
 *    with one set of slots.
 *  - **No heading row.** The tile's title says what the list is; the content
 *    says what each row is.
 *  - **A click inside the buttons is the button's, never the row's.** The row's
 *    own click selects it, its double-click opens the record, a Ctrl/⌘+click or
 *    a middle-click opens it in a new tab (#37.21, #37.24) — none of which may
 *    also fire when „Cotă" is pressed or its panel typed into. Before this
 *    slice a middle-click on „Vizualizare" opened the record twice: once by the
 *    link, once by the row.
 *
 * Its widths come from `field-widths.ts` (the slots, the radio, the gaps), so
 * the tile's units can be worked out from the same numbers (`oneLineRowUnits`).
 */

import type { ComponentType, MouseEvent, ReactNode } from "react";
import { createContext, useContext } from "react";
import type { LucideProps } from "lucide-react";
import { ROW_SELECT_REM, ROW_SLOT_REM, rem, type RowSlot } from "@/lib/ui/field-widths";

const SlotsContext = createContext<readonly RowSlot[]>([]);

/** The frame of a tile's rows; `slots` are the button slots every row has, in order. */
export function OneLineRows({
  slots,
  label,
  bare = false,
  children,
}: {
  slots: readonly RowSlot[];
  /** The list's accessible name (the tile's title, or its group's). */
  label: string;
  /**
   * No frame of its own (#37.65): one group of „Corelate"'s rows, inside the
   * tile's one frame, with the others.
   */
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <SlotsContext.Provider value={slots}>
      <ul
        aria-label={label}
        data-one-line-rows=""
        className={bare ? undefined : "rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900"}
      >
        {children}
      </ul>
    </SlotsContext.Provider>
  );
}

/** Stops a press on a row's buttons from also being the row's click. */
const keep = (e: MouseEvent) => e.stopPropagation();

export function OneLineRow({
  selected,
  onSelect,
  radioLabel,
  icon: Icon,
  kindLabel,
  content,
  title,
  buttons,
  onClick,
  onAuxClick,
  onDoubleClick,
  ...data
}: {
  selected: boolean;
  /**
   * Selects the row. Slice #38.76: absent, the row is a look, not a choice — no radio is drawn (the read-only
   * „Legături" beside a list, where a selection would lead to nothing but „Dezasociază").
   */
  onSelect?: () => void;
  /** The radio's accessible name — what the row is, for a screen reader. */
  radioLabel: string;
  /** The icon of the row's kind, after the radio (#37.65). Decoration: the kind is `kindLabel`. */
  icon?: ComponentType<LucideProps>;
  /** The row's kind in words, for a screen reader (#37.65): „Persoană fizică", „Act". */
  kindLabel?: string;
  /** The one content field. */
  content: ReactNode;
  /** The content as plain text: shown whole on hover. */
  title: string;
  /** The row's buttons, by slot. A slot the row leaves out stays empty. */
  buttons: Partial<Record<RowSlot, ReactNode>>;
  onClick: (e: MouseEvent<HTMLLIElement>) => void;
  onAuxClick: (e: MouseEvent<HTMLLIElement>) => void;
  onDoubleClick: () => void;
  /** `data-*` marks for the specs (`data-share`, `data-kind`). */
  [dataAttribute: `data-${string}`]: string | undefined;
}) {
  const slots = useContext(SlotsContext);
  return (
    <li
      {...data}
      data-one-line-row=""
      onClick={onClick}
      onAuxClick={onAuxClick}
      onDoubleClick={onDoubleClick}
      className={[
        "flex cursor-pointer items-center gap-2 whitespace-nowrap border-b border-card-rim px-2 py-1 text-sm last:border-0 dark:border-zinc-800",
        selected ? "bg-cta-pale dark:bg-cta/10" : "hover:bg-canvas dark:hover:bg-zinc-800/50",
      ].join(" ")}
    >
      {onSelect && (
        <span className="inline-flex shrink-0 justify-center" style={{ width: rem(ROW_SELECT_REM) }}>
          <input
            type="radio"
            checked={selected}
            onChange={onSelect}
            onClick={keep}
            className="accent-cta"
            aria-label={radioLabel}
          />
        </span>
      )}
      {Icon && <Icon size={16} aria-hidden="true" className="shrink-0 text-fade dark:text-zinc-400" />}
      {kindLabel && <span className="sr-only">{kindLabel}: </span>}
      <span data-row-content="" className="min-w-0 flex-1 truncate" title={title}>
        {content}
      </span>
      {/* `div`s, not `span`s: a slot may hold a block (the share panel, a bubble). */}
      <div
        className="flex shrink-0 items-center gap-1"
        onClick={keep}
        onAuxClick={keep}
        onDoubleClick={keep}
      >
        {slots.map((slot) => (
          <div
            key={slot}
            data-slot={slot}
            className="relative flex justify-center"
            style={{ width: rem(ROW_SLOT_REM[slot]) }}
          >
            {buttons[slot] ?? null}
          </div>
        ))}
      </div>
    </li>
  );
}
