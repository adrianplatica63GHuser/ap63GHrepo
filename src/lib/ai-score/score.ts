/**
 * How well did the AI read a contract? Field-by-field against a human's answer key.
 *                                                                (Slice #36.23)
 *
 * Pure: no database, no network, no file system. `scripts/testing/ai-score.ts`
 * runs the application's own extraction (`@/lib/documents/ai-extract`) over a
 * corpus on disk and hands each answer here, with the contract's
 * `expected.json`. What goes into git from a run is only what `summarise`
 * returns — per-field counts and one number — never an expected or read value,
 * because the answer keys hold real people's names.
 *
 * ## How each field is compared — the whole rule, pinned by `ai-score.test.ts`
 *
 * | Kind     | Fields                                        | Correct when |
 * |----------|-----------------------------------------------|--------------|
 * | text     | `nrDocument`, any template `text` field       | equal after `foldLookupName` (the application's Romanian fold: no diacritics, lower case, punctuation → space), with a leading „nr" / „nr." dropped |
 * | date     | `dateDocument`, any template `date` field     | the same calendar day; `yyyy-mm-dd` and `dd.mm.yyyy` both read |
 * | number   | template `number` fields                      | within 0.5 of the expected value; Romanian notation read („1.785,50", „44.320.000") |
 * | select   | template `select` fields                      | the same option value; an expected `null` is also met by „NEMENTIONAT" or nothing, and vice versa |
 * | people   | one item per role („Vânzător", „Cumpărător")  | the same SET of people, order ignored; two names are one person when their folded words are the same words in any order |
 * | shares   | one item per person whose share is expected   | that person was found, and each share the key gives (`cotaParte` %, `cotaSuprafataMp` m²) is read within 0.5; „1/3" reads as 33.33 |
 * | land     | `tarla`, `parcela`, `carteFunciara`, `suprafataMp` | the CVC form has no field for these (#36.01 put the parcel on the property, not the deed), so the model can only put them in `unmappedRaw` or `subject`. Correct when one of those entries names the thing („tarla…", „parcel…", „carte funciară"/„CF", „suprafaț…") and the expected value follows it — the same words for identifiers, a number within 0.5 for the area |
 *
 * An expected `null` is scored for form fields — reading a value the deed does
 * not state is a mistake too — but NOT for land: nothing in `unmappedRaw` can
 * say „this deed names no land book", so there is nothing to compare.
 *
 * The one number is the micro average: every item of every contract counts
 * once. Per-field accuracy is reported beside it, so a field with few items
 * does not hide inside the total.
 */

import { foldLookupName } from "@/lib/import/lookup-name-match";

// ---------------------------------------------------------------------------
// The answer key and the model's answer, as the scorer sees them
// ---------------------------------------------------------------------------

export type FieldKind = "text" | "date" | "number" | "select";

export type ExpectedPerson = {
  name: string;
  cotaParte?: string | null;
  cotaSuprafataMp?: string | null;
};

export const LAND_KEYS = ["tarla", "parcela", "carteFunciara", "suprafataMp"] as const;
export type LandKey = (typeof LAND_KEYS)[number];

/** One contract's `expected.json`. */
export type ExpectedContract = {
  id: string;
  status: "proposed" | "confirmed";
  fields: Record<string, string | null>;
  parties: Record<string, ExpectedPerson[]>;
  land?: Partial<Record<LandKey, string | null>>;
};

export type ReadPerson = {
  roleName: string;
  name: string | null;
  cotaParte: string | null;
  cotaSuprafataMp: string | null;
};

/** What `interpretExtractText` returned, narrowed to what is scored. */
export type ReadContract = {
  fields: Record<string, string | null>;
  customFields: Record<string, string | null>;
  unmappedRaw: Record<string, string>;
  parties: ReadPerson[];
};

export type ItemResult = {
  contract: string;
  /** `nrDocument`, `parties.Vânzător`, `shares`, `land.tarla`, … */
  field: string;
  ok: boolean;
  /** The expected and the read value, for the run's private detail file — never for git. */
  expected: string | null;
  read: string | null;
};

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

function blank(v: string | null | undefined): v is null | undefined {
  return v === null || v === undefined || v.trim() === "";
}

/**
 * A number written the Romanian way, or the plain way. `null` when there is none.
 *
 * „," is always the decimal mark. „." is a thousands mark when every group
 * after it has three digits („44.320.000", „3.704") and a decimal mark
 * otherwise („178.5"). „1/3" and „50%" are shares: the fraction as a percentage,
 * the percentage as written.
 */
