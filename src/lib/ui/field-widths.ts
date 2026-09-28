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
  name: { step: "XXL", kind: "grows" }, //                  „SOCIETATEA AGRICOLĂ … S.R.L." can pass 60 — it wraps; m: 0
  nickname: { step: "L", kind: "grows" }, //                m: 0
  code: { step: "M", kind: "fixed", sample: "HHHHH00000" }, // „JPERS00012"
  judicialPersonTypeId: { step: "L", kind: "select" }, //   m: 10 options, longest „Consiliu Local" (14) — one character past M
  cuiNumber: { step: "M", kind: "fixed", sample: "HH0000000000" }, //    „RO12345678", up to 10 digits; m: 0
  tradeRegisterNumber: { step: "M", kind: "fixed", sample: "H00/00000/0000" }, // „J40/12345/2020"; m: 0
  notes: { step: "TILE", kind: "lines", rows: 1 }, //       m: 0
  contactPerson: { step: "XL", kind: "grows" }, //          a natural person's display name, wrapping; m: 1 · 4
} as const satisfies Record<string, FieldWidth>;

// ---- the Property (#37.14) --------------------------------------------------------------

/** The width a label and its gap take — where a line that belongs to a box, not to a label, starts. */
export const LABEL_INDENT = rem(LABEL_REM + LABEL_GAP_REM);

/**
 * The Property's fields. `measure-fields` 20260928T185247Z-3109 on the local
 * archive's 8 properties: `m:` is `rows · longest · p95`.
 *
 * Nr. tarla / sola at M and Nr. parcelă at L are Adrian's decisions
 * (Field.Widths.v02): a measurement may widen them, never narrow them. At M and
 * L they do not share a panel row, so each has its own.
 */
export const PROPERTY = {
  code: { step: "M", kind: "fixed", sample: "HHHH00000" }, //   „PROP00012"
  tarlaId: { step: "M", kind: "select" }, //                    Adrian's M; m: 3 options, longest „47/2"
  parcela: { step: "L", kind: "fixed", sample: "000/00/00" }, // Adrian's L; m: 3 · 6 · 6
  nickname: { step: "XL", kind: "grows" }, //                   m: 8 · 38 · 38 — p95 is past L (27), so XL; longer wraps
  surfaceAreaMp: { step: "M", kind: "fixed", sample: "0000000.00" }, //  the box shows 1234567.89, no separators; m: 3 · 6
  calculatedAreaMp: { step: "M", kind: "fixed", sample: "0000000.00" }, // toFixed(2), in the mono font; m: 3 · 6
  carteFunciara: { step: "M", kind: "fixed", sample: "000000" }, //       m: 0
  cadastralNumber: { step: "M", kind: "fixed", sample: "HHHHH-00.00-H" }, // m: 1 · 13
  useCategoryId: { step: "M", kind: "select" }, //              m: 8 options, longest „Neproductiv" (11) — v02 guessed L
  propertyTypeId: { step: "L", kind: "select" }, //             m: 14 options, longest „Vegetație Forestieră" (20)
  notes: { step: "TILE", kind: "lines", rows: 1 }, //           m: 1 · 72, at most 300
  /** The Street View address row: the box, then „Preia" and its hint, in the panel's width. */
  streetViewStreetLine: { step: "TILE", kind: "grows" },
  streetViewStreetLineBox: { step: "L", kind: "grows" }, //     m: 0
} as const satisfies Record<string, FieldWidth>;

/**
 * The mini-map and Street View: each fills a small tile (Field.Widths.v02,
 * ≈ 30rem × 22rem) — the panel's whole inner width, 22rem tall. The polygon is
 * fitted with `fitBounds` (40 px padding), so any parcel fits at the default
 * zoom; a property with no corners keeps the same box, so nothing jumps.
 */
