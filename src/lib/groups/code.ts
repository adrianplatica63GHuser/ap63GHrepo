/**
 * Group code encoding  (Slice #18.07, extended Slice #18.17)
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
 * The full stored code prepends a target-type prefix (Slice #18.17, updated #18.18):
 *   PROPERTY        -> PROP-AA,  PROP-AB,  …
 *   PHYSICAL_PERSON -> PPERS-AA, PPERS-AB, …
 *   JUDICIAL_PERSON -> JPERS-AA, JPERS-AB, …
 *   DOCUMENT        -> DOC-AA,   DOC-AB,   …
 *
 * Pure + dependency-free so it can be unit-tested without a DB.
 */

import type { GroupTargetType } from "./validation";

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

/**
 * Returns the display prefix for a given target type (Slice #18.17).
 * The prefix is stored as part of the code in the DB; codes are globally
 * unique because the `group_code_seq` sequence never reuses values.
 */
export function groupCodePrefix(targetType: GroupTargetType): string {
  switch (targetType) {
    case "PROPERTY":        return "PROP-";
    case "PHYSICAL_PERSON": return "PPERS-";
    case "JUDICIAL_PERSON": return "JPERS-";
    case "DOCUMENT":        return "DOC-";
  }
}
