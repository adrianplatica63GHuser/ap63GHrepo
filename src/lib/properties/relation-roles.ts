/**
 * Which property↔property roles read the same from both ends.   (Slice #37.10, FU-220)
 *
 * Of migration_055's seven, four are symmetric — „Adiacent", „Contiguu",
 * „Suprapus cu", „Alipit de": if A is adjacent to B, B is adjacent to A — and
 * the header asks that they read as they always have, a bare chip on both
 * properties. The other three — „Inclus în", „Subdiviziune a", „Acces prin" —
 * are directional and are shown as a sentence that says which property is which.
 *
 * ⚠️ **THE LIST IS OF THE SYMMETRIC ONES, SO THE DEFAULT IS THE SENTENCE.** A
 * role renamed on Date de referință, or one added later, is not on it and gets
 * the sentence — which cannot be read the wrong way — rather than a bare chip,
 * which can. A role wrongly on the sentence side is wordy; a directional role
 * wrongly on the bare side is FU-220 again. Matched with case, diacritics and
 * spacing folded, so „Suprapus  cu" and „suprapus cu" are the same role.
 */
const SYMMETRIC = ["Adiacent", "Contiguu", "Suprapus cu", "Alipit de"];

function fold(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const SYMMETRIC_FOLDED = new Set(SYMMETRIC.map(fold));

export function propertyRoleReadsSameBothWays(roleName: string): boolean {
  return SYMMETRIC_FOLDED.has(fold(roleName));
}

/** What the „Tip relație" cell shows for one link, from the property being viewed. */
export type PropertyRoleChip =
  | { kind: "none" }
  | { kind: "bare"; role: string }
  | { kind: "forward"; role: string; other: string }
  | { kind: "backward"; role: string; other: string };

export function propertyRoleChip(
  roleName: string | null,
  roleReadsFromViewed: boolean,
  /** The other property, by its name (#37.57: never its system ID). */
  other: string,
): PropertyRoleChip {
  if (!roleName) return { kind: "none" };
  if (propertyRoleReadsSameBothWays(roleName)) return { kind: "bare", role: roleName };
  return roleReadsFromViewed
    ? { kind: "forward", role: roleName, other }
    : { kind: "backward", role: roleName, other };
}
