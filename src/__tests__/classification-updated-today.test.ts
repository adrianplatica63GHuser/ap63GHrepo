/**
 * Slice 41.28 — a classification value updated today counts as reviewed (Ask first 1).
 *
 * Adrian, 2026-10-31: „on the Classification tile if one item was updated today it should automatically be marked as
 * reviewed". „Today" is the reckoning the line's „(actualizat azi)" uses — under one whole day since the stamp.
 */
import { daysSince, oldestStamp, updatedToday } from "@/lib/metadata/updated-days";

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
    // 41.94 inverted in place — was `expect(ro.provenance.historyNote).toMatch(/^Fiecare schimbare de proveniență/)`.
    // „Istoric" went from „Clasificare" (Adrian: „Remove the History section at the bottom"), its three keys with it.
    for (const m of [ro, en]) expect(Object.keys(m.provenance).filter((k) => k.startsWith("history"))).toEqual([]);
  });
});

// 41.59 (Ask first 1): the three reviewed as one block — its date and its warning read the OLDEST of the three, so a
// record whose provenance alone was stamped at import, or whose other two are older, honestly reads as not reviewed.
describe("the block's stamp is the oldest of the three (41.59)", () => {
  it("the oldest wins; today only when all three are today", () => {
    expect(oldestStamp([ago(1), ago(50), ago(3)])).toBe(ago(50));
    expect(updatedToday(oldestStamp([ago(1), ago(2), ago(3)]), NOW)).toBe(true);
    expect(updatedToday(oldestStamp([ago(1), ago(30), ago(3)]), NOW)).toBe(false);
  });

  it("one never stamped — no date at all: the block was never reviewed", () => {
    expect(oldestStamp([ago(1), null, ago(3)])).toBeNull();
    expect(oldestStamp([null, null, ago(0)])).toBeNull(); // provenance alone, stamped at import
    expect(daysSince(oldestStamp([ago(1), null, ago(3)]), NOW)).toBeNull();
  });
});
