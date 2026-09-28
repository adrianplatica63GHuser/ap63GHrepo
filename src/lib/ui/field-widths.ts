/**
 * Every field's width, in one place.                       (Slice #37.12)
 *
 * ⚠️ **THE WINDOW DECIDES HOW MANY PANELS FIT, NEVER HOW WIDE ANYTHING IS.** A
 * field, a panel and the gap between them are the same width on a 1366-pixel
 * laptop and on a 2560-pixel monitor. A wider window fits more panels side by
 * side; a narrower one wraps them onto the next row; one narrower than a single
 * panel scrolls sideways. So no field on a screen that reads this file takes its
 * width from `flex-1`, `w-full` or a grid column — it takes it from here
 * (`src/__tests__/field-widths.test.ts` guards the Natural Person form and the
 * address block). The rule is in `.claude/rules/styling-and-buttons.md`.
 *
 * **To change a width, change one line below.** Each field names a STEP of the
 * scale rather than a number, so the screens stay a handful of widths that line
 * up; to move a whole step, change the scale.
 *
 * Two kinds of field, from Field.Widths.v02 (Adrian, 2026-09-28):
 *   FIXED  (`fixed`, `select`) — dropdowns, dates, numbers, CNP, codes, phones.
 *          The box holds the longest legitimate value and is no wider.
 *   GROWS  (`grows`, `lines`) — names, places, authorities, streets, emails,
 *          notes. The box has this width and its HEIGHT grows to show the whole
 *          value (`src/components/forms/growing-text.tsx`). `grows` is one value
 *          and never takes a line break; `lines` keeps them (notes, MRZ).
 *
 * MEASURED, NOT GUESSED. The comment beside each width quotes the local
 * archive as the runner's `measure-fields` sequence read it on 2026-09-28
 * (`scripts/testing/measure-field-lengths.ts`, read-only, masked):
 * `n` rows with a value · longest · 95th percentile · rows longer than the step
 * holds. Where the measurement disagreed with Field.Widths.v02, the measurement
 * won, except that Adrian's two v02 decisions (Nr. tarla / sola at M, Nr.
 * parcelă at L) may be widened by a measurement and never narrowed. After this
 * slice this file is the source of truth and the docx is history.
 *
 * Widths are in the font the app renders today — Arial at 14 px (FU-123: Geist
 * is loaded and never used). A digit is about 7.8 px, a capital 9.3 px, a
 * lower-case letter 6.5 px; a box adds about 18 px of padding and border, a
 * dropdown about 24 px more for its arrow.
 */
import type { CSSProperties } from "react";

// ---- the scale ------------------------------------------------------------------

/** Box widths, in rem. */
export const SCALE = {
  /** 3.5rem · 56 px — 4 digits. Vârstă. */
  XS: 3.5,
  /** 5rem · 80 px — 6–8 characters. Cod poștal, Nr. punct. */
  S: 5,
  /** 8.5rem · 136 px — 15 digits or 17 mixed. CNP, phones, dates, document numbers, short dropdowns. */
  M: 8.5,
  /** 13rem · 208 px — 20 capitals or 27 mixed. Names, most dropdowns. */
  L: 13,
  /** 17rem · 272 px — about 37 mixed. Emails, places, authorities, the MRZ. */
  XL: 17,
  /** 24rem · 384 px — about 52 mixed. Streets, Denumire, Etichetă scurtă. */
  XXL: 24,
  /** The panel's whole inner width beside the label: 30.5 − 5.5 − 0.5 = 24.5rem. Notes. */
  TILE: 24.5,
} as const;
export type Step = keyof typeof SCALE;

/** About how many mixed Romanian characters (≈ 7 px each) each step holds — what the measurement compares against. */
export const HOLDS: Record<Step, number> = { XS: 4, S: 8, M: 17, L: 27, XL: 37, XXL: 52, TILE: 53 };

/** The label to the left of every box stays as it was: 5.5rem, then a 0.5rem gap. */
export const LABEL_REM = 5.5;
export const LABEL_GAP_REM = 0.5;

/** A panel — a small tile in Field.Widths.v02 — and the gap between two. */
export const PANEL_REM = 32;
export const PANEL_GAP_REM = 1;
/** A panel's padding (p-3) on each side: 32 − 2 × 0.75 = 30.5rem inside. */
export const PANEL_PADDING_REM = 0.75;
export const PANEL_INNER_REM = PANEL_REM - 2 * PANEL_PADDING_REM;

export type FieldKind = "fixed" | "select" | "grows" | "lines";

export interface FieldWidth {
  step: Step;
  kind: FieldKind;
  /** For `lines`: the least number of lines shown. */
  rows?: number;
  /**
   * For a FIXED field: the widest value it must hold without scrolling — the
   * format's longest, or the measured longest, masked (`H` a capital, `n` a
   * lower-case letter, `0` a digit). The e2e check draws it in the box.
   */
  sample?: string;
}

// ---- styles -----------------------------------------------------------------------

export const rem = (n: number): string => `${n}rem`;

/** The box's width. Every field on a fixed-width screen takes its width from here. */
export function boxStyle(w: FieldWidth): CSSProperties {
  return { width: rem(SCALE[w.step]) };
}

export const LABEL_STYLE: CSSProperties = { width: rem(LABEL_REM) };

