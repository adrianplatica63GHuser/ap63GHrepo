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
  /**
   * The panel's whole inner width beside the label: 30.375 − 5.5 − 0.5 = 24.375rem
   * (390 px). Notes. It was 24.5, which forgot the panel's 1-px borders: a TILE
   * row was 2 px wider than its panel — invisible in a `<section>`, but enough to
   * widen a `<fieldset>` panel (its min-content wins) past a third panel's room,
   * so #37.14's pictures showed the Property two panels a row at 1920 px, not three.
   */
  TILE: 24.375,
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
/** A panel's padding (p-3) and its 1-px border on each side: 32 − 2 × 0.75 − 2 × 0.0625 = 30.375rem inside. */
export const PANEL_PADDING_REM = 0.75;
export const PANEL_BORDER_REM = 1 / 16;
export const PANEL_INNER_REM = PANEL_REM - 2 * PANEL_PADDING_REM - 2 * PANEL_BORDER_REM;

export type FieldKind = "fixed" | "select" | "grows" | "lines";

/**
 * Slice #37.40 — every „Note…" box and the MRZ show at most this many RENDERED
 * lines until „Arată mai mult…" (GrowingText's `fold`). Adrian, 2026-10-01:
 * „cover all the Note boxes". field-widths.test.ts holds every notes entry and
 * the MRZ to it, so a new „Note" box cannot appear without the fold.
 */
export const NOTE_FOLD_LINES = 5;

export interface FieldWidth {
  step: Step;
  kind: FieldKind;
  /** For `lines`: the least number of lines shown. */
  rows?: number;
  /** For `lines`: fold to this many rendered lines, with „Arată mai mult…" (#37.40). */
  fold?: number;
  /**
   * For a FIXED field: the widest value it must hold without scrolling — the
   * format's longest, or the measured longest, masked (`H` a capital, `n` a
   * lower-case letter, `0` a digit). The e2e check draws it in the box.
   */
  sample?: string;
  /**
   * A width off the scale, in rem — where Adrian asked for one by size
   * (#37.26: the ID card's first row „about 75%" of what it was), and a
   * document type's own dropdown, which is as wide as its widest choice
   * (#37.53, `templateFieldWidth`). The step still says what the box is, and
   * the scale stays a handful of steps.
   */
  rem?: number;
  /**
   * On a panel whose labels sit ABOVE their boxes (#37.26): the box takes the
   * panel's whole inner width, whatever that is — Note, the MRZ. Beside a label
   * the step decides, as before.
   */
  fill?: true;
}

// ---- styles -----------------------------------------------------------------------

export const rem = (n: number): string => `${n}rem`;

/** The box's width in rem: its own `rem` where it names one, else its step. */
export function boxRem(w: FieldWidth): number {
  return w.rem ?? SCALE[w.step];
}

/** The box's width. Every field on a fixed-width screen takes its width from here. */
export function boxStyle(w: FieldWidth): CSSProperties {
  return { width: rem(boxRem(w)) };
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
  notes: { step: "TILE", kind: "lines", fold: NOTE_FOLD_LINES, rows: 1, fill: true }, // m: 0; the panel's whole width (#37.26)
  // Carte de identitate — the first row „about 75%" of L, M and M (Adrian, #37.26). Tip document
  // is 10rem, not 9.75: „Carte de identitate" needs 156.4 px with the arrow, and 9.75rem is 156.
  idDocumentType: { step: "L", kind: "select", rem: 10 }, // „Carte de identitate" (19)
  idDocumentNumber: { step: "M", kind: "fixed", sample: "HH000000", rem: 6.375 }, // series and number; m: 0
  idCardNumber: { step: "M", kind: "fixed", sample: "000000000", rem: 6.375 }, //    m: 0
  idValidFrom: { step: "M", kind: "fixed" },
  idValidUntil: { step: "M", kind: "fixed" },
  citizenshipId: { step: "M", kind: "select" }, //          m: 8 options, longest „Moldoveană" (10)
  idIssuingAuthority: { step: "XL", kind: "grows" }, //     „SPCLEP Sector 3 București"; m: 0
  idMrzRaw: { step: "XL", kind: "lines", fold: NOTE_FOLD_LINES, rows: 3, fill: true }, // 3 × 30 monospace; m: 1 · 1507 — free text pasted into it, which grows; the panel's whole width (#37.26)
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
  notes: { step: "TILE", kind: "lines", fold: NOTE_FOLD_LINES, rows: 1, fill: true }, // m: 0; on a stacked panel, its whole width (#37.26)
} as const satisfies Record<string, FieldWidth>;

// ---- the Natural Person, labels above their boxes (#37.26) ----------------------------

/**
 * LABELS ABOVE THEIR BOXES, AND EACH PANEL AS WIDE AS ITS WIDEST ROW.  (Slice #37.26)
 *
 * Adrian, 2026-09-29, after the stacked-labels preview: on the Natural Person
 * every label sits on top of the box it names, the fields are regrouped into
 * the rows below, and the panels are narrowed to fit them. Only the Natural
 * Person: the Judicial Person, the Property and the Document keep their labels
 * beside the box (`LABEL_STYLE`), and the address block stacks only when a
 * form asks it to (`stacked`).
 *
 * The rows ARE the layout: the form draws exactly these, in this order
 * (`field-widths.test.ts` reads the form to check it). A panel holds its
 * widest row — the boxes on it and the gaps between them — and since #37.27 is
 * the fewest whole width units that do (`NP_PANEL_UNITS`). A `fill` box (Note,
 * the MRZ) takes the panel's whole inner width and does not count towards it.
 */

/** The gap between two boxes on one row (`gap-2`), and between two rows. */
export const STACK_GAP_REM = 0.5;

type NpField = keyof typeof NATURAL_PERSON;
type AddressField = keyof typeof ADDRESS;

const NATURAL_PERSON_ROWS = {
  identity: [
    ["lastName", "firstName"],
    ["nickname", "cnp"],
    ["dateOfBirth", "age", "gender"],
    ["placeOfBirth", "physicalPersonTypeId"],
    ["notes"],
  ],
  idCard: [
    ["idDocumentType", "idDocumentNumber", "idCardNumber"],
    // …and the validity status („VALABIL", „EXPIRAT") in the rest of this row: `NP_VALIDITY_REM`.
    ["idValidFrom", "idValidUntil"],
    ["citizenshipId", "idIssuingAuthority"],
    ["idMrzRaw"],
  ],
  contact: [
    ["personalPhone1", "personalPhone2"],
    ["workPhone"],
    ["personalEmail1"],
    ["personalEmail2"],
    ["workEmail"],
  ],
} as const satisfies Record<string, readonly (readonly NpField[])[]>;

export const ADDRESS_ROWS = [
  ["streetLine"],
  ["postalCode", "locality"],
  ["county", "country"],
  ["notes"],
] as const satisfies readonly (readonly AddressField[])[];

/** A row's width: its boxes and the gaps between them. A `fill` box counts as nothing. */
export function rowRem(widths: readonly FieldWidth[]): number {
  const sized = widths.filter((w) => !w.fill);
  if (sized.length === 0) return 0;
  return sized.reduce((sum, w) => sum + boxRem(w), 0) + (sized.length - 1) * STACK_GAP_REM;
}

function widestRow<K extends string>(rows: readonly (readonly K[])[], widths: Readonly<Record<K, FieldWidth>>): number {
  return Math.max(...rows.map((row) => rowRem(row.map((k) => widths[k]))));
}

/** A panel's width from its inner width: the padding (p-3) and the 1-px border on each side. */
export function panelRem(inner: number): number {
  return inner + 2 * PANEL_PADDING_REM + 2 * PANEL_BORDER_REM;
}

// ---- the width unit (#37.27) ------------------------------------------------------------

/**
 * A WIDTH UNIT, AND EVERY TILE A WHOLE NUMBER OF THEM.        (Slice #37.27)
 *
 * Adrian, 2026-09-30: „pick a width unit and then create panels that are
 * multiples of that", so tiles line up edge to edge — two of 3 units side by
 * side, a 4 and a 2 below them, and every right-hand edge falls on the same
 * lines. A tile of `n` units is `n` units and the `n − 1` gaps between them,
 * so a 3 beside a 3 is exactly as wide as a 4 beside a 2 (`unitsRem`). Height
 * is left to the content.
 *
 * Why 9.25rem: the smallest unit on which Contact (two phones, 17.5rem inside)
 * fits in two units and Identitate, Carte de identitate and Adresă (26.5, 26
 * and 24 inside) fit in three. A row holds 6 units on a 1366-pixel laptop
 * (68.4rem beside the sidebar), 10 on a 1920-pixel monitor and 14 on a 2560.
 * Today only the Natural Person is on it.
 */
export const UNIT_REM = 9.25;
export const UNIT_GAP_REM = PANEL_GAP_REM;

/** `n` units wide: the units and the gaps between them. */
export function unitsRem(n: number): number {
  return n * UNIT_REM + (n - 1) * UNIT_GAP_REM;
}

/** The fewest units that are at least `outerRem` wide. */
export function unitsFor(outerRem: number): number {
  let n = 1;
  while (unitsRem(n) < outerRem) n++;
  return n;
}

/** Inside a tile of `n` units: less its padding and border. */
export function unitsInnerRem(n: number): number {
  return unitsRem(n) - 2 * PANEL_PADDING_REM - 2 * PANEL_BORDER_REM;
}

export function unitStyle(n: number): CSSProperties {
  return { width: rem(unitsRem(n)) };
}

