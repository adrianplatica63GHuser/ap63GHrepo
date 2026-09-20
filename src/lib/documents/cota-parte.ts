/**
 * Reading and writing back a cota-parte the way a Romanian types it.
 *                                                              (Slice #36.02)
 *
 * WHAT THIS IS FOR
 *   `person_document.cota_parte` is `numeric(7,4)` and
 *   `person_document.cota_suprafata_mp` is `numeric(12,2)` (migration_084).
 *   What arrives from the Persons tab is not a number, it is what a person
 *   typed off a deed: „63,64”, „63,64%”, „1/2”, „ 10,41 %”, „1.103,38”. This
 *   module is the one place that turns that into a number and back.
 *
 * ⚠️ **PURE, AND IT IMPORTS NOTHING**, for the reason `role-stranding.ts` is
 * pure: „what number did this person type” is answerable in a test without a
 * browser, a server or a connection.
 *
 * ⚠️ **IT DOES NOT REUSE OR EXTEND `normalizeCoordToken`, AND THAT IS
 * DELIBERATE.** `src/app/api/properties/scan-image/route.ts` holds a
 * Romanian-versus-US decimal parser for Stereo 70 coordinates. It is the same
 * SHAPE of problem and it is not the same problem:
 *
 *   * A coordinate is a signed magnitude in the hundreds of thousands, where a
 *     dot before three digits is always a thousands separator. A PERCENTAGE is
 *     never in the thousands, so the same rule applied here turns „63.640”
 *     (someone's 63,64 with a US habit) into 63640 and then into an error, for
 *     a value that was perfectly readable.
 *   * A coordinate is never a fraction. „1/2” is the commonest way a share is
 *     written on a deed.
 *   * `normalizeCoordToken` is module-private inside a Next route handler, so
 *     it is not importable as it stands, and `.claude/rules/ocr-and-parsing.md`
 *     records a live bug in that family. Widening it to serve two callers with
 *     different separator rules would put this slice's input on top of that.
 *
 * So: two parsers, two rules, stated below, and the coordinate one is left
 * alone.
 *
 * ⚠️ **THE DOT MEANS DIFFERENT THINGS IN THE TWO FIELDS, AND THAT IS THE ONLY
 * DIFFERENCE BETWEEN THEM.**
 *
 *   * In a PERCENTAGE a lone dot is always a decimal point. „63.64” is 63,64.
 *     Percentages have no thousands.
 *   * In an AREA a lone dot is a thousands separator when the digits group like
 *     one — `\d{1,3}(\.\d{3})+` — and a decimal point otherwise. „3.182” is
 *     3182 mp, which is what the deed means; „1.5” is 1,5 mp.
 *   * In BOTH, a dot followed later by a comma is a thousands separator, because
 *     the comma has already claimed the decimal position: „1.103,38” is 1103,38.
 *     That form is unambiguous and both fields read it.
 *
 * „1.234 mp” is genuinely ambiguous and this module resolves it to 1234, which
 * is what a Romanian deed means by it. A person who wants 1,234 mp writes the
 * comma.
 *
 * ⚠️ **AN UNREADABLE VALUE IS A REFUSAL WITH A REASON, NEVER A ZERO.** Every
 * parse returns a discriminated result, and the failure arm carries WHY, so the
 * field can put a Romanian sentence in its own error slot and keep what the
 * user typed. Silently substituting 0 would write a false share into an archive
 * whose purpose is to prove things later — which is the same class of defect
 * this whole slice exists to remove.
 *
 * ⚠️ **AN EMPTY BOX IS `ok` WITH A NULL VALUE, NOT AN ERROR.** A notary has no
 * share and a mandatar usually has none. Null is the ordinary state of these
 * three columns and nothing in the application may treat it as missing data.
 *
 * ⚠️ **A FRACTION IS CONVERTED ON ENTRY AND THE FRACTION ITSELF IS NOT
 * STORED.** „1/2” becomes 50, „10/41” becomes 24,3902. Keeping the fraction as
 * a third representation of the same number would be a third thing that can
 * disagree with the other two. What is lost is the deed's own wording, and that
 * belongs in „Note extinse”, not in a numeric column.
 */

