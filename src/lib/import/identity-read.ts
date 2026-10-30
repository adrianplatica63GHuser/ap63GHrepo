/**
 * One read of an identity document, and where each of its values goes.                    (Slice 40.86)
 *
 * The import's card read (POST /api/admin/import/extract-id-card) decides the KIND from what the image shows — an MRZ,
 * the layout, „Pașaport", a domicile abroad — and returns that kind's fields (Ask first 1). This module is what the
 * review dialog does with the answer, by the design's section 2.3 (Ask first 3):
 *   - the card's values → the document: its common columns (number, issue date, validity end, issuer — as before,
 *     `documentFieldsFromIdCard`) and its identity values (`identityValuesFromRead`), only the kind's own fields;
 *   - the person's facts → the person: a NEW person gets them all (names, CNP, sex, date and place of birth,
 *     citizenship, the domicile as the home address — a passport's county or country only, Ask first 4); an EXISTING
 *     person gets only what is empty on them (`fillEmptyPersonPatch`), and nothing filled is overwritten;
 *   - natural_person's id_* columns: never (40.85).
 * A CNP whose control digit is wrong is a misread: it goes nowhere, and the review shows it to be corrected.
 *
 * PURE — no React, no fetch, no DB.
 */
import {
  IDENTITY_KINDS,
  identityKindForTypeKey,
  identityValueKeysOf,
  isIdentityKind,
  type IdentityKind,
  type IdentityValueKey,
} from "@/lib/identity-documents/kinds";
import { isValidCnp } from "@/lib/identity-documents/validation";

/** The read's fields, as the route returns them (the review form's names, and the four the person has no field for). */
export type IdentityReadFields = Partial<
  Record<
    | "lastName"
    | "firstName"
    | "gender"
    | "dateOfBirth"
    | "cnp"
    | "placeOfBirth"
    | "citizenshipRaw"
    | "idDocumentNumber"
    | "idCardNumber"
    | "idIssuingAuthority"
    | "idValidFrom"
    | "idValidUntil"
    | "idMrzRaw"
    | "addressStreetLine"
    | "addressPostalCode"
    | "addressLocality"
    | "addressCounty"
    | "addressCountry"
    | "civilStatus"
    | "issuerOfficer"
    | "passportType"
    | "countryCode",
    string | null
  >
>;

export type IdentityReadParents = { father?: string | null; mother?: string | null };

/**
 * The kind the read found; else the classifier's hint (the document's type key); else tip nou — the card the read
 * handled before 40.86. The read's kind wins over the hint (Ask first 1).
 */
export function identityKindOfRead(readKind: unknown, hintTypeKey: string | null | undefined): IdentityKind {
  if (isIdentityKind(readKind)) return readKind;
  return identityKindForTypeKey(hintTypeKey) ?? "CI_NOU";
}

const filled = (v: string | null | undefined): v is string => typeof v === "string" && v.trim() !== "";
const iso = (v: string | null | undefined): string | null => (filled(v) && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v.trim()) ? v.trim() : null);

/** The CNP as it may be written: 13 digits with a right control digit, else nothing. */
export function usableCnp(cnp: string | null | undefined): string | null {
  const v = (cnp ?? "").replace(/\s+/g, "");
  return isValidCnp(v) ? v : null;
}

/** The domicile as one line, the way the card prints it: street, locality, county. */
export function domicileLineOf(f: IdentityReadFields): string | null {
  const county = filled(f.addressCounty) ? `jud. ${f.addressCounty.trim().replace(/^jud(e[țt]ul)?\.?\s*/i, "")}` : null;
  const parts = [f.addressStreetLine, f.addressLocality, county].filter(filled).map((p) => p.trim());
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * The identity values a read gives a document of `kind`: only the kind's own fields, empty ones left out. The
 * document's common columns — the number, the dates, the issuer — are `documentFieldsFromIdCard`'s, not these.
 */
export function identityValuesFromRead(
  kind: IdentityKind,
  f: IdentityReadFields,
  parents: IdentityReadParents = {},
): Partial<Record<IdentityValueKey, string>> {
  const all: Record<IdentityValueKey, string | null> = {
    lastName: f.lastName ?? null,
    firstName: f.firstName ?? null,
    cnp: usableCnp(f.cnp),
    sex: f.gender === "MALE" || f.gender === "FEMALE" ? f.gender : null,
    dateOfBirth: iso(f.dateOfBirth),
    placeOfBirth: f.placeOfBirth ?? null,
    nationality: f.citizenshipRaw ?? null,
    fatherFirstName: parents.father ?? null,
    motherFirstName: parents.mother ?? null,
    civilStatus: f.civilStatus ?? null,
    domicileAddress: domicileLineOf(f),
    domicileCounty: f.addressCounty ?? null,
    domicileCountry: f.addressCountry ?? null,
    issuerOfficer: f.issuerOfficer ?? null,
    passportType: f.passportType ?? null,
    countryCode: f.countryCode ?? null,
    mrz: f.idMrzRaw ?? null,
    cardNumber: f.idCardNumber ?? null,
  };
  const out: Partial<Record<IdentityValueKey, string>> = {};
  for (const k of identityValueKeysOf(kind)) {
    const v = all[k];
    if (filled(v)) out[k] = v.trim();
  }
  return out;
}

/**
 * The review's card fields for a kind (`ID_CARD_DIALOG_ROWS.idCard`'s names): a booklet has no validity end, and only
 * tip nou a „Nr. card".
 */
export function cardFieldsOfKind(kind: IdentityKind): readonly ("idDocumentNumber" | "idCardNumber" | "idValidFrom" | "idValidUntil" | "idIssuingAuthority")[] {
  const keys = new Set(IDENTITY_KINDS[kind].fields.map((d) => d.key));
  return (["idDocumentNumber", "idCardNumber", "idValidFrom", "idValidUntil", "idIssuingAuthority"] as const).filter((f) =>
    f === "idCardNumber" ? keys.has("cardNumber") : f === "idValidUntil" ? keys.has("dateValidUntil") : true,
  );
}

/** The person's facts a read may fill on an EXISTING person, by its API names. */
export type PersonFacts = {
  cnp?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  citizenshipId?: string | null;
};

/**
 * An existing person's empty fields, filled from the read — and nothing else (Ask first 3). A filled field is never
 * overwritten: where the read disagrees, the resolution dialog already showed both. The home address is not touched
 * on an existing person (Ask first 4).
 */
export function fillEmptyPersonPatch(existing: PersonFacts, read: PersonFacts): PersonFacts {
  const patch: PersonFacts = {};
  if (!filled(existing.cnp)) {
    const cnp = usableCnp(read.cnp);
    if (cnp) patch.cnp = cnp;
  }
  if (!filled(existing.gender) && (read.gender === "MALE" || read.gender === "FEMALE")) patch.gender = read.gender;
  if (!filled(existing.dateOfBirth)) {
    const d = iso(read.dateOfBirth);
    if (d) patch.dateOfBirth = d;
  }
  if (!filled(existing.placeOfBirth) && filled(read.placeOfBirth)) patch.placeOfBirth = read.placeOfBirth.trim();
  if (!filled(existing.citizenshipId) && filled(read.citizenshipId)) patch.citizenshipId = read.citizenshipId;
  return patch;
}
