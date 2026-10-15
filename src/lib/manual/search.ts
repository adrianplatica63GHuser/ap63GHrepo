/**
 * „Întreabă” — finding where the user manual answers a question.                              (Slice #39.45)
 *
 * The built-in layer of the question box: it costs nothing, answers at once and sends nothing out. Every section
 * of the manual (a chapter's opening text counts as one) is one entry; a question finds the entries that say what
 * it asks, ranked, the five best by default, each with the sentences that match and the words that matched.
 *
 * HOW A WORD MATCHES (Ask first 4):
 *   - Romanian with or without diacritics: ș ş s, ț ţ t, ă â a, î i are one letter each (`fold`).
 *   - A question's word matches the BEGINNING of a manual word — „adaug” finds „adăugarea” — and a longer question
 *     word matches a manual word it shares its first five letters and all but its last three with („adăugare”
 *     finds „adăugați”), as a lighter match. A word of three letters or fewer matches only a little beyond itself.
 *   - Small words („cum”, „unde”, „the”, „how”) are left out of the question.
 *   - A word the whole manual uses everywhere counts for less than a rare one; a match in a section's title counts
 *     for more than one in its text, and more again when the question covers most of the title; and an entry
 *     that matches more of the question's words ranks higher.
 *
 * The AI layer (src/app/api/manual/ask/route.ts) is given only what this returns.
 *
 * PURE — no I/O. Built once per language from `getManual` and cached by the caller.
 */
import { inlineText, type Block, type Inline, type Manual, type ManualLocale } from "@/lib/manual/format";

/** One letter at a time, so a folded string has the original's length and its positions map one to one. */
export function fold(text: string): string {
  let out = "";
  for (const ch of text) {
    const f = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    out += f.length === 1 ? f : ch.toLowerCase().slice(0, 1) || " ";
  }
  return out;
}

const STOP = new Set(
  (
    // Romanian
    "a al ale am ar as asa ati au avea are ca cand care cat ce cel cea cei cele cu cum da dar daca de deci din dintr " +
    "dupa e ea el este eu fi fie fost i in inca intr isi la le li lui ma mai mi ne nici nu o or ori pe pentru poate " +
    "pot prin sa sau se si sunt te tot un una unde unei unui va vreau vrea fac face facem " +
    // English
    "an and are as at be by can could do does for from had has have how i if in into is it its me my no not of on " +
    "or so that the their them then there these this to was we what when where which who why will with would you your"
  ).split(" "),
);

/** The question's words that count: folded, two letters or more, not a small word. */
export function queryWords(question: string): string[] {
  const words = fold(question).match(/[a-z0-9]+/g) ?? [];
  return [...new Set(words.filter((w) => w.length >= 2 && !STOP.has(w)))];
}

/**
 * How well a question's word `q` matches a manual word `w`: 1, 0.6 or 0. A short question word (three letters or
 * fewer) matches only words at most three letters longer — „add” finds „added”, not „address”.
 */
export function wordMatch(q: string, w: string): number {
  if (w.startsWith(q)) return q.length > 3 || w.length <= q.length + 3 ? 1 : 0;
  if (q.length >= 5 && w.length >= 5) {
    let n = 0;
    while (n < q.length && n < w.length && q[n] === w[n]) n++;
    if (n >= 5 && n >= q.length - 3) return 0.6;
  }
  return 0;
}

export type ManualEntry = {
  id: string;
  number: string;
  title: string;
  chapterTitle: string;
  /** The entry's sentences as the manual shows them — cross-references as their numbers, no markup. */
  sentences: string[];
  titleWords: string[];
  /** Per sentence, its folded words. */
  sentenceWords: string[][];
};

/** A paragraph's sentences: split after . ! ? or … when a capital, a digit or a quote follows. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+(?=[„"(A-ZĂÂÎȘȚŞŢ0-9])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function blockSentences(b: Block, manual: Manual): string[] {
  const t = (inl: readonly Inline[]) => inlineText(inl, manual).trim();
  switch (b.kind) {
    case "paragraph":
      return sentencesOf(t(b.inlines));
    case "list":
      return b.items.map(t).filter(Boolean);
    case "table":
      return [b.header.map(t).join(" · "), ...b.rows.map((r) => r.map(t).join(" · "))].filter(Boolean);
    case "figure":
      return [b.caption];
    default:
      return [];
  }
}

const words = (s: string) => fold(s).match(/[a-z0-9]+/g) ?? [];

/** Every entry of one language's manual: one per chapter's opening text and one per section. */
export function manualEntries(manual: Manual): ManualEntry[] {
  const out: ManualEntry[] = [];
  for (const chapter of manual.chapters) {
    let current: ManualEntry | null = null;
    for (const b of chapter.blocks) {
      if (b.kind === "heading") {
        current = { id: b.id, number: b.number, title: b.title, chapterTitle: chapter.title, sentences: [], titleWords: words(b.title), sentenceWords: [] };
        out.push(current);
        continue;
      }
      if (!current) continue;
      for (const s of blockSentences(b, manual)) {
        current.sentences.push(s);
        current.sentenceWords.push(words(s));
      }
    }
  }
  return out;
}

