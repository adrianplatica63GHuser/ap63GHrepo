/**
 * A natural person's age in whole years, from an ISO date (YYYY-MM-DD).
 *                                                                (Slice #37.60)
 *
 * The form's „Vârstă" and the Natural Persons list's column read the same
 * function — it was the form's own `calculateAge` until the list offered the
 * column too. Null for no date, an unreadable one, or one in the future.
 */
export function ageFromDob(dob: string | null | undefined, today: Date = new Date()): number | null {
  if (!dob) return null;
  // ⚠️ **THE DATE'S OWN DIGITS, NOT `new Date(dob)`.** A bare „2000-06-15" parses
  // as midnight UTC, which west of Greenwich is the evening of the 14th — so the
  // birthday arrived a day early (the runner, on Toronto time, caught it). The
  // day is compared as written against today's local date.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let age = today.getFullYear() - y;
  const dm = today.getMonth() + 1 - mo;
  if (dm < 0 || (dm === 0 && today.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

/** dd.mm.yyyy, as the forms show a date; null for none. */
export function dmyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
}
