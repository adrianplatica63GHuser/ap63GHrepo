/**
 * The one module that validates an identity document's values.          (Slice 40.82)
 *
 * Every write of `identity_document` goes through `checkIdentityWrite`: a value its kind has no field for is
 * refused, a CNP is 13 digits with a valid checksum (or empty), a date is an ISO date, sex is MALE or FEMALE. A
 * CNP that disagrees with the same document's sex or date of birth is a WARNING the API returns, never a refusal —
 * a document records what was printed. `identity_document.cnp` is not unique: one person holds several documents.
 *
 * PURE — no React, no DB. Safe to import from a client component.
 */
import { z } from "zod/v4";
import {
  IDENTITY_KINDS,
  IDENTITY_VALUE_KEYS,
  identityValueKeysOf,
  type IdentityKind,
  type IdentityValueKey,
} from "./kinds";

export type IdentitySex = "MALE" | "FEMALE";

/** An identity document's values, every field of the table: `null` is empty. */
export type IdentityValues = { [K in IdentityValueKey]: K extends "sex" ? IdentitySex | null : string | null };

/** What a document's version snapshot carries under `identity` (null on an ordinary type). */
export type IdentitySnapshot = IdentityValues;

export function emptyIdentityValues(): IdentityValues {
  return Object.fromEntries(IDENTITY_VALUE_KEYS.map((k) => [k, null])) as IdentityValues;
}

/** The block a POST / PATCH may carry: any of the table's fields, each a string or null. Nothing else. */
export const identityInputSchema = z
  .object(Object.fromEntries(IDENTITY_VALUE_KEYS.map((k) => [k, z.string().nullish()])) as Record<IdentityValueKey, z.ZodOptional<z.ZodNullable<z.ZodString>>>)
  .strict();
export type IdentityInput = z.infer<typeof identityInputSchema>;

// ---------------------------------------------------------------------------
// CNP
// ---------------------------------------------------------------------------

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9] as const;

/** 13 digits whose last is the control digit of the first twelve (weights 279146358279, mod 11, 10 → 1). */
export function isValidCnp(cnp: string): boolean {
  if (!/^[0-9]{13}$/.test(cnp)) return false;
  const sum = CNP_WEIGHTS.reduce((acc, w, i) => acc + w * Number(cnp[i]), 0);
  const control = sum % 11 === 10 ? 1 : sum % 11;
  return control === Number(cnp[12]);
}

/** The control digit the first twelve digits call for — what a seed uses to invent a valid CNP. */
export function cnpControlDigit(first12: string): number {
  const sum = CNP_WEIGHTS.reduce((acc, w, i) => acc + w * Number(first12[i]), 0);
  return sum % 11 === 10 ? 1 : sum % 11;
}

/** The sex a CNP encodes (odd first digit male, even female), or null for 9 (a foreign citizen) or a bad CNP. */
export function cnpSex(cnp: string): IdentitySex | null {
  if (!/^[1-8]/.test(cnp)) return null;
  return Number(cnp[0]) % 2 === 1 ? "MALE" : "FEMALE";
}

/** The date of birth a CNP encodes, as YYYY-MM-DD, or null where the century is not stated (7, 8, 9) or the date is no date. */
export function cnpDateOfBirth(cnp: string): string | null {
  if (!/^[0-9]{13}$/.test(cnp)) return null;
  const century = ({ "1": 1900, "2": 1900, "3": 1800, "4": 1800, "5": 2000, "6": 2000 } as Record<string, number>)[cnp[0]];
  if (century === undefined) return null;
  const iso = `${century + Number(cnp.slice(1, 3))}-${cnp.slice(3, 5)}-${cnp.slice(5, 7)}`;
  return isIsoDate(iso) ? iso : null;
}

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// ---------------------------------------------------------------------------
// The write check
// ---------------------------------------------------------------------------

export const IDENTITY_FIELD_NOT_IN_KIND_CODE = "identity_field_not_in_kind";
export const IDENTITY_CNP_INVALID_CODE = "identity_cnp_invalid";
export const IDENTITY_DATE_INVALID_CODE = "identity_date_invalid";
export const IDENTITY_SEX_INVALID_CODE = "identity_sex_invalid";
export const IDENTITY_ON_ORDINARY_TYPE_CODE = "identity_on_ordinary_type";
export const IDENTITY_VALUES_HELD_CODE = "identity_values_held";

