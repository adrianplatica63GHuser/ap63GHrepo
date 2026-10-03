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
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/** dd.mm.yyyy, as the forms show a date; null for none. */
export function dmyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
}