/** How a share is held. ASCII keys — the Romanian labels are in ro-RO.json. */
export const COTA_MOD_VALUES = [
  "NUME_PROPRIU",
  "DEVALMASIE",
  "INDIVIZIUNE",
  "PRIN_MANDATAR",
] as const;

export type CotaMod = (typeof COTA_MOD_VALUES)[number];

export function isCotaMod(value: unknown): value is CotaMod {
  return typeof value === "string" && (COTA_MOD_VALUES as readonly string[]).includes(value);
}

/**
 * Why a parse failed. The field maps each to one key under
 * `document.persons.cotaError.*`; there is no generic arm, because „invalid”
 * on its own tells the user nothing they can act on.
 */
export type CotaParseError =
  /** Nothing in it resembles a number: letters, punctuation, „n/a”. */
  | "unreadable"
  /** A fraction whose denominator is zero — „1/0”. */
  | "zeroDenominator"
  /** Readable, but outside what the column can store (numeric(7,4) / (12,2)). */
  | "notStorable"
  /** A negative number. A share and an area are both magnitudes. */
  | "negative";

export type CotaParseResult =
  | { ok: true; value: number | null }
  | { ok: false; error: CotaParseError };

/** numeric(7,4) — five integer digits are impossible, so the wall is 1000. */
const COTA_PARTE_MAX = 999.9999;
const COTA_PARTE_SCALE = 4;

/** numeric(12,2) — ten integer digits. */
const COTA_SUPRAFATA_MAX = 9_999_999_999.99;
const COTA_SUPRAFATA_SCALE = 2;

/** `\d{1,3}(\.\d{3})+` — digits grouped the way a thousands separator groups. */
const THOUSANDS_GROUPED = /^\d{1,3}(\.\d{3})+$/;

/** Round half away from zero at `scale` decimals, without the 0.5 float trap. */
function roundTo(value: number, scale: number): number {
  const factor = 10 ** scale;
  // `Math.round` is half-UP, not half-away-from-zero, and these are magnitudes
  // anyway; the epsilon nudges 1.0049999999999999 back onto 1.005.
  return Math.round((value + Number.EPSILON * Math.sign(value || 1)) * factor) / factor;
}

/**
 * The shared core: strip the noise, decide what the dots mean, return a number.
 * `groupedDotsAreThousands` is the one knob, and the two callers below set it
 * differently for the reason in the header.
 */
function readDecimal(raw: string, groupedDotsAreThousands: boolean): number | null {
  // Spaces anywhere (including the non-breaking and narrow ones a paste from a
  // PDF brings along) are grouping noise, never meaning.
  let s = raw.replace(/[\s   ]/g, "");
  if (s === "") return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastComma !== -1) {
    // A comma is present, so it is the decimal separator and every dot before
    // it is grouping. Both fields agree on this form.
    if (lastDot !== -1 && lastDot < lastComma) s = s.replace(/\./g, "");
    // More than one comma is not a number anybody writes.
    if (s.indexOf(",") !== s.lastIndexOf(",")) return null;
    s = s.replace(",", ".");
  } else if (lastDot !== -1) {
    if (groupedDotsAreThousands && THOUSANDS_GROUPED.test(s)) {
      s = s.replace(/\./g, "");
    } else if (s.indexOf(".") !== s.lastIndexOf(".")) {
      // Several dots that do not group like thousands is not a number either.
      return null;
    }
  }

  // Only now is a bare `parseFloat` safe — anything it would silently truncate
  // („12abc”, „1e5”) is refused here instead.
  if (!/^[+-]?\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseOne(
  raw: string,
  opts: { allowFraction: boolean; groupedDotsAreThousands: boolean; max: number; scale: number },
): CotaParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };

  // The percent sign is decoration, not data — „63,64%” and „63,64” are the
  // same share, and the deeds write both.
  const withoutSign = trimmed.replace(/%/g, "").trim();
  if (withoutSign === "") return { ok: false, error: "unreadable" };

  let value: number | null;

  const slash = withoutSign.indexOf("/");
  if (slash !== -1) {
    if (!opts.allowFraction) return { ok: false, error: "unreadable" };
    if (withoutSign.indexOf("/") !== withoutSign.lastIndexOf("/")) {
      return { ok: false, error: "unreadable" };
    }
    const numerator = readDecimal(withoutSign.slice(0, slash), false);
    const denominator = readDecimal(withoutSign.slice(slash + 1), false);
    if (numerator === null || denominator === null) return { ok: false, error: "unreadable" };
    if (denominator === 0) return { ok: false, error: "zeroDenominator" };
    if (numerator < 0 || denominator < 0) return { ok: false, error: "negative" };
    // A fraction is a share OF THE WHOLE, so it becomes a percentage.
    value = (numerator / denominator) * 100;
  } else {
    value = readDecimal(withoutSign, opts.groupedDotsAreThousands);
    if (value === null) return { ok: false, error: "unreadable" };
    if (value < 0) return { ok: false, error: "negative" };
  }

  const rounded = roundTo(value, opts.scale);
  if (rounded > opts.max) return { ok: false, error: "notStorable" };
  return { ok: true, value: rounded };
}

