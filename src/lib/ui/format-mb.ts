/**
 * src/lib/ui/format-mb.ts
 *
 * ONE megabyte formatter, for the ONE `megabytes` message key.  (Slice #34.06)
 *
 * There were two. `folder-forecast.tsx` rounded to a whole number at 10 MB and
 * above and to one decimal below it; `report-sections.tsx` always called
 * `toFixed(1)`. Both fed the same `adminImport.wizard.forecast.megabytes`
 * string, so the same folder read "412 MB" on the screen and "412.3 MB" in the
 * report the user downloaded from that screen — a difference small enough to
 * be read as a second measurement rather than as a second formatter.
 *
 * The forecast's rule is the one that survived, because it is the considered
 * one: a tenth of a megabyte is a real distinction at 3.4 MB and noise at
 * 412 MB, and the screen is read by a business user deciding whether a folder
 * is about the size they expected.
 */

/**
 * `bytes` as the number that goes into the `megabytes` message key.
 *
 * Returns the NUMBER ONLY, never the unit — the unit lives in the message so
 * that a locale can put it where its own grammar wants it.
 *
 *   formatMb(3_565_158,   "en-GB") -> "3.4"      formatMb(…, "ro-RO") -> "3,4"
 *   formatMb(432_013_209, "en-GB") -> "412"      formatMb(…, "ro-RO") -> "412"
 *   formatMb(0,           "en-GB") -> "0.0"      formatMb(…, "ro-RO") -> "0,0"
 *
 * ⚠️ **THE LOCALE IS A PARAMETER BECAUSE ROMANIAN DOES NOT WRITE "3.4".** It
 * writes „3,4". The two formatters this replaced both used `toFixed`, which is
 * locale-blind, so the app's DEFAULT locale has been printing a `.`-decimal at
 * a Romanian user all along — a small wrong that #34.06 would otherwise have
 * spread further, since the same helper now also formats the report the user
 * downloads and forwards.
 *
 * ⚠️ **`useGrouping: false`, deliberately.** Romanian groups thousands with a
 * `.`, so a grouped 1234 MB reads „1.234 MB" — indistinguishable at a glance
 * from one and a bit megabytes, on a screen whose whole job is telling a user
 * whether a folder is the size they expected. A file-size figure is read as
 * one number, not counted in thousands.
 *
 * ⚠️ Zero formats as `"0.0"` (`„0,0"`) and not `"0"`, deliberately.
 * `report-sections.tsx` records that an empty forecast reading "upload 0.0 MB"
 * was already the observed behaviour there, and rounding it to a bare "0"
 * would read as a rounded-down real number rather than as nothing at all.
 */
export function formatMb(bytes: number, locale: string): string {
  const mb = bytes / (1024 * 1024);
  const digits = mb >= 10 ? 0 : 1;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(mb);
}