export type IdentityRefusalCode =
  | typeof IDENTITY_FIELD_NOT_IN_KIND_CODE
  | typeof IDENTITY_CNP_INVALID_CODE
  | typeof IDENTITY_DATE_INVALID_CODE
  | typeof IDENTITY_SEX_INVALID_CODE
  | typeof IDENTITY_ON_ORDINARY_TYPE_CODE
  | typeof IDENTITY_VALUES_HELD_CODE;

export type IdentityCheck =
  | { ok: true; values: Partial<IdentityValues> }
  | { ok: false; code: IdentityRefusalCode; fields: IdentityValueKey[] };

/** Trimmed; an empty string is null. MRZ keeps its line breaks, every line trimmed. */
function clean(key: IdentityValueKey, raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  if (key === "mrz") {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
    return lines.length > 0 ? lines.join("\n") : null;
  }
  const t = raw.trim().replace(/\s+/g, " ");
  return t === "" ? null : t;
}

/**
 * Normalise and judge a write of these values on a document of this kind. Only the keys the input names are in
 * `values`, so a PATCH leaves the others as they are. A value set (not null) on a field the kind does not have is
 * refused; null on such a field is allowed — it clears nothing that could be there.
 */
export function checkIdentityWrite(kind: IdentityKind, input: IdentityInput): IdentityCheck {
  const allowed = new Set<IdentityValueKey>(identityValueKeysOf(kind));
  const values: Partial<Record<IdentityValueKey, string | null>> = {};
  for (const key of IDENTITY_VALUE_KEYS) {
    if (!(key in input)) continue;
    values[key] = clean(key, input[key]);
  }
  const foreign = IDENTITY_VALUE_KEYS.filter((k) => values[k] != null && !allowed.has(k));
  if (foreign.length > 0) return { ok: false, code: IDENTITY_FIELD_NOT_IN_KIND_CODE, fields: foreign };

  if (values.cnp != null && !isValidCnp(values.cnp)) return { ok: false, code: IDENTITY_CNP_INVALID_CODE, fields: ["cnp"] };
  if (values.dateOfBirth != null && !isIsoDate(values.dateOfBirth)) {
    return { ok: false, code: IDENTITY_DATE_INVALID_CODE, fields: ["dateOfBirth"] };
  }
  if (values.sex != null) {
    if (values.sex !== "MALE" && values.sex !== "FEMALE") return { ok: false, code: IDENTITY_SEX_INVALID_CODE, fields: ["sex"] };
  }
  return { ok: true, values: values as Partial<IdentityValues> };
}

/** The identity values a kind has no field for that hold something — what a change of kind removes. */
export function valuesOutsideKind(kind: IdentityKind, values: IdentityValues): IdentityValueKey[] {
  const allowed = new Set<IdentityValueKey>(identityValueKeysOf(kind));
  return IDENTITY_VALUE_KEYS.filter((k) => values[k] != null && !allowed.has(k));
}

/** Does any field hold a value? */
export function identityHoldsValues(values: IdentityValues | null | undefined): boolean {
  return !!values && IDENTITY_VALUE_KEYS.some((k) => values[k] != null);
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export type IdentityWarning = { code: "cnp_sex_mismatch" | "cnp_birth_date_mismatch"; fields: IdentityValueKey[] };

/** A CNP that disagrees with the same document's sex or date of birth. Never a refusal. */
export function identityWarnings(values: IdentityValues): IdentityWarning[] {
  const out: IdentityWarning[] = [];
  const cnp = values.cnp;
  if (!cnp || !isValidCnp(cnp)) return out;
  const sex = cnpSex(cnp);
  if (values.sex && sex && values.sex !== sex) out.push({ code: "cnp_sex_mismatch", fields: ["cnp", "sex"] });
  const dob = cnpDateOfBirth(cnp);
  if (values.dateOfBirth && dob && values.dateOfBirth !== dob) {
    out.push({ code: "cnp_birth_date_mismatch", fields: ["cnp", "dateOfBirth"] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

/**
 * Two identity snapshots are equal when every field is. `null`, a missing block and an all-empty block are the
 * same: a snapshot written before Slice 40.82 has no `identity` key at all and reads as holding none.
 */
export function identitySnapshotsEqual(a: IdentitySnapshot | null | undefined, b: IdentitySnapshot | null | undefined): boolean {
  for (const k of IDENTITY_VALUE_KEYS) {
    if ((a?.[k] ?? null) !== (b?.[k] ?? null)) return false;
  }
  return true;
}

/** The kind's label key — re-exported so a caller needs one import. */
export function identityKindMessageKey(kind: IdentityKind): string {
  return IDENTITY_KINDS[kind].messageKey;
}
