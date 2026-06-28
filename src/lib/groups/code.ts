/**
 * Group code encoding  (Slice #18.07)
 *
 * Group codes are two letters drawn from a 24-letter alphabet that EXCLUDES the
 * visually-ambiguous letters I and O:
 *
 *   A B C D E F G H J K L M N P Q R S T U V W X Y Z
 *
 * Codes are allocated in order from the `group_code_seq` Postgres sequence
 * (1-based) and NEVER reused. `encodeGroupCode(n)` maps the 1-based sequence
 * value to its code:
 *
 *   1  -> AA      24 -> AZ      25 -> BA      576 -> ZZ
 *
 * Pure + dependency-free so it can be unit-tested without a DB.
 */

/** 24-letter alphabet, I and O removed. */
export const GROUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

const BASE = GROUP_CODE_ALPHABET.length; // 24
const MAX_TWO_LETTER = BASE * BASE;      // 576

/**
 * Encode a 1-based sequence value as a two-letter group code.
 * Throws if `seq` is out of the supported two-letter range (1..576).
 */
export function encodeGroupCode(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Invalid group code sequence value: ${seq}`);
  }
  if (seq > MAX_TWO_LETTER) {
    throw new Error(
      `Group code sequence exhausted (>${MAX_TWO_LETTER}); a third letter is needed.`,
    );
  }
  const value = seq - 1; // 0-based
  const first = Math.floor(value / BASE);
  const second = value % BASE;
  return GROUP_CODE_ALPHABET[first] + GROUP_CODE_ALPHABET[second];
}