/** A box on a stacked panel: its own width, or the panel's whole inner width when it `fill`s it. */
export function stackedBoxStyle(w: FieldWidth, panelInner: number): CSSProperties {
  return { width: rem(w.fill ? panelInner : boxRem(w)) };
}

/** A table on a list tile fills the tile inside its frame (the frame's 1-px border on each side). */
export function tileTableRem(units: number): number {
  return unitsInnerRem(units) - 2 * PANEL_BORDER_REM;
}

// ---- the Judicial Person (#37.13) -----------------------------------------------------

/**
 * The Judicial Person's fields: Persoană juridică and Persoane de contact (its two
 * addresses are `ADDRESS`, through the same block as the Natural Person's).
 *
 * `measure-fields` 20260928T190616Z-15660 found no judicial person in the local
 * archive and one natural person to choose as a contact, so — as for the Natural
 * Person — the widths are v02's, checked against formats. `m:` is `rows · longest`.
 */
export const JUDICIAL_PERSON = {
  name: { step: "XXL", kind: "grows", fill: true }, //      „SOCIETATEA AGRICOLĂ … S.R.L." can pass 60 — it wraps; the panel's whole width since #37.29; m: 0
  nickname: { step: "L", kind: "grows" }, //                m: 0
  judicialPersonTypeId: { step: "L", kind: "select" }, //   m: 10 options, longest „Consiliu Local" (14) — one character past M
  cuiNumber: { step: "M", kind: "fixed", sample: "HH0000000000" }, //    „RO12345678", up to 10 digits; m: 0
  tradeRegisterNumber: { step: "M", kind: "fixed", sample: "H00/00000/0000" }, // „J40/12345/2020"; m: 0
  notes: { step: "TILE", kind: "lines", fold: NOTE_FOLD_LINES, rows: 1, fill: true }, // m: 0; the panel's whole width (#37.29)
  contactPerson: { step: "XL", kind: "grows" }, //          a natural person's display name, wrapping; m: 1 · 4
} as const satisfies Record<string, FieldWidth>;

// ---- the Property (#37.14) --------------------------------------------------------------

/** The width a label and its gap take — where a line that belongs to a box, not to a label, starts. */
export const LABEL_INDENT = rem(LABEL_REM + LABEL_GAP_REM);

/**
 * The Property's fields. `measure-fields` 20260928T185247Z-3109 on the local
 * archive's 8 properties: `m:` is `rows · longest · p95`.
 *
 * Nr. parcelă at M is Adrian's LATER note (01.Slice.Inputs\Slices.37.nn\
 * Stacked.txt, 2026-09-29: „Nr. tarla / sola back to S, Nr. parcelă back to M",
 * i.e. Field.Widths.v01), which Slice #37.30 took over v02's L; „000/00/00", the
 * longest (#37.14's measurement), holds at M. ⚠️ **Nr. tarla / sola stays at M,
 * not the note's S — rule 10, the longest value is a floor:** the longest tarla
 * („47/2") fits S, but the dropdown's own empty option „— niciunul —" needed
 * 107 px and S is 80 (TC-PROP-04's fixed-box check, e2e 20261001T010949Z-7174).
 * Since #37.55 it reads „niciunul", in italics and without the dashes: about
 * 90 px, still past S, so M still holds.
 * At M, M and M, Cod | Nr. tarla / sola | Nr. parcelă was 26.5rem; since
 * #37.57 the system ID is the heading's corner and the row is the two numbers.
 */
export const PROPERTY = {
  tarlaId: { step: "M", kind: "select" }, //                    M: „niciunul" needs about 90 px (see above); m: 3 options, longest „47/2"
  parcela: { step: "M", kind: "fixed", sample: "000/00/00" }, // Adrian's M (Stacked.txt); m: 3 · 6 · 6
  nickname: { step: "XL", kind: "grows" }, //                   m: 8 · 38 · 38 — p95 is past L (27), so XL; longer wraps
  surfaceAreaMp: { step: "M", kind: "fixed", sample: "0000000.00" }, //  the box shows 1234567.89, no separators; m: 3 · 6
  calculatedAreaMp: { step: "M", kind: "fixed", sample: "0000000.00" }, // toFixed(2), in the mono font; m: 3 · 6
  carteFunciara: { step: "M", kind: "fixed", sample: "000000" }, //       m: 0
  cadastralNumber: { step: "M", kind: "fixed", sample: "HHHHH-00.00-H" }, // m: 1 · 13
  useCategoryId: { step: "M", kind: "select" }, //              m: 8 options, longest „Neproductiv" (11) — v02 guessed L
  propertyTypeId: { step: "L", kind: "select" }, //             m: 14 options, longest „Vegetație Forestieră" (20)
  notes: { step: "TILE", kind: "lines", fold: NOTE_FOLD_LINES, rows: 1, fill: true }, // m: 1 · 72, at most 300; the panel's whole width (#37.30)
  /** The Street View address row: the box, then „Preia" and its hint, in the panel's width. */
  streetViewStreetLine: { step: "TILE", kind: "grows" },
  streetViewStreetLineBox: { step: "L", kind: "grows" }, //     m: 0
} as const satisfies Record<string, FieldWidth>;

/**
 * The mini-map and Street View: each fills its tile — since #37.30 a tile of
 * whole units (`PANEL_UNITS.property.map`), 22rem tall. The polygon is
 * fitted with `fitBounds` (40 px padding), so any parcel fits at the default
 * zoom; a property with no corners keeps the same box, so nothing jumps.
 */
// MAP_BOX_STYLE moved to the screen-keyed block below (#37.30, rule 20): whole units now.

/**
 * „Puncte de contur" columns: Nr., Nr. inițial, then N and E (Stereo 70,
 * „512345.67" — six digits and two decimals in the mono font; latitude and
 * longitude in decimal degrees, „44.4123456", fit too), and the row's buttons
 * take the rest of the panel.
 */
export const CORNER_COLUMNS = {
  seq: rem(2.5),
  originalIndex: rem(3.5),
  north: rem(6.5),
  east: rem(6.5),
} as const;

// ---- the Document (#37.15) -------------------------------------------------------------

/**
 * The Document's general and fee fields — „Date generale" and „Taxe și
 * onorarii". `measure-fields` 20260928T185247Z-3109 on the local archive's 105
 * documents: `m:` is `rows · longest · p95`.
 *
 * Etichetă scurtă and Subiect are v02's XXL moved up a step: their p95 (73 and
 * 301) is past what XXL holds (52), and the #37.12 rule is that such a field
 * moves up. TILE is the widest a box beside its label can be; past it they wrap.
 */
export const DOCUMENT = {
  documentTypeId: { step: "XXL", kind: "select" }, //   m: 47 options, longest „Tabel/Lista - Nu este un document oficial" (41)
  title: { step: "TILE", kind: "grows", fill: true }, //  Etichetă scurtă; m: 105 · 151 · 73; the panel's whole width (#37.31)
  subject: { step: "TILE", kind: "grows", fill: true }, // m: 48 · 428 · 301; the panel's whole width (#37.31)
  notes: { step: "TILE", kind: "lines", fold: NOTE_FOLD_LINES, rows: 1, fill: true }, // Note extinse; m: 50 · 2504 · 2283, at most 4000; whole width
  institutionId: { step: "XXL", kind: "select" }, //     m: 7 options; the dropdown shows „name (type)", longest „Primăria Municipiului (Administrație Locală)" (44)
  nrDocument: { step: "M", kind: "fixed", sample: "00/00.00.0000" }, // m: 24 · 13 · 6
  dateDocument: { step: "M", kind: "fixed" }, //         dd.mm.yyyy and the calendar button
} as const satisfies Record<string, FieldWidth>;

/**
 * The page image beside the Document's fields.               (Slice #37.15)
 *
 * ⚠️ **NOT NARROWER THAN IT WAS.** Before this slice the „Pagini" panel was
 * two-fifths of a centred 93rem block, which TC-DOC-01's spec measured in a
 * 1920 × 1080 window (see the #37.15 handover). 40rem is 640 px, wider than
 * that, and it no longer depends on the window. `src/__tests__/field-widths.test.ts`
 * holds it at no less than 36rem (576 px, the arithmetic's figure).
 */
export const PAGES_PANEL_REM = 40; // = unitsRem(4): the page image joins the width unit unchanged (#37.31, rule 20)
export const PAGES_PANEL_STYLE: CSSProperties = { width: rem(PAGES_PANEL_REM) };

// Slice #37.31: `documentRowStyle` and `fieldsBesidePagesStyle` gave way to
// `unitRowStyle("document")` — the page image is a 4-unit tile like any other.

// ---- a document type's own fields (#37.15) ------------------------------------------------

/**
 * TEMPLATE FIELDS ARE SIZED BY RULE, NOT ONE BY ONE.          (Slice #37.15)
 *
 * A document type's own fields are data (`lookup_document_type.template_fields`),
 * so a new type must look right with no width work. The width follows from the
 * field's `type`:
 *   text      the default text width, growing downward (one value, no breaks);
 *   textarea  the panel's whole width, growing, line breaks kept;
 *   number    a fixed M;   date   a fixed M;
 *   select    as wide as its widest choice needs (the blank one included),
 *             rounded up to the next 0.5rem, never narrower than S — past XXL
 *             it stays XXL and shows the chosen option in full on hover.
 *             (#37.53: it used to be rounded up to the next STEP, so a CVC
 *             dropdown needing 157 px — „— fără valoare —" — was drawn at L,
 *             208 px. Measured on the six seeded forms: 49 of 49 dropdowns
 *             narrower, by 16 to 96 px. #37.55: the blank reads „fără
 *             valoare", in italics, 120 px — no longer the widest choice of a
 *             CVC dropdown, so „Da / Nu / Nu e menționat" is 9rem.)
 * A field whose JSON carries `width` (one of the scale's steps) takes that step
 * instead; its KIND still follows from its type. No form sets `width` today.
 *
 * `m:` is `measure-fields` on the 116 template fields of the six seeded types:
 * text runs from 3 characters to 267, most under 45 — XL holds 37, and longer
 * wraps; the widest option is 37 characters (CONTRACT_VANZARE · categorieInterna).
 */
