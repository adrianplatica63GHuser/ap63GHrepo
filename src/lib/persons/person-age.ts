/**
 * A natural person's age in whole years, from an ISO date (YYYY-MM-DD).
 *                                                                (Slice #37.60)
 *
 * The form's „Vârstă" and the Natural Persons list's column read the same
 * function — it was the form's own `calculateAge` until the list offered the
 * column too. Null for no date, an unreadable one, or one in the future.
 *
 * Slice #39.30: a dead person's age stops at death. `personAge` is what every
 * screen shows — the list's column, the form's „Vârstă", the preview — and the
 * one place that decides it: a living person's counted to today, a dead
 * person's at the date of death and marked „†", a dead person with no date
 * none at all („Decedat").
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

/** The age on a calendar day given as yyyy-mm-dd (a date of death), by the same digits rule. */
export function ageOnDate(dob: string | null | undefined, on: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(on ?? "");
  if (!m) return null;
  return ageFromDob(dob, new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export type PersonAgeInput = {
  dateOfBirth: string | null | undefined;
  isDeceased?: boolean | null;
  dateOfDeath?: string | null;
};

/** What the person's age is: alive and counted to today, dead at the date of death, or dead with no date. */
export type PersonAge =
  | { kind: "alive"; years: number }
  | { kind: "dead"; years: number }
  | { kind: "deadUndated" }
  | null;

export function personAge(p: PersonAgeInput, today: Date = new Date()): PersonAge {
  if (p.isDeceased) {
    if (!p.dateOfDeath) return { kind: "deadUndated" };
    const years = ageOnDate(p.dateOfBirth, p.dateOfDeath);
    return years === null ? { kind: "deadUndated" } : { kind: "dead", years };
  }
  const years = ageFromDob(p.dateOfBirth, today);
  return years === null ? null : { kind: "alive", years };
}

/** The marker after a dead person's age and name: the genealogist's dagger. */
export const DECEASED_MARK = "†";

/**
 * The age as shown: „42", „78 †", or the word for „dead" (`deceasedWord`, the caller's translation) — null for no
 * age. A sort by age sorts by the number in front, which is `personAgeYears`.
 */
export function personAgeText(p: PersonAgeInput, deceasedWord: string, today: Date = new Date()): string | null {
  const a = personAge(p, today);
  if (!a) return null;
  if (a.kind === "alive") return String(a.years);
  if (a.kind === "dead") return `${a.years} ${DECEASED_MARK}`;
  return deceasedWord;
}

/** The number a sort by age compares: the age shown, none for a dead person with no date. */
export function personAgeYears(p: PersonAgeInput, today: Date = new Date()): number | null {
  const a = personAge(p, today);
  return a && a.kind !== "deadUndated" ? a.years : null;
}

/** dd.mm.yyyy, as the forms show a date; null for none. */
export function dmyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

/**
 * „Adăugat la": the day a record was created, dd.mm.yyyy in the reader's own time zone — `createdAt` is a timestamp,
 * not a date, so the ISO digits would be the UTC day; "" for a value that is not one. Acte's since #37.62, moved here
 * in 40.45 so the four lists show the field alike.
 */
export function addedOn(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
