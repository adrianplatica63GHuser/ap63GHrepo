/**
 * @jest-environment node
 */

/**
 * Slice #36.02 — the cota box accepts what a Romanian types, and refuses the
 * rest with a reason instead of a zero.
 *
 * WHAT THIS FILE PINS, AND WHY EACH ONE
 *   1. The four shapes the slice named — „63,64”, „63,64%”, „1/2”, and either
 *      with space around it — plus the ones the deeds actually contain.
 *   2. That the dot means a DECIMAL POINT in a percentage and a THOUSANDS
 *      SEPARATOR in an area, which is the only difference between the two
 *      parsers and the one thing a future edit is most likely to „simplify”.
 *   3. That an empty box is `ok` with a null value. Null is the ordinary state
 *      of these columns; a test that let it become an error would turn every
 *      notary row into a validation failure.
 *   4. That an unreadable value NEVER produces a number — the failure arm has
 *      no `value` at all, so there is nothing for a caller to accidentally
 *      write as 0.
 *   5. Round-tripping: format then parse gives back the same number, because
 *      these render into an editable box and a value the user did not touch
 *      must not change under them.
 */

import {
  COTA_MOD_VALUES,
  cotaFromDb,
  formatCotaParte,
  formatCotaSuprafataMp,
  isCotaMod,
  parseCotaParte,
  parseCotaSuprafataMp,
} from "@/lib/documents/cota-parte";

function value(raw: string): number | null {
  const r = parseCotaParte(raw);
  if (!r.ok) throw new Error(`expected „${raw}” to parse, got ${r.error}`);
  return r.value;
}

function mp(raw: string): number | null {
  const r = parseCotaSuprafataMp(raw);
  if (!r.ok) throw new Error(`expected „${raw}” to parse, got ${r.error}`);
  return r.value;
}

describe("parseCotaParte — the shapes a Romanian types", () => {
  it.each([
    ["63,64", 63.64],
    ["63,64%", 63.64],
    ["63.64", 63.64],
    [" 63,64 ", 63.64],
    ["  10,41  %  ", 10.41],
    ["100", 100],
    ["100%", 100],
    ["9,09", 9.09],
    ["27,27", 27.27],
    ["0,0001", 0.0001],
  ])("reads „%s” as %p", (raw, expected) => {
    expect(value(raw)).toBe(expected);
  });

  it("reads a fraction as a percentage of the whole", () => {
    expect(value("1/2")).toBe(50);
    expect(value("3/4")).toBe(75);
    expect(value("1/1")).toBe(100);
    expect(value(" 10 / 41 ")).toBe(24.3902);
  });

  it("rounds a repeating fraction to the column's own four decimals", () => {
    // 1/3 is 33,333…; numeric(7,4) holds 33,3333 and no more. The per-role
    // total is then 99,9999 for three thirds, which is the archive telling the
    // truth about its precision — cota-parte-total.ts warns and saves anyway.
    expect(value("1/3")).toBe(33.3333);
    expect(value("2/3")).toBe(66.6667);
  });

  it("does not store the fraction, only the number it means", () => {
    const half = parseCotaParte("1/2");
    expect(half).toEqual({ ok: true, value: 50 });
    expect(Object.keys(half)).toEqual(["ok", "value"]);
  });

  it("treats a lone dot as a decimal point, NEVER as thousands", () => {
    // A percentage has no thousands. Reading „63.640” as 63640 would turn a
    // perfectly readable 63,64 into an out-of-range error.
    expect(value("63.640")).toBe(63.64);
    expect(value("1.5")).toBe(1.5);
  });

  it("reads the dot-thousands-comma form the one way it can mean, then refuses it for range", () => {
    // The comma has already claimed the decimal position, so the dot can only
    // be grouping: „1.103,38” is 1103,38 and not 1,10338. The area parser
    // proves the reading; in a PERCENTAGE 1103,38 then exceeds what
    // numeric(7,4) holds, so it is refused with a reason rather than mangled
    // into something storable.
    expect(mp("1.103,38")).toBe(1103.38);
    expect(parseCotaParte("1.103,38")).toEqual({ ok: false, error: "notStorable" });
  });
});