export const TEMPLATE_FIELD = {
  text: { step: "XL", kind: "grows" },
  textarea: { step: "TILE", kind: "lines", rows: 1 },
  number: { step: "M", kind: "fixed", sample: "0000000.00" }, // m: at most 5 digits
  date: { step: "M", kind: "fixed" },
} as const satisfies Record<string, FieldWidth>;

/** The steps a select may take, narrowest first; the last is its cap. */
export const SELECT_STEPS: readonly Step[] = ["S", "M", "L", "XL", "XXL"];

/** Padding and border (18 px) and the arrow (24 px) a dropdown adds to its text. */
export const SELECT_CHROME_PX = 42;

/**
 * Arial's advance widths, in thousandths of the font size — the font the app
 * renders (FU-123). Enough to size a dropdown before it is drawn; the e2e check
 * measures the real thing in the browser.
 */
const ARIAL: Record<string, number> = {
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  " ": 278, ".": 278, ",": 278, ":": 278, ";": 278, "/": 278, "-": 333, "(": 333, ")": 333, "'": 191,
  "„": 333, "”": 333, "\"": 355, "–": 556, "—": 1000, "%": 889, "&": 667,
};

/** About how wide `text` draws in 14 px Arial, in px. Diacritics count as their base letter. */
export function textPx(text: string, fontPx = 14): number {
  let units = 0;
  for (const ch of text) {
    const base = ch.normalize("NFD")[0] ?? ch;
    units += ARIAL[ch] ?? ARIAL[base] ?? 556; // digits are 556 too
  }
  return (units * fontPx) / 1000;
}

/**
 * The px a dropdown needs to show every one of `labels` whole: the widest in
 * Arial, a 5% margin, and its padding, border and arrow. The margin and the
 * chrome are #37.15's, set against Arial; since #37.53 nothing rounds them up
 * to a step, so TC-DOC-04 measures every CVC dropdown in the browser with its
 * widest choice selected.
 */
export function selectNeedPx(labels: readonly string[]): number {
  return Math.max(0, ...labels.map((l) => textPx(l))) * 1.05 + SELECT_CHROME_PX;
}

/** The narrowest step whose dropdown shows every one of `labels` whole, capped at XXL. */
export function selectStepFor(labels: readonly string[]): { step: Step; capped: boolean } {
  const need = selectNeedPx(labels);
  for (const step of SELECT_STEPS) if (SCALE[step] * 16 >= need) return { step, capped: false };
  return { step: SELECT_STEPS[SELECT_STEPS.length - 1], capped: true };
}

/**
 * A document type's own dropdown: as wide as `labels` need, rounded up to the
 * next 0.5rem, never narrower than S; past XXL, XXL and `capped`. (#37.53)
 * „Nu e menționat" needs 142 px → 9rem; the blank „fără valoare" (#37.55, in
 * italics — Arial Italic has Arial's widths) 120 px → 7.5rem.
 * The step is the one that would have held it — what the box is, not its width.
 */
export function templateSelectWidth(labels: readonly string[]): FieldWidth & { capped?: boolean } {
  const need = selectNeedPx(labels);
  const { step, capped } = selectStepFor(labels);
  if (capped) return { step, kind: "select", capped };
  return { step, kind: "select", rem: Math.max(SCALE.S, Math.ceil(need / 8) / 2) };
}

/** What a template field needs to be sized: its type, its optional `width`, and a select's labels. */
export interface TemplateFieldShape {
  type: "text" | "textarea" | "date" | "number" | "select";
  width?: Step | null;
}

/**
 * A template field's width by the rule above. `labels` are a select's option
 * captions as they will be drawn (the blank choice's included); `forceLines` is
 * Certificate și referințe's treatment — every field there grows at the panel's
 * width with its line breaks, whatever its type.
 */
export function templateFieldWidth(
  field: TemplateFieldShape,
  labels: readonly string[] = [],
  forceLines = false,
): FieldWidth & { capped?: boolean } {
  if (field.type === "select") {
    if (field.width) return { step: field.width, kind: "select" };
    return templateSelectWidth(labels);
  }
  if (forceLines) return { ...TEMPLATE_FIELD.textarea, ...(field.width ? { step: field.width } : {}) };
  const base: FieldWidth = TEMPLATE_FIELD[field.type];
  return field.width ? { ...base, step: field.width } : base;
}

/** Whether `value` names one of the scale's steps — what a template field's `width` may hold. */
export function isStep(value: unknown): value is Step {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SCALE, value);
}

// ---- every stacked screen on the width unit, keyed by screen (#37.27, #37.29) ---------

type JpField = keyof typeof JUDICIAL_PERSON;

/**
 * The Property's address panel, by the names its boxes carry (`address.…`): the
 * shared address widths and, after Stradă, the Street View street line — its
 * box (L), with „Preia din Street View" and its help beside it (#37.30).
 */
export const PROPERTY_ADDRESS = {
  "address.streetLine": ADDRESS.streetLine,
  "address.streetViewStreetLine": PROPERTY.streetViewStreetLineBox,
  "address.postalCode": ADDRESS.postalCode,
  "address.locality": ADDRESS.locality,
  "address.county": ADDRESS.county,
  "address.country": ADDRESS.country,
  "address.notes": ADDRESS.notes,
} as const satisfies Record<string, FieldWidth>;
type PropField = keyof typeof PROPERTY | keyof typeof PROPERTY_ADDRESS;
type DocField = keyof typeof DOCUMENT;

/**
 * ONE SHAPE, KEYED BY SCREEN.                           (Slice #37.29, rule 19)
 *
 * #37.26–27 wrote the rows, the panel units, the list units, META INFO's cell
 * and the tile row's style for the Natural Person alone (`NP_ROWS`,
 * `NP_PANEL_UNITS`, …). The Judicial Person is the second screen to use them,
 * so they are one shape keyed by screen; copying them into `JP_` twins is the
 * thing rule 19 forbids. The `NP_` names below are the Natural Person's entry
 * of each, unchanged in value — `field-widths.test.ts` holds the numbers.
 *
 * The rows ARE the layout: each form draws exactly its screen's rows, and the
 * test reads the form to hold it. A `fill` box (Note, Denumire, the MRZ) takes
 * the panel's whole inner width and does not count towards it.
 */
export const SCREEN_ROWS = {
  naturalPerson: NATURAL_PERSON_ROWS,
  judicialPerson: {
    // Denumire, the whole width — Poreclă | Tip — CUI | Nr. Reg. Com. (rule 14: the
    // identifiers together; #37.57 took the system ID out — it is the heading's corner)
    // — Note, the whole width.
    identity: [
      ["name"],
      ["nickname", "judicialPersonTypeId"],
      ["cuiNumber", "tradeRegisterNumber"],
      ["notes"],
    ],
    // Persoană de contact 1, then 2: each label above an XL box holding the name and its button.
    contactPersons: [["contactPerson"], ["contactPerson"]],
  },
  property: {
    // Nr. tarla / sola | Nr. parcelă (rule 14; not on an urban type; #37.57 took the system
    // ID out — it is the heading's corner) — Poreclă — the two areas, the bow-tie marker
    // under them (rule 15) — Nr. CF | Nr. cadastru — Categorie de folosință | Tip proprietate
    // — Note, the whole width.
    cadastral: [
      ["tarlaId", "parcela"],
      ["nickname"],
      ["surfaceAreaMp", "calculatedAreaMp"],
      ["carteFunciara", "cadastralNumber"],
      ["useCategoryId", "propertyTypeId"],
      ["notes"],
    ],
    // Stradă — Adresă Street View (box, „Preia", help; the hint under them) — Cod poștal |
    // Localitate — Județ | Țară, the „Țară" default under them — Note, the whole width.
    address: [
      ["address.streetLine"],
      ["address.streetViewStreetLine"],
      ["address.postalCode", "address.locality"],
      ["address.county", "address.country"],
      ["address.notes"],
    ],
  },
  document: {
    // Tip document (XXL, the no-form hint under it) — Etichetă scurtă — Subiect — Note
    // extinse, each the whole width: what the document is, what it is called, what it is about.
    general: [["documentTypeId"], ["title"], ["subject"], ["notes"]],
    // Instituție / Notariat — Nr. document | Data (rule 14) — then the fees group's own
    // fields, packed (`packFieldRows`).
    fees: [["institutionId"], ["nrDocument", "dateDocument"]],
  },
} as const satisfies {
  naturalPerson: Record<string, readonly (readonly NpField[])[]>;
  judicialPerson: Record<string, readonly (readonly JpField[])[]>;
  property: Record<string, readonly (readonly PropField[])[]>;
  document: Record<string, readonly (readonly DocField[])[]>;
};
export type Screen = keyof typeof SCREEN_ROWS;

/** The fewest units that hold each panel's widest row. */
function panelUnitsOf<R extends Record<string, readonly (readonly string[])[]>>(
  rows: R,
  widths: Readonly<Record<string, FieldWidth>>,
): { [K in keyof R]: number } {
  return Object.fromEntries(
    Object.entries(rows).map(([panel, r]) => [panel, unitsFor(panelRem(widestRow(r, widths)))]),
  ) as { [K in keyof R]: number };
}

