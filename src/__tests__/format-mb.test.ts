/**
 * One megabyte formatter, one message key   (Slice #34.06)
 *
 * There were two, both feeding `adminImport.wizard.forecast.megabytes`:
 * `folder-forecast.tsx` rounded to a whole number at 10 MB and above and to one
 * decimal below it, and `report-sections.tsx` always called `toFixed(1)`. The
 * same folder read "412 MB" on the screen and "412.3 MB" in the report the user
 * downloaded FROM that screen — a difference small enough to be read as a
 * second measurement rather than as a second formatter.
 *
 * The forecast's rule survived. This pins it, including the boundary and the
 * zero case, because the whole defect was that nothing did.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { stripComments } from "@/lib/dev/strip-comments";
import { formatMb } from "@/lib/ui/format-mb";

const MB = 1024 * 1024;

describe("formatMb", () => {
  it("gives one decimal below 10 MB", () => {
    expect(formatMb(3.4 * MB, "en-GB")).toBe("3.4");
    expect(formatMb(0.5 * MB, "en-GB")).toBe("0.5");
  });

  it("gives a whole number at 10 MB and above", () => {
    expect(formatMb(10 * MB, "en-GB")).toBe("10");
    expect(formatMb(412.3 * MB, "en-GB")).toBe("412");
  });

  it("switches exactly at 10 MB, not near it", () => {
    // The boundary is `>= 10`, so 10 MB itself is the whole-number case — a
    // `> 10` typo would print "10.0" for it, and the assertion above would not
    // notice because it does not test the boundary from below.
    expect(formatMb(10 * MB - 1, "en-GB")).toBe("10.0");
    expect(formatMb(9.94 * MB, "en-GB")).toBe("9.9");
  });

  it("prints zero as 0.0, deliberately", () => {
    // `report-sections.tsx` records "upload 0.0 MB" as the observed behaviour
    // of an empty forecast. A bare "0" would read as a rounded-down real
    // number rather than as nothing at all.
    expect(formatMb(0, "en-GB")).toBe("0.0");
  });

  it("writes the decimal the way the LOCALE writes it", () => {
    // ⚠️ The reason this takes a locale at all. Romanian writes „3,4"; both
    // formatters this replaced used `toFixed`, which is locale-blind, so the
    // app's DEFAULT locale has been printing an English decimal all along —
    // and #34.06 newly applies the same helper to the downloadable report.
    expect(formatMb(3.4 * MB, "ro-RO")).toBe("3,4");
    expect(formatMb(0, "ro-RO")).toBe("0,0");
    expect(formatMb(412.3 * MB, "ro-RO")).toBe("412");
  });

  it("does not group thousands, in either locale", () => {
    // Romanian groups with a `.`, so a grouped 1234 MB reads „1.234 MB" —
    // indistinguishable at a glance from one and a bit megabytes, on a screen
    // whose whole job is telling a user whether a folder is the size they
    // expected.
    expect(formatMb(1234 * MB, "ro-RO")).toBe("1234");
    expect(formatMb(1234 * MB, "en-GB")).toBe("1234");
  });

  it("returns the number only — the unit lives in the message", () => {
    // So a locale can put "MB" where its own grammar wants it.
    //
    // ⚠️ Only for a value the callers can produce. `uploadBytes` is a sum of
    // file sizes, so NaN and negatives are unreachable; asserting about them
    // here would be pinning `Intl`'s behaviour ("NaN", "∞") rather than this
    // module's contract, and an earlier draft did exactly that with a regex
    // (`/^\d/`) so weak it passed on the string "NaN".
    expect(formatMb(5 * MB, "en-GB")).not.toMatch(/[A-Za-z]/);
    expect(formatMb(0, "ro-RO")).not.toMatch(/[A-Za-z]/);
  });
});

describe("both consumers of the megabytes key use it", () => {
  // ⚠️ A BEHAVIOUR guard, so it reads only code. The defect was never in
  // either component; it was that there were two answers and nothing compared
  // them, which is a shape no unit test can see.
  it.each([
    "app/admin/import/_components/folder-forecast.tsx",
    "app/admin/import/_components/report-sections.tsx",
  ])("%s formats through the shared helper", (rel) => {
    const code = stripComments(
      readFileSync(join(process.cwd(), "src", ...rel.split("/")), "utf8"),
    );
    expect(code).toContain('from "@/lib/ui/format-mb"');
    // Whitespace-insensitive: a Prettier rewrap of the same call must not fail
    // CI on a formatter guard.
    expect(code).toMatch(/formatMb\(uploadBytes,\s*locale\)/);
    expect(code).toMatch(/"megabytes"/);
    // No second formatter, in any of the shapes one would take.
    expect(code).not.toContain("toFixed(");
    expect(code).not.toMatch(/(?:function|const|let)\s+formatMb/);
  });
});
