/**
 * The thirteen professions of „Tip profesional" (migration_114), and which one a planned person holds.   (Slice #39.81)
 *
 * PURE. persons.ts gives each adult the profession the occupation in their notes names — a notary „Notar", a
 * surveyor „Topograf / expert cadastral", a farmer „Fermier / arendaș" — and „Persoană privată" to every other adult;
 * a child has none. Until #39.81 the seed knew two types, „Notar" and „Expert", and created „Expert" where it was
 * missing — the value migration_114 renamed to „Expert tehnic / judiciar".
 */
import { ageAt } from "./dates";
import { TODAY, type PlanPerson } from "./families";

/** migration_114's thirteen professions, in its order. */
export const PROFESSIONS = [
  "Notar", "Avocat", "Executor judecătoresc", "Topograf / expert cadastral", "Evaluator", "Expert tehnic / judiciar",
  "Agent imobiliar", "Arhitect / proiectant", "Constructor / meșter", "Funcționar public", "Contabil / consultant fiscal",
  "Fermier / arendaș", "Persoană privată",
] as const;
export type Profession = (typeof PROFESSIONS)[number];

/** The occupation the notes name → the profession. Anything not listed is „Persoană privată" for an adult. */
const OCCUPATION_PROFESSION: readonly (readonly [RegExp, Profession])[] = [
  [/^notar public/, "Notar"],
  [/^avocat/, "Avocat"],
  [/^expert cadastral/, "Topograf / expert cadastral"],
  [/^economistă la o bancă/, "Evaluator"],
  [/^inginer în Măgurele/, "Expert tehnic / judiciar"],
  [/^agent imobiliar/, "Agent imobiliar"],
  [/^arhitect/, "Arhitect / proiectant"],
  [/^(antreprenor în construcții|maistru constructor|zidar|tâmplar|fierar)/, "Constructor / meșter"],
  [/^(funcționară la Primăria|polițist local)/, "Funcționar public"],
  [/^(contabil|contabilă)/, "Contabil / consultant fiscal"],
  [/^(agricultor|lucrător la CAP|lucrătoare la CAP|inginer agronom|paznic la ferma|lucrătoare la grădina)/, "Fermier / arendaș"],
];

/** The profession of a planned person: none for a child; the occupation's, or „Persoană privată". */
export function professionOf(p: Pick<PlanPerson, "dob" | "dod">, occupation: string | null): Profession | null {
  if (ageAt(p.dob, p.dod ?? TODAY) < 18) return null;
  if (occupation) for (const [re, prof] of OCCUPATION_PROFESSION) if (re.test(occupation)) return prof;
  return "Persoană privată";
}

