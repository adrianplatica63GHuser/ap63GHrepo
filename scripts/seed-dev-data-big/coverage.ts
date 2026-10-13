/**
 * The coverage table every run prints: each of Adrian's figures, its target, and the value reached.   (Slice #39.20)
 *
 * PURE. seed.ts reads the rows back FROM THE DATABASE after the run and hands them here, so the table says what
 * was written, not what was planned. 39.21–39.23 add their lines to `coverageLines`.
 */

/** One natural person as read back: the fields Adrian's 90 % is about, and their relatives in the seed. */
export type NaturalRow = {
  cnp: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  relatives: number;
};

export type JudicialRow = {
  cui: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  representatives: number;
};

export type CoverageLine = {
  label: string;
  /** "≥ 90 %", "= 450", … — as printed */
  target: string;
  /** as printed: "412 / 450 (91.6 %)" */
  value: string;
  met: boolean;
};

const MARKER = "(date de test)";
const filled = (s: string | null | undefined): boolean => !!s && s.trim().length > 0;
export const meaningful = (notes: string | null | undefined): number =>
  (notes ?? "").replace(MARKER, "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

function share(label: string, hits: number, of: number, min: number): CoverageLine {
  const pct = of === 0 ? 0 : (hits / of) * 100;
  return { label, target: `≥ ${min} %`, value: `${hits} / ${of} (${pct.toFixed(1)} %)`, met: of > 0 && pct >= min };
}

function exactly(label: string, n: number, want: number): CoverageLine {
  return { label, target: `= ${want}`, value: String(n), met: n === want };
}

function atLeast(label: string, n: number, want: number): CoverageLine {
  return { label, target: `≥ ${want}`, value: String(n), met: n >= want };
}

export type CoverageInput = {
  natural: NaturalRow[];
  judicial: JudicialRow[];
  /** distinct generations among the seed's family members, and the earliest birth year */
  generations: number;
  earliestBirthYear: number | null;
  /** each family situation and how many times it occurs */
  scenarios: { label: string; count: number }[];
  scenarioMin: number;
  targets: { natural: number; judicial: number };
};

export function coverageLines(c: CoverageInput): CoverageLine[] {
  const n = c.natural;
  const j = c.judicial;
  const natAll = n.filter((r) => filled(r.cnp) && filled(r.dateOfBirth) && filled(r.placeOfBirth) && filled(r.phone) && filled(r.email) && meaningful(r.notes) >= 5);
  const jurAll = j.filter((r) => filled(r.cui) && filled(r.phone) && filled(r.email) && meaningful(r.notes) >= 5);
  return [
    exactly("Persoane fizice", n.length, c.targets.natural),
    share("PF cu CNP", n.filter((r) => filled(r.cnp)).length, n.length, 90),
    share("PF cu data nașterii", n.filter((r) => filled(r.dateOfBirth)).length, n.length, 90),
    share("PF cu locul nașterii", n.filter((r) => filled(r.placeOfBirth)).length, n.length, 90),
    share("PF cu un telefon", n.filter((r) => filled(r.phone)).length, n.length, 90),
    share("PF cu un e-mail", n.filter((r) => filled(r.email)).length, n.length, 90),
    share("PF cu note de minimum 5 cuvinte", n.filter((r) => meaningful(r.notes) >= 5).length, n.length, 90),
    share("PF cu toate cele de mai sus", natAll.length, n.length, 90),
    share("PF cu minimum 3 rude în sistem", n.filter((r) => r.relatives >= 3).length, n.length, 50),
    atLeast("Generații în familii", c.generations, 5),
    {
      label: "Cel mai vechi an de naștere",
      target: "≥ 1900",
      value: c.earliestBirthYear === null ? "—" : String(c.earliestBirthYear),
      met: c.earliestBirthYear !== null && c.earliestBirthYear >= 1900 && c.earliestBirthYear <= 1915,
    },
    ...c.scenarios.map((s) => atLeast(`Situație: ${s.label}`, s.count, c.scenarioMin)),
    exactly("Persoane juridice", j.length, c.targets.judicial),
    share("PJ cu CUI", j.filter((r) => filled(r.cui)).length, j.length, 90),
    share("PJ cu un telefon", j.filter((r) => filled(r.phone)).length, j.length, 90),
    share("PJ cu un e-mail", j.filter((r) => filled(r.email)).length, j.length, 90),
    share("PJ cu note de minimum 5 cuvinte", j.filter((r) => meaningful(r.notes) >= 5).length, j.length, 90),
    share("PJ cu toate cele de mai sus", jurAll.length, j.length, 90),
    share("PJ cu minimum un reprezentant din sistem", j.filter((r) => r.representatives >= 1).length, j.length, 50),
  ];
}

/** The table as printed: one line per figure, a ✓ or ✗, and a last line saying whether all are met. */
export function formatCoverage(lines: CoverageLine[]): string {
  const w = Math.max(...lines.map((l) => l.label.length));
  const rows = lines.map((l) => `${l.met ? "✓" : "✗"} ${l.label.padEnd(w)}  ${l.target.padEnd(8)}  ${l.value}`);
  const bad = lines.filter((l) => !l.met).length;
  return [...rows, bad === 0 ? `Toate cele ${lines.length} cerințe sunt îndeplinite.` : `! ${bad} din ${lines.length} cerințe NU sunt îndeplinite.`].join("\n");
}