export function readNumber(value: string | null | undefined): number | null {
  if (blank(value)) return null;
  const v = value.trim();
  const frac = /(\d+)\s*\/\s*(\d+)/.exec(v);
  if (frac && !/\d[.,]\d/.test(v)) {
    const den = Number(frac[2]);
    return den === 0 ? null : (Number(frac[1]) / den) * 100;
  }
  const m = /-?\d[\d.,\s]*/.exec(v.replace(/(\d)\s+(?=\d{3}(?!\d))/g, "$1"));
  if (!m) return null;
  let s = m[0].replace(/\s+/g, "").replace(/[.,]$/, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** `yyyy-mm-dd` from `yyyy-mm-dd` or `dd.mm.yyyy` (also with / or -), else null. */
export function readDate(value: string | null | undefined): string | null {
  if (blank(value)) return null;
  const v = value.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** The application's fold, then a leading „nr" dropped: „Nr. 2378" and „2378" are one number. */
export function foldText(value: string | null | undefined): string {
  if (blank(value)) return "";
  return foldLookupName(value).replace(/^(?:nr|numar|numarul)(?: |$)/, "").trim();
}

/** A person's name as a set of words: „Prisecaru Ciprian" is „PRISECARU CIPRIAN". */
export function nameKey(name: string | null | undefined): string {
  return foldText(name).split(" ").filter(Boolean).sort().join(" ");
}

const NOT_STATED = "NEMENTIONAT";

// ---------------------------------------------------------------------------
// One field
// ---------------------------------------------------------------------------

export function compareField(kind: FieldKind, expected: string | null, read: string | null): boolean {
  switch (kind) {
    case "number": {
      const e = readNumber(expected);
      const r = readNumber(read);
      if (e === null || r === null) return e === null && r === null;
      return Math.abs(e - r) <= 0.5;
    }
    case "date":
      return readDate(expected) === readDate(read) && (readDate(expected) !== null || (blank(expected) && blank(read)));
    case "select": {
      const norm = (v: string | null) => (blank(v) || v.trim().toUpperCase() === NOT_STATED ? "" : v.trim().toUpperCase());
      return norm(expected) === norm(read);
    }
    case "text":
    default:
      return foldText(expected) === foldText(read);
  }
}

// ---------------------------------------------------------------------------
// Land — read out of what the model could not put in a field
// ---------------------------------------------------------------------------

/** Where in a folded word list the thing is named: the index just after its name, for each mention. */
function afterKeyword(words: string[], key: LandKey): number[] {
  const at: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (key === "tarla" && w.startsWith("tarla")) at.push(i + 1);
    else if (key === "parcela" && w.startsWith("parcel")) at.push(i + 1);
    else if (key === "suprafataMp" && w.startsWith("suprafat")) at.push(i + 1);
    else if (key === "carteFunciara") {
      if (w === "cf") at.push(i + 1);
      else if (w.startsWith("cart") && (words[i + 1] ?? "").startsWith("funciar")) at.push(i + 2);
    }
  }
  return at;
}

function isAnyLandWord(w: string): boolean {
  return w.startsWith("tarla") || w.startsWith("parcel") || w.startsWith("suprafat") || w === "cf" || w.startsWith("funciar");
}

/**
 * The words after a mention, up to the next land word or eight words, whichever
 * comes first. Land words right after the mention are stepped over first, so a
 * label „Tarla / Parcela: 3 / 82" still gives tarla a window.
 */
function windowAfter(words: string[], start: number): string[] {
  const out: string[] = [];
  let i = start;
  while (i < words.length && (isAnyLandWord(words[i]) || words[i] === "si")) i++;
  for (; i < words.length && out.length < 8; i++) {
    if (isAnyLandWord(words[i])) break;
    out.push(words[i]);
  }
  return out;
}

function containsRun(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((w, j) => haystack[i + j] === w)) return true;
  }
  return false;
}

/** The texts the model returned outside the form: each `unmappedRaw` entry as „label value", and the subject. */
export function landTexts(read: ReadContract): string[] {
  const out = Object.entries(read.unmappedRaw ?? {}).map(([k, v]) => `${k} ${v ?? ""}`);
  if (!blank(read.fields.subject)) out.push(read.fields.subject as string);
  return out;
}

