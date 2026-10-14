/**
 * The deaths already in the data → „Decedat" and „Data decesului". Pure, so jest holds its rules.   (Slice #39.30)
 *
 * Two sources (Ask first #1):
 *   (a) the big dev seed's dead — its persons (its manifest, or the seed's „(date de test)" marker in the notes) whose
 *       notes carry „Data decesului: dd.mm.yyyy." (the seed wrote it there before #39.30);
 *   (b) every person who is the „Defunct" party of a „Certificat de moștenitor" that has a „Data decesului".
 *
 * WHAT IT CHANGES: a person not yet marked dead is ticked „Decedat" with the date, when the sources agree on one.
 * Two certificates — or a certificate and the notes — with different dates: the person is ticked and the date is
 * left empty, and the line says so (somebody has to look). A date the rules refuse (before the birth, in the future)
 * likewise: ticked, no date. A person already marked dead is left exactly as they are, even with another date: the
 * screen's value is somebody's decision. Afterwards the two fields are independent of the notes and the certificate.
 */
import { deathProblem } from "../../src/lib/persons/death";

export type Candidate = {
  personId: string;
  code: string;
  isDeceased: boolean;
  dateOfDeath: string | null;
  dateOfBirth: string | null;
  /** where each date was read: „notele", „certificatul 55/2018" … */
  sources: { date: string; from: string }[];
};

export type Change = {
  personId: string;
  code: string;
  dateOfDeath: string | null;
  /** why the date is what it is, in Romanian — printed beside the person's code */
  why: string;
};

export type Skip = { personId: string; code: string; why: string };

/** „Data decesului: 12.03.1998." → 1998-03-12. */
export function deathFromNotes(notes: string | null | undefined): string | null {
  const m = /Data decesului:\s*(\d{2})\.(\d{2})\.(\d{4})/.exec(notes ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function planBackfill(candidates: readonly Candidate[], today: Date = new Date()): { changes: Change[]; skipped: Skip[] } {
  const changes: Change[] = [];
  const skipped: Skip[] = [];
  for (const c of candidates) {
    if (c.isDeceased) {
      skipped.push({ personId: c.personId, code: c.code, why: `deja marcată „Decedat"${c.dateOfDeath ? ` (${c.dateOfDeath})` : ""} — lăsată cum este` });
      continue;
    }
    const dates = [...new Set(c.sources.map((s) => s.date))];
    const from = c.sources.map((s) => s.from).join(", ");
    if (dates.length !== 1) {
      changes.push({ personId: c.personId, code: c.code, dateOfDeath: null, why: `date diferite (${c.sources.map((s) => `${s.from}: ${s.date}`).join("; ")}) — „Decedat" fără dată, de verificat` });
      continue;
    }
    const problem = deathProblem({ isDeceased: true, dateOfDeath: dates[0], dateOfBirth: c.dateOfBirth }, today);
    if (problem) {
      changes.push({ personId: c.personId, code: c.code, dateOfDeath: null, why: `${dates[0]} din ${from} nu se poate (${problem}) — „Decedat" fără dată, de verificat` });
      continue;
    }
    changes.push({ personId: c.personId, code: c.code, dateOfDeath: dates[0], why: `din ${from}` });
  }
  return { changes, skipped };
}

/** Joins what both sources said of each person into one candidate. */
export function mergeSources(
  rows: readonly { personId: string; code: string; isDeceased: boolean; dateOfDeath: string | null; dateOfBirth: string | null }[],
  said: readonly { personId: string; date: string; from: string }[],
): Candidate[] {
  const byId = new Map(rows.map((r) => [r.personId, r]));
  const out = new Map<string, Candidate>();
  for (const s of said) {
    const r = byId.get(s.personId);
    if (!r) continue;
    const c = out.get(s.personId) ?? { ...r, sources: [] };
    c.sources.push({ date: s.date, from: s.from });
    out.set(s.personId, c);
  }
  return [...out.values()].sort((a, b) => a.code.localeCompare(b.code));
}
