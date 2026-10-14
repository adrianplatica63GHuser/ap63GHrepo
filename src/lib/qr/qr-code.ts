/**
 * A QR code, drawn in the browser from a text, with no outside service and no dependency.   (Slice #39.35)
 *
 * „Navighează" shows the Google Maps link as a QR code a phone scans. The npm registry the sandbox reaches refused
 * a QR package, and an install from the bridge would rewrite the Windows `node_modules` from Linux — so this is the
 * encoder itself, written to ISO/IEC 18004 (Model 2): byte mode (UTF-8), error correction level M (15 % of the
 * code can be lost — a phone camera at a screen), versions 1–40, the eight masks scored by the standard's four
 * penalty rules. `qr-code.test.ts` checks it against the standard's structure. While it was written, the sandbox
 * compared it with OpenCV's own encoder at every version 1–40 (the same modules, mask included, for 36 of the 43
 * texts tried; the rest differ only in mask choice or in the remainder bits, both free) and read the codes back with
 * OpenCV's decoder, the Romanian diacritics and a navigation link among them.
 *
 * PURE: `qrMatrix(text)` → rows of booleans (true = dark), without the quiet zone.
 */

/** Error correction level M, per version 1..40: [blocks, total codewords per block, data codewords per block], one or two groups. */
const RS_BLOCKS_M: readonly (readonly number[])[] = [
  [1, 26, 16], [1, 44, 28], [1, 70, 44], [2, 50, 32], [2, 67, 43], [4, 43, 27], [4, 49, 31], [2, 60, 38, 2, 61, 39],
  [3, 58, 36, 2, 59, 37], [4, 69, 43, 1, 70, 44], [1, 80, 50, 4, 81, 51], [6, 58, 36, 2, 59, 37], [8, 59, 37, 1, 60, 38],
  [4, 64, 40, 5, 65, 41], [5, 65, 41, 5, 66, 42], [7, 73, 45, 3, 74, 46], [10, 74, 46, 1, 75, 47], [9, 69, 43, 4, 70, 44],
  [3, 70, 44, 11, 71, 45], [3, 67, 41, 13, 68, 42], [17, 68, 42], [17, 74, 46], [4, 75, 47, 14, 76, 48],
  [6, 73, 45, 14, 74, 46], [8, 75, 47, 13, 76, 48], [19, 74, 46, 4, 75, 47], [22, 73, 45, 3, 74, 46],
  [3, 73, 45, 23, 74, 46], [21, 73, 45, 7, 74, 46], [19, 75, 47, 10, 76, 48], [2, 74, 46, 29, 75, 47],
  [10, 74, 46, 23, 75, 47], [14, 74, 46, 21, 75, 47], [14, 74, 46, 23, 75, 47], [12, 75, 47, 26, 76, 48],
  [6, 75, 47, 34, 76, 48], [29, 74, 46, 14, 75, 47], [13, 74, 46, 32, 75, 47], [40, 75, 47, 7, 76, 48],
  [18, 75, 47, 31, 76, 48],
];

/** The alignment patterns' centres, per version 1..40. */
const ALIGNMENT: readonly (readonly number[])[] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
  [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82],
  [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

/** The blocks of a version: each block's data and error-correction codeword counts. */
export function blocksOf(version: number): { data: number; ec: number }[] {
  const row = RS_BLOCKS_M[version - 1]!;
  const out: { data: number; ec: number }[] = [];
  for (let g = 0; g < row.length; g += 3) for (let i = 0; i < row[g]!; i++) out.push({ data: row[g + 2]!, ec: row[g + 1]! - row[g + 2]! });
  return out;
}

export const dataCapacity = (version: number) => blocksOf(version).reduce((s, b) => s + b.data, 0);
const countBits = (version: number) => (version < 10 ? 8 : 16);

/** The smallest version whose data codewords hold `bytes` bytes in byte mode; null when none does. */
export function versionFor(bytes: number): number | null {
  for (let v = 1; v <= 40; v++) if (4 + countBits(v) + bytes * 8 <= dataCapacity(v) * 8) return v;
  return null;
}

// ── GF(256), polynomial x^8 + x^4 + x^3 + x^2 + 1 ───────────────────────────────────────────────────────────────
const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);

/** The Reed–Solomon error-correction codewords of `data`, `ec` of them. */
export function reedSolomon(data: readonly number[], ec: number): number[] {
  let gen = [1];
  for (let i = 0; i < ec; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j]!;
      next[j + 1] ^= mul(gen[j]!, EXP[i]!);
    }
    gen = next;
  }
  const rem = new Array<number>(ec).fill(0);
  for (const d of data) {
    const factor = d ^ rem.shift()!;
    rem.push(0);
    for (let j = 0; j < ec; j++) rem[j] ^= mul(gen[j + 1]!, factor);
  }
  return rem;
}

/**
 * The text's UTF-8 bytes, by hand rather than `TextEncoder`: jsdom, where the component's tests run, has none.
 * A lone surrogate (half of an emoji) becomes U+FFFD, as `TextEncoder` would make it.
 */
export function utf8(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    let cp = ch.codePointAt(0)!;
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

/** The final codeword sequence: data in byte mode, padded, split in blocks, error correction added, interleaved. */
export function codewords(text: string, version: number): number[] {
  const bytes = utf8(text);
  const bits: number[] = [];
  const put = (value: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, countBits(version));
  for (const b of bytes) put(b, 8);
  const capacity = dataCapacity(version) * 8;
  put(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0; data.length < capacity / 8; pad++) data.push(pad % 2 ? 0x11 : 0xec);

  const blocks = blocksOf(version);
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let at = 0;
  for (const b of blocks) {
    const d = data.slice(at, at + b.data);
    at += b.data;
    dataBlocks.push(d);
    ecBlocks.push(reedSolomon(d, b.ec));
  }
  const out: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.data));
  for (let i = 0; i < maxData; i++) for (const d of dataBlocks) if (i < d.length) out.push(d[i]!);
  for (let i = 0; i < blocks[0]!.ec; i++) for (const e of ecBlocks) out.push(e[i]!);
  return out;
}