function mapUnits<T extends Record<string, number>, V>(units: T, f: (n: number) => V): { [K in keyof T]: V } {
  return Object.fromEntries(Object.entries(units).map(([k, n]) => [k, f(n)])) as { [K in keyof T]: V };
}

/** The shared address block, stacked: Stradă is its widest row (24rem) — 3 units on every screen. */
const ADDRESS_PANEL_UNITS = unitsFor(panelRem(widestRow(ADDRESS_ROWS, ADDRESS)));

/** Each form panel in units, by screen. */
export const PANEL_UNITS = {
  naturalPerson: { ...panelUnitsOf(SCREEN_ROWS.naturalPerson, NATURAL_PERSON), address: ADDRESS_PANEL_UNITS },
  //  identity 3 — Poreclă | Tip and ID | CUI | Nr. Reg. Com., both 26.5rem; contactPersons 2 — the XL box, 17rem.
  judicialPerson: { ...panelUnitsOf(SCREEN_ROWS.judicialPerson, JUDICIAL_PERSON), address: ADDRESS_PANEL_UNITS },
  //  cadastral 3 — Cod | Nr. tarla / sola | Nr. parcelă, 26.5rem; address 3 — Stradă, 24rem.
  //  corners 4: the four fixed columns are 19rem and a row's ↑ ↓ „Editează" „Șterge" need about
  //  15rem more to stay on one line; 3 units leave 9rem. map and streetView 3 (rule 20; Adrian's
  //  Ask first): 28.1rem inside, about the 30.4 they were, and beside Date cadastrale at 1366 px.
  property: {
    ...panelUnitsOf(SCREEN_ROWS.property, { ...PROPERTY, ...PROPERTY_ADDRESS }),
    corners: 4,
    map: 3,
    streetView: 3,
  },
  //  general 3 — Tip document at XXL, 24rem; fees 3 — Instituție at XXL (a fees group may
  //  widen it: `packFieldRows`). pages 4 — PAGES_PANEL_REM is exactly unitsRem(4) (rule 20).
  //  succession 3 — Nume, Calitate and „Elimină".
  document: {
    ...panelUnitsOf(SCREEN_ROWS.document, DOCUMENT),
    pages: 4,
    succession: 3,
  },
} as const;

/** Each panel's inner width — whole units, so at least its widest row. */
export const PANEL_UNIT_INNER_REM = {
  naturalPerson: mapUnits(PANEL_UNITS.naturalPerson, unitsInnerRem),
  judicialPerson: mapUnits(PANEL_UNITS.judicialPerson, unitsInnerRem),
  property: mapUnits(PANEL_UNITS.property, unitsInnerRem),
  document: mapUnits(PANEL_UNITS.document, unitsInnerRem),
} as const;

/** Each panel's style — whole units, not `PANEL_STYLE`'s 32rem. */
export const PANEL_UNIT_STYLE = {
  naturalPerson: mapUnits(PANEL_UNITS.naturalPerson, unitStyle),
  judicialPerson: mapUnits(PANEL_UNITS.judicialPerson, unitStyle),
  property: mapUnits(PANEL_UNITS.property, unitStyle),
  document: mapUnits(PANEL_UNITS.document, unitStyle),
} as const;

/** The mini-map and Street View boxes: their tile's whole inner width, 22rem tall (rule 20). */
export const MAP_BOX_HEIGHT_REM = 22;
export const MAP_BOX_STYLE: CSSProperties = { width: rem(PANEL_UNIT_INNER_REM.property.map), height: rem(MAP_BOX_HEIGHT_REM) };

/**
 * The list tiles in units (#37.27). Rule 17: the same list is the same size on
 * every screen — a name, a role and the two buttons stacked are 4 units, Acte
 * (type, title, role, buttons) 5.
 *
 * Slice #37.63: META INFO (5 units, two columns of sections) became two tiles,
 * each the fewest units that hold it once the explanations went into bubbles:
 * „Clasificare subiectivă" 2 — a dropdown and „Marchează ca verificat" side by
 * side, the widest being Proveniență's „Fișier de coordonate (.txt)" — and
 * „Conexiuni" 3 — the tag box (`metaTag`, XL) and its „Adaugă" button.
 */
/**
 * ONE LINE A ROW.                                                  (Slice #37.64)
 *
 * A row of the Document's „Persoane", „Proprietăți" and „Acte corelate" is a
 * radio button, one content field and its buttons, on one line: the content is
 * cut with „…" and shown whole on hover, and every button sits in a SLOT of a
 * fixed width, in the same place on every row — a row without that button
 * leaves its slot empty, so the buttons line up down the tile
 * (`src/components/tiles/one-line-rows.tsx`).
 *
 * The slots, in rem: „Cotă" is the orange icon + word at `xs` (16 px icon, a
 * 6 px gap, the word at 12 px, `px-2`, the border — 66 px) with room to spare;
 * the other three are the 26-px `xs` icon squares (`SIZE_SQUARE.xs`).
 */
export const ROW_SLOT_REM = { share: 4.5, relation: 1.625, view: 1.625, preview: 1.625 } as const;
export type RowSlot = keyof typeof ROW_SLOT_REM;
/** The radio button's slot. */
export const ROW_SELECT_REM = 1;
/** The gap between the radio, the content and the buttons (`gap-2`), and between two slots (`gap-1`). */
export const ROW_GAP_REM = 0.5;
export const ROW_SLOT_GAP_REM = 0.25;
/** A row's own padding, each side (`px-2`). */
export const ROW_PADDING_REM = 0.5;

/**
 * „A typical content" (the header's words) per kind of row, in rem at the rows'
 * 14 px: a person's „Nume (Rol)" — „Popescu Ion Gheorghe (Cumpărător)", 33
 * characters, about 240 px — 16rem; a property's name, the longest the archive
 * holds (`PROPERTY_NAME_PX`, 273 px); a document's „Etichetă scurtă (Tip)" 16rem.
 * Anything longer is cut with „…" and shown whole on hover, so this decides the
 * tile's units, never what the row can hold.
 */
export const ROW_CONTENT_REM = { person: 16, property: 273 / 16, document: 16 } as const;

/** The icon of a row's kind (#37.65), 16 px, after the radio. */
export const ROW_ICON_REM = 1;

/** The width a one-line row needs: its padding, the radio, the kind's icon if any, the content and its slots. */
export function oneLineRowRem(slots: readonly RowSlot[], contentRem: number, icon = false): number {
  const slotsRem = slots.reduce((sum, s) => sum + ROW_SLOT_REM[s], 0) + Math.max(0, slots.length - 1) * ROW_SLOT_GAP_REM;
  const iconRem = icon ? ROW_ICON_REM + ROW_GAP_REM : 0;
  return 2 * ROW_PADDING_REM + ROW_SELECT_REM + ROW_GAP_REM + iconRem + contentRem + ROW_GAP_REM + slotsRem;
}

/** The fewest units whose tile holds that row inside its list frame (1 px a side) — rule 17. */
export function oneLineRowUnits(slots: readonly RowSlot[], contentRem: number, icon = false): number {
  return unitsFor(panelRem(oneLineRowRem(slots, contentRem, icon) + 2 * PANEL_BORDER_REM));
}

/**
 * „Corelate" (Slice #37.65): the four kinds of row in one tile, so one set of
 * slots — „Cotă" first, the relationship before „Vizualizare", then
 * „Previzualizare" — every row's in the same place whatever its kind.
 */
export const RELATED_SLOTS: readonly RowSlot[] = ["share", "relation", "view", "preview"];

/**
 * „Corelate"'s units: the fewest that hold its widest row — the icon, the
 * longest property name and all four slots: 4. The same on the four screens
 * (rule 17); #37.66 and #37.67 take it from here.
 */
export const RELATED_UNITS = oneLineRowUnits(RELATED_SLOTS, ROW_CONTENT_REM.property, true);

// Slice #37.58: Proprietăți 5 — a property's name holds on one line (`tilePropertyName`).
const PERSON_LIST_UNITS = { associations: 4, properties: 5, documents: 5, classification: 2, connections: 3 } as const;
export const LIST_UNITS = {
  naturalPerson: PERSON_LIST_UNITS,
  judicialPerson: PERSON_LIST_UNITS,
  // „Proprietăți corelate": a property's name on one line, a role, the buttons — 5 (#37.58).
  // Persoane: a name, a role, the buttons — 4. Acte: a property's documents carry no role,
  // so type, title and the buttons — 4. META INFO 5.
  property: { associations: 5, persons: 4, documents: 4, classification: 2, connections: 3 },
  // Slice #37.65: Persoane, Proprietăți and „Acte corelate" (3 units each since #37.64) are one
  // tile, „Corelate" — `RELATED_UNITS`, 4.
  document: { related: RELATED_UNITS, classification: 2, connections: 3 },
} as const;

/** The share panel (#37.64): the three boxes at L, under one another, inside its padding. */
export const SHARE_PANEL_STYLE: CSSProperties = { width: rem(panelRem(SCALE.L)) };

