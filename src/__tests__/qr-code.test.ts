/**
 * Slice #39.35 — the QR code encoder (`@/lib/qr/qr-code`), checked against ISO/IEC 18004's own worked values and
 * structure. (While it was written it was also compared with OpenCV's encoder and read back by OpenCV's decoder.)
 */
import { blocksOf, dataCapacity, formatBits, qrMatrix, reedSolomon, utf8, versionBits, versionFor } from "@/lib/qr/qr-code";

describe("the tables", () => {
  it("level M's data capacity, from the standard: 16 codewords at version 1, 2 334 at 40", () => {
    expect(dataCapacity(1)).toBe(16);
    expect(dataCapacity(7)).toBe(124);
    expect(dataCapacity(10)).toBe(216);
    expect(dataCapacity(40)).toBe(2334);
  });
  it("every version's blocks add up to its codewords: (4v+17)² minus the function patterns, over 8", () => {
    const total = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
    for (let v = 1; v <= 10; v++) {
      expect(blocksOf(v).reduce((s, b) => s + b.data + b.ec, 0)).toBe(total[v - 1]);
    }
    expect(blocksOf(40).reduce((s, b) => s + b.data + b.ec, 0)).toBe(3706);
  });
  it("the smallest version that holds the bytes", () => {
    expect(versionFor(14)).toBe(1);
    expect(versionFor(15)).toBe(2);
    expect(versionFor(2331)).toBe(40);
    expect(versionFor(2332)).toBeNull();
  });
});

describe("the codes the standard works by hand", () => {
  it("Reed–Solomon: „HELLO WORLD” 1-M's ten error-correction codewords", () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(reedSolomon(data, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
  it("format bits: level M, mask 0 is 101010000010010; version 7's bits are 000111110010010100", () => {
    expect(formatBits(0)).toBe(0b101010000010010);
    expect(versionBits(7)).toBe(0b000111110010010100);
  });
});

describe("the matrix", () => {
  const link = "https://www.google.com/maps/dir/?api=1&destination=44.371000%2C25.972000&travelmode=driving&dir_action=navigate";
  const m = qrMatrix(link);
  const n = m.length;

  it("a navigation link is version 7: 45 modules a side", () => {
    expect(n).toBe(45);
    expect(m.every((row) => row.length === n)).toBe(true);
  });
  it("three finder patterns, their separators light", () => {
    for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const ring = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          expect(m[r0 + r]![c0 + c]).toBe(ring || core);
        }
      }
    }
    expect(m[7]!.slice(0, 8).every((v) => !v)).toBe(true);
  });
  it("the timing patterns alternate, and the dark module is dark", () => {
    for (let i = 8; i < n - 8; i++) {
      expect(m[6]![i]).toBe(i % 2 === 0);
      expect(m[i]![6]).toBe(i % 2 === 0);
    }
    expect(m[n - 8]![8]).toBe(true);
  });
  it("UTF-8 by hand: ASCII, Romanian letters, the euro sign, an emoji — and a lone surrogate as U+FFFD", () => {
    expect(utf8("a")).toEqual([0x61]);
    expect(utf8("ș")).toEqual([0xc8, 0x99]);
    expect(utf8("€")).toEqual([0xe2, 0x82, 0xac]);
    expect(utf8("😀")).toEqual([0xf0, 0x9f, 0x98, 0x80]);
    expect(utf8("\ud800")).toEqual([0xef, 0xbf, 0xbd]);
  });
  it("Romanian letters fit, as UTF-8 bytes", () => {
    expect(() => qrMatrix("Strada Școlii 5, Bragadiru, Ilfov, România — ăîâșț")).not.toThrow();
  });
  it("a text too long for any version is refused, not cut", () => {
    expect(() => qrMatrix("x".repeat(3000))).toThrow(/too long/);
  });
});