export const PANEL_STYLE: CSSProperties = { width: rem(PANEL_REM) };

/** The gap between two panels, and between two rows of them. */
export const PANEL_GAP = rem(PANEL_GAP_REM);

/**
 * The width of a row of panels: exactly as many whole panels as fit, and the
 * gaps between them — `round(down, …)` snaps the container to a multiple of
 * panel + gap — and never less than one panel, so a window narrower than a panel
 * scrolls instead of squeezing it. The action bar below the panels takes the
 * same width, so „Salvează" sits under the form, not a screen away from it.
 *
 * `round()` is Chrome 125+. A browser without it drops the declaration and the
 * row is as wide as its parent: the panels still flow at their fixed width, and
 * only the action bar is wider than they are.
 */
export function panelRowStyle(): CSSProperties {
  const step = PANEL_REM + PANEL_GAP_REM;
  return {
    width: `max(${rem(PANEL_REM)}, calc(round(down, 100% + ${rem(PANEL_GAP_REM)}, ${rem(step)}) - ${rem(PANEL_GAP_REM)}))`,
  };
}

// ---- the Natural Person (#37.12) ------------------------------------------------------

/**
 * The Natural Person's fields, in the order of its panels: Identitate, Carte de
 * identitate, Contact (the two addresses are `ADDRESS` below).
 *
 * ⚠️ **THE LOCAL ARCHIVE HOLDS ALMOST NO PERSON YET.** `measure-fields`
 * (20260928T183147Z-24215) found one natural person: every free-text column
 * below has 0 or 1 rows, so there was nothing longer than a format to measure
 * against. These widths are therefore Field.Widths.v02's, checked against the
 * FORMAT of each value (13-digit CNP, `+40 722 123 456`, `dd.mm.yyyy`) and drawn
 * in the rendered font by the e2e check. Re-run `measure-fields` once real
 * people are in the archive; a column whose p95 passes its step moves up one.
 * `m:` below is `rows · longest · p95`.
 */
export const NATURAL_PERSON = {
  // Identitate
  lastName: { step: "L", kind: "grows" }, //                m: 0 · — · —
  firstName: { step: "L", kind: "grows" }, //               m: 1 · 4 · 4
  nickname: { step: "L", kind: "grows" }, //                m: 1 · 4 · 4
  cnp: { step: "M", kind: "fixed", sample: "0000000000000" }, // 13 digits; m: 0
  gender: { step: "M", kind: "select" }, //                 „Masculin"
  dateOfBirth: { step: "M", kind: "fixed" }, //             dd.mm.yyyy and the calendar button
  age: { step: "XS", kind: "fixed", sample: "000" }, //     beside the date it is worked out from
  physicalPersonTypeId: { step: "M", kind: "select" }, //   m: 2 options, longest „Expert" (6); longer ones show on hover
  placeOfBirth: { step: "XL", kind: "grows" }, //           m: 0
  notes: { step: "TILE", kind: "lines", rows: 1 }, //       m: 0
  // Carte de identitate
  idDocumentType: { step: "L", kind: "select" }, //         „Carte de identitate" (19)
  idDocumentNumber: { step: "M", kind: "fixed", sample: "HH000000" }, // series and number; m: 0
  idCardNumber: { step: "M", kind: "fixed", sample: "000000000" }, //    m: 0
  idValidFrom: { step: "M", kind: "fixed" },
  idValidUntil: { step: "M", kind: "fixed" },
  citizenshipId: { step: "M", kind: "select" }, //          m: 8 options, longest „Moldoveană" (10)
  idIssuingAuthority: { step: "XL", kind: "grows" }, //     „SPCLEP Sector 3 București"; m: 0
  idMrzRaw: { step: "XL", kind: "lines", rows: 3 }, //      3 × 30 monospace; m: 1 · 1507 — free text pasted into it, which grows
  // Contact
  personalPhone1: { step: "M", kind: "fixed", sample: "+00 000 000 000" }, // m: 0
  personalPhone2: { step: "M", kind: "fixed", sample: "+00 000 000 000" }, // m: 0
  workPhone: { step: "M", kind: "fixed", sample: "+00 000 000 000" }, //      m: 0
  personalEmail1: { step: "XL", kind: "grows" }, //         prenume.nume@domeniu.ro is 25–30; m: 0
  personalEmail2: { step: "XL", kind: "grows" }, //         m: 0
  workEmail: { step: "XL", kind: "grows" }, //              m: 0
} as const satisfies Record<string, FieldWidth>;

/**
 * The shared address block (`src/components/address/address-block.tsx`), for
 * persons now and properties in #37.14. `measure-fields` found no person
 * address and no property address with a value in the local archive.
 */
export const ADDRESS = {
  streetLine: { step: "XXL", kind: "grows" }, //            m: 0
  postalCode: { step: "S", kind: "fixed", sample: "000000" }, // six digits; m: 0
  locality: { step: "L", kind: "grows" }, //                m: 0
  county: { step: "M", kind: "fixed", sample: "Hnnnn-Hnnnnnn" }, // „Caraș-Severin", the longest county; m: 0
  country: { step: "M", kind: "fixed", sample: "Hnnnnnn" }, //      „România"; m: 0
  notes: { step: "TILE", kind: "lines", rows: 1 }, //       m: 0
} as const satisfies Record<string, FieldWidth>;
