"use client";

// ---------------------------------------------------------------------------
// AddressBlock — shared address-fields section
// ---------------------------------------------------------------------------
//
// One section card (street / postal / locality / county / country / notes)
// rendered on top of an existing react-hook-form. Used by both the
// Natural-Person form (HOME + CORRESPONDENCE) and the Judicial-Person form
// (HEADQUARTERS + CORRESPONDENCE) — see Slice #4.6.
//
// Field labels come from the top-level `address` i18n namespace so this
// component is fully self-contained. The section title is passed in by
// the parent (each form uses different titles, e.g. "Home Address" vs
// "Registered Office Address").
//
// Generic over the form values type so `register` stays type-safe at the
// call site. The `prefix` argument is a dotted path into the form values
// (e.g. "addresses.HOME") — the call site is responsible for matching it
// against the form schema.

import { Fragment, type ReactNode, type KeyboardEventHandler } from "react";
import { useTranslations } from "next-intl";
import {
  type FieldPath,
  type FieldValues,
  type UseFormRegister,
} from "react-hook-form";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import { usePulseRing } from "@/components/versioning/field-pulse";
import { GrowingText } from "@/components/forms/growing-text";
import {
  ADDRESS,
  ADDRESS_ROWS,
  NP_PANEL_INNER_REM,
  NP_PANEL_STYLE,
  boxRem,
  stackedBoxStyle,
  type FieldWidth,
} from "@/lib/ui/field-widths";
import { STACKED_FIELD_CLASS, STACKED_LABEL_CLASS, STACKED_ROW_CLASS } from "@/lib/ui/stacked";
import { EMPTY_MARK, FIELD_BOX, fieldBorder } from "@/lib/ui/field-box";
import { TileTitle } from "@/components/tiles/tile-title";
import { EmptyTileLine, type EmptyTileState } from "@/components/tiles/empty-tile";
import { hiddenFieldStyle, useFieldHidden } from "@/components/tiles/empty-fields";
import { ReadValue, readText, useFieldRead } from "@/components/tiles/read-edit-tile";

/** Per-subfield version-diff highlight frames (Slice #18.05). Keys match the
 *  address subfield names; omitted = no frame. */
export type AddressHighlights =
  | Partial<
      Record<
        "streetLine" | "postalCode" | "locality" | "county" | "country" | "notes",
        HighlightColor
      >
    >
  | undefined;

export type AddressErrors =
  | {
      streetLine?: { message?: string };
      postalCode?: { message?: string };
      locality?: { message?: string };
      county?: { message?: string };
      country?: { message?: string };
      notes?: { message?: string };
    }
  | undefined;

type Props<TFormValues extends FieldValues> = {
  /** Section heading shown in uppercase at the top of the card. */
  title: string;
  /**
   * Slice #38.30: the grey line under the title. The two person forms pass
   * their „Adrese" tile's subtitle to the tile's FIRST panel only — the two
   * panels show and hide together as one tile, and a second copy of the same
   * line under the correspondence panel would say nothing new.
   */
  subtitle?: string;
  /** Dotted path into the form values, e.g. "addresses.HOME". */
  prefix: string;
  register: UseFormRegister<TFormValues>;
  errors: AddressErrors;
  /**
   * Optional set of sub-field names ("streetLine", "postalCode", "locality",
   * "county", "country") to flag with a ⚠ badge — used by the import wizard's
   * ID-card dialog to surface low-confidence vision-API extractions. Omitted
   * (or empty) by every other caller, so this is a no-op everywhere else.
   */
  warnFields?: Set<string>;
  /**
   * Optional per-subfield version-diff highlight frames (Slice #18.05). Green =
   * a field was added in the viewed version, red = modified/deleted. Supplied
   * only by the versioned person forms when viewing a past version; omitted
   * (a no-op) everywhere else.
   */
  highlights?: AddressHighlights;
  /**
   * Slice #37.27: a last line inside the panel, under Note — the
   * Natural Person's „same as home" checkbox, which used to take a panel's
   * room of its own beside this one.
   */
  footer?: ReactNode;
  /**
   * Slice 40.64: the panel is empty on a saved record — drawn as one line, its title, „necompletat" and „Adaugă"
   * (`onAdd`, absent on a read-only view). The fields stay mounted behind it, hidden.
   */
  collapsed?: { tile: string; onAdd?: () => void };
  /**
   * Slice 40.71: „Arată N câmpuri goale" — the link at the panel's foot when some of its fields are empty and hidden
   * (src/components/tiles/empty-fields.tsx). The fields read their own hiding from `HiddenFieldsContext`.
   */
  emptyFields?: ReactNode;
  /** Slice 40.72: „Editează", beside the panel's title. */
  titleAction?: ReactNode;
  /** Slice 40.72: under the panel's fields — the open tile's „Salvează" and „Renunță". */
  after?: ReactNode;
  /** Slice 40.72: the open tile's outline, on the panel. */
  sectionClassName?: string;
  /** Slice 40.72: Esc in the open tile is „Renunță". */
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
};

