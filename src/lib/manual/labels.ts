/**
 * Are the manual's quoted labels the screen's?                                              (Slice #39.46)
 *
 * Adrian, 2026-10-15: two manuals, one in English only and one in Romanian only. A label the English manual quotes
 * is the English SCREEN's string — taken from messages/en-GB.json, never translated afresh — and a label the
 * Romanian manual quotes is a string of messages/ro-RO.json. Where a screen shows a Romanian DATA VALUE in either
 * language (a document type's name, a role, a value-list entry, a document form's field — forms draw `labelRo` on
 * both screens — „CNP”), the manual quotes it as the screen shows it. So a quote „…” in a manual must be one of:
 *
 *   - a string of that language's messages — exactly, or as an ICU message filled in („3 rezultate” for
 *     `{count, plural, one {# rezultat} other {# rezultate}}`), or the start of one (or of one of its plural
 *     branches) that the manual cuts at a word boundary („Adaugă în grup” for „Adaugă în grup ({count})”,
 *     „Adaugă …” for „Adaugă persoană”), or words a message itself shows in quotes („continuă oricum”), or a run
 *     of at least two words a message shows („legate, nu importate din nou”);
 *   - one of those with the glyph the screen draws before it („+ Adaugă parte”, „✕ Restrânge”), in the brackets
 *     the screen draws round it („(Tată)”, „[Preț]”), or a navigation bar's trail of them („Acasă › Etichete”);
 *   - a data value (the reference data, the document forms — read by the test from the files that load them);
 *   - on that language's named list of quotes that are not labels, each with its reason
 *     (src/lib/manual/label-allowances.ts).
 *
 * A label that drifts — renamed on the screen, or never on it — fails `manual-labels.test.ts`, in either language.
 *
 * And for the English manual a second rule: every word it says itself is English, so outside quotes there are no
 * Romanian letters (ă â î ș ț) and no Romanian screen string (`romanianOutsideQuotes`).
 *
 * PURE — the test reads the files and hands the strings in.
 */

export type QuotedLabel = { source: string; line: number; text: string };

/**
 * Every „…” in a source, nested ones too („Deschide în „Interacțiuni”” gives both), with its line. An English
 * message quotes with “…”, and the manual quotes that message whole — „The shares for “Cumpărător” add up …” — so
 * “ opens a nested quote too, closed by the same ”.
 */
export function quotedLabels(source: string, text: string): QuotedLabel[] {
  const out: QuotedLabel[] = [];
  const open: { at: number; line: number }[] = [];
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") line++;
    else if (c === "„" || c === "“") open.push({ at: i, line });
    else if (c === "”") {
      const o = open.pop();
      if (o) out.push({ source, line: o.line, text: text.slice(o.at + 1, i) });
    }
  }
  return out;
}

const ANY = "\u0000";

/**
 * An ICU message as a regular expression: `{x}` and `#` match anything, a plural or select matches any of its
 * branches. Returns null for a message that has no placeholder (it is matched exactly) or for one so generic that
 * it would match anything at all („{count}”, „{name} ({n})”).
 */
export function icuPattern(message: string): RegExp | null {
  if (!message.includes("{")) return null;
  let i = 0;
  function seq(inPlural: boolean, stop: string): string {
    let out = "";
    while (i < message.length && !stop.includes(message[i])) {
      const c = message[i];
      if (c === "{") {
        out += arg(inPlural);
      } else if (c === "#" && inPlural) {
        out += ANY;
        i++;
      } else if (c === "'" && message[i + 1] === "'") {
        out += escape("'");
        i += 2;
      } else {
        out += escape(c);
        i++;
      }
    }
    return out;
  }
  function arg(inPlural: boolean): string {
    i++; // {
    let head = "";
    while (i < message.length && message[i] !== "}" && message[i] !== "{") head += message[i++];
    const parts = head.split(",").map((p) => p.trim());
    if (message[i] === "}" || parts.length < 2) {
      // {name}: anything, to the closing brace.
      let depth = 1;
      while (i < message.length && depth > 0) {
        if (message[i] === "{") depth++;
        else if (message[i] === "}") depth--;
        i++;
      }
      return ANY;
    }
    const plural = /plural|selectordinal/.test(parts[1]);
    // branches: `key {text} key {text} … }` — the head already holds the first key after the second comma.
    const branches: string[] = [];
    while (i < message.length && message[i] !== "}") {
      if (message[i] === "{") {
        i++;
        branches.push(seq(plural || inPlural, "}"));
        i++; // }
      } else i++; // a branch key, or spaces
    }
    i++; // the argument's }
    return branches.length ? `(?:${branches.join("|")})` : ANY;
  }
  const body = seq(false, "");
  const re = new RegExp(`^${body.split(ANY).join(".+?")}$`, "u");
  // Too generic to mean anything: it matches a nonsense string.
  if (re.test("zq xj zq") || re.test("7")) return null;
  return re;
}

function escape(c: string): string {
  return /[.*+?^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
}

export type LabelBook = {
  exact: ReadonlySet<string>;
  patterns: readonly RegExp[];
  /** What a manual may cut: every string, and every plural or select branch of a message, as written. */
  starts: readonly string[];
  /** Every message and branch, lower-cased, for a run of words the screen shows mid-sentence. */
  texts: readonly string[];
  /** Words a message shows in quotes of its own — „…”, “…” or "…". */
  quotedInMessages: ReadonlySet<string>;
};

/** The texts of an ICU message's branches, nested ones included: `{n, plural, one {Un câmp} other {# câmpuri}}`. */
export function icuBranches(message: string): string[] {
  const out: string[] = [];
  const re = /(?:^|[\s}])(?:=?[\w]+)\s*\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message))) out.push(m[1].trim());
  return out.filter(Boolean);
}