/**
 * RULE 18 — DATA-DRIVEN PANELS GET A PACKING RULE, NOT ROWS.   (Slice #37.31)
 *
 * A document type's own fields are data, so nobody writes their rows. They flow
 * in form order into rows of the panel's inner width; a `full` field (a
 * textarea, and every Certificate și referințe field) takes a row of its own at
 * the panel's whole width. The panel is the fewest units that hold its widest
 * box — and the boxes of any fixed rows it also draws (`baseRows`, the fees
 * panel's Instituție and Nr. document | Data) — never fewer than `minUnits`.
 * One pure function, so a new type needs no layout work. Each box keeps the
 * width `templateFieldWidth` gave it (#37.15); this decides only the rows.
 *
 * AND A PANEL OF DROPDOWNS TAKES A THIRD UNIT WHEN THAT PAIRS THEM. (#37.53)
 * Since #37.53 a dropdown is as wide as its widest choice — most of a CVC's
 * 10rem — but a 2-unit panel is 17.875rem inside, and two of them with the gap
 * are 20.5. So a panel holding two or more dropdowns is packed at 3 units as
 * well (28.125rem inside), and takes the 3 when its fields come out in fewer
 * rows. Form order is kept; no field moves to make a pair. Measured on the six
 * seeded forms: six panels go from 2 units to 3 (the CVC's Financiar, Excepție
 * cadastru, Declarații și garanții and Declarații și obligații legale — named
 * „Stare juridică afirmată" and „Conformitate și formalități" until #37.54 —
 * the Act adițional's Act părinte and Clauze completate); every other panel is
 * as it was.
 */
export interface PackItem {
  key: string;
  width: FieldWidth;
  /** Takes a row of its own at the panel's whole width. */
  full?: boolean;
}

export function packFieldRows(
  items: readonly PackItem[],
  { minUnits = 2, baseRowsRem = 0 }: { minUnits?: number; baseRowsRem?: number } = {},
): { units: number; rows: string[][] } {
  const widest = Math.max(baseRowsRem, 0, ...items.filter((i) => !i.full).map((i) => boxRem(i.width)));
  const units = Math.max(minUnits, unitsFor(panelRem(widest)));
  const packed = packAt(items, units);
  const dropdowns = items.filter((i) => !i.full && i.width.kind === "select").length;
  if (units >= 3 || dropdowns < 2) return packed;
  const wider = packAt(items, 3);
  return wider.rows.length < packed.rows.length ? wider : packed;
}

/** The rows `items` flow into at `units` wide (rule 18). */
function packAt(items: readonly PackItem[], units: number): { units: number; rows: string[][] } {
  const inner = unitsInnerRem(units);
  const rows: string[][] = [];
  let row: PackItem[] = [];
  const flush = () => {
    if (row.length) rows.push(row.map((i) => i.key));
    row = [];
  };
  for (const item of items) {
    if (item.full) {
      flush();
      rows.push([item.key]);
      continue;
    }
    if (row.length && rowRem([...row, item].map((i) => i.width)) > inner) flush();
    row.push(item);
  }
  flush();
  return { units, rows };
}

/**
 * A screen's row of tiles: a whole number of units wide (#37.27) — exactly as
 * many as fit beside the sidebar — so every tile's edge falls on the same lines
 * and the action bar under the form is as wide as the units above it. Never
 * narrower than the screen's widest tile: a narrower window scrolls. `round()`
 * is Chrome 125+; without it the row is its parent's width and only the action
 * bar is wider than the tiles.
 */
export function unitRowStyle(screen: Screen): CSSProperties {
  const step = UNIT_REM + UNIT_GAP_REM;
  const widest = unitsRem(Math.max(...Object.values(PANEL_UNITS[screen]), ...Object.values(LIST_UNITS[screen])));
  return {
    width: `max(${rem(widest)}, calc(round(down, 100% + ${rem(UNIT_GAP_REM)}, ${rem(step)}) - ${rem(UNIT_GAP_REM)}))`,
  };
}

// The Natural Person's entry of each, by the names #37.26–27 gave them.
export const NP_ROWS = SCREEN_ROWS.naturalPerson;
export const NP_PANEL_UNITS = PANEL_UNITS.naturalPerson;
export type NpPanel = keyof typeof NP_PANEL_UNITS;
export const NP_PANEL_INNER_REM: Readonly<Record<NpPanel, number>> = PANEL_UNIT_INNER_REM.naturalPerson;
export const NP_PANEL_STYLE: Readonly<Record<NpPanel, CSSProperties>> = PANEL_UNIT_STYLE.naturalPerson;
export const NP_LIST_UNITS = LIST_UNITS.naturalPerson;
export function npRowStyle(): CSSProperties {
  return unitRowStyle("naturalPerson");
}

/** Beside Valabil de la | Până la: the rest of that row, for „VALABIL", „EXPIRAT" or „EXPIRĂ ÎN n ZILE" (which wraps). */
export const NP_VALIDITY_REM =
  NP_PANEL_INNER_REM.idCard - rowRem([NATURAL_PERSON.idValidFrom, NATURAL_PERSON.idValidUntil]) - STACK_GAP_REM;

// ---- the ID-card dialog, the Natural Person's rows (#37.32) -----------------------------

/**
 * THE ID-CARD DIALOG DRAWS THE NATURAL PERSON'S ROWS.          (Slice #37.32)
 *
 * „Creează persoană din cartea de identitate" shows what it read from a card
 * exactly as the Natural Person's form will show it once saved: the same rows,
 * the same widths, in the same 3-unit panels. So the dialog has no rows of its
 * own: it keeps the fields of `NP_ROWS` a card carries, in their order, and
 * drops a row left empty. Moving a field on the person moves it here.
 * Poreclă, Vârstă, Tip profesional, Note, Tip document and the MRZ are not on a
 * card's review, so they are not here.
 */
export const ID_CARD_DIALOG_FIELDS = [
  "lastName",
  "firstName",
  "cnp",
  "dateOfBirth",
  "gender",
  "placeOfBirth",
  "idDocumentNumber",
  "idCardNumber",
  "idValidFrom",
  "idValidUntil",
  "citizenshipId",
  "idIssuingAuthority",
] as const satisfies readonly NpField[];
export type IdCardDialogField = (typeof ID_CARD_DIALOG_FIELDS)[number];

/** `rows` with only the fields in `keep`, in their order; a row left empty goes. */
export function keepFields<F extends string, K extends string>(
  rows: readonly (readonly F[])[],
  keep: readonly K[],
): Extract<F, K>[][] {
  const kept = new Set<string>(keep);
  return rows.map((row) => row.filter((f): f is Extract<F, K> => kept.has(f))).filter((row) => row.length > 0);
}

export const ID_CARD_DIALOG_ROWS = {
  identity: keepFields(NP_ROWS.identity, ID_CARD_DIALOG_FIELDS),
  idCard: keepFields(NP_ROWS.idCard, ID_CARD_DIALOG_FIELDS),
} as const;

/**
 * Instituție, its own row under Emisă de: a document's column, not a person's,
 * so it has no width on `NATURAL_PERSON`. Institution names run long („Serviciul
 * Public Comunitar Local de Evidență a Persoanelor …"), so it takes the panel's
 * whole width, and its „create" offer and its retry sit under it (rule 15).
 */
export const ID_CARD_INSTITUTION = { step: "XL", kind: "select", fill: true } as const satisfies FieldWidth;

/**
 * The dialog's card, opted into by `PersonResolutionDialog`'s `wide`: Identitate
 * and Carte de identitate side by side (two 3-unit panels and the unit gap
 * between them, 6 units), the card's padding (1.5rem a side) and room for its
 * scrollbar, which a card capped at 90% of the window's height can show.
 */
export const ID_CARD_DIALOG_CARD_STYLE: CSSProperties = { maxWidth: rem(unitsRem(6) + 2 * 1.5 + 1.5) };

// ---- a Previzualizare tile, on the unit, in its screen's rows (#37.33) ------------------

/**
 * A PREVIEW IS A SMALLER COPY OF THE RECORD.                   (Slice #37.33)
 *
 * A Previzualizare tile is whole width units — a person, a company or a
 * property 3, like the first panel of its screen; a document 4, the page
 * image's width (`PAGES_PANEL_REM` is exactly `unitsRem(4)`) — and shows its
 * fields as that screen does: labels above, in the screen's rows, at the
 * screen's widths. The fields are #37.24's short set per kind; the rows are the
 * screen's, through `keepFields`, so nothing is laid out by hand here.
 */
export const PREVIEW_UNITS = { panel: 3, pages: 4 } as const;
export type PreviewWidth = keyof typeof PREVIEW_UNITS;
export const PREVIEW_STYLE: Readonly<Record<PreviewWidth, CSSProperties>> = {
  panel: unitStyle(PREVIEW_UNITS.panel),
  pages: unitStyle(PREVIEW_UNITS.pages),
};
export const PREVIEW_INNER_REM: Readonly<Record<PreviewWidth, number>> = {
  panel: unitsInnerRem(PREVIEW_UNITS.panel),
  pages: unitsInnerRem(PREVIEW_UNITS.pages),
};

/**
 * #37.24's short set per kind, by the screen's own field names. Slice #37.60: a
 * person's and a company's name is the tile's heading — „Nume Prenume",
 * „Denumire" — so Nume, Prenume and Denumire are not fields under it.
 */
export const PREVIEW_FIELDS = {
  person: ["nickname", "cnp", "dateOfBirth", "placeOfBirth"],
  company: ["nickname", "judicialPersonTypeId", "cuiNumber", "tradeRegisterNumber"],
  property: ["nickname", "parcela", "cadastralNumber", "carteFunciara", "surfaceAreaMp"],
  document: ["documentTypeId", "title", "subject", "nrDocument", "dateDocument"],
} as const;
export type PreviewKind = keyof typeof PREVIEW_FIELDS;