export function findLand(texts: readonly string[], key: LandKey, expected: string): { ok: boolean; read: string | null } {
  for (const text of texts) {
    const words = foldLookupName(text).split(" ").filter(Boolean);
    for (const start of afterKeyword(words, key)) {
      const win = windowAfter(words, start);
      if (key === "suprafataMp") {
        // The number is read from the original text, where „3.704,00" is still one number.
        const e = readNumber(expected);
        const numbers = (text.match(/\d[\d.,]*/g) ?? []).map((n) => readNumber(n));
        if (e !== null && numbers.some((n) => n !== null && Math.abs(n - e) <= 0.5) && win.length > 0) {
          return { ok: true, read: text };
        }
      } else if (containsRun(win, foldLookupName(expected).split(" ").filter(Boolean))) {
        return { ok: true, read: text };
      }
    }
  }
  const mention = texts.find((t) => afterKeyword(foldLookupName(t).split(" ").filter(Boolean), key).length > 0);
  return { ok: false, read: mention ?? null };
}

// ---------------------------------------------------------------------------
// One contract
// ---------------------------------------------------------------------------

/** Field kinds for the generic keys; the template's own kinds are passed in. */
export const GENERIC_FIELD_KINDS: Record<string, FieldKind> = {
  title: "text",
  nrDocument: "text",
  dateDocument: "date",
  subject: "text",
};

export function scoreContract(
  expected: ExpectedContract,
  read: ReadContract,
  templateKinds: Readonly<Record<string, FieldKind>>,
): ItemResult[] {
  const items: ItemResult[] = [];
  const push = (field: string, ok: boolean, e: string | null, r: string | null) =>
    items.push({ contract: expected.id, field, ok, expected: e, read: r });

  for (const [key, e] of Object.entries(expected.fields)) {
    const kind: FieldKind = GENERIC_FIELD_KINDS[key] ?? templateKinds[key] ?? "text";
    const r = key in GENERIC_FIELD_KINDS ? read.fields[key] ?? null : read.customFields[key] ?? null;
    push(key, compareField(kind, e, r), e, r);
  }

  for (const [role, people] of Object.entries(expected.parties)) {
    const roleKey = foldText(role);
    const got = read.parties.filter((p) => foldText(p.roleName) === roleKey);
    const want = [...new Set(people.map((p) => nameKey(p.name)))].sort();
    const have = [...new Set(got.map((p) => nameKey(p.name)).filter(Boolean))].sort();
    push(
      `parties.${role}`,
      want.length === have.length && want.every((w, i) => w === have[i]),
      people.map((p) => p.name).join("; "),
      got.map((p) => p.name ?? "").join("; "),
    );

    for (const person of people) {
      const hasShare = !blank(person.cotaParte) || !blank(person.cotaSuprafataMp);
      if (!hasShare) continue;
      const match = got.find((p) => nameKey(p.name) === nameKey(person.name));
      const okParte = blank(person.cotaParte) || compareField("number", person.cotaParte ?? null, match?.cotaParte ?? null);
      const okMp =
        blank(person.cotaSuprafataMp) || compareField("number", person.cotaSuprafataMp ?? null, match?.cotaSuprafataMp ?? null);
      push(
        "shares",
        match !== undefined && okParte && okMp,
        `${person.cotaParte ?? "-"}% / ${person.cotaSuprafataMp ?? "-"} m²`,
        match ? `${match.cotaParte ?? "-"}% / ${match.cotaSuprafataMp ?? "-"} m²` : null,
      );
    }
  }

  const texts = landTexts(read);
  for (const key of LAND_KEYS) {
    const e = expected.land?.[key];
    if (blank(e)) continue;
    const found = findLand(texts, key, e);
    push(`land.${key}`, found.ok, e, found.read);
  }
  return items;
}

// ---------------------------------------------------------------------------
// A run
// ---------------------------------------------------------------------------

export type FieldScore = { field: string; correct: number; total: number; accuracy: number };

export type ScoreSummary = {
  contracts: number;
  correct: number;
  total: number;
  /** The one number: correct items over all items, 0–1. `null` when there were none. */
  score: number | null;
  /** Per field, weakest first; ties by name. */
  perField: FieldScore[];
};

export function summarise(items: readonly ItemResult[]): ScoreSummary {
  const byField = new Map<string, { correct: number; total: number }>();
  for (const it of items) {
    const f = byField.get(it.field) ?? { correct: 0, total: 0 };
    f.total += 1;
    if (it.ok) f.correct += 1;
    byField.set(it.field, f);
  }
  const perField = [...byField.entries()]
    .map(([field, f]) => ({ field, ...f, accuracy: f.correct / f.total }))
    .sort((a, b) => a.accuracy - b.accuracy || a.field.localeCompare(b.field));
  const correct = items.filter((i) => i.ok).length;
  return {
    contracts: new Set(items.map((i) => i.contract)).size,
    correct,
    total: items.length,
    score: items.length === 0 ? null : correct / items.length,
    perField,
  };
}

/** `72.4%` — one decimal, the way the score file writes it. */
export function percent(x: number | null): string {
  return x === null ? "—" : `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
}
