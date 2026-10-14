/**
 * The interactions seed's coverage table — each of Adrian's figures, its target, the value reached.   (Slice #39.29)
 *
 * PURE. seed.ts reads the interactions back FROM THE DATABASE after the run and hands them here, so the table says
 * what was written, not what was planned. Printed with the big seed's `formatCoverage`.
 */
import { atLeast, exactly, share, type CoverageLine } from "../seed-dev-data-big/coverage";
import { CHANNELS, DIRECTIONS, MAX_PER_PERSON, STATUSES, lifeWindow, violations, type PlannedInteraction, type SeedPerson } from "./plan";

export type InteractionsCoverageInput = {
  persons: readonly SeedPerson[];
  /** as read back */
  rows: readonly PlannedInteraction[];
  now: Date;
};

export function interactionLines({ persons, rows, now }: InteractionsCoverageInput): CoverageLine[] {
  const withAny = new Set(rows.map((r) => r.personId));
  const nat = persons.filter((p) => p.kind === "NATURAL");
  const jur = persons.filter((p) => p.kind === "JUDICIAL");
  const natCan = nat.filter((p) => lifeWindow(p, now) !== null);
  const hits = (ps: readonly SeedPerson[]) => ps.filter((p) => withAny.has(p.id)).length;
  const pairs = CHANNELS.flatMap((c) => DIRECTIONS.map((d) => [c, d] as const)).filter(([c, d]) => rows.some((r) => r.channel === c && r.direction === d)).length;
  const per = new Map<string, number>();
  for (const r of rows) per.set(r.personId, (per.get(r.personId) ?? 0) + 1);
  const most = Math.max(0, ...per.values());
  const broken = violations(rows, persons, now);
  const allShare = share("PF cu interacțiuni, din toate (informativ)", hits(nat), nat.length, 0);
  return [
    atLeast("Interacțiuni scrise", rows.length, 1),
    share("PF adulte în viață în arhivă cu interacțiuni", hits(natCan), natCan.length, 90),
    { ...allShare, target: "—", met: true },
    share("PJ cu interacțiuni", hits(jur), jur.length, 70),
    share("Interacțiuni cu documente atașate", rows.filter((r) => r.documentIds.length > 0).length, rows.length, 30),
    exactly("Perechi canal × direcție acoperite", pairs, CHANNELS.length * DIRECTIONS.length),
    ...STATUSES.map((s) => atLeast(`Stare: ${s}`, rows.filter((r) => r.status === s).length, 1)),
    { label: "Maximum pe persoană", target: `≤ ${MAX_PER_PERSON}`, value: String(most), met: most <= MAX_PER_PERSON },
    exactly("Reguli încălcate (vârstă, deces, canal, viitor, acte, proprietăți)", broken.length, 0),
  ];
}
