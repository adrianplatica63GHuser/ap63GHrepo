/**
 * The identity tile's pure rules — what the document screen draws and refuses.            (Slice 40.83)
 *
 * The tile „Act de identitate" shows exactly the kind's fields from the registry (kinds.ts), in the order the card
 * prints them, the document's own four (number, issue date, validity end, issuer) slotted in where the card prints
 * them, so nothing shows twice. These helpers are what the form asks: the rows the fields flow into, the notice a
 * change of type gives, the validity status, and the check before a save.
 *
 * PURE — no React, no DB. Unit-tested in src/__tests__/identity-document-tile.test.ts.
 */
import { packFieldRows, unitsInnerRem } from "@/lib/ui/field-widths";
import {
  IDENTITY_KINDS,
  IDENTITY_VALUE_KEYS,
  identityValueKeysOf,
  type IdentityFieldDef,
  type IdentityKind,
  type IdentityValueKey,
} from "./kinds";
import { cnpDateOfBirth, cnpSex, isValidCnp } from "./validation";

/** The rows the kind's fields flow into, and the tile's width in units (rule 18, the fields' own widths). */
export function identityFieldRows(kind: IdentityKind): { units: number; inner: number; rows: IdentityFieldDef[][] } {
  const fields = IDENTITY_KINDS[kind].fields;
  const byKey = new Map(fields.map((f) => [f.key, f] as const));
  const { units, rows } = packFieldRows(
    fields.map((f) => ({ key: f.key, width: f.width, full: false })),
    { minUnits: 3 },
  );
  return { units, inner: unitsInnerRem(units), rows: rows.map((r) => r.map((k) => byKey.get(k as IdentityFieldDef["key"])!)) };
}

/** The form's path for a field: the document's own column, or `identity.<field>`. */
export function identityFieldPath(f: IdentityFieldDef): string {
  if (f.target === "identity") return `identity.${f.key}`;
  return f.key === "issuer" ? "issuerPersonId" : f.key;
}

/** Every path the tile holds, in order. */
export function identityTilePaths(kind: IdentityKind): string[] {
  return IDENTITY_KINDS[kind].fields.map(identityFieldPath);
}

const filled = (v: string | null | undefined): boolean => (v ?? "").trim() !== "";

/**
 * What a change of type does to the identity values held (design 2.4, Ask first 5):
 *   - to an ORDINARY type while a value is held: refused — `held`;
 *   - to another identity KIND: the values that kind has no field for are removed on save — `removes`, named;
 *   - anything else: nothing to say.
 * `from` is the kind the document has now (its saved type), `to` the kind picked.
 */
export type IdentityChangeNotice = { kind: "held" } | { kind: "removes"; fields: IdentityValueKey[] } | null;

export function identityChangeNotice(
  from: IdentityKind | null,
  to: IdentityKind | null,
  values: Record<string, string | null | undefined>,
): IdentityChangeNotice {
  if (from === null || from === to) return null;
  if (to === null) return IDENTITY_VALUE_KEYS.some((k) => filled(values[k])) ? { kind: "held" } : null;
  const own = new Set(identityValueKeysOf(to));
  const fields = IDENTITY_VALUE_KEYS.filter((k) => filled(values[k]) && !own.has(k));
  return fields.length > 0 ? { kind: "removes", fields } : null;
}

/** VALABIL / EXPIRAT / EXPIRĂ ÎN n ZILE from „Valabil până la" and today — the person tile's words (40.79). */
export type ValidityStatus = { kind: "valid" } | { kind: "expired" } | { kind: "expiringSoon"; days: number } | null;

export function identityValidity(validUntil: string | null | undefined, today: Date, soonDays: number): ValidityStatus {
  const v = (validUntil ?? "").trim();
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)) return null;
  const until = new Date(`${v}T00:00:00`);
  if (Number.isNaN(until.getTime())) return null;
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (until.getTime() < day.getTime()) return { kind: "expired" };
  const days = Math.ceil((until.getTime() - day.getTime()) / 86_400_000);
  return days <= soonDays ? { kind: "expiringSoon", days } : { kind: "valid" };
}

/** The CNP's own error (refuses the save), or null: 13 digits with a valid control digit, or empty. */
export function identityCnpError(cnp: string | null | undefined): "identity_cnp_invalid" | null {
  const v = (cnp ?? "").trim();
  return v === "" || isValidCnp(v) ? null : "identity_cnp_invalid";
}

/** The CNP's warnings beside the printed sex and date of birth — never a refusal (a document records what was printed). */
export function identityCnpWarnings(values: Record<string, string | null | undefined>): ("cnp_sex_mismatch" | "cnp_birth_date_mismatch")[] {
  const cnp = (values.cnp ?? "").trim();
  if (!isValidCnp(cnp)) return [];
  const out: ("cnp_sex_mismatch" | "cnp_birth_date_mismatch")[] = [];
  const sex = cnpSex(cnp);
  if (filled(values.sex) && sex && values.sex !== sex) out.push("cnp_sex_mismatch");
  const dob = cnpDateOfBirth(cnp);
  if (filled(values.dateOfBirth) && dob && values.dateOfBirth !== dob) out.push("cnp_birth_date_mismatch");
  return out;
}
