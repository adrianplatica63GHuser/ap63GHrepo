"use client";

/**
 * „Arată N câmpuri goale": a partly filled form tile's empty fields, hidden behind one link.         (Slice 40.71)
 *
 * The rule is `emptyFieldsToHide` (src/lib/ui/empty-fields.ts). A form computes, tile by tile, which paths hide, gives
 * the union to `HiddenFieldsContext`, and ends each tile with `EmptyFieldsLink`. Each field component reads its own
 * name with `useFieldHidden` and draws itself with `hiddenFieldStyle` — `display: none` inline, which wins over the
 * field's own display class.
 *
 * ⚠️ **THE FIELDS STAY MOUNTED**, as under 40.64's one line: react-hook-form keeps every registration, a version's
 * `form.reset` still reaches the boxes, and nothing is lost by a field hiding.
 *
 * Nothing hides on a new record, in a tile a version marks a field in (the pulse must be seen), in a tile with a field
 * in error, or in a tile whose link was pressed: once opened, a tile stays open until the record is left.
 *
 * The link is a `span` with the button role, not a `<button>`: a read-only view draws the form inside a disabled
 * `<fieldset>`, which would disable a button — and showing the empty fields changes nothing on the record.
 */
import { createContext, useCallback, useContext, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { emptyFieldsToHide } from "@/lib/ui/empty-fields";

export const HiddenFieldsContext = createContext<ReadonlySet<string>>(new Set());

/** Whether the field `name` is hidden behind its tile's link. */
export function useFieldHidden(name: string): boolean {
  return useContext(HiddenFieldsContext).has(name);
}

/** A field's outer element's style: `display: none` when hidden, inline so it wins over the field's display class. */
export function hiddenFieldStyle(hidden: boolean, style?: CSSProperties): CSSProperties | undefined {
  return hidden ? { ...style, display: "none" } : style;
}

export type EmptyFields = {
  /** The paths of `tile` to hide; none when `whole` (a pulse or an error in the tile) or the tile was opened. */
  hide: (tile: string, paths: readonly string[], whole?: boolean) => string[];
  /** Shows every field of `tile` for the rest of the visit. */
  show: (tile: string) => void;
};

export function useEmptyFields({
  active,
  loaded,
  now,
  defaults,
  always,
}: {
  /** False on a new record: nothing hides. */
  active: boolean;
  loaded: unknown;
  now: unknown;
  defaults?: unknown;
  always: readonly string[];
}): EmptyFields {
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const hide = useCallback(
    (tile: string, paths: readonly string[], whole = false): string[] =>
      !active || whole || opened.has(tile) ? [] : emptyFieldsToHide({ paths, always, loaded, now, defaults }),
    [active, opened, always, loaded, now, defaults],
  );
  const show = useCallback((tile: string) => {
    setOpened((prev) => (prev.has(tile) ? prev : new Set(prev).add(tile)));
  }, []);
  return { hide, show };
}

/**
 * The link at the foot of a tile: „Arată 4 câmpuri goale", then the hidden fields' names in grey on one line, ending
 * in „…" where they do not fit — all of them in the tooltip. Nothing when nothing is hidden.
 */
export function EmptyFieldsLink({ tile, labels, onShow }: { tile: string; labels: readonly string[]; onShow: () => void }) {
  const t = useTranslations("shared.emptyFields");
  if (labels.length === 0) return null;
  const names = labels.join(", ");
  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onShow();
    }
  };
  return (
    // `w-0 min-w-full`, as the tiles' subtitles (tile-title.tsx): the line takes its tile's width and gives it none — a
    // tile sized by its content (a property's „Identificare cadastrală", a document's frame) never widens for the names,
    // which TC-TILES-07 found pushing „Hartă" under it at 1366 px.
    <div className="flex w-0 min-w-full items-baseline gap-2 pt-1 text-sm" data-empty-fields={tile} data-empty-fields-count={labels.length}>
      <span
        role="button"
        tabIndex={0}
        onClick={onShow}
        onKeyDown={onKeyDown}
        title={t("all", { names })}
        className="shrink-0 cursor-pointer text-bl-strong underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none dark:text-blue-300"
        data-empty-fields-show=""
      >
        {t("show", { count: labels.length })}
      </span>
      <span className="min-w-0 truncate text-fade dark:text-zinc-400" title={names} data-empty-fields-names="">
        {names}
      </span>
    </div>
  );
}
