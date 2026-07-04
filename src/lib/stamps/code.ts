/**
 * Stamp code encoding  (Slice #19.09.Stamps)
 *
 * Stamp codes are THREE letters drawn from the same 24-letter alphabet used
 * by group codes (I and O excluded to avoid visual ambiguity):
 *
 *   A B C D E F G H J K L M N P Q R S T U V W X Y Z
 *
 * Codes are allocated in order from the `stamp_code_seq` Postgres sequence
 * (1-based) and NEVER reused. `encodeStampCode(n)` maps the sequence value:
 *
 *   1    -> AAA      24   -> AAZ      25   -> ABA
 *   576  -> AZZ      577  -> BAA      13824 -> ZZZ
 *
 * The full stored code always carries the "STMP-" prefix:
 *   STMP-AAA, STMP-AAB, …, STMP-ZZZ
 *
 * Pure + dependency-free so it can be unit-tested without a DB.
 */

/** 24-letter alphabet, I and O removed (same as group codes). */
export const STAMP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

const BASE = STAMP_CODE_ALPHABET.length; // 24
const MAX_THREE_LETTER = BASE * BASE * BASE; // 13 824

/** Fixed prefix prepended to every stamp code. */
export const STAMP_CODE_PREFIX = "STMP-";

/**
 * Encode a 1-based sequence value as a three-letter stamp code (no prefix).
 * Throws if `seq` is outside the valid range (1..13824).
 */
export function encodeStampCode(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Invalid stamp code sequence value: ${seq}`);
  }
  if (seq > MAX_THREE_LETTER) {
    throw new Error(
      `Stamp code sequence exhausted (>${MAX_THREE_LETTER}); a fourth letter would be needed.`,
    );
  }
  const value = seq - 1; // 0-based
  const first  = Math.floor(value / (BASE * BASE));
  const second = Math.floor((value % (BASE * BASE)) / BASE);
  const third  = value % BASE;
  return (
    STAMP_CODE_ALPHABET[first] +
    STAMP_CODE_ALPHABET[second] +
    STAMP_CODE_ALPHABET[third]
  );
}

/**
 * Build the full stored code (prefix + three letters) from a sequence value.
 * e.g. encodeFullStampCode(1) === "STMP-AAA"
 */
export function encodeFullStampCode(seq: number): string {
  return STAMP_CODE_PREFIX + encodeStampCode(seq);
}

/**
 * Build the display name for a stamp: "{code} - {shortDescription}".
 * e.g. "STMP-AAA - Proprietate litigioasă"
 */
export function stampDisplayName(code: string, shortDescription: string): string {
  return `${code} - ${shortDescription}`;
}