/**
 * A PERSON'S AND A COMPANY'S PREVIEW IS THREE COMPACT LINES.   (Slice #37.60)
 *
 * Line 1 is the name, the tile's heading. Lines 2 and 3 are these, each its
 * values one after the other: Poreclă, CNP — Data nașterii, Locul nașterii;
 * or Poreclă, Tip — Nr. înregistrare (CUI), Nr. registru comerțului. An empty
 * value is left out, and a line with none is not drawn. The tile is as wide as
 * its widest line (and its buttons) need, not a panel's units.
 */
export const PREVIEW_LINES = {
  person: [["nickname", "cnp"], ["dateOfBirth", "placeOfBirth"]],
  company: [["nickname", "judicialPersonTypeId"], ["cuiNumber", "tradeRegisterNumber"]],
} as const satisfies Partial<Record<keyof typeof PREVIEW_FIELDS, readonly (readonly string[])[]>>;
export type PreviewLinesKind = keyof typeof PREVIEW_LINES;

/** Each kind's rows: its screen's, filtered to the short set (a document's Date generale, then Taxe și onorarii). */
export const PREVIEW_ROWS: Readonly<Record<PreviewKind, readonly (readonly string[])[]>> = {
  person: keepFields(SCREEN_ROWS.naturalPerson.identity, PREVIEW_FIELDS.person),
  company: keepFields(SCREEN_ROWS.judicialPerson.identity, PREVIEW_FIELDS.company),
  property: keepFields(SCREEN_ROWS.property.cadastral, PREVIEW_FIELDS.property),
  document: keepFields([...SCREEN_ROWS.document.general, ...SCREEN_ROWS.document.fees], PREVIEW_FIELDS.document),
};

/** Each kind's widths: its screen's. */
export const PREVIEW_WIDTHS: Readonly<Record<PreviewKind, Readonly<Record<string, FieldWidth>>>> = {
  person: NATURAL_PERSON,
  company: JUDICIAL_PERSON,
  property: PROPERTY,
  document: DOCUMENT,
};

/** The width a preview shows a field without one at: the tile's whole inner width. */
export const PREVIEW_FILL: FieldWidth = { step: "TILE", kind: "grows", fill: true };

// ---- table columns (#37.16) ------------------------------------------------------------

/**
 * TABLES FOLLOW THE SAME RULE: THE WINDOW DECIDES HOW MANY COLUMNS ARE VISIBLE
 * BEFORE THE TABLE SCROLLS SIDEWAYS, NEVER HOW WIDE A COLUMN IS.  (Slice #37.16)
 *
 * Every list and association tab lays its table out `table-fixed`, with a
 * `<colgroup>` from here (`<FixedColumns>`, `src/components/table/fixed-columns.tsx`)
 * and the table exactly as wide as its columns (`columnsStyle`). So a column is
 * the same width at 1366 and at 2560 px, and ticking a column in „Câmpuri
 * afișate" makes the table WIDER instead of squeezing the others. A window
 * narrower than the table scrolls it sideways.
 *
 * A column is a step of the field scale for its CONTENT plus the cells' padding
 * (`px-4` on each side in the lists; an association tab's `px-3` leaves its
 * content half a rem more). One name, one width: Cod is `COLUMN.code` in a list,
 * in an association tab and in global search.
 *
 * Two kinds, as for fields: `fixed` (codes, dates, numbers, chips, buttons) is
 * as wide as its longest value; `wraps` (names, titles, places) wraps onto more
 * lines inside its width and the row grows downward.
 *
 * `m:` quotes `measure-fields`: the field's own row where #37.12 measured it,
 * and the LIST rows this slice added for what the lists show that no field is
 * (a person's display name, a role, a group or stamp code, who last wrote).
 */
export const CELL_PADDING_REM = 2;

/**
 * The longest property name the lists must hold on one line (Slice #37.58): 38
 * characters, 273 px in the lists' 14-px Arial — measured on every property's
 * nickname in the local archive and the e2e records on 2026-10-02 (the
 * longest is the archive's; `PROP.nickname` in measure-fields agrees: 8 · 38 · 38).
 */
export const PROPERTY_NAME_PX = 273;

export interface ColumnWidth {
  /** The content's width, a step of the scale — or, for the two tiny controls, rem. */
  content: Step | number;
  kind: "fixed" | "wraps";
}

const colRem = (c: ColumnWidth): number =>
  (typeof c.content === "number" ? c.content : SCALE[c.content]) + CELL_PADDING_REM;

export const COLUMN = {
  // Controls
  select: { content: 1, kind: "fixed" }, //                 a checkbox or radio
  selectNew: { content: "XS", kind: "fixed" }, //           a list's checkbox and its „Nou!" badge
  selectBadges: { content: "S", kind: "wraps" }, //         the property list's: „Nou!", and „Încrucișat" on a line of its own
  open: { content: "S", kind: "fixed" }, //                 „Deschide" / „Vizualizare", an xs button
  openPreview: { content: "L", kind: "fixed" }, //          „Vizualizare" and „Previzualizare" (#37.24), two xs buttons on an association tile
  openPreviewStacked: { content: "M", kind: "fixed" }, //   the same two, one above the other, on a Natural Person's unit tile (#37.27)
  // Every entity
  code: { content: "S", kind: "fixed" }, //                 a calculation run's „CALC00012" — since #37.57 never a record's system ID
  importance: { content: "M", kind: "fixed" }, //           „Ridicată"
  relevance: { content: "M", kind: "fixed" }, //            „De perspectivă" (14)
  provenance: { content: "M", kind: "fixed" }, //           „Import AI"
  // People
  personName: { content: "XL", kind: "wraps" }, //          LIST.personDisplayName
  personNickname: { content: "L", kind: "wraps" }, //       NP.nickname, JP.nickname
  personType: { content: "S", kind: "fixed" }, //           „Fizică" / „Juridică"
  // Slice #37.60 — „Câmpuri afișate" on the two persons' lists: their „Identitate" fields.
  cnp: { content: "M", kind: "fixed" }, //                  13 digits, NP.cnp
  birthDate: { content: "M", kind: "fixed" }, //            dd.mm.yyyy, NP.dateOfBirth
  age: { content: "XS", kind: "fixed" }, //                 worked out from the date of birth
  gender: { content: "M", kind: "fixed" }, //               „Masculin" / „Feminin"
  birthPlace: { content: "L", kind: "wraps" }, //           NP.placeOfBirth (XL on the form) — wraps on the list
  professionalType: { content: "L", kind: "wraps" }, //     „Tip Profesional", a lookup's name
  companyType: { content: "M", kind: "wraps" }, //          JP „Tip": longest „Consiliu Local" (14)
  cui: { content: "M", kind: "fixed" }, //                  „RO12345678", JP.cuiNumber
  tradeRegister: { content: "M", kind: "fixed" }, //        „J40/12345/2020", JP.tradeRegisterNumber
  role: { content: "L", kind: "wraps" }, //                 LIST.role* — a role chip, or a certificate party's quality
  // The Natural Person's list tiles (#37.27): each table fills its tile of whole units — tileTableRem().
  tileName: { content: 12, kind: "wraps" }, //              a person's name on Persoane / Persoane corelate
  // Slice #37.58: a property's name on Proprietăți / „Proprietăți corelate", ONE line — the
  // longest in the archive and the test data is 38 characters, 273 px (`PROPERTY_NAME_PX`);
  // past 22.5rem (360 px) it is cut with „…" and shown whole on hover, never wrapped.
  tilePropertyName: { content: 22.5, kind: "fixed" },
  tileRole: { content: "M", kind: "wraps" }, //             a role chip, wrapping
  tileDocType: { content: "M", kind: "wraps" }, //          a document's type, wrapping
  tileDocTitle: { content: 12, kind: "wraps" }, //          a document's title, wrapping
  cota: { content: "L", kind: "fixed" }, //                 an input showing „fără cotă" (italic) when empty
  cotaMp: { content: "L", kind: "fixed" }, //               „fără suprafață"
  cotaMod: { content: "L", kind: "fixed" }, //              a dropdown, „nespecificat"
  // Documents
  documentType: { content: "XL", kind: "wraps" }, //        DOC.documentTypeId: longest 41 — wraps to two lines
  documentTitle: { content: "XXL", kind: "wraps" }, //      DOC.title: 105 · 151 · 73 — wraps
  nrDocument: { content: "M", kind: "fixed" }, //           DOC.nrDocument: 24 · 13 · 6
  dateDocument: { content: "M", kind: "fixed" }, //         dd.mm.yyyy
  // Slice #37.62 — „Câmpuri afișate" on the Documents list. Nr. pagini, Persoane and
  // Proprietăți are `count`, „Adăugat la" is `date` (below).
  institution: { content: "XL", kind: "wraps" }, //         a lookup_institution name — „Biroul Notarial …"; XXL on the form, wraps here
  documentSubject: { content: "XL", kind: "wraps" }, //     DOC.subject, a sentence — wraps
  // Properties
  propertyLabel: { content: "XL", kind: "wraps" }, //       „tarla / parcelă (poreclă)" or the nickname
  propertyNickname: { content: "XL", kind: "wraps" }, //    PROP.nickname: 8 · 38 · 38
  parcela: { content: "M", kind: "fixed" }, //              PROP.parcela
  tarlaSola: { content: "M", kind: "fixed" }, //            PROP.tarlaId
  cadastralNumber: { content: "M", kind: "fixed" }, //      PROP.cadastralNumber: 13
  carteFunciara: { content: "M", kind: "fixed" }, //        PROP.carteFunciara
  surfaceAreaMp: { content: "M", kind: "fixed" }, //        „1234567.89"
  calculatedAreaMp: { content: "M", kind: "fixed" }, //     „1234567.89"
  locality: { content: "L", kind: "wraps" }, //             ADDR.propertyLocality
  // Global search
  entityType: { content: "L", kind: "fixed" }, //           „Proprietate", or „Persoană" and „Juridic"
  searchName: { content: "XL", kind: "wraps" }, //          a name, a title or a property label
  groups: { content: "M", kind: "wraps" }, //               „AA 01" chips
  stamps: { content: "M", kind: "wraps" }, //               stamp code chips
  updatedBy: { content: "L", kind: "wraps" }, //            LIST.updatedBy
  metadataUpdated: { content: "M", kind: "fixed" }, //      a date
  // The other screens (#37.22) — the admin lists, the dashboard, the calculation
  date: { content: "M", kind: "fixed" }, //                 dd.mm.yyyy — a run's, an expiry
  dateTime: { content: "L", kind: "fixed" }, //             „28.09.2026, 14:05" — when an access request came, and was answered
  count: { content: "S", kind: "fixed" }, //                a group's or stamp's members, a tag's uses, a run's parcels
  rowActions: { content: "M", kind: "fixed" }, //           „Editează" and „Șterge" — two xs buttons, which wrap rather than overflow
  groupCode: { content: "M", kind: "fixed" }, //            „AA 01 (12)", and the group's target under it
  description: { content: "XXL", kind: "wraps" }, //        a group's description; a stamp's code, short description and notes
  tag: { content: "L", kind: "wraps" }, //                  a tag, in mono
  username: { content: "L", kind: "wraps" }, //             who asked for access
  email: { content: "XL", kind: "wraps" }, //               their email; NP.personalEmail1 is XL too
  requestStatus: { content: "M", kind: "fixed" }, //        „În așteptare", with its icon
  decision: { content: "L", kind: "fixed" }, //             „Aprobă" and „Respinge", two sm buttons with icons
  expiryStatus: { content: "L", kind: "fixed" }, //         „Expiră în 30 de zile"
  algorithm: { content: "M", kind: "fixed" }, //            „Divizare parcelă"
  runStatus: { content: "S", kind: "fixed" }, //            „Activ" / „Depășit"
  outputRole: { content: "L", kind: "fixed" }, //           „Parcelă proprietar"
  viewLink: { content: "L", kind: "fixed" }, //             „Vezi proprietatea →", or „șters"
  percent: { content: "S", kind: "fixed" }, //              „33.333%"
  area: { content: "M", kind: "fixed" }, //                 „1234567.89", as surfaceAreaMp
  // Slice #37.37 — the value-list editor's table, a column per field of the list
  valueName: { content: "XL", kind: "wraps" }, //           a list's „Denumire" — „Contract de Vânzare-Cumpărare"
  valueText: { content: "L", kind: "wraps" }, //            any other text field — an indicativ, a converse name, a type of institution
  valueKey: { content: "L", kind: "wraps" }, //             a document type's key, „CONTRACT_VANZARE", in mono — the longest (22 characters, 356 px) wraps
  valueFlag: { content: "S", kind: "fixed" }, //            a checkbox field, „✓" or „–" — S for its header, „PROPRIETATE"
  valueDescription: { content: "XL", kind: "wraps" }, //    a list's description, which wraps downward
  valueStatus: { content: "L", kind: "wraps" }, //          „Fără formular" / „De revizuit" — the review lists' status
  // Slice #37.37 — the Form editor's table (Formular pentru „{type}")
  feOrder: { content: 4, kind: "fixed" }, //                ↑ and ↓, two xs buttons
  feLabel: { content: "L", kind: "wraps" }, //              Etichetă (RO) / (EN), with the key under the RO one; grows downward
  feType: { content: "M", kind: "fixed" }, //               „Text lung", the longest type
  feGroup: { content: "L", kind: "fixed" }, //              Panou, which shows both spellings: „Financiar / Financial"
  feTab: { content: "M", kind: "fixed" }, //                Filă, a short name
  feHint: { content: "XL", kind: "wraps" }, //              Indiciu AI, and a select's options under it; grows downward
  feActions: { content: "S", kind: "fixed" }, //            „Elimină", an xs button
} as const satisfies Record<string, ColumnWidth>;
export type ColumnName = keyof typeof COLUMN;

