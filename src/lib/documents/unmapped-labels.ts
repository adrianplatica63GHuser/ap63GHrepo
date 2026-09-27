/**
 * A label a person can read, for a key the model invented.  (Slice #37.06, FU-024)
 *
 * The extraction folds every fact it could not map into „Note extinse" as
 * `label: value` lines, and the label is the model's own KEY — an identifier
 * it makes up per read: `echivalent_pret_ron`, `notarBirou`,
 * `tarif_intabulare_OCPI`, `birou_notarial`. #36.23's thirty CVC answers hold
 * over two hundred distinct ones, so no list covers them; this does three
 * things, in order:
 *
 *   1. A key already written as words („Tarla", „Nr. cadastral") is the
 *      model's label, and is left exactly as it is.
 *   2. An identifier-shaped key whose letters match a key of
 *      `aiNotes.unmappedLabels` in messages/ro-RO.json — compared lowercase,
 *      letters and digits only, so `birou_notarial`, `birouNotarial` and
 *      `BirouNotarial` are one key — gets that Romanian label.
 *   3. Any other identifier is spelled out as words: split at `_`, `-`, a
 *      lower→upper hump and a letter↔digit edge, lowercased except for
 *      acronyms (`CF`, `OCPI`), first letter capitalised. Never snake_case or
 *      camelCase on a screen.
 *
 * ⚠️ **ROMANIAN ONLY, AND ON PURPOSE.** The notes are TEXT stored on the
 * document, read by a Romanian user; they are not re-rendered per locale. The
 * English labels in en-GB.json exist because `messages-key-parity.test.ts`
 * holds the two files to one key set, and they are what an English copy of
 * this function would use.
 */
import ro from "../../../messages/ro-RO.json";

const LABELS: Readonly<Record<string, string>> =
  ((ro as { aiNotes?: { unmappedLabels?: Record<string, string> } }).aiNotes?.unmappedLabels) ?? {};

/** Lowercase letters and digits only — the form two spellings of one key are compared in. */
function squash(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const BY_SQUASHED: ReadonlyMap<string, string> = new Map(
  Object.entries(LABELS).map(([k, label]) => [squash(k), label]),
);

/** `_`/`-`, a camelCase hump, or a single-word lowercase identifier: not written as words. */
function looksLikeIdentifier(key: string): boolean {
  if (/\s/.test(key)) return false;
  return /[_-]/.test(key) || /[a-z][A-Z]/.test(key) || /^[a-z0-9]+$/.test(key);
}

/** `obligatie_cumparator_extra` → „Obligatie cumparator extra"; `nrCF` → „Nr CF". */
export function spellOutIdentifier(key: string): string {
  const words = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter((w) => w !== "")
    .map((w) => (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w) ? w : w.toLowerCase()));
  if (words.length === 0) return key;
  const first = words[0];
  words[0] = first === first.toUpperCase() ? first : first[0].toUpperCase() + first.slice(1);
  return words.join(" ");
}

export function unmappedLabel(key: string, labels: ReadonlyMap<string, string> = BY_SQUASHED): string {
  const trimmed = key.trim();
  if (!looksLikeIdentifier(trimmed)) return trimmed;
  return labels.get(squash(trimmed)) ?? spellOutIdentifier(trimmed);
}
