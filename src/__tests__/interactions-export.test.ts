/**
 * Slice #38.88 — „Interacțiuni": exporting what the grid shows.
 *
 * A CSV Excel on a Romanian Windows opens straight into columns with its diacritics (Ask first #1): UTF-8 with a BOM,
 * „;" between fields, CRLF lines, dates as dd.MM.yyyy HH:mm. A description holding a semicolon, a quote and a line
 * break is ONE cell. The description is in the file (§3); the internal note is not (Ask first #2).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { BOM, EOL, EXPORT_COLUMNS, SEPARATOR, cell, exportFileName, stamp, toCsv, type ExportRow, type ExportWords } from "@/lib/interactions/export";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const RO = JSON.parse(read("messages", "ro-RO.json")) as {
  interactions: {
    export: { column: Record<string, string> };
    channel: Record<string, string>;
    direction: Record<string, string>;
    status: Record<string, string>;
  };
  shared: { unnamed: { person: string } };
};
const WORDS: ExportWords = {
  column: RO.interactions.export.column as ExportWords["column"],
  channel: RO.interactions.channel as ExportWords["channel"],
  direction: RO.interactions.direction as ExportWords["direction"],
  status: RO.interactions.status as ExportWords["status"],
  unnamedPerson: RO.shared.unnamed.person,
};
const ROW: ExportRow = {
  occurredAt: "2026-10-09T11:22:00.000Z",
  channel: "PHONE",
  direction: "INBOUND",
  personName: "Ștefănescu Ana",
  subject: "Apel; revenire",
  description: 'A spus "da";\r\na doua zi trimite actele.',
  documentCount: 2,
  status: "NEEDS_REPLY",
  followUpOn: "2026-10-16",
  tags: ["Contract", "Urgent"],
};

/** A small RFC 4180 reader — what Excel does with the file, to check it reads back cell for cell. */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === SEPARATOR) {
      row.push(cur);
      cur = "";
    } else if (c === "\r" && csv[i + 1] === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      i++;
    } else cur += c;
  }
  return rows;
}

describe("the file (Ask first #1)", () => {
  const csv = toCsv([ROW], WORDS, "Europe/Bucharest");

  it("starts with the BOM, separates with „;”, ends each line with CRLF", () => {
    expect(csv.startsWith(BOM)).toBe(true);
    expect(SEPARATOR).toBe(";");
    expect(csv.endsWith(EOL)).toBe(true);
    expect(EOL).toBe("\r\n");
  });

  it("the header row is the columns' Romanian names, and has no internal note", () => {
    const [header] = parse(csv.slice(BOM.length));
    expect(header).toEqual(EXPORT_COLUMNS.map((c) => RO.interactions.export.column[c]));
    expect(header).toEqual(["Data și ora", "Canal", "Sens", "Persoană", "Subiect", "Descriere", "Acte legate", "Stare", "Memento", "Etichete"]);
    expect(EXPORT_COLUMNS as readonly string[]).not.toContain("internalNote");
  });

  it("a description with a semicolon, a quote and a line break reads back as one cell, whole", () => {
    const rows = parse(csv.slice(BOM.length));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([
      "09.10.2026 14:22",
      "Telefon",
      "Primită",
      "Ștefănescu Ana",
      "Apel; revenire",
      'A spus "da";\r\na doua zi trimite actele.',
      "2",
      "Așteaptă răspuns",
      "16.10.2026",
      "Contract, Urgent",
    ]);
  });

  it("the Romanian letters are written as UTF-8 characters, not escaped", () => {
    expect(csv).toContain("Ștefănescu");
    expect(Buffer.from(csv, "utf8").subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  it("a person with no name has the words, never the system ID", () => {
    expect(parse(toCsv([{ ...ROW, personName: null }], WORDS).slice(BOM.length))[1][3]).toBe(RO.shared.unnamed.person);
  });
});

describe("a cell", () => {
  it("is quoted only when it must be, its quotes doubled", () => {
    expect(cell("simplu")).toBe("simplu");
    expect(cell("a;b")).toBe('"a;b"');
    expect(cell('el a zis "nu"')).toBe('"el a zis ""nu"""');
    expect(cell("rând\nnou")).toBe('"rând\nnou"');
    expect(cell(" spațiu")).toBe('" spațiu"');
  });

  it("a value Excel would run as a formula is shown as text", () => {
    expect(cell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(cell("+40 721 000 112")).toBe("'+40 721 000 112");
  });
});

describe("dates and the file's name", () => {
  it("dd.MM.yyyy HH:mm in the browser's time zone; the server's own when the zone is unknown", () => {
    expect(stamp("2026-10-09T11:22:00.000Z", "Europe/Bucharest")).toBe("09.10.2026 14:22");
    expect(stamp("2026-10-09T11:22:00.000Z", "America/Toronto")).toBe("09.10.2026 07:22");
    expect(stamp("2026-10-09T11:22:00.000Z", "Nowhere/Never")).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
  });

  it("interactiuni-<date>.csv", () => {
    expect(exportFileName(new Date("2026-10-10T03:00:00.000Z"), "America/Toronto")).toBe("interactiuni-2026-10-09.csv");
    expect(exportFileName(new Date("2026-10-10T03:00:00.000Z"), "Europe/Bucharest")).toBe("interactiuni-2026-10-10.csv");
  });
});

describe("the route reads the grid's own query and never the internal note", () => {
  it("the list's filters and order, no page; the export query reads no internal note", () => {
    const route = read("src", "app", "api", "interactions", "export", "route.ts");
    expect(route).toContain("interactionListQuerySchema");
    expect(route).toContain(".omit({ limit: true, offset: true })");
    const src = read("src", "lib", "interactions", "queries.ts");
    const fn = src.slice(src.indexOf("export async function exportInteractions"), src.indexOf("export async function getInteraction"));
    expect(fn).toContain("listWhere(f)");
    expect(fn).toContain("description: interaction.description");
    expect(fn).not.toMatch(/internalNote|internal_note/);
  });
});