/** One column's width. */
export function columnStyle(name: ColumnName): CSSProperties {
  return { width: rem(colRem(COLUMN[name])) };
}

/** A fixed table, exactly as wide as the columns it shows. */
export function columnsStyle(names: readonly ColumnName[]): CSSProperties {
  return { width: rem(names.reduce((sum, n) => sum + colRem(COLUMN[n]), 0)) };
}

/** A column's width in rem (tests, and the e2e check). */
export function columnRem(name: ColumnName): number {
  return colRem(COLUMN[name]);
}

/**
 * The Natural Person's list tiles' columns (#37.27). Each set fills its tile's
 * table width exactly — `field-widths.test.ts` sums them against
 * `tileTableRem(NP_LIST_UNITS[…])`. Persoane drops „Tip" (Fizică / Juridică):
 * Adrian asked for the name, the relationship and the buttons.
 */
export const NP_LIST_COLUMNS = {
  associations: ["select", "tileName", "tileRole", "openPreviewStacked"],
  properties: ["select", "tilePropertyName", "tileRole", "openPreviewStacked"],
  documents: ["select", "tileDocType", "tileDocTitle", "tileRole", "openPreviewStacked"],
  // Slice #37.30: a property's Acte — its documents carry no role — at 4 units.
  documentsWithoutRole: ["select", "tileDocType", "tileDocTitle", "openPreviewStacked"],
  // Slice #37.64: a document's Persoane, Proprietăți and „Acte corelate" are one-line rows
  // (`oneLineRowUnits`), not tables — their two column sets went with them.
  // Slice #37.58: a property's „Proprietăți corelate" — its name on one line, the relation, the buttons.
  propertyAssociations: ["select", "tilePropertyName", "tileRole", "openPreviewStacked"],
} as const satisfies Record<string, readonly ColumnName[]>;

// ---- tiles (#37.17) -------------------------------------------------------------------------

/**
 * Tiles on a small scale (Field.Widths.v02: a 1366-pixel laptop fits two small
 * tiles, a 1920-pixel monitor three, a 2560-pixel one four). A small tile IS a
 * panel; a wide one is two panels and the gap between them, for a tile whose
 * content is not a table of fixed columns (META INFO). An association list's
 * tile is as wide as its table, which #37.16 fixed.
 */
export const TILE_REM = { small: PANEL_REM, wide: 2 * PANEL_REM + PANEL_GAP_REM } as const;
export const WIDE_TILE_STYLE: CSSProperties = { width: rem(TILE_REM.wide) };

// ---- every other screen (#37.22) ------------------------------------------------------------

/**
 * EVERY OTHER SCREEN FOLLOWS THE SAME RULE.                    (Slice #37.22)
 *
 * The home page, the „Asociază …" screens, and the administration screens —
 * Setări, Liste de valori, Utilizatori & Acces, Grupuri, Ștampile, Etichete,
 * Texte de ajutor, Calcul and its history, Motorul de tipuri, Schimbă parola —
 * on #37.12's rule. After this slice no screen gets a wider field because the
 * window got wider:
 *   - a page sits left-aligned beside the sidebar: no `mx-auto`, no `max-w-*xl`;
 *   - its view is a `SCREEN_COLUMN`: as wide as its widest fixed piece — a
 *     panel, a table, a row of boxes — and never as wide as the window; its
 *     prose wraps inside it;
 *   - a section card is a panel (`PANEL_STYLE`), a wide panel
 *     (`WIDE_TILE_STYLE`), or as wide as the table it holds;
 *   - a sentence of prose stops at `PROSE_STYLE` and grows downward, so a
 *     long one cannot stretch the column it sits in;
 *   - every box names a step below, and every table is #37.16's.
 *
 * Dialogs keep their card (`max-w-sm`, `-md`, `-lg`, and the value lists'
 * wider editors): fixed by design, and out of this slice. So is the import
 * wizard, which has its own rule file (FU-269).
 *
 * THE SCALE DID NOT GROW. Every box here takes a step that already existed.
 */
/**
 * The view's column: as wide as its widest FIXED child. A paragraph, the
 * header, a status line or an alert does not count: `w-0 min-w-full` takes it
 * out of the column's width and then fills it, so a long sentence — a
 * document's title under the heading, an error — wraps inside the column
 * instead of stretching it to the window.
 *
 * ⚠️ **NOT AN `sr-only` ONE.** A live region kept for screen readers is
 * `position: absolute`, so `min-w-full` would size it by the page, not by the
 * column, and push the page sideways by the sidebar's width — measured on
 * the „Asociază persoană" screen, 247 px at 1920. `:not(.sr-only)` leaves it be.
 */
export const SCREEN_COLUMN =
  "flex w-fit max-w-full flex-col " +
  "[&>p]:w-0 [&>p]:min-w-full [&>header]:w-0 [&>header]:min-w-full " +
  "[&>[role=status]:not(.sr-only)]:w-0 [&>[role=status]:not(.sr-only)]:min-w-full " +
  "[&>[role=alert]:not(.sr-only)]:w-0 [&>[role=alert]:not(.sr-only)]:min-w-full";

/**
 * A column is never narrower than a panel, so a screen whose only fixed piece
 * is a button still gives its prose a panel's width to wrap in; the
 * calculation, which opens on a paragraph, takes two panels.
 */