/**
 * A message as the screen shows it: rich-text tags gone („<link>Distilare Tipizate</link>”), and its closing quotes
 * the manual's — a message may close „ with " or open with “.
 */
export function asShown(message: string): string {
  return message
    .replace(/<\/?[a-zA-Z]+>/g, "")
    .replace(/“/g, "„")
    .replace(/"/g, "”")
    .trim();
}

/** The strings a manual may quote: its language's messages, and the data values both screens show. */
export function labelBook(messages: Iterable<string>, dataValues: Iterable<string>): LabelBook {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  const starts: string[] = [];
  const quotedInMessages = new Set<string>();
  for (const raw of messages) {
    const m = asShown(raw);
    if (!m) continue;
    exact.add(m);
    starts.push(m);
    const p = icuPattern(m);
    if (p) {
      patterns.push(p);
      starts.push(...icuBranches(m));
      // Cut before a last placeholder: „acest document „Titlu anterior al”” of „acest document „{role}” {other}”.
      const cut = icuPattern(m.replace(/\s*\{\w+\}$/, ""));
      if (cut) patterns.push(cut);
    }
    for (const q of m.matchAll(/„([^„”]+)”/g)) quotedInMessages.add(q[1].trim());
  }
  for (const d of dataValues) {
    if (!d.trim()) continue;
    exact.add(d.trim());
    starts.push(d.trim());
  }
  const texts = starts.map((t) => t.toLocaleLowerCase("ro"));
  return { exact, patterns, starts, texts, quotedInMessages };
}

const LETTER = /[\p{L}\p{N}]/u;

/** Is `quote` a screen string or a data value of `book` — as the module note lists the ways it may be one? */
export function isScreenString(quote: string, book: LabelBook): boolean {
  const q = asShown(quote);
  if (asWritten(q, book)) return true;
  // A navigation bar's trail.
  if (q.includes(" › ")) return q.split(" › ").every((part) => asWritten(part.trim(), book));
  // The glyph the screen draws before a label, or the brackets it draws round one.
  const glyph = /^[^\p{L}\p{N}„(\[…]+\s+(.+)$/u.exec(q);
  if (glyph && asWritten(glyph[1], book)) return true;
  const bracket = /^[([](.+)[)\]]$/u.exec(q);
  if (bracket && asWritten(bracket[1].trim(), book)) return true;
  return false;
}

function asWritten(q: string, book: LabelBook): boolean {
  if (book.exact.has(q) || book.quotedInMessages.has(q)) return true;
  if (book.patterns.some((p) => p.test(q))) return true;
  // Cut: „Adaugă …”, „Confirm legarea …” or a bare start („Adaugă în grup”), ending where a word ends.
  const stem = q.split("…")[0].trim();
  if (stem.length < 4) return false;
  for (const s of book.starts) {
    if (s.length > stem.length && s.startsWith(stem) && !LETTER.test(s[stem.length])) return true;
  }
  // A run of at least two words the screen shows mid-sentence, starting and ending where words do.
  if (/\s/.test(stem) && stem.length >= 10) {
    const low = stem.toLocaleLowerCase("ro");
    for (const t of book.texts) {
      let at = t.indexOf(low);
      while (at >= 0) {
        const before = at === 0 ? "" : t[at - 1];
        const after = t[at + low.length] ?? "";
        if (!LETTER.test(before) && !LETTER.test(after)) return true;
        at = t.indexOf(low, at + 1);
      }
    }
  }
  return false;
}

/** The quotes of a manual's sources that are neither a screen string nor a data value nor an allowed quote. */
export function unknownLabels(
  sources: readonly { source: string; text: string }[],
  book: LabelBook,
  allowed: ReadonlySet<string>,
): QuotedLabel[] {
  const out: QuotedLabel[] = [];
  for (const { source, text } of sources) {
    for (const q of quotedLabels(source, text)) {
      if (allowed.has(q.text) || isScreenString(q.text, book)) continue;
      out.push(q);
    }
  }
  return out;
}

const ROMANIAN_LETTERS = /[ăâîșțşţĂÂÎȘȚŞŢ]/u;

/** A line of the English manual with every quoted span removed (nested quotes included). */
export function outsideQuotes(line: string): string {
  let depth = 0;
  let out = "";
  for (const c of line) {
    if (c === "„" || c === "“") depth++;
    else if (c === "”" && depth > 0) depth--;
    else if (depth === 0) out += c;
  }
  return out;
}

/**
 * Romanian in the English manual's own words: a Romanian letter, or a Romanian screen string (several words, not
 * also an English one, not a data value), outside quotes. `romanian` is ro-RO's messages minus en-GB's and the data
 * values; strings shorter than two words are left out — „Import” is both languages.
 */
export function romanianOutsideQuotes(
  sources: readonly { source: string; text: string }[],
  romanian: readonly string[],
): { source: string; line: number; found: string }[] {
  const phrases = romanian.filter((r) => r.includes(" ") && r.length >= 6 && !r.includes("{")).sort((a, b) => b.length - a.length);
  const out: { source: string; line: number; found: string }[] = [];
  for (const { source, text } of sources) {
    text.split("\n").forEach((raw, i) => {
      const line = outsideQuotes(raw);
      const letter = ROMANIAN_LETTERS.exec(line);
      if (letter) {
        out.push({ source, line: i + 1, found: line.trim().slice(Math.max(0, letter.index - 20), letter.index + 20) });
        return;
      }
      const phrase = phrases.find((p) => line.includes(p));
      if (phrase) out.push({ source, line: i + 1, found: phrase });
    });
  }
  return out;
}
