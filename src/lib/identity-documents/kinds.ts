/**
 * The identity-document kinds, and the fields each one has.            (Slice 40.82)
 *
 * ONE registry, in code. The archive knows four identity-document types — Carte de Identitate (tip vechi),
 * Carte de Identitate (tip nou), Pașaport, Pașaport CRDS — each marked in the database by
 * `lookup_document_type.identity_kind` (migration_118), never recognised by its name. Which fields a kind has, in
 * what order, under which label and at what width is THIS file: Adrian's four lists of 2026-10-26, as the design's
 * matrix (Identity.Documents.Design.v01, section 2.2) sets them out. An identity type never holds a free form
 * (`template_fields`): its fields are these, the same for every document of the kind (#32.07's rule, kept).
 *
 * Slice 40.94: a kind is its ROWS — Adrian's rows of 2026-10-28, top to bottom and left to right, as the „Act de
 * identitate" tile draws them, in edit and in the read view. `fields` is derived from them in that order, and is
 * what every other walker (validation, the import's read, the person dialog, the system form) reads. A field at TILE
 * on one kind (`tile`, on a row of its own) keeps its own width on another: Locul nașterii is TILE on both cards and
 * beside Data nașterii on the passports.
 *
 * Four of a kind's fields are the document's own columns — the number, the issue date, the validity end and the
 * issuer — so lists, filters and the expiry status keep working on them; the rest live in `identity_document`, one
 * row per document. `target` says which.
 *
 * Adding a fifth kind (design 2.6): one entry in `IDENTITY_KINDS` below, its type row with the marker in a
 * migration, its labels in messages/*.json, and — if the import must read it — one more kind in the read. The
 * `onboard-document-type` skill has the steps.
 *
 * PURE — no React, no DB, no next/*. Safe to import from a client component.
 */
import { IDENTITY_DOCUMENT, type FieldWidth } from "@/lib/ui/field-widths";

/** The marker values `lookup_document_type.identity_kind` may hold (its CHECK constraint is this list). */
export const IDENTITY_KIND_VALUES = ["CI_VECHE", "CI_NOU", "PASAPORT", "PASAPORT_CRDS"] as const;
export type IdentityKind = (typeof IDENTITY_KIND_VALUES)[number];

export function isIdentityKind(value: unknown): value is IdentityKind {
  return typeof value === "string" && (IDENTITY_KIND_VALUES as readonly string[]).includes(value);
}

/**
 * The fields stored in `identity_document`, by their API / snapshot name, with the column each one is.
 * Order here is the table's; the order a kind SHOWS them in is the kind's own list below.
 */
export const IDENTITY_VALUE_COLUMNS = {
  lastName: "last_name",
  firstName: "first_name",
  cnp: "cnp",
  sex: "sex",
  dateOfBirth: "date_of_birth",
  placeOfBirth: "place_of_birth",
  nationality: "nationality",
  fatherFirstName: "father_first_name",
  motherFirstName: "mother_first_name",
  civilStatus: "civil_status",
  domicileAddress: "domicile_address",
  domicileCounty: "domicile_county",
  domicileCountry: "domicile_country",
  issuerOfficer: "issuer_officer",
  passportType: "passport_type",
  countryCode: "country_code",
  mrz: "mrz",
  cardNumber: "card_number",
} as const;
export type IdentityValueKey = keyof typeof IDENTITY_VALUE_COLUMNS;
export const IDENTITY_VALUE_KEYS = Object.keys(IDENTITY_VALUE_COLUMNS) as IdentityValueKey[];

/** The four fields that are the document's own columns. */
export const IDENTITY_DOCUMENT_COLUMNS = {
  nrDocument: "nr_document",
  dateDocument: "date_document",
  dateValidUntil: "date_valid_until",
  issuer: "issuer_person_id",
} as const;
export type IdentityDocumentFieldKey = keyof typeof IDENTITY_DOCUMENT_COLUMNS;

export type IdentityFieldKey = IdentityValueKey | IdentityDocumentFieldKey;

/** What a field holds — what the one validating module checks it as. */
export type IdentityValueType = "text" | "date" | "sex" | "cnp" | "lines" | "issuer";

export type IdentityFieldDef = {
  key: IdentityFieldKey;
  /** `document` = a column every document has; `identity` = `identity_document`. */
  target: "document" | "identity";
  /** The column, on `document` or on `identity_document`. */
  column: string;
  /** The label, under the `identityDocument` namespace of messages/*.json. */
  messageKey: `identityDocument.fields.${string}`;
  type: IdentityValueType;
  width: FieldWidth;
};

