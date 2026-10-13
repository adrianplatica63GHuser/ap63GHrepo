/**
 * CNP and CUI for invented persons — well formed, with a valid control digit.   (Slice #39.20)
 *
 * PURE: no database. The seed checks every value against the ones already in the database before it
 * uses it (both are unique, migration_025/070), and these functions keep a run's own values apart.
 * Nothing here is copied from the archive (C:\dev\.claude\rules\capture-and-personal-data.md).
 */

const CNP_KEY = "279146358279";
const CUI_KEY = "753217532";

/**
 * The CNP's first digit: 1/2 for those born 1900–1999, 5/6 for 2000–2099 (odd = male). 3/4 were the
 * 1800s and are never needed here: the seed's oldest person is born in 1900.
 */
export function cnpSexDigit(sex: "MALE" | "FEMALE", birthYear: number): number {
  if (birthYear < 1900 || birthYear > 2099) throw new Error(`cnp: birth year ${birthYear} is outside 1900–2099`);
  const male = sex === "MALE";
  return birthYear >= 2000 ? (male ? 5 : 6) : male ? 1 : 2;
}

/** The control digit of the first twelve digits. */
export function cnpControlDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) throw new Error(`cnp: „${first12}" is not twelve digits`);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * Number(CNP_KEY[i]);
  const r = sum % 11;
  return r === 10 ? 1 : r;
}

/**
 * A CNP for a person of `sex` born on `dob` (yyyy-mm-dd) in the county whose CNP code is `county`
 * (two digits: 23 Ilfov, 41–46 București's sectors, …), with serial `serial` (1–999).
 */
export function makeCnp(sex: "MALE" | "FEMALE", dob: string, county: string, serial: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) throw new Error(`cnp: „${dob}" is not yyyy-mm-dd`);
  if (!/^\d{2}$/.test(county)) throw new Error(`cnp: county „${county}" is not two digits`);
  if (!Number.isInteger(serial) || serial < 1 || serial > 999) throw new Error(`cnp: serial ${serial} is outside 1–999`);
  const s = cnpSexDigit(sex, Number(m[1]));
  const first12 = `${s}${m[1].slice(2)}${m[2]}${m[3]}${county}${String(serial).padStart(3, "0")}`;
  return first12 + cnpControlDigit(first12);
}

export type CnpParts = { sex: "MALE" | "FEMALE"; dob: string; county: string; serial: number };

/** The parts of a valid CNP, or null when its shape, date or control digit is wrong. */
export function parseCnp(cnp: string): CnpParts | null {
  if (!/^\d{13}$/.test(cnp)) return null;
  if (cnpControlDigit(cnp.slice(0, 12)) !== Number(cnp[12])) return null;
  const s = Number(cnp[0]);
  const century = s === 1 || s === 2 ? 1900 : s === 5 || s === 6 ? 2000 : s === 3 || s === 4 ? 1800 : null;
  if (century === null) return null;
  const y = century + Number(cnp.slice(1, 3));
  const mo = Number(cnp.slice(3, 5));
  const d = Number(cnp.slice(5, 7));
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const serial = Number(cnp.slice(9, 12));
  if (serial < 1) return null;
  return {
    sex: s % 2 === 1 ? "MALE" : "FEMALE",
    dob: `${y}-${cnp.slice(3, 5)}-${cnp.slice(5, 7)}`,
    county: cnp.slice(7, 9),
    serial,
  };
}

/** The control digit of a CUI body (2–9 digits). */
export function cuiControlDigit(body: string): number {
  if (!/^\d{2,9}$/.test(body)) throw new Error(`cui: „${body}" is not 2–9 digits`);
  const key = CUI_KEY.slice(-body.length);
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[i]) * Number(key[i]);
  return ((sum * 10) % 11) % 10;
}

/** A CUI: the body, its control digit, and „RO" in front for a VAT payer. */
export function makeCui(body: number, vatPayer: boolean): string {
  const digits = String(body);
  return `${vatPayer ? "RO" : ""}${digits}${cuiControlDigit(digits)}`;
}

/** Whether `cui` (with or without „RO") has a correct control digit. */
export function isValidCui(cui: string): boolean {
  const digits = cui.replace(/^RO/i, "");
  if (!/^\d{3,10}$/.test(digits)) return false;
  return cuiControlDigit(digits.slice(0, -1)) === Number(digits.slice(-1));
}

/** The digits a CUI is unique by — „RO123" and „123" are the same company. */
export const cuiDigits = (cui: string): string => cui.replace(/^RO/i, "");