export const MAP_BOX_STYLE: CSSProperties = { width: rem(PANEL_INNER_REM), height: rem(22) };

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
  title: { step: "TILE", kind: "grows" }, //             Etichetă scurtă; m: 105 · 151 · 73
  subject: { step: "TILE", kind: "grows" }, //           m: 48 · 428 · 301
  notes: { step: "TILE", kind: "lines", rows: 1 }, //    Note extinse; m: 50 · 2504 · 2283, at most 4000
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
export const PAGES_PANEL_REM = 40;
export const PAGES_PANEL_STYLE: CSSProperties = { width: rem(PAGES_PANEL_REM) };

/**
 * The Document screen's row when the page image is beside the fields: whole
 * panels, then the gap, then the page panel — snapped the way `panelRowStyle`
 * snaps a row of panels, so the action bar under it is exactly as wide. Where
 * one panel and the page image do not fit side by side, the row is the page
 * panel's width and the page panel wraps under the fields.
 */
export function documentRowStyle(): CSSProperties {
  const step = PANEL_REM + PANEL_GAP_REM;
  return {
    width: `max(${rem(PAGES_PANEL_REM)}, calc(round(down, 100% - ${rem(PAGES_PANEL_REM)}, ${rem(step)}) + ${rem(PAGES_PANEL_REM)}))`,
  };
}

/** The fields' column inside `documentRowStyle`: all of it but the gap and the page panel, never less than a panel. */
export function fieldsBesidePagesStyle(): CSSProperties {
  return { width: `max(${rem(PANEL_REM)}, calc(100% - ${rem(PANEL_GAP_REM + PAGES_PANEL_REM)}))` };
}

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
 *   select    as wide as its longest option, from S up to XXL — past XXL it
 *             stays XXL and shows the chosen option in full on hover.
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

/** The narrowest step whose dropdown shows every one of `labels` whole, capped at XXL. */
export function selectStepFor(labels: readonly string[]): { step: Step; capped: boolean } {
  const need = Math.max(0, ...labels.map((l) => textPx(l))) * 1.05 + SELECT_CHROME_PX;
  for (const step of SELECT_STEPS) if (SCALE[step] * 16 >= need) return { step, capped: false };
  return { step: SELECT_STEPS[SELECT_STEPS.length - 1], capped: true };
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
    const { step, capped } = selectStepFor(labels);
    return capped ? { step, kind: "select", capped } : { step, kind: "select" };
  }
  if (forceLines) return { ...TEMPLATE_FIELD.textarea, ...(field.width ? { step: field.width } : {}) };
  const base: FieldWidth = TEMPLATE_FIELD[field.type];
  return field.width ? { ...base, step: field.width } : base;
}

/** Whether `value` names one of the scale's steps — what a template field's `width` may hold. */
export function isStep(value: unknown): value is Step {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SCALE, value);
}

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
  // Every entity
  code: { content: "S", kind: "fixed" }, //                 „JPERS03542", 10 mono characters at 12 px
  importance: { content: "M", kind: "fixed" }, //           „Ridicată"
  relevance: { content: "M", kind: "fixed" }, //            „De perspectivă" (14)
  provenance: { content: "M", kind: "fixed" }, //           „Import AI"
  // People
  personName: { content: "XL", kind: "wraps" }, //          LIST.personDisplayName
  personNickname: { content: "L", kind: "wraps" }, //       NP.nickname, JP.nickname
  personType: { content: "S", kind: "fixed" }, //           „Fizică" / „Juridică"
  role: { content: "L", kind: "wraps" }, //                 LIST.role* — a role chip, or a certificate party's quality
  cota: { content: "L", kind: "fixed" }, //                 an input showing „— fără cotă —" when empty
  cotaMp: { content: "L", kind: "fixed" }, //               „— fără suprafață —"
  cotaMod: { content: "L", kind: "fixed" }, //              a dropdown, „— nespecificat —"
  // Documents
  documentType: { content: "XL", kind: "wraps" }, //        DOC.documentTypeId: longest 41 — wraps to two lines
  documentTitle: { content: "XXL", kind: "wraps" }, //      DOC.title: 105 · 151 · 73 — wraps
  nrDocument: { content: "M", kind: "fixed" }, //           DOC.nrDocument: 24 · 13 · 6
  dateDocument: { content: "M", kind: "fixed" }, //         dd.mm.yyyy
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