export const SCREEN_COLUMN_STYLE: CSSProperties = { minWidth: rem(PANEL_REM) };
export const WIDE_COLUMN_STYLE: CSSProperties = { minWidth: rem(TILE_REM.wide) };

/** Prose stops at two panels and the gap, and wraps. */
export const PROSE_STYLE: CSSProperties = { maxWidth: rem(TILE_REM.wide) };

/** A caption under one box stops at a panel's width (`max-w-lg` before). */
export const CAPTION_STYLE: CSSProperties = { maxWidth: rem(PANEL_REM) };

/** A grid of `columns` boxes, each one step wide — the calculation's figures, the help editor's texts. */
export function stepGridStyle(step: Step, columns: number, gapRem = 0.75): CSSProperties {
  return { display: "grid", gridTemplateColumns: `repeat(${columns}, ${rem(SCALE[step])})`, gap: rem(gapRem) };
}

/** The calculation's preview map: 6 width units (#37.35, rule 20; two panels before), as tall as it was (420 px). */
export const CALC_MAP_UNITS = 6;
export const CALC_MAP_STYLE: CSSProperties = { width: rem(unitsRem(CALC_MAP_UNITS)), height: rem(26.25) };

/** The list of screens and hints beside the help editor (18rem before; XL now). */
export const HELP_NAV_STYLE: CSSProperties = { width: rem(SCALE.XL) };

export const SCREEN = {
  // The „Asociază …" screens: the search boxes and the role
  searchName: { step: "L", kind: "fixed" }, //         a person's name, typed to find them (w-48 before)
  searchCode: { step: "M", kind: "fixed", sample: "HHHHH00000" }, // a code (w-32 and w-36 before)
  searchText: { step: "XL", kind: "fixed" }, //        one box over code, title and more (w-64 before)
  role: { step: "XL", kind: "select" }, //             a role — „Moștenitor testamentar"; longer ones show on hover
  // Grupuri and Ștampile: the add form and the editor
  groupTarget: { step: "L", kind: "select" }, //       „Persoane fizice" — also the read-only box (200 px before)
  groupCode: { step: "M", kind: "fixed", sample: "HH 00" }, // „AA 01" (140 px before)
  groupDescription: { step: "XXL", kind: "lines", rows: 2 }, // at most 500 characters
  stampShortDescription: { step: "XXL", kind: "fixed" }, // a stamp's short description (max-w-sm before)
  stampNotes: { step: "XXL", kind: "lines", fold: NOTE_FOLD_LINES, rows: 3 },
  groupCodePending: { step: "XL", kind: "fixed" }, //  „Codul se atribuie la salvare", before there is a code
  memberSearch: { step: "XXL", kind: "fixed" }, //     the search above the candidates
  // Setări
  timeFrameDays: { step: "S", kind: "fixed", sample: "0000" }, // 1–3650, with the spinner (w-20 before)
  // Schimbă parola
  password: { step: "XL", kind: "fixed" },
  // Texte de ajutor
  helpText: { step: "XXL", kind: "lines", rows: 4 },
  // Calcul
  calcGroupDescription: { step: "XXL", kind: "fixed" }, // at most 500, one line
  calcRoadNickname: { step: "XL", kind: "fixed" }, //  a property's nickname, as PROPERTY.nickname
  // Motorul de tipuri
  documentType: { step: "XXL", kind: "select" }, //    the type to distil, as DOCUMENT.documentTypeId (max-w-lg before)
  matchPercent: { step: "M", kind: "select" }, //      „Matching %" (10rem and 8rem before)
  proposedLabel: { step: "XL", kind: "fixed" }, //     a proposed field's label, as TEMPLATE_FIELD.text
  proposedType: { step: "M", kind: "select" }, //      „Text lung"
  proposedHint: { step: "XXL", kind: "fixed" }, //     the wordings the samples used
  // META INFO, on the four detail screens (Slice #37.23 — the guard found them)
  metaTag: { step: "XL", kind: "fixed" }, //           a tag, typed to add it (flex-1 up to max-w-xs before)
  metaCrossRefNote: { step: "XXL", kind: "fixed" }, // a cross-reference's note, at most 500 (flex-1 before)
  listSearch: { step: "XL", kind: "fixed" }, //        a list's search box (flex-1 up to max-w-md before; the natural persons' is w-64)
  // The value-list editor's add/edit form and „Roluri pe Document"'s pickers (Slice #37.37)
  valueName: { step: "XL", kind: "fixed" }, //         a list's „Denumire"
  valueText: { step: "L", kind: "fixed" }, //          any other one-line field — an indicativ, a key, a converse name
  valueDescription: { step: "XXL", kind: "lines", rows: 3 }, // a description, which grows downward
  docPersonsType: { step: "XL", kind: "select" }, //   Tip Document; a longer name shows on hover
  docPersonsRole: { step: "XL", kind: "select" }, //   Rol Persoană
} as const satisfies Record<string, FieldWidth>;
export type ScreenField = keyof typeof SCREEN;

/**
 * A box on one of these screens: its width from `SCREEN`, and the marks the e2e
 * width check reads (`data-width-field`, `data-width-kind`). Spread it on the
 * `<input>`, `<select>` or `<textarea>` — no Tailwind width beside it.
 */
export function screenBox(name: ScreenField, extra?: CSSProperties) {
  const w: FieldWidth = SCREEN[name];
  return { style: { ...boxStyle(w), ...extra }, "data-width-field": name, "data-width-kind": w.kind };
}

/**
 * A section card at a fixed width, marked for the e2e check (`data-panel`):
 * a panel, a wide panel, or — since #37.34 — a whole number of width units.
 */
export function screenPanel(name: string, wide: boolean | number = false) {
  const style = typeof wide === "number" ? unitStyle(wide) : wide ? WIDE_TILE_STYLE : PANEL_STYLE;
  return { style, "data-panel": name };
}

// ---- a screen of unit tiles: the „Asociază …" screens (#37.34) --------------------------

/**
 * THE SCREEN FORM OF THE UNIT ROW.                             (Slice #37.34)
 *
 * #37.22's screens are a `SCREEN_COLUMN` of 32rem and 65rem pieces. A screen
 * of unit tiles is a row of whole units instead, as the four detail screens
 * are (`unitRowStyle`): as many units as the window holds, never fewer than its
 * widest tile, and the tiles flow and wrap in reading order. The „Asociază …"
 * screens are the first; #37.35 and #37.36 use the same form.
 */
export function screenRowStyle(widestUnits: number): CSSProperties {
  const step = UNIT_REM + UNIT_GAP_REM;
  return {
    width: `max(${rem(unitsRem(widestUnits))}, calc(round(down, 100% + ${rem(UNIT_GAP_REM)}, ${rem(step)}) - ${rem(UNIT_GAP_REM)}))`,
  };
}

/** A tile is never narrower than this: two units hold a role, two buttons and a sentence. */
export const MIN_TILE_UNITS = 2;

/** The fewest units whose tile holds these `SCREEN` boxes side by side (labels above). */
export function boxesUnits(names: readonly ScreenField[]): number {
  return Math.max(MIN_TILE_UNITS, unitsFor(panelRem(rowRem(names.map((n) => SCREEN[n])))));
}

/** The fewest units whose tile holds a table of these columns inside its frame (1 px a side). */
export function tableUnits(columns: readonly ColumnName[]): number {
  const table = columns.reduce((sum, n) => sum + columnRem(n), 0);
  return Math.max(MIN_TILE_UNITS, unitsFor(panelRem(table + 2 * PANEL_BORDER_REM)));
}

/**
 * A table that FILLS its tile of `units`: every column at its own width and
 * `fill` — a `wraps` column — taking the rest, so the table is exactly
 * `tileTableRem(units)` wide and its columns still the same at every window.
 */
export function fillColumnRem(columns: readonly ColumnName[], units: number, fill: ColumnName): number {
  const others = columns.filter((n) => n !== fill).reduce((sum, n) => sum + columnRem(n), 0);
  return tileTableRem(units) - others;
}

/** A `SCREEN` box's field, label above it: as wide as its box (rule 16's stacked field). */
export function screenFieldStyle(name: ScreenField): CSSProperties {
  return boxStyle(SCREEN[name]);
}

// ---- the dialogs that open from Date de referință (#37.37) ----------------------------

/**
 * A DIALOG'S CARD IS WHOLE UNITS.                              (Slice #37.37)
 *
 * The value-list editor, „Roluri pe Document" and the Form editor stay dialogs —
 * centred over the page, with their focus trap and z-order — but a card is the
 * fewest whole width units that hold what is inside it: a table exactly as wide
 * as its columns (#37.16), the frame around it (1 px a side), the card's own
 * padding and its border. A window narrower than that keeps the card at the
 * window's width and the table scrolls sideways inside it.
 */
export function dialogUnits(innerRem: number, paddingRem: number): number {
  return unitsFor(innerRem + 2 * PANEL_BORDER_REM + 2 * paddingRem + 2 * PANEL_BORDER_REM);
}

/** A card of `units`, never wider than the window (it sits `inset-x-4` over the page). */
export function dialogCardStyle(units: number): CSSProperties {
  return { maxWidth: rem(unitsRem(units)) };
}

/** A table's columns, summed: what `columnsStyle` gives as a width, as a number. */
export function columnsRem(names: readonly ColumnName[]): number {
  return names.reduce((sum, n) => sum + columnRem(n), 0);
}

/** A box inside a fixed column: the column's content width, without the cell's padding. */
export function columnBoxStyle(name: ColumnName): CSSProperties {
  return { width: rem(columnRem(name) - CELL_PADDING_REM) };
}
