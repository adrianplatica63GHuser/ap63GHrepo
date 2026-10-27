/**
 * natural_person's identity-card columns.                              (Slice 40.85)
 *
 * Since 40.82 a person's identity documents are documents of their own (`identity_document`), and since 40.85 no
 * screen, API, matching rule or deed reader read or wrote these seven columns; migration_119 dropped them (FU-366,
 * Adrian's go-ahead of 2026-10-27). They live on in the versions written before 40.85, which show them read-only in
 * the history — these keys are those versions' keys.
 *
 * PURE — safe to import from a client component.
 */
export const LEGACY_PERSON_ID_CARD_KEYS = [
  "idDocumentType",
  "idDocumentNumber",
  "idCardNumber",
  "idValidFrom",
  "idValidUntil",
  "idIssuingAuthority",
  "idMrzRaw",
] as const;
export type LegacyPersonIdCardKey = (typeof LEGACY_PERSON_ID_CARD_KEYS)[number];

/**
 * The identity-card values a version written BEFORE Slice 40.85 holds (migration_030's backfill and every save until
 * then). A version written since has none of them. Shown read-only in the history, under their old labels; never
 * compared, never written back.
 */
export type LegacyPersonIdCardSnapshot = Partial<Record<LegacyPersonIdCardKey, string | null>>;
