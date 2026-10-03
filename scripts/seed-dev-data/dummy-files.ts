/**
 * Dummy page files for the dev seed (scripts/seed-dev-data.ts).
 *
 * Everything here is generated in memory, with no dependency beyond Node's
 * own zlib: a minimal text PDF and a PNG drawn pixel by pixel with a 5x7
 * bitmap font. Every file says, on its face, that it is a test document with
 * invented data — nothing here imitates a real person's real card or deed.
 */
import * as zlib from "zlib";

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Romanian → ASCII, for the PDF base-14 fonts and the 5x7 bitmap font. */
export function ascii(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[șşȘŞ]/g, (c) => (c === c.toLowerCase() ? "s" : "S"))
    .replace(/[țţȚŢ]/g, (c) => (c === c.toLowerCase() ? "t" : "T"))
    .replace(/[„”“"]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e]/g, "?");
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

function pdfString(s: string): string {
  return "(" + ascii(s).replace(/[\\()]/g, (m) => "\\" + m) + ")";
}

/**
 * A text-only PDF: one entry per page, each page a title and its lines.
 * A light diagonal „DOCUMENT FICTIV" watermark marks every page as test data.
 */
export function buildPdf(pages: { title: string; lines: string[] }[]): Buffer {
  const objects: string[] = [];
  const add = (body: string): number => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = add(""); // filled below
  const pagesId = add("");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];

  pages.forEach((page, i) => {
    const ops: string[] = [];
    // Watermark
    ops.push("q 0.88 g BT /F2 54 Tf 0.766 0.643 -0.643 0.766 110 250 Tm (DOCUMENT FICTIV) Tj ET Q");
    // Frame
    ops.push("0.4 G 1 w 36 36 523 770 re S");
    // Title
    ops.push(`BT /F2 15 Tf 56 770 Td ${pdfString(page.title)} Tj ET`);
    ops.push("0.6 G 56 760 m 539 760 l S");
    // Body
    let y = 736;
    for (const raw of page.lines) {
      // naive wrap at ~92 chars
      const chunks: string[] = [];
      let rest = raw;
      while (rest.length > 92) {
        let cut = rest.lastIndexOf(" ", 92);
        if (cut < 40) cut = 92;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut).trimStart();
      }
      chunks.push(rest);
      for (const c of chunks) {
        if (y < 70) break;
        ops.push(`BT /F1 10.5 Tf 56 ${y} Td ${pdfString(c)} Tj ET`);
        y -= 15;
      }
    }
    ops.push(`BT /F1 8 Tf 56 48 Td ${pdfString(`Pagina ${i + 1} din ${pages.length} - date de test generate automat, fara valoare juridica`)} Tj ET`);
    const stream = ops.join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] ` +
          `/Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

// ---------------------------------------------------------------------------
// PNG canvas
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

/** Column-major 5x7 glyphs, bit 0 = top row. */
const FONT: Record<string, number[]> = {
  "0": [0x3e, 0x51, 0x49, 0x45, 0x3e], "1": [0x00, 0x42, 0x7f, 0x40, 0x00],
  "2": [0x42, 0x61, 0x51, 0x49, 0x46], "3": [0x21, 0x41, 0x45, 0x4b, 0x31],
  "4": [0x18, 0x14, 0x12, 0x7f, 0x10], "5": [0x27, 0x45, 0x45, 0x45, 0x39],
  "6": [0x3c, 0x4a, 0x49, 0x49, 0x30], "7": [0x01, 0x71, 0x09, 0x05, 0x03],
  "8": [0x36, 0x49, 0x49, 0x49, 0x36], "9": [0x06, 0x49, 0x49, 0x29, 0x1e],
  A: [0x7e, 0x11, 0x11, 0x11, 0x7e], B: [0x7f, 0x49, 0x49, 0x49, 0x36],
  C: [0x3e, 0x41, 0x41, 0x41, 0x22], D: [0x7f, 0x41, 0x41, 0x22, 0x1c],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41], F: [0x7f, 0x09, 0x09, 0x09, 0x01],
  G: [0x3e, 0x41, 0x49, 0x49, 0x7a], H: [0x7f, 0x08, 0x08, 0x08, 0x7f],
  I: [0x00, 0x41, 0x7f, 0x41, 0x00], J: [0x20, 0x40, 0x41, 0x3f, 0x01],
  K: [0x7f, 0x08, 0x14, 0x22, 0x41], L: [0x7f, 0x40, 0x40, 0x40, 0x40],
  M: [0x7f, 0x02, 0x0c, 0x02, 0x7f], N: [0x7f, 0x04, 0x08, 0x10, 0x7f],
  O: [0x3e, 0x41, 0x41, 0x41, 0x3e], P: [0x7f, 0x09, 0x09, 0x09, 0x06],
  Q: [0x3e, 0x41, 0x51, 0x21, 0x5e], R: [0x7f, 0x09, 0x19, 0x29, 0x46],
  S: [0x46, 0x49, 0x49, 0x49, 0x31], T: [0x01, 0x01, 0x7f, 0x01, 0x01],
  U: [0x3f, 0x40, 0x40, 0x40, 0x3f], V: [0x1f, 0x20, 0x40, 0x20, 0x1f],
  W: [0x3f, 0x40, 0x38, 0x40, 0x3f], X: [0x63, 0x14, 0x08, 0x14, 0x63],
  Y: [0x07, 0x08, 0x70, 0x08, 0x07], Z: [0x61, 0x51, 0x49, 0x45, 0x43],
  " ": [0, 0, 0, 0, 0], ".": [0x00, 0x60, 0x60, 0x00, 0x00],
  "-": [0x08, 0x08, 0x08, 0x08, 0x08], "/": [0x20, 0x10, 0x08, 0x04, 0x02],
  ":": [0x00, 0x36, 0x36, 0x00, 0x00], "<": [0x08, 0x14, 0x22, 0x41, 0x00],
  ",": [0x00, 0x50, 0x30, 0x00, 0x00], "%": [0x23, 0x13, 0x08, 0x64, 0x62],
  "=": [0x14, 0x14, 0x14, 0x14, 0x14], "(": [0x00, 0x1c, 0x22, 0x41, 0x00], ")": [0x00, 0x41, 0x22, 0x1c, 0x00],
};

export class Canvas {
  readonly px: Buffer;
  constructor(readonly w: number, readonly h: number, bg: RGB) {
    this.px = Buffer.alloc(w * h * 3);
    this.rect(0, 0, w, h, bg);
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (Math.floor(y) * this.w + Math.floor(x)) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) this.set(xx, yy, c);
  }
  frame(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 2): void {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      this.rect(Math.round(x - t / 2), Math.round(y - t / 2), t, t, c);
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.set(cx + x, cy + y, c);
  }
  text(x: number, y: number, s: string, c: RGB, scale = 2): void {
    let cx = x;
    for (const ch of ascii(s).toUpperCase()) {
      const g = FONT[ch] ?? FONT[" "];
      for (let col = 0; col < 5; col++)
        for (let row = 0; row < 7; row++)
          if ((g[col] >> row) & 1) this.rect(cx + col * scale, y + row * scale, scale, scale, c);
      cx += 6 * scale;
    }
  }
  png(): Buffer {
    const raw = Buffer.alloc((this.w * 3 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 3 + 1)] = 0;
      this.px.copy(raw, y * (this.w * 3 + 1) + 1, y * this.w * 3, (y + 1) * this.w * 3);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // RGB
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

// ---------------------------------------------------------------------------
// Ready-made pictures
// ---------------------------------------------------------------------------

const INK: RGB = [30, 40, 60];
const GREY: RGB = [120, 128, 140];
const RED: RGB = [190, 40, 40];

export type IdCardData = {
  lastName: string;
  firstName: string;
  cnp: string;
  series: string;
  number: string;
  gender: "M" | "F";
  birthDate: string; // dd.mm.yyyy
  birthPlace: string;
  address: string;
  issuedBy: string;
  validFrom: string;
  validUntil: string;
};

/** Front of a clearly-fictional identity card: 856x540 px. */
export function idCardFront(d: IdCardData): Buffer {
  const c = new Canvas(856, 540, [222, 234, 242]);
  c.rect(0, 0, 856, 70, [70, 110, 160]);
  c.text(24, 18, "ROMANIA", [255, 255, 255], 3);
  c.text(260, 14, "CARTE DE IDENTITATE", [255, 255, 255], 3);
  c.text(260, 44, "IDENTITY CARD - SPECIMEN", [220, 230, 255], 2);
  // photo placeholder
  c.rect(30, 100, 200, 250, [200, 205, 212]);
  c.disc(130, 180, 48, [160, 166, 176]);
  c.rect(60, 250, 140, 100, [160, 166, 176]);
  c.frame(30, 100, 200, 250, GREY);
  const rows: [string, string][] = [
    ["SERIA " + d.series + "  NR " + d.number, "CNP " + d.cnp],
    ["NUME / NOM / LAST NAME", d.lastName],
    ["PRENUME / PRENOM / FIRST NAME", d.firstName],
    ["SEX " + d.gender + "   DATA NASTERII " + d.birthDate, "LOC NASTERE " + d.birthPlace],
    ["DOMICILIU / ADRESSE / ADDRESS", d.address],
    ["EMISA DE " + d.issuedBy, "VALABILITATE " + d.validFrom + " - " + d.validUntil],
  ];
  let y = 96;
  for (const [a, b] of rows) {
    c.text(256, y, a, GREY, 2);
    c.text(256, y + 20, b, INK, 2);
    y += 52;
  }
  c.text(30, 372, "DATE FICTIVE", RED, 3);
  c.text(30, 400, "DOCUMENT DE TEST", RED, 2);
  c.frame(4, 4, 848, 532, [70, 110, 160], 3);
  return c.png();
}

/** Back of the same card: a fictional machine-readable zone. */
export function idCardBack(d: IdCardData): Buffer {
  const c = new Canvas(856, 540, [230, 236, 240]);
  c.text(30, 30, "VERSO - SPECIMEN - DATE FICTIVE", GREY, 2);
  c.rect(30, 80, 380, 200, [210, 216, 222]);
  c.text(46, 96, "SEMNATURA TITULARULUI", GREY, 2);
  c.line(60, 230, 380, 200, INK, 3);
  const name = ascii(`${d.lastName}<<${d.firstName}`).toUpperCase().replace(/[^A-Z<]/g, "<");
  const l1 = ("IDROU" + name).padEnd(36, "<").slice(0, 36);
  const l2 = (d.series + d.number + "<" + "ROU" + d.cnp.slice(1, 7) + d.cnp[0] + "<<<<<<<").padEnd(36, "<").slice(0, 36);
  c.rect(0, 380, 856, 160, [250, 250, 250]);
  c.text(24, 410, l1, INK, 3);
  c.text(24, 460, l2, INK, 3);
  c.frame(4, 4, 848, 532, GREY, 3);
  return c.png();
}

/** A „scanned" text page: lines of text on an off-white sheet. */
export function scannedPage(title: string, lines: string[], stamp?: string): Buffer {
  const c = new Canvas(1000, 1414, [246, 243, 234]);
  c.text(80, 80, title.slice(0, 40), INK, 3);
  c.rect(80, 116, 840, 3, GREY);
  let y = 150;
  for (const l of lines) {
    let rest = ascii(l).toUpperCase();
    while (rest.length > 0 && y < 1250) {
      c.text(80, y, rest.slice(0, 68), INK, 2);
      rest = rest.slice(68);
      y += 26;
    }
    y += 8;
  }
  if (stamp) {
    c.frame(640, 1180, 280, 140, [60, 80, 170], 4);
    c.text(656, 1200, stamp.slice(0, 20), [60, 80, 170], 2);
    c.text(656, 1230, "COPIE - DATE FICTIVE", [60, 80, 170], 2);
  }
  c.text(80, 1360, "DOCUMENT FICTIV - DATE DE TEST", RED, 2);
  return c.png();
}

/** A site plan: the parcels drawn to scale from their corners (metres). */
export function sitePlan(
  title: string,
  parcels: { label: string; pts: { x: number; y: number }[]; highlight?: boolean }[],
  footer: string[],
): Buffer {
  const W = 1200;
  const H = 900;
  const c = new Canvas(W, H, [252, 252, 248]);
  c.text(40, 30, title.slice(0, 60), INK, 3);
  const all = parcels.flatMap((p) => p.pts);
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));
  const s = Math.min((W - 260) / (maxX - minX || 1), (H - 300) / (maxY - minY || 1));
  const tx = (x: number) => 80 + (x - minX) * s;
  const ty = (y: number) => 100 + (maxY - y) * s;
  for (const p of parcels) {
    const col: RGB = p.highlight ? RED : INK;
    p.pts.forEach((a, i) => {
      const b = p.pts[(i + 1) % p.pts.length];
      c.line(tx(a.x), ty(a.y), tx(b.x), ty(b.y), col, p.highlight ? 4 : 2);
      c.disc(tx(a.x), ty(a.y), 5, col);
      c.text(tx(a.x) + 8, ty(a.y) + 6, String(i + 1), col, 2);
    });
    const cx = p.pts.reduce((t, q) => t + q.x, 0) / p.pts.length;
    const cy = p.pts.reduce((t, q) => t + q.y, 0) / p.pts.length;
    c.text(tx(cx) - p.label.length * 6, ty(cy) - 7, p.label, col, 2);
  }
  // north arrow
  c.line(1120, 160, 1120, 100, INK, 3);
  c.line(1120, 100, 1108, 120, INK, 3);
  c.line(1120, 100, 1132, 120, INK, 3);
  c.text(1114, 168, "N", INK, 2);
  let y = H - 170;
  for (const f of footer) {
    c.text(40, y, f, INK, 2);
    y += 24;
  }
  c.text(40, H - 40, "PLAN FICTIV - DATE DE TEST - STEREO 70 SIMULAT", RED, 2);
  c.frame(10, 10, W - 20, H - 20, GREY, 2);
  return c.png();
}
