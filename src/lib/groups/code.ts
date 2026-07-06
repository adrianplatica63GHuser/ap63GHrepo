/**
 * Group code encoding  (Slice #18.07, simplified in Slice #20.08)
 *
 * Group codes are a simple numeric sequence, zero-padded to at least 3 digits:
 *
 *   1  -> GRP-001
 *   2  -> GRP-002
 *  42  -> GRP-042
 * 999  -> GRP-999
 * 1000 -> GRP-1000   (4 digits; no cap)
 *
 * Codes are allocated in order from the `group_code_seq` Postgres sequence
 * (1-based) and NEVER reused. The stored code is the full "GRP-NNN" string —
 * no target-type prefix (all four target types share the same code space).
 *
 * Pure + dependency-free so it can be unit-tested without a DB.
 */

/**
 * Encode a 1-based sequence value as a GRP-NNN group code.
 * Throws if `seq` is not a positive integer.
 */
export function encodeGroupCode(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Invalid group code sequence value: ${seq}`);
  }
  return `GRP-${String(seq).padStart(3, "0")}`;
}