export function AddressBlock<TFormValues extends FieldValues>({
  title,
  subtitle,
  prefix,
  register,
  errors,
  warnFields,
  highlights,
  footer,
  collapsed,
  emptyFields,
  titleAction,
  after,
  sectionClassName,
  onKeyDown,
}: Props<TFormValues>) {
  const t = useTranslations("address");
  const f = (sub: string) => `${prefix}.${sub}` as FieldPath<TFormValues>;
  const warn = (sub: string) => warnFields?.has(sub) ?? false;
  const hl = (sub: keyof NonNullable<AddressHighlights>) => highlights?.[sub];

  /**
   * ONE SHAPE: LABELS ABOVE THEIR BOXES, ON THE UNIT.   (#37.26, #37.29, #37.32)
   *
   * Every caller — the Natural Person, the Judicial Person and the ID-card
   * dialog — draws the block the same way: every label above its box, the rows
   * `ADDRESS_ROWS`, every box at its width from `ADDRESS`, Note the panel's
   * whole width, the panel the fewest width units that hold its widest row.
   * #37.32 removed the two other shapes: the labels-beside one (no caller since
   * #37.29) and the free-width grid that served only the ID-card dialog.
   */
  const labels: Record<keyof typeof ADDRESS, string> = {
    streetLine: t("streetLine"),
    postalCode: t("postalCode"),
    locality: t("locality"),
    county: t("county"),
    country: t("country"),
    notes: t("notes"),
  };
  const field = (sub: keyof typeof ADDRESS) => (
    <Field
      label={labels[sub]}
      name={f(sub)}
      register={register}
      error={errors?.[sub]?.message}
      warn={sub !== "notes" && warn(sub)}
      highlight={hl(sub)}
      width={ADDRESS[sub]}
      fillRem={NP_PANEL_INNER_REM.address}
    />
  );
  return (
    <section
      style={NP_PANEL_STYLE.address}
      data-panel={prefix}
      onKeyDown={onKeyDown}
      className={`rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900${sectionClassName ? ` ${sectionClassName}` : ""}`}
    >
      {collapsed && <EmptyTileLine tile={collapsed.tile} title={title} onAdd={collapsed.onAdd} />}
      <div className={collapsed ? "hidden" : "contents"}>
      <TileTitle title={title} subtitle={subtitle} action={titleAction} />
      <div className="flex flex-col gap-2">
        {ADDRESS_ROWS.map((row) => (
          <div key={row.join("|")} className={STACKED_ROW_CLASS}>
            {row.map((sub) => (
              <Fragment key={sub}>{field(sub)}</Fragment>
            ))}
          </div>
        ))}
        {emptyFields}
        {footer && <div className="pt-1" data-address-footer>{footer}</div>}
        {after}
      </div>
      </div>
    </section>
  );
}

/**
 * Slice 40.64: an address panel that is only one line — the correspondence address that is the same as the home (or
 * the registered) one: „aceeași cu domiciliul". Its own panel, as wide as the block, so the tile keeps its shape.
 */
export function AddressLine({
  prefix,
  tile,
  title,
  state,
  onAdd,
}: {
  prefix: string;
  tile: string;
  title: string;
  state: EmptyTileState;
  onAdd?: () => void;
}) {
  return (
    <section style={NP_PANEL_STYLE.address} data-panel={prefix} className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <EmptyTileLine tile={tile} title={title} state={state} onAdd={onAdd} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Local field helper — the label above its box, the pair exactly as wide as
// the box (Slice #37.26)
// ---------------------------------------------------------------------------

function Field<TFormValues extends FieldValues>({
  label,
  name,
  register,
  error,
  warn,
  highlight,
  width,
  fillRem,
}: {
  label: string;
  name: FieldPath<TFormValues>;
  register: UseFormRegister<TFormValues>;
  error?: string;
  warn?: boolean;
  highlight?: HighlightColor;
  width: FieldWidth;
  /** The panel's inner width, for the box that `fill`s it (Note). */
  fillRem: number;
}) {
  const hiddenEmpty = useFieldHidden(name); // Slice 40.71: behind its tile's „Arată N câmpuri goale"
  const read = useFieldRead(name);
  // Static ring on a historical version; animated pulse on the freshly-
  // navigated-to latest (Bug 1). The pulsing flag comes from FieldPulseContext,
  // which the versioned person form provides; defaults to a static ring
  // elsewhere (e.g. the import wizard's ID-card dialog).
  const ring = usePulseRing(highlight);
  const boxClass = [
    FIELD_BOX,
    fieldBorder(Boolean(error)),
    ring,
  ].join(" ");
  const grows = width.kind === "grows" || width.kind === "lines";
  const box = stackedBoxStyle(width, width.fill ? fillRem : boxRem(width));
  // Slice 40.72: the read view — the value as text, at the box's width.
  if (read.reading) {
    return (
      <div className={STACKED_FIELD_CLASS} style={hiddenFieldStyle(hiddenEmpty, box)} data-empty-hidden={hiddenEmpty || undefined}>
        <span className={STACKED_LABEL_CLASS}>{label}</span>
        <ReadValue name={name} kind={width.kind} text={readText(read.value)} style={box} className={ring} />
      </div>
    );
  }
  return (
    <label className={STACKED_FIELD_CLASS} style={hiddenFieldStyle(hiddenEmpty, box)} data-empty-hidden={hiddenEmpty || undefined}>
      <span className={STACKED_LABEL_CLASS}>
        {label}
        {warn && <span className="ml-1 text-amber-600 dark:text-amber-400" data-low-confidence>⚠</span>}
      </span>
      {grows ? (
        <GrowingText
          registration={register(name)}
          width={String(box.width)}
          lines={width.kind === "lines"}
          fold={width.fold}
          minRows={width.rows ?? 1}
          aria-invalid={error ? true : undefined}
          className={boxClass}
          placeholder={EMPTY_MARK}
          data-width-field={name}
          data-width-kind={width.kind}
        />
      ) : (
        <input
          type="text"
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={boxClass}
          placeholder={EMPTY_MARK}
          style={box}
          data-width-field={name}
          data-width-kind={width.kind}
        />
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}
