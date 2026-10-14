/**
 * „Decedat" and „Data decesului" — the rules, in one place.                  (Slice #39.30)
 *
 * The pattern of HL7 FHIR's Patient.deceased[x] and of a CRM's „Deceased" / „Deceased date": a tick, off by default,
 * and an optional date that only a person marked dead can carry (dead with the date unknown is a real case). The date
 * is never before the birth and never in the future. Unticking clears the date.
 *
 * migration_108 holds the first two in CHECKs; „not in the future" needs a clock, so it is here, and the route asks
 * with its own. The form uses the same function, so the two cannot disagree.
 */

export type DeathFields = {
  isDeceased?: boolean | null;
  dateOfDeath?: string | null;
  dateOfBirth?: string | null;
};

export type DeathProblem = "DEATH_WITHOUT_DECEASED" | "DEATH_BEFORE_BIRTH" | "DEATH_IN_FUTURE";

/** Today's local date as yyyy-mm-dd — the day the user is living in, not UTC's. */
export function localIsoDate(today: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
}

/** What is wrong with these fields, or null. ISO dates compare as strings. */
export function deathProblem(f: DeathFields, today: Date = new Date()): DeathProblem | null {
  const dod = f.dateOfDeath ? f.dateOfDeath.slice(0, 10) : null;
  if (!dod) return null;
  if (!f.isDeceased) return "DEATH_WITHOUT_DECEASED";
  if (f.dateOfBirth && dod < f.dateOfBirth.slice(0, 10)) return "DEATH_BEFORE_BIRTH";
  if (dod > localIsoDate(today)) return "DEATH_IN_FUTURE";
  return null;
}

/** Unticking „Decedat" clears the date: what is written when the tick is off. */
export function normaliseDeath<T extends DeathFields>(f: T): T {
  return f.isDeceased === false && f.dateOfDeath ? { ...f, dateOfDeath: null } : f;
}

/** The Romanian sentence for each refusal (the form's message keys carry the same words). */
export const DEATH_PROBLEM_TEXT: Readonly<Record<DeathProblem, string>> = {
  DEATH_WITHOUT_DECEASED: "„Data decesului” se poate completa doar pentru o persoană marcată „Decedat”.",
  DEATH_BEFORE_BIRTH: "„Data decesului” nu poate fi înainte de „Data nașterii”.",
  DEATH_IN_FUTURE: "„Data decesului” nu poate fi în viitor.",
};

/** The year of a yyyy-mm-dd, or null. */
export function yearOfIso(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-/.exec(iso ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * A save refused by these rules. Thrown inside the create and the update, where the merged state is known, and
 * answered 400 with its `code` by `dbErrorToResponse` (src/lib/api/errors.ts), so every route that writes a natural
 * person says it the same way.
 */
export class DeathRefusedError extends Error {
  constructor(readonly code: DeathProblem) {
    super(DEATH_PROBLEM_TEXT[code]);
    this.name = "DeathRefusedError";
  }
}

/** Throws when the fields break a rule; returns them with the date cleared when „Decedat" is off. */
export function checkedDeath<T extends DeathFields>(f: T, today: Date = new Date()): T {
  const n = normaliseDeath(f);
  const problem = deathProblem(n, today);
  if (problem) throw new DeathRefusedError(problem);
  return n;
}