// Slice 40.83: every width is the screen's own table, `IDENTITY_DOCUMENT` (src/lib/ui/field-widths.ts).
function idf(key: IdentityValueKey, type: IdentityValueType, label: string = key): IdentityFieldDef {
  return { key, target: "identity", column: IDENTITY_VALUE_COLUMNS[key], messageKey: `identityDocument.fields.${label}`, type, width: IDENTITY_DOCUMENT[key] };
}
function docf(key: IdentityDocumentFieldKey, type: IdentityValueType, label: string): IdentityFieldDef {
  return { key, target: "document", column: IDENTITY_DOCUMENT_COLUMNS[key], messageKey: `identityDocument.fields.${label}`, type, width: IDENTITY_DOCUMENT[key] };
}

// The fields, as each kind prints them. A label differs by kind only where the card prints a different word: a
// card's „Seria și numărul" is a passport's „Nr. pașaportului", its „Data eliberării" a passport's „Data emiterii".
const F = {
  seriesAndNumber: docf("nrDocument", "text", "seriesAndNumber"),
  passportNumber: docf("nrDocument", "text", "passportNumber"),
  issueDate: docf("dateDocument", "date", "issueDate"),
  passportIssueDate: docf("dateDocument", "date", "passportIssueDate"),
  validUntil: docf("dateValidUntil", "date", "validUntil"),
  passportValidUntil: docf("dateValidUntil", "date", "passportValidUntil"),
  issuer: docf("issuer", "issuer", "issuer"),
  passportIssuer: docf("issuer", "issuer", "passportIssuer"),
  lastName: idf("lastName", "text"),
  firstName: idf("firstName", "text"),
  fatherFirstName: idf("fatherFirstName", "text"),
  motherFirstName: idf("motherFirstName", "text"),
  cnp: idf("cnp", "cnp"),
  sex: idf("sex", "sex"),
  dateOfBirth: idf("dateOfBirth", "date"),
  placeOfBirth: idf("placeOfBirth", "text"),
  civilStatus: idf("civilStatus", "text"),
  nationality: idf("nationality", "text"),
  domicileAddress: idf("domicileAddress", "text"),
  domicileCounty: idf("domicileCounty", "text"),
  domicileCountry: idf("domicileCountry", "text"),
  issuerOfficer: idf("issuerOfficer", "text"),
  passportType: idf("passportType", "text"),
  countryCode: idf("countryCode", "text"),
  mrz: idf("mrz", "lines"),
  cardNumber: idf("cardNumber", "text"),
} as const;

/**
 * A field at TILE on this kind: on a row of its own, its box the tile's whole inner width (`fill`, as Note's). Its
 * value kind is kept — the MRZ stays `lines`, two of them.                                     (Slice 40.94)
 */
function tile(f: IdentityFieldDef): IdentityFieldDef {
  const { rows, fold } = f.width;
  return { ...f, width: { step: "TILE", kind: f.width.kind, fill: true, ...(rows !== undefined ? { rows } : {}), ...(fold !== undefined ? { fold } : {}) } };
}

/** The kind's fields, from its rows: left to right, top to bottom. */
function kindDef(def: Omit<IdentityKindDef, "fields">): IdentityKindDef {
  return { ...def, fields: def.rows.flat() };
}

export type IdentityKindDef = {
  kind: IdentityKind;
  /** The `lookup_document_type.key` migration_118 gives the kind's type. */
  typeKey: string;
  /** The type's Romanian name, as migration_118 writes it. */
  typeName: string;
  /** The kind's own name, under `identityDocument.kinds`. */
  messageKey: `identityDocument.kinds.${IdentityKind}`;
  /** Slice 40.94: the tile's rows, as Adrian set them — drawn as written, never re-flowed. A TILE field is alone on its row. */
  rows: readonly (readonly IdentityFieldDef[])[];
  /** The fields, in the rows' order (derived from `rows`). */
  fields: readonly IdentityFieldDef[];
};

/**
 * The passports' rows (Adrian, 2026-10-28): „Titular" is the holder line the tile draws above them, and the status
 * (VALABIL / EXPIRAT) is drawn beside Data expirării — neither is a field. The domicile, beside CNP, is a county on
 * a Pașaport and a country on a Pașaport CRDS.
 */
function passportRows(domicile: IdentityFieldDef): readonly (readonly IdentityFieldDef[])[] {
  return [
    [F.passportType, F.countryCode, F.passportNumber],
    [F.lastName, F.firstName],
    [F.nationality, F.sex],
    [F.dateOfBirth, F.placeOfBirth],
    [F.passportIssueDate, F.passportValidUntil],
    [tile(F.passportIssuer)],
    [F.cnp, domicile],
    [tile(F.mrz)],
  ];
}