/**
 * „63,64” / „63,64%” / „1/2” / „ 10,41 % ” → 63.64 / 63.64 / 50 / 10.41.
 *
 * Rounds to four decimals, which is the column's own precision; 1/3 becomes
 * 33,3333 and the per-role total will then be 99,9999 rather than 100. That is
 * the archive telling the truth about what four decimals can hold, and
 * `cota-parte-total.ts` warns rather than blocks for exactly this reason.
 */
export function parseCotaParte(raw: string): CotaParseResult {
  return parseOne(raw, {
    allowFraction: true,
    groupedDotsAreThousands: false,
    max: COTA_PARTE_MAX,
    scale: COTA_PARTE_SCALE,
  });
}

/**
 * „3.182” / „114,86” / „1.103,38” → 3182 / 114.86 / 1103.38.
 *
 * No fractions: „1/2 mp” is not something a deed says, and accepting it would
 * mean guessing whether it meant half a square metre or half of some other
 * area that is not in the box.
 */
export function parseCotaSuprafataMp(raw: string): CotaParseResult {
  return parseOne(raw, {
    allowFraction: false,
    groupedDotsAreThousands: true,
    max: COTA_SUPRAFATA_MAX,
    scale: COTA_SUPRAFATA_SCALE,
  });
}

/**
 * Back to Romanian: a decimal comma, trailing zeros trimmed, NO thousands
 * separator.
 *
 * ⚠️ **NO GROUPING, BECAUSE THESE RENDER INTO AN EDITABLE BOX AND MUST
 * ROUND-TRIP.** „1103,38” re-parses to 1103.38 under both rules above;
 * „1.103,38” would too, but „3.182” only round-trips through the area rule and
 * would come back as 3,182 in the percentage field. A field that quietly
 * changes a value the user did not touch is the defect this slice is about, one
 * layer up. A read-only total line is free to group; that is the caller's
 * choice, not this function's.
 */
function formatDecimal(value: number | null, scale: number): string {
  if (value === null || !Number.isFinite(value)) return "";
  const fixed = Math.abs(roundTo(value, scale)).toFixed(scale);
  const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
  return (value < 0 ? "-" : "") + trimmed.replace(".", ",");
}

export function formatCotaParte(value: number | null): string {
  return formatDecimal(value, COTA_PARTE_SCALE);
}

export function formatCotaSuprafataMp(value: number | null): string {
  return formatDecimal(value, COTA_SUPRAFATA_SCALE);
}

/**
 * What comes back from the API is a `numeric` column, which node-postgres hands
 * over as a STRING so no precision is lost on the way. One place converts it,
 * so no caller invents a second `Number(...)` that turns "" into 0.
 */
export function cotaFromDb(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
