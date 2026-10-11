/**
 * „Interacțiuni" — what the grid shows, as a file Excel opens.   (Slice #38.88)
 *
 * The spec (§3): „Export, secondary. Exports the filtered rows to CSV or XLSX. Description text is included in the
 * export even though it is not a filter." Ask first #1 (the recommended answer): CSV only — UTF-8 with a byte-order
 * mark and a semicolon between fields, which is what Excel on a Romanian Windows opens straight into columns with
 * its diacritics; dates as dd.MM.yyyy HH:mm in the browser's own time zone; the file `interactiuni-<date>.csv`.
 * Ask first #2: the internal note is NOT in the file — it is team-only, and an export is a file that leaves the app.
 *
 * Pure: the route reads the rows and the words and hands them here.
 */
import type { InteractionChannel, InteractionDirection, InteractionStatus } from "./model";

/** The byte-order mark that tells Excel the file is UTF-8. */
export const BOM = "﻿";
/** Excel on a Romanian Windows splits on the list separator, which is „;". */
export const SEPARATOR = ";";
/** Excel's own line ending. */
export const EOL = "\r\n";
/** The most rows one export writes — far above any filtered log, and a bound on the work. */
export const EXPORT_MAX = 10_000;

/** The file's columns, in order. No internal note (Ask first #2). */
export const EXPORT_COLUMNS = ["occurredAt", "channel", "direction", "person", "subject", "description", "documents", "status", "followUp", "tags"] as const;
export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

export interface ExportRow {
  occurredAt: string;
  channel: InteractionChannel;
  direction: InteractionDirection;
  personName: string | null;
  subject: string;
  description: string | null;
  documentCount: number;
  status: InteractionStatus;
  followUpOn: string | null;
  tags: string[];
}

export interface ExportWords {
  column: Readonly<Record<ExportColumn, string>>;
  channel: Readonly<Record<InteractionChannel, string>>;
  direction: Readonly<Record<InteractionDirection, string>>;
  status: Readonly<Record<InteractionStatus, string>>;
  unnamedPerson: string;
}

/**
 * One cell. A value holding the separator, a quote, a line break or a leading or trailing space is quoted, its
 * quotes doubled — RFC 4180, which Excel follows — so a description with „;" and an Enter in it stays one cell.
 * A value starting with = + - @ is prefixed with an apostrophe, so Excel shows it rather than running it.
 */
export function cell(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\r\n]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** dd.MM.yyyy HH:mm in the given IANA time zone (the browser's, sent by it); the server's own if none or unknown. */
export function stamp(iso: string, timeZone?: string): string {
  const parts = (tz?: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  let p: Record<string, string>;
  try {
    p = parts(timeZone);
  } catch {
    p = parts(undefined);
  }
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** A `yyyy-MM-dd` date as dd.MM.yyyy. */
function day(d: string | null): string {
  const m = d ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(d) : null;
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** The whole file: the BOM, the header row, one line per row in the order given. */
export function toCsv(rows: readonly ExportRow[], words: ExportWords, timeZone?: string): string {
  const header = EXPORT_COLUMNS.map((c) => cell(words.column[c])).join(SEPARATOR);
  const lines = rows.map((r) =>
    [
      stamp(r.occurredAt, timeZone),
      words.channel[r.channel],
      words.direction[r.direction],
      r.personName && r.personName.trim() ? r.personName : words.unnamedPerson,
      r.subject,
      r.description ?? "",
      String(r.documentCount),
      words.status[r.status],
      day(r.followUpOn),
      r.tags.join(", "),
    ]
      .map(cell)
      .join(SEPARATOR),
  );
  return BOM + [header, ...lines].join(EOL) + EOL;
}

/** `interactiuni-<yyyy-MM-dd>.csv`, the day in the given time zone. */
export function exportFileName(now: Date, timeZone?: string): string {
  const s = stamp(now.toISOString(), timeZone);
  const [d, m, y] = s.slice(0, 10).split(".");
  return `interactiuni-${y}-${m}-${d}.csv`;
}
