/**
 * Slice 41.28 — a classification value updated today counts as reviewed (Ask first 1).
 *
 * Adrian, 2026-10-31: „on the Classification tile if one item was updated today it should automatically be marked as
 * reviewed". „Today" is the reckoning the line's „(actualizat azi)" uses — under one whole day since the stamp.
 */
import { daysSince, updatedToday } from "@/lib/metadata/updated-days";

const NOW = Date.parse("2026-10-31T18:00:00Z");
const ago = (h: number) => new Date(NOW - h * 3600 * 1000).toISOString();

describe("updated today (41.28)", () => {
  it("a stamp under a day old is today; a day old or more is not; none is not", () => {
    expect(updatedToday(ago(0), NOW)).toBe(true);
    expect(updatedToday(ago(23.9), NOW)).toBe(true);
    expect(updatedToday(ago(24), NOW)).toBe(false);
    expect(updatedToday(ago(72), NOW)).toBe(false);
    expect(updatedToday(null, NOW)).toBe(false);
    expect(updatedToday("not a date", NOW)).toBe(false);
  });
  it("daysSince is the same reckoning the line's words use: 0 „azi”, 1 „ieri”, N „acum N zile”", () => {
    expect([ago(1), ago(25), ago(24 * 3 + 1)].map((d) => daysSince(d, NOW))).toEqual([0, 1, 3]);
    expect(daysSince(null, NOW)).toBeNull();
  });
  it("the words are lower-case, in parentheses, in both languages; „Verificat azi” is the reviewed button's name", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ro = require("../../messages/ro-RO.json").shared.entityMetadata;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const en = require("../../messages/en-GB.json").shared.entityMetadata;
    expect([ro.lastChangedToday, ro.lastChangedYesterday, ro.lastChangedDays]).toEqual(["(actualizat azi)", "(actualizat ieri)", "(actualizat acum {days} zile)"]);
    expect([en.lastChangedToday, en.lastChangedYesterday, en.lastChangedDays]).toEqual(["(updated today)", "(updated yesterday)", "(updated {days} days ago)"]);
    expect([ro.markReviewed.today, en.markReviewed.today]).toEqual(["Verificat azi", "Reviewed today"]);
    expect(ro.provenance.historyNote).toMatch(/^Fiecare schimbare de proveniență/);
  });
});