describe("parseCotaSuprafataMp — an area, where the dot groups", () => {
  it.each([
    ["3.182", 3182],
    ["3182", 3182],
    ["114,86", 114.86],
    ["1.103,38", 1103.38],
    [" 1 103,38 ", 1103.38],
    ["1.5", 1.5],
    ["12.345.678", 12345678],
  ])("reads „%s” as %p", (raw, expected) => {
    expect(mp(raw)).toBe(expected);
  });

  it("refuses a fraction, because no deed states an area as one", () => {
    expect(parseCotaSuprafataMp("1/2")).toEqual({ ok: false, error: "unreadable" });
  });

  it("rounds to the column's two decimals", () => {
    expect(mp("114,867")).toBe(114.87);
  });
});

describe("an empty box is a value, not a failure", () => {
  it.each(["", "   ", "\t"])("„%s” parses to null", (raw) => {
    expect(parseCotaParte(raw)).toEqual({ ok: true, value: null });
    expect(parseCotaSuprafataMp(raw)).toEqual({ ok: true, value: null });
  });
});

describe("a refusal carries a reason and never a number", () => {
  it.each([
    ["abc", "unreadable"],
    ["n/a", "unreadable"],
    ["—", "unreadable"],
    ["%", "unreadable"],
    ["1,2,3", "unreadable"],
    ["1e5", "unreadable"],
    ["12abc", "unreadable"],
    ["1/2/3", "unreadable"],
    ["1/0", "zeroDenominator"],
    ["-5", "negative"],
    ["-5%", "negative"],
    ["1000", "notStorable"],
    ["99999", "notStorable"],
  ])("„%s” is refused as %s", (raw, error) => {
    const r = parseCotaParte(raw);
    expect(r.ok).toBe(false);
    expect(r).toEqual({ ok: false, error });
    // The failure arm has no `value` at all, so there is nothing a caller can
    // read as 0. This is the assertion, not decoration.
    expect(r).not.toHaveProperty("value");
  });

  it("999,9999 is the last storable percentage and 1000 is not", () => {
    expect(value("999,9999")).toBe(999.9999);
    expect(parseCotaParte("1000")).toEqual({ ok: false, error: "notStorable" });
  });
});

describe("formatting back, and round-tripping", () => {
  it.each([
    [63.64, "63,64"],
    [100, "100"],
    [9.09, "9,09"],
    [33.3333, "33,3333"],
    [0.0001, "0,0001"],
    [null, ""],
  ])("formatCotaParte(%p) is „%s”", (n, expected) => {
    expect(formatCotaParte(n as number | null)).toBe(expected);
  });

  it("trims trailing zeros rather than printing the column's padding", () => {
    expect(formatCotaParte(50)).toBe("50");
    expect(formatCotaParte(50.5)).toBe("50,5");
    expect(formatCotaSuprafataMp(3182)).toBe("3182");
    expect(formatCotaSuprafataMp(1103.38)).toBe("1103,38");
  });

  it("emits NO thousands separator, so an untouched box re-parses unchanged", () => {
    // „3.182” in a percentage field would come back as 3,182. A field that
    // silently changes a value the user did not touch is this slice's own
    // defect, one layer up.
    const rendered = formatCotaSuprafataMp(3182);
    expect(rendered).not.toContain(".");
    expect(mp(rendered)).toBe(3182);
    expect(value(formatCotaParte(63.64))).toBe(63.64);
  });

  it.each([63.64, 9.09, 27.27, 10.41, 33.3333, 100, 0.0001])(
    "round-trips %p through format and parse",
    (n) => {
      expect(value(formatCotaParte(n))).toBe(n);
    },
  );
});

describe("cotaFromDb — a numeric column arrives as a string", () => {
  it.each([
    ["63.6400", 63.64],
    [63.64, 63.64],
    [null, null],
    [undefined, null],
    ["", null],
    ["nonsense", null],
  ])("%p becomes %p", (raw, expected) => {
    expect(cotaFromDb(raw as string | number | null | undefined)).toBe(expected);
  });
});

describe("the cota_mod values match the CHECK in migration_084", () => {
  it("is exactly the four the migration allows", () => {
    expect([...COTA_MOD_VALUES]).toEqual([
      "NUME_PROPRIU",
      "DEVALMASIE",
      "INDIVIZIUNE",
      "PRIN_MANDATAR",
    ]);
  });

  it("guards against anything else", () => {
    expect(isCotaMod("DEVALMASIE")).toBe(true);
    expect(isCotaMod("devalmasie")).toBe(false);
    expect(isCotaMod("")).toBe(false);
    expect(isCotaMod(null)).toBe(false);
  });
});