const MASKS: readonly ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** BCH(15,5) format bits for level M (00) and `mask`, XOR 101010000010010. */
export function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  return ((data << 10) | rem) ^ 0x5412;
}

/** BCH(18,6) version bits, for versions 7 and up. */
export function versionBits(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
  return (version << 12) | rem;
}

type Grid = { size: number; dark: boolean[][]; fixed: boolean[][] };

function base(version: number): Grid {
  const size = version * 4 + 17;
  const dark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (r: number, c: number, v: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    dark[r]![c] = v;
    fixed[r]![c] = true;
  };
  // Finders, with their separators.
  for (const [fr, fc] of [[0, 0], [0, size - 7], [size - 7, 0]] as const) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const ring = inside && (r === 0 || r === 6 || c === 0 || c === 6);
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(fr + r, fc + c, ring || core);
      }
    }
  }
  // Alignment patterns, wherever they do not sit on a finder.
  const centres = ALIGNMENT[version - 1]!;
  for (const r of centres) {
    for (const c of centres) {
      if (fixed[r]![c]) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }
  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    if (!fixed[6]![i]) set(6, i, i % 2 === 0);
    if (!fixed[i]![6]) set(i, 6, i % 2 === 0);
  }
  // The dark module, and the format and version areas reserved.
  set(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (!fixed[8]![i]) set(8, i, false);
    if (!fixed[i]![8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    set(8, size - 1 - i, false);
    if (!fixed[size - 1 - i]![8]) set(size - 1 - i, 8, false);
  }
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + size - 11;
      set(a, b, on);
      set(b, a, on);
    }
  }
  return { size, dark, fixed };
}

function placeData(g: Grid, words: readonly number[]): void {
  const bits: number[] = [];
  for (const w of words) for (let i = 7; i >= 0; i--) bits.push((w >>> i) & 1);
  let k = 0;
  let upward = true;
  for (let right = g.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < g.size; step++) {
      const r = upward ? g.size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (g.fixed[r]![c]) continue;
        g.dark[r]![c] = k < bits.length ? bits[k] === 1 : false;
        k++;
      }
    }
    upward = !upward;
  }
}

function writeFormat(g: Grid, mask: number): void {
  const bits = formatBits(mask);
  const s = g.size;
  const on = (i: number) => ((bits >>> i) & 1) === 1;
  // Around the top-left finder: down column 8, then along row 8 to the left.
  for (let i = 0; i <= 5; i++) g.dark[i]![8] = on(i);
  g.dark[7]![8] = on(6);
  g.dark[8]![8] = on(7);
  g.dark[8]![7] = on(8);
  for (let i = 9; i < 15; i++) g.dark[8]![14 - i] = on(i);
  // The copy: along row 8 under the top-right finder, then down column 8 beside the bottom-left one.
  for (let i = 0; i < 8; i++) g.dark[8]![s - 1 - i] = on(i);
  for (let i = 8; i < 15; i++) g.dark[s - 15 + i]![8] = on(i);
  g.dark[s - 8]![8] = true;
}

/** The standard's four penalty rules — lower is better. */
export function penalty(m: readonly (readonly boolean[])[]): number {
  const n = m.length;
  let score = 0;
  // 1: runs of five or more of one colour, in rows and columns.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      let run = 1;
      for (let j = 1; j < n; j++) {
        const a = pass ? m[j - 1]![i] : m[i]![j - 1];
        const b = pass ? m[j]![i] : m[i]![j];
        if (a === b) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }
  // 2: 2×2 blocks of one colour.
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = m[r]![c];
      if (v === m[r]![c + 1] && v === m[r + 1]![c] && v === m[r + 1]![c + 1]) score += 3;
    }
  }
  // 3: the finder-like pattern 1011101 with four light modules on a side.
  const pat1 = [true, false, true, true, true, false, true, false, false, false, false];
  const pat2 = [false, false, false, false, true, false, true, true, true, false, true];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c + 11 <= n; c++) {
      let h1 = true, h2 = true, v1 = true, v2 = true;
      for (let k = 0; k < 11; k++) {
        if (m[r]![c + k] !== pat1[k]) h1 = false;
        if (m[r]![c + k] !== pat2[k]) h2 = false;
        if (m[c + k]![r] !== pat1[k]) v1 = false;
        if (m[c + k]![r] !== pat2[k]) v2 = false;
      }
      score += 40 * [h1, h2, v1, v2].filter(Boolean).length;
    }
  }
  // 4: the share of dark modules away from half.
  let darkCount = 0;
  for (const row of m) for (const v of row) if (v) darkCount++;
  score += Math.floor(Math.abs((darkCount * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

/** The QR code of `text`: rows of booleans, true dark, without the quiet zone. Throws when the text is too long. */
export function qrMatrix(text: string): boolean[][] {
  const version = versionFor(utf8(text).length);
  if (version === null) throw new Error("text too long for a QR code");
  const words = codewords(text, version);
  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = base(version);
    placeData(g, words);
    for (let r = 0; r < g.size; r++) for (let c = 0; c < g.size; c++) if (!g.fixed[r]![c] && MASKS[mask]!(r, c)) g.dark[r]![c] = !g.dark[r]![c];
    writeFormat(g, mask);
    const s = penalty(g.dark);
    if (s < bestScore) {
      bestScore = s;
      best = g.dark;
    }
  }
  return best!;
}