export type ManualIndex = { locale: ManualLocale; entries: ManualEntry[] };

export function buildIndex(manual: Manual): ManualIndex {
  return { locale: manual.locale, entries: manualEntries(manual) };
}

/** A sentence cut into runs, the matched words marked. */
export type Highlighted = { text: string; hit: boolean }[];

export type SearchResult = {
  id: string;
  number: string;
  title: string;
  chapterTitle: string;
  score: number;
  /** The best sentences, in the manual's order, the matched words marked. */
  sentences: Highlighted[];
};

/** Mark, in a sentence as written, every word some question word matches. */
export function highlight(sentence: string, qwords: readonly string[]): Highlighted {
  const folded = fold(sentence);
  const runs: Highlighted = [];
  let at = 0;
  for (const m of folded.matchAll(/[a-z0-9]+/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (!qwords.some((q) => wordMatch(q, m[0]) > 0)) continue;
    if (start > at) runs.push({ text: sentence.slice(at, start), hit: false });
    runs.push({ text: sentence.slice(start, end), hit: true });
    at = end;
  }
  if (at < sentence.length) runs.push({ text: sentence.slice(at), hit: false });
  return runs;
}

function best(qw: string, ws: readonly string[]): number {
  let b = 0;
  for (const w of ws) {
    const m = wordMatch(qw, w);
    if (m > b) b = m;
    if (b === 1) break;
  }
  return b;
}

/**
 * The entries that answer the question, best first — at most `limit`, and none whose score is below a fifth of
 * the best one's, so a strong answer is not padded with weak ones.
 */
export function searchManual(index: ManualIndex, question: string, opts: { limit?: number; sentences?: number } = {}): SearchResult[] {
  const limit = opts.limit ?? 5;
  const perEntry = opts.sentences ?? 2;
  const qwords = queryWords(question);
  if (qwords.length === 0) return [];
  const n = index.entries.length;

  // How rare each question word is across the manual.
  const df = qwords.map((q) => index.entries.filter((e) => best(q, e.titleWords) > 0 || e.sentenceWords.some((ws) => best(q, ws) > 0)).length);
  const idf = df.map((d) => Math.log(1 + n / (1 + d)));

  const scored = index.entries.map((e) => {
    let score = 0;
    let matched = 0;
    // How much of the title the question covers: „O persoană adăugată de mână” is more about adding a person
    // than „Adăugați o firmă nouă, cu persoana ei de contact”, though both hold the two words.
    const titleWords = e.titleWords.filter((w) => !STOP.has(w));
    const inTitleCount = titleWords.filter((w) => qwords.some((q) => wordMatch(q, w) > 0)).length;
    const focus = titleWords.length ? inTitleCount / titleWords.length : 0;
    const titleWeight = 3 * (0.5 + 0.5 * focus);
    qwords.forEach((q, i) => {
      const inTitle = best(q, e.titleWords);
      let inText = 0;
      let count = 0;
      for (const ws of e.sentenceWords) {
        const m = best(q, ws);
        if (m > 0) count++;
        if (m > inText) inText = m;
      }
      if (inTitle > 0 || inText > 0) matched++;
      score += idf[i] * (titleWeight * inTitle + inText * (1 + Math.log(1 + count)));
    });
    const coverage = matched / qwords.length;
    return { e, score: score * coverage * coverage };
  });

  const ranked = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return [];
  const floor = ranked[0].score / 5;

  return ranked
    .filter((s) => s.score >= floor)
    .slice(0, limit)
    .map(({ e, score }) => {
      const picks = e.sentenceWords
        .map((ws, i) => ({ i, hits: qwords.reduce((a, q) => a + best(q, ws), 0) }))
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits || a.i - b.i)
        .slice(0, perEntry)
        .sort((a, b) => a.i - b.i);
      const chosen = picks.length > 0 ? picks.map((p) => e.sentences[p.i]) : e.sentences.slice(0, 1);
      return {
        id: e.id,
        number: e.number,
        title: e.title,
        chapterTitle: e.chapterTitle,
        score: Math.round(score * 100) / 100,
        sentences: chosen.map((s) => highlight(s, qwords)),
      };
    });
}

/** An entry's whole text, for the AI layer: its number and title, then its sentences. */
export function entryText(index: ManualIndex, id: string): string | null {
  const e = index.entries.find((x) => x.id === id);
  return e ? `§${e.number} ${e.title}\n${e.sentences.join("\n")}` : null;
}