export const IDENTITY_KINDS: Readonly<Record<IdentityKind, IdentityKindDef>> = {
  // The booklet „buletin" (Adrian, 2026-10-26, Q #15/#18): exactly his list — no CNP, no Sex, no validity end, no
  // MRZ. „Status" is „Starea civilă" (Q #16). „Emisă de" is the institution AND the officer who signed it.
  CI_VECHE: kindDef({
    kind: "CI_VECHE",
    typeKey: "CARTE_IDENTITATE_VECHE",
    typeName: "Carte de Identitate (tip vechi)",
    messageKey: "identityDocument.kinds.CI_VECHE",
    rows: [
      [F.lastName, F.firstName],
      [F.fatherFirstName, F.motherFirstName],
      [F.civilStatus, F.dateOfBirth],
      [tile(F.placeOfBirth)],
      [tile(F.domicileAddress)],
      [tile(F.issuer)],
      [F.issueDate, F.issuerOfficer],
      [F.seriesAndNumber],
    ],
  }),
  // Today's „Carte de Identitate", renamed; its key is kept, so everything keyed on it keeps working. The laminated
  // card of 1997–2009 prints a CNP, a validity end and an MRZ, so it is filed here too. „Nr. card" kept, optional
  // (Q #17).
  CI_NOU: kindDef({
    kind: "CI_NOU",
    typeKey: "CARTE_IDENTITATE",
    typeName: "Carte de Identitate (tip nou)",
    messageKey: "identityDocument.kinds.CI_NOU",
    rows: [
      [F.seriesAndNumber, F.cnp],
      [F.lastName, F.firstName],
      [F.nationality, F.sex],
      [tile(F.placeOfBirth)],
      [tile(F.domicileAddress)],
      [tile(F.issuer)],
      [F.issueDate, F.validUntil],
      [tile(F.mrz)],
      [F.cardNumber],
    ],
  }),
  // The two passports share every field but the domicile: a county for one living in Romania, a country for CRDS.
  PASAPORT: kindDef({
    kind: "PASAPORT",
    typeKey: "PASAPORT",
    typeName: "Pașaport",
    messageKey: "identityDocument.kinds.PASAPORT",
    rows: passportRows(F.domicileCounty),
  }),
  PASAPORT_CRDS: kindDef({
    kind: "PASAPORT_CRDS",
    typeKey: "PASAPORT_CRDS",
    typeName: "Pașaport CRDS",
    messageKey: "identityDocument.kinds.PASAPORT_CRDS",
    rows: passportRows(F.domicileCountry),
  }),
};

/** The type keys of the four kinds — what a caller without the marker column falls back to. */
export const IDENTITY_TYPE_KEYS: readonly string[] = IDENTITY_KIND_VALUES.map((k) => IDENTITY_KINDS[k].typeKey);

/** The kind a type KEY belongs to, or null. */
export function identityKindForTypeKey(key: string | null | undefined): IdentityKind | null {
  const k = key?.trim() ?? "";
  if (!k) return null;
  return IDENTITY_KIND_VALUES.find((kind) => IDENTITY_KINDS[kind].typeKey === k) ?? null;
}

/**
 * Which kind is this document TYPE, or null when it is an ordinary one?
 *
 * The marker column is the answer wherever the caller read it: `identityKind` present (a string or null) is
 * believed as it stands. A caller whose row does not carry the column (`identityKind` undefined) falls back to the
 * key, which for the four kinds is the code's own (`IDENTITY_KINDS[*].typeKey`). The NAME is never asked — a type
 * named „Carte de identitate …" without the marker is an ordinary type; `isIdCardTypeName` stays only where a label
 * the classifier read off an image is judged.
 */
export function identityKindOfType(type: { key?: string | null; identityKind?: string | null } | null | undefined): IdentityKind | null {
  if (!type) return null;
  if (type.identityKind !== undefined) return isIdentityKind(type.identityKind) ? type.identityKind : null;
  return identityKindForTypeKey(type.key);
}

/**
 * A Reference Data row's kind.                                          (Slice 40.84)
 *
 * The list and the type's page hold rows as `Record<string, unknown>` (every column of `lookup_document_type`), so
 * the two columns are read off it explicitly: the marker where the row carries it, else the key. Never the name.
 */
export function identityKindOfRow(row: Record<string, unknown> | null | undefined): IdentityKind | null {
  if (!row) return null;
  return identityKindOfType({
    key: typeof row.key === "string" ? row.key : null,
    ...(row.identityKind !== undefined ? { identityKind: typeof row.identityKind === "string" ? row.identityKind : null } : {}),
  });
}

/** Is this document TYPE an identity document? One answer, read off the marker (see `identityKindOfType`). */
export function documentTypeIsIdentity(type: { key?: string | null; identityKind?: string | null } | null | undefined): boolean {
  return identityKindOfType(type) !== null;
}

/** The identity-table fields a kind has (the document's own four are not among them). */
export function identityValueKeysOf(kind: IdentityKind): IdentityValueKey[] {
  return IDENTITY_KINDS[kind].fields.filter((f) => f.target === "identity").map((f) => f.key as IdentityValueKey);
}

/** Does this kind have this field? */
export function kindHasField(kind: IdentityKind, key: IdentityFieldKey): boolean {
  return IDENTITY_KINDS[kind].fields.some((f) => f.key === key);
}
