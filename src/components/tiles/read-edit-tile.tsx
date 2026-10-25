"use client";

/**
 * A record's form tile, read as text, with „Editează" in its corner.                                  (Slice 40.72)
 *
 * On a saved record each form tile shows its values as text — the label small and muted above (40.56's), the value
 * below — and an „Editează" button in the tile's corner turns only that tile into its form, outlined in blue, with
 * „Salvează" and „Renunță" under it. „Salvează" saves that tile's fields and makes one version. A new record is still
 * one form with one Save. The Natural Person is the first screen to use it (40.72); the Judicial Person, the Property
 * and the Document reuse it (40.73–40.75).
 *
 * The pieces, each small so a form can place them where its tiles already are:
 *   - `ReadModeContext` / `useFieldRead(name)`: whether a field is read as text, and its value. A form provides it
 *     once; its field components ask it by name, as they ask 40.71's `useFieldHidden`.
 *   - `ReadValue`: the value as text, in a box as wide as the field's own (`data-width-field` kept), so a tile reads
 *     at the width it edits at and the layout's width checks still measure it.
 *   - `useTileEditing`: which tile is open. One at a time; opening another while the open one has changes asks
 *     through the unsaved-changes guard (save, discard, stay), with none it simply closes the first; Esc is
 *     „Renunță", through the guard when changed.
 *   - `TileEditButton` (the corner) and `TileEditBar` („Salvează", „Renunță"), and `TILE_EDITING_CLASS` (the outline).
 */
import { createContext, useCallback, useContext, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Save, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { focusFirstField } from "@/components/tiles/empty-tile";

// ---- reading -----------------------------------------------------------------------------------------------------

export type ReadMode = {
  /** The field `name` is read as text — its tile is not the one open. */
  reading: (name: string) => boolean;
  /** The field's value now. */
  value: (name: string) => unknown;
};

const NOT_READING: ReadMode = { reading: () => false, value: () => undefined };

export const ReadModeContext = createContext<ReadMode>(NOT_READING);

/** Whether the field `name` is read as text, and its value. Outside a reading form: never. */
export function useFieldRead(name: string): { reading: boolean; value: unknown } {
  const mode = useContext(ReadModeContext);
  const reading = mode.reading(name);
  return { reading, value: reading ? mode.value(name) : undefined };
}

/** „2026-10-25" → „25.10.2026"; anything else as it is. */
export function readDate(value: unknown): string {
  const s = typeof value === "string" ? value.trim() : "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
}

/** A value as the read view writes it: blank → "", a date as dd.mm.yyyy, the rest trimmed. */
export function readText(value: unknown, kind: "text" | "date" = "text"): string {
  if (value === null || value === undefined) return "";
  if (kind === "date") return readDate(value);
  return String(value).trim();
}

/** The value box: the field box's own height and padding, no border, no fill — 40.56's calm field at rest. */
export const READ_VALUE_CLASS =
  "min-h-[1.875rem] rounded-md px-2 py-1 text-sm text-ink whitespace-pre-wrap break-words dark:text-zinc-100";

/**
 * The value as text. `style` is the field box's (its width); `name` and `kind` keep the width checks' marks.
 * An empty value reads „—", muted.
 */
export function ReadValue({
  name,
  kind,
  text,
  style,
  className = "",
}: {
  name: string;
  kind: string;
  text: string;
  style?: CSSProperties;
  /** The version ring, when the field carries one. */
  className?: string;
}) {
  return (
    // `data-no-tile-drag`: a press on a value is a press on a field, which never grabs its tile (#37.76).
    <div className={`${READ_VALUE_CLASS} ${className}`.trim()} style={style} data-width-field={name} data-width-kind={kind} data-read-value={name} data-no-tile-drag="">
      {text === "" ? <span className="text-fade dark:text-zinc-500">—</span> : text}
    </div>
  );
}

// ---- editing ------------------------------------------------------------------------------------------------------

export type TileEditing<T extends string> = {
  /** The tile open for editing, or none. */
  open: T | null;
  /** „Editează": opens `tile`, the focus in the first field inside `selector`. Through the guard when another is changed. */
  edit: (tile: T, selector: string) => void;
  /** „Renunță" pressed: puts the open tile back and closes it. */
  cancel: () => void;
  /** Esc in the open tile: „Renunță", through the guard when changed. */
  escape: () => void;
  /** Closes the open tile with nothing put back — after it was saved. */
  close: () => void;
};

export function useTileEditing<T extends string>({
  dirty,
  discard,
}: {
  /** The open tile has changes. */
  dirty: boolean;
  /** Puts the record's values back as saved. */
  discard: () => void;
}): TileEditing<T> {
  const [open, setOpen] = useState<T | null>(null);
  const { guardedAction } = useUnsavedChanges();
  const edit = useCallback(
    (tile: T, selector: string) => {
      const go = () => {
        discard();
        setOpen(tile);
        focusFirstField(selector);
      };
      if (open !== null && open !== tile && dirty) guardedAction(go);
      else {
        setOpen(tile);
        focusFirstField(selector);
      }
    },
    [open, dirty, discard, guardedAction],
  );
  const cancel = useCallback(() => {
    discard();
    setOpen(null);
  }, [discard]);
  const escape = useCallback(() => {
    if (dirty) guardedAction(cancel);
    else cancel();
  }, [dirty, guardedAction, cancel]);
  const close = useCallback(() => setOpen(null), []);
  return { open, edit, cancel, escape, close };
}

/** The open tile's outline: the focus blue, outside the tile's own border. */
export const TILE_EDITING_CLASS = "outline outline-2 outline-offset-2 outline-bl-strong dark:outline-blue-400";

/**
 * Esc inside the open tile is „Renunță" — unless a hint bubble is open in it (a saved CNP's note, #37.50): that Esc
 * closes the bubble, as it always did, and the next one the tile.
 */
export function onTileKeyDown(editing: boolean, escape: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (!editing || e.key !== "Escape" || e.defaultPrevented) return;
    if (e.currentTarget.querySelector('[role="tooltip"]:not(.sr-only)')) return;
    e.preventDefault();
    escape();
  };
}

/** „Editează", in the tile's corner. Reached by Tab; Enter opens the tile with the focus in its first field. */
export function TileEditButton({ tile, title, onEdit }: { tile: string; title: string; onEdit: () => void }) {
  const t = useTranslations("shared.readEdit");
  return (
    <IconButton
      icon={Pencil}
      label={t("edit")}
      fullName={t("editTile", { tile: title })}
      showLabel
      variant="secondary"
      size="sm"
      onClick={onEdit}
      data-tile-edit={tile}
    />
  );
}

/** Under the open tile's fields: „Salvează" and „Renunță", and the save's refusal when there is one. */
export function TileEditBar({
  tile,
  onSave,
  onCancel,
  saving,
  canSave,
  error,
}: {
  tile: string;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  /** Something changed. */
  canSave: boolean;
  error?: ReactNode;
}) {
  const t = useTranslations("shared.readEdit");
  return (
    <div className="flex flex-col gap-2 border-t border-card-rim pt-3 dark:border-zinc-700" data-tile-edit-bar={tile}>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <IconButton icon={Save} label={t("save")} showLabel variant="primary" size="sm" onClick={onSave} disabled={saving || !canSave} data-tile-save={tile} />
        <IconButton icon={X} label={t("cancel")} showLabel variant="secondary" size="sm" onClick={onCancel} disabled={saving} data-tile-cancel={tile} />
      </div>
    </div>
  );
}
