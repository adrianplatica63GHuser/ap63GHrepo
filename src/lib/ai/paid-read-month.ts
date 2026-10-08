/**
 * Where „this month" starts for the paid-read count.              (Slice #38.40)
 *
 * Pure, apart from ./paid-reads.ts and its database, so a test can hold it.
 */

/** The first instant of `now`'s month, in UTC. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
